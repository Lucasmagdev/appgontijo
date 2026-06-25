#!/usr/bin/env node
/*
 * Upgrade de precisao via Google Geocoding API.
 *
 * Pega as obras que ficaram no nivel CIDADE mas TEM endereco (geo_precisao='cidade'
 * e endereco_obra preenchido) e tenta resolver o endereco no Google, que e bem
 * melhor que o Nominatim pra endereco BR bagunçado.
 *
 * Aceita o resultado so se:
 *   - location_type for preciso (ROOFTOP / RANGE_INTERPOLATED / GEOMETRIC_CENTER),
 *     descartando APPROXIMATE (que costuma ser centroide de cidade/bairro);
 *   - cair a ate ~60km do centro da cidade (anti-erro grosso).
 * Aprovado -> vira 'endereco' (pin exato, sem jitter).
 *
 * Cache em disco (data/geocode-cache-google.json) pra nao repetir request.
 * Custo: ~US$5/1000. Use --limit=N pra testar antes de rodar tudo.
 *
 * Uso: GOOGLE_MAPS_API_KEY=... node scripts/geocode-google-upgrade.js [--limit=N]
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const db = require('../lib/db')

const args = process.argv.slice(2)
const valOf = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const LIMIT = valOf('limit') ? Number(valOf('limit')) : Infinity

const KEY = process.env.GOOGLE_MAPS_API_KEY
const CACHE_GOOGLE = path.join(__dirname, '..', 'data', 'geocode-cache-google.json')
const CACHE_CITY = path.join(__dirname, '..', 'data', 'geocode-cache.json')
const MAX_DIST_KM = 60
const PRECISOS = new Set(['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadCache(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} } }
function saveCache(p, c) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(c, null, 2)) }

function distKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const limpa = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// retorna { lat, lng, type } ou null; lanca em erro fatal de chave
async function googleGeocode(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?region=br&language=pt-BR&address=${encodeURIComponent(query)}&key=${KEY}`
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.results.length) {
      const r = data.results[0]
      return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, type: r.geometry.location_type }
    }
    if (data.status === 'ZERO_RESULTS') return null
    if (data.status === 'OVER_QUERY_LIMIT') { await sleep(2000 * (tentativa + 1)); continue }
    if (data.status === 'REQUEST_DENIED' || data.status === 'INVALID_REQUEST') {
      throw new Error(`Google ${data.status}: ${data.error_message || ''}`)
    }
    return null
  }
  return null
}

async function main() {
  if (!KEY) { console.error('Falta GOOGLE_MAPS_API_KEY no .env'); process.exit(2) }
  const cache = loadCache(CACHE_GOOGLE)
  const cityCache = loadCache(CACHE_CITY)
  const cityCoord = (cidade, estado) => cityCache[`${(cidade || '').trim().toLowerCase()}|${(estado || '').trim().toLowerCase()}`] || null

  const [rows] = await db.query(
    `SELECT id, card_id, endereco_obra, cidade, estado
       FROM crm_sondagens
      WHERE geo_precisao = 'cidade' AND endereco_obra IS NOT NULL AND TRIM(endereco_obra) <> ''
      ORDER BY cidade, estado`
  )
  console.log(`${rows.length} obras nivel cidade com endereco a tentar no Google`)

  let feitos = 0, promovidos = 0, semResultado = 0, longe = 0, impreciso = 0
  for (const row of rows) {
    if (feitos >= LIMIT) break
    const end = limpa(row.endereco_obra)
    const q = [end, row.cidade, row.estado, 'Brasil'].filter(Boolean).join(', ')
    const ckey = q.toLowerCase()

    let g = cache[ckey]
    if (g === undefined) {
      g = await googleGeocode(q)
      cache[ckey] = g
      saveCache(CACHE_GOOGLE, cache)
      await sleep(60)
    }
    feitos += 1

    if (!g) { semResultado += 1 }
    else if (!PRECISOS.has(g.type)) { impreciso += 1 }
    else {
      const cc = cityCoord(row.cidade, row.estado)
      if (cc && distKm(g, cc) > MAX_DIST_KM) { longe += 1 }
      else {
        await db.query(
          "UPDATE crm_sondagens SET lat = ?, lng = ?, geo_query = ?, geo_precisao = 'endereco', geo_em = NOW() WHERE id = ?",
          [g.lat, g.lng, `${end} [google:${g.type}]`, row.id]
        )
        promovidos += 1
      }
    }
    process.stdout.write(`\r${feitos}/${rows.length}  promovidos:${promovidos} semRes:${semResultado} impreciso:${impreciso} longe:${longe}   `)
  }

  const [[s]] = await db.query(
    "SELECT SUM(geo_precisao='endereco') exato, SUM(geo_precisao='cidade') cidade FROM crm_sondagens"
  )
  console.log(`\nOK. promovidos agora:${promovidos}. Total exato:${s.exato} cidade:${s.cidade}.`)
  await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
