import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, FileText, Map, MapPin, Search, User } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { extractApiErrorMessage, sondagemService } from '@/lib/gontijo-api'

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export default function SondagensPage() {
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const debouncedSearch = useDebouncedValue(search)

  const sondagensQuery = useQuery({
    queryKey: ['sondagens', { q: debouncedSearch }],
    queryFn: () => sondagemService.list({ q: debouncedSearch || undefined, limit: 200 }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 15,
  })

  const cards = sondagensQuery.data ?? []

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Sondagens</h1>
          <p className="page-subtitle">Relatorios e anexos de sondagem importados do CRM (Pipefy).</p>
        </div>

        <Link to="/sondagens/mapa" className="btn btn-primary">
          <Map size={15} />
          Ver no mapa
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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, obra, cidade ou contato"
                className="field-input field-input-with-icon"
              />
            </div>
          </div>
        </div>
      </section>

      {sondagensQuery.isLoading ? (
        <QueryFeedback
          type="loading"
          title="Carregando sondagens"
          description="Buscando os registros no banco principal."
        />
      ) : null}

      {sondagensQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar as sondagens"
          description={extractApiErrorMessage(sondagensQuery.error)}
        />
      ) : null}

      {sondagensQuery.data ? (
        <>
          <p className="records-counter">{cards.length} obras encontradas</p>

          {cards.length ? (
            <div className="flex flex-col gap-3">
              {cards.map((card) => (
                <section key={card.card_id} className="app-panel p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-[15px] font-semibold text-slate-800">
                        {card.cliente || card.card_title || 'Sem cliente'}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                        {card.endereco_obra ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={12} /> {card.endereco_obra}
                          </span>
                        ) : null}
                        {card.cidade || card.estado ? (
                          <span>{[card.cidade, card.estado].filter(Boolean).join(' - ')}</span>
                        ) : null}
                        {card.contato ? (
                          <span className="inline-flex items-center gap-1">
                            <User size={12} /> {card.contato}
                          </span>
                        ) : null}
                        {card.servico ? <span>{card.servico}</span> : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                      {card.arquivos.length} arquivo{card.arquivos.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
                    {card.arquivos.map((arquivo) => (
                      <div key={arquivo.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText size={15} className="shrink-0 text-slate-400" />
                          <span className="truncate text-[13px] text-slate-700" title={arquivo.nome_original}>
                            {arquivo.nome_original}
                          </span>
                          <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(arquivo.tamanho)}</span>
                        </div>
                        <a
                          href={sondagemService.downloadUrl(arquivo.id)}
                          className="btn btn-secondary btn-icon"
                          title="Baixar arquivo"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <QueryFeedback
              type="empty"
              title="Nenhuma sondagem encontrada"
              description="Ajuste a busca ou rode o sync do Pipefy."
            />
          )}
        </>
      ) : null}
    </div>
  )
}
