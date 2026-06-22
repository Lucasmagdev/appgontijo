#!/usr/bin/env node
/*
 * Geocodifica as sondagens (crm_sondagens) para o mapa.
 *
 * - Adiciona colunas lat/lng/geo_query/geo_em se faltarem.
 * - Geocodifica por cidade+estado (nivel cidade) via OpenStreetMap Nominatim.
 *   Cidade e o nivel mais confiavel; o endereco da obra costuma ser baguncado.
 * - Dedupe: cada cidade so consulta o Nominatim uma vez (cache em disco).
 * - Jitter deterministico por card_id pra alfinetes da mesma cidade nao
 *   ficarem exatamente sobrepostos.
 *
 * Politica Nominatim: 1 req/seg + User-Agent. Respeitado abaixo.
 *
 * Uso: node scripts/geocode-sondagens.js [--limit=N]
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const db = require('../lib/db')

const args = process.argv.slice(2)
const valOf = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : null }
const LIMIT = valOf('limit') ? Number(valOf('limit')) : Infinity

const CACHE_PATH = path.join(__dirname, '..', 'data', 'geocode-cache.json')
const UA = 'AppGontijo-Sondagens/1.0 (contato@gontijofundacoes.com.br)'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) } catch { return {} }
}
function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2))
}

// offset pequeno e deterministico (~ ate 2km) a partir do card_id
function jitter(cardId) {
  let h = 0
  for (const ch of String(cardId)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const dx = ((h % 1000) / 1000 - 0.5) * 0.03
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03
  return { dx, dy }
}

async function geocodeCity(cidade, estado) {
  const q = [cidade, estado, 'Brasil'].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
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
  if (adds.length) {
    await db.query(`ALTER TABLE crm_sondagens ${adds.join(', ')}`)
    console.log(`colunas adicionadas: ${adds.length}`)
  }
}

async function main() {
  await ensureColumns()
  const cache = loadCache()

  // cidades distintas que ainda tem alguma linha sem lat
  const [cities] = await db.query(
    `SELECT cidade, estado, COUNT(*) n
     FROM crm_sondagens
     WHERE (lat IS NULL OR lng IS NULL) AND cidade IS NOT NULL AND cidade <> ''
     GROUP BY cidade, estado
     ORDER BY n DESC`
  )
  console.log(`${cities.length} cidades a geocodificar`)

  let done = 0
  for (const row of cities) {
    if (done >= LIMIT) break
    const key = `${(row.cidade || '').trim().toLowerCase()}|${(row.estado || '').trim().toLowerCase()}`
    let coord = cache[key]
    if (coord === undefined) {
      try {
        coord = await geocodeCity(row.cidade, row.estado)
      } catch (e) {
        console.warn(`falha ${row.cidade}/${row.estado}: ${e.message}`)
        coord = null
      }
      cache[key] = coord
      saveCache(cache)
      await sleep(1100) // politica Nominatim
    }
    if (!coord) { console.log(`sem coord: ${row.cidade}/${row.estado}`); continue }

    // aplica a todas as linhas dessa cidade (com jitter por card)
    const [pending] = await db.query(
      `SELECT id, card_id FROM crm_sondagens
       WHERE cidade = ? AND (estado <=> ?) AND (lat IS NULL OR lng IS NULL)`,
      [row.cidade, row.estado]
    )
    for (const p of pending) {
      const { dx, dy } = jitter(p.card_id)
      await db.query(
        'UPDATE crm_sondagens SET lat = ?, lng = ?, geo_query = ?, geo_em = NOW() WHERE id = ?',
        [coord.lat + dy, coord.lng + dx, `${row.cidade}, ${row.estado}`, p.id]
      )
    }
    done += 1
    process.stdout.write(`\r${done}/${cities.length} cidades  (${row.cidade}/${row.estado}: ${pending.length} linhas)        `)
  }

  const [[stats]] = await db.query(
    'SELECT COUNT(*) total, SUM(lat IS NOT NULL) com_geo FROM crm_sondagens'
  )
  console.log(`\nOK. ${stats.com_geo}/${stats.total} linhas com coordenada.`)
  await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
