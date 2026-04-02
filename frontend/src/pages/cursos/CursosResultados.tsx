import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, BarChart2, BookOpen, CheckCircle, CircleDashed, FileText, Grid2x2, List, Search, XCircle } from 'lucide-react'
import { cursosApi, type ResultadoMatriz, type TentativaRecord } from '@/lib/gontijo-api'

function StatusBadge({ aprovado }: { aprovado: number }) {
  return aprovado ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
      <CheckCircle size={11} /> Aprovado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
      <XCircle size={11} /> Reprovado
    </span>
  )
}

function MatrixCell({ cell }: { cell: ResultadoMatriz['rows'][number]['cells'][number] }) {
  if (!cell.assigned) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-2 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500">
          <CircleDashed size={11} />
          Nao atribuido
        </div>
        <div className="mt-1 text-[10px] text-slate-400">Sem liberacao</div>
      </div>
    )
  }

  if (cell.status === 'somente_curso') {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-2 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-blue-700">
          <BookOpen size={11} />
          Curso
        </div>
        <div className="mt-1 text-[10px] text-blue-600">Sem prova</div>
      </div>
    )
  }

  if (cell.status === 'pendente') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-2 py-2.5 text-center shadow-sm">
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-red-600">
          <AlertCircle size={11} />
          Prova pendente
        </div>
        <div className="mt-1 text-[10px] text-red-500">Nenhuma tentativa</div>
      </div>
    )
  }

  if (cell.status === 'aprovado') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-2 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-green-700">
          <CheckCircle size={11} />
          Aprovado
        </div>
        <div className="text-[10px] text-green-600">{Number(cell.melhor_percentual ?? 0).toFixed(0)}%</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-amber-700">
        <FileText size={11} />
        Refazer
      </div>
      <div className="text-[10px] text-amber-600">{Number(cell.melhor_percentual ?? 0).toFixed(0)}%</div>
    </div>
  )
}

export default function CursosResultadosPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'lista' | 'matriz'>('matriz')

  const { data: listaData, isLoading: listaLoading } = useQuery({
    queryKey: ['resultados', page],
    queryFn: () => cursosApi.getResultados({ page, limit: 30 }),
    enabled: view === 'lista',
  })

  const { data: matrizData, isLoading: matrizLoading } = useQuery({
    queryKey: ['resultados-matriz', page, search],
    queryFn: () => cursosApi.getResultadosMatriz({ page, limit: 20, busca: search }),
    enabled: view === 'matriz',
  })

  const items = useMemo(() => {
    const base = listaData?.items ?? []
    if (!search.trim()) return base
    const q = search.toLowerCase()
    return base.filter((r) =>
      r.usuario_nome?.toLowerCase().includes(q) ||
      r.curso_titulo?.toLowerCase().includes(q) ||
      r.prova_titulo?.toLowerCase().includes(q)
    )
  }, [listaData?.items, search])

  const totalLista = listaData?.total ?? 0
  const totalListaPages = Math.max(1, Math.ceil(totalLista / 30))
  const totalMatriz = matrizData?.total ?? 0
  const matrixLimit = matrizData?.limit ?? 20
  const matrixColumns = matrizData?.columns ?? []
  const totalMatrizPages = Math.max(1, Math.ceil(totalMatriz / matrixLimit))
  const matrixStats = useMemo(() => {
    const rows = matrizData?.rows ?? []
    let pendentes = 0
    let aprovados = 0
    let refazer = 0
    let cursos = 0

    rows.forEach((row) => {
      row.cells.forEach((cell) => {
        if (cell.status === 'pendente') pendentes += 1
        else if (cell.status === 'aprovado') aprovados += 1
        else if (cell.status === 'reprovado') refazer += 1
        else if (cell.status === 'somente_curso') cursos += 1
      })
    })

    return { pendentes, aprovados, refazer, cursos }
  }, [matrizData?.rows])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cursos')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <BarChart2 size={20} className="text-[var(--brand-red)]" />
            Resultados
          </h1>
          <p className="text-sm text-slate-500">Lista detalhada e matriz leve por colaborador x curso.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={view === 'matriz' ? 'Buscar colaborador, apelido ou CPF...' : 'Buscar por colaborador ou curso...'}
            className="app-input w-full pl-9 text-sm"
          />
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => { setView('matriz'); setPage(1) }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'matriz' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            <Grid2x2 size={14} />
            Matriz
          </button>
          <button
            onClick={() => { setView('lista'); setPage(1) }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'lista' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
          >
            <List size={14} />
            Lista
          </button>
        </div>
      </div>

      {view === 'matriz' ? (
        <div className="app-panel overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-slate-500">
                A matriz carrega colaboradores paginados e consolida tentativas no backend para evitar travar o navegador.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-600">
                  <AlertCircle size={11} />
                  {matrixStats.pendentes} pendentes
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  <FileText size={11} />
                  {matrixStats.refazer} refazer
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 font-semibold text-green-700">
                  <CheckCircle size={11} />
                  {matrixStats.aprovados} aprovados
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                  <BookOpen size={11} />
                  {matrixStats.cursos} so conteudo
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
                <CircleDashed size={11} />
                Nao atribuido
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-red-600">
                <AlertCircle size={11} />
                Prova ainda nao realizada
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                <FileText size={11} />
                Ja realizou e precisa refazer
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Colaborador</th>
                  {matrixColumns.map((column) => (
                    <th key={column.curso_id} className="min-w-[150px] px-3 py-3 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <div className="text-slate-700">{column.curso_titulo}</div>
                      <div className="mt-1 text-[10px] font-medium normal-case tracking-normal text-slate-400">
                        {column.prova_titulo || 'Sem prova'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrizLoading ? (
                  <tr><td colSpan={matrixColumns.length + 1} className="py-12 text-center text-sm text-slate-400">Carregando matriz...</td></tr>
                ) : !matrizData || matrizData.rows.length === 0 ? (
                  <tr><td colSpan={matrixColumns.length + 1} className="py-12 text-center text-sm text-slate-400">Nenhum colaborador encontrado.</td></tr>
                ) : (
                  matrizData.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 align-top">
                        <div className="font-medium text-slate-800">{row.nome}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.apelido || row.documento}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-slate-400">{row.setor_nome || 'Sem setor'}</span>
                          {row.cells.some((cell) => cell.status === 'pendente') && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              Prova pendente
                            </span>
                          )}
                        </div>
                      </td>
                      {row.cells.map((cell) => (
                        <td key={`${row.id}-${cell.curso_id}`} className="px-3 py-3 align-top">
                          <MatrixCell cell={cell} />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-400">{totalMatriz} colaboradores</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Anterior</button>
              <span className="px-2 py-1 text-xs text-slate-500">{page}/{totalMatrizPages}</span>
              <button disabled={page >= totalMatrizPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Proxima</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="app-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Colaborador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Curso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Prova</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acertos</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">%</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">Carregando...</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">Nenhum resultado encontrado.</td></tr>
                ) : (
                  items.map((r: TentativaRecord) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.usuario_nome}</td>
                      <td className="px-4 py-3 text-slate-600">{r.curso_titulo}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{r.prova_titulo}</td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.acertos}/{r.total_questoes}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${Number(r.percentual) >= (r.percentual_aprovacao ?? 70) ? 'text-green-600' : 'text-red-500'}`}>
                          {Number(r.percentual).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center"><StatusBadge aprovado={r.aprovado} /></td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(r.realizado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-400">{totalLista} resultados</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Anterior</button>
              <span className="px-2 py-1 text-xs text-slate-500">{page}/{totalListaPages}</span>
              <button disabled={page >= totalListaPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Proxima</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
