import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Maximize, Minimize, Navigation, Search, SlidersHorizontal, X } from 'lucide-react'
import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
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

// pin do local buscado (azul, com anel pulsante)
const destinoIcon = L.divIcon({
  className: 'sondagem-destino',
  html: `<div style="position:relative;width:30px;height:42px">
    <svg width="30" height="42" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 25 13 25s13-15.75 13-25C26 5.82 20.18 0 13 0z"
        fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="13" cy="13" r="5" fill="#ffffff"/>
    </svg>
  </div>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -38],
})

const BRASIL_CENTER: [number, number] = [-15.78, -47.93]

// basemap unico — satelite (Esri, gratis, sem chave)
const SATELLITE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: 'Tiles &copy; Esri',
}

type Sugestao = { label: string; lat: number; lon: number }

// monta um rotulo legivel a partir das propriedades do Photon
function labelPhoton(p: Record<string, string>): string {
  const linha1 = [p.name || p.street, p.housenumber].filter(Boolean).join(', ')
  const linha2 = [p.district || p.city || p.county, p.state].filter(Boolean).join(' - ')
  return [linha1, linha2].filter(Boolean).join(', ') || p.name || 'Local'
}

// captura a instancia do mapa para uso fora do MapContainer
function CaptureMap({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  return null
}

// recalcula o tamanho do mapa quando o container muda (ex: tela cheia)
function InvalidateOnResize({ trigger }: { trigger: unknown }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150)
    return () => clearTimeout(t)
  }, [trigger, map])
  return null
}

// reajusta o zoom para o conjunto filtrado (so quando o filtro muda)
function FitBounds({ pontos }: { pontos: SondagemPonto[] }) {
  const map = useMap()
  useEffect(() => {
    if (!pontos.length) return
    const bounds = L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
  }, [pontos, map])
  return null
}

export default function SondagensMapaPage() {
  const mapaQuery = useQuery({
    queryKey: ['sondagens-mapa'],
    queryFn: () => sondagemService.mapa(),
    staleTime: 1000 * 60 * 15,
  })

  const pontos = useMemo<SondagemPonto[]>(() => mapaQuery.data ?? [], [mapaQuery.data])

  // ---- filtros dos pins (fase / estado) ----
  const [fasesAtivas, setFasesAtivas] = useState<Set<string>>(new Set())
  const [estado, setEstado] = useState('')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false) // drawer mobile
  const [fullscreen, setFullscreen] = useState(false)

  // ---- busca de endereco (so navega, nao filtra os pins) ----
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [destino, setDestino] = useState<Sugestao | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const buscaBoxRef = useRef<HTMLDivElement>(null)

  // autocomplete via Photon (OSM, gratis, sem chave); priorizado pro Brasil
  useEffect(() => {
    const q = busca.trim()
    if (q.length < 3) { setSugestoes([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setBuscando(true)
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&bbox=-74,-34,-34,6`
        const res = await fetch(url, { signal: ctrl.signal })
        const data = await res.json()
        const items: Sugestao[] = (data.features ?? []).map((f: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }) => ({
          label: labelPhoton(f.properties),
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
        }))
        setSugestoes(items)
        setMostrarSugestoes(true)
      } catch { /* abortado/erro: ignora */ } finally {
        setBuscando(false)
      }
    }, 300)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [busca])

  // fecha o dropdown ao clicar fora
  useEffect(() => {
    if (!mostrarSugestoes) return
    const handler = (ev: MouseEvent) => {
      if (buscaBoxRef.current && !buscaBoxRef.current.contains(ev.target as Node)) setMostrarSugestoes(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mostrarSugestoes])

  // vai para o local escolhido (sem filtrar os pins)
  const irPara = (s: Sugestao) => {
    setDestino(s)
    setBusca(s.label)
    setSugestoes([])
    setMostrarSugestoes(false)
    mapRef.current?.flyTo([s.lat, s.lon], 15, { duration: 1.2 })
  }

  // Enter / botao "Ir": usa a 1a sugestao
  const irPrimeira = () => {
    if (sugestoes.length) irPara(sugestoes[0])
  }

  const limparBusca = () => {
    setBusca('')
    setSugestoes([])
    setDestino(null)
    setMostrarSugestoes(false)
  }

  // legenda: fase -> cor (distintas, na ordem de aparicao)
  const legenda = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of pontos) {
      const fase = p.fase || 'Sem fase'
      if (!map.has(fase)) map.set(fase, p.cor)
    }
    return Array.from(map.entries())
  }, [pontos])

  // estados distintos pro dropdown
  const estados = useMemo(() => {
    const set = new Set<string>()
    for (const p of pontos) if (p.estado) set.add(p.estado)
    return Array.from(set).sort()
  }, [pontos])

  // filtros dos pins (so fase + estado; a busca NAO filtra)
  const filtrados = useMemo(() => {
    return pontos.filter((p) => {
      if (estado && p.estado !== estado) return false
      if (fasesAtivas.size && !fasesAtivas.has(p.fase || 'Sem fase')) return false
      return true
    })
  }, [pontos, estado, fasesAtivas])

  // markers memoizados: so reconstroi quando o conjunto filtrado muda
  const markersEls = useMemo(
    () =>
      filtrados.map((p, i) => (
        <Marker key={`${p.card_id}-${i}`} position={[p.lat, p.lng]} icon={pinIcon(p.cor)}>
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
                to={`/sondagens/arquivos?q=${encodeURIComponent(p.cliente || p.cidade || '')}`}
                className="mt-1 inline-block font-medium text-[var(--brand-red)]"
              >
                Ver arquivos →
              </Link>
            </div>
          </Popup>
        </Marker>
      )),
    [filtrados],
  )

  const toggleFase = (fase: string) => {
    setFasesAtivas((prev) => {
      const next = new Set(prev)
      if (next.has(fase)) next.delete(fase)
      else next.add(fase)
      return next
    })
  }

  const limparFiltros = () => {
    setFasesAtivas(new Set())
    setEstado('')
  }

  const temFiltro = Boolean(estado || fasesAtivas.size)

  return (
    <div className="page-shell">
      <div className="page-header flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-heading">Mapa de Sondagens</h1>
          <p className="page-subtitle">Obras com sondagem/arquivos. Cor do alfinete = fase no funil (Pipefy).</p>
        </div>
        <Link to="/sondagens/arquivos" className="btn btn-secondary">
          <ArrowLeft size={15} />
          Arquivos
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
          {/* ---- barra de busca + filtros ---- */}
          <section className="app-panel mb-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* busca de endereco com autocomplete (so navega) */}
              <div ref={buscaBoxRef} className="relative min-w-0 flex-1 sm:max-w-md">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="field-input field-input-with-icon pr-8"
                  value={busca}
                  onChange={(e) => { setBusca(e.target.value); setMostrarSugestoes(true) }}
                  onFocus={() => sugestoes.length && setMostrarSugestoes(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter') irPrimeira() }}
                  placeholder="Buscar endereço para ir no mapa…"
                  autoComplete="off"
                />
                {busca ? (
                  <button
                    type="button"
                    onClick={limparBusca}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                ) : null}

                {/* dropdown de sugestoes */}
                {mostrarSugestoes && (busca.trim().length >= 3) ? (
                  <ul className="absolute z-[1200] mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {buscando && !sugestoes.length ? (
                      <li className="px-3 py-2 text-sm text-slate-400">Buscando…</li>
                    ) : null}
                    {!buscando && !sugestoes.length ? (
                      <li className="px-3 py-2 text-sm text-slate-400">Nenhum endereço encontrado</li>
                    ) : null}
                    {sugestoes.map((s, i) => (
                      <li key={`${s.lat}-${s.lon}-${i}`}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                          onMouseDown={(ev) => { ev.preventDefault(); irPara(s) }}
                        >
                          <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                          <span>{s.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {/* ir para a 1a sugestao */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={irPrimeira}
                disabled={!sugestoes.length}
              >
                <Navigation size={15} />
                Ir
              </button>

              {/* toggle filtros (mobile) */}
              <button
                type="button"
                className="btn btn-secondary sm:hidden"
                onClick={() => setFiltrosAbertos((v) => !v)}
              >
                <SlidersHorizontal size={15} />
                Filtros{temFiltro ? ' •' : ''}
              </button>
            </div>

            {/* painel expandido — sempre visivel no desktop, drawer no mobile */}
            <div className={`${filtrosAbertos ? 'block' : 'hidden'} sm:block`}>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="field-select w-auto" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  <option value="">Todos os estados</option>
                  {estados.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>

                {temFiltro ? (
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    onClick={limparFiltros}
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>

              {/* chips de fase (multi-select) */}
              {legenda.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {legenda.map(([fase, cor]) => {
                    const ativo = fasesAtivas.has(fase)
                    return (
                      <button
                        key={fase}
                        type="button"
                        onClick={() => toggleFase(fase)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                          ativo
                            ? 'border-transparent text-white'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        style={ativo ? { backgroundColor: cor } : undefined}
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
                        {fase}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <p className="records-counter">
            {filtrados.length} de {pontos.length} obras{temFiltro ? ' (filtrado)' : ''}
          </p>

          {/* tela cheia via CSS (funciona em celular, sem Fullscreen API) */}
          <section className={fullscreen ? 'fixed inset-0 z-[2000] bg-black' : 'app-panel overflow-hidden p-0'}>
            <div className={`relative w-full bg-black ${fullscreen ? 'h-[100dvh]' : 'h-[60vh] sm:h-[68vh]'}`}>
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-md hover:bg-white"
                aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                {fullscreen ? 'Sair' : 'Tela cheia'}
              </button>
              <MapContainer
                center={BRASIL_CENTER}
                zoom={4}
                scrollWheelZoom
                preferCanvas
                className="h-full w-full"
              >
                <TileLayer attribution={SATELLITE.attribution} url={SATELLITE.url} />
                <CaptureMap mapRef={mapRef} />
                <FitBounds pontos={filtrados} />
                <InvalidateOnResize trigger={fullscreen} />
                {destino ? (
                  <Marker position={[destino.lat, destino.lon]} icon={destinoIcon}>
                    <Popup>
                      <div className="text-[13px]">
                        <strong>Local buscado</strong>
                        <div className="text-slate-500">{destino.label}</div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null}
                {/* clustering: so renderiza o visivel, aguenta 2k+ pontos; sem poligono azul no hover */}
                <MarkerClusterGroup chunkedLoading maxClusterRadius={50} showCoverageOnHover={false}>
                  {markersEls}
                </MarkerClusterGroup>
              </MapContainer>
            </div>
          </section>

          {/* legenda colapsavel */}
          {legenda.length && !fullscreen ? (
            <details className="app-panel mt-3 p-4" open>
              <summary className="cursor-pointer text-[13px] font-semibold text-slate-700">Fases</summary>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {legenda.map(([fase, cor]) => (
                  <span key={fase} className="inline-flex items-center gap-1.5 text-[12px] text-slate-600">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cor }} />
                    {fase}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
