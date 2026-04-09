const express = require('express')
const bcrypt = require('bcrypt')
const PDFDocument = require('pdfkit')
const XLSX = require('xlsx')
const router = express.Router()
const db = require('./db')
const { parseDiameterCm, getMeqFactor, calculateSegmentMeq } = require('./meq')

const OBRA_COLUMNS = [
  'numero',
  'cliente_id',
  'status',
  'empresa_responsavel',
  'tipo_obra',
  'finalidade',
  'data_prevista_inicio',
  'estado',
  'cidade',
  'cep',
  'logradouro',
  'bairro',
  'numero_end',
  'complemento',
  'projeto_gontijo',
  'valor_projeto',
  'fat_minimo_tipo',
  'fat_minimo_valor',
  'fat_minimo_dias',
  'usa_bits',
  'valor_bits',
  'transporte_noturno',
  'icamento',
  'seguro_pct',
  'total_producao',
  'mobilizacao',
  'desmobilizacao',
  'total_geral',
  'responsavel_comercial_gontijo',
  'tel_comercial_gontijo',
  'responsavel_contratante',
  'tel_contratante',
  'observacoes',
]

function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(500, parseInt(req.query.limit, 10) || 20)
  return { page, limit, offset: (page - 1) * limit }
}

function ok(res, data) {
  res.json({ ok: true, ...data })
}

function err(res, msg, code) {
  res.status(code || 400).json({ ok: false, error: msg })
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function intOrNull(value) {
  const parsed = numberOrNull(value)
  return parsed === null ? null : Math.trunc(parsed)
}

function textOrNull(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

function normalizeDateOnly(value) {
  const text = textOrNull(value)
  if (!text) return null
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : text
}

function boolToTinyInt(value) {
  return value ? 1 : 0
}

function normalizeIdArray(values) {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((value) => intOrNull(value)).filter((value) => value !== null))]
}

function pickDefined(source, keys) {
  const result = {}

  for (const key of keys) {
    if (source[key] !== undefined) {
      result[key] = source[key]
    }
  }

  return result
}

function normalizeObraFields(body) {
  const raw = pickDefined(body, OBRA_COLUMNS)

  const numericKeys = [
    'valor_projeto',
    'fat_minimo_valor',
    'fat_minimo_dias',
    'valor_bits',
    'seguro_pct',
    'total_producao',
    'mobilizacao',
    'desmobilizacao',
    'total_geral',
  ]

  for (const key of numericKeys) {
    if (raw[key] !== undefined) {
      raw[key] = numberOrNull(raw[key])
    }
  }

  const booleanKeys = ['projeto_gontijo', 'usa_bits', 'transporte_noturno', 'icamento']

  for (const key of booleanKeys) {
    if (raw[key] !== undefined) {
      raw[key] = boolToTinyInt(raw[key])
    }
  }

  const textKeys = [
    'numero',
    'status',
    'empresa_responsavel',
    'tipo_obra',
    'finalidade',
    'data_prevista_inicio',
    'estado',
    'cidade',
    'cep',
    'logradouro',
    'bairro',
    'numero_end',
    'complemento',
    'fat_minimo_tipo',
    'responsavel_comercial_gontijo',
    'tel_comercial_gontijo',
    'responsavel_contratante',
    'tel_contratante',
    'observacoes',
  ]

  for (const key of textKeys) {
    if (raw[key] !== undefined) {
      raw[key] = textOrNull(raw[key])
    }
  }

  if (raw.cliente_id !== undefined) {
    raw.cliente_id = intOrNull(raw.cliente_id)
  }

  return raw
}

function normalizeProducaoRows(producao, obraId) {
  if (!Array.isArray(producao)) return []

  return producao
    .map((row) => ({
      diametro: textOrNull(row?.diametro),
      profundidade: numberOrNull(row?.profundidade),
      qtd_estacas: intOrNull(row?.qtd_estacas),
      preco: numberOrNull(row?.preco),
      subtotal: numberOrNull(row?.subtotal),
    }))
    .filter((row) => row.diametro || row.profundidade !== null || row.qtd_estacas !== null || row.preco !== null || row.subtotal !== null)
    .map((row) => [obraId, row.diametro, row.profundidade, row.qtd_estacas, row.preco, row.subtotal])
}

function normalizeResponsabilidadeRows(responsabilidades, obraId) {
  if (!Array.isArray(responsabilidades)) return []

  return responsabilidades
    .map((row) => ({
      item: textOrNull(row?.item),
      responsavel: row?.responsavel === 'cliente' ? 'cliente' : 'gontijo',
      valor: numberOrNull(row?.valor),
    }))
    .filter((row) => row.item)
    .map((row) => [obraId, row.item, row.responsavel, row.valor])
}

function normalizeContatoRows(contatos, obraId) {
  if (!Array.isArray(contatos)) return []

  return contatos
    .map((row) => ({
      nome: textOrNull(row?.nome),
      funcao: textOrNull(row?.funcao),
      telefone: textOrNull(row?.telefone),
      email: textOrNull(row?.email),
    }))
    .filter((row) => row.nome || row.funcao || row.telefone || row.email)
    .map((row) => [obraId, row.nome, row.funcao, row.telefone, row.email])
}

function attachProducaoMetrics(rows) {
  if (!Array.isArray(rows)) return []

  return rows.map((row) => {
    const diametroCm = parseDiameterCm(row?.diametro)
    const meqFactor = getMeqFactor(diametroCm)
    const meq = calculateSegmentMeq(row?.qtd_estacas, row?.profundidade, diametroCm)

    return {
      ...row,
      diametro_cm: diametroCm,
      meq_factor: meqFactor,
      meta_meq_segmento: meq.metaMeqSegmento,
    }
  })
}

async function replaceNestedRows(conn, obraId, body) {
  if (body.producao !== undefined) {
    await conn.query('DELETE FROM obra_producao WHERE obra_id = ?', [obraId])
    const rows = normalizeProducaoRows(body.producao, obraId)
    if (rows.length) {
      await conn.query(
        'INSERT INTO obra_producao (obra_id, diametro, profundidade, qtd_estacas, preco, subtotal) VALUES ?',
        [rows]
      )
    }
  }

  if (body.responsabilidades !== undefined) {
    await conn.query('DELETE FROM obra_responsabilidades WHERE obra_id = ?', [obraId])
    const rows = normalizeResponsabilidadeRows(body.responsabilidades, obraId)
    if (rows.length) {
      await conn.query(
        'INSERT INTO obra_responsabilidades (obra_id, item, responsavel, valor) VALUES ?',
        [rows]
      )
    }
  }

  if (body.contatos !== undefined) {
    await conn.query('DELETE FROM obra_contatos WHERE obra_id = ?', [obraId])
    const rows = normalizeContatoRows(body.contatos, obraId)
    if (rows.length) {
      await conn.query(
        'INSERT INTO obra_contatos (obra_id, nome, funcao, telefone, email) VALUES ?',
        [rows]
      )
    }
  }

  if (body.modalidades !== undefined) {
    await conn.query('DELETE FROM obra_modalidades WHERE obra_id = ?', [obraId])
    const modalidadeIds = normalizeIdArray(body.modalidades)
    if (modalidadeIds.length) {
      await conn.query(
        'INSERT INTO obra_modalidades (obra_id, modalidade_id) VALUES ?',
        [modalidadeIds.map((modalidadeId) => [obraId, modalidadeId])]
      )
    }
  }

  if (body.equipamentos !== undefined) {
    await conn.query('DELETE FROM obra_equipamentos WHERE obra_id = ?', [obraId])
    const equipamentoIds = normalizeIdArray(body.equipamentos)
    if (equipamentoIds.length) {
      await conn.query(
        'INSERT INTO obra_equipamentos (obra_id, equipamento_id) VALUES ?',
        [equipamentoIds.map((equipamentoId) => [obraId, equipamentoId])]
      )
    }
  }
}

function safeParseJson(value) {
  if (!value) return null
  if (typeof value === 'object') return value

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function parseLegacyEquipments(rawValue) {
  const parsed = safeParseJson(rawValue)
  return Array.isArray(parsed) ? parsed : []
}

const tableColumnsCache = new Map()

async function getTableColumns(tableName, options = {}) {
  if (!options.refresh && tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName)
  }

  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  )

  const columns = rows.map((row) => String(row.COLUMN_NAME || row.column_name || '')).filter(Boolean)
  tableColumnsCache.set(tableName, columns)
  return columns
}

async function findFirstExistingColumn(tableName, candidates, options = {}) {
  const columns = await getTableColumns(tableName, options)
  return candidates.find((candidate) => columns.includes(candidate)) || null
}

function normalizeLookupKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim()
    .toLowerCase()
}

function mapLegacyActiveToStatus(value) {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) return 'ativo'
  if (['N', '0', 'I', 'INATIVO', 'FALSE', 'F'].includes(normalized)) return 'inativo'
  return 'ativo'
}

function mapStatusToLegacyActive(value) {
  return value === 'inativo' ? 'N' : 'S'
}

function mapStatusToLegacyEquipmentActive(value) {
  return value === 'inativo' ? 'N' : 'Y'
}

function mapLegacyConstructionStatus(value) {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized || normalized === '1' || normalized === 'A' || normalized === 'ATIVA') return 'em andamento'
  if (normalized === 'P' || normalized === 'PAUSADA') return 'pausada'
  if (normalized === 'C' || normalized === 'CANCELADA') return 'cancelada'
  return 'finalizada'
}

function mapStatusToLegacyConstruction(value) {
  if (value === 'pausada') return 'P'
  if (value === 'cancelada') return 'C'
  if (value === 'finalizada') return 'F'
  return '1'
}

function normalizeLegacyEquipmentEntry(entry) {
  if (typeof entry === 'number') {
    return { equipmentId: entry, equipmentName: '' }
  }

  if (typeof entry === 'string') {
    const trimmed = entry.trim()
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) {
      return { equipmentId: Number(trimmed), equipmentName: '' }
    }
    return { equipmentId: null, equipmentName: trimmed }
  }

  if (!entry || typeof entry !== 'object') return null

  const equipmentId = intOrNull(entry.id ?? entry.equipment_id ?? entry.equipmentId ?? entry.value)
  const equipmentName = textOrNull(entry.item ?? entry.name ?? entry.label ?? entry.nome) || ''

  if (equipmentId === null && !equipmentName) return null

  return { equipmentId, equipmentName }
}

function legacyEquipmentEntryMatches(entry, equipmentId) {
  const normalized = normalizeLegacyEquipmentEntry(entry)
  return normalized?.equipmentId === equipmentId
}

function normalizeLegacyDiaryStatus(value) {
  return ['rascunho', 'pendente', 'assinado'].includes(String(value || '')) ? String(value) : 'pendente'
}

function normalizeDiametro(raw) {
  if (raw == null) return null
  const n = parseFloat(String(raw).replace(/[^0-9.,]/g, '').replace(',', '.'))
  return isNaN(n) ? null : n
}

function compararEstacasComProducao(estacasExecutadas, producaoPlanejada, tolerancia = 0.10) {
  if (!Array.isArray(estacasExecutadas) || estacasExecutadas.length === 0) {
    return { dentroTolerancia: false, semEstacas: true, detalhes: [] }
  }
  if (!Array.isArray(producaoPlanejada) || producaoPlanejada.length === 0) {
    return { dentroTolerancia: false, semProducao: true, detalhes: [] }
  }

  const detalhes = estacasExecutadas.map((estaca) => {
    const diametroExec = normalizeDiametro(estaca.diametro)
    const profExec = parseFloat(estaca.profundidade) || null

    // Find best matching producao row by closest diâmetro
    let melhorMatch = null
    let menorDiff = Infinity
    for (const p of producaoPlanejada) {
      const diametroPlan = normalizeDiametro(p.diametro)
      if (diametroExec != null && diametroPlan != null) {
        const diff = Math.abs(diametroExec - diametroPlan)
        if (diff < menorDiff) {
          menorDiff = diff
          melhorMatch = p
        }
      } else {
        melhorMatch = melhorMatch || p
      }
    }

    if (!melhorMatch || profExec == null) {
      return { estaca: estaca.nome, diametroExec, profExec, ok: false, motivo: 'sem_referencia' }
    }

    const profPlan = parseFloat(melhorMatch.profundidade) || 0
    const diferenca = profPlan > 0 ? Math.abs(profExec - profPlan) / profPlan : 0
    const ok = diferenca <= tolerancia

    return {
      estaca: estaca.nome,
      diametroExec,
      diametroPlan: normalizeDiametro(melhorMatch.diametro),
      profExec,
      profPlan,
      diferencaPct: Math.round(diferenca * 1000) / 10,
      ok,
    }
  })

  const dentroTolerancia = detalhes.length > 0 && detalhes.every((d) => d.ok)
  return { dentroTolerancia, detalhes }
}

function extractEstacasFromDiaryData(data) {
  const result = []
  const stakesBE = Array.isArray(data.stakesBE) ? data.stakesBE : []
  const stakes = Array.isArray(data.stakes) ? data.stakes : []

  for (const row of stakesBE) {
    const r = typeof row === 'object' && row ? row : {}
    result.push({
      nome: String(r.stake ?? r.pilar ?? r.estaca ?? r.name ?? '-'),
      diametro: r.diameter ?? r.diametro ?? r.secao ?? r.section ?? null,
      profundidade: r.compCravado ?? r.comp_cravado ?? r.meters ?? null,
    })
  }
  for (const row of stakes) {
    const r = typeof row === 'object' && row ? row : {}
    result.push({
      nome: String(r.stake ?? r.pilar ?? r.estaca ?? '-'),
      diametro: r.diameter ?? r.diametro ?? r.section ?? null,
      profundidade: r.meters ?? r.compCravado ?? r.comp_cravado ?? null,
    })
  }
  return result
}

async function tryAutoAprovarConferencia(conn, diaryId, obraId) {
  try {
    if (!obraId) return
    const [producao] = await conn.query('SELECT diametro, profundidade, qtd_estacas FROM obra_producao WHERE obra_id = ?', [obraId])
    if (!producao.length) return

    const [[diary]] = await conn.query('SELECT data FROM diaries WHERE id = ?', [diaryId])
    if (!diary) return

    const data = safeParseJson(diary.data)
    const estacas = extractEstacasFromDiaryData(typeof data === 'object' && data ? data : {})
    const { dentroTolerancia } = compararEstacasComProducao(estacas, producao)

    if (dentroTolerancia) {
      await conn.query(
        `UPDATE diaries SET conferencia_status = 'aprovado', conferencia_em = NOW(), conferencia_por = NULL WHERE id = ?`,
        [diaryId]
      )
    }
  } catch (e) {
    // auto-aprovação não deve quebrar o fluxo principal
  }
}

function normalizeLegacyDiaryDataValue(value) {
  const data = safeParseJson(value)
  return data && typeof data === 'object' ? { ...data } : {}
}

function normalizeLegacyDiaryDateValue(rawValue, fallback = '') {
  const dateOnly = normalizeDateOnly(rawValue)
  return dateOnly || normalizeDateOnly(fallback) || ''
}

function normalizeDiaryStaffInput(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (typeof item === 'string') {
        const nome = textOrNull(item)
        return nome ? { usuario_id: null, nome_membro: nome, nota: null } : null
      }

      if (!item || typeof item !== 'object') {
        return null
      }

      const usuario_id = intOrNull(item.usuario_id ?? item.user_id ?? item.userId ?? item.id)
      const nome_membro = textOrNull(item.nome_membro ?? item.nome ?? item.item ?? item.name)
      const nota = intOrNull(item.nota ?? item.score ?? item.rating)
      if (usuario_id === null && !nome_membro) return null

      return {
        usuario_id,
        nome_membro: nome_membro || '',
        nota: nota !== null && nota >= 1 && nota <= 10 ? nota : null,
      }
    })
    .filter(Boolean)
}

function mergeDiaryJson(row, options = {}) {
  const parsed = normalizeLegacyDiaryDataValue(row.dados_json ?? row.raw_data ?? row.data)
  const nextData = { ...parsed }

  if (options.staffRows) {
    const existingStaff = normalizeDiaryStaffInput(parsed.staff)
    const mergedRows = [...existingStaff]

    options.staffRows.forEach((item) => {
      const alreadyMerged = item.usuario_id !== null
        ? mergedRows.some((rowItem) => rowItem.usuario_id === item.usuario_id)
        : mergedRows.some((rowItem) => rowItem.usuario_id === null && rowItem.nome_membro === item.nome_membro)

      if (!alreadyMerged) {
        mergedRows.push(item)
      }
    })

    if (mergedRows.length) {
      nextData.staff = mergedRows.map((item) => ({
        usuario_id: item.usuario_id,
        user_id: item.usuario_id,
        userId: item.usuario_id,
        nome: item.nome_membro,
        name: item.nome_membro,
        item: item.nome_membro,
        nota: item.nota,
      }))
    } else {
      delete nextData.staff
    }
  }

  return Object.keys(nextData).length ? nextData : null
}

async function listDiaryStaffMap(diaryIds) {
  const ids = [...new Set((Array.isArray(diaryIds) ? diaryIds : []).map((value) => intOrNull(value)).filter(Boolean))]
  if (!ids.length) return new Map()

  const [rows] = await db.query(
    `SELECT ds.diary_id, ds.user_id, u.name AS usuario_nome
     FROM diaries_staff ds
     LEFT JOIN users u ON u.id = ds.user_id
     WHERE ds.diary_id IN (?)
     ORDER BY ds.diary_id ASC, ds.id ASC`,
    [ids]
  )

  const map = new Map()

  rows.forEach((row) => {
    const diaryId = Number(row.diary_id)
    if (!map.has(diaryId)) {
      map.set(diaryId, [])
    }

    map.get(diaryId).push({
      usuario_id: intOrNull(row.user_id),
      nome_membro: textOrNull(row.usuario_nome) || '',
    })
  })

  return map
}

async function syncDiaryStaff(conn, diarioId, diaryJson) {
  const staffRows = normalizeDiaryStaffInput(diaryJson?.staff)
  await conn.query('DELETE FROM diaries_staff WHERE diary_id = ?', [diarioId])

  const values = staffRows
    .filter((item) => item.usuario_id !== null)
    .map((item) => [diarioId, item.usuario_id])

  if (values.length) {
    await conn.query('INSERT INTO diaries_staff (diary_id, user_id) VALUES ?', [values])
  }
}

async function syncDiaryHelperEvaluations(conn, diarioId, operatorId, diaryJson, extra = {}) {
  try {
    const staffRows = normalizeDiaryStaffInput(diaryJson?.staff)
    await conn.query('DELETE FROM diary_helper_evaluations WHERE diary_id = ?', [diarioId])

    const values = staffRows
      .filter((item) => item.nota !== null)
      .map((item) => [
        diarioId,
        extra.diaryDate || null,
        operatorId || null,
        item.usuario_id,
        item.nome_membro || null,
        extra.constructionId || null,
        item.nota,
      ])

    if (values.length) {
      await conn.query(
        `INSERT INTO diary_helper_evaluations
         (diary_id, diary_date, operator_user_id, helper_user_id, helper_name, construction_id, score)
         VALUES ?`,
        [values]
      )
    }
  } catch (error) {
    if (!String(error?.message || '').includes('diary_helper_evaluations')) {
      throw error
    }
  }
}

async function ensureLegacyComputer(conn, identifierInput, imeiInput) {
  const normalizedIdentifier = textOrNull(identifierInput) || textOrNull(imeiInput)
  const normalizedImei = textOrNull(imeiInput) || normalizedIdentifier
  if (!normalizedIdentifier) return null

  const imeiColumn = await findFirstExistingColumn(
    'computers',
    ['imei', 'serial', 'serial_number', 'identifier'],
    { refresh: true }
  )

  let existing = null
  if (imeiColumn && normalizedImei) {
    const [rows] = await conn.query(`SELECT id, name, ${imeiColumn} AS imei FROM computers WHERE ${imeiColumn} = ? LIMIT 1`, [
      normalizedImei,
    ])
    existing = rows[0] || null
  }

  if (!existing) {
    const [rows] = await conn.query('SELECT id, name FROM computers WHERE name = ? LIMIT 1', [normalizedIdentifier])
    existing = rows[0] || null
  }

  if (existing) {
    const nextName = normalizedIdentifier
    if (imeiColumn) {
      await conn.query(`UPDATE computers SET name = ?, ${imeiColumn} = ? WHERE id = ?`, [
        nextName,
        normalizedImei,
        existing.id,
      ])
    } else {
      await conn.query('UPDATE computers SET name = ? WHERE id = ?', [nextName, existing.id])
    }
    return Number(existing.id)
  }

  const insertColumns = ['name']
  const insertValues = [normalizedIdentifier]
  if (imeiColumn) {
    insertColumns.push(imeiColumn)
    insertValues.push(normalizedImei)
  }

  const placeholders = insertColumns.map(() => '?').join(',')
  const [result] = await conn.query(
    `INSERT INTO computers (${insertColumns.join(', ')}) VALUES (${placeholders})`,
    insertValues
  )

  return Number(result.insertId)
}

async function loadComputerLookupMap() {
  const imeiColumn = await findFirstExistingColumn('computers', ['imei', 'serial', 'serial_number', 'identifier'], {
    refresh: true,
  })
  const selectImei = imeiColumn ? `${imeiColumn} AS imei` : 'NULL AS imei'
  const [rows] = await db.query(`SELECT id, name, ${selectImei} FROM computers`)
  return new Map(
    rows.map((row) => [
      Number(row.id),
      {
        imei: textOrNull(row.imei) || '',
        identifier: textOrNull(row.imei) || textOrNull(row.name) || '',
      },
    ])
  )
}

function normalizeLegacyModalities(rawValue) {
  const parsed = safeParseJson(rawValue)
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((item) => {
      if (typeof item === 'number') return { id: item, nome: '' }
      if (typeof item === 'string') {
        if (/^\d+$/.test(item.trim())) return { id: Number(item), nome: '' }
        return { id: null, nome: item.trim() }
      }
      if (!item || typeof item !== 'object') return null
      return {
        id: intOrNull(item.id ?? item.modalidade_id ?? item.modalidadeId ?? item.value),
        nome: textOrNull(item.nome ?? item.name ?? item.label ?? item.item) || '',
      }
    })
    .filter(Boolean)
}

async function buildLegacyConstructionBindings() {
  const [constructionRows] = await db.query(
    `SELECT c.id, c.client_id, c.construction_number, c.equipments, c.modality, cl.name AS client_name
     FROM constructions c
     LEFT JOIN clients cl ON cl.id = c.client_id`
  )

  const byEquipmentId = new Map()
  const byEquipmentName = new Map()
  const byConstructionId = new Map()

  constructionRows.forEach((row) => {
    const constructionId = Number(row.id)
    const entry = {
      constructionId,
      constructionNumber: textOrNull(row.construction_number) || '',
      clientId: intOrNull(row.client_id),
      clientName: textOrNull(row.client_name) || '',
      modalities: normalizeLegacyModalities(row.modality),
      rawEquipments: parseLegacyEquipments(row.equipments),
    }

    byConstructionId.set(constructionId, entry)

    entry.rawEquipments.forEach((item) => {
      const normalized = normalizeLegacyEquipmentEntry(item)
      if (!normalized) return

      if (normalized.equipmentId !== null && !byEquipmentId.has(normalized.equipmentId)) {
        byEquipmentId.set(normalized.equipmentId, entry)
      }

      if (normalized.equipmentName) {
        const lookup = normalizeLookupKey(normalized.equipmentName)
        if (lookup && !byEquipmentName.has(lookup)) {
          byEquipmentName.set(lookup, entry)
        }
      }
    })
  })

  let timelineRows = []
  try {
    const [rows] = await db.query(
      `SELECT t.equipment_id, c.id AS construction_id, c.construction_number, cl.id AS client_id, cl.name AS client_name
       FROM timelines t
       LEFT JOIN constructions c ON c.id = t.construction_id
       LEFT JOIN clients cl ON cl.id = t.client_id
       WHERE t.equipment_id IS NOT NULL
       ORDER BY t.id DESC`
    )
    timelineRows = rows
  } catch {
    // timelines table does not exist in this schema version — skip
  }

  timelineRows.forEach((row) => {
    const equipmentId = intOrNull(row.equipment_id)
    const constructionId = intOrNull(row.construction_id)
    if (equipmentId === null || constructionId === null || byEquipmentId.has(equipmentId)) return

    const fromConstruction = byConstructionId.get(constructionId)
    byEquipmentId.set(
      equipmentId,
      fromConstruction || {
        constructionId,
        constructionNumber: textOrNull(row.construction_number) || '',
        clientId: intOrNull(row.client_id),
        clientName: textOrNull(row.client_name) || '',
        modalities: [],
        rawEquipments: [],
      }
    )
  })

  return { byEquipmentId, byEquipmentName, byConstructionId }
}

async function clearLegacyEquipmentBinding(conn, equipmentId) {
  const [rows] = await conn.query('SELECT id, equipments FROM constructions WHERE equipments IS NOT NULL')

  for (const row of rows) {
    const current = parseLegacyEquipments(row.equipments)
    const next = current.filter((entry) => !legacyEquipmentEntryMatches(entry, equipmentId))
    if (next.length !== current.length) {
      await conn.query('UPDATE constructions SET equipments = ? WHERE id = ?', [JSON.stringify(next), row.id])
    }
  }
}

async function bindLegacyEquipmentToConstruction(conn, constructionId, equipmentId) {
  const [[row]] = await conn.query('SELECT equipments FROM constructions WHERE id = ?', [constructionId])
  const current = parseLegacyEquipments(row?.equipments)
  const next = current.filter((entry) => !legacyEquipmentEntryMatches(entry, equipmentId))
  next.push(equipmentId)
  await conn.query('UPDATE constructions SET equipments = ? WHERE id = ?', [JSON.stringify(next), constructionId])
}

async function resolveLegacyConstructionByNumber(numero, conn = db) {
  const constructionNumber = textOrNull(numero)
  if (!constructionNumber) return null

  const [[row]] = await conn.query(
    'SELECT id, client_id, construction_number FROM constructions WHERE construction_number = ? LIMIT 1',
    [constructionNumber]
  )

  return row || null
}

async function resolveLegacyConstructionById(id, conn = db) {
  const constructionId = intOrNull(id)
  if (!constructionId) return null

  const [[row]] = await conn.query(
    `SELECT c.id, c.client_id, c.construction_number, cl.name AS client_name
     FROM constructions c
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = ?`,
    [constructionId]
  )

  return row || null
}

async function resolveLegacyEquipmentById(id, conn = db) {
  const equipmentId = intOrNull(id)
  if (!equipmentId) return null

  const [[row]] = await conn.query(
    'SELECT id, name, computer_id, equipment_type_id, active FROM equipments WHERE id = ?',
    [equipmentId]
  )

  return row || null
}

async function listLegacyConstructionsMap(ids) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((value) => intOrNull(value)).filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  const [rows] = await db.query(
    `SELECT c.id, c.client_id, c.construction_number, cl.name AS client_name
     FROM constructions c
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE c.id IN (?)`,
    [uniqueIds]
  )

  return new Map(rows.map((row) => [Number(row.id), row]))
}

async function listLegacyEquipmentsMap(ids) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((value) => intOrNull(value)).filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  const [rows] = await db.query(
    `SELECT e.id, e.name, e.equipment_type_id, e.active
     FROM equipments e
     WHERE e.id IN (?)`,
    [uniqueIds]
  )

  return new Map(rows.map((row) => [Number(row.id), row]))
}

async function listLegacyUsersMap(ids) {
  const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map((value) => intOrNull(value)).filter(Boolean))]
  if (!uniqueIds.length) return new Map()

  const [rows] = await db.query('SELECT id, name FROM users WHERE id IN (?)', [uniqueIds])
  return new Map(rows.map((row) => [Number(row.id), row]))
}

function extractDiaryEquipmentName(row) {
  if (row.equipamento) return row.equipamento

  const diaryData = normalizeLegacyDiaryDataValue(row.dados_json ?? row.raw_data ?? row.data)
  const equipmentName = textOrNull(
    row.equipment_name ??
      diaryData.equipment_name ??
      diaryData.equipment ??
      diaryData.machine_name
  )

  return equipmentName || null
}

function hydrateDiaryRow(row, options = {}) {
  const diaryData = mergeDiaryJson(row, options)
  const hydrated = {
    ...row,
    dados_json: diaryData,
    equipamento: textOrNull(row.equipamento) || extractDiaryEquipmentName(row) || null,
  }

  if (!options.includeJson) {
    delete hydrated.dados_json
    delete hydrated.raw_data
    delete hydrated.data
  }

  return hydrated
}

async function fetchLegacyDiaryDetailById(id) {
  const [[row]] = await db.query(
    `SELECT d.id,
            COALESCE(c.id, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED), 0) AS obra_id,
            CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED) AS equipamento_id,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente') AS status,
            JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.assinado_em')) AS assinado_em,
            JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.enviado_em')) AS enviado_em,
            d.user_id AS operador_id,
            u.name AS operador_nome,
            COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
            COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
            COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
            d.data AS raw_data
     FROM diaries d
     LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
     LEFT JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
     LEFT JOIN users u ON u.id = d.user_id
     WHERE d.id = ?`,
    [id]
  )

  if (!row) return null

  const staffMap = await listDiaryStaffMap([row.id])
  return hydrateDiaryRow(row, { includeJson: true, staffRows: staffMap.get(Number(row.id)) || [] })
}

async function buildLegacyDiaryPayload(input, conn = db) {
  const data = normalizeLegacyDiaryDataValue(input.dados_json)
  const obraId = intOrNull(input.obra_id ?? data.construction_id ?? data.obra_id)
  const equipamentoId = intOrNull(input.equipamento_id ?? data.equipment_id)
  const operadorId = intOrNull(input.operador_id)
  const status = normalizeLegacyDiaryStatus(input.status ?? data.status)
  const dataDiario = normalizeLegacyDiaryDateValue(input.data_diario ?? data.date)
  const assinadoEm = textOrNull(input.assinado_em ?? data.assinado_em)

  if (dataDiario) data.date = dataDiario
  data.status = status

  if (obraId) {
    const construction = await resolveLegacyConstructionById(obraId, conn)
    if (construction) {
      data.construction_id = Number(construction.id)
      data.obra_id = Number(construction.id)
      data.construction_number = textOrNull(construction.construction_number) || ''
      if (textOrNull(construction.client_name)) {
        data.client = textOrNull(construction.client_name)
      }
    }
  }

  if (equipamentoId !== null) {
    if (equipamentoId) {
      const equipment = await resolveLegacyEquipmentById(equipamentoId, conn)
      if (equipment) {
        data.equipment_id = Number(equipment.id)
        data.equipment = textOrNull(equipment.name) || ''
        data.equipment_name = textOrNull(equipment.name) || ''
      }
    } else {
      delete data.equipment_id
      delete data.equipment_name
    }
  }

  if (operadorId !== null) {
    data.operator_id = operadorId
  }

  if (status === 'assinado' && assinadoEm) {
    data.assinado_em = assinadoEm
  } else if (status !== 'assinado') {
    delete data.assinado_em
  }

  return data
}

async function resolveLegacyCityIdByName(cityName, conn = db) {
  const city = textOrNull(cityName)
  if (!city) return null

  const [[row]] = await conn.query('SELECT id FROM cities WHERE name = ? LIMIT 1', [city])
  return intOrNull(row?.id)
}

async function buildLegacyEquipmentRows({ onlyBound = false, status = null } = {}) {
  const computerLookupMap = await loadComputerLookupMap()
  const bindings = await buildLegacyConstructionBindings()
  const [rows] = await db.query(
    `SELECT e.id, e.name, e.computer_id, e.equipment_type_id, e.active, et.name AS modalidade_nome
     FROM equipments e
     LEFT JOIN equipment_types et ON et.id = e.equipment_type_id
     ORDER BY e.name`
  )

  let items = rows.map((row) => {
    const equipmentId = Number(row.id)
    const binding =
      bindings.byEquipmentId.get(equipmentId) ||
      bindings.byEquipmentName.get(normalizeLookupKey(row.name)) ||
      null

    return {
      id: equipmentId,
      nome: textOrNull(row.name) || '',
      computador_geo: computerLookupMap.get(Number(row.computer_id))?.identifier || '',
      modalidade_id: intOrNull(row.equipment_type_id),
      modalidade_nome: textOrNull(row.modalidade_nome) || '',
      status: mapLegacyActiveToStatus(row.active),
      imei: computerLookupMap.get(Number(row.computer_id))?.imei || '',
      obra_numero: binding?.constructionNumber || '',
    }
  })

  if (status === 'ativo' || status === 'inativo') {
    items = items.filter((item) => item.status === status)
  }

  if (!onlyBound) return items
  return items.filter((item) => item.status === 'ativo' && item.obra_numero)
}

function normalizeLegacyConstructionPayload(body) {
  return {
    client_id: intOrNull(body.cliente_id),
    construction_number: textOrNull(body.numero),
    status: mapStatusToLegacyConstruction(body.status),
    type: textOrNull(body.tipo_obra),
    finality: textOrNull(body.finalidade),
    start_date: normalizeDateOnly(body.data_prevista_inicio),
    state: textOrNull(body.estado),
    zip: textOrNull(body.cep),
    street: textOrNull(body.logradouro),
    neighborhood: textOrNull(body.bairro),
    number: textOrNull(body.numero_end),
    complement: textOrNull(body.complemento),
    is_gontijo_proj: body.projeto_gontijo ? 'Y' : 'N',
    proj_value: textOrNull(body.valor_projeto),
    mod_cont: textOrNull(body.modalidade_contratual),
    fat_mdg: textOrNull(body.faturamento_minimo_diario_global),
    day_inc: textOrNull(body.dias_incidencia_fat_minimo),
    mod_fat_min: textOrNull(body.modalidade_fat_minimo),
    minimum_amount: numberOrNull(body.fat_minimo_valor),
    use_bits: body.usa_bits ? 'Y' : 'N',
    bits_value: textOrNull(body.valor_bits),
    acr_not: textOrNull(body.acrescimo_transporte_noturno),
    ica_responsable: body.responsavel_icamento === 'cliente' ? 'C' : 'G',
    ica_value: textOrNull(body.valor_icamento),
    has_seg: body.incide_seguro ? 'Y' : 'N',
    seg_value: textOrNull(body.valor_seguro),
    need_integ: textOrNull(body.necessidade_integracao),
    integ_value: textOrNull(body.valor_integracao),
    need_specific_doc: textOrNull(body.documentacao_especifica),
    specific_doc_value: textOrNull(body.valor_documentacao),
    has_intern_mob: textOrNull(body.mobilizacao_interna),
    intern_mob_value: textOrNull(body.valor_mobilizacao_interna),
    cleaner_trad_responsible: body.responsavel_limpeza_trado === 'gontijo' ? 'G' : 'C',
    cleaner_trad_value: textOrNull(body.valor_limpeza_trado),
    lodge_responsible: body.responsavel_hospedagem === 'gontijo' ? 'G' : 'C',
    host_value: textOrNull(body.valor_hospedagem),
    breakfast_responsible: body.responsavel_cafe_manha === 'gontijo' ? 'G' : 'C',
    breakfast_value: textOrNull(body.valor_cafe_manha),
    lunch_responsible: body.responsavel_almoco === 'gontijo' ? 'G' : 'C',
    lunch_value: textOrNull(body.valor_almoco),
    dinner_responsible: body.responsavel_jantar === 'gontijo' ? 'G' : 'C',
    dinner_value: textOrNull(body.valor_jantar),
    diesel_supply: body.responsavel_fornecimento_diesel === 'gontijo' ? 'G' : 'C',
    diesel_payer: body.responsavel_custeio_diesel === 'gontijo' ? 'G' : 'C',
    total_production: numberOrNull(body.total_producao),
    mobilization_amount: numberOrNull(body.mobilizacao),
    demobilization_amount: numberOrNull(body.desmobilizacao),
    total: numberOrNull(body.total_geral),
    finance_responsible: textOrNull(body.razao_social_faturamento),
    finance_document: textOrNull(body.documento_faturamento),
    insc_state: textOrNull(body.inscricao_municipal),
    issqn: textOrNull(body.issqn_pct),
    issqn_retain: body.issqn_retido_fonte ? 'Y' : 'N',
    mod_fat: textOrNull(body.modalidade_faturamento),
    show_cei_cno: body.informar_cei_cno_guia ? 'Y' : 'N',
    cei_cno: textOrNull(body.cei_cno),
    cei_cno_card: textOrNull(body.cartao_cei_cno?.nome || body.cartao_cei_cno?.name || body.cartao_cei_cno),
    finance_state: textOrNull(body.faturamento_estado),
    finance_city: textOrNull(body.faturamento_cidade),
    finance_cep: textOrNull(body.faturamento_cep),
    finance_street: textOrNull(body.faturamento_logradouro),
    finance_neighborhood: textOrNull(body.faturamento_bairro),
    finance_number: textOrNull(body.faturamento_numero),
    finance_complement: textOrNull(body.faturamento_complemento),
    projects_files: JSON.stringify(Array.isArray(body.projetos_arquivos) ? body.projetos_arquivos : []),
    poll_files: JSON.stringify(Array.isArray(body.sondagens_arquivos) ? body.sondagens_arquivos : []),
    responsable_company: body.empresa_responsavel === 'fundacoes' ? 'GF' : 'GD',
    gontijo_responsable: textOrNull(body.responsavel_comercial_gontijo),
    gontijo_phone: textOrNull(body.tel_comercial_gontijo),
    contractor: textOrNull(body.responsavel_contratante),
    contractor_phone: textOrNull(body.tel_contratante),
    contractor_address: textOrNull(body.observacoes),
  }
}

async function legacyTableExists(tableName, conn = db) {
  const [[row]] = await conn.query(
    'SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [tableName]
  )
  return Number(row?.total || 0) > 0
}

function zipLegacyContactArrays(row) {
  const names = Array.isArray(safeParseJson(row.contact_name)) ? safeParseJson(row.contact_name) : []
  const functions = Array.isArray(safeParseJson(row.contact_function)) ? safeParseJson(row.contact_function) : []
  const phones = Array.isArray(safeParseJson(row.contact_phone)) ? safeParseJson(row.contact_phone) : []
  const emails = Array.isArray(safeParseJson(row.contact_email)) ? safeParseJson(row.contact_email) : []
  const length = Math.max(names.length, functions.length, phones.length, emails.length)

  return Array.from({ length }, (_, index) => ({
    id: index + 1,
    nome: toStringValue(names[index]),
    funcao: toStringValue(functions[index]),
    telefone: toStringValue(phones[index]),
    email: toStringValue(emails[index]),
  })).filter((item) => item.nome || item.funcao || item.telefone || item.email)
}

function toStringValue(value) {
  return value == null ? '' : String(value)
}

function formatDecimalNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return '-'
  return Number(value).toFixed(digits).replace('.', ',')
}

function formatDateBr(value) {
  if (!value) return '-'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function formatDateTimeBr(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatDateForFilename(value) {
  if (!value) return 'sem-data'
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear())
    return `${day}-${month}-${year}`
  }
  return String(value).replace(/[^\w-]+/g, '-')
}

function slugifyFilenamePart(value) {
  return String(value || 'sem-valor')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'sem-valor'
}

function ensurePdfSpace(doc, needed = 28) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage()
  }
}

function drawBox(doc, x, y, w, h, options = {}) {
  const fill = options.fill || null
  const stroke = options.stroke || '#9f988c'

  if (fill) {
    doc.save()
    doc.fillColor(fill).rect(x, y, w, h).fill()
    doc.restore()
  }

  doc.save()
  doc.lineWidth(options.lineWidth || 1).strokeColor(stroke).rect(x, y, w, h).stroke()
  doc.restore()
}

function drawText(doc, text, x, y, w, options = {}) {
  doc
    .font(options.font || 'Helvetica')
    .fontSize(options.size || 9)
    .fillColor(options.color || '#111111')
    .text(String(text ?? ''), x, y, {
      width: w,
      align: options.align || 'left',
      continued: false,
    })
}

function drawLine(doc, x1, y1, x2, y2, color = '#9f988c') {
  doc.save()
  doc.strokeColor(color).lineWidth(1).moveTo(x1, y1).lineTo(x2, y2).stroke()
  doc.restore()
}

function normalizeDiaryObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeDiaryArray(value) {
  return Array.isArray(value) ? value : []
}

function firstFilledValue(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text && text !== 'null' && text !== 'undefined') return text
  }

  return ''
}

function decodeSignatureDataUrl(value) {
  const text = firstFilledValue(value)
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(text)
  if (!match) return null

  try {
    return Buffer.from(match[1], 'base64')
  } catch {
    return null
  }
}

function parseWeatherFlags(data) {
  const clima = normalizeDiaryObject(data.clima)
  const tempo = normalizeDiaryObject(data.tempo)
  const weatherText = [
    clima.id,
    clima.name,
    clima.label,
    clima.item,
    tempo.id,
    tempo.name,
    tempo.label,
    tempo.item,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return {
    ensolarado: weatherText.includes('sol'),
    nublado: weatherText.includes('nublado'),
    chuvaFraca: weatherText.includes('fraca'),
    chuvaForte: weatherText.includes('forte'),
  }
}

function normalizeStakeRows(data) {
  const preferredKey = Array.isArray(data.stakesBE) ? 'stakesBE' : 'stakes'
  const rows = normalizeDiaryArray(data[preferredKey]).map((item) => normalizeDiaryObject(item))
  const isDrivenPile = preferredKey === 'stakesBE' || rows.some((row) => row.compCravado || row.comp_cravado || row.secao || row.nega || row.soldas || row.cortes)

  if (isDrivenPile) {
    const mappedRows = rows.map((row) => [
      firstFilledValue(row.stake, row.pilar, row.estaca, row.name, '-'),
      firstFilledValue(row.elemento1, row.firstElement, '-'),
      firstFilledValue(row.elemento2, row.secondElement, '-'),
      firstFilledValue(row.elemento3, row.thirdElement, '-'),
      firstFilledValue(row.elemento4, row.fourthElement, '-'),
      firstFilledValue(row.sobra, '-'),
      firstFilledValue(row.compCravado, row.comp_cravado, row.meters, '-'),
      firstFilledValue(row.secao, row.secao_id, row.section, '-'),
      firstFilledValue(row.nega, '-'),
      firstFilledValue(row.soldas, '0'),
      firstFilledValue(row.cortes, '0'),
    ])
    return {
      title: 'Serviços Executados - Estacas',
      headers: ['Pilar/Estaca', '1º Elemento (m)', '2º Elemento (m)', '3º Elemento (m)', '4º Elemento (m)', 'Sobra (m)', 'Comp. Cravado (m)', 'Seção/Perfil', 'Nega (mm)', 'Soldas', 'Cortes'],
      widths: [0.12, 0.09, 0.09, 0.09, 0.09, 0.08, 0.11, 0.1, 0.08, 0.075, 0.075],
      rows: mappedRows,
      totalsRow: null,
    }
  }

  const mappedRows = rows.map((row) => [
    firstFilledValue(row.stake, row.pilar, row.estaca, '-'),
    firstFilledValue(row.diameter, row.diametro, row.section, '-'),
    firstFilledValue(row.meters, row.compCravado, row.comp_cravado, '-'),
    firstFilledValue(row.bits, row.nega, '-'),
    firstFilledValue(row.armacao, row.sobra, '-'),
  ])

  let totalMeters = 0
  let totalArmacao = 0
  let hasMeters = false
  let hasArmacao = false

  for (const row of mappedRows) {
    const m = parseFloat(String(row[2]).replace(',', '.'))
    if (!isNaN(m)) { totalMeters += m; hasMeters = true }
    const a = parseFloat(String(row[4]).replace(',', '.'))
    if (!isNaN(a)) { totalArmacao += a; hasArmacao = true }
  }

  return {
    title: 'Serviços Executados',
    headers: ['Pilar/Estaca', 'Diâmetro (cm)', 'Realizado (m)', 'Bits', 'Armação (m)'],
    widths: [0.24, 0.18, 0.2, 0.14, 0.24],
    rows: mappedRows,
    totalsRow: [
      `${mappedRows.length} estacas`,
      '-',
      hasMeters ? formatDecimalNumber(totalMeters) : '-',
      '-',
      hasArmacao ? formatDecimalNumber(totalArmacao) : '-',
    ],
  }
}

function buildDiaryPdfContext(diario) {
  const data = normalizeDiaryObject(diario.dados_json)
  const address = normalizeDiaryObject(data.address)
  const supply = normalizeDiaryObject(data.supply)
  const clientSignature = normalizeDiaryObject(data.clientSignature)
  const signatureRequest = normalizeDiaryObject(data.signature_request)
  const planningRows = normalizeDiaryArray(data.planning).map((item) => normalizeDiaryObject(item))
  const endRows = normalizeDiaryArray(data.endConstruction).map((item) => normalizeDiaryObject(item))
  const teamRows = normalizeDiaryArray(data.staff).map((item) => {
    if (typeof item === 'string') return { item }
    return normalizeDiaryObject(item)
  })
  const rawOccurrences = normalizeDiaryArray(data.occurrences).length
    ? normalizeDiaryArray(data.occurrences)
    : normalizeDiaryArray(data.ocorrencias)
  const occurrences = rawOccurrences
    .map((item) => {
      if (typeof item === 'string') {
        return { desc: item, hora_ini: '', hora_fim: '' }
      }

      const row = normalizeDiaryObject(item)
      return {
        desc: firstFilledValue(row.desc, row.descricao),
        hora_ini: firstFilledValue(row.hora_ini, row.horaInicial),
        hora_fim: firstFilledValue(row.hora_fim, row.horaFinal),
      }
    })
    .filter((item) => item.desc || item.hora_ini || item.hora_fim)
  const stakeBlock = normalizeStakeRows(data)
  const drivenInfo =
    data.stakesBEInfo && typeof data.stakesBEInfo === 'object'
      ? normalizeDiaryObject(data.stakesBEInfo)
      : {}
  const isDrivenPile = Array.isArray(data.stakesBE) || stakeBlock.headers.includes('1º Elemento (m)')

  return {
    data,
    diaryTitle: isDrivenPile ? 'DIÁRIO DE OBRA - BATE-ESTACA' : 'DIÁRIO DE OBRA',
    obraNumber: firstFilledValue(diario.obra_numero, data.construction_number, '-'),
    clientName: firstFilledValue(diario.cliente, data.client, '-'),
    machineName: firstFilledValue(diario.equipamento, extractDiaryEquipmentName(diario), '-'),
    operatorName: firstFilledValue(diario.operador_nome, '-'),
    dateBr: formatDateBr(diario.data_diario || data.date),
    address: [
      diario.obra_street || address.street,
      diario.obra_number || address.number,
      diario.obra_neighborhood || address.neighborhood,
    ].filter(Boolean).join(', ') || '-',
    team: teamRows
      .map((item) => firstFilledValue(item.item, item.name, item.nome, item.nome_membro))
      .filter(Boolean)
      .join(', ') || '-',
    weather: parseWeatherFlags(data),
    startTime: firstFilledValue(data.start, '-'),
    endTime: firstFilledValue(data.end, '-'),
    clientOnSite: firstFilledValue(data.client, diario.cliente, '-'),
    modality: firstFilledValue(drivenInfo.modalidade, data.modality, '-'),
    drivenInfo: {
      alturaQuedaNega: firstFilledValue(drivenInfo.alturaQuedaNega, drivenInfo.altura_queda_nega, 'N/A'),
      pesoMartelo: firstFilledValue(drivenInfo.pesoMartelo, drivenInfo.peso_martelo, 'N/A'),
      modalidade: firstFilledValue(drivenInfo.modalidade, data.modality, 'N/A'),
    },
    isDrivenPile,
    horimetro: firstFilledValue(data.horimetro, '-'),
    signatureName: firstFilledValue(data.signatureName, clientSignature.name, signatureRequest.clientName, '-'),
    signatureDoc: firstFilledValue(data.signatureDoc, clientSignature.document, signatureRequest.clientDocument, '-'),
    operatorSignatureName: firstFilledValue(data.operatorSignatureName, diario.operador_nome, '-'),
    operatorSignatureDoc: firstFilledValue(data.operatorSignatureDoc, diario.operador_documento, '-'),
    operatorSignatureImage: decodeSignatureDataUrl(firstFilledValue(data.operatorSignature, diario.operador_assinatura)),
    clientSignatureImage: decodeSignatureDataUrl(firstFilledValue(data.signature, clientSignature.signature)),
    signedAt: diario.assinado_em ? formatDateTimeBr(diario.assinado_em) : '-',
    occurrences,
    supply,
    planningRows,
    endRows,
    stakeBlock,
  }
}

function drawDiaryTable(doc, x, startY, width, headers, rows, widths) {
  const border = '#9e9a94'
  const normalizedWidths = widths && widths.length === headers.length ? widths : headers.map(() => 1 / headers.length)
  const columnWidths = normalizedWidths.map((ratio) => width * ratio)
  const columnPositions = [x]

  for (let index = 0; index < columnWidths.length - 1; index += 1) {
    columnPositions.push(columnPositions[index] + columnWidths[index])
  }

  drawBox(doc, x, startY, width, 22, { stroke: border })
  headers.forEach((header, index) => {
    if (index > 0) {
      drawLine(doc, columnPositions[index], startY, columnPositions[index], startY + 22, border)
    }

    drawText(doc, header, columnPositions[index], startY + 7, columnWidths[index], {
      font: 'Helvetica',
      size: headers.length > 8 ? 5.4 : 6.5,
      align: 'center',
    })
  })

  let y = startY + 22

  rows.forEach((row) => {
    ensurePdfSpace(doc, 24)
    drawBox(doc, x, y, width, 22, { stroke: border })

    headers.forEach((_header, index) => {
      if (index > 0) {
        drawLine(doc, columnPositions[index], y, columnPositions[index], y + 22, border)
      }

      drawText(doc, row[index] || '-', columnPositions[index], y + 7, columnWidths[index], {
        size: headers.length > 8 ? 6.1 : 7,
        align: 'center',
      })
    })

    y += 22
  })

  return y
}

function buildDiaryPdfBuffer(diario) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 26 })
    const chunks = []
    const ctx = buildDiaryPdfContext(diario)
    const left = 42
    const top = 52
    const pageWidth = doc.page.width - left * 2
    const topHeaderH = 44
    const headerRowH = 30
    const headerTotalH = topHeaderH + headerRowH * 3
    const headerLeftW = (pageWidth * 322) / 504
    const headerCenterW = (pageWidth * 74) / 504
    const headerRightW = pageWidth - headerLeftW - headerCenterW
    const headerCenterX = left + headerLeftW
    const headerRightX = headerCenterX + headerCenterW
    const rightLabelW = 62
    const gray = '#d7d3ce'
    const border = '#9e9a94'

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.save()
    doc.fillColor(gray).rect(left, top, pageWidth, topHeaderH).fill()
    doc.restore()
    drawBox(doc, left, top, pageWidth, headerTotalH, { stroke: border })
    drawLine(doc, left, top + topHeaderH, left + pageWidth, top + topHeaderH, border)
    drawText(doc, 'GONTIJO', left + 6, top + 8, 82, {
      font: 'Helvetica-Bold',
      size: 14,
    })
    drawText(doc, 'FUNDAÇÕES', left + 10, top + 28, 72, {
      size: 7.5,
      color: '#666666',
    })
    drawText(doc, ctx.diaryTitle, left + 96, top + 15, 286, {
      font: 'Helvetica-Bold',
      size: ctx.isDrivenPile ? 12 : 14,
      align: 'center',
    })
    drawText(doc, `N° DA OBRA: ${ctx.obraNumber}`, left + 380, top + 15, 130, {
      font: 'Helvetica-Bold',
      size: 9,
      align: 'right',
    })

    const row1Y = top + topHeaderH
    const row2Y = row1Y + headerRowH
    const row3Y = row2Y + headerRowH
    const headerBottomY = top + headerTotalH
    drawLine(doc, headerCenterX, row1Y, headerCenterX, headerBottomY, border)
    drawLine(doc, headerRightX, row1Y, headerRightX, headerBottomY, border)
    drawLine(doc, left, row2Y, left + pageWidth, row2Y, border)
    drawLine(doc, left, row3Y, left + pageWidth, row3Y, border)
    drawText(doc, 'Cliente:', left + 6, row1Y + 10, 40, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.clientName, left + 44, row1Y + 10, headerLeftW - 54, { size: 7 })
    drawText(doc, 'Equipamento', headerCenterX + 6, row1Y + 10, headerCenterW - 12, { font: 'Helvetica-Bold', size: 6.8, align: 'center' })
    drawText(doc, 'Data:', headerRightX + 6, row1Y + 10, 26, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.dateBr, headerRightX + rightLabelW, row1Y + 10, headerRightW - rightLabelW - 8, { size: 7, align: 'right' })

    drawText(doc, 'Endereço:', left + 6, row2Y + 9, 42, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.address, left + 50, row2Y + 9, headerLeftW - 60, { size: 6.4 })
    drawText(doc, ctx.machineName, headerCenterX, row2Y + 9, headerCenterW, { font: 'Helvetica-Bold', size: 10, align: 'center' })
    drawText(doc, 'Horario inicio:', headerRightX + 6, row2Y + 7, rightLabelW - 8, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.startTime, headerRightX + rightLabelW, row2Y + 7, headerRightW - rightLabelW - 8, { size: 7, align: 'right' })

    drawText(doc, 'Equipe:', left + 6, row3Y + 8, 34, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.team, left + 38, row3Y + 8, headerLeftW - 48, { size: 6.2 })
    drawText(doc, 'Horario termino:', headerRightX + 6, row3Y + 7, rightLabelW - 2, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.endTime, headerRightX + rightLabelW, row3Y + 7, headerRightW - rightLabelW - 8, { size: 7, align: 'right' })

    let weatherY = headerBottomY + 8
    if (ctx.isDrivenPile) {
      const infoY = headerBottomY + 8
      drawText(doc, 'Altura de queda p/ nega (m):', left, infoY, 118, { font: 'Helvetica-Bold', size: 6.4 })
      drawText(doc, ctx.drivenInfo.alturaQuedaNega, left + 118, infoY, 34, { size: 6.8 })
      drawText(doc, 'Peso do martelo (kg):', left + 170, infoY, 98, { font: 'Helvetica-Bold', size: 6.4 })
      drawText(doc, ctx.drivenInfo.pesoMartelo, left + 268, infoY, 38, { size: 6.8 })
      drawText(doc, 'Modalidade:', left + 326, infoY, 58, { font: 'Helvetica-Bold', size: 6.4 })
      drawText(doc, ctx.drivenInfo.modalidade, left + 384, infoY, 78, { size: 6.8 })
      weatherY = infoY + 18
    }
    drawText(doc, 'Ensolarado:', left, weatherY, 70, { font: 'Helvetica-Bold', size: 7 })
    drawText(doc, ctx.weather.ensolarado ? 'X' : '_____', left + 42, weatherY, 34, { size: 7 })
    drawText(doc, 'Nublado:', left + 130, weatherY, 52, { font: 'Helvetica-Bold', size: 7 })
    drawText(doc, ctx.weather.nublado ? 'X' : '_____', left + 165, weatherY, 34, { size: 7 })
    drawText(doc, 'Chuva fraca:', left + 255, weatherY, 62, { font: 'Helvetica-Bold', size: 7 })
    drawText(doc, ctx.weather.chuvaFraca ? 'X' : '_____', left + 306, weatherY, 34, { size: 7 })
    drawText(doc, 'Chuva forte:', left + 378, weatherY, 62, { font: 'Helvetica-Bold', size: 7 })
    drawText(doc, ctx.weather.chuvaForte ? 'X' : '_____', left + 428, weatherY, 34, { size: 7 })

    let y = weatherY + 18
    drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border })
    drawText(doc, ctx.stakeBlock.title, left, y + 7, pageWidth, {
      font: 'Helvetica-Bold',
      size: 8,
      align: 'center',
    })
    y += 22

    y = drawDiaryTable(doc, left, y, pageWidth, ctx.stakeBlock.headers, ctx.stakeBlock.rows, ctx.stakeBlock.widths)

    if (ctx.stakeBlock.totalsRow) {
      ensurePdfSpace(doc, 24)
      const totalsWidths = ctx.stakeBlock.widths.map((ratio) => pageWidth * ratio)
      const totalsPositions = [left]
      for (let i = 0; i < totalsWidths.length - 1; i++) {
        totalsPositions.push(totalsPositions[i] + totalsWidths[i])
      }
      drawBox(doc, left, y, pageWidth, 22, { stroke: border })
      ctx.stakeBlock.totalsRow.forEach((cell, i) => {
        if (i > 0) drawLine(doc, totalsPositions[i], y, totalsPositions[i], y + 22, border)
        drawText(doc, cell, totalsPositions[i], y + 7, totalsWidths[i], {
          font: 'Helvetica-Bold',
          size: 7,
          align: 'center',
        })
      })
      y += 22
    }

    y += 8

    drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border })
    drawText(doc, 'OCORRÊNCIAS', left, y + 7, pageWidth, {
      font: 'Helvetica-Bold',
      size: 8,
      align: 'center',
    })
    y += 22
    drawBox(doc, left, y, 150, 20, { stroke: border })
    drawBox(doc, left + 150, y, pageWidth - 150, 20, { stroke: border })
    drawText(doc, 'Horario', left, y + 6, 150, { font: 'Helvetica-Bold', size: 7, align: 'center' })
    drawText(doc, 'Descricao', left + 150, y + 6, pageWidth - 150, { font: 'Helvetica-Bold', size: 7, align: 'center' })
    y += 20

    const occurrenceRows = ctx.occurrences.length ? ctx.occurrences : [{}]
    occurrenceRows.forEach((occurrence) => {
      ensurePdfSpace(doc, 32)
      drawBox(doc, left, y, 150, 26, { stroke: border })
      drawBox(doc, left + 150, y, pageWidth - 150, 26, { stroke: border })
      drawText(doc, `${firstFilledValue(occurrence.hora_ini, '-')} - ${firstFilledValue(occurrence.hora_fim, '-')}`, left, y + 8, 150, {
        size: 7,
        align: 'center',
      })
      drawText(doc, firstFilledValue(occurrence.desc, 'Sem ocorrencias registradas.'), left + 158, y + 8, pageWidth - 166, { size: 7 })
      y += 26
    })

    y += 12
    ensurePdfSpace(doc, 220)
    const fuelHeaderY = y
    drawBox(doc, left, fuelHeaderY, pageWidth, 24, { fill: gray, stroke: border })
    drawText(doc, 'ABASTECIMENTO', left, fuelHeaderY + 8, pageWidth, {
      font: 'Helvetica-Bold',
      size: 8,
      align: 'center',
    })

    const blockY = fuelHeaderY + 24
    const leftBlockW = 223
    const centerBlockW = 175
    const rightBlockW = pageWidth - leftBlockW - centerBlockW
    const supply = ctx.supply

    drawBox(doc, left, blockY, leftBlockW, 116, { stroke: border })
    drawBox(doc, left + leftBlockW, blockY, centerBlockW, 116, { stroke: border })
    drawBox(doc, left + leftBlockW + centerBlockW, blockY, rightBlockW, 116, { stroke: border })
    drawLine(doc, left + 76, blockY, left + 76, blockY + 116, border)
    drawLine(doc, left + 150, blockY, left + 150, blockY + 116, border)
    drawLine(doc, left + 150, blockY + 29, left + leftBlockW, blockY + 29, border)
    drawLine(doc, left + 76, blockY + 58, left + leftBlockW, blockY + 58, border)
    drawLine(doc, left + 150, blockY + 87, left + leftBlockW, blockY + 87, border)

    drawText(doc, 'Preencher na data da mobilizacao (Antes da montagem)', left + 4, blockY + 6, 68, { font: 'Helvetica-Bold', size: 5.5, align: 'center' })
    drawText(doc, 'Preencher ao final do dia (Todos os dias)', left + 4, blockY + 72, 68, { font: 'Helvetica-Bold', size: 5.5, align: 'center' })
    drawText(doc, 'Litros de diesel no tanque', left + 83, blockY + 13, 62, { font: 'Helvetica-Bold', size: 5.8, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosTanqueAntes, supply.litrosTanqueInicial, '-'), left + 156, blockY + 16, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros de diesel no galao', left + 83, blockY + 42, 62, { font: 'Helvetica-Bold', size: 5.8, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosGalaoAntes, supply.litrosGalaoInicial, '-'), left + 156, blockY + 45, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros de diesel no tanque', left + 83, blockY + 71, 62, { font: 'Helvetica-Bold', size: 5.8, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosTanque, '-'), left + 156, blockY + 74, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros de diesel no galao', left + 83, blockY + 100, 62, { font: 'Helvetica-Bold', size: 5.8, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosGalao, '-'), left + 156, blockY + 103, 60, { size: 7, align: 'center' })

    drawBox(doc, left + leftBlockW, blockY, centerBlockW, 30, { fill: gray, stroke: border })
    drawText(doc, 'PREENCHER AO FINAL DO DIA', left + leftBlockW, blockY + 10, centerBlockW, {
      font: 'Helvetica-Bold',
      size: 7,
      align: 'center',
    })
    drawBox(doc, left + leftBlockW, blockY + 30, centerBlockW, 28, { stroke: border })
    drawLine(doc, left + leftBlockW + 110, blockY + 30, left + leftBlockW + 110, blockY + 58, border)
    drawText(doc, 'Horímetro', left + leftBlockW, blockY + 40, 110, { font: 'Helvetica-Bold', size: 7, align: 'center' })
    drawText(doc, ctx.horimetro, left + leftBlockW + 110, blockY + 40, centerBlockW - 110, { size: 7, align: 'center' })

    drawBox(doc, left + leftBlockW, blockY + 58, 92, 58, { stroke: border })
    drawBox(doc, left + leftBlockW + 92, blockY + 58, 83, 58, { stroke: border })
    drawText(doc, 'Planejamento do dia seguinte', left + leftBlockW, blockY + 65, 175, {
      font: 'Helvetica-Bold',
      size: 6.4,
      align: 'center',
    })
    drawLine(doc, left + leftBlockW, blockY + 82, left + leftBlockW + 175, blockY + 82, border)
    drawText(doc, 'Nº de estacas', left + leftBlockW, blockY + 87, 92, { font: 'Helvetica-Bold', size: 6.3, align: 'center' })
    drawText(doc, 'Diametro (cm)', left + leftBlockW + 92, blockY + 87, 83, { font: 'Helvetica-Bold', size: 6.3, align: 'center' })
    drawText(doc, firstFilledValue(ctx.planningRows[0]?.numeroEstacas, '-'), left + leftBlockW, blockY + 100, 92, { size: 7, align: 'center' })
    drawText(doc, firstFilledValue(ctx.planningRows[0]?.diametro, '-'), left + leftBlockW + 92, blockY + 100, 83, { size: 7, align: 'center' })

    drawText(doc, 'Nº de estacas para término da obra', left + leftBlockW + centerBlockW + 8, blockY + 30, rightBlockW - 16, {
      font: 'Helvetica-Bold',
      size: 6.3,
      align: 'center',
    })
    drawBox(doc, left + leftBlockW + centerBlockW + 8, blockY + 54, rightBlockW - 16, 50, { stroke: border })
    drawLine(doc, left + leftBlockW + centerBlockW + 66, blockY + 54, left + leftBlockW + centerBlockW + 66, blockY + 104, border)
    drawText(doc, 'Nº de estacas', left + leftBlockW + centerBlockW + 8, blockY + 62, 58, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, 'Diametro (cm)', left + leftBlockW + centerBlockW + 66, blockY + 62, rightBlockW - 74, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, firstFilledValue(ctx.endRows[0]?.numeroEstacas, '-'), left + leftBlockW + centerBlockW + 8, blockY + 81, 58, { size: 7, align: 'center' })
    drawText(doc, firstFilledValue(ctx.endRows[0]?.diametro, '-'), left + leftBlockW + centerBlockW + 66, blockY + 81, rightBlockW - 74, { size: 7, align: 'center' })

    const fuelMetaY = blockY + 128
    const chegouSim = ['sim', 'yes', '1', 'true'].includes(String(supply.chegouDiesel || '').toLowerCase().trim())
    const fornecidoGontijo = String(supply.fornecidoPor || '').toLowerCase().includes('gontijo')
    drawText(doc, 'Chegou diesel na obra?', left, fuelMetaY, 104, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, chegouSim ? 'x SIM' : 'SIM', left + 106, fuelMetaY, 28, { font: chegouSim ? 'Helvetica-Bold' : 'Helvetica', size: 6.5 })
    drawText(doc, chegouSim ? 'nao' : 'x nao', left + 136, fuelMetaY, 32, { font: chegouSim ? 'Helvetica' : 'Helvetica-Bold', size: 6.5 })
    drawText(doc, 'Fornecido por:', left, fuelMetaY + 20, 72, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, fornecidoGontijo ? 'x Gontijo' : 'Gontijo', left + 68, fuelMetaY + 20, 40, { font: fornecidoGontijo ? 'Helvetica-Bold' : 'Helvetica', size: 6.5 })
    drawText(doc, fornecidoGontijo ? 'Cliente' : 'x Cliente', left + 112, fuelMetaY + 20, 40, { font: fornecidoGontijo ? 'Helvetica' : 'Helvetica-Bold', size: 6.5 })
    drawText(doc, 'Quantos litros?', left, fuelMetaY + 42, 62, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, 'Horário de chegada', left + 90, fuelMetaY + 42, 80, { font: 'Helvetica-Bold', size: 6.5 })
    drawBox(doc, left, fuelMetaY + 54, 118, 24, { stroke: border })
    drawBox(doc, left + 118, fuelMetaY + 54, 98, 24, { stroke: border })
    drawText(doc, firstFilledValue(supply.litros, '-'), left, fuelMetaY + 62, 118, { size: 6.5, align: 'center' })
    drawText(doc, firstFilledValue(supply.horario, '-'), left + 118, fuelMetaY + 62, 98, { size: 6.5, align: 'center' })

    drawBox(doc, left + 228, fuelMetaY + 40, 160, 24, { fill: gray, stroke: border })
    drawText(doc, 'Previsão de término da obra', left + 228, fuelMetaY + 48, 160, {
      font: 'Helvetica-Bold',
      size: 6.8,
      align: 'center',
    })
    drawBox(doc, left + 388, fuelMetaY + 40, 116, 24, { stroke: border })
    drawText(doc, firstFilledValue(ctx.data.endDate, '____/____/____'), left + 388, fuelMetaY + 48, 116, {
      size: 7,
      align: 'center',
    })

    doc.addPage()
    const p2Left = 42
    if (ctx.operatorSignatureImage) {
      try {
        doc.image(ctx.operatorSignatureImage, p2Left + 18, 42, { fit: [140, 42], align: 'center', valign: 'center' })
      } catch {
        // Ignore invalid signature image buffers and keep text fallback below.
      }
    }
    drawLine(doc, p2Left, 92, p2Left + 175, 92, '#505050')
    drawText(doc, 'Gontijo Fundações', p2Left, 98, 175, {
      font: 'Helvetica-Bold',
      size: 7,
    })
    drawText(doc, `Nome: ${ctx.operatorSignatureName}`, p2Left, 108, 190, {
      font: 'Helvetica-Bold',
      size: 7,
    })
    drawText(doc, `Documento: ${ctx.operatorSignatureDoc}`, p2Left, 118, 190, {
      font: 'Helvetica-Bold',
      size: 7,
    })

    if (ctx.clientSignatureImage) {
      try {
        doc.image(ctx.clientSignatureImage, 408, 42, { fit: [120, 42], align: 'center', valign: 'center' })
      } catch {
        // Ignore invalid signature image buffers and keep text fallback below.
      }
    }

    drawLine(doc, 390, 92, 548, 92, '#505050')
    drawText(doc, 'Responsável da obra', 402, 98, 130, {
      font: 'Helvetica-Bold',
      size: 7,
      align: 'center',
    })
    drawText(doc, ctx.signatureName, 402, 108, 130, {
      size: 7,
      align: 'center',
    })
    drawText(doc, ctx.signedAt, 402, 118, 130, {
      size: 7,
      align: 'center',
    })

    drawBox(doc, 42, 390, 500, 18, { fill: gray, stroke: border })
    drawText(doc, 'OCORRÊNCIAS - FOTOS EM ANEXO', 42, 395, 500, {
      font: 'Helvetica-Bold',
      size: 10,
      align: 'center',
    })
    doc.end()
  })
}

router.get('/usuarios', async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req)
    const { busca, status } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    if (busca) {
      where += ' AND (name LIKE ? OR alias LIKE ? OR document LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    }

    if (status) {
      where += ' AND active = ?'
      params.push(status === 'inativo' ? 'N' : 'S')
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${where}`, params)
    const [rows] = await db.query(
      `SELECT id,
              name AS nome,
              alias AS apelido,
              document AS login,
              phone AS telefone,
              'operador' AS perfil,
              CASE WHEN active = 'N' THEN 'inativo' ELSE 'ativo' END AS status,
              created_at AS criado_em
       FROM users ${where}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, { data: rows, total, page, limit })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/usuarios/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT id,
              name AS nome,
              alias AS apelido,
              document AS login,
              phone AS telefone,
              'operador' AS perfil,
              CASE WHEN active = 'N' THEN 'inativo' ELSE 'ativo' END AS status
       FROM users
       WHERE id = ?`,
      [req.params.id]
    )
    if (!row) return err(res, 'Usuario nao encontrado', 404)
    ok(res, { data: row })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/usuarios', async (req, res) => {
  try {
    const { nome, apelido, login, telefone, senha, perfil } = req.body
    if (!nome || !login || !senha) {
      return err(res, 'nome, login e senha sao obrigatorios')
    }

    const senha_hash = await bcrypt.hash(senha, 10)
    const [result] = await db.query(
      'INSERT INTO users (name, alias, document, phone, password, active) VALUES (?,?,?,?,?,?)',
      [nome, textOrNull(apelido), login, textOrNull(telefone), senha_hash, perfil === 'admin' ? 'S' : 'S']
    )

    ok(res, { id: result.insertId })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'Login ja cadastrado')
    err(res, e.message, 500)
  }
})

router.put('/usuarios/:id', async (req, res) => {
  try {
    const { nome, apelido, login, telefone, perfil, status } = req.body
    await db.query(
      'UPDATE users SET name = ?, alias = ?, document = ?, phone = ?, active = ? WHERE id = ?',
      [nome, textOrNull(apelido), login, textOrNull(telefone), mapStatusToLegacyActive(status), req.params.id]
    )
    ok(res, {})
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'Login ja cadastrado')
    err(res, e.message, 500)
  }
})

router.get('/clientes', async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req)
    const { busca } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    if (busca) {
      where += ' AND (name LIKE ? OR email LIKE ? OR cnpj LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM clients ${where}`, params)
    const [rows] = await db.query(
      `SELECT id,
              name AS razao_social,
              'cnpj' AS tipo_doc,
              cnpj AS documento,
              inscription AS inscricao_municipal,
              email,
              phone AS telefone,
              cep,
              state AS estado,
              city AS cidade,
              log AS logradouro,
              neighborhood AS bairro,
              number AS numero,
              complement AS complemento
       FROM clients ${where}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, { data: rows, total, page, limit })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/clientes/:id', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT id,
              name AS razao_social,
              'cnpj' AS tipo_doc,
              cnpj AS documento,
              inscription AS inscricao_municipal,
              email,
              phone AS telefone,
              cep,
              state AS estado,
              city AS cidade,
              log AS logradouro,
              neighborhood AS bairro,
              number AS numero,
              complement AS complemento
       FROM clients
       WHERE id = ?`,
      [req.params.id]
    )
    if (!row) return err(res, 'Cliente nao encontrado', 404)
    ok(res, { data: row })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/clientes', async (req, res) => {
  try {
    const {
      razao_social,
      tipo_doc,
      documento,
      inscricao_municipal,
      email,
      telefone,
      cep,
      estado,
      cidade,
      logradouro,
      bairro,
      numero,
      complemento,
    } = req.body

    if (!razao_social) return err(res, 'Razao social e obrigatoria')

    const [result] = await db.query(
      `INSERT INTO clients
      (name, cnpj, inscription, email, phone,
       cep, state, city, log, neighborhood, number, complement)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        razao_social,
        textOrNull(documento),
        textOrNull(inscricao_municipal),
        textOrNull(email),
        textOrNull(telefone),
        textOrNull(cep),
        textOrNull(estado),
        textOrNull(cidade),
        textOrNull(logradouro),
        textOrNull(bairro),
        textOrNull(numero),
        textOrNull(complemento),
      ]
    )

    ok(res, { id: result.insertId })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.put('/clientes/:id', async (req, res) => {
  try {
    const {
      razao_social,
      tipo_doc,
      documento,
      inscricao_municipal,
      email,
      telefone,
      cep,
      estado,
      cidade,
      logradouro,
      bairro,
      numero,
      complemento,
    } = req.body

    await db.query(
      `UPDATE clients SET
        name = ?, cnpj = ?, inscription = ?, email = ?, phone = ?,
        cep = ?, state = ?, city = ?, log = ?, neighborhood = ?, number = ?, complement = ?
       WHERE id = ?`,
      [
        razao_social,
        textOrNull(documento),
        textOrNull(inscricao_municipal),
        textOrNull(email),
        textOrNull(telefone),
        textOrNull(cep),
        textOrNull(estado),
        textOrNull(cidade),
        textOrNull(logradouro),
        textOrNull(bairro),
        textOrNull(numero),
        textOrNull(complemento),
        req.params.id,
      ]
    )

    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.delete('/clientes/:id', async (req, res) => {
  try {
    const [[{ obras }]] = await db.query('SELECT COUNT(*) AS obras FROM constructions WHERE client_id = ?', [req.params.id])
    if (obras > 0) {
      return err(res, 'Cliente possui obras cadastradas e nao pode ser excluido')
    }

    await db.query('DELETE FROM clients WHERE id = ?', [req.params.id])
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/modalidades', async (_req, res) => {
  try {
    const nameColumn = (await findFirstExistingColumn('equipment_types', ['name', 'label', 'title'])) || 'name'
    const [rows] = await db.query(`SELECT id, ${nameColumn} AS nome FROM equipment_types ORDER BY ${nameColumn}`)
    ok(res, { data: rows })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/equipamentos', async (req, res) => {
  try {
    const requestedStatus = req.query.status === 'inativo' ? 'inativo' : req.query.status === 'ativo' ? 'ativo' : null
    const rows = await buildLegacyEquipmentRows({
      onlyBound: req.query.parametrizados === '1',
      status: requestedStatus,
    })
    ok(res, { data: rows })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/equipamentos', async (req, res) => {
  const conn = await db.getConnection()

  try {
    const { nome, computador_geo, modalidade_id, imei, obra_numero } = req.body
    if (!nome) return err(res, 'Nome e obrigatorio')
    const computerIdentifier = textOrNull(computador_geo) || textOrNull(imei)

    const construction = obra_numero ? await resolveLegacyConstructionByNumber(obra_numero, conn) : null
    if (obra_numero && !construction) {
      return err(res, 'Numero de obra nao encontrado no banco legado')
    }

    await conn.beginTransaction()
    const computerId = await ensureLegacyComputer(conn, computerIdentifier, imei)
    const [result] = await conn.query(
      'INSERT INTO equipments (name, computer_id, equipment_type_id, active) VALUES (?,?,?,?)',
      [nome, computerId, intOrNull(modalidade_id), mapStatusToLegacyEquipmentActive('ativo')]
    )

    if (construction) {
      await bindLegacyEquipmentToConstruction(conn, construction.id, result.insertId)
    }

    await conn.commit()

    ok(res, { id: result.insertId })
  } catch (e) {
    await conn.rollback()
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.put('/equipamentos/:id', async (req, res) => {
  const conn = await db.getConnection()

  try {
    const { nome, computador_geo, modalidade_id, status, imei, obra_numero } = req.body
    const computerIdentifier = textOrNull(computador_geo) || textOrNull(imei)
    const construction = obra_numero ? await resolveLegacyConstructionByNumber(obra_numero, conn) : null
    if (obra_numero && !construction) {
      return err(res, 'Numero de obra nao encontrado no banco legado')
    }

    await conn.beginTransaction()
    const computerId = await ensureLegacyComputer(conn, computerIdentifier, imei)
    await conn.query(
      'UPDATE equipments SET name = ?, computer_id = ?, equipment_type_id = ?, active = ? WHERE id = ?',
      [nome, computerId, intOrNull(modalidade_id), mapStatusToLegacyEquipmentActive(status), req.params.id]
    )

    await clearLegacyEquipmentBinding(conn, intOrNull(req.params.id))
    if (construction) {
      await bindLegacyEquipmentToConstruction(conn, construction.id, intOrNull(req.params.id))
    }

    await conn.commit()
    ok(res, {})
  } catch (e) {
    await conn.rollback()
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.get('/obras', async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req)
    const { busca, status, cliente_id } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    if (busca) {
      where += ' AND (o.construction_number LIKE ? OR c.name LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`)
    }

    if (status) {
      where += ' AND o.status = ?'
      params.push(mapStatusToLegacyConstruction(status))
    }

    if (cliente_id) {
      where += ' AND o.client_id = ?'
      params.push(cliente_id)
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM constructions o
       LEFT JOIN clients c ON c.id = o.client_id
       ${where}`,
      params
    )

    const [rows] = await db.query(
      `SELECT o.id,
              o.construction_number AS numero,
              o.status,
              o.type AS tipo_obra,
              ci.name AS cidade,
              o.state AS estado,
              o.start_date AS data_prevista_inicio,
              c.name AS cliente
       FROM constructions o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN cities ci ON ci.id = o.city_id
       ${where}
       ORDER BY o.construction_number DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, {
      data: rows.map((row) => ({
        ...row,
        status: mapLegacyConstructionStatus(row.status),
      })),
      total,
      page,
      limit,
    })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/obras/:id', async (req, res) => {
  try {
    const [[obra]] = await db.query(
      `SELECT o.*, c.name AS cliente_nome, ci.name AS cidade_nome
       FROM constructions o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN cities ci ON ci.id = o.city_id
       WHERE o.id = ?`,
      [req.params.id]
    )

    if (!obra) return err(res, 'Obra nao encontrada', 404)

    const modalidadeRows = normalizeLegacyModalities(obra.modality)
    const modalidadeIds = modalidadeRows.map((item) => item.id).filter((item) => item !== null)
    const equipamentoEntries = parseLegacyEquipments(obra.equipments)
      .map((item) => normalizeLegacyEquipmentEntry(item))
      .filter(Boolean)
    const equipamentoIds = equipamentoEntries.map((item) => item.equipmentId).filter((item) => item !== null)

    const [modalidades] = modalidadeIds.length
      ? await db.query('SELECT id, name AS nome FROM equipment_types WHERE id IN (?) ORDER BY name', [modalidadeIds])
      : [[]]
    const [equipamentos] = equipamentoIds.length
      ? await db.query(
          `SELECT id,
                  name AS nome,
                  IFNULL(CAST(computer_id AS CHAR), '') AS computador_geo,
                  equipment_type_id AS modalidade_id,
                  CASE WHEN active = 'N' THEN 'inativo' ELSE 'ativo' END AS status
           FROM equipments
           WHERE id IN (?)
           ORDER BY name`,
          [equipamentoIds]
        )
      : [[]]

    const [producao] = (await legacyTableExists('obra_producao'))
      ? await db.query(
          `SELECT id, diametro, profundidade, qtd_estacas, preco, subtotal
           FROM obra_producao
           WHERE obra_id = ?
           ORDER BY id`,
          [obra.id]
        )
      : [[]]

    ok(res, {
      data: {
        id: Number(obra.id),
        numero: textOrNull(obra.construction_number) || '',
        cliente_id: intOrNull(obra.client_id),
        status: mapLegacyConstructionStatus(obra.status),
        empresa_responsavel: textOrNull(obra.gontijo_responsable),
        tipo_obra: textOrNull(obra.type),
        finalidade: textOrNull(obra.finality),
        data_prevista_inicio: normalizeDateOnly(obra.start_date),
        estado: textOrNull(obra.state),
        cidade: textOrNull(obra.cidade_nome),
        cep: textOrNull(obra.zip),
        logradouro: textOrNull(obra.street),
        bairro: textOrNull(obra.neighborhood),
        numero_end: textOrNull(obra.number),
        complemento: textOrNull(obra.complement),
        projeto_gontijo: String(obra.is_gontijo_proj || '').toUpperCase() === 'Y' ? 1 : 0,
        valor_projeto: numberOrNull(obra.proj_value),
        fat_minimo_tipo: 'global',
        fat_minimo_valor: numberOrNull(obra.minimum_amount),
        fat_minimo_dias: null,
        usa_bits: String(obra.use_bits || '').toUpperCase() === 'Y' ? 1 : 0,
        valor_bits: numberOrNull(obra.bits_value),
        transporte_noturno: 0,
        icamento: numberOrNull(obra.ica_value) ? 1 : 0,
        seguro_pct: numberOrNull(obra.seg_value),
        total_producao: numberOrNull(obra.total_production),
        mobilizacao: numberOrNull(obra.mobilization_amount),
        desmobilizacao: numberOrNull(obra.demobilization_amount),
        total_geral: numberOrNull(obra.total),
        modalidade_contratual: textOrNull(obra.mod_cont),
        faturamento_minimo_diario_global: numberOrNull(obra.fat_mdg),
        dias_incidencia_fat_minimo: textOrNull(obra.day_inc),
        modalidade_fat_minimo: textOrNull(obra.mod_fat_min),
        acrescimo_transporte_noturno: numberOrNull(obra.acr_not),
        responsavel_icamento: String(obra.ica_responsable || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_icamento: numberOrNull(obra.ica_value),
        incide_seguro: String(obra.has_seg || '').toUpperCase() === 'Y' ? 1 : 0,
        valor_seguro: numberOrNull(obra.seg_value),
        necessidade_integracao: textOrNull(obra.need_integ),
        valor_integracao: numberOrNull(obra.integ_value),
        documentacao_especifica: textOrNull(obra.need_specific_doc),
        valor_documentacao: numberOrNull(obra.specific_doc_value),
        mobilizacao_interna: textOrNull(obra.has_intern_mob),
        valor_mobilizacao_interna: numberOrNull(obra.intern_mob_value),
        responsavel_limpeza_trado: String(obra.cleaner_trad_responsible || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_limpeza_trado: numberOrNull(obra.cleaner_trad_value),
        responsavel_hospedagem: String(obra.lodge_responsible || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_hospedagem: numberOrNull(obra.host_value),
        responsavel_cafe_manha: String(obra.breakfast_responsible || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_cafe_manha: numberOrNull(obra.breakfast_value),
        responsavel_almoco: String(obra.lunch_responsible || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_almoco: numberOrNull(obra.lunch_value),
        responsavel_jantar: String(obra.dinner_responsible || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        valor_jantar: numberOrNull(obra.dinner_value),
        responsavel_fornecimento_diesel: String(obra.diesel_supply || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        responsavel_custeio_diesel: String(obra.diesel_payer || '').toUpperCase() === 'G' ? 'gontijo' : 'cliente',
        razao_social_faturamento: textOrNull(obra.finance_responsible),
        tipo_documento_faturamento: textOrNull(obra.finance_document).replace(/\D/g, '').length <= 11 ? 'cpf' : 'cnpj',
        documento_faturamento: textOrNull(obra.finance_document),
        inscricao_municipal: textOrNull(obra.insc_state),
        issqn_pct: numberOrNull(obra.issqn),
        issqn_retido_fonte: String(obra.issqn_retain || '').toUpperCase() === 'Y' ? 1 : 0,
        modalidade_faturamento: textOrNull(obra.mod_fat),
        informar_cei_cno_guia: String(obra.show_cei_cno || '').toUpperCase() === 'Y' ? 1 : 0,
        cei_cno: textOrNull(obra.cei_cno),
        cartao_cei_cno: obra.cei_cno_card ? { nome: textOrNull(obra.cei_cno_card), tipo: '', tamanho: null } : null,
        endereco_faturamento_mesmo_cliente:
          textOrNull(obra.finance_state) === textOrNull(obra.state) &&
          textOrNull(obra.finance_city) === textOrNull(obra.cidade_nome) &&
          textOrNull(obra.finance_cep) === textOrNull(obra.zip) &&
          textOrNull(obra.finance_street) === textOrNull(obra.street) &&
          textOrNull(obra.finance_neighborhood) === textOrNull(obra.neighborhood) &&
          textOrNull(obra.finance_number) === textOrNull(obra.number) &&
          textOrNull(obra.finance_complement) === textOrNull(obra.complement)
            ? 1
            : 0,
        faturamento_estado: textOrNull(obra.finance_state),
        faturamento_cidade: textOrNull(obra.finance_city),
        faturamento_cep: textOrNull(obra.finance_cep),
        faturamento_logradouro: textOrNull(obra.finance_street),
        faturamento_bairro: textOrNull(obra.finance_neighborhood),
        faturamento_numero: textOrNull(obra.finance_number),
        faturamento_complemento: textOrNull(obra.finance_complement),
        projetos_arquivos: Array.isArray(safeParseJson(obra.projects_files)) ? safeParseJson(obra.projects_files) : [],
        sondagens_arquivos: Array.isArray(safeParseJson(obra.poll_files)) ? safeParseJson(obra.poll_files) : [],
        empresa_responsavel: String(obra.responsable_company || '').toUpperCase() === 'GF' ? 'fundacoes' : 'gontijo',
        responsavel_comercial_gontijo: textOrNull(obra.gontijo_responsable),
        tel_comercial_gontijo: textOrNull(obra.gontijo_phone),
        responsavel_contratante: textOrNull(obra.contractor),
        tel_contratante: textOrNull(obra.contractor_phone),
        observacoes: textOrNull(obra.contractor_address),
        producao: attachProducaoMetrics(Array.isArray(producao) ? producao : []),
        responsabilidades: [],
        contatos: zipLegacyContactArrays(obra),
        modalidades,
        equipamentos,
      },
    })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/obras', async (req, res) => {
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()
    const obraFields = normalizeLegacyConstructionPayload(req.body)
    if (!obraFields.construction_number || !obraFields.client_id) {
      await conn.rollback()
      return err(res, 'numero e cliente_id sao obrigatorios')
    }

    obraFields.city_id = await resolveLegacyCityIdByName(req.body.cidade, conn)
    obraFields.modality = JSON.stringify(normalizeIdArray(req.body.modalidades))
    obraFields.equipments = JSON.stringify(normalizeIdArray(req.body.equipamentos))
    obraFields.contact_name = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.nome) || ''))
    obraFields.contact_function = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.funcao) || ''))
    obraFields.contact_phone = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.telefone) || ''))
    obraFields.contact_email = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.email) || ''))

    const columns = Object.keys(obraFields)
    const values = Object.values(obraFields)
    const placeholders = values.map(() => '?').join(', ')
    const [result] = await conn.query(
      `INSERT INTO constructions (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    )

    if (Array.isArray(req.body.producao) && req.body.producao.length) {
      if (!(await legacyTableExists('obra_producao', conn))) {
        await conn.rollback()
        return err(res, 'A tabela obra_producao ainda nao existe no banco clone. Avalie aplicar a migration antes de salvar linhas de producao.')
      }
      await conn.query('DELETE FROM obra_producao WHERE obra_id = ?', [result.insertId])
      const rows = normalizeProducaoRows(req.body.producao, result.insertId)
      if (rows.length) {
        await conn.query(
          'INSERT INTO obra_producao (obra_id, diametro, profundidade, qtd_estacas, preco, subtotal) VALUES ?',
          [rows]
        )
      }
    }

    await conn.commit()

    ok(res, { id: result.insertId })
  } catch (e) {
    await conn.rollback()
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'Numero de obra ja cadastrado')
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.put('/obras/:id', async (req, res) => {
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()
    const obraId = intOrNull(req.params.id)
    const obraFields = normalizeLegacyConstructionPayload(req.body)
    obraFields.city_id = await resolveLegacyCityIdByName(req.body.cidade, conn)
    obraFields.modality = JSON.stringify(normalizeIdArray(req.body.modalidades))
    obraFields.equipments = JSON.stringify(normalizeIdArray(req.body.equipamentos))
    obraFields.contact_name = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.nome) || ''))
    obraFields.contact_function = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.funcao) || ''))
    obraFields.contact_phone = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.telefone) || ''))
    obraFields.contact_email = JSON.stringify((Array.isArray(req.body.contatos) ? req.body.contatos : []).map((item) => textOrNull(item?.email) || ''))

    if (Object.keys(obraFields).length) {
      const setClause = Object.keys(obraFields).map((key) => `${key} = ?`).join(', ')
      await conn.query(`UPDATE constructions SET ${setClause} WHERE id = ?`, [...Object.values(obraFields), obraId])
    }

    if (Array.isArray(req.body.producao)) {
      if (!(await legacyTableExists('obra_producao', conn))) {
        await conn.rollback()
        return err(res, 'A tabela obra_producao ainda nao existe no banco clone. Avalie aplicar a migration antes de salvar linhas de producao.')
      }
      await conn.query('DELETE FROM obra_producao WHERE obra_id = ?', [obraId])
      const rows = normalizeProducaoRows(req.body.producao, obraId)
      if (rows.length) {
        await conn.query(
          'INSERT INTO obra_producao (obra_id, diametro, profundidade, qtd_estacas, preco, subtotal) VALUES ?',
          [rows]
        )
      }
    }
    await conn.commit()

    ok(res, {})
  } catch (e) {
    await conn.rollback()
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'Numero de obra ja cadastrado')
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.get('/diarios', async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req)
    const { data_inicio, data_fim, obra, equipamento_id, operador_id, status, modalidade_id } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    const diaryDateExpr = "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d'))"
    const diaryStatusExpr = "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente')"
    const diaryConstructionExpr = "COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number')))"
    const diaryEquipmentIdExpr = "CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)"

    if (data_inicio) {
      where += ` AND ${diaryDateExpr} >= ?`
      params.push(String(data_inicio))
    }

    if (data_fim) {
      where += ` AND ${diaryDateExpr} <= ?`
      params.push(String(data_fim))
    }

    if (obra) {
      where += ` AND ${diaryConstructionExpr} LIKE ?`
      params.push(`%${String(obra)}%`)
    }

    if (equipamento_id) {
      where += ` AND ${diaryEquipmentIdExpr} = ?`
      params.push(Number(equipamento_id))
    }

    if (operador_id) {
      where += ' AND d.user_id = ?'
      params.push(Number(operador_id))
    }

    if (status) {
      where += ` AND ${diaryStatusExpr} = ?`
      params.push(String(status))
    }

    if (modalidade_id) {
      where += ' AND e.equipment_type_id = ?'
      params.push(Number(modalidade_id))
    }

    const fromClause = `
      FROM diaries d
      LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN equipments e ON e.id = ${diaryEquipmentIdExpr}
      LEFT JOIN users u ON u.id = d.user_id
    `

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       ${fromClause}
       ${where}`,
      params
    )

    const [pageRows] = await db.query(
      `SELECT d.id,
              COALESCE(c.id, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED), 0) AS obra_id,
              ${diaryEquipmentIdExpr} AS equipamento_id,
              ${diaryDateExpr} AS data_diario,
              ${diaryStatusExpr} AS status,
              d.created_at AS criado_em,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.assinado_em')) AS assinado_em,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.enviado_em')) AS enviado_em,
              d.user_id AS operador_id,
              u.name AS operador_nome,
              ${diaryConstructionExpr} AS obra_numero,
              COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
              e.equipment_type_id AS modalidade_id,
              d.conferencia_status,
              d.data AS raw_data
       ${fromClause}
       ${where}
       ORDER BY d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const staffMap = await listDiaryStaffMap(pageRows.map((row) => row.id))

    ok(res, {
      data: pageRows.map((row) =>
        hydrateDiaryRow(row, {
          staffRows: staffMap.get(Number(row.id)) || [],
        })
      ),
      total,
      page,
      limit,
    })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/diarios', async (req, res) => {
  const conn = await db.getConnection()

  try {
    const { obra_id, equipamento_id, operador_id, data_diario, status, dados_json, assinado_em } = req.body
    const normalizedStatus = normalizeLegacyDiaryStatus(status || 'rascunho')
    const obraId = intOrNull(obra_id)
    const operadorId = intOrNull(operador_id)
    const normalizedDiaryDate = normalizeDateOnly(data_diario)

    if (!obraId || !normalizedDiaryDate) {
      return err(res, 'obra_id e data_diario sao obrigatorios')
    }

    await conn.beginTransaction()

    const resolvedSignedAt =
      normalizedStatus === 'assinado'
        ? textOrNull(assinado_em) || new Date().toISOString().slice(0, 19).replace('T', ' ')
        : null

    const legacyData = await buildLegacyDiaryPayload(
      {
        obra_id: obraId,
        equipamento_id,
        operador_id: operadorId,
        data_diario: normalizedDiaryDate,
        status: normalizedStatus,
        assinado_em: resolvedSignedAt,
        dados_json,
      },
      conn
    )

    const [result] = await conn.query(
      `INSERT INTO diaries (data, user_id, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())`,
      [JSON.stringify(legacyData), operadorId]
    )

    await syncDiaryStaff(conn, result.insertId, legacyData)
    await syncDiaryHelperEvaluations(conn, result.insertId, operadorId, legacyData, {
      diaryDate: normalizedDiaryDate,
      constructionId: obraId,
    })
    await conn.commit()

    if (normalizedStatus === 'assinado') {
      await tryAutoAprovarConferencia(conn, result.insertId, obraId)
    }

    ok(res, { id: result.insertId })
  } catch (e) {
    await conn.rollback()
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.post('/operador/diarios/resolve-draft', async (req, res) => {
  const conn = await db.getConnection()

  try {
    const operadorId = intOrNull(req.body?.operador_id)
    const equipamentoId = intOrNull(req.body?.equipamento_id)
    const obraId = intOrNull(req.body?.obra_id)
    const obraNumero = textOrNull(req.body?.obra_numero)

    if (!operadorId || !equipamentoId || (!obraId && !obraNumero)) {
      return err(res, 'operador_id, equipamento_id e obra_id ou obra_numero sao obrigatorios')
    }

    const equipment = await resolveLegacyEquipmentById(equipamentoId, conn)
    if (!equipment) {
      return err(res, 'Equipamento nao encontrado', 404)
    }

    const construction =
      (obraId ? await resolveLegacyConstructionById(obraId, conn) : null) ||
      (obraNumero ? await resolveLegacyConstructionByNumber(obraNumero, conn) : null)

    if (!construction) {
      return err(res, 'Obra nao encontrada', 404)
    }

    const [[existingDraft]] = await conn.query(
      `SELECT d.id
       FROM diaries d
       LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
       WHERE d.user_id = ?
         AND CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED) = ?
         AND COALESCE(c.id, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED), 0) = ?
         AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente') = 'rascunho'
       ORDER BY d.id DESC
       LIMIT 1`,
      [operadorId, equipamentoId, Number(construction.id)]
    )

    if (existingDraft?.id) {
      const diario = await fetchLegacyDiaryDetailById(existingDraft.id)
      return ok(res, { data: diario })
    }

    await conn.beginTransaction()

    const today = new Date().toISOString().slice(0, 10)
    const legacyData = await buildLegacyDiaryPayload(
      {
        obra_id: Number(construction.id),
        equipamento_id: equipamentoId,
        operador_id: operadorId,
        data_diario: today,
        status: 'rascunho',
        assinado_em: null,
        dados_json: {
          construction_id: Number(construction.id),
          construction_number: textOrNull(construction.construction_number) || '',
          equipment_id: equipamentoId,
          equipment: textOrNull(equipment.name) || '',
          equipment_name: textOrNull(equipment.name) || '',
        },
      },
      conn
    )

    const [result] = await conn.query(
      `INSERT INTO diaries (data, user_id, created_at, updated_at)
       VALUES (?, ?, NOW(), NOW())`,
      [JSON.stringify(legacyData), operadorId]
    )

    await syncDiaryStaff(conn, result.insertId, legacyData)
    await syncDiaryHelperEvaluations(conn, result.insertId, operadorId, legacyData, {
      diaryDate: today,
      constructionId: Number(construction.id),
    })
    await conn.commit()

    const diario = await fetchLegacyDiaryDetailById(result.insertId)
    return ok(res, { data: diario })
  } catch (e) {
    await conn.rollback()
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.get('/diarios/:id/pdf', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT d.id,
              COALESCE(c.id, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED), 0) AS obra_id,
              CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED) AS equipamento_id,
              COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario,
              COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente') AS status,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.assinado_em')) AS assinado_em,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.enviado_em')) AS enviado_em,
              d.user_id AS operador_id,
              u.name AS operador_nome,
              u.document AS operador_documento,
              u.signature AS operador_assinatura,
              COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
              COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
              c.street AS obra_street,
              c.number AS obra_number,
              c.neighborhood AS obra_neighborhood,
              d.data AS raw_data
       FROM diaries d
       LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       LEFT JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id]
    )

    if (!row) return err(res, 'Diario nao encontrado', 404)

    const staffMap = await listDiaryStaffMap([row.id])
    const diario = hydrateDiaryRow(row, { includeJson: true, staffRows: staffMap.get(Number(row.id)) || [] })
    const pdfBuffer = await buildDiaryPdfBuffer(diario)
    const filename = `${formatDateForFilename(diario.data_diario)}_${slugifyFilenamePart(diario.obra_numero)}_${slugifyFilenamePart(diario.equipamento)}_${diario.id}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    return res.send(pdfBuffer)
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/diarios/:id', async (req, res) => {
  try {
    const diario = await fetchLegacyDiaryDetailById(req.params.id)
    if (!diario) return err(res, 'Diario nao encontrado', 404)
    ok(res, { data: diario })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.put('/diarios/:id', async (req, res) => {
  const conn = await db.getConnection()

  try {
    const { data_diario, status, equipamento_id, dados_json, assinado_em } = req.body
    const normalizedStatus = normalizeLegacyDiaryStatus(status)
    const normalizedDiaryDate = normalizeDateOnly(data_diario)
    const resolvedSignedAt =
      normalizedStatus === 'assinado'
        ? textOrNull(assinado_em) || new Date().toISOString().slice(0, 19).replace('T', ' ')
        : null

    await conn.beginTransaction()

    const [[current]] = await conn.query('SELECT data, user_id FROM diaries WHERE id = ?', [req.params.id])
    if (!current) {
      await conn.rollback()
      return err(res, 'Diario nao encontrado', 404)
    }

    const currentData = normalizeLegacyDiaryDataValue(current.data)
    const legacyData = await buildLegacyDiaryPayload(
      {
        obra_id: currentData.construction_id ?? currentData.obra_id,
        equipamento_id,
        operador_id: current.user_id,
        data_diario: normalizedDiaryDate || currentData.date,
        status: normalizedStatus,
        assinado_em: resolvedSignedAt,
        dados_json,
      },
      conn
    )

    await conn.query(
      `UPDATE diaries
       SET data = ?, updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(legacyData), req.params.id]
    )

    await syncDiaryStaff(conn, req.params.id, legacyData)
    await syncDiaryHelperEvaluations(conn, req.params.id, current.user_id, legacyData, {
      diaryDate: normalizedDiaryDate || currentData.date || null,
      constructionId: intOrNull(currentData.construction_id ?? currentData.obra_id),
    })
    await conn.commit()

    if (normalizedStatus === 'assinado') {
      const obraId = intOrNull(currentData.construction_id ?? currentData.obra_id)
      await tryAutoAprovarConferencia(conn, req.params.id, obraId)
    }

    ok(res, {})
  } catch (e) {
    await conn.rollback()
    err(res, e.message, 500)
  } finally {
    conn.release()
  }
})

router.delete('/diarios/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM diary_helper_evaluations WHERE diary_id = ?', [req.params.id])
    await db.query('DELETE FROM diaries_staff WHERE diary_id = ?', [req.params.id])
    await db.query('DELETE FROM diaries WHERE id = ?', [req.params.id])
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/avaliacoes-ajudantes', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req)
    const dataInicio = normalizeDateOnly(req.query.dataInicio)
    const dataFim = normalizeDateOnly(req.query.dataFim)
    const nome = textOrNull(req.query.nome)
    const where = []
    const params = []

    if (dataInicio) {
      where.push('a.diary_date >= ?')
      params.push(dataInicio)
    }

    if (dataFim) {
      where.push('a.diary_date <= ?')
      params.push(dataFim)
    }

    if (nome) {
      where.push('(COALESCE(u.name, a.helper_name) LIKE ? OR COALESCE(op.name, \'\') LIKE ?)')
      params.push(`%${nome}%`, `%${nome}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM diary_helper_evaluations a
       LEFT JOIN users u ON u.id = a.helper_user_id
       LEFT JOIN users op ON op.id = a.operator_user_id
       ${whereSql}`,
      params
    )

    const [rows] = await db.query(
      `SELECT a.id,
              a.diary_id,
              a.diary_date,
              a.score,
              a.helper_user_id,
              COALESCE(u.name, a.helper_name) AS helper_name,
              a.operator_user_id,
              op.name AS operator_name,
              a.construction_id,
              c.construction_number AS obra_numero,
              cl.name AS cliente,
              e.name AS equipamento,
              a.created_at
       FROM diary_helper_evaluations a
       LEFT JOIN users u ON u.id = a.helper_user_id
       LEFT JOIN users op ON op.id = a.operator_user_id
       LEFT JOIN constructions c ON c.id = a.construction_id
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN diaries d ON d.id = a.diary_id
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       ${whereSql}
       ORDER BY a.diary_date DESC, helper_name ASC, a.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, {
      data: rows.map((row) => ({
        id: Number(row.id),
        diary_id: Number(row.diary_id),
        diary_date: normalizeDateOnly(row.diary_date),
        score: Number(row.score),
        helper_user_id: intOrNull(row.helper_user_id),
        helper_name: textOrNull(row.helper_name) || '',
        operator_user_id: intOrNull(row.operator_user_id),
        operator_name: textOrNull(row.operator_name) || '',
        construction_id: intOrNull(row.construction_id),
        obra_numero: textOrNull(row.obra_numero) || '',
        cliente: textOrNull(row.cliente) || '',
        equipamento: textOrNull(row.equipamento) || '',
        created_at: textOrNull(row.created_at) || '',
      })),
      total: Number(countRow?.total || 0),
      page,
      limit,
    })
  } catch (e) {
    if (String(e.message || '').includes('diary_helper_evaluations')) {
      return err(res, 'A tabela de avaliacao de ajudantes ainda nao foi criada no banco.', 500)
    }
    err(res, e.message, 500)
  }
})

router.get('/avaliacoes-ajudantes/export', async (req, res) => {
  try {
    const dataInicio = normalizeDateOnly(req.query.dataInicio)
    const dataFim = normalizeDateOnly(req.query.dataFim)
    const nome = textOrNull(req.query.nome)
    const where = []
    const params = []

    if (dataInicio) {
      where.push('a.diary_date >= ?')
      params.push(dataInicio)
    }

    if (dataFim) {
      where.push('a.diary_date <= ?')
      params.push(dataFim)
    }

    if (nome) {
      where.push('(COALESCE(u.name, a.helper_name) LIKE ? OR COALESCE(op.name, \'\') LIKE ?)')
      params.push(`%${nome}%`, `%${nome}%`)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const [rows] = await db.query(
      `SELECT a.diary_date,
              COALESCE(u.name, a.helper_name) AS helper_name,
              a.score,
              op.name AS operator_name,
              c.construction_number AS obra_numero,
              cl.name AS cliente,
              e.name AS equipamento
       FROM diary_helper_evaluations a
       LEFT JOIN users u ON u.id = a.helper_user_id
       LEFT JOIN users op ON op.id = a.operator_user_id
       LEFT JOIN constructions c ON c.id = a.construction_id
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN diaries d ON d.id = a.diary_id
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       ${whereSql}
       ORDER BY a.diary_date DESC, helper_name ASC, a.id DESC`,
      params
    )

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(
      rows.map((row) => ({
        Data: normalizeDateOnly(row.diary_date),
        Nome: textOrNull(row.helper_name) || '',
        Nota: Number(row.score || 0),
        Operador: textOrNull(row.operator_name) || '',
        Obra: textOrNull(row.obra_numero) || '',
        Cliente: textOrNull(row.cliente) || '',
        Equipamento: textOrNull(row.equipamento) || '',
      }))
    )

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Avaliacoes')
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="avaliacao-ajudantes.xlsx"')
    return res.send(buffer)
  } catch (e) {
    if (String(e.message || '').includes('diary_helper_evaluations')) {
      return err(res, 'A tabela de avaliacao de ajudantes ainda nao foi criada no banco.', 500)
    }
    err(res, e.message, 500)
  }
})

router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [[{ obras_andamento }]] = await db.query("SELECT COUNT(*) AS obras_andamento FROM constructions WHERE status = '1'")
    const [[{ obras_finalizadas }]] = await db.query("SELECT COUNT(*) AS obras_finalizadas FROM constructions WHERE status NOT IN ('1', 'P', 'C')")
    const [[{ maquinas_ativas }]] = await db.query("SELECT COUNT(*) AS maquinas_ativas FROM equipments WHERE active = 'Y'")
    const [[{ diarios_pendentes }]] = await db.query(
      "SELECT COUNT(*) AS diarios_pendentes FROM diaries WHERE COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')), ''), 'pendente') = 'pendente'"
    )

    ok(res, { data: { obras_andamento, obras_finalizadas, maquinas_ativas, diarios_pendentes } })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/dashboard/overview', async (_req, res) => {
  try {
    const [[{ obras_andamento }]] = await db.query("SELECT COUNT(*) AS obras_andamento FROM constructions WHERE status = '1'")
    const [[{ maquinas_ativas }]] = await db.query("SELECT COUNT(*) AS maquinas_ativas FROM equipments WHERE active = 'Y'")
    const [[{ diarios_concluidos }]] = await db.query(
      "SELECT COUNT(*) AS diarios_concluidos FROM diaries WHERE JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')) = 'concluido'"
    )
    const [[{ equipamentos_sem_modalidade }]] = await db.query(
      'SELECT COUNT(*) AS equipamentos_sem_modalidade FROM equipments WHERE equipment_type_id IS NULL'
    )
    const [[{ obras_pausadas }]] = await db.query("SELECT COUNT(*) AS obras_pausadas FROM constructions WHERE status = 'P'")

    const [obraActivities] = await db.query(
      `SELECT id, construction_number AS numero, status, updated_at AS atualizado_em
       FROM constructions
       ORDER BY updated_at DESC, id DESC
       LIMIT 5`
    )

    const [signedDiaries] = await db.query(
      `SELECT d.id,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.assinado_em')) AS assinado_em,
              COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento_nome
       FROM diaries d
       LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       WHERE COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente') = 'assinado'
       ORDER BY assinado_em DESC, d.id DESC
       LIMIT 5`
    )

    const recentActivities = [
      ...obraActivities.map((obra) => ({
        id: `obra-${obra.id}`,
        date: obra.atualizado_em,
        type: 'obra',
        title: `Obra ${obra.numero} atualizada`,
        description: `Status atual: ${mapLegacyConstructionStatus(obra.status)}.`,
      })),
      ...signedDiaries.map((diario) => ({
        id: `diario-${diario.id}`,
        date: diario.assinado_em,
        type: 'diario',
        title: `Diario ${diario.id} assinado`,
        description: `Obra ${diario.obra_numero || '-'}${diario.equipamento_nome ? ` com ${diario.equipamento_nome}` : ''}.`,
      })),
    ]
      .filter((item) => item.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)

    const alerts = []

    if (equipamentos_sem_modalidade > 0) {
      alerts.push({
        id: 'equipamentos-sem-modalidade',
        severity: 'warning',
        title: 'Equipamentos sem modalidade',
        description: `${equipamentos_sem_modalidade} equipamentos precisam de modalidade.`,
      })
    }

    if (obras_pausadas > 0) {
      alerts.push({
        id: 'obras-pausadas',
        severity: 'info',
        title: 'Obras pausadas',
        description: `${obras_pausadas} obras estao marcadas como pausadas.`,
      })
    }

    ok(res, {
      data: {
        stats: {
          obras_andamento,
          maquinas_ativas,
          diarios_concluidos,
        },
        recent_activities: recentActivities,
        alerts,
      },
    })
  } catch (e) {
    err(res, e.message, 500)
  }
})

// --- SETORES ---

router.get('/setores', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name AS nome FROM sectors ORDER BY name ASC')
    ok(res, { data: rows })
  } catch (e) { err(res, e.message, 500) }
})

// ============================================================
// MÓDULO: CURSOS E PROVAS
// ============================================================

function normalizeMonthRef(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`
  }

  const text = textOrNull(value)
  if (!text) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  }

  const monthMatch = text.match(/^(\d{4})-(\d{2})$/)
  if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}-01`

  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateMatch) return `${dateMatch[1]}-${dateMatch[2]}-01`

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-01`
  }

  return text
}

function buildMonthRange(monthRef) {
  const normalized = normalizeMonthRef(monthRef)
  const start = new Date(`${normalized}T00:00:00`)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)

  return {
    monthRef: normalized,
    start: `${normalized} 00:00:00`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')} 00:00:00`,
  }
}

async function ensureTrainingPointSettings(conn = db) {
  await conn.query(
    `INSERT INTO training_point_settings (
       id,
       points_course_completion,
       points_proof_approved,
       points_proof_failed
     ) VALUES (1, 5, 10, 2)
     ON DUPLICATE KEY UPDATE id = id`
  )
}

async function getTrainingPointSettings(conn = db) {
  await ensureTrainingPointSettings(conn)
  const [[row]] = await conn.query(
    `SELECT id,
            points_course_completion,
            points_proof_approved,
            points_proof_failed,
            created_at,
            updated_at
     FROM training_point_settings
     WHERE id = 1`
  )

  return {
    id: Number(row?.id || 1),
    points_course_completion: Number(row?.points_course_completion || 0),
    points_proof_approved: Number(row?.points_proof_approved || 0),
    points_proof_failed: Number(row?.points_proof_failed || 0),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  }
}

async function getTrainingMonthlyRaffle(monthRef = null, conn = db) {
  const normalizedMonth = normalizeMonthRef(monthRef)
  const [[row]] = await conn.query(
    `SELECT id, month_ref, title, description, prize, draw_date, status, banner_label, created_at, updated_at
     FROM training_monthly_raffles
     WHERE month_ref = ?
     LIMIT 1`,
    [normalizedMonth]
  )

  return row || null
}

async function upsertTrainingMonthlyRaffle(payload, conn = db) {
  const monthRef = normalizeMonthRef(payload.month_ref)
  const title = textOrNull(payload.title) || `Sorteio ${formatDateBr(monthRef).slice(3)}`
  const description = textOrNull(payload.description)
  const prize = textOrNull(payload.prize)
  const drawDate = normalizeDateOnly(payload.draw_date)
  const status = ['draft', 'active', 'closed'].includes(String(payload.status || ''))
    ? String(payload.status)
    : 'draft'
  const bannerLabel = textOrNull(payload.banner_label)

  await conn.query(
    `INSERT INTO training_monthly_raffles (
       month_ref,
       title,
       description,
       prize,
       draw_date,
       status,
       banner_label
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       description = VALUES(description),
       prize = VALUES(prize),
       draw_date = VALUES(draw_date),
       status = VALUES(status),
       banner_label = VALUES(banner_label)`,
    [monthRef, title, description, prize, drawDate, status, bannerLabel]
  )

  return getTrainingMonthlyRaffle(monthRef, conn)
}

async function getTrainingPointsTotals(userId, monthRef = null, conn = db) {
  const normalizedUserId = intOrNull(userId)
  if (!normalizedUserId) {
    return { month_points: 0, lifetime_points: 0, chances: 0 }
  }

  const { start, end } = buildMonthRange(monthRef)
  const [[monthRow]] = await conn.query(
    `SELECT COALESCE(SUM(points), 0) AS total
     FROM training_points_ledger
     WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
    [normalizedUserId, start, end]
  )
  const [[lifetimeRow]] = await conn.query(
    `SELECT COALESCE(SUM(points), 0) AS total
     FROM training_points_ledger
     WHERE user_id = ?`,
    [normalizedUserId]
  )

  return {
    month_points: Number(monthRow?.total || 0),
    lifetime_points: Number(lifetimeRow?.total || 0),
    chances: Number(monthRow?.total || 0),
  }
}

async function listTrainingRecentEvents(userId, monthRef = null, conn = db) {
  const normalizedUserId = intOrNull(userId)
  if (!normalizedUserId) return []

  const { start, end } = buildMonthRange(monthRef)
  const [rows] = await conn.query(
    `SELECT l.id,
            l.event_type,
            l.points,
            l.created_at,
            c.titulo AS curso_titulo,
            p.titulo AS prova_titulo
     FROM training_points_ledger l
     LEFT JOIN cursos c ON c.id = l.curso_id
     LEFT JOIN provas p ON p.id = l.prova_id
     WHERE l.user_id = ? AND l.created_at >= ? AND l.created_at < ?
     ORDER BY l.created_at DESC
     LIMIT 8`,
    [normalizedUserId, start, end]
  )
  return rows
}

async function awardTrainingPoints({
  conn = db,
  userId,
  cursoId = null,
  provaId = null,
  raffleId = null,
  eventType,
  referenceKey,
  points,
  metadata = null,
}) {
  const normalizedUserId = intOrNull(userId)
  const normalizedPoints = intOrNull(points) ?? 0
  const normalizedReference = textOrNull(referenceKey)

  if (!normalizedUserId || !normalizedReference || normalizedPoints <= 0) {
    return { awarded: false, reason: 'invalid_payload' }
  }

  const [[existing]] = await conn.query(
    'SELECT id, points FROM training_points_ledger WHERE reference_key = ? LIMIT 1',
    [normalizedReference]
  )
  if (existing) {
    return { awarded: false, reason: 'already_exists', entryId: Number(existing.id) }
  }

  const currentRaffle = await getTrainingMonthlyRaffle(null, conn)
  const raffleIdToUse = intOrNull(raffleId) || intOrNull(currentRaffle?.id)

  const [result] = await conn.query(
    `INSERT INTO training_points_ledger (
       user_id,
       curso_id,
       prova_id,
       raffle_id,
       event_type,
       points,
       reference_key,
       metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedUserId,
      intOrNull(cursoId),
      intOrNull(provaId),
      raffleIdToUse,
      eventType,
      normalizedPoints,
      normalizedReference,
      metadata ? JSON.stringify(metadata) : null,
    ]
  )

  return { awarded: true, entryId: Number(result.insertId), points: normalizedPoints }
}

async function buildTrainingAdminPayload(monthRef = null, conn = db) {
  const normalizedMonth = normalizeMonthRef(monthRef)
  const settings = await getTrainingPointSettings(conn)
  const raffle = await getTrainingMonthlyRaffle(normalizedMonth, conn)
  const { start, end } = buildMonthRange(normalizedMonth)

  const [ranking] = await conn.query(
    `SELECT u.id AS usuario_id,
            u.name AS nome,
            u.alias AS apelido,
            u.document AS documento,
            s.name AS setor_nome,
            COALESCE(SUM(l.points), 0) AS pontos,
            COUNT(l.id) AS eventos
     FROM users u
     LEFT JOIN sectors s ON s.id = u.sector_id
     LEFT JOIN training_points_ledger l
       ON l.user_id = u.id
      AND l.created_at >= ?
      AND l.created_at < ?
     WHERE u.active = 'S'
     GROUP BY u.id, u.name, u.alias, u.document, s.name
     HAVING pontos > 0
     ORDER BY pontos DESC, eventos DESC, u.name ASC
     LIMIT 100`,
    [start, end]
  )

  return {
    month_ref: normalizedMonth,
    settings,
    raffle,
    ranking,
  }
}

// --- ADMIN: Cursos ---

router.get('/cursos', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req)
    const [rows] = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM provas p WHERE p.curso_id = c.id AND p.ativo = 1) AS total_provas,
        (SELECT COUNT(*) FROM cursos_atribuicoes a WHERE a.curso_id = c.id) AS total_atribuicoes
       FROM cursos c ORDER BY c.criado_em DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    )
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM cursos')
    ok(res, { items: rows, total, page, limit })
  } catch (e) { err(res, e.message, 500) }
})

router.post('/cursos', async (req, res) => {
  try {
    const titulo = textOrNull(req.body.titulo)
    if (!titulo) return err(res, 'Título obrigatório')
    const [result] = await db.query(
      'INSERT INTO cursos (titulo, descricao, thumbnail_url, video_url) VALUES (?, ?, ?, ?)',
      [titulo, textOrNull(req.body.descricao), textOrNull(req.body.thumbnail_url), textOrNull(req.body.video_url)]
    )
    const [[row]] = await db.query('SELECT * FROM cursos WHERE id = ?', [result.insertId])
    ok(res, { data: row })
  } catch (e) { err(res, e.message, 500) }
})

// Rotas estáticas ANTES de /cursos/:id para evitar conflito de parâmetro
router.get('/cursos/resultados', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req)
    const cursoId = req.query.curso_id ? intOrNull(req.query.curso_id) : null
    const usuarioId = req.query.usuario_id ? intOrNull(req.query.usuario_id) : null

    let where = 'WHERE 1=1'
    const params = []
    if (cursoId) { where += ' AND p.curso_id = ?'; params.push(cursoId) }
    if (usuarioId) { where += ' AND t.usuario_id = ?'; params.push(usuarioId) }

    const [rows] = await db.query(
      `SELECT t.*, u.name AS usuario_nome, pr.titulo AS prova_titulo,
              c.id AS curso_id, c.titulo AS curso_titulo, pr.percentual_aprovacao
       FROM prova_tentativas t
       JOIN provas pr ON pr.id = t.prova_id
       JOIN cursos c ON c.id = pr.curso_id
       JOIN users u ON u.id = t.usuario_id
       ${where}
       ORDER BY t.realizado_em DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM prova_tentativas t
       JOIN provas pr ON pr.id = t.prova_id ${where}`,
      params
    )
    ok(res, { items: rows, total, page, limit })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/cursos/resultados/matriz', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req)
    const busca = textOrNull(req.query.busca)

    let where = "WHERE u.active = 'S'"
    const params = []

    if (busca) {
      where += ' AND (u.name LIKE ? OR u.alias LIKE ? OR u.document LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users u ${where}`, params)
    const [users] = await db.query(
      `SELECT u.id,
              u.name AS nome,
              u.alias AS apelido,
              u.document AS documento,
              u.sector_id AS setor_id,
              s.name AS setor_nome
       FROM users u
       LEFT JOIN sectors s ON s.id = u.sector_id
       ${where}
       ORDER BY u.name ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const [cursos] = await db.query(
      `SELECT c.id AS curso_id,
              c.titulo AS curso_titulo,
              p.id AS prova_id,
              p.titulo AS prova_titulo,
              p.percentual_aprovacao
       FROM cursos c
       LEFT JOIN provas p ON p.curso_id = c.id AND p.ativo = 1
       WHERE c.ativo = 1
       ORDER BY c.criado_em DESC, p.id ASC`
    )

    const userIds = users.map((user) => Number(user.id)).filter(Boolean)
    const sectorIds = [...new Set(users.map((user) => Number(user.setor_id)).filter(Boolean))]
    const courseIds = [...new Set(cursos.map((curso) => Number(curso.curso_id)).filter(Boolean))]

    let atribuicoes = []
    if (courseIds.length && (userIds.length || sectorIds.length)) {
      const clauses = []
      const attrParams = [courseIds]

      if (userIds.length) {
        clauses.push('a.usuario_id IN (?)')
        attrParams.push(userIds)
      }

      if (sectorIds.length) {
        clauses.push("(a.tipo = 'setor' AND a.setor_id IN (?))")
        attrParams.push(sectorIds)
      }

      const [rows] = await db.query(
        `SELECT a.curso_id, a.tipo, a.setor_id, a.usuario_id, a.tipo_acesso
         FROM cursos_atribuicoes a
         WHERE a.curso_id IN (?) AND (${clauses.join(' OR ')})`,
        attrParams
      )
      atribuicoes = rows
    }

    let tentativas = []
    if (courseIds.length && userIds.length) {
      const [rows] = await db.query(
        `SELECT p.curso_id,
                t.usuario_id,
                COUNT(*) AS tentativas,
                MAX(t.aprovado) AS aprovado,
                MAX(t.percentual) AS melhor_percentual,
                MAX(t.realizado_em) AS ultimo_realizado_em
         FROM prova_tentativas t
         JOIN provas p ON p.id = t.prova_id
         WHERE p.curso_id IN (?) AND t.usuario_id IN (?)
         GROUP BY p.curso_id, t.usuario_id`,
        [courseIds, userIds]
      )
      tentativas = rows
    }

    const accessRank = { so_curso: 1, so_prova: 2, curso_e_prova: 3 }
    const attemptsMap = new Map(
      tentativas.map((item) => [`${item.usuario_id}:${item.curso_id}`, item])
    )

    const columns = cursos.map((curso) => ({
      curso_id: Number(curso.curso_id),
      curso_titulo: curso.curso_titulo,
      prova_id: curso.prova_id ? Number(curso.prova_id) : null,
      prova_titulo: curso.prova_titulo || null,
      percentual_aprovacao: curso.percentual_aprovacao == null ? 70 : Number(curso.percentual_aprovacao),
    }))

    const rows = users.map((user) => {
      const userId = Number(user.id)
      const userSectorId = user.setor_id == null ? null : Number(user.setor_id)
      const cells = columns.map((column) => {
        const matchingAssignments = atribuicoes.filter((item) =>
          Number(item.curso_id) === column.curso_id &&
          ((item.usuario_id != null && Number(item.usuario_id) === userId) ||
            (item.tipo === 'setor' && userSectorId != null && item.setor_id != null && Number(item.setor_id) === userSectorId))
        )

        let tipoAcesso = null
        let highestRank = 0
        for (const item of matchingAssignments) {
          const currentRank = accessRank[item.tipo_acesso] || 0
          if (currentRank > highestRank) {
            highestRank = currentRank
            tipoAcesso = item.tipo_acesso
          }
        }

        const attempt = attemptsMap.get(`${userId}:${column.curso_id}`) || null
        const assigned = Boolean(tipoAcesso)
        const hasProva = Boolean(column.prova_id) && tipoAcesso !== 'so_curso'

        let status = 'nao_atribuido'
        if (assigned && !hasProva) status = 'somente_curso'
        if (assigned && hasProva && (!attempt || Number(attempt.tentativas || 0) === 0)) status = 'pendente'
        if (assigned && hasProva && attempt && Number(attempt.aprovado || 0) === 1) status = 'aprovado'
        if (assigned && hasProva && attempt && Number(attempt.aprovado || 0) !== 1) status = 'reprovado'

        return {
          curso_id: column.curso_id,
          tipo_acesso: tipoAcesso,
          assigned,
          has_prova: hasProva,
          tentativas: attempt ? Number(attempt.tentativas || 0) : 0,
          aprovado: attempt ? Number(attempt.aprovado || 0) : 0,
          melhor_percentual: attempt ? Number(attempt.melhor_percentual || 0) : null,
          ultimo_realizado_em: attempt?.ultimo_realizado_em || null,
          status,
        }
      })

      return {
        id: userId,
        nome: user.nome,
        apelido: user.apelido || null,
        documento: user.documento,
        setor_nome: user.setor_nome || null,
        cells,
      }
    })

    ok(res, { data: { columns, rows, total, page, limit } })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/cursos/pontos/config', async (req, res) => {
  try {
    const monthRef = normalizeMonthRef(req.query.month)
    const payload = await buildTrainingAdminPayload(monthRef)
    ok(res, { data: payload })
  } catch (e) { err(res, e.message, 500) }
})

router.put('/cursos/pontos/config', async (req, res) => {
  try {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await ensureTrainingPointSettings(conn)
      await conn.query(
        `UPDATE training_point_settings
         SET points_course_completion = ?,
             points_proof_approved = ?,
             points_proof_failed = ?
         WHERE id = 1`,
        [
          intOrNull(req.body.points_course_completion) ?? 0,
          intOrNull(req.body.points_proof_approved) ?? 0,
          intOrNull(req.body.points_proof_failed) ?? 0,
        ]
      )
      await conn.commit()
      const payload = await buildTrainingAdminPayload(normalizeMonthRef(req.body.month), conn)
      ok(res, { data: payload })
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  } catch (e) { err(res, e.message, 500) }
})

router.put('/cursos/pontos/sorteio-atual', async (req, res) => {
  try {
    const raffle = await upsertTrainingMonthlyRaffle(req.body)
    ok(res, { data: raffle })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/cursos/pontos/ranking', async (req, res) => {
  try {
    const monthRef = normalizeMonthRef(req.query.month)
    const { start, end } = buildMonthRange(monthRef)
    const [rows] = await db.query(
      `SELECT u.id AS usuario_id,
              u.name AS nome,
              u.alias AS apelido,
              u.document AS documento,
              s.name AS setor_nome,
              COALESCE(SUM(l.points), 0) AS pontos,
              COUNT(l.id) AS eventos
       FROM users u
       LEFT JOIN sectors s ON s.id = u.sector_id
       LEFT JOIN training_points_ledger l
         ON l.user_id = u.id
        AND l.created_at >= ?
        AND l.created_at < ?
       WHERE u.active = 'S'
       GROUP BY u.id, u.name, u.alias, u.document, s.name
       HAVING pontos > 0
       ORDER BY pontos DESC, eventos DESC, u.name ASC`,
      [start, end]
    )
    ok(res, { data: { month_ref: monthRef, items: rows } })
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/cursos/atribuicoes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM cursos_atribuicoes WHERE id = ?', [req.params.id])
    ok(res, { data: null })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/cursos/:id', async (req, res) => {
  try {
    const [[curso]] = await db.query('SELECT * FROM cursos WHERE id = ?', [req.params.id])
    if (!curso) return err(res, 'Curso não encontrado', 404)
    const [provas] = await db.query(
      `SELECT p.*, COUNT(q.id) AS total_questoes
       FROM provas p LEFT JOIN prova_questoes q ON q.prova_id = p.id
       WHERE p.curso_id = ? GROUP BY p.id ORDER BY p.criado_em ASC`,
      [req.params.id]
    )
    ok(res, { data: { ...curso, provas } })
  } catch (e) { err(res, e.message, 500) }
})

router.put('/cursos/:id', async (req, res) => {
  try {
    const titulo = textOrNull(req.body.titulo)
    if (!titulo) return err(res, 'Título obrigatório')
    await db.query(
      'UPDATE cursos SET titulo=?, descricao=?, thumbnail_url=?, video_url=?, ativo=? WHERE id=?',
      [titulo, textOrNull(req.body.descricao), textOrNull(req.body.thumbnail_url), textOrNull(req.body.video_url),
       req.body.ativo !== undefined ? (req.body.ativo ? 1 : 0) : 1, req.params.id]
    )
    const [[row]] = await db.query('SELECT * FROM cursos WHERE id = ?', [req.params.id])
    ok(res, { data: row })
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/cursos/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM cursos WHERE id = ?', [req.params.id])
    ok(res, { data: null })
  } catch (e) { err(res, e.message, 500) }
})

// --- ADMIN: Provas ---

router.post('/cursos/:cursoId/provas', async (req, res) => {
  try {
    const titulo = textOrNull(req.body.titulo)
    if (!titulo) return err(res, 'Título obrigatório')
    const percentual = intOrNull(req.body.percentual_aprovacao) ?? 70
    const [result] = await db.query(
      'INSERT INTO provas (curso_id, titulo, percentual_aprovacao) VALUES (?, ?, ?)',
      [req.params.cursoId, titulo, percentual]
    )
    const [[row]] = await db.query('SELECT * FROM provas WHERE id = ?', [result.insertId])
    ok(res, { data: row })
  } catch (e) { err(res, e.message, 500) }
})

router.put('/provas/:id', async (req, res) => {
  try {
    const titulo = textOrNull(req.body.titulo)
    if (!titulo) return err(res, 'Título obrigatório')
    const percentual = intOrNull(req.body.percentual_aprovacao) ?? 70
    await db.query(
      'UPDATE provas SET titulo=?, percentual_aprovacao=?, ativo=? WHERE id=?',
      [titulo, percentual, req.body.ativo !== undefined ? (req.body.ativo ? 1 : 0) : 1, req.params.id]
    )
    const [[row]] = await db.query('SELECT * FROM provas WHERE id = ?', [req.params.id])
    ok(res, { data: row })
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/provas/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM provas WHERE id = ?', [req.params.id])
    ok(res, { data: null })
  } catch (e) { err(res, e.message, 500) }
})

// --- ADMIN: Questões ---

router.get('/provas/:id/questoes', async (req, res) => {
  try {
    const [[prova]] = await db.query('SELECT * FROM provas WHERE id = ?', [req.params.id])
    if (!prova) return err(res, 'Prova não encontrada', 404)
    const [questoes] = await db.query(
      'SELECT * FROM prova_questoes WHERE prova_id = ? ORDER BY ordem ASC, id ASC',
      [req.params.id]
    )
    for (const q of questoes) {
      const [alts] = await db.query(
        'SELECT * FROM prova_alternativas WHERE questao_id = ? ORDER BY ordem ASC, id ASC',
        [q.id]
      )
      q.alternativas = alts
    }
    ok(res, { data: { ...prova, questoes } })
  } catch (e) { err(res, e.message, 500) }
})

router.post('/provas/:id/questoes', async (req, res) => {
  try {
    const enunciado = textOrNull(req.body.enunciado)
    if (!enunciado) return err(res, 'Enunciado obrigatório')
    const alternativas = req.body.alternativas
    if (!Array.isArray(alternativas) || alternativas.length < 2) return err(res, 'Mínimo 2 alternativas')
    if (!alternativas.some(a => a.correta)) return err(res, 'Marque ao menos uma alternativa correta')

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [qRes] = await conn.query(
        'INSERT INTO prova_questoes (prova_id, enunciado, ordem) VALUES (?, ?, ?)',
        [req.params.id, enunciado, intOrNull(req.body.ordem) ?? 0]
      )
      const questaoId = qRes.insertId
      for (let i = 0; i < alternativas.length; i++) {
        const a = alternativas[i]
        await conn.query(
          'INSERT INTO prova_alternativas (questao_id, texto, correta, ordem) VALUES (?, ?, ?, ?)',
          [questaoId, textOrNull(a.texto), a.correta ? 1 : 0, i]
        )
      }
      await conn.commit()
      const [[questao]] = await conn.query('SELECT * FROM prova_questoes WHERE id = ?', [questaoId])
      const [alts] = await conn.query('SELECT * FROM prova_alternativas WHERE questao_id = ? ORDER BY ordem ASC', [questaoId])
      questao.alternativas = alts
      ok(res, { data: questao })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (e) { err(res, e.message, 500) }
})

router.put('/questoes/:id', async (req, res) => {
  try {
    const enunciado = textOrNull(req.body.enunciado)
    if (!enunciado) return err(res, 'Enunciado obrigatório')
    const alternativas = req.body.alternativas
    if (!Array.isArray(alternativas) || alternativas.length < 2) return err(res, 'Mínimo 2 alternativas')
    if (!alternativas.some(a => a.correta)) return err(res, 'Marque ao menos uma alternativa correta')

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        'UPDATE prova_questoes SET enunciado=?, ordem=? WHERE id=?',
        [enunciado, intOrNull(req.body.ordem) ?? 0, req.params.id]
      )
      await conn.query('DELETE FROM prova_alternativas WHERE questao_id = ?', [req.params.id])
      for (let i = 0; i < alternativas.length; i++) {
        const a = alternativas[i]
        await conn.query(
          'INSERT INTO prova_alternativas (questao_id, texto, correta, ordem) VALUES (?, ?, ?, ?)',
          [req.params.id, textOrNull(a.texto), a.correta ? 1 : 0, i]
        )
      }
      await conn.commit()
      const [[questao]] = await conn.query('SELECT * FROM prova_questoes WHERE id = ?', [req.params.id])
      const [alts] = await conn.query('SELECT * FROM prova_alternativas WHERE questao_id = ? ORDER BY ordem ASC', [req.params.id])
      questao.alternativas = alts
      ok(res, { data: questao })
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  } catch (e) { err(res, e.message, 500) }
})

router.delete('/questoes/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM prova_questoes WHERE id = ?', [req.params.id])
    ok(res, { data: null })
  } catch (e) { err(res, e.message, 500) }
})

// --- ADMIN: Atribuições ---

router.get('/cursos/:id/atribuicoes', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*,
        s.name AS setor_nome,
        u.name AS usuario_nome
       FROM cursos_atribuicoes a
       LEFT JOIN sectors s ON s.id = a.setor_id
       LEFT JOIN users u ON u.id = a.usuario_id
       WHERE a.curso_id = ? ORDER BY a.criado_em DESC`,
      [req.params.id]
    )
    ok(res, { data: rows })
  } catch (e) { err(res, e.message, 500) }
})

router.post('/cursos/:id/atribuicoes', async (req, res) => {
  try {
    const tipo = req.body.tipo
    if (!['setor', 'usuario'].includes(tipo)) return err(res, 'Tipo inválido')
    if (tipo === 'setor' && !req.body.setor_id) return err(res, 'setor_id obrigatório')
    if (tipo === 'usuario' && !req.body.usuario_id) return err(res, 'usuario_id obrigatório')
    const tipoAcesso = ['curso_e_prova', 'so_curso', 'so_prova'].includes(req.body.tipo_acesso)
      ? req.body.tipo_acesso : 'curso_e_prova'
    const cursoId = intOrNull(req.params.id)
    const setorId = intOrNull(req.body.setor_id)
    const usuarioId = intOrNull(req.body.usuario_id)

    const [[curso]] = await db.query('SELECT id FROM cursos WHERE id = ? AND ativo = 1 LIMIT 1', [cursoId])
    if (!curso) return err(res, 'Curso não encontrado', 404)

    const [[proofInfo]] = await db.query(
      'SELECT COUNT(*) AS total FROM provas WHERE curso_id = ? AND ativo = 1',
      [cursoId]
    )
    const hasActiveProof = Number(proofInfo?.total || 0) > 0

    if (tipoAcesso !== 'so_curso' && !hasActiveProof) {
      return err(res, 'Este curso não possui prova ativa. Cadastre ou ative uma prova antes de atribuir acesso com prova.')
    }

    const [existingRows] = await db.query(
      `SELECT a.*, s.name AS setor_nome, u.name AS usuario_nome
       FROM cursos_atribuicoes a
       LEFT JOIN sectors s ON s.id = a.setor_id
       LEFT JOIN users u ON u.id = a.usuario_id
       WHERE a.curso_id = ?
         AND a.tipo = ?
         AND (a.setor_id <=> ?)
         AND (a.usuario_id <=> ?)
         AND COALESCE(a.tipo_acesso, 'curso_e_prova') = ?
       LIMIT 1`,
      [cursoId, tipo, setorId, usuarioId, tipoAcesso]
    )
    if (existingRows[0]) {
      return ok(res, { data: existingRows[0], already_exists: true })
    }

    const [result] = await db.query(
      'INSERT INTO cursos_atribuicoes (curso_id, tipo, setor_id, usuario_id, tipo_acesso) VALUES (?, ?, ?, ?, ?)',
      [cursoId, tipo, setorId, usuarioId, tipoAcesso]
    )
    const [[row]] = await db.query(
      `SELECT a.*, s.name AS setor_nome, u.name AS usuario_nome
       FROM cursos_atribuicoes a
       LEFT JOIN sectors s ON s.id = a.setor_id
       LEFT JOIN users u ON u.id = a.usuario_id
       WHERE a.id = ?`,
      [result.insertId]
    )
    ok(res, { data: row })
  } catch (e) { err(res, e.message, 500) }
})

// --- OPERADOR: Cursos atribuídos ---

router.get('/operador/cursos', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[usuario]] = await db.query('SELECT sector_id AS setor_id FROM users WHERE id = ?', [usuarioId])
    const setorId = usuario?.setor_id ?? null

    // Cursos atribuídos ao usuário diretamente ou ao seu setor
    const [cursos] = await db.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM provas p WHERE p.curso_id = c.id AND p.ativo = 1) AS tem_prova,
        (SELECT MAX(t.aprovado) FROM prova_tentativas t
         JOIN provas p ON p.id = t.prova_id
         WHERE p.curso_id = c.id AND t.usuario_id = ?) AS ja_aprovado,
        (SELECT COUNT(*) FROM prova_tentativas t
         JOIN provas p ON p.id = t.prova_id
         WHERE p.curso_id = c.id AND t.usuario_id = ?) AS tentativas,
        CASE MAX(
          CASE a.tipo_acesso
            WHEN 'curso_e_prova' THEN 3
            WHEN 'so_prova' THEN 2
            WHEN 'so_curso' THEN 1
            ELSE 0
          END
        )
          WHEN 3 THEN 'curso_e_prova'
          WHEN 2 THEN 'so_prova'
          WHEN 1 THEN 'so_curso'
          ELSE 'curso_e_prova'
        END AS tipo_acesso
       FROM cursos c
       JOIN cursos_atribuicoes a ON a.curso_id = c.id
       WHERE c.ativo = 1
         AND ((a.tipo = 'usuario' AND a.usuario_id = ?) OR (a.tipo = 'setor' AND a.setor_id = ?))
       GROUP BY c.id
       ORDER BY c.criado_em DESC`,
      [usuarioId, usuarioId, usuarioId, setorId]
    )
    ok(res, { data: cursos })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/operador/cursos/pendencias', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[usuario]] = await db.query('SELECT sector_id AS setor_id FROM users WHERE id = ?', [usuarioId])
    const setorId = usuario?.setor_id ?? null

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT c.id) AS total
       FROM cursos c
       JOIN cursos_atribuicoes a ON a.curso_id = c.id
       WHERE c.ativo = 1
         AND a.tipo_acesso IN ('curso_e_prova', 'so_prova')
         AND EXISTS (
           SELECT 1 FROM provas p2
           WHERE p2.curso_id = c.id AND p2.ativo = 1
         )
         AND ((a.tipo = 'usuario' AND a.usuario_id = ?) OR (a.tipo = 'setor' AND a.setor_id = ?))
         AND NOT EXISTS (
           SELECT 1 FROM prova_tentativas t
           JOIN provas p ON p.id = t.prova_id
           WHERE p.curso_id = c.id AND t.usuario_id = ?
         )`,
      [usuarioId, setorId, usuarioId]
    )
    ok(res, { data: { pendencias: total } })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/operador/cursos/pontos', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const monthRef = normalizeMonthRef(req.query.month)
    const totals = await getTrainingPointsTotals(usuarioId, monthRef)
    const settings = await getTrainingPointSettings()
    const raffle = await getTrainingMonthlyRaffle(monthRef)
    const recentEvents = await listTrainingRecentEvents(usuarioId, monthRef)

    ok(res, {
      data: {
        month_ref: monthRef,
        points: totals,
        settings,
        raffle,
        recent_events: recentEvents,
      },
    })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/operador/cursos/:id', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[usuario]] = await db.query('SELECT sector_id AS setor_id FROM users WHERE id = ?', [usuarioId])
    const [[curso]] = await db.query('SELECT * FROM cursos WHERE id = ? AND ativo = 1', [req.params.id])
    if (!curso) return err(res, 'Curso não encontrado', 404)

    const [[prova]] = await db.query(
      'SELECT id, titulo, percentual_aprovacao FROM provas WHERE curso_id = ? AND ativo = 1 LIMIT 1',
      [req.params.id]
    )

    let ultimaTentativa = null
    let tentativas = 0
    let jaAprovado = null
    if (prova) {
      const [[tent]] = await db.query(
        'SELECT * FROM prova_tentativas WHERE prova_id = ? AND usuario_id = ? ORDER BY realizado_em DESC LIMIT 1',
        [prova.id, usuarioId]
      )
      ultimaTentativa = tent ?? null

      const [[tentativaStats]] = await db.query(
        `SELECT COUNT(*) AS tentativas, MAX(aprovado) AS ja_aprovado
         FROM prova_tentativas
         WHERE prova_id = ? AND usuario_id = ?`,
        [prova.id, usuarioId]
      )
      tentativas = Number(tentativaStats?.tentativas || 0)
      jaAprovado = tentativaStats?.ja_aprovado == null ? null : Number(tentativaStats.ja_aprovado)
    }

    const [[courseCompletion]] = await db.query(
      `SELECT id, points, created_at
       FROM training_points_ledger
       WHERE user_id = ?
         AND curso_id = ?
         AND event_type = 'curso_concluido'
       ORDER BY created_at DESC
       LIMIT 1`,
      [usuarioId, req.params.id]
    )

    const [[proofCompletion]] = await db.query(
      `SELECT id, points, created_at
       FROM training_points_ledger
       WHERE user_id = ?
         AND curso_id = ?
         AND event_type = 'prova_aprovada'
       ORDER BY created_at DESC
       LIMIT 1`,
      [usuarioId, req.params.id]
    )

    const [[tipoAcessoRow]] = await db.query(
      `SELECT CASE MAX(
          CASE a.tipo_acesso
            WHEN 'curso_e_prova' THEN 3
            WHEN 'so_prova' THEN 2
            WHEN 'so_curso' THEN 1
            ELSE 0
          END
        )
          WHEN 3 THEN 'curso_e_prova'
          WHEN 2 THEN 'so_prova'
          WHEN 1 THEN 'so_curso'
          ELSE 'curso_e_prova'
        END AS tipo_acesso
       FROM cursos_atribuicoes a
       WHERE a.curso_id = ?
         AND ((a.tipo = 'usuario' AND a.usuario_id = ?) OR (a.tipo = 'setor' AND a.setor_id = ?))`,
      [req.params.id, usuarioId, usuario?.setor_id ?? null]
    )

    ok(res, {
      data: {
        ...curso,
        tem_prova: prova ? 1 : 0,
        prova: prova ?? null,
        ja_aprovado: jaAprovado,
        tentativas,
        ultima_tentativa: ultimaTentativa,
        tipo_acesso: tipoAcessoRow?.tipo_acesso || 'curso_e_prova',
        concluido_sem_prova: Boolean(courseCompletion),
        curso_concluido_em: courseCompletion?.created_at || null,
        curso_concluido_pontos: Number(courseCompletion?.points || 0),
        prova_concluida_em: proofCompletion?.created_at || null,
        prova_concluida_pontos: Number(proofCompletion?.points || 0),
      },
    })
  } catch (e) { err(res, e.message, 500) }
})

router.post('/operador/cursos/:id/concluir', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[usuario]] = await db.query('SELECT sector_id AS setor_id FROM users WHERE id = ?', [usuarioId])
    const [[curso]] = await db.query('SELECT * FROM cursos WHERE id = ? AND ativo = 1', [req.params.id])
    if (!curso) return err(res, 'Curso não encontrado', 404)

    const [[prova]] = await db.query(
      'SELECT id FROM provas WHERE curso_id = ? AND ativo = 1 LIMIT 1',
      [req.params.id]
    )
    const [[tipoAcessoRow]] = await db.query(
      `SELECT CASE MAX(
          CASE a.tipo_acesso
            WHEN 'curso_e_prova' THEN 3
            WHEN 'so_prova' THEN 2
            WHEN 'so_curso' THEN 1
            ELSE 0
          END
        )
          WHEN 3 THEN 'curso_e_prova'
          WHEN 2 THEN 'so_prova'
          WHEN 1 THEN 'so_curso'
          ELSE 'curso_e_prova'
        END AS tipo_acesso
       FROM cursos_atribuicoes a
       WHERE a.curso_id = ?
         AND ((a.tipo = 'usuario' AND a.usuario_id = ?) OR (a.tipo = 'setor' AND a.setor_id = ?))`,
      [req.params.id, usuarioId, usuario?.setor_id ?? null]
    )

    const tipoAcesso = tipoAcessoRow?.tipo_acesso || 'curso_e_prova'
    const hasMandatoryProof = Boolean(prova) && tipoAcesso !== 'so_curso'
    if (hasMandatoryProof) {
      return err(res, 'Este curso depende da prova para gerar a conclusão', 400)
    }

    const settings = await getTrainingPointSettings()
    const pointResult = await awardTrainingPoints({
      userId: usuarioId,
      cursoId: req.params.id,
      eventType: 'curso_concluido',
      referenceKey: `curso_concluido:${usuarioId}:${req.params.id}`,
      points: settings.points_course_completion,
      metadata: {
        curso_id: intOrNull(req.params.id),
        trigger: 'operador_curso_sem_prova',
      },
    })

    const totals = await getTrainingPointsTotals(usuarioId)
    ok(res, {
      data: {
        awarded: pointResult.awarded,
        points: pointResult.awarded ? Number(pointResult.points || 0) : 0,
        totals,
      },
    })
  } catch (e) { err(res, e.message, 500) }
})

router.get('/operador/provas/:id/questoes', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[prova]] = await db.query('SELECT * FROM provas WHERE id = ? AND ativo = 1', [req.params.id])
    if (!prova) return err(res, 'Prova não encontrada', 404)

    const [[approvedAttempt]] = await db.query(
      'SELECT id FROM prova_tentativas WHERE prova_id = ? AND usuario_id = ? AND aprovado = 1 LIMIT 1',
      [req.params.id, usuarioId]
    )
    if (approvedAttempt) return err(res, 'Esta prova já foi concluída com aprovação.', 400)

    const [questoes] = await db.query(
      'SELECT id, enunciado, ordem FROM prova_questoes WHERE prova_id = ? ORDER BY ordem ASC, id ASC',
      [req.params.id]
    )
    for (const q of questoes) {
      const [alts] = await db.query(
        'SELECT id, texto, ordem FROM prova_alternativas WHERE questao_id = ? ORDER BY ordem ASC',
        [q.id]
      )
      q.alternativas = alts
    }
    ok(res, { data: { ...prova, questoes } })
  } catch (e) { err(res, e.message, 500) }
})

router.post('/operador/provas/:id/tentativa', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[prova]] = await db.query('SELECT * FROM provas WHERE id = ? AND ativo = 1', [req.params.id])
    if (!prova) return err(res, 'Prova não encontrada', 404)

    const [[approvedAttempt]] = await db.query(
      'SELECT id FROM prova_tentativas WHERE prova_id = ? AND usuario_id = ? AND aprovado = 1 LIMIT 1',
      [req.params.id, usuarioId]
    )
    if (approvedAttempt) return err(res, 'Esta prova já foi concluída com aprovação.', 400)

    const respostas = req.body.respostas // [{questao_id, alternativa_id}]
    if (!Array.isArray(respostas) || respostas.length === 0) return err(res, 'Respostas obrigatórias')

    const [questoes] = await db.query(
      'SELECT q.id, a.id AS alt_correta FROM prova_questoes q JOIN prova_alternativas a ON a.questao_id = q.id AND a.correta = 1 WHERE q.prova_id = ?',
      [req.params.id]
    )

    const total = questoes.length
    let acertos = 0
    const respostasDetalhadas = respostas.map(r => {
      const q = questoes.find(x => x.id === r.questao_id)
      const correta = q ? q.alt_correta === r.alternativa_id : false
      if (correta) acertos++
      return { questao_id: r.questao_id, alternativa_id: r.alternativa_id, correta }
    })

    const percentual = total > 0 ? parseFloat(((acertos / total) * 100).toFixed(2)) : 0
    const aprovado = percentual >= prova.percentual_aprovacao ? 1 : 0

    const conn = await db.getConnection()
    let result
    let awardedPoints = 0
    let totals = { month_points: 0, lifetime_points: 0, chances: 0 }
    try {
      await conn.beginTransaction()
      ;[result] = await conn.query(
        'INSERT INTO prova_tentativas (prova_id, usuario_id, acertos, total_questoes, percentual, aprovado, respostas_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [prova.id, usuarioId, acertos, total, percentual, aprovado, JSON.stringify(respostasDetalhadas)]
      )

      const settings = await getTrainingPointSettings(conn)
      const pointResult = await awardTrainingPoints({
        conn,
        userId: usuarioId,
        cursoId: prova.curso_id,
        provaId: prova.id,
        eventType: aprovado === 1 ? 'prova_aprovada' : 'prova_reprovada',
        referenceKey: `${aprovado === 1 ? 'prova_aprovada' : 'prova_reprovada'}:${usuarioId}:${result.insertId}`,
        points: aprovado === 1 ? settings.points_proof_approved : settings.points_proof_failed,
        metadata: {
          tentativa_id: Number(result.insertId),
          percentual,
          acertos,
          total_questoes: total,
        },
      })
      awardedPoints = pointResult.awarded ? Number(pointResult.points || 0) : 0

      await conn.commit()
      totals = await getTrainingPointsTotals(usuarioId, null, conn)
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }

    ok(res, {
      data: {
        id: result.insertId,
        acertos,
        total_questoes: total,
        percentual,
        aprovado: aprovado === 1,
        percentual_aprovacao: prova.percentual_aprovacao,
        points_awarded: awardedPoints,
        totals,
      }
    })
  } catch (e) { err(res, e.message, 500) }
})

// ── Conferência de Estacas ────────────────────────────────────────────────────

router.get('/conferencia-estacas', async (req, res) => {
  try {
    const { page, limit, offset } = paginate(req)
    const conferenciaStatus = textOrNull(req.query.conferencia_status)
    const obraNumero = textOrNull(req.query.obra_numero)

    const diaryStatusExpr = "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.status')), ''), 'pendente')"
    const diaryDateExpr = "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d'))"
    const diaryConstructionExpr = "COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number')))"
    const diaryEquipmentIdExpr = "CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)"

    let where = `WHERE ${diaryStatusExpr} = 'assinado'`
    const params = []

    if (conferenciaStatus) {
      where += ' AND d.conferencia_status = ?'
      params.push(conferenciaStatus)
    }
    if (obraNumero) {
      where += ` AND ${diaryConstructionExpr} LIKE ?`
      params.push(`%${obraNumero}%`)
    }

    const fromClause = `
      FROM diaries d
      LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN equipments e ON e.id = ${diaryEquipmentIdExpr}
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN users cu ON cu.id = d.conferencia_por
    `

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${fromClause} ${where}`, params)

    const [rows] = await db.query(
      `SELECT d.id,
              COALESCE(c.id, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED), 0) AS obra_id,
              ${diaryDateExpr} AS data_diario,
              ${diaryConstructionExpr} AS obra_numero,
              COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
              u.name AS operador_nome,
              d.conferencia_status,
              d.conferencia_em,
              d.conferencia_obs,
              cu.name AS conferencia_por_nome,
              d.data AS raw_data
       ${fromClause}
       ${where}
       ORDER BY d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    // Fetch obra_producao for each unique obra
    const obraIds = [...new Set(rows.map((r) => r.obra_id).filter(Boolean))]
    const producaoMap = new Map()
    if (obraIds.length) {
      const [producaoRows] = await db.query(
        'SELECT obra_id, diametro, profundidade, qtd_estacas FROM obra_producao WHERE obra_id IN (?)',
        [obraIds]
      )
      for (const p of producaoRows) {
        if (!producaoMap.has(p.obra_id)) producaoMap.set(p.obra_id, [])
        producaoMap.get(p.obra_id).push(p)
      }
    }

    const items = rows.map((row) => {
      const data = safeParseJson(row.raw_data)
      const parsed = typeof data === 'object' && data ? data : {}
      const estacas = extractEstacasFromDiaryData(parsed)
      const producao = producaoMap.get(Number(row.obra_id)) || []
      const autoComparacao = compararEstacasComProducao(estacas, producao)

      return {
        id: Number(row.id),
        obraId: Number(row.obra_id),
        obraNumero: row.obra_numero || '',
        cliente: row.cliente || '',
        dataDiario: row.data_diario || '',
        equipamento: row.equipamento || '',
        operadorNome: row.operador_nome || '',
        conferenciaStatus: row.conferencia_status,
        conferenciaEm: row.conferencia_em || null,
        conferenciaObs: row.conferencia_obs || null,
        conferenciaPorNome: row.conferencia_por_nome || null,
        estacas,
        producaoPlanejada: producao,
        autoComparacao,
      }
    })

    ok(res, { data: items, total, page, limit })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/conferencia-estacas/:id/aprovar', async (req, res) => {
  try {
    const id = intOrNull(req.params.id)
    if (!id) return err(res, 'ID inválido')
    const obs = textOrNull(req.body?.obs)
    const adminId = intOrNull(req.body?.admin_id ?? req.session?.userId)

    const [result] = await db.query(
      `UPDATE diaries
       SET conferencia_status = 'aprovado', conferencia_em = NOW(), conferencia_por = ?, conferencia_obs = ?
       WHERE id = ?`,
      [adminId, obs, id]
    )
    if (result.affectedRows === 0) return err(res, 'Diário não encontrado', 404)
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/conferencia-estacas/:id/rejeitar', async (req, res) => {
  try {
    const id = intOrNull(req.params.id)
    if (!id) return err(res, 'ID inválido')
    const obs = textOrNull(req.body?.obs)
    if (!obs) return err(res, 'Observação é obrigatória para rejeição')
    const adminId = intOrNull(req.body?.admin_id ?? req.session?.userId)

    const [result] = await db.query(
      `UPDATE diaries
       SET conferencia_status = 'rejeitado', conferencia_em = NOW(), conferencia_por = ?, conferencia_obs = ?
       WHERE id = ?`,
      [adminId, obs, id]
    )
    if (result.affectedRows === 0) return err(res, 'Diário não encontrado', 404)
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

// ─── Certificado de Conclusão de Curso ────────────────────────────────────────
router.get('/operador/cursos/:id/certificado', async (req, res) => {
  try {
    const usuarioId = req.session?.operador?.id
    if (!usuarioId) return err(res, 'Não autorizado', 401)

    const [[curso]] = await db.query('SELECT id, titulo FROM cursos WHERE id = ? AND ativo = 1', [req.params.id])
    if (!curso) return err(res, 'Curso não encontrado', 404)

    const [[usuario]] = await db.query('SELECT name AS nome FROM users WHERE id = ?', [usuarioId])
    if (!usuario) return err(res, 'Usuário não encontrado', 404)

    // Verifica aprovação via prova
    const [[prova]] = await db.query(
      'SELECT id FROM provas WHERE curso_id = ? AND ativo = 1 LIMIT 1',
      [req.params.id]
    )

    let autorizado = false
    if (prova) {
      const [[tent]] = await db.query(
        'SELECT MAX(aprovado) AS aprovado FROM prova_tentativas WHERE prova_id = ? AND usuario_id = ?',
        [prova.id, usuarioId]
      )
      autorizado = Number(tent?.aprovado) === 1
    }

    // Verifica conclusão sem prova
    if (!autorizado) {
      const [[completion]] = await db.query(
        `SELECT id FROM training_points_ledger
         WHERE user_id = ? AND curso_id = ? AND event_type = 'curso_concluido' LIMIT 1`,
        [usuarioId, req.params.id]
      )
      autorizado = !!completion
    }

    if (!autorizado) return err(res, 'Certificado disponível apenas após conclusão do curso', 403)

    // ── Gera PDF ──────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => {
      const buf = Buffer.concat(chunks)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `inline; filename="certificado-curso-${curso.id}.pdf"`)
      res.send(buf)
    })

    const W = 841.89
    const H = 595.28
    const RED = '#c0392b'
    const DARK_RED = '#7b1d1d'
    const nome = String(usuario.nome || '').toUpperCase()

    // Fundo branco
    doc.rect(0, 0, W, H).fill('#ffffff')

    // Borda esquerda vermelha
    doc.rect(0, 0, 6, H).fill(RED)

    // Header vermelho
    doc.rect(0, 0, W, 88).fill(RED)

    // Triângulo decorativo canto esquerdo
    doc.save()
    doc.polygon([0, 88], [100, 88], [0, 150]).fill(DARK_RED)
    doc.restore()

    // Triângulo decorativo canto direito
    doc.save()
    doc.polygon([W, 88], [W - 100, 88], [W, 150]).fill(DARK_RED)
    doc.restore()

    // Rodapé vermelho
    doc.rect(0, H - 54, W, 54).fill(RED)

    // ── Textos do header ──
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
       .text('GONTIJO FUNDAÇÕES', 30, 22, { width: 300 })
    doc.fillColor('rgba(255,255,255,0.75)').font('Helvetica').fontSize(9)
       .text('Engenharia de Fundações e Estacas', 30, 40, { width: 300 })

    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18)
       .text('CERTIFICADO DE CONCLUSÃO', 0, 30, { align: 'right', width: W - 32 })

    // ── Conteúdo central ──
    const cy = 125

    doc.fillColor('#64748b').font('Helvetica').fontSize(12)
       .text('Certificamos que', 0, cy, { align: 'center', width: W })

    doc.fillColor(RED).font('Helvetica-Bold').fontSize(30)
       .text(nome, 60, cy + 26, { align: 'center', width: W - 120 })

    // Linha sob o nome
    doc.moveTo(W / 2 - 160, cy + 70).lineTo(W / 2 + 160, cy + 70)
       .lineWidth(1).strokeColor('#e2e8f0').stroke()

    doc.fillColor('#334155').font('Helvetica').fontSize(13)
       .text('concluiu com êxito o curso', 0, cy + 84, { align: 'center', width: W })

    doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(20)
       .text(curso.titulo, 80, cy + 108, { align: 'center', width: W - 160 })

    // Linha decorativa
    doc.moveTo(W / 2 - 80, cy + 160).lineTo(W / 2 + 80, cy + 160)
       .lineWidth(1.5).strokeColor(RED).stroke()

    const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    doc.fillColor('#64748b').font('Helvetica').fontSize(10)
       .text(`Emitido em ${dataEmissao}`, 0, cy + 170, { align: 'center', width: W })

    // Rodapé
    doc.fillColor('#ffffff').font('Helvetica').fontSize(9)
       .text('Gontijo Fundações — Sistema de Treinamento Corporativo', 0, H - 36, { align: 'center', width: W })

    doc.end()
  } catch (e) { err(res, e.message, 500) }
})

// ── Fato Observado ────────────────────────────────────────────────────────────

router.post('/operador/fatos-observados', async (req, res) => {
  try {
    const operadorId = req.session?.operador?.id
    if (!operadorId) return err(res, 'Não autorizado', 401)
    const { tipo, local_ref, descricao } = req.body
    if (!tipo || !['positivo', 'negativo'].includes(tipo)) return err(res, 'Tipo inválido', 400)
    if (!descricao || !descricao.trim()) return err(res, 'Descrição obrigatória', 400)
    await db.query(
      'INSERT INTO fatos_observados (operador_id, tipo, local_ref, descricao) VALUES (?, ?, ?, ?)',
      [operadorId, tipo, local_ref || null, descricao.trim()]
    )
    res.json({ ok: true })
  } catch (e) { err(res, e.message, 500) }
})

// ── Indicações de Obra ────────────────────────────────────────────────────────

router.post('/operador/indicacoes-obra', async (req, res) => {
  try {
    const operadorId = req.session?.operador?.id
    if (!operadorId) return err(res, 'Não autorizado', 401)
    const { contato_nome, contato_telefone, endereco, tipo_servico, observacoes } = req.body
    if (!contato_nome || !contato_nome.trim()) return err(res, 'Nome do contato obrigatório', 400)
    if (!endereco || !endereco.trim()) return err(res, 'Endereço obrigatório', 400)
    await db.query(
      'INSERT INTO indicacoes_obra (operador_id, contato_nome, contato_telefone, endereco, tipo_servico, observacoes) VALUES (?, ?, ?, ?, ?, ?)',
      [operadorId, contato_nome.trim(), contato_telefone || null, endereco.trim(), tipo_servico || null, observacoes || null]
    )
    res.json({ ok: true })
  } catch (e) { err(res, e.message, 500) }
})

module.exports = router
