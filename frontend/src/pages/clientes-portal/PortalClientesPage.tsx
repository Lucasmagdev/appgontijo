import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, RotateCcw } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  clientPortalAdminService,
  extractApiErrorMessage,
  obraService,
  type ClientPortalAccessRecord,
} from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

type FormState = {
  id: number | null
  constructionId: string
  login: string
  password: string
  active: boolean
}

const EMPTY_FORM: FormState = {
  id: null,
  constructionId: '',
  login: '',
  password: '',
  active: true,
}

export default function PortalClientesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')

  const obrasQuery = useQuery({
    queryKey: ['portal-clientes-obras-ativas'],
    queryFn: () => obraService.list({ status: 'em andamento', page: 1, limit: 200 }),
  })

  const accessesQuery = useQuery({
    queryKey: ['portal-clientes-acessos'],
    queryFn: clientPortalAdminService.list,
  })

  const selectedAccess = useMemo(
    () => accessesQuery.data?.find((item) => item.id === form.id) ?? null,
    [accessesQuery.data, form.id]
  )

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.login.trim()) {
        throw new Error('Informe o login do cliente.')
      }

      if (form.id) {
        return clientPortalAdminService.update(form.id, {
          login: form.login.trim(),
          password: form.password.trim() || undefined,
          active: form.active,
        })
      }

      if (!form.constructionId) {
        throw new Error('Selecione uma obra ativa.')
      }
      if (!form.password.trim()) {
        throw new Error('Informe uma senha para o primeiro acesso.')
      }

      return clientPortalAdminService.create({
        constructionId: Number(form.constructionId),
        login: form.login.trim(),
        password: form.password.trim(),
        active: form.active,
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      setForm(EMPTY_FORM)
      await queryClient.invalidateQueries({ queryKey: ['portal-clientes-acessos'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSubmitError('')
  }

  function startEdit(access: ClientPortalAccessRecord) {
    setForm({
      id: access.id,
      constructionId: String(access.constructionId),
      login: access.login,
      password: '',
      active: access.status === 'ativo',
    })
    setSubmitError('')
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setSubmitError('')
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Portal do cliente</h1>
          <p className="page-subtitle">
            Crie e gerencie acessos unicos para que cada cliente acompanhe os diarios da propria obra ativa.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="app-panel space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {form.id ? 'Editar acesso' : 'Novo acesso do cliente'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Cada obra ativa pode ter um acesso exclusivo para o cliente consultar os diarios.
              </p>
            </div>

            {form.id ? (
              <button type="button" onClick={resetForm} className="btn btn-secondary btn-icon" title="Novo acesso">
                <RotateCcw size={14} />
              </button>
            ) : null}
          </div>

          <div>
            <label className="field-label">Obra ativa</label>
            <select
              value={form.constructionId}
              onChange={(event) => updateField('constructionId', event.target.value)}
              disabled={Boolean(form.id)}
              className="field-select"
            >
              <option value="">Selecione uma obra</option>
              {obrasQuery.data?.items.map((obra) => (
                <option key={obra.id} value={obra.id}>
                  {obra.numero} - {obra.cliente || 'Cliente nao informado'}
                </option>
              ))}
            </select>
            {selectedAccess ? (
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                Obra vinculada: {selectedAccess.obraNumero}
              </p>
            ) : null}
          </div>

          <div>
            <label className="field-label">Login</label>
            <input
              type="text"
              value={form.login}
              onChange={(event) => updateField('login', event.target.value)}
              className="field-input"
              placeholder="cliente.obra123"
            />
          </div>

          <div>
            <label className="field-label">{form.id ? 'Nova senha (opcional)' : 'Senha inicial'}</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="field-input"
              placeholder={form.id ? 'Deixe em branco para manter a atual' : 'Defina a senha do cliente'}
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => updateField('active', event.target.checked)}
              className="h-4 w-4 accent-[var(--brand-red)]"
            />
            Acesso ativo
          </label>

          {submitError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {submitError}
            </div>
          ) : null}

          <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn btn-primary w-full">
            {mutation.isPending ? 'Salvando acesso...' : form.id ? 'Atualizar acesso' : 'Criar acesso'}
          </button>
        </section>

        <section className="app-panel">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Acessos criados</h2>
              <p className="mt-1 text-sm text-slate-500">
                Obras ativas com portal liberado para acompanhamento do cliente.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              <KeyRound size={14} />
              {accessesQuery.data?.length || 0} acessos
            </span>
          </div>

          {obrasQuery.isLoading || accessesQuery.isLoading ? (
            <QueryFeedback
              type="loading"
              title="Carregando portal do cliente"
              description="Sincronizando as obras ativas e os acessos vinculados."
            />
          ) : null}

          {obrasQuery.isError ? (
            <QueryFeedback
              type="error"
              title="Nao foi possivel carregar as obras ativas"
              description={extractApiErrorMessage(obrasQuery.error)}
            />
          ) : null}

          {accessesQuery.isError ? (
            <QueryFeedback
              type="error"
              title="Nao foi possivel carregar os acessos"
              description={extractApiErrorMessage(accessesQuery.error)}
            />
          ) : null}

          {accessesQuery.data ? (
            accessesQuery.data.length ? (
              <div className="grid gap-3">
                {accessesQuery.data.map((access) => (
                  <article key={access.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{access.obraNumero}</div>
                        <div className="text-sm text-slate-500">
                          {access.cliente || 'Cliente nao informado'}
                          {access.cidade || access.estado ? ` - ${[access.cidade, access.estado].filter(Boolean).join('/')}` : ''}
                        </div>
                      </div>

                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
                          access.status === 'ativo'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                        )}
                      >
                        {access.status}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MetaItem label="Login" value={access.login} />
                      <MetaItem label="Tipo" value={access.tipoObra || '-'} />
                      <MetaItem label="Ultimo acesso" value={access.lastLoginAt ? formatDate(access.lastLoginAt) : 'Nunca'} />
                      <MetaItem label="Criado em" value={access.createdAt ? formatDate(access.createdAt) : '-'} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(access)} className="btn btn-secondary">
                        <Plus size={14} />
                        Editar acesso
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <QueryFeedback
                type="empty"
                title="Nenhum acesso criado"
                description="Selecione uma obra ativa e crie o primeiro acesso do cliente."
              />
            )
          ) : null}
        </section>
      </div>
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{value || '-'}</div>
    </div>
  )
}
