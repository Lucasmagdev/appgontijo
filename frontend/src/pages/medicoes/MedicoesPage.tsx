import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Search, Trash2, X } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, medicoesApi, obraService, usuarioService, type MedicaoListItem } from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

type CreateForm = {
  obraId: string
  obraSearch: string
  tipoMedicao: 'adiantamento' | 'inicial' | 'parcial' | 'final'
  dataInicio: string
  dataFim: string
  responsavelMedicao: string
  conferidoPor: string
}

const EMPTY_FORM: CreateForm = { obraId: '', obraSearch: '', tipoMedicao: 'parcial', dataInicio: '', dataFim: '', responsavelMedicao: '', conferidoPor: '' }


export default function MedicoesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [showObraSuggestions, setShowObraSuggestions] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const obrasQuery = useQuery({
    queryKey: ['medicoes-obras'],
    queryFn: () => obraService.list({ status: 'em andamento', page: 1, limit: 300 }),
    staleTime: 1000 * 60 * 5,
  })

  const colaboradoresQuery = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: usuarioService.listOptions,
    staleTime: 1000 * 60 * 15,
  })

  const medicoesQuery = useQuery({
    queryKey: ['medicoes-list'],
    queryFn: () => medicoesApi.list({ limit: 200 }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
  })

  const createMutation = useMutation({
    mutationFn: () => {
      if (!form.obraId) throw new Error('Selecione uma obra.')
      if (!form.dataInicio || !form.dataFim) throw new Error('Informe o período.')
      if (form.dataFim < form.dataInicio) throw new Error('Data fim deve ser após data início.')
      return medicoesApi.create({
        obraId: Number(form.obraId),
        tipoMedicao: form.tipoMedicao,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        responsavelMedicao: form.responsavelMedicao || undefined,
        conferidoPor: form.conferidoPor || undefined,
      })
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ['medicoes-list'] })
      navigate(`/medicoes/${data.id}`)
    },
    onError: (e) => setFormError(extractApiErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => medicoesApi.remove(id),
    onSuccess: async () => {
      setDeleteConfirm(null)
      await queryClient.invalidateQueries({ queryKey: ['medicoes-list'] })
    },
    onError: (e) => setFormError(extractApiErrorMessage(e)),
  })

  const items = (medicoesQuery.data?.items ?? []).filter(m => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return m.obra_numero?.toLowerCase().includes(q) || m.cliente?.toLowerCase().includes(q)
  })

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Medições</h1>
          <p className="page-subtitle">Relatórios de faturamento por período de obra.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); setFormError('') }}
          className="btn btn-primary"
        >
          <Plus size={15} />
          Nova medição
        </button>
      </div>

      {showCreate && (
        <div className="app-panel mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="text-sm font-bold text-slate-800">Nova medição</div>
            <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-2 relative">
              <label className="field-label">Obra</label>
              <input
                type="text"
                value={form.obraSearch}
                onChange={e => {
                  setForm(f => ({ ...f, obraSearch: e.target.value, obraId: '' }))
                  setShowObraSuggestions(true)
                  setFormError('')
                }}
                onFocus={() => setShowObraSuggestions(true)}
                onBlur={() => setTimeout(() => setShowObraSuggestions(false), 150)}
                placeholder="Digite número ou cliente..."
                className="field-input"
                autoComplete="off"
              />
              {form.obraId && (
                <div className="mt-1 text-xs text-emerald-600 font-medium">✓ Obra selecionada</div>
              )}
              {showObraSuggestions && form.obraSearch.trim().length > 0 && !form.obraId && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                  {(obrasQuery.data?.items ?? [])
                    .filter(o => {
                      const q = form.obraSearch.toLowerCase()
                      return o.numero?.toLowerCase().includes(q) || (o.cliente || '').toLowerCase().includes(q)
                    })
                    .slice(0, 8)
                    .map(o => (
                      <button
                        key={o.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                        onMouseDown={() => {
                          setForm(f => ({ ...f, obraId: String(o.id), obraSearch: `${o.numero} — ${o.cliente || 'Cliente não informado'}` }))
                          setShowObraSuggestions(false)
                          setFormError('')
                        }}
                      >
                        <span className="font-semibold text-slate-800">{o.numero}</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-slate-600">{o.cliente || 'Cliente não informado'}</span>
                      </button>
                    ))}
                  {(obrasQuery.data?.items ?? []).filter(o => {
                    const q = form.obraSearch.toLowerCase()
                    return o.numero?.toLowerCase().includes(q) || (o.cliente || '').toLowerCase().includes(q)
                  }).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-400">Nenhuma obra encontrada.</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="field-label">Tipo da medição</label>
              <select value={form.tipoMedicao} onChange={e => setForm(f => ({ ...f, tipoMedicao: e.target.value as CreateForm['tipoMedicao'] }))} className="field-select">
                <option value="adiantamento">Adiantamento</option>
                <option value="inicial">Inicial</option>
                <option value="parcial">Parcial</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="field-label">Data início</label>
              <input type="date" value={form.dataInicio} onChange={e => { setForm(f => ({ ...f, dataInicio: e.target.value })); setFormError('') }} className="field-input" />
            </div>
            <div>
              <label className="field-label">Data fim</label>
              <input type="date" value={form.dataFim} onChange={e => { setForm(f => ({ ...f, dataFim: e.target.value })); setFormError('') }} className="field-input" />
            </div>
            <div>
              <label className="field-label">Responsável pela medição</label>
              <select value={form.responsavelMedicao} onChange={e => setForm(f => ({ ...f, responsavelMedicao: e.target.value }))} className="field-select">
                <option value="">Selecione um colaborador</option>
                {colaboradoresQuery.data?.map(colaborador => (
                  <option key={colaborador.id} value={colaborador.nome}>{colaborador.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Conferido por</label>
              <input type="text" value={form.conferidoPor} onChange={e => setForm(f => ({ ...f, conferidoPor: e.target.value }))} className="field-input" placeholder="Nome" />
            </div>
          </div>
          {formError && (
            <div className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}
          <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
            <button type="button" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn btn-primary">
              {createMutation.isPending ? 'Gerando...' : 'Criar e abrir'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancelar</button>
            <p className="text-xs text-slate-400">As estacas serão importadas dos diários aprovados no período.</p>
          </div>
        </div>
      )}

      <div className="app-panel">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex-1 text-sm font-semibold text-slate-700">
            {medicoesQuery.data?.total ?? 0} medições
          </div>
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Obra ou cliente..."
              className="field-input pl-8 py-2 text-sm"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {medicoesQuery.isLoading && <QueryFeedback type="loading" title="Carregando medições" />}
        {medicoesQuery.isError && <QueryFeedback type="error" title="Erro" description={extractApiErrorMessage(medicoesQuery.error)} />}

        {!medicoesQuery.isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <FileText size={36} className="text-slate-200" />
            <div className="font-semibold text-slate-500">Nenhuma medição</div>
            <p className="text-sm text-slate-400">Clique em "Nova medição" para começar.</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 text-left">Nº</th>
                  <th className="px-4 py-3 text-left">Obra / Cliente</th>
                  <th className="px-4 py-3 text-left">Período</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Responsável</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Criado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map(m => (
                  <MedicaoRow
                    key={m.id}
                    m={m}
                    confirmingDelete={deleteConfirm === m.id}
                    isDeleting={deleteMutation.isPending && deleteConfirm === m.id}
                    onOpen={() => navigate(`/medicoes/${m.id}`)}
                    onDeleteRequest={() => setDeleteConfirm(m.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                    onDeleteConfirm={() => deleteMutation.mutate(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MedicaoRow({ m, confirmingDelete, isDeleting, onOpen, onDeleteRequest, onDeleteCancel, onDeleteConfirm }: {
  m: MedicaoListItem
  confirmingDelete: boolean
  isDeleting: boolean
  onOpen: () => void
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
}) {
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
      <td className="px-4 py-3 font-bold text-slate-700">#{m.numero}</td>
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-800">{m.obra_numero}</div>
        <div className="text-xs text-slate-400">{m.cliente}</div>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        {formatDate(m.data_inicio)} — {formatDate(m.data_fim)}
      </td>
      <td className="px-4 py-3 text-xs font-semibold capitalize text-slate-600">{m.tipo_medicao || 'parcial'}</td>
      <td className="px-4 py-3 text-xs text-slate-600">{m.responsavel_medicao || '—'}</td>
      <td className="px-4 py-3">
        <span className={cn(
          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
          m.status === 'fechada'
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        )}>
          {m.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(m.data_medicao)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onOpen} className="btn btn-secondary text-xs">Abrir</button>
          {confirmingDelete ? (
            <>
              <button type="button" onClick={onDeleteConfirm} disabled={isDeleting} className="btn btn-secondary text-xs text-red-600 border-red-200">
                {isDeleting ? '...' : 'Confirmar'}
              </button>
              <button type="button" onClick={onDeleteCancel} className="btn btn-secondary btn-icon"><X size={12} /></button>
            </>
          ) : (
            <button type="button" onClick={onDeleteRequest} className="btn btn-secondary btn-icon text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
          )}
        </div>
      </td>
    </tr>
  )
}
