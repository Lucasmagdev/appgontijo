import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  equipamentoService,
  extractApiErrorMessage,
  modalidadeService,
  usuarioService,
  type EquipamentoPayload,
} from '@/lib/gontijo-api'
import { useAuth } from '@/hooks/useAuth'

type DraftEquipamento = EquipamentoPayload & {
  localId: string
  id?: number
}

function createDraft(): DraftEquipamento {
  return {
    localId: `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    nome: '',
    computadorGeo: '',
    modalidadeId: null,
    status: 'ativo',
    imei: '',
    obraNumero: '',
    operadorId: null,
  }
}

export default function EquipamentosPage() {
  const { user } = useAuth()
  const isAdmin = user?.isAdmin ?? false
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<DraftEquipamento[]>([])
  const [saveError, setSaveError] = useState('')

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  const modalidadesQuery = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadeService.list,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  const operadoresQuery = useQuery({
    queryKey: ['usuarios-options'],
    queryFn: usuarioService.listOptions,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (equipamentosQuery.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(
        equipamentosQuery.data.map((item) => ({
          localId: `eq-${item.id}`,
          id: item.id,
          nome: item.nome,
          computadorGeo: item.computadorGeo || item.imei,
          modalidadeId: item.modalidadeId,
          status: item.status,
          imei: item.imei,
          obraNumero: item.obraNumero,
          operadorId: item.operadorId,
        }))
      )
    }
  }, [equipamentosQuery.data])

  const mutation = useMutation({
    mutationFn: async (draft: DraftEquipamento) => {
      const payload: EquipamentoPayload = {
        nome: draft.nome.trim(),
        computadorGeo: draft.computadorGeo.trim(),
        modalidadeId: draft.modalidadeId,
        status: draft.status,
        imei: draft.computadorGeo.trim(),
        obraNumero: draft.obraNumero?.trim(),
        operadorId: draft.operadorId,
      }

      if (draft.id) {
        await equipamentoService.update(draft.id, payload)
        return draft.id
      }

      return equipamentoService.create(payload)
    },
    onSuccess: async () => {
      setSaveError('')
      await queryClient.invalidateQueries({ queryKey: ['equipamentos'] })
      await queryClient.invalidateQueries({ queryKey: ['equipamentos-parametrizados'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
    },
    onError: (error) => {
      setSaveError(extractApiErrorMessage(error))
    },
  })

  function updateDraft(localId: string, field: keyof DraftEquipamento, value: string | number | null | undefined) {
    setDrafts((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, [field]: value } : item))
    )
  }

  async function handleSave(draft: DraftEquipamento) {
    await mutation.mutateAsync(draft)
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Equipamentos</h1>
          <p className="page-subtitle">Vinculo entre maquinas, identificador Geodigitus/IMEI e modalidades.</p>
        </div>

        {isAdmin && (
          <button type="button" onClick={() => setDrafts((prev) => [...prev, createDraft()])} className="btn btn-primary">
            <Plus size={15} />
            Adicionar
          </button>
        )}
      </div>

      {saveError ? (
        <QueryFeedback type="error" title="Nao foi possivel salvar" description={saveError} />
      ) : null}

      {equipamentosQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando equipamentos"
          description="Buscando maquinas e modalidades do banco real."
        />
      ) : null}

      {equipamentosQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar os equipamentos"
          description={extractApiErrorMessage(equipamentosQuery.error)}
        />
      ) : null}

      {drafts.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drafts.map((card, index) => (
            <article key={card.localId} className="app-panel section-panel">
              <div className="mb-4 border-b border-slate-200 pb-3">
                <h2 className="section-heading !mb-0">Equipamento {index + 1}</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="field-label">Equipamento</label>
                  <input
                    type="text"
                    value={card.nome}
                    onChange={(event) => updateDraft(card.localId, 'nome', event.target.value)}
                    className="field-input"
                    placeholder="Ex: HTM-03"
                  />
                </div>

                <div>
                  <label className="field-label">Computador Geodigitus / IMEI</label>
                  <input
                    type="text"
                    value={card.computadorGeo}
                    onChange={(event) => updateDraft(card.localId, 'computadorGeo', event.target.value)}
                    className="field-input"
                    placeholder="Ex: 352622021184705"
                  />
                </div>

                <div>
                  <label className="field-label">Modalidade</label>
                  <select
                    value={card.modalidadeId ?? ''}
                    onChange={(event) =>
                      updateDraft(card.localId, 'modalidadeId', event.target.value ? Number(event.target.value) : null)
                    }
                    className="field-select"
                  >
                    <option value="">Sem modalidade</option>
                    {modalidadesQuery.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Operador da máquina</label>
                  <select
                    value={card.operadorId ?? ''}
                    onChange={(event) =>
                      updateDraft(card.localId, 'operadorId', event.target.value ? Number(event.target.value) : null)
                    }
                    className="field-select"
                  >
                    <option value="">Sem operador vinculado</option>
                    {operadoresQuery.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label">Numero da obra</label>
                  <input
                    type="text"
                    value={card.obraNumero || ''}
                    onChange={(event) => updateDraft(card.localId, 'obraNumero', event.target.value)}
                    className="field-input"
                    placeholder="Ex: 1042"
                  />
                </div>

                <div>
                  <label className="field-label">Status</label>
                  <select
                    value={card.status}
                    onChange={(event) =>
                      updateDraft(card.localId, 'status', event.target.value as DraftEquipamento['status'])
                    }
                    className="field-select"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                {isAdmin && (
                  <button type="button" className="btn btn-neutral w-full" onClick={() => void handleSave(card)}>
                    <Save size={15} />
                    Salvar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        !equipamentosQuery.isLoading && (
          <QueryFeedback
            type="empty"
            title="Nenhum equipamento encontrado"
            description="Adicione a primeira maquina para comecar."
          />
        )
      )}
    </div>
  )
}
