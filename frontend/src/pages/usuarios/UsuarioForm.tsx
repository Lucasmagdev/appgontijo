import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, type UsuarioPayload, usuarioService } from '@/lib/gontijo-api'

const initialForm: UsuarioPayload = {
  nome: '',
  apelido: '',
  login: '',
  telefone: '',
  perfil: 'operador',
  status: 'ativo',
  senha: '',
}

export default function UsuarioFormPage() {
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

  useEffect(() => {
    if (usuarioQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        nome: usuarioQuery.data.nome,
        apelido: usuarioQuery.data.apelido,
        login: usuarioQuery.data.login,
        telefone: usuarioQuery.data.telefone,
        perfil: usuarioQuery.data.perfil,
        status: usuarioQuery.data.status,
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
      if (isEditing) {
        await queryClient.invalidateQueries({ queryKey: ['usuario', id] })
      }
      navigate('/usuarios')
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  function setField<K extends keyof UsuarioPayload>(field: K, value: UsuarioPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    const payload: UsuarioPayload = {
      nome: form.nome.trim(),
      apelido: form.apelido.trim(),
      login: form.login.trim(),
      telefone: form.telefone.trim(),
      perfil: form.perfil,
      status: form.status,
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

      {(!isEditing || usuarioQuery.data) && (
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

              {!isEditing ? (
                <div className="span-4">
                  <label className="field-label">Senha inicial</label>
                  <input
                    type="password"
                    value={form.senha || ''}
                    onChange={(event) => setField('senha', event.target.value)}
                    className="field-input"
                    required
                  />
                </div>
              ) : null}
            </div>
          </section>

          <div className="inline-actions justify-end">
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
