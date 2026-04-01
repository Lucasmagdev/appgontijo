const express = require('express')
const bcrypt = require('bcrypt')
const PDFDocument = require('pdfkit')
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
        return nome ? { usuario_id: null, nome_membro: nome } : null
      }

      if (!item || typeof item !== 'object') {
        return null
      }

      const usuario_id = intOrNull(item.usuario_id ?? item.user_id ?? item.userId ?? item.id)
      const nome_membro = textOrNull(item.nome_membro ?? item.nome ?? item.item ?? item.name)
      if (usuario_id === null && !nome_membro) return null

      return { usuario_id, nome_membro: nome_membro || '' }
    })
    .filter(Boolean)
}

function mergeDiaryJson(row, options = {}) {
  const parsed = normalizeLegacyDiaryDataValue(row.dados_json ?? row.raw_data ?? row.data)
  const nextData = { ...parsed }

  if (options.staffRows) {
    const existingStaff = normalizeDiaryStaffInput(parsed.staff)
    const mergedRows = [...options.staffRows]

    existingStaff.forEach((item) => {
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
    minimum_amount: numberOrNull(body.fat_minimo_valor),
    use_bits: body.usa_bits ? 'Y' : 'N',
    bits_value: textOrNull(body.valor_bits),
    total_production: numberOrNull(body.total_producao),
    mobilization_amount: numberOrNull(body.mobilizacao),
    demobilization_amount: numberOrNull(body.desmobilizacao),
    total: numberOrNull(body.total_geral),
    gontijo_responsable: textOrNull(body.responsavel_comercial_gontijo),
    gontijo_phone: textOrNull(body.tel_comercial_gontijo),
    contractor: textOrNull(body.responsavel_contratante),
    contractor_phone: textOrNull(body.tel_contratante),
    acr_not: textOrNull(body.observacoes),
  }
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

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
    return String(value)
  }

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
  const date = new Date(value)
  if (!Number.isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear())
    return `${day}-${month}-${year}`
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`
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
      firstFilledValue(row.compCravado, row.comp_cravado, row.meters, '-'),
      firstFilledValue(row.secao, row.secao_id, row.section, '-'),
      firstFilledValue(row.nega, '-'),
      firstFilledValue(row.soldas, '0'),
      firstFilledValue(row.cortes, '0'),
    ])
    return {
      title: 'Serviços Executados - Estacas',
      headers: ['Pilar/Estaca', 'Comp. Cravado', 'Seção', 'Nega', 'Soldas', 'Cortes'],
      widths: [0.22, 0.2, 0.15, 0.13, 0.15, 0.15],
      rows: mappedRows,
      totalsRow: [`${mappedRows.length} estacas`, '-', '-', '-', '-', '-'],
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

  return {
    data,
    obraNumber: firstFilledValue(diario.obra_numero, data.construction_number, '-'),
    clientName: firstFilledValue(diario.cliente, data.client, '-'),
    machineName: firstFilledValue(diario.equipamento, extractDiaryEquipmentName(diario), '-'),
    operatorName: firstFilledValue(diario.operador_nome, '-'),
    dateBr: formatDateBr(diario.data_diario || data.date),
    address: [address.street, address.number, address.neighborhood].filter(Boolean).join(', ') || '-',
    team: teamRows
      .map((item) => firstFilledValue(item.item, item.name, item.nome, item.nome_membro))
      .filter(Boolean)
      .join(', ') || '-',
    weather: parseWeatherFlags(data),
    startTime: firstFilledValue(data.start, '-'),
    endTime: firstFilledValue(data.end, '-'),
    clientOnSite: firstFilledValue(data.client, diario.cliente, '-'),
    modality: firstFilledValue(data.modality, '-'),
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
      size: 6.5,
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
        size: 7,
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
    const gray = '#d7d3ce'
    const border = '#9e9a94'

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    drawBox(doc, left, top, pageWidth, 44, { fill: gray, stroke: border })
    drawText(doc, 'GONTIJO', left + 6, top + 8, 82, {
      font: 'Helvetica-Bold',
      size: 14,
    })
    drawText(doc, 'FUNDAÇÕES', left + 10, top + 28, 72, {
      size: 7.5,
      color: '#666666',
    })
    drawText(doc, 'DIÁRIO DE OBRA', left + 120, top + 15, 250, {
      font: 'Helvetica-Bold',
      size: 14,
      align: 'center',
    })
    drawText(doc, `N° DA OBRA: ${ctx.obraNumber}`, left + 380, top + 15, 130, {
      font: 'Helvetica-Bold',
      size: 9,
      align: 'right',
    })

    const row1Y = top + 44
    drawBox(doc, left, row1Y, 322, 30, { stroke: border })
    drawBox(doc, left + 322, row1Y, 74, 30, { stroke: border })
    drawBox(doc, left + 396, row1Y, 108, 30, { stroke: border })
    drawText(doc, 'Cliente:', left + 6, row1Y + 10, 40, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.clientName, left + 44, row1Y + 10, 268, { size: 7 })
    drawText(doc, 'Equipamento', left + 322 + 6, row1Y + 10, 60, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, 'Data:', left + 396 + 6, row1Y + 10, 26, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.dateBr, left + 396 + 60, row1Y + 10, 40, { size: 7, align: 'right' })

    const row2Y = row1Y + 30
    drawBox(doc, left, row2Y, 322, 30, { stroke: border })
    drawBox(doc, left + 322, row2Y, 74, 30, { stroke: border })
    drawBox(doc, left + 396, row2Y, 108, 30, { stroke: border })
    drawText(doc, 'Endereço:', left + 6, row2Y + 9, 42, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.address, left + 50, row2Y + 9, 262, { size: 6.4 })
    drawText(doc, ctx.machineName, left + 322, row2Y + 9, 74, { font: 'Helvetica-Bold', size: 10, align: 'center' })
    drawText(doc, 'Horário início:', left + 396 + 6, row2Y + 7, 52, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.startTime, left + 396 + 70, row2Y + 7, 28, { size: 7, align: 'right' })

    const row3Y = row2Y + 30
    drawBox(doc, left, row3Y, 322, 30, { stroke: border })
    drawBox(doc, left + 322, row3Y, 74, 30, { stroke: border })
    drawBox(doc, left + 396, row3Y, 108, 30, { stroke: border })
    drawText(doc, 'Equipe:', left + 6, row3Y + 8, 34, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.team, left + 38, row3Y + 8, 274, { size: 6.2 })
    drawText(doc, 'Horário término:', left + 396 + 6, row3Y + 7, 58, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.endTime, left + 396 + 70, row3Y + 7, 28, { size: 7, align: 'right' })

    const weatherY = row3Y + 38
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
        responsavel_comercial_gontijo: textOrNull(obra.gontijo_responsable),
        tel_comercial_gontijo: textOrNull(obra.gontijo_phone),
        responsavel_contratante: textOrNull(obra.contractor),
        tel_contratante: textOrNull(obra.contractor_phone),
        observacoes: textOrNull(obra.acr_not),
        producao: [],
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
    const fetchWindow = Math.max(limit + offset + 200, 400)
    const [rawRows] = await db.query(
      `SELECT d.id, d.data AS raw_data, d.user_id AS operador_id, d.created_at, d.updated_at
       FROM diaries d
       ORDER BY d.id DESC
       LIMIT ?`,
      [fetchWindow]
    )

    const parsedRows = rawRows.map((row) => {
      const data = normalizeLegacyDiaryDataValue(row.raw_data)
      return {
        id: Number(row.id),
        raw_data: row.raw_data,
        parsed_data: data,
        obra_id: intOrNull(data.construction_id ?? data.obra_id),
        equipamento_id: intOrNull(data.equipment_id),
        data_diario: normalizeLegacyDiaryDateValue(data.date, row.created_at),
        status: normalizeLegacyDiaryStatus(data.status),
        assinado_em: textOrNull(data.assinado_em),
        operador_id: intOrNull(row.operador_id),
        created_at: row.created_at,
      }
    })

    const constructionMap = await listLegacyConstructionsMap(parsedRows.map((row) => row.obra_id))
    const equipmentMap = await listLegacyEquipmentsMap(parsedRows.map((row) => row.equipamento_id))
    const userMap = await listLegacyUsersMap(parsedRows.map((row) => row.operador_id))

    const hydratedRows = parsedRows.map((row) => {
      const construction = constructionMap.get(Number(row.obra_id)) || null
      const equipment = equipmentMap.get(Number(row.equipamento_id)) || null
      const operator = userMap.get(Number(row.operador_id)) || null
      const parsed = row.parsed_data

      return {
        id: row.id,
        obra_id: row.obra_id || 0,
        equipamento_id: row.equipamento_id,
        data_diario: row.data_diario,
        status: row.status,
        assinado_em: row.assinado_em,
        operador_id: row.operador_id,
        operador_nome: textOrNull(operator?.name) || '',
        obra_numero: textOrNull(construction?.construction_number) || textOrNull(parsed.construction_number) || '',
        cliente: textOrNull(construction?.client_name) || textOrNull(parsed.client) || '',
        equipamento: textOrNull(equipment?.name) || textOrNull(parsed.equipment_name) || textOrNull(parsed.equipment) || '',
        raw_data: row.raw_data,
        modalidade_id: intOrNull(equipment?.equipment_type_id),
      }
    })

    const filteredRows = hydratedRows.filter((row) => {
      if (data_inicio && row.data_diario && row.data_diario < String(data_inicio)) return false
      if (data_fim && row.data_diario && row.data_diario > String(data_fim)) return false
      if (obra && !String(row.obra_numero || '').includes(String(obra))) return false
      if (equipamento_id && Number(row.equipamento_id || 0) !== Number(equipamento_id)) return false
      if (operador_id && Number(row.operador_id || 0) !== Number(operador_id)) return false
      if (status && String(row.status || '') !== String(status)) return false
      if (modalidade_id && Number(row.modalidade_id || 0) !== Number(modalidade_id)) return false
      return true
    })

    const total = filteredRows.length
    const pageRows = filteredRows.slice(offset, offset + limit)
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
    await conn.commit()

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
              d.user_id AS operador_id,
              u.name AS operador_nome,
              u.document AS operador_documento,
              u.signature AS operador_assinatura,
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
    await conn.commit()

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
    await db.query('DELETE FROM diaries_staff WHERE diary_id = ?', [req.params.id])
    await db.query('DELETE FROM diaries WHERE id = ?', [req.params.id])
    ok(res, {})
  } catch (e) {
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
    const [[{ obras_finalizadas }]] = await db.query("SELECT COUNT(*) AS obras_finalizadas FROM constructions WHERE status NOT IN ('1', 'P', 'C')")
    const [[{ maquinas_ativas }]] = await db.query("SELECT COUNT(*) AS maquinas_ativas FROM equipments WHERE active = 'Y'")
    const [[{ diarios_pendentes }]] = await db.query(
      "SELECT COUNT(*) AS diarios_pendentes FROM diaries WHERE COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.status')), ''), 'pendente') = 'pendente'"
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

    if (diarios_pendentes > 0) {
      alerts.push({
        id: 'diarios-pendentes',
        severity: 'warning',
        title: 'Diarios aguardando assinatura',
        description: `${diarios_pendentes} diarios seguem pendentes.`,
      })
    }

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
          obras_finalizadas,
          maquinas_ativas,
          diarios_pendentes,
        },
        recent_activities: recentActivities,
        alerts,
      },
    })
  } catch (e) {
    err(res, e.message, 500)
  }
})

module.exports = router
