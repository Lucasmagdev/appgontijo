import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Pencil,
  Plus,
  ShieldAlert,
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
  type PlanejamentoSemanalDiaPayload,
  type PlanejamentoSemanalPayload,
} from '@/lib/gontijo-api'

const DIAMETROS = ['20', '25', '30', '35', '40', '50', '60', '70', '80', '100', '120']
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

function isForbiddenError(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 403
}

function AccessDeniedScreen() {
  return (
    <div className="page-shell">
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="app-panel w-full max-w-md p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
            <ShieldAlert size={32} strokeWidth={2.2} />
          </div>
          <h1 className="mt-5 text-xl font-bold text-slate-900">Acesso restrito</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            O Planejamento de Obras está disponível apenas para cargos de escritório e gestão.
            Seu perfil não tem permissão para visualizar ou editar as metas de produção.
          </p>
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-400">
            Precisa de acesso? Fale com a administração para revisar a liberação do seu cargo.
          </p>
        </div>
      </div>
    </div>
  )
}

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
type ModalMode = { type: 'create'; dataInicio: string; equipamentoId?: number } | { type: 'edit'; plan: PlanejamentoDiario }
type WeeklyDayDraft = {
  data: string
  label: string
  enabled: boolean
  fatMinimo: boolean
  incluiMobilizacao: boolean
  incluiDesmobilizacao: boolean
  incluiOutroAcrescimo: boolean
  outroAcrescimoDescricao: string
  valorOutroAcrescimo: string
  items: ItemDraft[]
}

function newItem(): ItemDraft {
  return { id: crypto.randomUUID(), metaQtdEstacas: '', diametro: '', profundidade: '' }
}

function cloneItems(items: ItemDraft[]) {
  return items.map((item) => ({ ...item, id: crypto.randomUUID() }))
}

function validDraftItems(items: ItemDraft[]) {
  return items
    .filter((item) => Number(item.metaQtdEstacas) > 0 && item.diametro && Number(item.profundidade) > 0)
    .map((item): PlanejamentoDiarioItem => ({
      metaQtdEstacas: Number(item.metaQtdEstacas),
      diametro: item.diametro,
      profundidade: Number(item.profundidade),
    }))
}

function weeklyDayPayload(day: WeeklyDayDraft): PlanejamentoSemanalDiaPayload | null {
  if (!day.enabled) return null
  const itens = validDraftItems(day.items)
  if (!itens.length || itens.length !== day.items.length) return null
  if (day.incluiOutroAcrescimo && Number(day.valorOutroAcrescimo) <= 0) return null
  return {
    data: day.data,
    fat_minimo_garantido: day.fatMinimo,
    inclui_mobilizacao: day.incluiMobilizacao,
    inclui_desmobilizacao: day.incluiDesmobilizacao,
    inclui_outro_acrescimo: day.incluiOutroAcrescimo,
    outro_acrescimo_descricao: day.outroAcrescimoDescricao.trim() || undefined,
    valor_outro_acrescimo: day.incluiOutroAcrescimo ? Number(day.valorOutroAcrescimo) : undefined,
    itens,
  }
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

function EquipamentoCombobox({
  equipamentos,
  value,
  onChange,
  disabled,
}: {
  equipamentos: { id: number; nome: string }[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const selected = equipamentos.find((equipamento) => String(equipamento.id) === value)
  const [query, setQuery] = useState(selected?.nome ?? '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const current = equipamentos.find((equipamento) => String(equipamento.id) === value)
    setQuery(current?.nome ?? '')
  }, [value, equipamentos])

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        const current = equipamentos.find((equipamento) => String(equipamento.id) === value)
        setQuery(current?.nome ?? '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, equipamentos, value])

  const filtered = query.trim()
    ? equipamentos.filter((equipamento) => equipamento.nome.toLowerCase().includes(query.trim().toLowerCase()))
    : equipamentos

  return (
    <div ref={containerRef} className="relative">
      <input
        className="field-input"
        value={query}
        disabled={disabled}
        placeholder="Digite para buscar a máquina"
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">Nenhum equipamento encontrado</li>
          ) : (
            filtered.map((equipamento) => (
              <li key={equipamento.id}>
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onChange(String(equipamento.id))
                    setQuery(equipamento.nome)
                    setOpen(false)
                  }}
                >
                  {equipamento.nome}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
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
  const [equipamentoId, setEquipamentoId] = useState(String(plan?.equipamentoId ?? (mode.type === 'create' ? mode.equipamentoId ?? '' : '')))
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
              <EquipamentoCombobox equipamentos={equipamentos} value={equipamentoId} onChange={setEquipamentoId} disabled={isEdit} />
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

function WeeklyPlanModal({
  weekDays,
  equipamentos,
  onClose,
  onSaved,
}: {
  weekDays: WeekDay[]
  equipamentos: { id: number; nome: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [equipamentoId, setEquipamentoId] = useState('')
  const [obraNumero, setObraNumero] = useState('')
  const [days, setDays] = useState<WeeklyDayDraft[]>(() => weekDays.map((day, index) => ({
    data: day.iso,
    label: day.label,
    enabled: index === 0,
    fatMinimo: false,
    incluiMobilizacao: false,
    incluiDesmobilizacao: false,
    incluiOutroAcrescimo: false,
    outroAcrescimoDescricao: '',
    valorOutroAcrescimo: '',
    items: [newItem()],
  })))
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<string[]>([])
  const enabledDays = days.filter((day) => day.enabled)
  const payloadDays = days.map(weeklyDayPayload).filter((day): day is PlanejamentoSemanalDiaPayload => day !== null)
  const areEnabledDaysValid = enabledDays.length > 0 && payloadDays.length === enabledDays.length
  const basePayload: PlanejamentoSemanalPayload | null = equipamentoId && obraNumero.trim() && areEnabledDaysValid
    ? { equipamento_id: Number(equipamentoId), obra_numero: obraNumero.trim(), dias: payloadDays }
    : null
  const previewQuery = useQuery({
    queryKey: ['planejamento-semanal-preview', basePayload],
    queryFn: () => planejamentoDiarioApi.previewWeekly(basePayload!),
    enabled: Boolean(basePayload),
    retry: false,
  })
  const previewByDate = new Map((previewQuery.data?.dias ?? []).map((day) => [day.data, day]))

  function updateDay(index: number, updater: (day: WeeklyDayDraft) => WeeklyDayDraft) {
    setDays((current) => current.map((day, currentIndex) => currentIndex === index ? updater(day) : day))
    setConflicts([])
    setError('')
  }

  function copyPreviousDay(index: number) {
    const previous = days[index - 1]
    if (!previous?.enabled) return
    updateDay(index, (day) => ({
      ...day,
      enabled: true,
      fatMinimo: previous.fatMinimo,
      incluiMobilizacao: previous.incluiMobilizacao,
      incluiDesmobilizacao: previous.incluiDesmobilizacao,
      incluiOutroAcrescimo: previous.incluiOutroAcrescimo,
      outroAcrescimoDescricao: previous.outroAcrescimoDescricao,
      valorOutroAcrescimo: previous.valorOutroAcrescimo,
      items: cloneItems(previous.items),
    }))
  }

  const saveMutation = useMutation({
    mutationFn: async (confirmarSubstituicao: boolean) => {
      setError('')
      setConflicts([])
      if (!equipamentoId) throw new Error('Selecione o equipamento.')
      if (!obraNumero.trim()) throw new Error('Informe o número da obra.')
      if (!enabledDays.length) throw new Error('Ative ao menos um dia da semana.')
      if (!areEnabledDaysValid || !basePayload) {
        throw new Error('Preencha todas as metas e valores de acréscimo dos dias ativos.')
      }
      return planejamentoDiarioApi.createWeekly({
        ...basePayload,
        confirmar_substituicao: confirmarSubstituicao,
      })
    },
    onSuccess: () => {
      onSaved()
      onClose()
    },
    onError: (cause) => {
      if (cause instanceof AxiosError && cause.response?.status === 409) {
        const data = cause.response.data as { error?: string; conflitos?: string[] }
        setConflicts(data.conflitos ?? [])
        setError(data.error ?? 'Confirme a substituição das metas existentes.')
        return
      }
      setError(extractApiErrorMessage(cause))
    },
  })

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Adicionar meta semanal</h2>
            <p className="mt-1 text-sm text-slate-500">Preencha apenas os dias planejados e salve a semana em uma única ação.</p>
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">Equipamento</label>
              <EquipamentoCombobox equipamentos={equipamentos} value={equipamentoId} onChange={setEquipamentoId} />
            </div>
            <div>
              <label className="field-label">Número da obra</label>
              <input className="field-input" value={obraNumero} onChange={(event) => setObraNumero(event.target.value)} placeholder="Ex: 22307" />
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {days.map((day, dayIndex) => {
              const preview = previewByDate.get(day.data)
              const validItems = validDraftItems(day.items)
              const totals = validItems.reduce((total, item) => ({
                estacas: total.estacas + item.metaQtdEstacas,
                metros: total.metros + item.metaQtdEstacas * item.profundidade,
              }), { estacas: 0, metros: 0 })

              return (
                <section key={day.data} className={`rounded-xl border ${day.enabled ? 'border-red-200 bg-white' : 'border-slate-200 bg-slate-50/70'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <label className="flex cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={day.enabled} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, enabled: event.target.checked }))} />
                      <span className="text-sm font-bold text-slate-800">{day.label} - {formatBr(day.data)}</span>
                    </label>
                    {dayIndex > 0 && (
                      <button type="button" className="btn btn-secondary" disabled={!days[dayIndex - 1].enabled} onClick={() => copyPreviousDay(dayIndex)}>
                        Copiar dia anterior
                      </button>
                    )}
                  </div>

                  {day.enabled && (
                    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(360px,1fr)_minmax(310px,0.8fr)]">
                      <div className="grid gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Metas do dia</span>
                          <button type="button" className="btn btn-secondary" onClick={() => updateDay(dayIndex, (current) => ({ ...current, items: [...current.items, newItem()] }))}>
                            <Plus size={13} /> Meta
                          </button>
                        </div>
                        {day.items.map((item, index) => (
                          <ItemRow
                            key={item.id}
                            item={item}
                            calculatedItem={preview?.itens[index]}
                            index={index}
                            onChange={(updated) => updateDay(dayIndex, (current) => ({
                              ...current,
                              items: current.items.map((currentItem) => currentItem.id === item.id ? updated : currentItem),
                            }))}
                            onRemove={() => updateDay(dayIndex, (current) => ({ ...current, items: current.items.filter((currentItem) => currentItem.id !== item.id) }))}
                            canRemove={day.items.length > 1}
                          />
                        ))}
                      </div>

                      <div className="grid content-start gap-3">
                        <label className="flex cursor-pointer gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                          <input type="checkbox" checked={day.fatMinimo} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, fatMinimo: event.target.checked }))} />
                          Faturamento mínimo garantido
                        </label>
                        <div className="rounded-lg border border-slate-200 p-3">
                          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Acréscimos</div>
                          <div className="grid gap-2 text-sm">
                            <label className="flex items-center gap-2"><input type="checkbox" checked={day.incluiMobilizacao} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, incluiMobilizacao: event.target.checked }))} /> Mobilização</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={day.incluiDesmobilizacao} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, incluiDesmobilizacao: event.target.checked }))} /> Desmobilização</label>
                            <label className="flex items-center gap-2"><input type="checkbox" checked={day.incluiOutroAcrescimo} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, incluiOutroAcrescimo: event.target.checked }))} /> Outro acréscimo</label>
                          </div>
                          {day.incluiOutroAcrescimo && (
                            <div className="mt-3 grid gap-2">
                              <input className="field-input" value={day.outroAcrescimoDescricao} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, outroAcrescimoDescricao: event.target.value }))} placeholder="Descrição do acréscimo" />
                              <input type="number" min={0.01} step={0.01} className="field-input" value={day.valorOutroAcrescimo} onChange={(event) => updateDay(dayIndex, (current) => ({ ...current, valorOutroAcrescimo: event.target.value }))} placeholder="Valor do acréscimo" />
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 rounded-lg bg-red-50 p-3 text-xs">
                          <div><span className="block text-red-500">Estacas</span><strong>{totals.estacas}</strong></div>
                          <div><span className="block text-red-500">Metros</span><strong>{totals.metros.toLocaleString('pt-BR')}</strong></div>
                          <div><span className="block text-red-500">Valor</span><strong>{preview ? formatCurrency(preview.valorEstipuladoDia) : 'R$ -'}</strong></div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/60 p-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Resumo semanal</div>
              <div className="mt-1 text-sm font-bold text-slate-800">{enabledDays.length} dia(s) ativo(s) / {payloadDays.reduce((sum, day) => sum + day.itens.reduce((itemSum, item) => itemSum + item.metaQtdEstacas, 0), 0)} estacas</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-red-500">Valor estipulado</div>
              <div className="mt-1 text-lg font-bold text-slate-800">{previewQuery.isFetching ? 'Calculando...' : formatCurrency(previewQuery.data?.valorEstipuladoSemana)}</div>
            </div>
          </div>
          {previewQuery.isError && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{extractApiErrorMessage(previewQuery.error)}</div>}
          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {conflicts.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Dias com meta existente: {conflicts.map(formatBr).join(', ')}.</p>
              <p className="mt-1">Ao confirmar, as metas destes dias serão substituídas pelos dados deste formulário.</p>
              <button type="button" className="btn btn-primary mt-3" onClick={() => saveMutation.mutate(true)} disabled={saveMutation.isPending}>
                Confirmar substituição e salvar
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saveMutation.isPending}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => saveMutation.mutate(false)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar metas semanais'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  showMachine = true,
  isDeleting,
  onEdit,
  onDelete,
}: {
  plan: PlanejamentoDiario
  showMachine?: boolean
  isDeleting: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const totals = planTotals(plan)

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-slate-800">{showMachine ? plan.equipamentoNome || `Equip. ${plan.equipamentoId}` : `Obra ${plan.obraNumero}`}</h4>
          <p className="truncate text-xs text-slate-500">
            {showMachine ? `Obra ${plan.obraNumero}${plan.cliente ? ` - ${plan.cliente}` : ''}` : plan.cliente || 'Meta diária'}
          </p>
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

type WeekDay = { iso: string; label: string }
type MachineWeek = {
  equipamentoId: number
  equipamentoNome: string
  plans: PlanejamentoDiario[]
}

function WeeklyMachineCard({
  machine,
  weekDays,
  today,
  deleteId,
  isDeleting,
  onEdit,
  onDelete,
  onAdd,
}: {
  machine: MachineWeek
  weekDays: WeekDay[]
  today: string
  deleteId: number | null
  isDeleting: boolean
  onEdit: (plan: PlanejamentoDiario) => void
  onDelete: (plan: PlanejamentoDiario) => void
  onAdd: (date: string, equipamentoId: number) => void
}) {
  const totals = machine.plans.reduce(
    (result, plan) => {
      const dayTotals = planTotals(plan)
      result.estacas += dayTotals.estacas
      result.metros += dayTotals.metros
      return result
    },
    { estacas: 0, metros: 0 }
  )
  const obras = Array.from(new Set(machine.plans.map((plan) => plan.obraNumero))).join(', ')

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{machine.equipamentoNome}</h3>
          <p className="text-xs text-slate-500">Obra{obras.includes(',') ? 's' : ''} {obras}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{totals.estacas.toLocaleString('pt-BR')} estacas / semana</span>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">{totals.metros.toLocaleString('pt-BR')} m / semana</span>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="grid min-w-[1120px] grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const plans = machine.plans.filter((plan) => plan.data === day.iso)
            const isToday = day.iso === today

            return (
              <div key={day.iso} className={`flex min-h-[290px] flex-col rounded-xl border ${isToday ? 'border-red-200 bg-red-50/30' : 'border-slate-200 bg-slate-50/70'}`}>
                <div className={`flex items-center justify-between border-b px-3 py-3 ${isToday ? 'border-red-100' : 'border-slate-200'}`}>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-red-600' : 'text-slate-500'}`}>{day.label}</div>
                    <div className="text-sm font-semibold text-slate-700">{shortDate(day.iso)}</div>
                  </div>
                  {isToday && <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold text-red-700">Hoje</span>}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-2">
                  {plans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      showMachine={false}
                      isDeleting={isDeleting && deleteId === plan.id}
                      onEdit={() => onEdit(plan)}
                      onDelete={() => onDelete(plan)}
                    />
                  ))}
                  {plans.length === 0 && (
                    <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 px-3 py-8 text-center text-xs text-slate-400">
                      Nenhuma meta definida
                    </div>
                  )}
                  <button type="button" className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-500 hover:border-red-300 hover:text-red-600" onClick={() => onAdd(day.iso, machine.equipamentoId)}>
                    <Plus size={13} /> Adicionar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </article>
  )
}

export default function PlanejamentoDiarioPage() {
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [equipFiltro, setEquipFiltro] = useState<number | ''>('')
  const [modal, setModal] = useState<ModalMode | null>(null)
  const [weeklyModalOpen, setWeeklyModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'daily' | 'machine'>('daily')
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
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const iso = toISO(addDays(weekStart, index))
    return { iso, label: DIAS_SEMANA[index] }
  })
  const machineWeeks = useMemo(() => {
    const grouped = new Map<number, MachineWeek>()

    plans.forEach((plan) => {
      const existing = grouped.get(plan.equipamentoId)
      if (existing) {
        existing.plans.push(plan)
        return
      }
      grouped.set(plan.equipamentoId, {
        equipamentoId: plan.equipamentoId,
        equipamentoNome: plan.equipamentoNome || `Equip. ${plan.equipamentoId}`,
        plans: [plan],
      })
    })

    return Array.from(grouped.values()).sort((a, b) => a.equipamentoNome.localeCompare(b.equipamentoNome, 'pt-BR'))
  }, [plans])
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

  // Sem permissao (403): tela dedicada, sem header nem acoes que tambem falhariam.
  if (isForbiddenError(query.error)) {
    return <AccessDeniedScreen />
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Planejamento Diário</h1>
          <p className="page-subtitle">Organize as metas de produção por máquina e acompanhe a semana em um único quadro.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" onClick={() => setModal({ type: 'create', dataInicio })}>
            <Plus size={15} />
            Adicionar meta
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setWeeklyModalOpen(true)}>
            <CalendarDays size={15} />
            Adicionar meta semanal
          </button>
        </div>
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
        <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
          <div className="w-full sm:w-64">
            <label className="field-label">Filtrar por equipamento</label>
            <select className="field-select" value={equipFiltro} onChange={(event) => setEquipFiltro(event.target.value ? Number(event.target.value) : '')}>
              <option value="">Todos os equipamentos</option>
              {equipamentos.map((equipamento) => <option key={equipamento.id} value={equipamento.id}>{equipamento.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Visualização</label>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              <button type="button" className={`rounded-md px-3 py-2 text-xs font-semibold ${viewMode === 'daily' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setViewMode('daily')}>
                Grade diária
              </button>
              <button type="button" className={`rounded-md px-3 py-2 text-xs font-semibold ${viewMode === 'machine' ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setViewMode('machine')}>
                Por máquina
              </button>
            </div>
          </div>
        </div>
      </section>

      {actionError && <QueryFeedback type="error" title="Não foi possível concluir a ação" description={actionError} />}
      {query.isLoading && <QueryFeedback type="loading" title="Carregando planejamento" description="Montando a grade semanal." />}
      {query.isError && <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} />}

      {!query.isLoading && !query.isError && (
        <section className="app-panel overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">{viewMode === 'daily' ? 'Quadro semanal' : 'Metas por máquina'}</h2>
              <p className="text-xs text-slate-500">
                {viewMode === 'daily' ? 'Adicione ou edite a meta diretamente no dia desejado.' : 'Cada card reúne a meta semanal da máquina e o detalhamento de cada dia.'}
              </p>
            </div>
            {viewMode === 'daily' && (
              <button type="button" className="btn btn-secondary" onClick={() => setWeeklyModalOpen(true)}>
                <CalendarDays size={14} />
                Adicionar meta semanal
              </button>
            )}
          </div>
          {viewMode === 'daily' ? (
            <div className="overflow-x-auto p-4">
              <div className="grid min-w-[1120px] grid-cols-7 gap-3">
                {weekDays.map((day) => {
                  const dayPlans = plans.filter((plan) => plan.data === day.iso)
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
                        {dayPlans.map((plan) => (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            isDeleting={deleteMutation.isPending && deleteId === plan.id}
                            onEdit={() => setModal({ type: 'edit', plan })}
                            onDelete={() => confirmDelete(plan)}
                          />
                        ))}
                        {dayPlans.length === 0 && (
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
          ) : (
            <div className="grid gap-4 p-4">
              {machineWeeks.map((machine) => (
                <WeeklyMachineCard
                  key={machine.equipamentoId}
                  machine={machine}
                  weekDays={weekDays}
                  today={today}
                  deleteId={deleteId}
                  isDeleting={deleteMutation.isPending}
                  onEdit={(plan) => setModal({ type: 'edit', plan })}
                  onDelete={confirmDelete}
                  onAdd={(date, equipamentoId) => setModal({ type: 'create', dataInicio: date, equipamentoId })}
                />
              ))}
              {machineWeeks.length === 0 && (
                <QueryFeedback type="empty" title="Nenhuma meta cadastrada" description="Adicione um planejamento para criar o primeiro card de máquina desta semana." />
              )}
              {machineWeeks.length > 0 && (
                <button type="button" className="btn btn-secondary justify-center" onClick={() => setModal({ type: 'create', dataInicio })}>
                  <Plus size={14} /> Adicionar outra máquina
                </button>
              )}
            </div>
          )}
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
      {weeklyModalOpen && (
        <WeeklyPlanModal
          weekDays={weekDays}
          equipamentos={equipamentos}
          onClose={() => setWeeklyModalOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['planejamento-diario'] })}
        />
      )}
    </div>
  )
}
