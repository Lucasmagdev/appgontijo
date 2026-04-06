import { useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Clock, Copy, Eye, EyeOff, KeyRound, MapPin, Pencil, Search, ShieldOff, Trash2, X } from 'lucide-react'
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

function useClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }
  return { copy, copiedKey }
}

export default function PortalClientesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const { copy, copiedKey } = useClipboard()

  const obrasQuery = useQuery({
    queryKey: ['portal-clientes-obras-ativas'],
    queryFn: () => obraService.list({ status: 'em andamento', page: 1, limit: 200 }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  })

  const accessesQuery = useQuery({
    queryKey: ['portal-clientes-acessos'],
    queryFn: clientPortalAdminService.list,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  })

  const selectedAccess = useMemo(
    () => accessesQuery.data?.find((item) => item.id === form.id) ?? null,
    [accessesQuery.data, form.id]
  )

  const filteredAccesses = useMemo(() => {
    const list = accessesQuery.data ?? []
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (a) =>
        a.obraNumero.toLowerCase().includes(q) ||
        a.cliente.toLowerCase().includes(q) ||
        a.login.toLowerCase().includes(q)
    )
  }, [accessesQuery.data, search])

  const activeCount = accessesQuery.data?.filter((a) => a.status === 'ativo').length ?? 0
  const totalCount = accessesQuery.data?.length ?? 0

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientPortalAdminService.delete(id),
    onSuccess: async (_data, id) => {
      setDeleteConfirmId(null)
      if (form.id === id) resetForm()
      await queryClient.invalidateQueries({ queryKey: ['portal-clientes-acessos'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.login.trim()) throw new Error('Informe o login do cliente.')
      if (form.id) {
        return clientPortalAdminService.update(form.id, {
          login: form.login.trim(),
          password: form.password.trim() || undefined,
          active: form.active,
        })
      }
      if (!form.constructionId) throw new Error('Selecione uma obra ativa.')
      if (!form.password.trim()) throw new Error('Informe uma senha para o primeiro acesso.')
      return clientPortalAdminService.create({
        constructionId: Number(form.constructionId),
        login: form.login.trim(),
        password: form.password.trim(),
        active: form.active,
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setForm(EMPTY_FORM)
      setShowPassword(false)
      await queryClient.invalidateQueries({ queryKey: ['portal-clientes-acessos'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSubmitError('')
    setSaveSuccess(false)
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
    setSaveSuccess(false)
    setShowPassword(false)
  }

  function resetForm() {
    setForm(EMPTY_FORM)
    setSubmitError('')
    setSaveSuccess(false)
    setShowPassword(false)
  }

  const isEditing = Boolean(form.id)

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-heading">Portal do Cliente</h1>
          <p className="page-subtitle">
            Crie acessos exclusivos para cada cliente acompanhar os diários da própria obra.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatChip label="Ativos" value={activeCount} color="emerald" />
          <StatChip label="Total" value={totalCount} color="slate" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ── Formulário ─────────────────────────────────── */}
        <section className="app-panel flex flex-col gap-0 overflow-hidden p-0">
          {/* Form header */}
          <div
            className={cn(
              'flex items-center justify-between gap-3 border-b px-5 py-4 transition-colors',
              isEditing ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  isEditing ? 'bg-amber-100' : 'bg-red-100'
                )}
              >
                {isEditing
                  ? <Pencil size={14} className="text-amber-700" />
                  : <KeyRound size={14} className="text-red-700" />
                }
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {isEditing ? 'Editar acesso' : 'Novo acesso'}
                </div>
                {isEditing && selectedAccess ? (
                  <div className="text-xs text-slate-500">Obra {selectedAccess.obraNumero}</div>
                ) : (
                  <div className="text-xs text-slate-500">Vincule uma obra ativa</div>
                )}
              </div>
            </div>
            {isEditing ? (
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                title="Cancelar edição"
              >
                <X size={12} />
                Cancelar
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 p-5">
            {/* Obra */}
            <div>
              <label className="field-label">Obra ativa</label>
              <select
                value={form.constructionId}
                onChange={(e) => updateField('constructionId', e.target.value)}
                disabled={isEditing}
                className={cn('field-select', isEditing && 'cursor-not-allowed opacity-60')}
              >
                <option value="">Selecione uma obra ativa</option>
                {obrasQuery.data?.items.map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {obra.numero} — {obra.cliente || 'Cliente não informado'}
                  </option>
                ))}
              </select>
            </div>

            {/* Login */}
            <div>
              <label className="field-label">Login do cliente</label>
              <div className="relative">
                <input
                  type="text"
                  value={form.login}
                  onChange={(e) => updateField('login', e.target.value)}
                  className="field-input pr-10"
                  placeholder="cliente.obra123"
                  autoComplete="off"
                />
                {form.login ? (
                  <button
                    type="button"
                    onClick={() => copy(form.login, 'form-login')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    title="Copiar login"
                  >
                    {copiedKey === 'form-login' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                ) : null}
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="field-label">
                {isEditing ? 'Nova senha (opcional)' : 'Senha inicial'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  className="field-input pr-10"
                  placeholder={isEditing ? 'Deixe em branco para manter a atual' : 'Defina a senha do cliente'}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Toggle ativo */}
            <button
              type="button"
              onClick={() => updateField('active', !form.active)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
                form.active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              )}
            >
              <div
                className={cn(
                  'relative h-5 w-9 rounded-full transition-colors',
                  form.active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                    form.active ? 'translate-x-4' : 'translate-x-0.5'
                  )}
                />
              </div>
              {form.active ? 'Acesso ativo' : 'Acesso desativado'}
            </button>

            {/* Erro */}
            {submitError ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <X size={15} className="mt-0.5 shrink-0" />
                {submitError}
              </div>
            ) : null}

            {/* Sucesso */}
            {saveSuccess ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <Check size={15} className="shrink-0" />
                Acesso {isEditing ? 'atualizado' : 'criado'} com sucesso!
              </div>
            ) : null}

            {/* Botão */}
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="btn btn-primary w-full"
            >
              {mutation.isPending
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alterações'
                  : 'Criar acesso'}
            </button>
          </div>
        </section>

        {/* ── Lista de acessos ───────────────────────────── */}
        <section className="app-panel flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-800">Acessos criados</h2>
              <p className="text-sm text-slate-500">Obras com portal liberado para o cliente.</p>
            </div>

            {/* Busca */}
            <div className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar obra ou login..."
                className="field-input pl-8 py-2 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
          </div>

          {obrasQuery.isLoading || accessesQuery.isLoading ? (
            <QueryFeedback
              type="loading"
              title="Carregando acessos"
              description="Buscando obras e acessos configurados."
            />
          ) : null}

          {accessesQuery.isError ? (
            <QueryFeedback
              type="error"
              title="Erro ao carregar acessos"
              description={extractApiErrorMessage(accessesQuery.error)}
            />
          ) : null}

          {accessesQuery.data && !accessesQuery.data.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <KeyRound size={28} className="text-slate-300" />
              </div>
              <div>
                <div className="font-semibold text-slate-700">Nenhum acesso criado</div>
                <div className="mt-1 text-sm text-slate-400">
                  Selecione uma obra e crie o primeiro acesso do cliente.
                </div>
              </div>
            </div>
          ) : null}

          {accessesQuery.data && accessesQuery.data.length > 0 && !filteredAccesses.length ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Search size={24} className="text-slate-300" />
              <div className="text-sm text-slate-500">Nenhum acesso encontrado para "{search}"</div>
            </div>
          ) : null}

          {filteredAccesses.length > 0 ? (
            <div className="grid gap-3">
              {filteredAccesses.map((access) => (
                <AccessCard
                  key={access.id}
                  access={access}
                  isSelected={form.id === access.id}
                  onEdit={() => startEdit(access)}
                  onCopy={copy}
                  copiedKey={copiedKey}
                  confirmingDelete={deleteConfirmId === access.id}
                  onDeleteRequest={() => setDeleteConfirmId(access.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onDeleteConfirm={() => deleteMutation.mutate(access.id)}
                  isDeleting={deleteMutation.isPending && deleteConfirmId === access.id}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function AccessCard({
  access,
  isSelected,
  onEdit,
  onCopy,
  copiedKey,
  confirmingDelete,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
  isDeleting,
}: {
  access: ClientPortalAccessRecord
  isSelected: boolean
  onEdit: () => void
  onCopy: (text: string, key: string) => void
  copiedKey: string | null
  confirmingDelete: boolean
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  isDeleting: boolean
}) {
  const isActive = access.status === 'ativo'
  const loginKey = `login-${access.id}`

  return (
    <article
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-sm transition-all',
        isSelected
          ? 'border-amber-300 ring-2 ring-amber-100'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      )}
    >
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              isActive ? 'bg-red-50' : 'bg-slate-100'
            )}
          >
            {isActive
              ? <Building2 size={16} className="text-red-600" />
              : <ShieldOff size={16} className="text-slate-400" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900">{access.obraNumero}</span>
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
                )}
              >
                {access.status}
              </span>
            </div>
            <div className="mt-0.5 text-sm text-slate-500">
              {access.cliente || 'Cliente não informado'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              isSelected
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            )}
          >
            <Pencil size={12} />
            {isSelected ? 'Editando...' : 'Editar'}
          </button>

          {confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDeleteConfirm}
                disabled={isDeleting}
                className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={onDeleteCancel}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              title="Excluir acesso"
            >
              <Trash2 size={12} />
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-slate-100" />

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Login com copy */}
        <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Login</div>
            <div className="mt-0.5 font-mono text-sm font-semibold text-slate-800">{access.login}</div>
          </div>
          <button
            type="button"
            onClick={() => onCopy(access.login, loginKey)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            title="Copiar login"
          >
            {copiedKey === loginKey ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          </button>
        </div>

        {/* Tipo */}
        <MetaCell
          label="Tipo"
          value={access.tipoObra || '—'}
        />

        {/* Localização */}
        {access.cidade || access.estado ? (
          <MetaCell
            label="Local"
            value={[access.cidade, access.estado].filter(Boolean).join('/')}
            icon={<MapPin size={10} className="text-slate-400" />}
          />
        ) : (
          <MetaCell label="Local" value="—" />
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          Último acesso:{' '}
          <span className={cn('ml-1 font-medium', access.lastLoginAt ? 'text-slate-600' : 'text-slate-400')}>
            {access.lastLoginAt ? formatDate(access.lastLoginAt) : 'Nunca'}
          </span>
        </span>
        <span>
          Criado em{' '}
          <span className="font-medium text-slate-600">
            {access.createdAt ? formatDate(access.createdAt) : '—'}
          </span>
        </span>
      </div>
    </article>
  )
}

function MetaCell({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-slate-700">{value}</div>
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: 'emerald' | 'slate' }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-1.5',
        color === 'emerald'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-slate-50'
      )}
    >
      <span
        className={cn(
          'text-lg font-bold leading-none',
          color === 'emerald' ? 'text-emerald-700' : 'text-slate-700'
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-wide',
          color === 'emerald' ? 'text-emerald-600' : 'text-slate-500'
        )}
      >
        {label}
      </span>
    </div>
  )
}
