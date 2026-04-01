import { type CSSProperties, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, equipamentoService, estacaService, extractApiErrorMessage } from '@/lib/gontijo-api'

// ── Types ──────────────────────────────────────────────────────────────────
type DiarioEstaca = {
  id: string
  source: 'manual' | 'sync' | 'hybrid'
  s3Key?: string
  pilar: string
  diametro: string
  realizado: number | null
  usoBits: boolean
  icamentoArmacao: boolean
  metrosIcamento: number | null
  finishedAt?: string | null
  createdAt: string
}

type FormState = {
  pilar: string
  diametro: string
  realizado: string
  usoBits: boolean
  icamentoArmacao: boolean
  metrosIcamento: string
}

type Props = {
  diarioId: number
  equipamentoId?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────
function genId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeStakeLookup(value: string) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function isHeliceContinua(nome: string) {
  const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return n.includes('helice') && n.includes('continua')
}

const emptyForm: FormState = {
  pilar: '',
  diametro: '',
  realizado: '',
  usoBits: false,
  icamentoArmacao: false,
  metrosIcamento: '',
}

function normalizeStakeRow(input: Partial<DiarioEstaca>): DiarioEstaca {
  const source = input.source === 'sync' || input.source === 'hybrid' ? input.source : 'manual'
  return {
    id: String(input.id || genId()),
    source,
    s3Key: input.s3Key || undefined,
    pilar: String(input.pilar || ''),
    diametro: String(input.diametro || ''),
    realizado: typeof input.realizado === 'number' ? input.realizado : input.realizado == null ? null : Number(input.realizado) || null,
    usoBits: Boolean(input.usoBits),
    icamentoArmacao: Boolean(input.icamentoArmacao),
    metrosIcamento:
      typeof input.metrosIcamento === 'number'
        ? input.metrosIcamento
        : input.metrosIcamento == null
          ? null
          : Number(input.metrosIcamento) || null,
    finishedAt: input.finishedAt || null,
    createdAt: String(input.createdAt || new Date().toISOString()),
  }
}

function mergeStakeSources(current: DiarioEstaca, incoming: DiarioEstaca): DiarioEstaca {
  const shouldBeHybrid = current.source === 'manual' || current.source === 'hybrid'
  return {
    ...current,
    source: shouldBeHybrid ? 'hybrid' : 'sync',
    s3Key: incoming.s3Key || current.s3Key,
    pilar: incoming.pilar || current.pilar,
    diametro: incoming.diametro || current.diametro,
    realizado: incoming.realizado ?? current.realizado,
    finishedAt: incoming.finishedAt ?? current.finishedAt,
  }
}

function mergeSyncedStakes(existing: DiarioEstaca[], synced: DiarioEstaca[]) {
  const next = [...existing]
  let added = 0
  let merged = 0

  for (const syncedItem of synced) {
    const syncKey = normalizeStakeLookup(syncedItem.pilar)
    const matchIndex = next.findIndex((item) => {
      if (syncedItem.s3Key && item.s3Key && syncedItem.s3Key === item.s3Key) return true
      return Boolean(syncKey) && normalizeStakeLookup(item.pilar) === syncKey
    })

    if (matchIndex >= 0) {
      next[matchIndex] = mergeStakeSources(next[matchIndex], syncedItem)
      merged += 1
    } else {
      next.push(syncedItem)
      added += 1
    }
  }

  return { items: next, added, merged }
}

// ── Styles ─────────────────────────────────────────────────────────────────
const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '4px',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1.5px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: '15px',
  fontWeight: 600,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

function toggleBtnStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: active ? '#fff1f1' : '#f8fafc',
    border: `1.5px solid ${active ? 'rgba(167,39,39,0.22)' : '#e2e8f0'}`,
    borderRadius: '14px',
    padding: '12px 14px',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  }
}

function getStakeSourceStyles(source: DiarioEstaca['source']) {
  if (source === 'sync') {
    return {
      rail: '#16a34a',
      badgeBg: '#f0fdf4',
      badgeColor: '#166534',
      badgeText: 'Sinc.',
    }
  }

  if (source === 'hybrid') {
    return {
      rail: '#0f766e',
      badgeBg: '#ecfeff',
      badgeColor: '#0f766e',
      badgeText: 'Manual + Sinc.',
    }
  }

  return {
    rail: '#a72727',
    badgeBg: '#fff1f1',
    badgeColor: '#a72727',
    badgeText: 'Manual',
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DiarioEstacasPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState('')
  const [syncErr, setSyncErr] = useState('')
  const [submitErr, setSubmitErr] = useState('')

  // ── Queries ──
  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos-parametrizados'],
    queryFn: equipamentoService.listParametrizados,
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const equipment = equipamentosQuery.data?.find((e) => e.id === currentEquipmentId) ?? null
  const isHC = equipment ? isHeliceContinua(equipment.modalidadeNome) : null

  // ── Parse stakes from dadosJson ──
  const stakes: DiarioEstaca[] = useMemo(() => {
    const raw = diarioQuery.data?.dadosJson
    if (!raw || typeof raw !== 'object') return []
    const list = (raw as Record<string, unknown>).stakes
    return Array.isArray(list) ? list.map((item) => normalizeStakeRow(item as Partial<DiarioEstaca>)) : []
  }, [diarioQuery.data?.dadosJson])

  // ── Save mutation ──
  const saveMutation = useMutation({
    mutationFn: async (nextStakes: DiarioEstaca[]) => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          stakes: nextStakes,
          estacas_confirmed: nextStakes.length > 0,
        },
      })
      return nextStakes
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (err) => setSubmitErr(extractApiErrorMessage(err)),
  })

  // ── Sync mutation ──
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!equipment) throw new Error('Equipamento nao identificado.')
      if (!equipment.imei) throw new Error('Equipamento sem IMEI cadastrado. Nao e possivel sincronizar.')

      const diary = diarioQuery.data
      const diaryDate = diary?.dataDiario
        || String((diary?.dadosJson as Record<string, unknown> | null)?.date || '').slice(0, 10)
      if (!diaryDate) throw new Error('Data do diario nao definida.')

      const synced = await estacaService.sync({ imei: equipment.imei, date: diaryDate.slice(0, 10) })

      if (!synced.length) {
        setSyncMsg('Nenhuma estaca encontrada na Geodigitus para este dia.')
        return stakes
      }

      const incomingItems: DiarioEstaca[] = synced
        .map((item) => ({
          id: genId(),
          source: 'sync' as const,
          s3Key: item.s3Key,
          pilar: item.pilar,
          diametro: item.diametro,
          realizado: item.realizado,
          usoBits: false,
          icamentoArmacao: false,
          metrosIcamento: null,
          finishedAt: item.finishedAt,
          createdAt: new Date().toISOString(),
        }))

      const merged = mergeSyncedStakes(stakes, incomingItems)
      if (!merged.added && !merged.merged) {
        setSyncMsg('Todas as estacas ja estavam sincronizadas.')
      } else if (merged.added && merged.merged) {
        setSyncMsg(`${merged.added} adicionada(s) e ${merged.merged} unida(s) com estacas ja registradas.`)
      } else if (merged.added) {
        setSyncMsg(`${merged.added} estaca${merged.added !== 1 ? 's' : ''} sincronizada${merged.added !== 1 ? 's' : ''}.`)
      } else {
        setSyncMsg(`${merged.merged} estaca${merged.merged !== 1 ? 's' : ''} unida${merged.merged !== 1 ? 's' : ''} com registros ja existentes.`)
      }
      return merged.items
    },
    onSuccess: async (nextStakes) => {
      setSyncErr('')
      saveMutation.mutate(nextStakes)
    },
    onError: (err) => {
      setSyncErr(extractApiErrorMessage(err))
      setSyncMsg('')
    },
  })

  // ── Form handlers ──
  function handleSubmit() {
    const pilar = form.pilar.trim()
    if (!pilar) { setSubmitErr('Informe o nome do pilar / estaca.'); return }

    const existing = editingId ? stakes.find((s) => s.id === editingId) : null
    const item: DiarioEstaca = {
      id: editingId || genId(),
      source: existing?.source || 'manual',
      s3Key: existing?.s3Key,
      pilar,
      diametro: form.diametro.trim(),
      realizado: form.realizado ? Number(form.realizado.replace(',', '.')) || null : null,
      usoBits: form.usoBits,
      icamentoArmacao: form.icamentoArmacao,
      metrosIcamento: form.icamentoArmacao && form.metrosIcamento
        ? Number(form.metrosIcamento.replace(',', '.')) || null
        : null,
      finishedAt: existing?.finishedAt,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }

    const matchIndex = !editingId
      ? stakes.findIndex((s) => normalizeStakeLookup(s.pilar) === normalizeStakeLookup(pilar))
      : -1

    const next =
      editingId
        ? stakes.map((s) => (s.id === editingId ? item : s))
        : matchIndex >= 0
          ? stakes.map((s, index) => {
              if (index !== matchIndex) return s
              return {
                ...s,
                ...item,
                id: s.id,
                s3Key: s.s3Key,
                finishedAt: s.finishedAt,
                createdAt: s.createdAt,
                source: s.source === 'sync' ? 'hybrid' : s.source,
              }
            })
          : [...stakes, item]
    setSubmitErr('')
    setEditingId(null)
    setForm(emptyForm)
    saveMutation.mutate(next)
  }

  function startEdit(estaca: DiarioEstaca) {
    setEditingId(estaca.id)
    setSubmitErr('')
    setForm({
      pilar: estaca.pilar,
      diametro: estaca.diametro,
      realizado: estaca.realizado != null ? String(estaca.realizado) : '',
      usoBits: estaca.usoBits,
      icamentoArmacao: estaca.icamentoArmacao,
      metrosIcamento: estaca.metrosIcamento != null ? String(estaca.metrosIcamento) : '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setSubmitErr('')
  }

  function handleDelete(id: string) {
    const next = stakes.filter((s) => s.id !== id)
    if (editingId === id) cancelEdit()
    saveMutation.mutate(next)
  }

  const isBusy = saveMutation.isPending || syncMutation.isPending
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
      maxWidth: '430px',
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
        padding: '0 16px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexShrink: 0,
      }}>
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
        <div>
          <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Estacas</div>
          {equipment ? (
            <div style={{ color: 'rgba(255,255,255,0.72)', fontSize: '12px', fontWeight: 600 }}>
              {equipment.modalidadeNome || 'Modalidade nao definida'}
            </div>
          ) : null}
        </div>
      </div>

      {/* Loading */}
      {(diarioQuery.isLoading || equipamentosQuery.isLoading) ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          Carregando...
        </div>
      ) : null}

      {/* Modalidade nao suportada */}
      {!diarioQuery.isLoading && !equipamentosQuery.isLoading && isHC === false ? (
        <div style={{ padding: '24px 18px' }}>
          <div style={{
            borderRadius: '20px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            padding: '28px 20px',
            textAlign: 'center',
          }}>
            <Layers size={40} color="#94a3b8" style={{ margin: '0 auto 14px' }} />
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#1f2937', marginBottom: '8px' }}>
              Modalidade nao suportada
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
              Esta aba de estacas e exclusiva para maquinas da modalidade{' '}
              <strong>Helice Continua</strong>.<br />
              A modalidade desta maquina e{' '}
              <strong>{equipment?.modalidadeNome || 'nao definida'}</strong>.
            </div>
          </div>
        </div>
      ) : null}

      {/* Conteudo principal — Helice Continua */}
      {!diarioQuery.isLoading && !equipamentosQuery.isLoading && isHC ? (
        <div style={{ padding: '18px 18px 80px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Card de sincronizacao */}
          <div style={{
            borderRadius: '20px',
            background: '#fff',
            border: '1px solid rgba(167,39,39,0.12)',
            boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
            padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: syncMsg || syncErr ? '12px' : '0' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#1f2937' }}>Sincronizar com Geodigitus</div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                  {equipment?.imei ? `IMEI: ${equipment.imei}` : 'Sem IMEI — sincronizacao indisponivel'}
                </div>
              </div>
              <button
                onClick={() => {
                  setSyncMsg('')
                  setSyncErr('')
                  void syncMutation.mutateAsync()
                }}
                disabled={isBusy || !equipment?.imei}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  border: 'none',
                  borderRadius: '14px',
                  background: !equipment?.imei || isBusy ? '#cbd5e1' : '#a72727',
                  color: '#fff',
                  padding: '10px 16px',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: !equipment?.imei || isBusy ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  boxShadow: !equipment?.imei || isBusy ? 'none' : '0 8px 18px rgba(167,39,39,0.22)',
                }}
              >
                <RefreshCcw size={14} />
                {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            </div>

            {syncMsg ? (
              <div style={{ borderRadius: '12px', background: '#f0fdf4', border: '1px solid #86efac', padding: '10px 14px', fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                {syncMsg}
              </div>
            ) : null}
            {syncErr ? (
              <div style={{ borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', fontSize: '13px', color: '#b91c1c' }}>
                {syncErr}
              </div>
            ) : null}
          </div>

          {/* Lista de estacas */}
          {stakes.length > 0 ? (
            <div style={{
              borderRadius: '20px',
              background: '#fff',
              border: '1px solid rgba(15,23,42,0.07)',
              boxShadow: '0 8px 20px rgba(15,23,42,0.05)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#1f2937' }}>
                  {stakes.length} estaca{stakes.length !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                  {stakes.filter((s) => s.source === 'sync').length} sincron. · {stakes.filter((s) => s.source === 'manual').length} manuais
                </div>
              </div>

              {stakes.map((estaca, index) => (
                <div
                  key={estaca.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: index < stakes.length - 1 ? '1px solid #f8fafc' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    background: editingId === estaca.id ? '#fff7f7' : 'transparent',
                  }}
                >
                  {(() => {
                    const sourceStyle = getStakeSourceStyles(estaca.source)
                    return (
                      <>
                  <div style={{
                    width: '3px',
                    borderRadius: '4px',
                    alignSelf: 'stretch',
                    minHeight: '40px',
                    background: sourceStyle.rail,
                    flexShrink: 0,
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: '#111827' }}>
                        {estaca.pilar || '—'}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '999px',
                        background: sourceStyle.badgeBg,
                        color: sourceStyle.badgeColor,
                      }}>
                        {sourceStyle.badgeText}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {estaca.diametro ? (
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Ø {estaca.diametro} cm</span>
                      ) : null}
                      {estaca.realizado != null ? (
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                          {Number(estaca.realizado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m
                        </span>
                      ) : null}
                      {estaca.usoBits ? <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>BITS</span> : null}
                      {estaca.icamentoArmacao ? (
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 700 }}>
                          Icamento{estaca.metrosIcamento != null ? ` ${estaca.metrosIcamento}m` : ''}
                        </span>
                      ) : null}
                      {estaca.finishedAt ? (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{String(estaca.finishedAt).slice(0, 5)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => startEdit(estaca)}
                      disabled={isBusy}
                      style={{ background: '#f1f5f9', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                    >
                      <Pencil size={13} color="#475569" />
                    </button>
                    <button
                      onClick={() => handleDelete(estaca.id)}
                      disabled={isBusy}
                      style={{ background: '#fef2f2', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isBusy ? 'not-allowed' : 'pointer' }}
                    >
                      <Trash2 size={13} color="#b91c1c" />
                    </button>
                  </div>
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              borderRadius: '20px',
              background: '#fff',
              border: '1px dashed #cbd5e1',
              padding: '24px',
              textAlign: 'center',
              fontSize: '13px',
              color: '#94a3b8',
            }}>
              Nenhuma estaca registrada ainda.<br />
              Sincronize ou adicione manualmente abaixo.
            </div>
          )}

          {/* Formulario */}
          <div style={{
            borderRadius: '20px',
            background: '#fff',
            border: '1px solid rgba(167,39,39,0.12)',
            boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
            padding: '18px 16px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#1f2937', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} color="#a72727" />
              {editingId ? 'Editar estaca' : 'Adicionar estaca'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Pilar / Estaca *</label>
                <input
                  value={form.pilar}
                  onChange={(e) => setForm((prev) => ({ ...prev, pilar: e.target.value }))}
                  placeholder="ex: E-01, P-42"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Diametro (cm)</label>
                  <input
                    value={form.diametro}
                    onChange={(e) => setForm((prev) => ({ ...prev, diametro: e.target.value }))}
                    placeholder="ex: 60"
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Realizado (m)</label>
                  <input
                    value={form.realizado}
                    onChange={(e) => setForm((prev) => ({ ...prev, realizado: e.target.value }))}
                    placeholder="ex: 15.5"
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
              </div>

              <button type="button" onClick={() => setForm((prev) => ({ ...prev, usoBits: !prev.usoBits }))} style={toggleBtnStyle(form.usoBits)}>
                <Checkbox checked={form.usoBits} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Uso de BITS</span>
              </button>

              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, icamentoArmacao: !prev.icamentoArmacao, metrosIcamento: '' }))}
                style={toggleBtnStyle(form.icamentoArmacao)}
              >
                <Checkbox checked={form.icamentoArmacao} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Icamento de Armacao</span>
              </button>

              {form.icamentoArmacao ? (
                <div>
                  <label style={labelStyle}>Metros de icamento (opcional)</label>
                  <input
                    value={form.metrosIcamento}
                    onChange={(e) => setForm((prev) => ({ ...prev, metrosIcamento: e.target.value }))}
                    placeholder="ex: 3.5"
                    inputMode="decimal"
                    style={inputStyle}
                  />
                </div>
              ) : null}

              {submitErr ? (
                <div style={{ borderRadius: '12px', background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', fontSize: '13px', color: '#b91c1c' }}>
                  {submitErr}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: '10px' }}>
                {editingId ? (
                  <button
                    onClick={cancelEdit}
                    disabled={isBusy}
                    style={{
                      flex: 1,
                      border: '1px solid #d1d5db',
                      borderRadius: '14px',
                      background: '#fff',
                      color: '#374151',
                      padding: '13px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: isBusy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                ) : null}
                <button
                  onClick={handleSubmit}
                  disabled={isBusy}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: '14px',
                    background: isBusy ? '#cbd5e1' : '#a72727',
                    color: '#fff',
                    padding: '13px',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    boxShadow: isBusy ? 'none' : '0 8px 18px rgba(167,39,39,0.2)',
                  }}
                >
                  {isBusy ? 'Salvando...' : editingId ? 'Salvar edicao' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: '20px',
      height: '20px',
      borderRadius: '6px',
      border: `2px solid ${checked ? '#a72727' : '#d1d5db'}`,
      background: checked ? '#a72727' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.15s',
    }}>
      {checked ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  )
}
