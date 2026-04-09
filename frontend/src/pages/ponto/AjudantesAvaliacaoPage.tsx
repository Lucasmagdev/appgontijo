import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import PaginationControls from '@/components/ui/PaginationControls'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, helperEvaluationService } from '@/lib/gontijo-api'
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

export default function AjudantesAvaliacaoPage() {
  const [pendingFilters, setPendingFilters] = useState({
    dataInicio: '',
    dataFim: '',
    nome: '',
  })
  const [appliedFilters, setAppliedFilters] = useState({
    dataInicio: '',
    dataFim: '',
    nome: '',
    page: 1,
  })

  const avaliacoesQuery = useQuery({
    queryKey: ['avaliacoes-ajudantes', appliedFilters],
    queryFn: () =>
      helperEvaluationService.list({
        page: appliedFilters.page,
        limit: 20,
        dataInicio: appliedFilters.dataInicio || undefined,
        dataFim: appliedFilters.dataFim || undefined,
        nome: appliedFilters.nome || undefined,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
  })

  function updatePending(field: keyof typeof pendingFilters, value: string) {
    setPendingFilters((prev) => ({ ...prev, [field]: value }))
  }

  function applyFilters() {
    setAppliedFilters({
      dataInicio: pendingFilters.dataInicio,
      dataFim: pendingFilters.dataFim,
      nome: pendingFilters.nome.trim(),
      page: 1,
    })
  }

  function handleExport() {
    window.open(
      helperEvaluationService.getExportUrl({
        dataInicio: appliedFilters.dataInicio || undefined,
        dataFim: appliedFilters.dataFim || undefined,
        nome: appliedFilters.nome || undefined,
      }),
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div className="page-shell">
      <h1 className="page-heading">Avaliacao de ajudantes</h1>

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
            <label className="field-label">Ate</label>
            <input
              type="date"
              value={pendingFilters.dataFim}
              onChange={(e) => updatePending('dataFim', e.target.value)}
              className="field-input w-36"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="field-label">Nome</label>
            <input
              type="text"
              value={pendingFilters.nome}
              onChange={(e) => updatePending('nome', e.target.value)}
              placeholder="Ajudante ou operador"
              className="field-input w-64"
            />
          </div>

          <button
            type="button"
            onClick={applyFilters}
            className="btn"
            style={{ backgroundColor: '#e53e3e', color: '#fff', alignSelf: 'flex-end' }}
          >
            Filtrar
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="btn"
            style={{ backgroundColor: '#2d3748', color: '#fff', alignSelf: 'flex-end' }}
          >
            Exportar Excel
          </button>
        </div>
      </section>

      {avaliacoesQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando avaliacoes" description="" />
      ) : null}

      {avaliacoesQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar as avaliacoes"
          description={extractApiErrorMessage(avaliacoesQuery.error)}
        />
      ) : null}

      {avaliacoesQuery.data ? (
        <>
          <p className="records-counter">{avaliacoesQuery.data.total} registros encontrados</p>

          <section className="app-panel table-shell">
            <div className="table-scroll">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome</th>
                    <th>Nota</th>
                    <th>Operador</th>
                    <th>N da Obra</th>
                    <th>Cliente</th>
                    <th>Equipamento</th>
                    <th>Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {avaliacoesQuery.data.items.length ? (
                    avaliacoesQuery.data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.diaryDate ? formatDate(item.diaryDate) : '-'}</td>
                        <td className="font-semibold text-slate-700">{item.helperName || '-'}</td>
                        <td>
                          <span
                            className="inline-flex min-w-[44px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold"
                            style={{
                              backgroundColor: item.score >= 8 ? '#dcfce7' : item.score >= 6 ? '#fef3c7' : '#fee2e2',
                              color: item.score >= 8 ? '#166534' : item.score >= 6 ? '#92400e' : '#b91c1c',
                            }}
                          >
                            {item.score}
                          </span>
                        </td>
                        <td>{item.operatorName || '-'}</td>
                        <td>{item.obraNumero || '-'}</td>
                        <td>{item.cliente || '-'}</td>
                        <td>{item.equipamento || '-'}</td>
                        <td>{item.createdAt ? formatDateTime(item.createdAt) : '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-slate-400">
                        Nenhuma avaliacao encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <PaginationControls
            page={avaliacoesQuery.data.page}
            limit={avaliacoesQuery.data.limit}
            total={avaliacoesQuery.data.total}
            onPageChange={(page) => setAppliedFilters((prev) => ({ ...prev, page }))}
          />
        </>
      ) : null}
    </div>
  )
}
