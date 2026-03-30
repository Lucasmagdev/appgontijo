import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  diarioService,
  equipamentoService,
  extractApiErrorMessage,
  type DiarioPayload,
} from '@/lib/gontijo-api'

export default function DiarioFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DiarioPayload>({
    dataDiario: '',
    status: 'pendente',
    equipamentoId: null,
    assinadoEm: '',
    dadosJson: null,
  })
  const [jsonText, setJsonText] = useState('{}')
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['diario', id],
    queryFn: () => diarioService.getById(Number(id)),
    enabled: Boolean(id),
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
  })

  useEffect(() => {
    if (diarioQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        dataDiario: diarioQuery.data.dataDiario.slice(0, 10),
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm ? diarioQuery.data.assinadoEm.slice(0, 16) : '',
        dadosJson: diarioQuery.data.dadosJson,
      })
      setJsonText(JSON.stringify(diarioQuery.data.dadosJson || {}, null, 2))
    }
  }, [diarioQuery.data])

  const equipmentHint = useMemo(() => diarioQuery.data?.equipamento || '', [diarioQuery.data])

  const mutation = useMutation({
    mutationFn: async (payload: DiarioPayload) => {
      await diarioService.update(Number(id), payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['diarios'] })
      await queryClient.invalidateQueries({ queryKey: ['diario', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      navigate('/diarios')
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')

    let parsedJson: Record<string, unknown> | null = null
    try {
      parsedJson = JSON.parse(jsonText) as Record<string, unknown>
    } catch {
      setSubmitError('O JSON do diario esta invalido. Corrija antes de salvar.')
      return
    }

    await mutation.mutateAsync({
      dataDiario: form.dataDiario,
      status: form.status,
      equipamentoId: form.equipamentoId,
      assinadoEm: form.assinadoEm,
      dadosJson: parsedJson,
    })
  }

  return (
    <div className="page-shell">
      <div className="flex items-center gap-3">
        <Link to="/diarios" className="btn btn-secondary btn-icon">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="page-heading">Editar diario</h1>
          <p className="page-subtitle">Ajuste data, status, equipamento e o JSON bruto do diario.</p>
        </div>
      </div>

      {diarioQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando diario" description="Buscando o registro atual no MySQL." />
      ) : null}

      {diarioQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar o diario"
          description={extractApiErrorMessage(diarioQuery.error)}
        />
      ) : null}

      {submitError ? (
        <QueryFeedback type="error" title="Nao foi possivel salvar" description={submitError} />
      ) : null}

      {diarioQuery.data ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="app-panel section-panel">
            <h2 className="section-heading">Resumo</h2>
            <div className="form-grid">
              <div className="span-3">
                <label className="field-label">ID</label>
                <input type="text" value={String(diarioQuery.data.id)} className="field-input" disabled />
              </div>
              <div className="span-3">
                <label className="field-label">Obra</label>
                <input type="text" value={diarioQuery.data.obraNumero || '-'} className="field-input" disabled />
              </div>
              <div className="span-6">
                <label className="field-label">Cliente</label>
                <input type="text" value={diarioQuery.data.clienteNome || '-'} className="field-input" disabled />
              </div>
              <div className="span-3">
                <label className="field-label">Data</label>
                <input
                  type="date"
                  value={form.dataDiario}
                  onChange={(event) => setForm((prev) => ({ ...prev, dataDiario: event.target.value }))}
                  className="field-input"
                  required
                />
              </div>
              <div className="span-3">
                <label className="field-label">Status</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value as DiarioPayload['status'] }))
                  }
                  className="field-select"
                >
                  <option value="rascunho">Rascunho</option>
                  <option value="pendente">Pendente</option>
                  <option value="assinado">Assinado</option>
                </select>
              </div>
              <div className="span-3">
                <label className="field-label">Equipamento</label>
                <select
                  value={form.equipamentoId ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      equipamentoId: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                  className="field-select"
                >
                  <option value="">Sem vinculo</option>
                  {equipamentosQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="span-3">
                <label className="field-label">Assinado em</label>
                <input
                  type="datetime-local"
                  value={form.assinadoEm}
                  onChange={(event) => setForm((prev) => ({ ...prev, assinadoEm: event.target.value }))}
                  className="field-input"
                />
              </div>
              <div className="span-12">
                <label className="field-label">Equipamento detectado no legado</label>
                <input type="text" value={equipmentHint || '-'} className="field-input" disabled />
              </div>
            </div>
          </section>

          <section className="app-panel section-panel">
            <h2 className="section-heading">JSON do diario</h2>
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              className="field-textarea font-mono"
              style={{ minHeight: '24rem' }}
            />
          </section>

          <div className="inline-actions justify-end">
            <Link to="/diarios" className="btn btn-secondary">
              Cancelar
            </Link>
            <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
              <Save size={15} />
              {mutation.isPending ? 'Salvando...' : 'Salvar diario'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
