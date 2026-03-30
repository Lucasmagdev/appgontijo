import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { clienteService, extractApiErrorMessage, type ClientePayload } from '@/lib/gontijo-api'

const initialForm: ClientePayload = {
  razaoSocial: '',
  tipoDoc: 'cnpj',
  documento: '',
  inscricaoMunicipal: '',
  email: '',
  telefone: '',
  cep: '',
  estado: '',
  cidade: '',
  logradouro: '',
  bairro: '',
  numero: '',
  complemento: '',
}

export default function ClienteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<ClientePayload>(initialForm)
  const [submitError, setSubmitError] = useState('')

  const clienteQuery = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => clienteService.getById(Number(id)),
    enabled: isEditing,
  })

  useEffect(() => {
    if (clienteQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        razaoSocial: clienteQuery.data.razaoSocial,
        tipoDoc: clienteQuery.data.tipoDoc,
        documento: clienteQuery.data.documento,
        inscricaoMunicipal: clienteQuery.data.inscricaoMunicipal,
        email: clienteQuery.data.email,
        telefone: clienteQuery.data.telefone,
        cep: clienteQuery.data.cep,
        estado: clienteQuery.data.estado,
        cidade: clienteQuery.data.cidade,
        logradouro: clienteQuery.data.logradouro,
        bairro: clienteQuery.data.bairro,
        numero: clienteQuery.data.numero,
        complemento: clienteQuery.data.complemento,
      })
    }
  }, [clienteQuery.data])

  const mutation = useMutation({
    mutationFn: async (payload: ClientePayload) => {
      if (isEditing) {
        await clienteService.update(Number(id), payload)
        return Number(id)
      }

      return clienteService.create(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      await queryClient.invalidateQueries({ queryKey: ['cliente-options'] })
      if (isEditing) {
        await queryClient.invalidateQueries({ queryKey: ['cliente', id] })
      }
      navigate('/clientes')
    },
    onError: (error) => {
      setSubmitError(extractApiErrorMessage(error))
    },
  })

  function setField<K extends keyof ClientePayload>(field: K, value: ClientePayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCep(cep: string) {
    setField('cep', cep)
    const cleaned = cep.replace(/\D/g, '')

    if (cleaned.length !== 8) return

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`)
      const data = (await response.json()) as {
        erro?: boolean
        logradouro?: string
        bairro?: string
        localidade?: string
        uf?: string
      }

      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
        }))
      }
    } catch {
      return
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    await mutation.mutateAsync({
      ...form,
      razaoSocial: form.razaoSocial.trim(),
      email: form.email.trim(),
    })
  }

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/clientes" className="btn btn-secondary btn-icon">
          <ArrowLeft size={15} />
        </Link>

        <div>
          <h1 className="page-heading">{isEditing ? 'Editar cliente' : 'Novo cliente'}</h1>
          <p className="page-subtitle">Cadastro fiscal, comercial e endereco principal.</p>
        </div>
      </div>

      {clienteQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando cliente"
          description="Buscando os dados atuais para a edicao."
        />
      ) : null}

      {clienteQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar o cliente"
          description={extractApiErrorMessage(clienteQuery.error)}
        />
      ) : null}

      {submitError ? (
        <QueryFeedback type="error" title="Nao foi possivel salvar" description={submitError} />
      ) : null}

      {(!isEditing || clienteQuery.data) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Dados basicos</h2>

            <div className="form-grid">
              <div className="span-12">
                <label className="field-label">Razao social / Nome</label>
                <input
                  type="text"
                  value={form.razaoSocial}
                  onChange={(event) => setField('razaoSocial', event.target.value)}
                  className="field-input"
                  required
                />
              </div>

              <div className="span-3">
                <label className="field-label">Tipo de documento</label>
                <select
                  value={form.tipoDoc}
                  onChange={(event) => setField('tipoDoc', event.target.value as ClientePayload['tipoDoc'])}
                  className="field-select"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                </select>
              </div>

              <div className="span-3">
                <label className="field-label">{form.tipoDoc === 'cpf' ? 'CPF' : 'CNPJ'}</label>
                <input
                  type="text"
                  value={form.documento}
                  onChange={(event) => setField('documento', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-3">
                <label className="field-label">Inscricao municipal</label>
                <input
                  type="text"
                  value={form.inscricaoMunicipal}
                  onChange={(event) => setField('inscricaoMunicipal', event.target.value)}
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
                  placeholder="(31) 99999-9999"
                />
              </div>

              <div className="span-6">
                <label className="field-label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setField('email', event.target.value)}
                  className="field-input"
                />
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">Endereco</h2>

            <div className="form-grid">
              <div className="span-3">
                <label className="field-label">CEP</label>
                <input
                  type="text"
                  value={form.cep}
                  onChange={(event) => void handleCep(event.target.value)}
                  className="field-input"
                  placeholder="00000-000"
                  maxLength={9}
                />
              </div>

              <div className="span-2">
                <label className="field-label">Estado</label>
                <input
                  type="text"
                  value={form.estado}
                  onChange={(event) => setField('estado', event.target.value)}
                  className="field-input"
                  maxLength={2}
                />
              </div>

              <div className="span-4">
                <label className="field-label">Cidade</label>
                <input
                  type="text"
                  value={form.cidade}
                  onChange={(event) => setField('cidade', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-8">
                <label className="field-label">Logradouro</label>
                <input
                  type="text"
                  value={form.logradouro}
                  onChange={(event) => setField('logradouro', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-2">
                <label className="field-label">Numero</label>
                <input
                  type="text"
                  value={form.numero}
                  onChange={(event) => setField('numero', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-4">
                <label className="field-label">Bairro</label>
                <input
                  type="text"
                  value={form.bairro}
                  onChange={(event) => setField('bairro', event.target.value)}
                  className="field-input"
                />
              </div>

              <div className="span-4">
                <label className="field-label">Complemento</label>
                <input
                  type="text"
                  value={form.complemento}
                  onChange={(event) => setField('complemento', event.target.value)}
                  className="field-input"
                />
              </div>
            </div>
          </section>

          <div className="inline-actions justify-end">
            <Link to="/clientes" className="btn btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              <Save size={15} />
              {mutation.isPending ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
