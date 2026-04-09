import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import {
  diarioService,
  equipamentoService,
  extractApiErrorMessage,
  modalidadeService,
} from '@/lib/gontijo-api'
import { formatDate } from '@/lib/utils'

function formatDateTime(value: string) {
  if (!value) return '-'
  const parsed = new Date(String(value).replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export default function DiariosPage() {
  const queryClient = useQueryClient()

  const [pendingFilters, setPendingFilters] = useState({
    dataInicio: '',
    dataFim: '',
    obra: '',
    ot: '',
    modalidadeId: '',
    equipamentoId: '',
  })

  const [appliedFilters, setAppliedFilters] = useState({
    dataInicio: '',
    dataFim: '',
    obra: '',
    modalidadeId: '',
    equipamentoId: '',
    page: 1,
  })

  const [deleteError, setDeleteError] = useState('')

  const modalidadesQuery = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadeService.list,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  const diariosQuery = useQuery({
    queryKey: ['diarios', appliedFilters],
    queryFn: () =>
      diarioService.list({
        page: appliedFilters.page,
        limit: 20,
        dataInicio: appliedFilters.dataInicio || undefined,
        dataFim: appliedFilters.dataFim || undefined,
        obra: appliedFilters.obra || undefined,
        modalidadeId: appliedFilters.modalidadeId ? Number(appliedFilters.modalidadeId) : null,
        equipamentoId: appliedFilters.equipamentoId ? Number(appliedFilters.equipamentoId) : null,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (!diariosQuery.data) return
    const hasNextPage = diariosQuery.data.page * diariosQuery.data.limit < diariosQuery.data.total
    if (!hasNextPage) return

    void queryClient.prefetchQuery({
      queryKey: ['diarios', { ...appliedFilters, page: appliedFilters.page + 1 }],
      queryFn: () =>
        diarioService.list({
          page: appliedFilters.page + 1,
          limit: 20,
          dataInicio: appliedFilters.dataInicio || undefined,
          dataFim: appliedFilters.dataFim || undefined,
          obra: appliedFilters.obra || undefined,
          modalidadeId: appliedFilters.modalidadeId ? Number(appliedFilters.modalidadeId) : null,
          equipamentoId: appliedFilters.equipamentoId ? Number(appliedFilters.equipamentoId) : null,
        }),
      staleTime: 1000 * 60 * 5,
    })
  }, [appliedFilters, diariosQuery.data, queryClient])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => diarioService.remove(id),
    onSuccess: async () => {
      setDeleteError('')
      await queryClient.invalidateQueries({ queryKey: ['diarios'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
    },
    onError: (error) => {
      setDeleteError(extractApiErrorMessage(error))
    },
  })

  function handleApplyFilters() {
    setAppliedFilters({
      dataInicio: pendingFilters.dataInicio,
      dataFim: pendingFilters.dataFim,
      obra: pendingFilters.obra,
      modalidadeId: pendingFilters.modalidadeId,
      equipamentoId: pendingFilters.equipamentoId,
      page: 1,
    })
  }

  async function handleDelete(id: number) {
    if (!window.confirm(`Excluir o diario ${id}?`)) return
    await deleteMutation.mutateAsync(id)
  }

  function handleOpenPdf(id: number) {
    window.open(diarioService.getPdfUrl(id), '_blank', 'noopener,noreferrer')
  }

  function updatePending(field: keyof typeof pendingFilters, value: string) {
    setPendingFilters((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="page-shell">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 className="page-heading" style={{ margin: 0 }}>Diários</h1>
        <Link
          to="/diarios/conferencia"
          style={{
            padding: '5px 14px',
            borderRadius: 6,
            border: '1px solid #e2e8f0',
            background: '#fff',
            color: '#2d3748',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ✓ Conferência de Estacas
        </Link>
      </div>

      {/* Filter bar */}
      <section className="app-panel toolbar-panel">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="field-label">De</label>
            <input
              type="date"
              value={pendingFilters.dataInicio}
              onChange={(e) => updatePending('dataInicio', e.target.value)}
              className="field-input w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Até</label>
            <input
              type="date"
              value={pendingFilters.dataFim}
              onChange={(e) => updatePending('dataFim', e.target.value)}
              className="field-input w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">N° da Obra</label>
            <input
              type="text"
              value={pendingFilters.obra}
              onChange={(e) => updatePending('obra', e.target.value)}
              placeholder="N° da Obra"
              className="field-input w-28"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">N° da OS</label>
            <input
              type="text"
              value={pendingFilters.ot}
              onChange={(e) => updatePending('ot', e.target.value)}
              placeholder="N° da OS"
              className="field-input w-28"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Modalidade da Obra</label>
            <select
              value={pendingFilters.modalidadeId}
              onChange={(e) => updatePending('modalidadeId', e.target.value)}
              className="field-select w-44"
            >
              <option value="">Selecione</option>
              {modalidadesQuery.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Equipamento</label>
            <select
              value={pendingFilters.equipamentoId}
              onChange={(e) => updatePending('equipamentoId', e.target.value)}
              className="field-select w-36"
            >
              <option value="">Selec.</option>
              {equipamentosQuery.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleApplyFilters}
            className="btn"
            style={{ backgroundColor: '#e53e3e', color: '#fff', alignSelf: 'flex-end' }}
          >
            Filtrar
          </button>

          <button
            type="button"
            className="btn"
            style={{ backgroundColor: '#2d3748', color: '#fff', alignSelf: 'flex-end' }}
            disabled
          >
            Baixar todos
          </button>
        </div>
      </section>

      {deleteError ? (
        <QueryFeedback type="error" title="Nao foi possivel excluir" description={deleteError} />
      ) : null}

      {diariosQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando diarios" description="" />
      ) : null}

      {diariosQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar os diarios"
          description={extractApiErrorMessage(diariosQuery.error)}
        />
      ) : null}

      {diariosQuery.data ? (
        <>
          <p className="records-counter">{diariosQuery.data.total} registros encontrados</p>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>N° da Obra</th>
                    <th>Cliente</th>
                    <th>
                      <span className="flex items-center gap-1">
                        Data <span className="text-slate-400">↓</span>
                      </span>
                    </th>
                    <th>Equipamento</th>
                    <th>Assinatura</th>
                    <th>Conferência</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {diariosQuery.data.items.length ? (
                    diariosQuery.data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="font-semibold text-slate-700">{item.obraNumero || '-'}</td>
                        <td>{item.cliente || '-'}</td>
                        <td>{item.dataDiario ? formatDate(item.dataDiario) : '-'}</td>
                        <td>{item.equipamento || '-'}</td>
                        <td>
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={
                                item.status === 'assinado'
                                  ? { backgroundColor: '#c6f6d5', color: '#276749' }
                                  : item.status === 'pendente'
                                    ? { backgroundColor: '#fed7d7', color: '#9b2c2c' }
                                    : { backgroundColor: '#fed7d7', color: '#9b2c2c' }
                              }
                            >
                              {item.status === 'assinado' ? 'Assinado' : 'Não assinado'}
                            </span>
                            {item.enviadoEm ? (
                              <span className="text-xs text-slate-500">
                                Enviado em {formatDateTime(item.enviadoEm)}
                              </span>
                            ) : item.criadoEm ? (
                              <span className="text-xs text-slate-500">
                                Criado em {formatDateTime(item.criadoEm)}
                              </span>
                            ) : null}
                            {item.status !== 'assinado' && (
                              <button
                                type="button"
                                className="text-xs font-semibold px-3 py-1 rounded"
                                style={{ backgroundColor: '#38a169', color: '#fff' }}
                              >
                                Enviar
                              </button>
                            )}
                            {item.status === 'assinado' && item.assinadoEm ? (
                              <span className="text-xs text-slate-400">
                                Assinado em {formatDateTime(item.assinadoEm)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {item.status === 'assinado' && (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={
                                item.conferenciaStatus === 'aprovado'
                                  ? { backgroundColor: '#c6f6d5', color: '#276749' }
                                  : item.conferenciaStatus === 'rejeitado'
                                    ? { backgroundColor: '#fed7d7', color: '#9b2c2c' }
                                    : { backgroundColor: '#fefcbf', color: '#744210' }
                              }
                            >
                              {item.conferenciaStatus === 'aprovado' ? 'Conferido' : item.conferenciaStatus === 'rejeitado' ? 'Rejeitado' : 'Aguard. Conferência'}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPdf(item.id)}
                                className="text-xs font-semibold px-3 py-1 rounded"
                                style={{ backgroundColor: '#319795', color: '#fff' }}
                              >
                                Abrir PDF
                              </button>
                              <Link
                                to={`/diarios/${item.id}/editar`}
                                className="text-xs font-semibold px-3 py-1 rounded"
                                style={{ backgroundColor: '#38a169', color: '#fff' }}
                              >
                                Editar
                              </Link>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              className="text-xs font-semibold px-3 py-1 rounded"
                              style={{ backgroundColor: '#e53e3e', color: '#fff' }}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <QueryFeedback
                          type="empty"
                          title="Nenhum diario encontrado"
                          description="Ajuste os filtros para ampliar a busca."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaginationControls
            page={diariosQuery.data.page}
            total={diariosQuery.data.total}
            limit={diariosQuery.data.limit}
            onPageChange={(page) =>
              setAppliedFilters((prev) => ({ ...prev, page }))
            }
          />
        </>
      ) : null}
    </div>
  )
}
