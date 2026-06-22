#!/usr/bin/env node
/*
 * Sync de sondagens (e documentos) do Pipefy CRM Comercial -> app Gontijo.
 *
 * Baixa os anexos dos cards (campos do tipo "attachment") e grava os metadados
 * numa tabela `crm_sondagens`. Arquivos vao pro disco (uploads/sondagens/<card_id>/),
 * o banco guarda so o caminho -> banco fica leve.
 *
 * Idempotente: a chave UNIQUE (card_id, pipefy_path) faz re-rodadas pegarem
 * apenas o que ainda nao foi baixado.
 *
 * Uso:
 *   node scripts/sync-sondagens-pipefy.js                 # baixa tudo + grava no banco
 *   node scripts/sync-sondagens-pipefy.js --no-db         # so baixa arquivos + manifesto JSON (teste local)
 *   node scripts/sync-sondagens-pipefy.js --limit=20      # processa so os primeiros 20 cards (teste)
 *   node scripts/sync-sondagens-pipefy.js --dry-run       # nao baixa nem grava, so lista o que faria
 *
 * Requer no .env:
 *   PIPEFY_TOKEN=<personal access token do Pipefy>
 *   (e as MYSQL_* ja existentes, com o tunnel 3307 ativo, quando for gravar no banco)
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')

const PIPE_ID = process.env.PIPEFY_PIPE_ID || '304358509' // CRM Comercial - Gontijo
const TOKEN = process.env.PIPEFY_TOKEN
const ENDPOINT = 'https://api.pipefy.com/graphql'
const PAGE_SIZE = 30
const OUT_DIR = path.join(__dirname, '..', 'uploads', 'sondagens')

// ---- flags ----
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const valOf = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a ? a.split('=')[1] : null
}
const NO_DB = flag('no-db')
const DRY_RUN = flag('dry-run')
// --reuse-disk: arquivos ja estao no disco (ex: vieram por rsync).
// Nao baixa do Pipefy; usa o arquivo local e so grava metadata no banco.
const REUSE_DISK = flag('reuse-disk')
const LIMIT = valOf('limit') ? Number(valOf('limit')) : Infinity

if (!TOKEN) {
  console.error('ERRO: defina PIPEFY_TOKEN no .env')
  process.exit(1)
}

// ---- helpers ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function gql(query, variables) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    })
    if (res.status === 429) {
      const wait = 2000 * attempt
      console.warn(`  rate limit (429), aguardando ${wait}ms...`)
      await sleep(wait)
      continue
    }
    const json = await res.json()
    if (json.errors) {
      throw new Error('GraphQL: ' + JSON.stringify(json.errors))
    }
    return json.data
  }
  throw new Error('Falhou apos 5 tentativas (rate limit)')
}

const CARDS_QUERY = `
query($p: ID!, $a: String, $n: Int!){
  allCards(pipeId: $p, first: $n, after: $a){
    pageInfo { hasNextPage endCursor }
    edges { node {
      id
      title
      current_phase { name }
      fields {
        field { id type }
        name
        value
        array_value
      }
    }}
  }
}`

// connectors/assignees vem como '["Fulano"]' -> vira "Fulano"
function cleanVal(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s || s === '[]') return null
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr)) return arr.filter(Boolean).join(', ') || null
    } catch { /* nao era json, segue */ }
  }
  return s
}

// pega o primeiro valor preenchido de uma lista de field ids (ja limpo)
function pickField(fields, ids) {
  for (const id of ids) {
    const f = fields.find((x) => x.field && x.field.id === id)
    const v = f ? cleanVal(f.value) : null
    if (v) return v
  }
  return null
}

function sanitize(name) {
  return String(name).replace(/[^a-zA-Z0-9_.\-]/g, '_').slice(0, 80)
}

async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS crm_sondagens (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      card_id       VARCHAR(32)  NOT NULL,
      card_title    VARCHAR(255),
      negociacao    VARCHAR(255),
      cliente       VARCHAR(255),
      contato       VARCHAR(255),
      email         VARCHAR(255),
      telefone      VARCHAR(120),
      endereco_obra VARCHAR(255),
      cidade        VARCHAR(120),
      estado        VARCHAR(60),
      servico       VARCHAR(255),
      responsavel   VARCHAR(255),
      fase          VARCHAR(120),
      campo_origem  VARCHAR(60),
      nome_original VARCHAR(255),
      nome_arquivo  VARCHAR(255),
      caminho       VARCHAR(512) NOT NULL,
      tamanho       INT UNSIGNED,
      mime_type     VARCHAR(120),
      pipefy_path   VARCHAR(512) NOT NULL,
      criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_card_path (card_id, pipefy_path),
      INDEX idx_crm_sond_card (card_id)
    )
  `)
}

// query com retry: tunnel/conexao pode cair em rodada longa
async function dbQuery(db, sql, params) {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      return await db.query(sql, params)
    } catch (e) {
      const transient = ['PROTOCOL_CONNECTION_LOST', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR']
      if (!transient.includes(e.code) || attempt === 6) throw e
      const wait = 3000 * attempt
      console.warn(`\n  DB ${e.code}, retry em ${wait}ms (tunnel reconectando)...`)
      await sleep(wait)
    }
  }
}

async function alreadyHave(db, cardId, pipefyPath) {
  const [rows] = await dbQuery(db,
    'SELECT id FROM crm_sondagens WHERE card_id = ? AND pipefy_path = ? LIMIT 1',
    [cardId, pipefyPath]
  )
  return rows.length > 0
}

const MIME_BY_EXT = {
  pdf: 'application/pdf', dwg: 'image/vnd.dwg', dxf: 'image/vnd.dxf',
  zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', tif: 'image/tiff',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
function mimeFromName(name) {
  const ext = String(name).split('.').pop().toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

async function downloadFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.writeFileSync(destPath, buf)
  return { size: buf.length, mime: res.headers.get('content-type') || null }
}

async function main() {
  console.log(`Pipe ${PIPE_ID} | no-db=${NO_DB} dry-run=${DRY_RUN} limit=${LIMIT}`)

  let db = null
  if (!NO_DB && !DRY_RUN) {
    db = require('../lib/db')
    await ensureTable(db)
  }

  const manifest = []
  let after = null
  let cardCount = 0
  let fileCount = 0
  let skipCount = 0
  let pageNum = 0

  outer: while (true) {
    pageNum += 1
    const data = await gql(CARDS_QUERY, { p: PIPE_ID, a: after, n: PAGE_SIZE })
    const conn = data.allCards
    process.stdout.write(`\npagina ${pageNum} (${conn.edges.length} cards)`)

    for (const { node } of conn.edges) {
      if (cardCount >= LIMIT) break outer
      cardCount += 1

      const fields = node.fields || []
      // campos de anexo: tipo attachment
      const attachFields = fields.filter((f) => f.field && f.field.type === 'attachment')
      if (!attachFields.length) continue

      const meta = {
        negociacao: pickField(fields, ['nome_da_negocia_o_1']) || node.title,
        // cliente: connector Empresa/Contato primeiro, depois campos de marketing/LP
        cliente: pickField(fields, ['empresa', 'contato_do_cliente', 'empresa_mkt', 'empresa_lp']),
        contato: pickField(fields, ['nome_da_negocia_o_1']),
        email: pickField(fields, ['email']),
        telefone: pickField(fields, ['telefone_do_respons_vel_comercial', 'n_mero_mkt', 'telfone_do_lead_lp']),
        // local da obra: Endereco/Nome da obra + cidade/estado
        endereco_obra: pickField(fields, ['resumo']),
        cidade: pickField(fields, ['cidade']),
        estado: pickField(fields, ['estado']),
        servico: pickField(fields, ['servi_o_que_deseja']),
        responsavel: pickField(fields, ['respons_vel_pela_negocia_o']),
        fase: node.current_phase ? node.current_phase.name : null,
      }

      for (const af of attachFields) {
        let urls = []
        let paths = []
        try { urls = JSON.parse(af.value || '[]') } catch { urls = [] }
        paths = Array.isArray(af.array_value) ? af.array_value : []
        if (!urls.length) continue

        for (let i = 0; i < urls.length; i += 1) {
          const url = urls[i]
          const pipefyPath = paths[i] || url.split('?')[0]
          const original = path.basename(pipefyPath)
          const safeName = `${af.field.id}-${i}-${sanitize(original)}`
          const relPath = path.join('uploads', 'sondagens', node.id, safeName).replace(/\\/g, '/')
          const destPath = path.join(__dirname, '..', relPath)

          if (db && (await alreadyHave(db, node.id, pipefyPath))) { skipCount += 1; continue }
          if (!db && fs.existsSync(destPath)) { skipCount += 1; continue }

          if (DRY_RUN) {
            console.log(`\n  [dry] card ${node.id} | ${af.name} | ${original}`)
            fileCount += 1
            continue
          }

          // arquivo ja no disco (rsync): nao baixa, so grava metadata
          if (REUSE_DISK && fs.existsSync(destPath)) {
            const size = fs.statSync(destPath).size
            if (size > 0) {
              const row = {
                card_id: node.id, card_title: node.title, ...meta,
                campo_origem: af.field.id, nome_original: original, nome_arquivo: safeName,
                caminho: relPath, tamanho: size, mime_type: mimeFromName(safeName),
                pipefy_path: pipefyPath,
              }
              manifest.push(row)
              if (db) {
                await dbQuery(db,
                  `INSERT IGNORE INTO crm_sondagens
                   (card_id, card_title, negociacao, cliente, contato, email, telefone,
                    endereco_obra, cidade, estado, servico, responsavel, fase,
                    campo_origem, nome_original, nome_arquivo, caminho, tamanho, mime_type, pipefy_path)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                  [row.card_id, row.card_title, row.negociacao, row.cliente, row.contato, row.email,
                   row.telefone, row.endereco_obra, row.cidade, row.estado, row.servico, row.responsavel,
                   row.fase, row.campo_origem, row.nome_original, row.nome_arquivo, row.caminho,
                   row.tamanho, row.mime_type, row.pipefy_path]
                )
              }
              fileCount += 1
              process.stdout.write('.')
              continue
            }
          }

          try {
            const { size, mime } = await downloadFile(url, destPath)
            fileCount += 1
            const row = {
              card_id: node.id,
              card_title: node.title,
              ...meta,
              campo_origem: af.field.id,
              nome_original: original,
              nome_arquivo: safeName,
              caminho: relPath,
              tamanho: size,
              mime_type: mime,
              pipefy_path: pipefyPath,
            }
            manifest.push(row)
            if (db) {
              await dbQuery(db,
                `INSERT IGNORE INTO crm_sondagens
                 (card_id, card_title, negociacao, cliente, contato, email, telefone,
                  endereco_obra, cidade, estado, servico, responsavel, fase,
                  campo_origem, nome_original, nome_arquivo, caminho, tamanho, mime_type, pipefy_path)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [row.card_id, row.card_title, row.negociacao, row.cliente, row.contato, row.email,
                 row.telefone, row.endereco_obra, row.cidade, row.estado, row.servico, row.responsavel,
                 row.fase, row.campo_origem, row.nome_original, row.nome_arquivo, row.caminho,
                 row.tamanho, row.mime_type, row.pipefy_path]
              )
            }
            process.stdout.write('.')
          } catch (e) {
            console.warn(`\n  FALHA card ${node.id} ${original}: ${e.message}`)
          }
        }
      }
    }

    if (!conn.pageInfo.hasNextPage) break
    after = conn.pageInfo.endCursor
    await sleep(300) // gentileza com o rate limit
  }

  // manifesto sempre que nao for so DB
  if (!DRY_RUN) {
    const manifestPath = path.join(OUT_DIR, '_manifest.json')
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log(`\n\nmanifesto: ${manifestPath}`)
  }

  console.log(`\nRESUMO: ${cardCount} cards | ${fileCount} arquivos novos | ${skipCount} pulados`)
  if (db) await db.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
