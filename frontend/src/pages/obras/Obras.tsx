import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { clienteService, extractApiErrorMessage, obraService } from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

const statusColors: Record<string, string> = {
  'em andamento': 'status-danger',
  finalizada: 'status-success',
  pausada: 'status-neutral',
  cancelada: 'status-neutral',
}

export default function ObrasPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [page, setPage] = useState(1)

  const clientesQuery = useQuery({
    queryKey: ['cliente-options'],
    queryFn: clienteService.listOptions,
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  })

  const obrasQuery = useQuery({
    queryKey: ['obras', { search, status, clienteId, page }],
    queryFn: () =>
      obraService.list({
        busca: search || undefined,
        status: status || undefined,
        clienteId: clienteId ? Number(clienteId) : null,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Obras</h1>
          <p className="page-subtitle">Cadastros operacionais e acompanhamento das frentes ativas.</p>
        </div>

        <Link to="/obras/nova" className="btn btn-primary">
          <Plus size={15} />
          Nova obra
        </Link>
      </div>

      <section className="app-panel toolbar-panel">
        <div className="filter-grid">
          <div className="filter-col-4">
            <label className="field-label">Buscar</label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Numero da obra ou cliente"
                className="field-input pl-9"
              />
            </div>
          </div>

          <div className="filter-col-2">
            <label className="field-label">Status</label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
              className="field-select"
            >
              <option value="">Todos</option>
              <option value="em andamento">Em andamento</option>
              <option value="finalizada">Finalizada</option>
              <option value="pausada">Pausada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          <div className="filter-col-4">
            <label className="field-label">Cliente</label>
            <select
              value={clienteId}
              onChange={(event) => {
                setClienteId(event.target.value)
                setPage(1)
              }}
              className="field-select"
            >
              <option value="">Todos</option>
              {clientesQuery.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {obrasQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando obras"
          description="Sincronizando a listagem com os dados reais do MySQL."
        />
      ) : null}

      {obrasQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar as obras"
          description={extractApiErrorMessage(obrasQuery.error)}
        />
      ) : null}

      {obrasQuery.data ? (
        <>
          <p className="records-counter">{obrasQuery.data.total} registros encontrados</p>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[960px]">
                <thead>
                  <tr>
                    <th>N da Obra</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Localidade</th>
                    <th>Inicio previsto</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {obrasQuery.data.items.length ? (
                    obrasQuery.data.items.map((obra) => (
                      <tr key={obra.id}>
                        <td className="font-semibold text-slate-700">{obra.numero}</td>
                        <td className="font-semibold text-slate-800">{obra.cliente || '-'}</td>
                        <td>{obra.tipoObra || '-'}</td>
                        <td>{[obra.cidade, obra.estado].filter(Boolean).join(' - ') || '-'}</td>
                        <td>{obra.dataPrevistaInicio ? formatDate(obra.dataPrevistaInicio) : '-'}</td>
                        <td>
                          <span className={cn('status-badge capitalize', statusColors[obra.status])}>
                            {obra.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-row">
                            <Link
                              to={`/obras/${obra.id}/editar`}
                              className="btn btn-secondary btn-icon"
                              title="Editar obra"
                            >
                              <Pencil size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <QueryFeedback
                          type="empty"
                          title="Nenhuma obra encontrada"
                          description="Ajuste os filtros ou cadastre uma nova obra."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaginationControls
            page={obrasQuery.data.page}
            total={obrasQuery.data.total}
            limit={obrasQuery.data.limit}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  )
}
