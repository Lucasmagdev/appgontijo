import { useEffect, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { extractApiErrorMessage, usuarioService } from '@/lib/gontijo-api'
import { cn, formatDate } from '@/lib/utils'

export default function UsuariosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search)

  const usuariosQuery = useQuery({
    queryKey: ['usuarios', { search: debouncedSearch, statusFilter, page }],
    queryFn: () =>
      usuarioService.list({
        busca: debouncedSearch || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 15,
  })

  useEffect(() => {
    if (!usuariosQuery.data) return
    const hasNextPage = usuariosQuery.data.page * usuariosQuery.data.limit < usuariosQuery.data.total
    if (!hasNextPage) return

    void queryClient.prefetchQuery({
      queryKey: ['usuarios', { search: debouncedSearch, statusFilter, page: page + 1 }],
      queryFn: () =>
        usuarioService.list({
          busca: debouncedSearch || undefined,
          status: statusFilter || undefined,
          page: page + 1,
          limit: 20,
        }),
      staleTime: 1000 * 60 * 15,
    })
  }, [debouncedSearch, page, queryClient, statusFilter, usuariosQuery.data])

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await usuarioService.remove(id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    },
  })

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Usuarios</h1>
          <p className="page-subtitle">Gestao administrativa de acessos e perfis.</p>
        </div>

        <Link to="/usuarios/novo" className="btn btn-primary">
          <UserPlus size={15} />
          Adicionar usuario
        </Link>
      </div>

      <section className="app-panel toolbar-panel">
        <div className="filter-grid">
          <div className="filter-col-4">
            <label className="field-label">Busca</label>
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
                className="field-input field-input-with-icon"
                placeholder="Nome, apelido ou login"
              />
            </div>
          </div>

          <div className="filter-col-2">
            <label className="field-label">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
              className="field-select"
            >
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>
      </section>

      {usuariosQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando usuarios"
          description="Buscando os dados reais direto do MySQL."
        />
      ) : null}

      {usuariosQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar os usuarios"
          description={extractApiErrorMessage(usuariosQuery.error)}
        />
      ) : null}

      {usuariosQuery.data ? (
        <>
          <p className="records-counter">{usuariosQuery.data.total} registros encontrados</p>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Apelido</th>
                    <th>Login</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosQuery.data.items.length ? (
                    usuariosQuery.data.items.map((user) => (
                      <tr key={user.id}>
                        <td className="font-semibold text-slate-700">#{user.id}</td>
                        <td className="font-semibold text-slate-800">{user.nome}</td>
                        <td>{user.apelido || '-'}</td>
                        <td>{user.login}</td>
                        <td className="capitalize">{user.perfil}</td>
                        <td>
                          <span
                            className={cn(
                              'status-badge',
                              user.status === 'ativo' ? 'status-success' : 'status-neutral'
                            )}
                          >
                            {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td>{user.criadoEm ? formatDate(user.criadoEm) : '-'}</td>
                        <td>
                          <div className="action-row">
                            <Link
                              to={`/usuarios/${user.id}/editar`}
                              className="btn btn-secondary btn-icon"
                              title="Editar usuario"
                            >
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-icon text-red-600"
                              title="Excluir usuario"
                              onClick={async () => {
                                const ok = window.confirm(`Excluir o usuario ${user.nome}?`)
                                if (!ok) return
                                await deleteMutation.mutateAsync(user.id)
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>
                        <QueryFeedback
                          type="empty"
                          title="Nenhum usuario encontrado"
                          description="Ajuste os filtros ou cadastre um novo usuario."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaginationControls
            page={usuariosQuery.data.page}
            total={usuariosQuery.data.total}
            limit={usuariosQuery.data.limit}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  )
}
