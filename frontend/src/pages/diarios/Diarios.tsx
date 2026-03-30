import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Search, Trash2 } from 'lucide-react'
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

export default function DiariosPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    obra: '',
    modalidadeId: '',
    equipamentoId: '',
    status: '',
    page: 1,
  })
  const [deleteError, setDeleteError] = useState('')

  const modalidadesQuery = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadeService.list,
  })

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos'],
    queryFn: equipamentoService.list,
  })

  const diariosQuery = useQuery({
    queryKey: ['diarios', filters],
    queryFn: () =>
      diarioService.list({
        page: filters.page,
        limit: 20,
        dataInicio: filters.dataInicio || undefined,
        dataFim: filters.dataFim || undefined,
        obra: filters.obra || undefined,
        modalidadeId: filters.modalidadeId ? Number(filters.modalidadeId) : null,
        equipamentoId: filters.equipamentoId ? Number(filters.equipamentoId) : null,
        status: filters.status || undefined,
      }),
  })

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

  async function handleDelete(id: number) {
    if (!window.confirm(`Excluir o diario ${id}?`)) return
    await deleteMutation.mutateAsync(id)
  }

  function handleOpenPdf(id: number) {
    window.open(diarioService.getPdfUrl(id), '_blank', 'noopener,noreferrer')
  }

  function updateFilter(field: keyof typeof filters, value: string | number) {
    setFilters((prev) => ({ ...prev, [field]: value, page: field === 'page' ? Number(value) : 1 }))
  }

  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">Diarios</h1>
        <p className="page-subtitle">Listagem real dos diarios de obra ja migrados para o MySQL.</p>
      </div>

      <section className="app-panel toolbar-panel">
        <div className="filter-grid">
          <div className="filter-col-2">
            <label className="field-label">De</label>
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(event) => updateFilter('dataInicio', event.target.value)}
              className="field-input"
            />
          </div>

          <div className="filter-col-2">
            <label className="field-label">Ate</label>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(event) => updateFilter('dataFim', event.target.value)}
              className="field-input"
            />
          </div>

          <div className="filter-col-2">
            <label className="field-label">N da Obra</label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={filters.obra}
                onChange={(event) => updateFilter('obra', event.target.value)}
                placeholder="Numero da obra"
                className="field-input pl-9"
              />
            </div>
          </div>

          <div className="filter-col-2">
            <label className="field-label">Modalidade</label>
            <select
              value={filters.modalidadeId}
              onChange={(event) => updateFilter('modalidadeId', event.target.value)}
              className="field-select"
            >
              <option value="">Todas</option>
              {modalidadesQuery.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-col-2">
            <label className="field-label">Equipamento</label>
            <select
              value={filters.equipamentoId}
              onChange={(event) => updateFilter('equipamentoId', event.target.value)}
              className="field-select"
            >
              <option value="">Todos</option>
              {equipamentosQuery.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-col-2">
            <label className="field-label">Status</label>
            <select
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="field-select"
            >
              <option value="">Todos</option>
              <option value="rascunho">Rascunho</option>
              <option value="pendente">Pendente</option>
              <option value="assinado">Assinado</option>
            </select>
          </div>
        </div>
      </section>

      {deleteError ? (
        <QueryFeedback type="error" title="Nao foi possivel excluir" description={deleteError} />
      ) : null}

      {diariosQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando diarios"
          description="Aplicando os filtros reais na base migrada."
        />
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
              <table className="data-table min-w-[920px]">
                <thead>
                  <tr>
                    <th>N da Obra</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th>Equipamento</th>
                    <th>Assinatura</th>
                    <th>Acoes</th>
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
                          <div className="status-stack">
                            <span
                              className={`status-badge ${
                                item.status === 'assinado'
                                  ? 'status-success'
                                  : item.status === 'pendente'
                                    ? 'status-danger'
                                    : 'status-neutral'
                              }`}
                            >
                              {item.status === 'assinado'
                                ? 'Assinado'
                                : item.status === 'pendente'
                                  ? 'Pendente'
                                  : 'Rascunho'}
                            </span>
                            {item.assinadoEm ? (
                              <span className="text-xs text-slate-400">{formatDate(item.assinadoEm)}</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="action-row">
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon"
                              onClick={() => handleOpenPdf(item.id)}
                              title="Abrir PDF"
                            >
                              <FileText size={14} />
                            </button>
                            <Link
                              to={`/diarios/${item.id}/editar`}
                              className="btn btn-secondary btn-icon"
                              title="Editar diario"
                            >
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon text-red-600"
                              onClick={() => void handleDelete(item.id)}
                              title="Excluir diario"
                            >
                              <Trash2 size={14} />
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
            onPageChange={(page) => updateFilter('page', page)}
          />
        </>
      ) : null}
    </div>
  )
}
