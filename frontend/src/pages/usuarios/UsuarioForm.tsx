import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { documentosService, extractApiErrorMessage, type UsuarioPayload, usuarioService } from '@/lib/gontijo-api'
import { useAuth } from '@/hooks/useAuth'

const initialForm: UsuarioPayload = {
  nome: '',
  apelido: '',
  login: '',
  telefone: '',
  cargo: '',
  perfil: 'operador',
  status: 'ativo',
  podeGerarLinkAssinatura: false,
  senha: '',
}

export default function UsuarioFormPage() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin ?? false
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<UsuarioPayload>(initialForm)
  const [submitError, setSubmitError] = useState('')

  const usuarioQuery = useQuery({
    queryKey: ['usuario', id],
    queryFn: () => usuarioService.getById(Number(id)),
    enabled: isEditing,
  })

  const cargosQuery = useQuery({
    queryKey: ['documentos-cargos'],
    queryFn: documentosService.listCargos,
    staleTime: 1000 * 60 * 10,
  })
  const tiposQuery = useQuery({
    queryKey: ['documentos-tipos'],
    queryFn: documentosService.listTipos,
    staleTime: 1000 * 60 * 10,
  })

  useEffect(() => {
    if (usuarioQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        nome: usuarioQuery.data.nome,
        apelido: usuarioQuery.data.apelido,
        login: usuarioQuery.data.login,
        telefone: usuarioQuery.data.telefone,
        cargo: usuarioQuery.data.cargo,
        perfil: usuarioQuery.data.perfil,
        status: usuarioQuery.data.status,
        podeGerarLinkAssinatura: usuarioQuery.data.podeGerarLinkAssinatura,
        senha: '',
      })
    }
  }, [usuarioQuery.data])

  const mutation = useMutation({
    mutationFn: async (payload: UsuarioPayload) => {
      if (isEditing) {
        await usuarioService.update(Number(id), payload)
        return Number(id)
      }

      return usuarioService.create(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      await queryClient.invalidateQueries({ queryKey: ['documentos-alertas'] })
      if (isEditing) {
        await queryClient.invalidateQueries({ queryKey: ['usuario', id] })
        await queryClient.invalidateQueries({ queryKey: ['documentos-colaborador', id] })
      }
      navigate('/usuarios')
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      await usuarioService.remove(Number(id))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
      navigate('/usuarios')
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  function setField<K extends keyof UsuarioPayload>(field: K, value: UsuarioPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const documentosCargoAtual = useMemo(() => {
    return (tiposQuery.data ?? []).filter((tipo) => tipo.ativo && tipo.cargos.some((cargo) => cargo.nome === form.cargo))
  }, [form.cargo, tiposQuery.data])

  const documentosCargoAnterior = useMemo(() => {
    const cargoAnterior = usuarioQuery.data?.cargo || ''
    return (tiposQuery.data ?? []).filter((tipo) => tipo.ativo && tipo.cargos.some((cargo) => cargo.nome === cargoAnterior))
  }, [tiposQuery.data, usuarioQuery.data?.cargo])

  const documentosNovosNoCargo = useMemo(() => {
    const anteriores = new Set(documentosCargoAnterior.map((tipo) => tipo.id))
    return documentosCargoAtual.filter((tipo) => !anteriores.has(tipo.id))
  }, [documentosCargoAnterior, documentosCargoAtual])

  const cargoFoiAlterado = Boolean(isEditing && usuarioQuery.data && form.cargo && form.cargo !== usuarioQuery.data.cargo)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    const payload: UsuarioPayload = {
      nome: form.nome.trim(),
      apelido: form.apelido.trim(),
      login: form.login.trim(),
      telefone: form.telefone.trim(),
      cargo: form.cargo.trim(),
      perfil: form.perfil,
      status: form.status,
      podeGerarLinkAssinatura: Boolean(form.podeGerarLinkAssinatura),
      senha: form.senha?.trim(),
    }

    if (!isEditing && !payload.senha) {
      setSubmitError('Senha e obrigatoria para criar um novo usuario.')
      return
    }

    await mutation.mutateAsync(payload)
  }

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/usuarios" className="btn btn-secondary btn-icon">
          <ArrowLeft size={15} />
        </Link>

        <div>
          <h1 className="page-heading">{isEditing ? 'Editar usuario' : 'Novo usuario'}</h1>
          <p className="page-subtitle">Cadastro administrativo usado no modulo novo.</p>
        </div>
      </div>

      {usuarioQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando usuario"
          description="Buscando os dados atuais antes de liberar a edicao."
        />
      ) : null}

      {usuarioQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar o usuario"
          description={extractApiErrorMessage(usuarioQuery.error)}
        />
      ) : null}

      {submitError ? (
        <QueryFeedback type="error" title="Nao foi possivel salvar" description={submitError} />
      ) : null}

      {!isAdmin && (
        <QueryFeedback
          type="error"
          title="Acesso restrito"
          description="Apenas administradores podem criar ou editar usuarios."
        />
      )}

      {isAdmin && (!isEditing || usuarioQuery.data) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Dados do usuario</h2>

            <div className="form-grid">
              <div className="span-6">
                <label className="field-label">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(event) => setField('nome', event.target.value)}
                  className="field-input"
                  required
                />
              </div>

              <div className="span-3">
                <label className="field-label">Apelido</label>
                <input
                  type="text"
                  value={form.apelido}
                  onChange={(event) => setField('apelido', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-3">
                <label className="field-label">Telefone</label>
                <input
                  type="text"
                  value={form.telefone}
                  onChange={(event) => setField('telefone', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-6">
                <label className="field-label">Cargo</label>
                <select
                  value={form.cargo}
                  onChange={(event) => setField('cargo', event.target.value)}
                  className="field-select"
                >
                  <option value="">Selecione</option>
                  {form.cargo && !cargosQuery.data?.some((cargo) => cargo.nome === form.cargo) ? (
                    <option value={form.cargo}>{form.cargo}</option>
                  ) : null}
                  {(cargosQuery.data ?? []).filter((cargo) => cargo.ativo).map((cargo) => (
                    <option key={cargo.id} value={cargo.nome}>{cargo.nome}</option>
                  ))}
                </select>
              </div>

              {form.cargo ? (
                <div className="span-12 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <strong className="block text-amber-950">Impacto nos documentos</strong>
                  <span>
                    O cargo selecionado exige {documentosCargoAtual.length} documento(s) no checklist atual.
                    {cargoFoiAlterado ? ' Como o cargo foi alterado, o painel de Documentos vai recalcular pendencias e vencimentos apos salvar.' : ''}
                  </span>
                  {cargoFoiAlterado && documentosNovosNoCargo.length ? (
                    <div className="mt-2 text-xs text-amber-900">
                      Novos documentos exigidos: {documentosNovosNoCargo.slice(0, 6).map((tipo) => tipo.nome).join(', ')}
                      {documentosNovosNoCargo.length > 6 ? ` e mais ${documentosNovosNoCargo.length - 6}` : ''}.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="span-6">
                <label className="field-label">Login</label>
                <input
                  type="text"
                  value={form.login}
                  onChange={(event) => setField('login', event.target.value)}
                  className="field-input"
                  required
                />
              </div>

              <div className="span-3">
                <label className="field-label">Perfil</label>
                <select
                  value={form.perfil}
                  onChange={(event) => setField('perfil', event.target.value as UsuarioPayload['perfil'])}
                  className="field-select"
                >
                  <option value="operador">Operador</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="span-3">
                <label className="field-label">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value as UsuarioPayload['status'])}
                  className="field-select"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <label className="span-6 inline-flex items-start gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(form.podeGerarLinkAssinatura)}
                  onChange={(event) => setField('podeGerarLinkAssinatura', event.target.checked)}
                  className="mt-1"
                />
                <span>
                  <strong className="block text-slate-900">Pode gerar link de assinatura</strong>
                  Libera a opcao no mobile para engenheiros ou usuarios autorizados.
                </span>
              </label>

              <div className="span-4">
                <label className="field-label">{isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial'}</label>
                <input
                  type="password"
                  value={form.senha || ''}
                  onChange={(event) => setField('senha', event.target.value)}
                  className="field-input"
                  required={!isEditing}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </section>

          <div className="inline-actions justify-between">
            {isEditing ? (
              <button
                type="button"
                className="btn btn-secondary text-red-600"
                disabled={deleteMutation.isPending}
                onClick={async () => {
                  const ok = window.confirm('Tem certeza que deseja excluir este usuario? Essa acao nao pode ser desfeita.')
                  if (!ok) return
                  await deleteMutation.mutateAsync()
                }}
              >
                <Trash2 size={15} />
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir usuario'}
              </button>
            ) : (
              <span />
            )}
            <Link to="/usuarios" className="btn btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              <Save size={15} />
              {mutation.isPending ? 'Salvando...' : 'Salvar usuario'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
