import { type CSSProperties, type ReactNode, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Clock3, Pencil, Plus, ShieldAlert, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

const PREDEFINIDAS = [
  { id: 'chuva-forte', label: 'Chuva forte - paralisacao da atividade' },
  { id: 'falta-material', label: 'Falta de material / insumo' },
  { id: 'falha-equipamento', label: 'Falha no equipamento' },
  { id: 'manutencao-nao-programada', label: 'Manutencao nao programada' },
  { id: 'acidente-trabalho', label: 'Acidente de trabalho' },
  { id: 'atraso-equipe', label: 'Atraso ou falta da equipe' },
  { id: 'paralisacao-cliente', label: 'Paralisacao a pedido do cliente' },
  { id: 'falta-agua-concreto', label: 'Falta de agua / concreto' },
  { id: 'problema-eletrico', label: 'Problema eletrico' },
  { id: 'problema-solo', label: 'Dificuldade no solo / terreno' },
  { id: 'interferencia-terceiros', label: 'Interferencia de terceiros na area' },
  { id: 'aguardando-projeto', label: 'Aguardando projeto / liberacao tecnica' },
  { id: 'vento-forte', label: 'Vento forte / condicoes climaticas adversas' },
  { id: 'acesso-dificil', label: 'Dificuldade de acesso ao local' },
] as const

type PredefinidaId = (typeof PREDEFINIDAS)[number]['id']

type DiarioOcorrencia = {
  id: string
  tipo: 'predefinida' | 'manual'
  categoriaId?: PredefinidaId
  descricao: string
  horaInicial?: string
  horaFinal?: string
  createdAt: string
}

type Props = {
  diarioId: number
  equipamentoId?: string
}

type TimeStep = 'hour' | 'minute'
type ActiveTimeField = 'inicio' | 'fim' | null

function genId() {
  return `ocorr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeTime(value: unknown) {
  const text = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : ''
}

function getTimeParts(value: string) {
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  return {
    hour: Number.isFinite(hour) ? hour : 7,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function mergeTimeValue(baseValue: string, patch: Partial<{ hour: number; minute: number }>) {
  const { hour, minute } = getTimeParts(baseValue || '07:00')
  const nextHour = patch.hour ?? hour
  const nextMinute = patch.minute ?? minute
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

function addMinutes(value: string, delta: number) {
  const { hour, minute } = getTimeParts(value || '07:00')
  const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + delta))
  const nextHour = Math.floor(total / 60)
  const nextMinute = total % 60
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

function normalizeOcorrencia(raw: unknown): DiarioOcorrencia | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const tipo = row.tipo === 'predefinida' ? 'predefinida' : 'manual'
  const descricao = String(row.descricao || row.desc || '').trim()
  if (!descricao) return null

  return {
    id: String(row.id || genId()),
    tipo,
    categoriaId: typeof row.categoriaId === 'string' ? (row.categoriaId as PredefinidaId) : undefined,
    descricao,
    horaInicial: normalizeTime(row.horaInicial || row.hora_ini),
    horaFinal: normalizeTime(row.horaFinal || row.hora_fim),
    createdAt: String(row.createdAt || new Date().toISOString()),
  }
}

function formatTimeRange(item: DiarioOcorrencia) {
  if (item.horaInicial && item.horaFinal) return `${item.horaInicial} - ${item.horaFinal}`
  if (item.horaInicial) return `Inicio: ${item.horaInicial}`
  if (item.horaFinal) return `Fim: ${item.horaFinal}`
  return 'Sem horario informado'
}

function buildLegacyOccurrence(item: DiarioOcorrencia) {
  return {
    desc: item.descricao,
    tipo: item.tipo,
    categoriaId: item.categoriaId || null,
    hora_ini: item.horaInicial || null,
    hora_fim: item.horaFinal || null,
  }
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px 15px',
  borderRadius: '16px',
  border: '1.5px solid #d8dee7',
  background: '#f8fafc',
  fontSize: '15px',
  fontWeight: 600,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

export default function DiarioOcorrenciasPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [descricao, setDescricao] = useState('')
  const [horaInicial, setHoraInicial] = useState('')
  const [horaFinal, setHoraFinal] = useState('')
  const [selectedPredefinida, setSelectedPredefinida] = useState<PredefinidaId | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeTimeField, setActiveTimeField] = useState<ActiveTimeField>(null)
  const [timeStep, setTimeStep] = useState<TimeStep>('hour')

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId

  const ocorrencias = useMemo(() => {
    const raw = diarioQuery.data?.dadosJson
    if (!raw || typeof raw !== 'object') return []
    const json = raw as Record<string, unknown>
    const list = Array.isArray(json.ocorrencias) ? json.ocorrencias : json.occurrences
    if (!Array.isArray(list)) return []
    return list.map(normalizeOcorrencia).filter((item): item is DiarioOcorrencia => item !== null)
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async (next: DiarioOcorrencia[]) => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          ocorrencias: next,
          occurrences: next.map(buildLegacyOccurrence),
          ocorrencias_confirmed: next.length > 0,
          occurrences_confirmed: next.length > 0,
        },
      })
    },
    onSuccess: async () => {
      resetForm()
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (err) => setSubmitErr(extractApiErrorMessage(err)),
  })

  function resetForm() {
    setDescricao('')
    setHoraInicial('')
    setHoraFinal('')
    setSelectedPredefinida(null)
    setEditingId(null)
    setSubmitErr('')
    setPickerOpen(false)
    setActiveTimeField(null)
    setTimeStep('hour')
  }

  function validateForm() {
    const text = descricao.trim()
    if (!text) return 'Informe a ocorrencia antes de salvar.'
    if (horaInicial && horaFinal && horaFinal < horaInicial) {
      return 'A hora final nao pode ser antes da hora inicial.'
    }
    return ''
  }

  function buildFormItem(): DiarioOcorrencia {
    return {
      id: editingId || genId(),
      tipo: selectedPredefinida ? 'predefinida' : 'manual',
      categoriaId: selectedPredefinida || undefined,
      descricao: descricao.trim(),
      horaInicial: horaInicial || '',
      horaFinal: horaFinal || '',
      createdAt:
        ocorrencias.find((item) => item.id === editingId)?.createdAt ||
        new Date().toISOString(),
    }
  }

  function handleSubmit() {
    const error = validateForm()
    if (error) {
      setSubmitErr(error)
      return
    }

    const item = buildFormItem()
    const next = editingId
      ? ocorrencias.map((row) => (row.id === editingId ? item : row))
      : [...ocorrencias, item]

    setSubmitErr('')
    saveMutation.mutate(next)
  }

  function handleDelete(id: string) {
    if (editingId === id) resetForm()
    saveMutation.mutate(ocorrencias.filter((item) => item.id !== id))
  }

  function handleEdit(item: DiarioOcorrencia) {
    setDescricao(item.descricao)
    setHoraInicial(item.horaInicial || '')
    setHoraFinal(item.horaFinal || '')
    setSelectedPredefinida(item.tipo === 'predefinida' ? item.categoriaId || null : null)
    setEditingId(item.id)
    setSubmitErr('')
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  function choosePredefinida(id: PredefinidaId) {
    const item = PREDEFINIDAS.find((entry) => entry.id === id)
    if (!item) return
    setSelectedPredefinida(id)
    setDescricao(item.label)
    setSubmitErr('')
    setPickerOpen(false)
  }

  function openTimePicker(field: Exclude<ActiveTimeField, null>) {
    setActiveTimeField(field)
    setTimeStep('hour')
  }

  function closeTimePicker() {
    setActiveTimeField(null)
    setTimeStep('hour')
  }

  function getActiveTimeValue() {
    if (activeTimeField === 'inicio') return horaInicial || '07:00'
    if (activeTimeField === 'fim') return horaFinal || horaInicial || '17:00'
    return '07:00'
  }

  function setActiveTimeValue(nextValue: string) {
    if (activeTimeField === 'inicio') {
      setHoraInicial(nextValue)
      return
    }
    if (activeTimeField === 'fim') {
      setHoraFinal(nextValue)
    }
  }

  const isBusy = saveMutation.isPending
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`
  const selectedLabel = selectedPredefinida
    ? PREDEFINIDAS.find((item) => item.id === selectedPredefinida)?.label || ''
    : ''
  const activeTimeValue = getActiveTimeValue()

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
        width: '100%',
        maxWidth: '430px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
          padding: '0 16px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate(backUrl)}
          style={{
            background: 'rgba(0,0,0,0.28)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Ocorrencias</div>
      </div>

      {diarioQuery.isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          Carregando...
        </div>
      ) : null}

      {!diarioQuery.isLoading ? (
        <div style={{ padding: '18px 14px 80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              borderRadius: '22px',
              background: '#fff',
              border: '1px solid rgba(167,39,39,0.12)',
              boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
              padding: '16px',
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: '#fff1f1',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={22} color="#a72727" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727', lineHeight: 1.05 }}>Ocorrencias</div>
                <div style={{ marginTop: '4px', fontSize: '13px', color: '#6b7280', lineHeight: '1.45' }}>
                  Registre uma ocorrencia livremente ou escolha uma opcao pre-definida.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={fieldLabelStyle}>Ocorrencia</label>
              <textarea
                value={descricao}
                onChange={(event) => {
                  setDescricao(event.target.value)
                  setSubmitErr('')
                }}
                placeholder="Descreva a ocorrencia do diario"
                rows={4}
                style={{
                  ...inputStyle,
                  minHeight: '114px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>

            <button
              onClick={() => setPickerOpen(true)}
              type="button"
              style={{
                border: '1.5px solid #f0d2d2',
                borderRadius: '16px',
                background: '#fff7f7',
                minHeight: '54px',
                padding: '0 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#a72727', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Ocorrencia pre-definida
                </div>
                <div style={{ marginTop: '4px', fontSize: '14px', fontWeight: 700, color: selectedLabel ? '#111827' : '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedLabel || 'Escolher opcao pre-definida'}
                </div>
              </div>
              <ChevronDown size={18} color="#a72727" />
            </button>

            {selectedLabel ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '7px 10px',
                    borderRadius: '999px',
                    background: '#fff7ed',
                    color: '#9a3412',
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  Pre-definida selecionada
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPredefinida(null)
                    setSubmitErr('')
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#a72727',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Limpar selecao
                </button>
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
                <label style={fieldLabelStyle}>Hora inicial</label>
                <button
                  type="button"
                  onClick={() => openTimePicker('inicio')}
                  style={timeFieldButtonStyle(Boolean(horaInicial))}
                >
                  <span>{horaInicial || 'Selecionar'}</span>
                  <Clock3 size={16} color="#94a3b8" />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
                <label style={fieldLabelStyle}>Hora final</label>
                <button
                  type="button"
                  onClick={() => openTimePicker('fim')}
                  style={timeFieldButtonStyle(Boolean(horaFinal))}
                >
                  <span>{horaFinal || 'Selecionar'}</span>
                  <Clock3 size={16} color="#94a3b8" />
                </button>
              </div>
            </div>

            {submitErr ? <ErrorMsg text={submitErr} /> : null}

            <div style={{ display: 'grid', gridTemplateColumns: editingId ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)', gap: '10px' }}>
              <button
                onClick={handleSubmit}
                disabled={isBusy}
                style={primaryButtonStyle(isBusy)}
              >
                <Plus size={16} />
                {isBusy ? 'Salvando...' : editingId ? 'Salvar ocorrencia' : 'Adicionar ocorrencia'}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isBusy}
                  style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '16px',
                    background: '#fff',
                    color: '#374151',
                    minHeight: '54px',
                    padding: '0 16px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>

          {ocorrencias.length > 0 ? (
            <div
              style={{
                borderRadius: '22px',
                background: '#fff',
                border: '1px solid rgba(15,23,42,0.07)',
                boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1f2937' }}>
                  {ocorrencias.length} ocorrencia{ocorrencias.length !== 1 ? 's' : ''} no diario
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                  Toque para editar ou excluir
                </div>
              </div>

              <div style={{ display: 'grid' }}>
                {ocorrencias.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '14px 16px',
                      borderBottom: index < ocorrencias.length - 1 ? '1px solid #f8fafc' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div
                        style={{
                          width: '4px',
                          alignSelf: 'stretch',
                          minHeight: '46px',
                          borderRadius: '999px',
                          background: item.tipo === 'predefinida' ? '#f59e0b' : '#a72727',
                          flexShrink: 0,
                        }}
                      />

                      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '7px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '5px 8px',
                              borderRadius: '999px',
                              background: item.tipo === 'predefinida' ? '#fff7ed' : '#fff1f1',
                              color: item.tipo === 'predefinida' ? '#9a3412' : '#a72727',
                              fontSize: '10px',
                              fontWeight: 800,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {item.tipo === 'predefinida' ? 'Pre-definida' : 'Manual'}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                            {formatTimeRange(item)}
                          </span>
                        </div>

                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, lineHeight: '1.45', color: '#111827', wordBreak: 'break-word' }}>
                          {item.descricao}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEdit(item)}
                          disabled={isBusy}
                          style={iconButtonStyle('#f1f5f9')}
                        >
                          <Pencil size={13} color="#475569" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          disabled={isBusy}
                          style={iconButtonStyle('#fef2f2')}
                        >
                          <Trash2 size={13} color="#b91c1c" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                borderRadius: '22px',
                background: '#fff',
                border: '1px dashed #cbd5e1',
                padding: '26px 20px',
                textAlign: 'center',
              }}
            >
              <AlertTriangle size={28} color="#d1d5db" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5' }}>
                Nenhuma ocorrencia registrada ainda.
              </div>
            </div>
          )}

          {saveMutation.isError ? <ErrorMsg text={extractApiErrorMessage(saveMutation.error)} /> : null}
        </div>
      ) : null}

      {pickerOpen ? (
        <PickerSheet onClose={() => setPickerOpen(false)}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Ocorrencias pre-definidas</div>
                <div style={{ marginTop: '4px', fontSize: '13px', color: '#6b7280', lineHeight: '1.45' }}>
                  Escolha uma opcao para preencher rapidamente o campo de ocorrencia.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                style={{
                  border: 'none',
                  width: '34px',
                  height: '34px',
                  borderRadius: '999px',
                  background: '#f3f4f6',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={16} color="#475569" />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '10px', maxHeight: '58vh', overflowY: 'auto', paddingRight: '2px' }}>
              {PREDEFINIDAS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choosePredefinida(item.id)}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '16px',
                    background: selectedPredefinida === item.id ? '#fff7ed' : '#fff',
                    color: '#111827',
                    padding: '14px 14px',
                    textAlign: 'left',
                    fontSize: '14px',
                    fontWeight: 700,
                    lineHeight: '1.4',
                    cursor: 'pointer',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </PickerSheet>
      ) : null}

      {activeTimeField ? (
        <TimePickerModal
          title={activeTimeField === 'inicio' ? 'Horario inicial da ocorrencia' : 'Horario final da ocorrencia'}
          value={activeTimeValue}
          step={timeStep}
          onStepChange={setTimeStep}
          onPickHour={(hour) => {
            setActiveTimeValue(mergeTimeValue(activeTimeValue, { hour }))
            setTimeStep('minute')
            setSubmitErr('')
          }}
          onPickMinute={(minute) => {
            setActiveTimeValue(mergeTimeValue(activeTimeValue, { minute }))
            setSubmitErr('')
          }}
          onAdjustMinute={(delta) => {
            setActiveTimeValue(addMinutes(activeTimeValue, delta))
            setSubmitErr('')
          }}
          onCancel={closeTimePicker}
          onConfirm={closeTimePicker}
        />
      ) : null}
    </div>
  )
}

function ModalShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.56)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        zIndex: 80,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          borderRadius: '18px',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 28px 70px rgba(0,0,0,0.28)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ClockFace(_props: {
  value: string
  step: TimeStep
  onPickHour: (hour: number) => void
  onPickMinute: (minute: number) => void
}) {
  const { value, step, onPickHour, onPickMinute } = _props
  const { hour, minute } = getTimeParts(value)
  const hourInner = Array.from({ length: 12 }, (_, index) => index + 1)
  const hourOuter = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0]
  const minuteMarks = Array.from({ length: 12 }, (_, index) => index * 5)

  return (
    <div
      style={{
        position: 'relative',
        width: '280px',
        height: '280px',
        margin: '0 auto',
        borderRadius: '999px',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '12px',
          height: '12px',
          borderRadius: '999px',
          background: '#a72727',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {step === 'hour'
        ? (
            <>
              {hourOuter.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 112
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = hour === item
                return (
                  <button
                    key={`outer-${item}`}
                    onClick={() => onPickHour(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '34px',
                      height: '34px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#374151',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {String(item).padStart(2, '0')}
                  </button>
                )
              })}

              {hourInner.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 72
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = hour === item
                return (
                  <button
                    key={`inner-${item}`}
                    onClick={() => onPickHour(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#111827',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </>
          )
        : (
            <>
              {minuteMarks.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 108
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = minute === item
                return (
                  <button
                    key={`minute-${item}`}
                    onClick={() => onPickMinute(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '42px',
                      height: '42px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#111827',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {String(item).padStart(2, '0')}
                  </button>
                )
              })}
            </>
          )}
    </div>
  )
}

function TimePickerModal(_props: {
  title: string
  value: string
  step: TimeStep
  onStepChange: (step: TimeStep) => void
  onPickHour: (hour: number) => void
  onPickMinute: (minute: number) => void
  onAdjustMinute: (delta: number) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { title, value, step, onStepChange, onPickHour, onPickMinute, onAdjustMinute, onCancel, onConfirm } = _props
  const { hour, minute } = getTimeParts(value || '07:00')

  return (
    <ModalShell>
      <div
        style={{
          background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
          color: '#fff',
          padding: '20px 20px 22px',
        }}
      >
        <div style={{ fontSize: '14px', opacity: 0.8, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <button
            onClick={() => onStepChange('hour')}
            style={timeModalValueStyle(step === 'hour')}
          >
            {String(hour).padStart(2, '0')}
          </button>
          <span style={{ fontSize: '34px', fontWeight: 800, lineHeight: 1 }}>:</span>
          <button
            onClick={() => onStepChange('minute')}
            style={timeModalValueStyle(step === 'minute')}
          >
            {String(minute).padStart(2, '0')}
          </button>
        </div>
      </div>

      <div style={{ padding: '18px 18px 12px' }}>
        <ClockFace value={value} step={step} onPickHour={onPickHour} onPickMinute={onPickMinute} />

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px' }}>
          {[-10, -5, 5, 10].map((delta) => (
            <button
              key={delta}
              onClick={() => onAdjustMinute(delta)}
              style={{
                border: '1px solid #e5e7eb',
                background: '#fff',
                borderRadius: '999px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: 800,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              {delta > 0 ? `+${delta}` : delta} min
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '24px',
          padding: '10px 22px 20px',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#111827',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          CANCELAR
        </button>
        <button
          onClick={onConfirm}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#a72727',
            fontSize: '15px',
            fontWeight: 900,
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </ModalShell>
  )
}

function PickerSheet({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.46)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '430px',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          background: '#fff',
          boxShadow: '0 -18px 38px rgba(15,23,42,0.22)',
          padding: '14px 14px 24px',
          maxHeight: '82vh',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            width: '54px',
            height: '5px',
            borderRadius: '999px',
            background: '#e5e7eb',
            margin: '0 auto 14px',
          }}
        />
        {children}
      </div>
    </div>
  )
}

function ErrorMsg({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: '12px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        padding: '10px 14px',
        fontSize: '13px',
        color: '#b91c1c',
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  )
}

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '16px',
    background: disabled ? '#cbd5e1' : '#a72727',
    color: '#fff',
    minHeight: '54px',
    width: '100%',
    fontSize: '15px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 10px 22px rgba(167,39,39,0.18)',
  }
}

function iconButtonStyle(background: string): CSSProperties {
  return {
    background,
    border: 'none',
    borderRadius: '10px',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}

function timeFieldButtonStyle(hasValue: boolean): CSSProperties {
  return {
    ...inputStyle,
    minHeight: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    cursor: 'pointer',
    color: hasValue ? '#111827' : '#6b7280',
  }
}

function timeModalValueStyle(active: boolean): CSSProperties {
  return {
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: '40px',
    fontWeight: 900,
    lineHeight: 1,
    opacity: active ? 1 : 0.76,
    cursor: 'pointer',
    padding: 0,
  }
}
