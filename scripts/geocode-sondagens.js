#!/usr/bin/env node
/*
 * Geocodifica as sondagens (crm_sondagens) para o mapa — NIVEL ENDERECO.
 *
 * Estrategia:
 *  1. Tenta geocodificar o endereco completo (endereco_obra + cidade + estado).
 *  2. Valida: o resultado precisa cair a ate ~60km do centro da cidade
 *     (pega erro grosso do Nominatim quando o endereco e ambiguo). Se passar,
 *     usa a coordenada exata, sem jitter -> pin no local real.
 *  3. Se o endereco falhar ou for rejeitado, cai pro nivel cidade
 *     (centro da cidade + jitter deterministico) como antes.
 *
 * Colunas: lat/lng/geo_query/geo_em/geo_precisao ('endereco' | 'cidade').
 * Cache em disco por endereco e por cidade (dedupe, 1 req/seg Nominatim).
 *
 * Por padrao reprocessa quem ainda nao esta no nivel 'endereco'
 * (geo_precisao NULL ou 'cidade'). Use --all pra reprocessar tudo,
 * --limit=N pra testar.
 *
 * Uso: node scripts/geocode-sondagens.js [--limit=N] [--all]
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const db = require('../lib/db')

const args = process.argv.slice(2)
const has = (n) => args.includes(`--${n}`)
const valOf = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const LIMIT = valOf('limit') ? Number(valOf('limit')) : Infinity
const ALL = has('all')

const CACHE_ADDR = path.join(__dirname, '..', 'data', 'geocode-cache-endereco.json')
const CACHE_CITY = path.join(__dirname, '..', 'data', 'geocode-cache.json')
const UA = 'AppGontijo-Sondagens/1.0 (contato@gontijofundacoes.com.br)'
const MAX_DIST_KM = 60 // tolerancia entre endereco e centro da cidade
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadCache(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return {} } }
function saveCache(p, cache) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cache, null, 2))
}

// offset pequeno e deterministico (~ ate 2km) a partir do card_id (so no fallback cidade)
function jitter(cardId) {
  let h = 0
  for (const ch of String(cardId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const dx = ((h % 1000) / 1000 - 0.5) * 0.03
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03
  return { dx, dy }
}

// distancia haversine em km
function distKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// limpa o texto do endereco: tira quebras de linha, espacos duplos
function limpaEndereco(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' } })
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`)
  const data = await res.json()
  if (!data.length) return null
  return { lat: Number(data[0].lat), lng: Number(data[0].lon) }
}

async function ensureColumns() {
  const [cols] = await db.query('SHOW COLUMNS FROM crm_sondagens')
  const names = cols.map((c) => c.Field)
  const adds = []
  if (!names.includes('lat')) adds.push('ADD COLUMN lat DECIMAL(10,7) NULL')
  if (!names.includes('lng')) adds.push('ADD COLUMN lng DECIMAL(10,7) NULL')
  if (!names.includes('geo_query')) adds.push('ADD COLUMN geo_query VARCHAR(255) NULL')
  if (!names.includes('geo_em')) adds.push('ADD COLUMN geo_em DATETIME NULL')
  if (!names.includes('geo_precisao')) adds.push("ADD COLUMN geo_precisao VARCHAR(20) NULL")
  if (adds.length) {
    await db.query(`ALTER TABLE crm_sondagens ${adds.join(', ')}`)
    console.log(`colunas adicionadas: ${adds.length}`)
  }
}

async function main() {
  await ensureColumns()
  const cacheAddr = loadCache(CACHE_ADDR)
  const cacheCity = loadCache(CACHE_CITY)

  // resolve coord da cidade (cache) — usado p/ validar e como fallback
  async function cidadeCoord(cidade, estado) {
    const key = `${(cidade || '').trim().toLowerCase()}|${(estado || '').trim().toLowerCase()}`
    if (cacheCity[key] !== undefined) return cacheCity[key]
    let coord = null
    try {
      coord = await nominatim([cidade, estado, 'Brasil'].filter(Boolean).join(', '))
    } catch (e) { console.warn(`  cidade falhou ${cidade}/${estado}: ${e.message}`) }
    cacheCity[key] = coord
    saveCache(CACHE_CITY, cacheCity)
    await sleep(1100)
    return coord
  }

  const where = ALL
    ? '1=1'
    : "(geo_precisao IS NULL OR geo_precisao <> 'endereco')"
  const [rows] = await db.query(
    `SELECT id, card_id, endereco_obra, cidade, estado
       FROM crm_sondagens
      WHERE ${where} AND cidade IS NOT NULL AND cidade <> ''
      ORDER BY cidade, estado`
  )
  console.log(`${rows.length} obras a geocodificar (${ALL ? 'todas' : 'pendentes'})`)

  let done = 0, exato = 0, cidade = 0, semCoord = 0
  for (const row of rows) {
    if (done >= LIMIT) break
    const cCoord = await cidadeCoord(row.cidade, row.estado)

    let coord = null, precisao = null, query = null
    const end = limpaEndereco(row.endereco_obra)

    if (end) {
      const q = [end, row.cidade, row.estado, 'Brasil'].filter(Boolean).join(', ')
      const ckey = q.toLowerCase()
      let addr = cacheAddr[ckey]
      if (addr === undefined) {
        try { addr = await nominatim(q) } catch (e) { console.warn(`  end falhou: ${e.message}`); addr = null }
        cacheAddr[ckey] = addr
        saveCache(CACHE_ADDR, cacheAddr)
        await sleep(1100)
      }
      // aceita o endereco so se cair perto do centro da cidade (anti-erro grosso)
      if (addr && (!cCoord || distKm(addr, cCoord) <= MAX_DIST_KM)) {
        coord = addr; precisao = 'endereco'; query = q
      }
    }

    // fallback: centro da cidade + jitter
    if (!coord && cCoord) {
      const { dx, dy } = jitter(row.card_id)
      coord = { lat: cCoord.lat + dy, lng: cCoord.lng + dx }
      precisao = 'cidade'; query = `${row.cidade}, ${row.estado}`
    }

    if (!coord) { semCoord++; continue }

    await db.query(
      'UPDATE crm_sondagens SET lat = ?, lng = ?, geo_query = ?, geo_precisao = ?, geo_em = NOW() WHERE id = ?',
      [coord.lat, coord.lng, query, precisao, row.id]
    )
    done++
    if (precisao === 'endereco') exato++; else cidade++
    process.stdout.write(`\r${done}/${rows.length}  exato:${exato} cidade:${cidade} sem:${semCoord}   `)
  }

  const [[stats]] = await db.query(
    "SELECT COUNT(*) total, SUM(geo_precisao='endereco') exato, SUM(geo_precisao='cidade') cidade FROM crm_sondagens"
  )
  console.log(`\nOK. exato:${stats.exato} cidade:${stats.cidade} de ${stats.total}.`)
  await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
