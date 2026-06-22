import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import QueryFeedback from '@/components/ui/QueryFeedback'
import { extractApiErrorMessage, sondagemService, type SondagemPonto } from '@/lib/gontijo-api'

// alfinete (pin) SVG colorido por fase — evita o icone padrao quebrado do leaflet
const iconCache = new Map<string, L.DivIcon>()
function pinIcon(cor: string): L.DivIcon {
  const existing = iconCache.get(cor)
  if (existing) return existing
  const icon = L.divIcon({
    className: 'sondagem-pin',
    html: `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 25 13 25s13-15.75 13-25C26 5.82 20.18 0 13 0z"
        fill="${cor}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff" fill-opacity="0.9"/>
    </svg>`,
    iconSize: [26, 38],
    iconAnchor: [13, 38],
    popupAnchor: [0, -34],
  })
  iconCache.set(cor, icon)
  return icon
}

const BRASIL_CENTER: [number, number] = [-15.78, -47.93]

export default function SondagensMapaPage() {
  const mapaQuery = useQuery({
    queryKey: ['sondagens-mapa'],
    queryFn: () => sondagemService.mapa(),
    staleTime: 1000 * 60 * 15,
  })

  const pontos = useMemo<SondagemPonto[]>(() => mapaQuery.data ?? [], [mapaQuery.data])

  // legenda: fase -> cor (distintas, na ordem de aparicao)
  const legenda = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pontos) {
      const fase = p.fase || 'Sem fase'
      if (!map.has(fase)) map.set(fase, p.cor)
    }
    return Array.from(map.entries())
  }, [pontos])

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">Mapa de Sondagens</h1>
          <p className="page-subtitle">Obras com sondagem/arquivos. Cor do alfinete = fase no funil (Pipefy).</p>
        </div>
        <Link to="/sondagens" className="btn btn-secondary">
          <ArrowLeft size={15} />
          Lista
        </Link>
      </div>

      {mapaQuery.isLoading ? (
        <QueryFeedback type="loading" title="Carregando mapa" description="Buscando coordenadas das obras." />
      ) : null}

      {mapaQuery.isError ? (
        <QueryFeedback
          type="error"
          title="Nao foi possivel carregar o mapa"
          description={extractApiErrorMessage(mapaQuery.error)}
        />
      ) : null}

      {mapaQuery.data ? (
        <>
          <p className="records-counter">{pontos.length} obras no mapa</p>

          <section className="app-panel overflow-hidden p-0">
            <div className="h-[68vh] w-full">
              <MapContainer center={BRASIL_CENTER} zoom={4} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {pontos.map((p) => (
                  <Marker key={p.card_id} position={[p.lat, p.lng]} icon={pinIcon(p.cor)}>
                    <Popup>
                      <div className="text-[13px] leading-relaxed">
                        <strong>{p.cliente || 'Sem cliente'}</strong>
                        {p.endereco_obra ? <div className="text-slate-500">{p.endereco_obra}</div> : null}
                        <div className="text-slate-500">{[p.cidade, p.estado].filter(Boolean).join(' - ')}</div>
                        <div className="mt-1">
                          <span
                            className="mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
                            style={{ backgroundColor: p.cor }}
                          />
                          {p.fase || 'Sem fase'}
                        </div>
                        <div className="mt-1 text-slate-500">{p.arquivos} arquivo{p.arquivos === 1 ? '' : 's'}</div>
                        <Link
                          to={`/sondagens?q=${encodeURIComponent(p.cliente || p.cidade || '')}`}
                          className="mt-1 inline-block font-medium text-[var(--brand-red)]"
                        >
                          Ver arquivos →
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </section>

          {legenda.length ? (
            <section className="app-panel mt-3 p-4">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-700">Fases</h2>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {legenda.map(([fase, cor]) => (
                  <span key={fase} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cor }} />
                    {fase}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
