import { useMemo, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Camera, Check, Clock, Copy, Eye, EyeOff, FileText, ImagePlus, KeyRound, Link2, MapPin, Paperclip, Pencil, Search, ShieldOff, Trash2, Upload, X } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  clientPortalAdminService,
  extractApiErrorMessage,
  obraService,
  portalDocumentosAdminApi,
  TIPO_DOCUMENTO_LABELS,
  type ClientPortalAccessRecord,
  type ObraFoto,
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
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopiedKey(key)
        setTimeout(() => setCopiedKey(null), 2000)
      })
      return
    }

    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    document.body.removeChild(area)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }
  return { copy, copiedKey }
}

function buildClientPortalLink(login: string) {
  return `${window.location.origin}/portal-cliente/login?login=${encodeURIComponent(login)}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Nao foi possivel ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

async function compressPhotoFile(file: File) {
  const source = await readFileAsDataUrl(file)
  const image = new Image()

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'))
    image.src = source
  })

  const maxSize = 1400
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return source
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', 0.78)
}

async function makePortalPhoto(file: File): Promise<ObraFoto> {
  const now = new Date()
  return {
    nome: file.name,
    tipo: file.type || 'image/jpeg',
    tamanho: Number.isFinite(file.size) ? file.size : null,
    titulo: file.name.replace(/\.[^.]+$/, '') || 'Foto da obra',
    url: await compressPhotoFile(file),
    dataFoto: now.toISOString().slice(0, 10),
    criadoEm: now.toISOString(),
  }
}

export default function PortalClientesPage() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [photoAccessId, setPhotoAccessId] = useState<number | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [pendingPhotos, setPendingPhotos] = useState<ObraFoto[]>([])
  const selectedPhotoAccessRef = useRef<ClientPortalAccessRecord | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const [docAccessId, setDocAccessId] = useState<number | null>(null)
  const [docTipo, setDocTipo] = useState('projeto')
  const [docError, setDocError] = useState('')
  const docInputRef = useRef<HTMLInputElement | null>(null)
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

  const selectedPhotoAccess = useMemo(
    () => accessesQuery.data?.find((item) => item.id === photoAccessId) ?? null,
    [accessesQuery.data, photoAccessId]
  )

  const selectedPhotoObraQuery = useQuery({
    queryKey: ['portal-cliente-obra-fotos', selectedPhotoAccess?.constructionId],
    queryFn: () => obraService.getById(selectedPhotoAccess!.constructionId),
    enabled: Boolean(selectedPhotoAccess?.constructionId),
  })

  const docsQuery = useQuery({
    queryKey: ['portal-docs', docAccessId],
    queryFn: () => portalDocumentosAdminApi.list(docAccessId!),
    enabled: Boolean(docAccessId),
    staleTime: 1000 * 60 * 2,
  })

  const uploadDocMutation = useMutation({
    mutationFn: ({ file, tipo }: { file: File; tipo: string }) =>
      portalDocumentosAdminApi.upload(docAccessId!, file, tipo),
    onSuccess: async () => {
      setDocError('')
      await queryClient.invalidateQueries({ queryKey: ['portal-docs', docAccessId] })
    },
    onError: (error) => setDocError(extractApiErrorMessage(error)),
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: number) => portalDocumentosAdminApi.remove(docId),
    onSuccess: async () => {
      setDocError('')
      await queryClient.invalidateQueries({ queryKey: ['portal-docs', docAccessId] })
    },
    onError: (error) => setDocError(extractApiErrorMessage(error)),
  })

  const updatePhotosMutation = useMutation({
    mutationFn: ({ constructionId, fotos }: { constructionId: number; fotos: ObraFoto[] }) =>
      obraService.updateFotos(constructionId, fotos),
    onSuccess: async () => {
      setPhotoError('')
      await queryClient.invalidateQueries({ queryKey: ['portal-cliente-obra-fotos', selectedPhotoAccess?.constructionId] })
    },
    onError: (error) => setPhotoError(extractApiErrorMessage(error)),
  })

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
  const fotosObra = selectedPhotoObraQuery.data?.fotosObra ?? []

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

  function openPhotoManager(access: ClientPortalAccessRecord, openPicker = false) {
    selectedPhotoAccessRef.current = access
    setPhotoAccessId(access.id)
    setPhotoError('')
    if (openPicker) {
      photoInputRef.current?.click()
    }
  }

  async function pushPortalPhotos(files: FileList | null) {
    const targetAccess = selectedPhotoAccessRef.current || selectedPhotoAccess
    if (!files?.length || !targetAccess) return
    setPhotoError('')

    try {
      if (pendingPhotos.length >= 10) {
        setPhotoError('Salve ou remova as fotos selecionadas antes de escolher mais imagens.')
        return
      }

      const images = Array.from(files).filter((file) => file.type.startsWith('image/'))
      if (!images.length) {
        setPhotoError('Selecione apenas arquivos de imagem.')
        return
      }

      if (images.length + pendingPhotos.length > 10) {
        setPhotoError('Selecione no maximo 10 fotos por envio para manter a tela leve.')
        return
      }

      const nextPhotos = await Promise.all(images.map(makePortalPhoto))
      setPendingPhotos((current) => [...current, ...nextPhotos])
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Nao foi possivel anexar as fotos.')
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  function updatePendingPhotoTitle(index: number, titulo: string) {
    setPendingPhotos((current) => current.map((foto, currentIndex) => (currentIndex === index ? { ...foto, titulo } : foto)))
  }

  function updatePendingPhotoDate(index: number, dataFoto: string) {
    setPendingPhotos((current) => current.map((foto, currentIndex) => (currentIndex === index ? { ...foto, dataFoto } : foto)))
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function savePendingPhotos() {
    const targetAccess = selectedPhotoAccessRef.current || selectedPhotoAccess
    if (!targetAccess || !pendingPhotos.length) return
    await updatePhotosMutation.mutateAsync({
      constructionId: targetAccess.constructionId,
      fotos: [...fotosObra, ...pendingPhotos],
    })
    setPendingPhotos([])
  }

  function removePortalPhoto(index: number) {
    if (!selectedPhotoAccess) return
    updatePhotosMutation.mutate({
      constructionId: selectedPhotoAccess.constructionId,
      fotos: fotosObra.filter((_, current) => current !== index),
    })
  }

  const isEditing = Boolean(form.id)

  return (
    <div className="page-shell">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => void pushPortalPhotos(event.target.files)}
      />
      <input
        ref={docInputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file || !docAccessId) return
          uploadDocMutation.mutate({ file, tipo: docTipo })
          if (docInputRef.current) docInputRef.current.value = ''
        }}
      />

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
                  isManagingPhotos={photoAccessId === access.id}
                  isManagingDocs={docAccessId === access.id}
                  onEdit={() => startEdit(access)}
                  onManagePhotos={() => openPhotoManager(access, false)}
                  onAddPhoto={() => openPhotoManager(access, true)}
                  onManageDocs={() => { setDocAccessId(docAccessId === access.id ? null : access.id); setDocError('') }}
                  onCopy={copy}
                  copiedKey={copiedKey}
                  confirmingDelete={deleteConfirmId === access.id}
                  onDeleteRequest={() => setDeleteConfirmId(access.id)}
                  onDeleteCancel={() => setDeleteConfirmId(null)}
                  onDeleteConfirm={() => deleteMutation.mutate(access.id)}
                  isDeleting={deleteMutation.isPending && deleteConfirmId === access.id}
                  docManager={docAccessId === access.id ? {
                    docs: docsQuery.data ?? [],
                    isLoading: docsQuery.isLoading,
                    isSaving: uploadDocMutation.isPending,
                    isDeleting: deleteDocMutation.isPending,
                    error: docError,
                    tipo: docTipo,
                    onTipoChange: setDocTipo,
                    onUpload: () => docInputRef.current?.click(),
                    onDelete: (id) => deleteDocMutation.mutate(id),
                    onClose: () => { setDocAccessId(null); setDocError('') },
                  } : undefined}
                  photoManager={photoAccessId === access.id ? {
                    fotosObra,
                    pendingPhotos,
                    isLoading: selectedPhotoObraQuery.isLoading,
                    isSaving: updatePhotosMutation.isPending,
                    error: photoError,
                    onAddPhotos: () => photoInputRef.current?.click(),
                    onSavePhotos: () => void savePendingPhotos(),
                    onRemoveSaved: (index) => removePortalPhoto(index),
                    onUpdatePendingTitle: updatePendingPhotoTitle,
                    onUpdatePendingDate: updatePendingPhotoDate,
                    onRemovePending: removePendingPhoto,
                    onClose: () => { setPhotoAccessId(null); setPendingPhotos([]); selectedPhotoAccessRef.current = null },
                  } : undefined}
                />
              ))}
            </div>
          ) : null}

        </section>
      </div>
    </div>
  )
}

type DocManager = {
  docs: { id: number; tipo: string; nome_original: string; tamanho: number | null; criado_em: string }[]
  isLoading: boolean
  isSaving: boolean
  isDeleting: boolean
  error: string
  tipo: string
  onTipoChange: (v: string) => void
  onUpload: () => void
  onDelete: (id: number) => void
  onClose: () => void
}

type PhotoManager = {
  fotosObra: ObraFoto[]
  pendingPhotos: ObraFoto[]
  isLoading: boolean
  isSaving: boolean
  error: string
  onAddPhotos: () => void
  onSavePhotos: () => void
  onRemoveSaved: (index: number) => void
  onUpdatePendingTitle: (index: number, titulo: string) => void
  onUpdatePendingDate: (index: number, dataFoto: string) => void
  onRemovePending: (index: number) => void
  onClose: () => void
}

function AccessCard({
  access,
  isSelected,
  isManagingPhotos,
  isManagingDocs,
  onEdit,
  onManagePhotos,
  onAddPhoto,
  onManageDocs,
  onCopy,
  copiedKey,
  confirmingDelete,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
  isDeleting,
  photoManager,
  docManager,
}: {
  access: ClientPortalAccessRecord
  isSelected: boolean
  isManagingPhotos: boolean
  isManagingDocs: boolean
  onEdit: () => void
  onManagePhotos: () => void
  onAddPhoto: () => void
  onManageDocs: () => void
  onCopy: (text: string, key: string) => void
  copiedKey: string | null
  confirmingDelete: boolean
  onDeleteRequest: () => void
  onDeleteCancel: () => void
  onDeleteConfirm: () => void
  isDeleting: boolean
  photoManager?: PhotoManager
  docManager?: DocManager
}) {
  const isActive = access.status === 'ativo'
  const loginKey = `login-${access.id}`
  const linkKey = `link-${access.id}`
  const portalLink = buildClientPortalLink(access.login)

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

          <button
            type="button"
            onClick={onManagePhotos}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              isManagingPhotos
                ? 'border-red-300 bg-red-50 text-[var(--brand-red)]'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-[var(--brand-red)]'
            )}
          >
            <Camera size={12} />
            Ver fotos
          </button>

          <button
            type="button"
            onClick={onAddPhoto}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-[var(--brand-red)] transition-colors hover:bg-red-100"
          >
            <ImagePlus size={12} />
            Anexar nova foto
          </button>

          <button
            type="button"
            onClick={onManageDocs}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              isManagingDocs
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700'
            )}
          >
            <Paperclip size={12} />
            Documentos
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

        {/* Localização */}
        <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 sm:col-span-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-red-400">Link de entrada</div>
            <div className="mt-0.5 truncate text-sm font-semibold text-red-800">Portal do cliente</div>
          </div>
          <button
            type="button"
            onClick={() => onCopy(portalLink, linkKey)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-[var(--brand-red)] transition hover:border-red-300 hover:bg-red-50"
            title="Copiar link de entrada do cliente"
          >
            {copiedKey === linkKey ? <Check size={13} className="text-emerald-600" /> : <Link2 size={13} />}
            {copiedKey === linkKey ? 'Copiado' : 'Copiar link'}
          </button>
        </div>

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

      {/* Inline document panel */}
      {docManager && (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-[linear-gradient(180deg,#f0f7ff_0%,#ffffff_100%)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Paperclip size={16} className="text-blue-600" />
                Documentos do portal — obra {access.obraNumero}
              </div>
              <p className="mt-1 text-sm text-slate-500">Projetos, sondagens e outros arquivos visíveis ao cliente.</p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={docManager.onClose}>Fechar</button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="field-label">Tipo</label>
              <select value={docManager.tipo} onChange={(e) => docManager.onTipoChange(e.target.value)} className="field-select w-36">
                <option value="projeto">Projeto</option>
                <option value="sondagem">Sondagem</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={docManager.onUpload}
              disabled={docManager.isSaving}
            >
              <Upload size={14} />
              {docManager.isSaving ? 'Enviando...' : 'Enviar arquivo'}
            </button>
          </div>

          {docManager.error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{docManager.error}</div>
          ) : null}

          {docManager.isLoading ? (
            <div className="mt-4 text-sm text-slate-500">Carregando documentos...</div>
          ) : docManager.docs.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-white/80 px-5 py-8 text-center">
              <FileText size={28} className="mx-auto text-blue-400" />
              <div className="mt-2 text-sm font-bold text-slate-800">Nenhum documento cadastrado</div>
              <p className="mt-1 text-sm text-slate-500">Envie projetos ou sondagens para aparecerem no portal.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {docManager.docs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText size={18} className="shrink-0 text-blue-500" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">{doc.nome_original}</div>
                      <div className="text-xs text-slate-400">
                        {TIPO_DOCUMENTO_LABELS[doc.tipo] ?? doc.tipo}
                        {doc.tamanho ? ` · ${Math.round(doc.tamanho / 1024)} KB` : ''}
                        {' · '}{formatDate(doc.criado_em.slice(0, 10))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon text-red-600"
                    disabled={docManager.isDeleting}
                    onClick={() => docManager.onDelete(doc.id)}
                    title="Remover documento"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inline photo panel */}
      {photoManager && (
        <div className="mt-4 rounded-2xl border border-red-100 bg-[linear-gradient(180deg,#fff8f7_0%,#ffffff_100%)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Camera size={16} className="text-[var(--brand-red)]" />
                Fotos do portal - obra {access.obraNumero}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Essas fotos aparecem na galeria do cliente, sem entrar no PDF do diario.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary"
                onClick={photoManager.onAddPhotos}
                disabled={photoManager.isSaving}
              >
                <ImagePlus size={15} />
                Anexar fotos
              </button>
              {photoManager.pendingPhotos.length > 0 && (
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={photoManager.onSavePhotos}
                  disabled={photoManager.isSaving}
                >
                  Salvar {photoManager.pendingPhotos.length} foto{photoManager.pendingPhotos.length !== 1 ? 's' : ''}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={photoManager.onClose}
              >
                Fechar
              </button>
            </div>
          </div>

          {photoManager.isLoading && (
            <div className="mt-3 text-sm text-slate-500">Carregando fotos...</div>
          )}

          {photoManager.error ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {photoManager.error}
            </div>
          ) : null}

          {photoManager.isSaving ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Salvando galeria...
            </div>
          ) : null}

          {photoManager.pendingPhotos.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-amber-900">Fotos selecionadas para envio</div>
                  <p className="mt-1 text-sm text-amber-700">Revise, edite o titulo ou remova antes de salvar no portal.</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={photoManager.onSavePhotos}
                  disabled={photoManager.isSaving}
                >
                  Salvar fotos
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {photoManager.pendingPhotos.map((foto, index) => (
                  <div key={`${foto.nome}-${index}`} className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
                    <div className="aspect-[4/3] bg-slate-100">
                      <img src={foto.url} alt={foto.titulo || foto.nome} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="space-y-2 p-3">
                      <label className="field-label">Titulo da foto</label>
                      <input
                        className="field-input"
                        value={foto.titulo}
                        onChange={(event) => photoManager.onUpdatePendingTitle(index, event.target.value)}
                        placeholder="Titulo que aparece no portal"
                      />
                      <label className="field-label">Data da foto</label>
                      <input
                        type="date"
                        className="field-input"
                        value={foto.dataFoto || foto.criadoEm?.slice(0, 10) || ''}
                        onChange={(event) => photoManager.onUpdatePendingDate(index, event.target.value)}
                      />
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{foto.tamanho ? `${Math.round(foto.tamanho / 1024)} KB` : 'Imagem selecionada'}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon text-red-600"
                          onClick={() => photoManager.onRemovePending(index)}
                          title="Remover da selecao"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!photoManager.isLoading && photoManager.fotosObra.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-red-200 bg-white/80 px-5 py-8 text-center">
              <Camera size={30} className="mx-auto text-[var(--brand-red)]" />
              <div className="mt-2 text-sm font-bold text-slate-800">Nenhuma foto cadastrada para este cliente</div>
              <p className="mt-1 text-sm text-slate-500">Clique em anexar fotos para alimentar a galeria do portal.</p>
            </div>
          ) : null}

          {photoManager.fotosObra.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-black text-slate-900">Fotos ja publicadas no portal</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {photoManager.fotosObra.map((foto, index) => (
                  <div key={`${foto.nome}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="aspect-[4/3] bg-slate-100">
                      <img src={foto.url} alt={foto.titulo || foto.nome} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-800">{foto.titulo || foto.nome}</div>
                        <div className="text-xs text-slate-400">
                          {(foto.dataFoto || foto.criadoEm?.slice(0, 10)) ? new Date(`${foto.dataFoto || foto.criadoEm.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data'} - {foto.tamanho ? `${Math.round(foto.tamanho / 1024)} KB` : 'Imagem anexada'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-icon text-red-600"
                        onClick={() => photoManager.onRemoveSaved(index)}
                        disabled={photoManager.isSaving}
                        title="Remover foto"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
