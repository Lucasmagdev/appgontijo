import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileCheck2, FileText, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type PlanningKind = 'planning' | 'endConstruction'

type PlanningRow = {
  id: string
  numeroEstacas: string
  diametro: string
}

type SavePayload = {
  rows: PlanningRow[]
  endDate?: string
}

type Props = {
  diarioId: number
  equipamentoId?: string
  kind: PlanningKind
}

const DIAMETER_OPTIONS = ['20', '25', '30', '35', '40', '50', '60', '70', '80', '100', '120']

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '56px',
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: '#f8fafc',
  padding: '0 16px',
  fontSize: '16px',
  fontWeight: 700,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

function genId() {
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeRow(raw: unknown): PlanningRow | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const numeroEstacas = String(row.numeroEstacas || row.numero_estacas || row.piles || '').trim()
  const diametro = String(row.diametro || row.diameter || '').trim()
  if (!numeroEstacas && !diametro) return null
  return { id: String(row.id || genId()), numeroEstacas, diametro }
}

function formatDateBr(value: string) {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) return '00/00/0000'
  return `${day}/${month}/${year}`
}

export default function DiarioPlanejamentoPage({ diarioId, equipamentoId, kind }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [numeroEstacas, setNumeroEstacas] = useState('')
  const [diametro, setDiametro] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [endDate, setEndDate] = useState('')
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`

  const title = kind === 'planning' ? 'Planejamento diario' : 'Planejamento final da obra'
  const helper = kind === 'planning' ? 'Nº de estacas planejadas para o dia seguinte' : 'Nº de estacas planejadas para o final da obra'
  const Icon = kind === 'planning' ? FileText : FileCheck2

  const rows = (() => {
    const raw = diarioQuery.data?.dadosJson
    if (!raw || typeof raw !== 'object') return []
    const json = raw as Record<string, unknown>
    const list = Array.isArray(json[kind]) ? json[kind] : []
    return list.map(normalizeRow).filter((item): item is PlanningRow => item !== null)
  })()

  useEffect(() => {
    const json = (diarioQuery.data?.dadosJson as Record<string, unknown> | null) || {}
    setEndDate(String(json.endDate || ''))
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async ({ rows: nextRows, endDate: nextEndDate }: SavePayload) => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          [kind]: nextRows.map((item) => ({
            numeroEstacas: item.numeroEstacas.trim(),
            diametro: item.diametro.trim(),
          })),
          ...(kind === 'endConstruction' ? { endDate: nextEndDate ?? endDate } : {}),
        },
      })
    },
    onSuccess: async () => {
      resetForm()
      setSubmitError('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  function resetForm() {
    setNumeroEstacas('')
    setDiametro('')
    setEditingId(null)
  }

  function handleAdd() {
    if (!numeroEstacas.trim()) {
      setSubmitError('Informe o numero de estacas.')
      return
    }
    if (!diametro.trim()) {
      setSubmitError('Selecione o diametro.')
      return
    }

    const item: PlanningRow = {
      id: editingId || genId(),
      numeroEstacas: numeroEstacas.trim(),
      diametro: diametro.trim(),
    }

    const nextRows = editingId
      ? rows.map((row) => (row.id === editingId ? item : row))
      : [...rows, item]

    setSubmitError('')
    saveMutation.mutate({ rows: nextRows })
  }

  function handleDelete(id: string) {
    if (editingId === id) resetForm()
    saveMutation.mutate({ rows: rows.filter((row) => row.id !== id) })
  }

  function handleEdit(item: PlanningRow) {
    setNumeroEstacas(item.numeroEstacas)
    setDiametro(item.diametro)
    setEditingId(item.id)
    setSubmitError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleBack() {
    if (kind === 'endConstruction') {
      saveMutation.mutate({ rows, endDate })
      return
    }

    navigate(backUrl)
  }

  function handleSaveDate(value: string) {
    setEndDate(value)
    setSubmitError('')
  }

  const canBack = kind === 'planning' ? true : Boolean(endDate || rows.length > 0)

  return (
    <div style={pageStyle}>
      <Header onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconBadge><Icon size={22} color="#a72727" /></IconBadge>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727', lineHeight: 1.1 }}>{title}</div>
        </div>

        {diarioQuery.isLoading ? <div style={loadingTextStyle}>Carregando dados do diario...</div> : null}
        {diarioQuery.isError ? <FeedbackBox>{extractApiErrorMessage(diarioQuery.error)}</FeedbackBox> : null}

        {!diarioQuery.isLoading && !diarioQuery.isError ? (
          <div style={panelStyle}>
            {kind === 'endConstruction' ? (
              <div style={{ display: 'grid', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Data de termino da obra:</span>
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById(`end-date-${diarioId}`) as HTMLInputElement | null
                    input?.showPicker?.()
                    input?.click()
                  }}
                  style={{
                    ...inputStyle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: endDate ? '#b91c1c' : '#9ca3af',
                  }}
                >
                  <span>{formatDateBr(endDate)}</span>
                  <CalendarDays size={18} color="#9ca3af" />
                  <input
                    id={`end-date-${diarioId}`}
                    type="date"
                    value={endDate}
                    onChange={(event) => handleSaveDate(event.target.value)}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                  />
                </button>
              </div>
            ) : null}

            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{helper}</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={fieldLabelStyle}>Nº de estacas</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={numeroEstacas}
                  onChange={(event) => {
                    setNumeroEstacas(event.target.value)
                    setSubmitError('')
                  }}
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: '8px' }}>
                <span style={fieldLabelStyle}>Diametro</span>
                <select
                  value={diametro}
                  onChange={(event) => {
                    setDiametro(event.target.value)
                    setSubmitError('')
                  }}
                  style={{
                    ...inputStyle,
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    backgroundImage: 'linear-gradient(45deg, transparent 50%, #6b7280 50%), linear-gradient(135deg, #6b7280 50%, transparent 50%)',
                    backgroundPosition: 'calc(100% - 22px) calc(50% - 3px), calc(100% - 14px) calc(50% - 3px)',
                    backgroundSize: '8px 8px, 8px 8px',
                    backgroundRepeat: 'no-repeat',
                    paddingRight: '44px',
                  }}
                >
                  <option value="">Selecione</option>
                  {DIAMETER_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item} cm</option>
                  ))}
                </select>
              </label>
            </div>

            {submitError ? <FeedbackBox>{submitError}</FeedbackBox> : null}

            <button
              onClick={handleAdd}
              disabled={saveMutation.isPending}
              style={secondaryButtonStyle(saveMutation.isPending)}
            >
              {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar' : 'Adicionar'}
            </button>

            {rows.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {rows.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderRadius: '18px',
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827' }}>{item.numeroEstacas} estacas</div>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>Diametro: {item.diametro} cm</div>
                    </div>
                    <button onClick={() => handleEdit(item)} style={iconButtonStyle('#f1f5f9')}>
                      <Pencil size={13} color="#475569" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} style={iconButtonStyle('#fef2f2')}>
                      <Trash2 size={13} color="#b91c1c" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <button
              onClick={handleBack}
              disabled={!canBack || saveMutation.isPending}
              style={backButtonStyle(!canBack || saveMutation.isPending)}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Voltar'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
  maxWidth: '430px',
  margin: '0 auto',
}

const panelStyle: CSSProperties = {
  borderRadius: '22px',
  background: '#fff',
  border: '1px solid rgba(15,23,42,0.06)',
  boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
  padding: '18px 16px',
  display: 'grid',
  gap: '16px',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#1f2937',
}

const loadingTextStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
}

function Header({ onBack }: { onBack: () => void }) {
  return (
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
        onClick={onBack}
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
      <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Diario de obras</div>
    </div>
  )
}

function IconBadge({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function FeedbackBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #fecaca',
        borderRadius: '14px',
        padding: '14px',
        background: '#fef2f2',
        color: '#b91c1c',
        fontSize: '14px',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: '22px',
    background: disabled ? '#d1d5db' : '#d4d4d8',
    color: '#1f2937',
    minHeight: '56px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
}

function backButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: '22px',
    background: disabled ? '#9ca3af' : '#4b5563',
    color: '#fff',
    minHeight: '64px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 14px 28px rgba(75,85,99,0.18)',
    marginTop: '4px',
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
    flexShrink: 0,
  }
}
