import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, RefreshCcw, Trash2, X } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  extractApiErrorMessage,
  predefinedOccurrencesAdminService,
  type PredefinedOccurrence,
} from '@/lib/gontijo-api'

type FormState = {
  title: string
  category: string
  templateText: string
  active: boolean
  sortOrder: string
}

const emptyForm: FormState = {
  title: '',
  category: 'Geral',
  templateText: '',
  active: true,
  sortOrder: '0',
}

function payloadFromForm(form: FormState) {
  return {
    title: form.title.trim(),
    category: form.category.trim(),
    templateText: form.templateText.trim() || form.title.trim(),
    active: form.active,
    sortOrder: Number(form.sortOrder || 0),
  }
}

export default function PreOcorrenciasPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<PredefinedOccurrence | null>(null)
  const [error, setError] = useState('')

  const query = useQuery({
    queryKey: ['predefined-occurrences-admin'],
    queryFn: predefinedOccurrencesAdminService.list,
  })

  const sortedItems = useMemo(() => query.data ?? [], [query.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = payloadFromForm(form)
      if (!payload.title) throw new Error('Informe o titulo.')
      if (!payload.templateText) throw new Error('Informe o texto padrao.')
      return editing
        ? predefinedOccurrencesAdminService.update(editing.id, payload)
        : predefinedOccurrencesAdminService.create(payload)
    },
    onSuccess: async () => {
      setForm(emptyForm)
      setEditing(null)
      setError('')
      await queryClient.invalidateQueries({ queryKey: ['predefined-occurrences-admin'] })
      await queryClient.invalidateQueries({ queryKey: ['predefined-occurrences'] })
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => predefinedOccurrencesAdminService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['predefined-occurrences-admin'] })
      await queryClient.invalidateQueries({ queryKey: ['predefined-occurrences'] })
    },
    onError: (err) => setError(extractApiErrorMessage(err)),
  })

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function startEdit(item: PredefinedOccurrence) {
    setEditing(item)
    setForm({
      title: item.title,
      category: item.category || 'Geral',
      templateText: item.templateText,
      active: item.active,
      sortOrder: String(item.sortOrder || 0),
    })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setForm(emptyForm)
    setError('')
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Pre-ocorrencias</h1>
          <p className="page-subtitle">Cadastre textos padrao para o operador preencher rapidamente o diario de obras.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => query.refetch()}>
          <RefreshCcw size={15} />
          Atualizar
        </button>
      </div>

      <section className="app-panel section-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-heading !mb-1">{editing ? 'Editar pre-ocorrencia' : 'Nova pre-ocorrencia'}</h2>
            <p className="text-sm text-slate-500">O texto padrao aparece no app do operador ao escolher a ocorrencia.</p>
          </div>
          {editing ? (
            <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
              <X size={15} />
              Cancelar
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px_140px]">
          <label className="field-group">
            <span className="field-label">Titulo</span>
            <input
              className="field-input"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Ex.: Falta de acesso ao local"
            />
          </label>
          <label className="field-group">
            <span className="field-label">Categoria</span>
            <input
              className="field-input"
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
              placeholder="Geral"
            />
          </label>
          <label className="field-group">
            <span className="field-label">Ordem</span>
            <input
              className="field-input"
              type="number"
              value={form.sortOrder}
              onChange={(event) => updateField('sortOrder', event.target.value)}
            />
          </label>
        </div>

        <label className="field-group mt-4">
          <span className="field-label">Texto padrao</span>
          <textarea
            className="field-input min-h-[110px]"
            value={form.templateText}
            onChange={(event) => updateField('templateText', event.target.value)}
            placeholder="Texto que sera inserido no diario do operador"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateField('active', event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Ativa para operadores
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Plus size={15} />
            {saveMutation.isPending ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Cadastrar'}
          </button>
        </div>

        {error ? <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div> : null}
      </section>

      <section className="app-panel section-panel">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="section-heading !mb-0">Cadastradas</h2>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600">{sortedItems.length} item(ns)</span>
        </div>

        {query.isLoading ? <QueryFeedback type="loading" title="Carregando pre-ocorrencias" /> : null}
        {query.isError ? <QueryFeedback type="error" title="Erro ao carregar" description={extractApiErrorMessage(query.error)} /> : null}

        {sortedItems.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ordem</th>
                  <th>Titulo</th>
                  <th>Categoria</th>
                  <th>Status</th>
                  <th>Texto padrao</th>
                  <th className="w-28 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sortOrder}</td>
                    <td className="font-semibold text-slate-900">{item.title}</td>
                    <td>{item.category || '-'}</td>
                    <td>
                      <span className={item.active ? 'rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700' : 'rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600'}>
                        {item.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="max-w-xl truncate">{item.templateText}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn btn-secondary h-9 px-3" onClick={() => startEdit(item)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary h-9 px-3 text-red-700"
                          disabled={removeMutation.isPending}
                          onClick={() => removeMutation.mutate(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !query.isLoading ? (
          <QueryFeedback type="empty" title="Nenhuma pre-ocorrencia" description="Cadastre a primeira opcao para aparecer no app do operador." />
        ) : null}
      </section>
    </div>
  )
}
