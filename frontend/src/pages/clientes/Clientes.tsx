import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { clienteService, extractApiErrorMessage } from '@/lib/gontijo-api'

export default function ClientesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [deleteError, setDeleteError] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  const clientesQuery = useQuery({
    queryKey: ['clientes', { search: debouncedSearch, page }],
    queryFn: () =>
      clienteService.list({
        busca: debouncedSearch || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 15,
  })

  useEffect(() => {
    if (!clientesQuery.data) return
    const hasNextPage = clientesQuery.data.page * clientesQuery.data.limit < clientesQuery.data.total
    if (!hasNextPage) return

    void queryClient.prefetchQuery({
      queryKey: ['clientes', { search: debouncedSearch, page: page + 1 }],
      queryFn: () =>
        clienteService.list({
          busca: debouncedSearch || undefined,
          page: page + 1,
          limit: 20,
        }),
      staleTime: 1000 * 60 * 15,
    })
  }, [clientesQuery.data, debouncedSearch, page, queryClient])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clienteService.remove(id),
    onSuccess: async () => {
      setDeleteError('')
      await queryClient.invalidateQueries({ queryKey: ['clientes'] })
      await queryClient.invalidateQueries({ queryKey: ['cliente-options'] })
    },
    onError: (error) => {
      setDeleteError(extractApiErrorMessage(error))
    },
  })

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Excluir o cliente "${name}"?`)) return
    await deleteMutation.mutateAsync(id)
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Clientes</h1>
          <p className="page-subtitle">Base comercial e contratual dos clientes ativos.</p>
        </div>

        <Link to="/clientes/novo" className="btn btn-primary">
          <Plus size={15} />
          Novo cliente
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
                placeholder="Razao social, email ou documento"
                className="field-input field-input-with-icon"
              />
            </div>
          </div>
        </div>
      </section>

      {deleteError ? (
        <QueryFeedback type="error" title="Nao foi possivel excluir" description={deleteError} />
      ) : null}

      {clientesQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando clientes"
          description="Buscando os registros reais no banco principal."
        />
      ) : null}

      {clientesQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar os clientes"
          description={extractApiErrorMessage(clientesQuery.error)}
        />
      ) : null}

      {clientesQuery.data ? (
        <>
          <p className="records-counter">{clientesQuery.data.total} registros encontrados</p>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[920px]">
                <thead>
                  <tr>
                    <th>Razao social</th>
                    <th>Documento</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Cidade</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesQuery.data.items.length ? (
                    clientesQuery.data.items.map((client) => (
                      <tr key={client.id}>
                        <td className="font-semibold text-slate-800">{client.razaoSocial}</td>
                        <td>{client.documento || '-'}</td>
                        <td>{client.email || '-'}</td>
                        <td>{client.telefone || '-'}</td>
                        <td>
                          {[client.cidade, client.estado].filter(Boolean).join(' - ') || '-'}
                        </td>
                        <td>
                          <div className="action-row">
                            <Link
                              to={`/clientes/${client.id}/editar`}
                              className="btn btn-secondary btn-icon"
                              title="Editar cliente"
                            >
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon text-red-600"
                              title="Excluir cliente"
                              onClick={() => handleDelete(client.id, client.razaoSocial)}
                              disabled={deleteMutation.isPending}
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
                          title="Nenhum cliente encontrado"
                          description="Ajuste os filtros ou cadastre um novo cliente."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaginationControls
            page={clientesQuery.data.page}
            total={clientesQuery.data.total}
            limit={clientesQuery.data.limit}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  )
}
