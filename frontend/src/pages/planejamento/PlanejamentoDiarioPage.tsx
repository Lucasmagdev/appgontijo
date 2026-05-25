import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  planejamentoDiarioApi,
  equipamentoService,
  extractApiErrorMessage,
  type PlanejamentoDiario,
  type PlanejamentoDiarioItem,
} from '@/lib/gontijo-api'

const DIAMETROS = ['20', '25', '30', '35', '40', '50', '60', '70', '80', '100', '120']
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

function getMonday(dateValue: Date) {
  const date = new Date(dateValue)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(dateValue: Date, amount: number) {
  const date = new Date(dateValue)
  date.setDate(date.getDate() + amount)
  return date
}

function toISO(dateValue: Date) {
  const year = dateValue.getFullYear()
  const month = String(dateValue.getMonth() + 1).padStart(2, '0')
  const day = String(dateValue.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatBr(iso: string) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function shortDate(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

function formatCurrency(value: number | null | undefined) {
  return value == null
    ? 'R$ -'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function planTotals(plan: PlanejamentoDiario) {
  return plan.itens.reduce(
    (totals, item) => ({
      estacas: totals.estacas + Number(item.metaQtdEstacas || 0),
      metros: totals.metros + Number(item.metaQtdEstacas || 0) * Number(item.profundidade || 0),
    }),
    { estacas: 0, metros: 0 }
  )
}

type ItemDraft = { id: string; metaQtdEstacas: string; diametro: string; profundidade: string }
type ModalMode = { type: 'create'; dataInicio: string } | { type: 'edit'; plan: PlanejamentoDiario }

function newItem(): ItemDraft {
  return { id: crypto.randomUUID(), metaQtdEstacas: '', diametro: '', profundidade: '' }
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="app-panel flex items-center gap-4 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="truncate text-xs text-slate-500">{detail}</div>
      </div>
    </div>
  )
}

function ItemRow({
  item,
  calculatedItem,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  item: ItemDraft
  calculatedItem?: PlanejamentoDiarioItem
  index: number
  onChange: (updated: ItemDraft) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const metros = Number(item.metaQtdEstacas || 0) * Number(item.profundidade || 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Meta {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remover meta"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label">Quantidade</label>
          <input
            type="number"
            min={1}
            className="field-input"
            value={item.metaQtdEstacas}
            onChange={(event) => onChange({ ...item, metaQtdEstacas: event.target.value })}
            placeholder="Ex: 12"
          />
        </div>
        <div>
          <label className="field-label">Diâmetro</label>
          <select className="field-select" value={item.diametro} onChange={(event) => onChange({ ...item, diametro: event.target.value })}>
            <option value="">Selecione</option>
            {DIAMETROS.map((diametro) => <option key={diametro} value={diametro}>{diametro} cm</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Profundidade</label>
          <input
            type="number"
            min={0.1}
            step={0.1}
            className="field-input"
            value={item.profundidade}
            onChange={(event) => onChange({ ...item, profundidade: event.target.value })}
            placeholder="Ex: 8.5 m"
          />
        </div>
      </div>
      {calculatedItem?.valorMetro != null && calculatedItem.valorEstipulado != null ? (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-right text-xs font-semibold text-emerald-700">
          {item.metaQtdEstacas} x {item.profundidade} m x {formatCurrency(calculatedItem.valorMetro)}/m = {formatCurrency(calculatedItem.valorEstipulado)}
        </div>
      ) : metros > 0 ? (
        <div className="mt-2 text-right text-xs font-medium text-slate-500">{metros.toLocaleString('pt-BR')} m planejados nesta meta</div>
      ) : null}
    </div>
  )
}

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
  const initialDate = isEdit ? plan!.data : mode.dataInicio
  const [equipamentoId, setEquipamentoId] = useState(String(plan?.equipamentoId ?? ''))
  const [obraNumero, setObraNumero] = useState(plan?.obraNumero ?? '')
  const [fatMinimo, setFatMinimo] = useState(plan?.fatMinimoGarantido ?? false)
  const [incluiMobilizacao, setIncluiMobilizacao] = useState(plan?.incluiMobilizacao ?? false)
  const [incluiDesmobilizacao, setIncluiDesmobilizacao] = useState(plan?.incluiDesmobilizacao ?? false)
  const [incluiOutroAcrescimo, setIncluiOutroAcrescimo] = useState(plan?.incluiOutroAcrescimo ?? false)
  const [outroAcrescimoDescricao, setOutroAcrescimoDescricao] = useState(plan?.outroAcrescimoDescricao ?? '')
  const [valorOutroAcrescimo, setValorOutroAcrescimo] = useState(plan?.valorOutroAcrescimo != null ? String(plan.valorOutroAcrescimo) : '')
  const [dataInicio, setDataInicio] = useState(initialDate)
  const [dataFim, setDataFim] = useState(initialDate)
  const [items, setItems] = useState<ItemDraft[]>(
    plan?.itens.length
      ? plan.itens.map((item) => ({
        id: crypto.randomUUID(),
        metaQtdEstacas: String(item.metaQtdEstacas),
        diametro: item.diametro,
        profundidade: String(item.profundidade),
      }))
      : [newItem()]
  )
  const [error, setError] = useState('')

  const validItems = items
    .filter((item) => Number(item.metaQtdEstacas) > 0 && item.diametro && Number(item.profundidade) > 0)
    .map((item): PlanejamentoDiarioItem => ({
      metaQtdEstacas: Number(item.metaQtdEstacas),
      diametro: item.diametro,
      profundidade: Number(item.profundidade),
    }))

  const totals = validItems.reduce(
    (result, item) => ({
      estacas: result.estacas + item.metaQtdEstacas,
      metros: result.metros + item.metaQtdEstacas * item.profundidade,
    }),
    { estacas: 0, metros: 0 }
  )
  const daysCount = isEdit
    ? 1
    : Math.max(1, Math.round((new Date(`${dataFim}T12:00:00`).getTime() - new Date(`${dataInicio}T12:00:00`).getTime()) / 86400000) + 1)
  const temAcrescimos = incluiMobilizacao || incluiDesmobilizacao || incluiOutroAcrescimo
  const canPreview = Boolean(obraNumero.trim()) && validItems.length === items.length && validItems.length > 0
  const previewQuery = useQuery({
    queryKey: ['planejamento-diario-preview', obraNumero.trim(), validItems, incluiMobilizacao, incluiDesmobilizacao, incluiOutroAcrescimo, outroAcrescimoDescricao, valorOutroAcrescimo],
    queryFn: () => planejamentoDiarioApi.preview({
      obra_numero: obraNumero.trim(),
      itens: validItems,
      inclui_mobilizacao: incluiMobilizacao,
      inclui_desmobilizacao: incluiDesmobilizacao,
      inclui_outro_acrescimo: incluiOutroAcrescimo,
      outro_acrescimo_descricao: outroAcrescimoDescricao.trim() || undefined,
      valor_outro_acrescimo: incluiOutroAcrescimo && valorOutroAcrescimo ? Number(valorOutroAcrescimo) : undefined,
    }),
    enabled: canPreview,
    retry: false,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      setError('')
      if (!equipamentoId) throw new Error('Selecione o equipamento.')
      if (!obraNumero.trim()) throw new Error('Informe o número da obra.')
      if (!isEdit && dataFim < dataInicio) throw new Error('A data final deve ser posterior a data inicial.')
      if (!isEdit && daysCount > 1 && temAcrescimos) {
        throw new Error('Mobilização, desmobilização e outros acréscimos devem ser planejados em um único dia.')
      }
      if (validItems.length !== items.length || validItems.length === 0) {
        throw new Error('Preencha quantidade, diâmetro e profundidade em todas as metas.')
      }
      if (incluiOutroAcrescimo && Number(valorOutroAcrescimo) <= 0) {
        throw new Error('Informe o valor do outro acréscimo.')
      }

      if (isEdit) {
        await planejamentoDiarioApi.update(plan!.id, {
          fat_minimo_garantido: fatMinimo,
          inclui_mobilizacao: incluiMobilizacao,
          inclui_desmobilizacao: incluiDesmobilizacao,
          inclui_outro_acrescimo: incluiOutroAcrescimo,
          outro_acrescimo_descricao: outroAcrescimoDescricao.trim() || undefined,
          valor_outro_acrescimo: incluiOutroAcrescimo ? Number(valorOutroAcrescimo) : undefined,
          itens: validItems,
        })
        return
      }
      await planejamentoDiarioApi.create({
        data_inicio: dataInicio,
        data_fim: dataFim !== dataInicio ? dataFim : undefined,
        equipamento_id: Number(equipamentoId),
        obra_numero: obraNumero.trim(),
        fat_minimo_garantido: fatMinimo,
        inclui_mobilizacao: incluiMobilizacao,
        inclui_desmobilizacao: incluiDesmobilizacao,
        inclui_outro_acrescimo: incluiOutroAcrescimo,
        outro_acrescimo_descricao: outroAcrescimoDescricao.trim() || undefined,
        valor_outro_acrescimo: incluiOutroAcrescimo ? Number(valorOutroAcrescimo) : undefined,
        itens: validItems,
      })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (cause) => setError(extractApiErrorMessage(cause)),
  })

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Editar planejamento' : 'Novo planejamento diário'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isEdit ? `Ajuste as metas previstas para ${formatBr(plan!.data)}.` : 'Defina a meta produtiva da máquina para um ou mais dias.'}
            </p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Equipamento</label>
              <select className="field-select" value={equipamentoId} onChange={(event) => setEquipamentoId(event.target.value)} disabled={isEdit}>
                <option value="">Selecione uma máquina</option>
                {equipamentos.map((equipamento) => <option key={equipamento.id} value={equipamento.id}>{equipamento.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Número da obra</label>
              <input className="field-input" value={obraNumero} onChange={(event) => setObraNumero(event.target.value)} placeholder="Ex: 22307" disabled={isEdit} />
            </div>
            {!isEdit && (
              <>
                <div>
                  <label className="field-label">Data inicial</label>
                  <input type="date" className="field-input" value={dataInicio} onChange={(event) => {
                    setDataInicio(event.target.value)
                    if (event.target.value > dataFim) setDataFim(event.target.value)
                  }} />
                </div>
                <div>
                  <label className="field-label">Data final</label>
                  <input type="date" className="field-input" min={dataInicio} value={dataFim} onChange={(event) => setDataFim(event.target.value)} />
                </div>
              </>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input type="checkbox" className="mt-1" checked={fatMinimo} onChange={(event) => setFatMinimo(event.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-slate-700">Faturamento mínimo garantido</span>
              <span className="block text-xs text-slate-500">Considere o mínimo contratual ao fechar a produção deste planejamento.</span>
            </span>
          </label>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-800">Acréscimos previstos no dia</h3>
              <p className="text-xs text-slate-500">Mobilização e desmobilização usam o valor cadastrado na obra e ficam congeladas neste planejamento.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={`cursor-pointer rounded-lg border p-3 ${incluiMobilizacao ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={incluiMobilizacao} onChange={(event) => setIncluiMobilizacao(event.target.checked)} />
                  Mobilização
                </span>
                {incluiMobilizacao && previewQuery.data && (
                  <span className="mt-2 block text-xs font-bold text-red-700">{formatCurrency(previewQuery.data.valorMobilizacao)}</span>
                )}
              </label>
              <label className={`cursor-pointer rounded-lg border p-3 ${incluiDesmobilizacao ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={incluiDesmobilizacao} onChange={(event) => setIncluiDesmobilizacao(event.target.checked)} />
                  Desmobilização
                </span>
                {incluiDesmobilizacao && previewQuery.data && (
                  <span className="mt-2 block text-xs font-bold text-red-700">{formatCurrency(previewQuery.data.valorDesmobilizacao)}</span>
                )}
              </label>
              <label className={`cursor-pointer rounded-lg border p-3 ${incluiOutroAcrescimo ? 'border-red-200 bg-red-50/50' : 'border-slate-200 bg-slate-50'}`}>
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={incluiOutroAcrescimo} onChange={(event) => setIncluiOutroAcrescimo(event.target.checked)} />
                  Outro acréscimo
                </span>
              </label>
            </div>
            {!isEdit && daysCount > 1 && temAcrescimos && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Acréscimos são lançados em um dia específico. Reduza o período para um único dia antes de salvar.
              </p>
            )}
            {incluiOutroAcrescimo && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Descrição (opcional)</label>
                  <input className="field-input" value={outroAcrescimoDescricao} onChange={(event) => setOutroAcrescimoDescricao(event.target.value)} placeholder="Ex: deslocamento extraordinário" />
                </div>
                <div>
                  <label className="field-label">Valor do acréscimo</label>
                  <input type="number" min={0.01} step={0.01} className="field-input" value={valorOutroAcrescimo} onChange={(event) => setValorOutroAcrescimo(event.target.value)} placeholder="R$ 0,00" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Metas por diâmetro</h3>
              <p className="text-xs text-slate-500">Uma linha para cada tipo de estaca previsto.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => setItems((current) => [...current, newItem()])}>
              <Plus size={14} />
              Adicionar meta
            </button>
          </div>
          <div className="mt-3 grid gap-3">
            {items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                calculatedItem={previewQuery.data?.itens[index]}
                index={index}
                onChange={(updated) => setItems((current) => current.map((currentItem) => currentItem.id === item.id ? updated : currentItem))}
                onRemove={() => setItems((current) => current.filter((currentItem) => currentItem.id !== item.id))}
                canRemove={items.length > 1}
              />
            ))}
          </div>

          <div className="mt-5 grid gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4 sm:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Período</div>
              <div className="mt-1 font-bold text-slate-800">{daysCount} dia{daysCount !== 1 ? 's' : ''}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Meta por dia</div>
              <div className="mt-1 font-bold text-slate-800">{totals.estacas} estacas</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Extensão por dia</div>
              <div className="mt-1 font-bold text-slate-800">{totals.metros.toLocaleString('pt-BR')} m</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Valor estipulado / dia</div>
              <div className="mt-1 font-bold text-slate-800">
                {previewQuery.isFetching ? 'Calculando...' : formatCurrency(previewQuery.data?.valorEstipuladoDia)}
              </div>
            </div>
          </div>

          {previewQuery.data && (incluiMobilizacao || incluiDesmobilizacao || incluiOutroAcrescimo) && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex justify-between"><span>Produção prevista</span><strong>{formatCurrency(previewQuery.data.valorEstacasDia)}</strong></div>
              {incluiMobilizacao && <div className="mt-1 flex justify-between"><span>Mobilização</span><strong>{formatCurrency(previewQuery.data.valorMobilizacao)}</strong></div>}
              {incluiDesmobilizacao && <div className="mt-1 flex justify-between"><span>Desmobilização</span><strong>{formatCurrency(previewQuery.data.valorDesmobilizacao)}</strong></div>}
              {incluiOutroAcrescimo && <div className="mt-1 flex justify-between"><span>{outroAcrescimoDescricao.trim() || 'Outro acréscimo'}</span><strong>{formatCurrency(previewQuery.data.valorOutroAcrescimo)}</strong></div>}
            </div>
          )}

          {canPreview && previewQuery.isError && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {extractApiErrorMessage(previewQuery.error)}
            </div>
          )}
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saveMutation.isPending}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar planejamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  isDeleting,
  onEdit,
  onDelete,
}: {
  plan: PlanejamentoDiario
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const totals = planTotals(plan)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-800">{plan.equipamentoNome || `Equip. ${plan.equipamentoId}`}</h4>
          <p className="truncate text-xs text-slate-500">Obra {plan.obraNumero}{plan.cliente ? ` - ${plan.cliente}` : ''}</p>
        </div>
        {plan.fatMinimoGarantido && (
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Fat. min.</span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Estacas</div>
          <div className="text-sm font-bold text-slate-800">{totals.estacas}</div>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-2">
          <div className="text-[10px] font-semibold uppercase text-slate-400">Metros</div>
          <div className="text-sm font-bold text-slate-800">{totals.metros.toLocaleString('pt-BR')}</div>
        </div>
      </div>

      <div className={`mt-2 rounded-lg border px-2 py-2 ${plan.statusCalculo === 'calculado' ? 'border-emerald-100 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className={`text-[10px] font-semibold uppercase ${plan.statusCalculo === 'calculado' ? 'text-emerald-600' : 'text-amber-700'}`}>Valor estipulado</div>
        <div className={`text-sm font-bold ${plan.statusCalculo === 'calculado' ? 'text-emerald-800' : 'text-amber-800'}`}>
          {plan.statusCalculo === 'calculado' ? formatCurrency(plan.valorEstipuladoDia) : 'Valor pendente'}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {plan.itens.map((item, index) => (
          <span key={`${plan.id}-meta-${index}`} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
            {item.metaQtdEstacas}x D{item.diametro} / {item.profundidade}m
          </span>
        ))}
      </div>

      {(plan.incluiMobilizacao || plan.incluiDesmobilizacao || plan.incluiOutroAcrescimo) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {plan.incluiMobilizacao && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Mobilização {formatCurrency(plan.valorMobilizacao)}</span>}
          {plan.incluiDesmobilizacao && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">Desmobilização {formatCurrency(plan.valorDesmobilizacao)}</span>}
          {plan.incluiOutroAcrescimo && <span className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">{plan.outroAcrescimoDescricao || 'Acréscimo'} {formatCurrency(plan.valorOutroAcrescimo)}</span>}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2">
        <button type="button" onClick={onEdit} className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700" aria-label="Editar planejamento">
          <Pencil size={14} />
        </button>
        <button type="button" onClick={onDelete} disabled={isDeleting} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label="Excluir planejamento">
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  )
}

export default function PlanejamentoDiarioPage() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [equipFiltro, setEquipFiltro] = useState<number | ''>('')
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [actionError, setActionError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const dataInicio = toISO(weekStart)
  const dataFim = toISO(addDays(weekStart, 6))
  const today = toISO(new Date())
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
      setDeleteId(null)
      setActionError('')
      await queryClient.invalidateQueries({ queryKey: ['planejamento-diario'] })
    },
    onError: (cause) => setActionError(extractApiErrorMessage(cause)),
  })

  const plans = useMemo(() => query.data ?? [], [query.data])
  const equipamentos = (equipQuery.data ?? []).map((equipamento) => ({ id: equipamento.id, nome: equipamento.nome }))
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const iso = toISO(addDays(weekStart, index))
    return { iso, label: DIAS_SEMANA[index], plans: plans.filter((plan) => plan.data === iso) }
  })
  const summary = useMemo(() => plans.reduce(
    (result, plan) => {
      const totals = planTotals(plan)
      result.estacas += totals.estacas
      result.metros += totals.metros
      result.maquinas.add(plan.equipamentoId)
      return result
    },
    { estacas: 0, metros: 0, maquinas: new Set<number>() }
  ), [plans])

  function confirmDelete(plan: PlanejamentoDiario) {
    if (window.confirm(`Excluir o planejamento de ${plan.equipamentoNome || 'equipamento'} em ${formatBr(plan.data)}?`)) {
      setDeleteId(plan.id)
      deleteMutation.mutate(plan.id)
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Planejamento Diário</h1>
          <p className="page-subtitle">Organize as metas de produção por máquina e acompanhe a semana em um único quadro.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create', dataInicio })}>
          <Plus size={15} />
          Novo planejamento
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CalendarDays size={21} />} label="Planos" value={String(plans.length)} detail="na semana selecionada" />
        <MetricCard icon={<Layers3 size={21} />} label="Máquinas" value={String(summary.maquinas.size)} detail="com meta definida" />
        <MetricCard icon={<Target size={21} />} label="Estacas" value={summary.estacas.toLocaleString('pt-BR')} detail="meta total semanal" />
        <MetricCard icon={<Target size={21} />} label="Metros" value={summary.metros.toLocaleString('pt-BR')} detail="extensão planejada" />
      </div>

      <section className="app-panel mb-5 flex flex-wrap items-end justify-between gap-4 p-4">
        <div>
          <div className="field-label">Semana de trabalho</div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeekStart((current) => addDays(current, -7))} aria-label="Semana anterior">
              <ChevronLeft size={16} />
            </button>
            <div className="min-w-[185px] rounded-lg bg-slate-50 px-4 py-2 text-center text-sm font-bold text-slate-700">
              {formatBr(dataInicio)} - {formatBr(dataFim)}
            </div>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setWeekStart((current) => addDays(current, 7))} aria-label="Proxima semana">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setWeekStart(getMonday(new Date()))}>Hoje</button>
          </div>
        </div>
        <div className="w-full sm:w-64">
          <label className="field-label">Filtrar por equipamento</label>
          <select className="field-select" value={equipFiltro} onChange={(event) => setEquipFiltro(event.target.value ? Number(event.target.value) : '')}>
            <option value="">Todos os equipamentos</option>
            {equipamentos.map((equipamento) => <option key={equipamento.id} value={equipamento.id}>{equipamento.nome}</option>)}
          </select>
        </div>
      </section>

      {actionError && <QueryFeedback type="error" title="Não foi possível concluir a ação" description={actionError} />}
      {query.isLoading && <QueryFeedback type="loading" title="Carregando planejamento" description="Montando a grade semanal." />}
      {query.isError && <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} />}

      {!query.isLoading && !query.isError && (
        <section className="app-panel overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-800">Quadro semanal</h2>
            <p className="text-xs text-slate-500">Adicione um planejamento diretamente no dia desejado.</p>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="grid min-w-[1120px] grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const isToday = day.iso === today
                return (
                  <div key={day.iso} className={`flex min-h-[430px] flex-col rounded-xl border ${isToday ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-slate-50/70'}`}>
                    <div className={`flex items-center justify-between border-b px-3 py-3 ${isToday ? 'border-red-100' : 'border-slate-200'}`}>
                      <div>
                        <div className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-red-600' : 'text-slate-500'}`}>{day.label}</div>
                        <div className="text-sm font-semibold text-slate-700">{shortDate(day.iso)}</div>
                      </div>
                      {isToday && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Hoje</span>}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-2">
                      {day.plans.map((plan) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          isDeleting={deleteMutation.isPending && deleteId === plan.id}
                          onEdit={() => setModal({ type: 'edit', plan })}
                          onDelete={() => confirmDelete(plan)}
                        />
                      ))}
                      {day.plans.length === 0 && (
                        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">
                          Nenhuma meta definida
                        </div>
                      )}
                      <button type="button" className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600" onClick={() => setModal({ type: 'create', dataInicio: day.iso })}>
                        <Plus size={13} /> Adicionar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
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
