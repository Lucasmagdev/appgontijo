import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  planejamentoDiarioApi,
  equipamentoService,
  extractApiErrorMessage,
  type PlanejamentoDiario,
  type PlanejamentoDiarioItem,
} from '@/lib/gontijo-api'
import QueryFeedback from '@/components/ui/QueryFeedback'

const DIAMETROS = ['20', '25', '30', '35', '40', '50', '60', '70', '80', '100', '120']

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number) {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatBr(iso: string) {
  const [y, m, day] = iso.split('-')
  return `${day}/${m}/${y}`
}

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ── Item editor ───────────────────────────────────────────────────────────────

type ItemDraft = { id: string; metaQtdEstacas: string; diametro: string; profundidade: string }

function newItem(): ItemDraft {
  return { id: crypto.randomUUID(), metaQtdEstacas: '', diametro: '', profundidade: '' }
}

function ItemRow({
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  item: ItemDraft
  onChange: (updated: ItemDraft) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
      <div>
        <label style={labelStyle}>Qtd estacas</label>
        <input
          type="number"
          min={0}
          className="field-input w-full"
          value={item.metaQtdEstacas}
          onChange={(e) => onChange({ ...item, metaQtdEstacas: e.target.value })}
          placeholder="0"
        />
      </div>
      <div>
        <label style={labelStyle}>Diâmetro (cm)</label>
        <select
          className="field-select w-full"
          value={item.diametro}
          onChange={(e) => onChange({ ...item, diametro: e.target.value })}
        >
          <option value="">Selecione</option>
          {DIAMETROS.map((d) => <option key={d} value={d}>{d} cm</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Profundidade (m)</label>
        <input
          type="number"
          min={0}
          step={0.1}
          className="field-input w-full"
          value={item.profundidade}
          onChange={(e) => onChange({ ...item, profundidade: e.target.value })}
          placeholder="0"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        style={{ marginTop: 20, background: canRemove ? '#fef2f2' : '#f1f5f9', border: 'none', borderRadius: 6, padding: '6px 8px', cursor: canRemove ? 'pointer' : 'not-allowed' }}
      >
        <Trash2 size={14} color={canRemove ? '#e53e3e' : '#a0aec0'} />
      </button>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type ModalMode = { type: 'create'; dataInicio: string } | { type: 'edit'; plan: PlanejamentoDiario }

function PlanModal({
  mode,
  equipamentos,
  onClose,
  onSaved,
}: {
  mode: ModalMode
  equipamentos: { id: number; nome: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = mode.type === 'edit'
  const plan = isEdit ? mode.plan : null

  const [equipamentoId, setEquipamentoId] = useState(String(plan?.equipamentoId ?? ''))
  const [obraNumero, setObraNumero] = useState(plan?.obraNumero ?? '')
  const [fatMinimo, setFatMinimo] = useState(plan?.fatMinimoGarantido ?? false)
  const [dataInicio, setDataInicio] = useState(isEdit ? plan!.data : (mode as { type: 'create'; dataInicio: string }).dataInicio)
  const [dataFim, setDataFim] = useState(isEdit ? plan!.data : (mode as { type: 'create'; dataInicio: string }).dataInicio)
  const [items, setItems] = useState<ItemDraft[]>(
    plan?.itens.length
      ? plan.itens.map((i) => ({ id: crypto.randomUUID(), metaQtdEstacas: String(i.metaQtdEstacas), diametro: i.diametro, profundidade: String(i.profundidade) }))
      : [newItem()]
  )
  const [error, setError] = useState('')

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!equipamentoId) throw new Error('Selecione o equipamento')
      if (!obraNumero.trim()) throw new Error('Informe o número da obra')
      const validItems: PlanejamentoDiarioItem[] = items
        .filter((i) => i.diametro && i.metaQtdEstacas)
        .map((i) => ({ metaQtdEstacas: Number(i.metaQtdEstacas), diametro: i.diametro, profundidade: Number(i.profundidade) }))
      if (validItems.length === 0) throw new Error('Adicione ao menos um item com diâmetro e quantidade')

      if (isEdit) {
        await planejamentoDiarioApi.update(plan!.id, { fat_minimo_garantido: fatMinimo, itens: validItems })
      } else {
        await planejamentoDiarioApi.create({
          data_inicio: dataInicio,
          data_fim: dataFim !== dataInicio ? dataFim : undefined,
          equipamento_id: Number(equipamentoId),
          obra_numero: obraNumero.trim(),
          fat_minimo_garantido: fatMinimo,
          itens: validItems,
        })
      }
    },
    onSuccess: () => { onSaved(); onClose() },
    onError: (e) => setError(extractApiErrorMessage(e)),
  })

  function updateItem(id: string, updated: ItemDraft) {
    setItems((prev) => prev.map((i) => i.id === id ? updated : i))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{isEdit ? 'Editar planejamento' : 'Novo planejamento'}</h3>

        <div style={{ display: 'grid', gap: 12 }}>
          {/* Equipamento */}
          <div>
            <label style={labelStyle}>Equipamento</label>
            <select className="field-select w-full" value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)} disabled={isEdit}>
              <option value="">Selecione</option>
              {equipamentos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>

          {/* Obra */}
          <div>
            <label style={labelStyle}>N° da Obra</label>
            <input
              className="field-input w-full"
              value={obraNumero}
              onChange={(e) => setObraNumero(e.target.value)}
              placeholder="Ex: 12345"
              disabled={isEdit}
            />
          </div>

          {/* Datas — só no create */}
          {!isEdit && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Data início</label>
                <input type="date" className="field-input w-full" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); if (e.target.value > dataFim) setDataFim(e.target.value) }} />
              </div>
              <div>
                <label style={labelStyle}>Data fim <span style={{ fontWeight: 400, color: '#a0aec0' }}>(opcional — preenche todos os dias)</span></label>
                <input type="date" className="field-input w-full" value={dataFim} min={dataInicio} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
          )}

          {/* Fat. Mínimo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={fatMinimo} onChange={(e) => setFatMinimo(e.target.checked)} />
            Fat. Mínimo Garantido
          </label>

          {/* Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={labelStyle}>Metas por diâmetro</label>
              <button type="button" className="btn" style={{ background: '#ebf8ff', color: '#2b6cb0', fontSize: 12, padding: '4px 10px' }} onClick={() => setItems((p) => [...p, newItem()])}>
                <Plus size={13} style={{ marginRight: 4, display: 'inline' }} /> Adicionar
              </button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {items.map((item) => (
                <ItemRow key={item.id} item={item} onChange={(u) => updateItem(item.id, u)} onRemove={() => removeItem(item.id)} canRemove={items.length > 1} />
              ))}
            </div>
          </div>

          {error && <p style={{ color: '#e53e3e', fontSize: 13, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn" style={{ background: '#e2e8f0', color: '#2d3748' }} onClick={onClose}>Cancelar</button>
            <button type="button" className="btn" style={{ background: '#38a169', color: '#fff' }} disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card de planejamento ──────────────────────────────────────────────────────

function PlanCard({ plan, onEdit, onDelete }: { plan: PlanejamentoDiario; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a202c' }}>
          {plan.equipamentoNome || `Equip. ${plan.equipamentoId}`}
        </div>
        <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
          Obra {plan.obraNumero}{plan.cliente ? ` — ${plan.cliente}` : ''}
        </div>
        {plan.fatMinimoGarantido && (
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700, background: '#ebf8ff', color: '#2b6cb0', borderRadius: 4, padding: '1px 6px' }}>
            Fat. Mínimo Garantido
          </span>
        )}
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {plan.itens.map((item, i) => (
            <span key={i} style={{ fontSize: 12, background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 8px', color: '#2d3748' }}>
              {item.metaQtdEstacas} est · Ø{item.diametro}cm · {item.profundidade}m
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button type="button" onClick={onEdit} style={{ background: '#ebf8ff', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer' }}>
          <Pencil size={13} color="#2b6cb0" />
        </button>
        <button type="button" onClick={onDelete} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer' }}>
          <Trash2 size={13} color="#e53e3e" />
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PlanejamentoDiarioPage() {
  const queryClient = useQueryClient()

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [equipFiltro, setEquipFiltro] = useState<number | ''>('')
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [actionError, setActionError] = useState('')

  const dataInicio = toISO(weekStart)
  const dataFim = toISO(addDays(weekStart, 6))

  const queryKey = ['planejamento-diario', dataInicio, dataFim, equipFiltro]

  const query = useQuery({
    queryKey,
    queryFn: () => planejamentoDiarioApi.list({
      data_inicio: dataInicio,
      data_fim: dataFim,
      ...(equipFiltro ? { equipamento_id: equipFiltro } : {}),
    }),
  })

  const equipQuery = useQuery({
    queryKey: ['equipamentos-ativos'],
    queryFn: () => equipamentoService.listAtivos(),
    staleTime: 1000 * 60 * 5,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => planejamentoDiarioApi.remove(id),
    onSuccess: async () => {
      setActionError('')
      await queryClient.invalidateQueries({ queryKey: ['planejamento-diario'] })
    },
    onError: (e) => setActionError(extractApiErrorMessage(e)),
  })

  const plans = query.data ?? []
  const equipamentos = (equipQuery.data ?? []).map((e) => ({ id: e.id, nome: e.nome }))

  // Agrupar por dia da semana
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i)
    const iso = toISO(date)
    const dayPlans = plans.filter((p) => p.data === iso)
    return { iso, label: DIAS_SEMANA[i], dataBr: formatBr(iso), plans: dayPlans }
  })

  const totalSemana = plans.length

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="page-heading" style={{ margin: 0 }}>Planejamento Diário</h1>
        <button
          type="button"
          className="btn"
          style={{ background: '#e53e3e', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setModal({ type: 'create', dataInicio: toISO(new Date()) })}
        >
          <Plus size={15} /> Novo
        </button>
      </div>

      {/* Navegação de semana */}
      <section className="app-panel toolbar-panel">
        <div className="flex flex-wrap items-end gap-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" className="btn" style={{ padding: '6px 10px' }} onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 160, textAlign: 'center' }}>
              {formatBr(dataInicio)} – {formatBr(dataFim)}
            </span>
            <button type="button" className="btn" style={{ padding: '6px 10px' }} onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="btn" style={{ fontSize: 12, padding: '6px 10px', background: '#edf2f7', color: '#4a5568' }} onClick={() => setWeekStart(getMonday(new Date()))}>
              Hoje
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Equipamento</label>
            <select className="field-select w-44" value={equipFiltro} onChange={(e) => setEquipFiltro(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Todos</option>
              {equipamentos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
            </select>
          </div>
        </div>
      </section>

      {actionError && <QueryFeedback type="error" title="Erro" description={actionError} />}
      {query.isError && <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} />}
      {query.isLoading && <p style={{ padding: 24, color: '#718096' }}>Carregando...</p>}

      {!query.isLoading && (
        <>
          {totalSemana === 0 && (
            <p style={{ padding: 24, color: '#718096' }}>Nenhum planejamento para esta semana.</p>
          )}

          <div style={{ display: 'grid', gap: 16, padding: '8px 0' }}>
            {weekDays.map(({ iso, label, dataBr, plans: dayPlans }) => {
              if (dayPlans.length === 0) return null
              return (
                <section key={iso} className="app-panel" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#2d3748' }}>
                      {label} <span style={{ color: '#718096', fontWeight: 500 }}>{dataBr}</span>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      style={{ fontSize: 12, padding: '3px 10px', background: '#f7fafc', color: '#4a5568', border: '1px solid #e2e8f0' }}
                      onClick={() => setModal({ type: 'create', dataInicio: iso })}
                    >
                      <Plus size={12} style={{ marginRight: 4, display: 'inline' }} /> Adicionar
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {dayPlans.map((p) => (
                      <PlanCard
                        key={p.id}
                        plan={p}
                        onEdit={() => setModal({ type: 'edit', plan: p })}
                        onDelete={() => {
                          if (confirm(`Excluir planejamento de ${p.equipamentoNome} em ${dataBr}?`)) {
                            deleteMutation.mutate(p.id)
                          }
                        }}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>

          {/* Dias sem planejamento com botão de adicionar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginTop: 8 }}>
            {weekDays.map(({ iso, label, dataBr, plans: dayPlans }) => (
              <button
                key={iso}
                type="button"
                onClick={() => setModal({ type: 'create', dataInicio: iso })}
                style={{
                  background: dayPlans.length > 0 ? '#f0fff4' : '#f7fafc',
                  border: `1px solid ${dayPlans.length > 0 ? '#9ae6b4' : '#e2e8f0'}`,
                  borderRadius: 8,
                  padding: '10px 6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#718096' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 2 }}>{dataBr.slice(0, 5)}</div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: dayPlans.length > 0 ? '#276749' : '#cbd5e0' }}>
                  {dayPlans.length > 0 ? `${dayPlans.length} plan.` : '+ add'}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {modal && (
        <PlanModal
          mode={modal}
          equipamentos={equipamentos}
          onClose={() => setModal(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['planejamento-diario'] })}
        />
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }
