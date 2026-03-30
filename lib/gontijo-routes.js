const express = require('express')
const bcrypt = require('bcrypt')
const PDFDocument = require('pdfkit')
const router = express.Router()
const db = require('./db')

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

function extractDiaryEquipmentName(row) {
  if (row.equipamento) return row.equipamento

  const diaryData = safeParseJson(row.dados_json)
  const legacyEquipment = row.legacy_equipment ?? (diaryData && typeof diaryData === 'object' ? diaryData.equipment : null)
  const legacyOptionsRaw = row.legacy_equipments ?? (diaryData && typeof diaryData === 'object' ? diaryData.equipments : null)

  const selectedEquipment = legacyEquipment == null ? null : String(legacyEquipment)
  const options = parseLegacyEquipments(legacyOptionsRaw)

  if (selectedEquipment && !/^\d+$/.test(selectedEquipment.trim())) {
    return selectedEquipment.trim()
  }

  if (options.length) {
    const firstPrimitive = options.find((item) => typeof item === 'string' && item.trim())
    if (typeof firstPrimitive === 'string') return firstPrimitive.trim()

    const matched = options.find((item) => String(item?.id ?? '') === selectedEquipment)
    if (matched?.item) return String(matched.item)

    const firstWithName = options.find((item) => item?.item)
    if (firstWithName?.item) return String(firstWithName.item)
  }

  if (!diaryData || typeof diaryData !== 'object') return null

  if (typeof diaryData.equipment_name === 'string' && diaryData.equipment_name.trim()) {
    return diaryData.equipment_name.trim()
  }

  if (typeof diaryData.equipment === 'string' && diaryData.equipment.trim() && !/^\d+$/.test(diaryData.equipment.trim())) {
    return diaryData.equipment.trim()
  }

  return null
}

function hydrateDiaryRow(row, options = {}) {
  const diaryData = safeParseJson(row.dados_json)
  const hydrated = {
    ...row,
    dados_json: diaryData,
    equipamento: row.equipamento || extractDiaryEquipmentName(row) || null,
  }

  if (!options.includeJson) {
    delete hydrated.dados_json
    delete hydrated.legacy_equipment
    delete hydrated.legacy_equipments
  }

  return hydrated
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
    return {
      title: 'Servicos Executados - Estacas',
      headers: ['Pilar/Estaca', 'Comp Cravado', 'Secao', 'Nega', 'Soldas', 'Cortes'],
      widths: [0.22, 0.2, 0.15, 0.13, 0.15, 0.15],
      rows: rows.map((row) => [
        firstFilledValue(row.stake, row.pilar, row.estaca, row.name, '-'),
        firstFilledValue(row.compCravado, row.comp_cravado, row.meters, '-'),
        firstFilledValue(row.secao, row.secao_id, row.section, '-'),
        firstFilledValue(row.nega, '-'),
        firstFilledValue(row.soldas, '0'),
        firstFilledValue(row.cortes, '0'),
      ]),
    }
  }

  return {
    title: 'Servicos Executados',
    headers: ['Pilar/Estaca', 'Diametro (cm)', 'Realizado (m)', 'Bits', 'Armacao (m)'],
    widths: [0.24, 0.18, 0.2, 0.14, 0.24],
    rows: rows.map((row) => [
      firstFilledValue(row.stake, row.pilar, row.estaca, '-'),
      firstFilledValue(row.diameter, row.diametro, row.section, '-'),
      firstFilledValue(row.meters, row.compCravado, row.comp_cravado, '-'),
      firstFilledValue(row.bits, row.nega, '-'),
      firstFilledValue(row.armacao, row.sobra, '-'),
    ]),
  }
}

function buildDiaryPdfContext(diario) {
  const data = normalizeDiaryObject(diario.dados_json)
  const address = normalizeDiaryObject(data.address)
  const supply = normalizeDiaryObject(data.supply)
  const planningRows = normalizeDiaryArray(data.planning).map((item) => normalizeDiaryObject(item))
  const endRows = normalizeDiaryArray(data.endConstruction).map((item) => normalizeDiaryObject(item))
  const teamRows = normalizeDiaryArray(data.staff).map((item) => normalizeDiaryObject(item))
  const occurrences = normalizeDiaryArray(data.occurrences).map((item) => normalizeDiaryObject(item))
  const stakeBlock = normalizeStakeRows(data)

  return {
    data,
    obraNumber: firstFilledValue(diario.obra_numero, data.construction_number, '-'),
    clientName: firstFilledValue(diario.cliente, data.client, '-'),
    machineName: firstFilledValue(diario.equipamento, extractDiaryEquipmentName(diario), '-'),
    operatorName: firstFilledValue(diario.operador_nome, '-'),
    dateBr: formatDateBr(diario.data_diario || data.date),
    address: [address.street, address.number, address.neighborhood].filter(Boolean).join(', ') || '-',
    team: teamRows.map((item) => firstFilledValue(item.item, item.name)).filter(Boolean).join(', ') || '-',
    weather: parseWeatherFlags(data),
    startTime: firstFilledValue(data.start, '-'),
    endTime: firstFilledValue(data.end, '-'),
    clientOnSite: firstFilledValue(data.client, diario.cliente, '-'),
    modality: firstFilledValue(data.modality, '-'),
    horimetro: firstFilledValue(data.horimetro, '-'),
    signatureName: firstFilledValue(data.signatureName, '-'),
    signatureDoc: firstFilledValue(data.signatureDoc, '-'),
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

    drawBox(doc, left, top, pageWidth, 28, { fill: gray, stroke: border })
    drawText(doc, 'GONTIJO', left + 6, top + 4, 78, {
      font: 'Helvetica-Bold',
      size: 12,
    })
    drawText(doc, 'FUNDACOES', left + 10, top + 16, 72, {
      size: 7.5,
      color: '#666666',
    })
    drawText(doc, 'DIARIO DE OBRA', left + 120, top + 8, 250, {
      font: 'Helvetica-Bold',
      size: 13,
      align: 'center',
    })
    drawText(doc, `Nº DA OBRA: ${ctx.obraNumber}`, left + 380, top + 8, 130, {
      font: 'Helvetica-Bold',
      size: 9,
      align: 'right',
    })

    const row1Y = top + 28
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
    drawText(doc, 'Endereco:', left + 6, row2Y + 9, 42, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.address, left + 50, row2Y + 9, 262, { size: 6.4 })
    drawText(doc, ctx.machineName, left + 322, row2Y + 9, 74, { font: 'Helvetica-Bold', size: 10, align: 'center' })
    drawText(doc, 'Horario inicio:', left + 396 + 6, row2Y + 7, 52, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.startTime, left + 396 + 70, row2Y + 7, 28, { size: 7, align: 'right' })

    const row3Y = row2Y + 30
    drawBox(doc, left, row3Y, 322, 30, { stroke: border })
    drawBox(doc, left + 322, row3Y, 74, 30, { stroke: border })
    drawBox(doc, left + 396, row3Y, 108, 30, { stroke: border })
    drawText(doc, 'Equipe:', left + 6, row3Y + 8, 34, { font: 'Helvetica-Bold', size: 6.8 })
    drawText(doc, ctx.team, left + 38, row3Y + 8, 274, { size: 6.2 })
    drawText(doc, 'Horario termino:', left + 396 + 6, row3Y + 7, 58, { font: 'Helvetica-Bold', size: 6.8 })
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
    y += 8

    drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border })
    drawText(doc, 'OCORRENCIAS', left, y + 7, pageWidth, {
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

    drawText(doc, 'Mobilizacao', left + 6, blockY + 20, 64, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, 'Final do dia', left + 6, blockY + 84, 64, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, 'Litros no tanque', left + 83, blockY + 13, 62, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosTanqueAntes, supply.litrosTanqueInicial, '-'), left + 156, blockY + 16, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros no galao', left + 83, blockY + 42, 62, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosGalaoAntes, supply.litrosGalaoInicial, '-'), left + 156, blockY + 45, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros no tanque', left + 83, blockY + 71, 62, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosTanque, '-'), left + 156, blockY + 74, 60, { size: 7, align: 'center' })
    drawText(doc, 'Litros no galao', left + 83, blockY + 100, 62, { font: 'Helvetica-Bold', size: 6.2, align: 'center' })
    drawText(doc, firstFilledValue(supply.litrosGalao, '-'), left + 156, blockY + 103, 60, { size: 7, align: 'center' })

    drawBox(doc, left + leftBlockW, blockY, centerBlockW, 30, { fill: gray, stroke: border })
    drawText(doc, 'PREENCHER AO FINAL DO DIA', left + leftBlockW, blockY + 10, centerBlockW, {
      font: 'Helvetica-Bold',
      size: 7,
      align: 'center',
    })
    drawBox(doc, left + leftBlockW, blockY + 30, centerBlockW, 28, { stroke: border })
    drawLine(doc, left + leftBlockW + 110, blockY + 30, left + leftBlockW + 110, blockY + 58, border)
    drawText(doc, 'Horimetro', left + leftBlockW, blockY + 40, 110, { font: 'Helvetica-Bold', size: 7, align: 'center' })
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

    drawText(doc, 'Nº de estacas para termino da obra', left + leftBlockW + centerBlockW + 8, blockY + 30, rightBlockW - 16, {
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
    drawText(doc, 'Chegou diesel na obra?', left, fuelMetaY, 104, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, firstFilledValue(supply.chegouDiesel, '-'), left + 88, fuelMetaY, 18, { size: 6.5, align: 'center' })
    drawText(doc, 'Fornecido por:', left, fuelMetaY + 20, 72, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, firstFilledValue(supply.fornecidoPor, '-'), left + 66, fuelMetaY + 20, 60, { size: 6.5, align: 'center' })
    drawText(doc, 'Quantos litros?', left, fuelMetaY + 42, 62, { font: 'Helvetica-Bold', size: 6.5 })
    drawText(doc, 'Horario de chegada', left + 90, fuelMetaY + 42, 80, { font: 'Helvetica-Bold', size: 6.5 })
    drawBox(doc, left, fuelMetaY + 54, 118, 24, { stroke: border })
    drawBox(doc, left + 118, fuelMetaY + 54, 98, 24, { stroke: border })
    drawText(doc, firstFilledValue(supply.litros, '-'), left, fuelMetaY + 62, 118, { size: 6.5, align: 'center' })
    drawText(doc, firstFilledValue(supply.horario, '-'), left + 118, fuelMetaY + 62, 98, { size: 6.5, align: 'center' })

    drawBox(doc, left + 228, fuelMetaY + 40, 160, 24, { fill: gray, stroke: border })
    drawText(doc, 'Previsao de termino da obra', left + 228, fuelMetaY + 48, 160, {
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
    drawLine(doc, p2Left, 92, p2Left + 175, 92, '#505050')
    drawText(doc, 'Gontijo Fundacoes', p2Left, 98, 175, {
      font: 'Helvetica-Bold',
      size: 7,
    })
    drawText(doc, `Nome: ${ctx.operatorName}`, p2Left, 108, 190, {
      font: 'Helvetica-Bold',
      size: 7,
    })
    drawText(doc, `Documento: ${ctx.signatureDoc}`, p2Left, 118, 190, {
      font: 'Helvetica-Bold',
      size: 7,
    })

    drawLine(doc, 390, 92, 548, 92, '#505050')
    drawText(doc, 'Responsavel da obra', 402, 98, 130, {
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
    drawText(doc, 'OCORRENCIAS - FOTOS EM ANEXO', 42, 395, 500, {
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
      where += ' AND (nome LIKE ? OR apelido LIKE ? OR login LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    }

    if (status) {
      where += ' AND status = ?'
      params.push(status)
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM usuarios ${where}`, params)
    const [rows] = await db.query(
      `SELECT id, nome, apelido, login, telefone, perfil, status, criado_em
       FROM usuarios ${where}
       ORDER BY nome
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
      'SELECT id, nome, apelido, login, telefone, perfil, status FROM usuarios WHERE id = ?',
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
      'INSERT INTO usuarios (nome, apelido, login, telefone, senha_hash, perfil) VALUES (?,?,?,?,?,?)',
      [nome, textOrNull(apelido), login, textOrNull(telefone), senha_hash, perfil || 'operador']
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
      'UPDATE usuarios SET nome = ?, apelido = ?, login = ?, telefone = ?, perfil = ?, status = ? WHERE id = ?',
      [nome, textOrNull(apelido), login, textOrNull(telefone), perfil, status, req.params.id]
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
      where += ' AND (razao_social LIKE ? OR email LIKE ? OR documento LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`)
    }

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM clientes ${where}`, params)
    const [rows] = await db.query(
      `SELECT id, razao_social, tipo_doc, documento, email, telefone, cidade, estado
       FROM clientes ${where}
       ORDER BY razao_social
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
    const [[row]] = await db.query('SELECT * FROM clientes WHERE id = ?', [req.params.id])
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
      `INSERT INTO clientes
      (razao_social, tipo_doc, documento, inscricao_municipal, email, telefone,
       cep, estado, cidade, logradouro, bairro, numero, complemento)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        razao_social,
        tipo_doc || 'cnpj',
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
      `UPDATE clientes SET
        razao_social = ?, tipo_doc = ?, documento = ?, inscricao_municipal = ?, email = ?, telefone = ?,
        cep = ?, estado = ?, cidade = ?, logradouro = ?, bairro = ?, numero = ?, complemento = ?
       WHERE id = ?`,
      [
        razao_social,
        tipo_doc || 'cnpj',
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
    const [[{ obras }]] = await db.query('SELECT COUNT(*) AS obras FROM obras WHERE cliente_id = ?', [req.params.id])
    if (obras > 0) {
      return err(res, 'Cliente possui obras cadastradas e nao pode ser excluido')
    }

    await db.query('DELETE FROM clientes WHERE id = ?', [req.params.id])
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/modalidades', async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM modalidades WHERE ativo = 1 ORDER BY nome')
    ok(res, { data: rows })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/equipamentos', async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT e.*, m.nome AS modalidade_nome
       FROM equipamentos e
       LEFT JOIN modalidades m ON m.id = e.modalidade_id
       ORDER BY e.nome`
    )
    ok(res, { data: rows })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/equipamentos', async (req, res) => {
  try {
    const { nome, computador_geo, modalidade_id } = req.body
    if (!nome) return err(res, 'Nome e obrigatorio')

    const [result] = await db.query(
      'INSERT INTO equipamentos (nome, computador_geo, modalidade_id) VALUES (?,?,?)',
      [nome, textOrNull(computador_geo), intOrNull(modalidade_id)]
    )

    ok(res, { id: result.insertId })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.put('/equipamentos/:id', async (req, res) => {
  try {
    const { nome, computador_geo, modalidade_id, status } = req.body
    await db.query(
      'UPDATE equipamentos SET nome = ?, computador_geo = ?, modalidade_id = ?, status = ? WHERE id = ?',
      [nome, textOrNull(computador_geo), intOrNull(modalidade_id), status || 'ativo', req.params.id]
    )
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/obras', async (req, res) => {
  try {
    const { limit, offset, page } = paginate(req)
    const { busca, status, cliente_id } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    if (busca) {
      where += ' AND (o.numero LIKE ? OR c.razao_social LIKE ?)'
      params.push(`%${busca}%`, `%${busca}%`)
    }

    if (status) {
      where += ' AND o.status = ?'
      params.push(status)
    }

    if (cliente_id) {
      where += ' AND o.cliente_id = ?'
      params.push(cliente_id)
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM obras o
       LEFT JOIN clientes c ON c.id = o.cliente_id
       ${where}`,
      params
    )

    const [rows] = await db.query(
      `SELECT o.id, o.numero, o.status, o.tipo_obra, o.cidade, o.estado, o.data_prevista_inicio,
              c.razao_social AS cliente
       FROM obras o
       LEFT JOIN clientes c ON c.id = o.cliente_id
       ${where}
       ORDER BY o.numero DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, { data: rows, total, page, limit })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/obras/:id', async (req, res) => {
  try {
    const [[obra]] = await db.query(
      `SELECT o.*, c.razao_social AS cliente_nome
       FROM obras o
       LEFT JOIN clientes c ON c.id = o.cliente_id
       WHERE o.id = ?`,
      [req.params.id]
    )

    if (!obra) return err(res, 'Obra nao encontrada', 404)

    const [producao] = await db.query('SELECT * FROM obra_producao WHERE obra_id = ? ORDER BY id', [obra.id])
    const [responsabilidades] = await db.query(
      'SELECT * FROM obra_responsabilidades WHERE obra_id = ? ORDER BY id',
      [obra.id]
    )
    const [contatos] = await db.query('SELECT * FROM obra_contatos WHERE obra_id = ? ORDER BY id', [obra.id])
    const [modalidades] = await db.query(
      `SELECT m.id, m.nome
       FROM obra_modalidades om
       JOIN modalidades m ON m.id = om.modalidade_id
       WHERE om.obra_id = ?
       ORDER BY m.nome`,
      [obra.id]
    )
    const [equipamentos] = await db.query(
      `SELECT e.id, e.nome, e.computador_geo, e.modalidade_id, e.status
       FROM obra_equipamentos oe
       JOIN equipamentos e ON e.id = oe.equipamento_id
       WHERE oe.obra_id = ?
       ORDER BY e.nome`,
      [obra.id]
    )

    ok(res, { data: { ...obra, producao, responsabilidades, contatos, modalidades, equipamentos } })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.post('/obras', async (req, res) => {
  const conn = await db.getConnection()

  try {
    await conn.beginTransaction()
    const obraFields = normalizeObraFields(req.body)

    if (!obraFields.numero || !obraFields.cliente_id) {
      await conn.rollback()
      return err(res, 'numero e cliente_id sao obrigatorios')
    }

    const columns = Object.keys(obraFields)
    const values = Object.values(obraFields)
    const placeholders = values.map(() => '?').join(', ')
    const [result] = await conn.query(
      `INSERT INTO obras (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    )

    const obraId = result.insertId
    await replaceNestedRows(conn, obraId, req.body)
    await conn.commit()

    ok(res, { id: obraId })
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
    const obraFields = normalizeObraFields(req.body)

    if (Object.keys(obraFields).length) {
      const setClause = Object.keys(obraFields).map((key) => `${key} = ?`).join(', ')
      await conn.query(`UPDATE obras SET ${setClause} WHERE id = ?`, [...Object.values(obraFields), obraId])
    }

    await replaceNestedRows(conn, obraId, req.body)
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
    const { data_inicio, data_fim, obra, equipamento_id, status, modalidade_id } = req.query
    let where = 'WHERE 1 = 1'
    const params = []

    if (data_inicio) {
      where += ' AND d.data_diario >= ?'
      params.push(data_inicio)
    }

    if (data_fim) {
      where += ' AND d.data_diario <= ?'
      params.push(data_fim)
    }

    if (obra) {
      where += ' AND o.numero LIKE ?'
      params.push(`%${obra}%`)
    }

    if (equipamento_id) {
      where += ' AND d.equipamento_id = ?'
      params.push(equipamento_id)
    }

    if (status) {
      where += ' AND d.status = ?'
      params.push(status)
    }

    if (modalidade_id) {
      where += ' AND EXISTS (SELECT 1 FROM obra_modalidades om WHERE om.obra_id = d.obra_id AND om.modalidade_id = ?)'
      params.push(modalidade_id)
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM diarios d
       LEFT JOIN obras o ON o.id = d.obra_id
       ${where}`,
      params
    )

    const [rows] = await db.query(
      `SELECT base.id, base.obra_id, base.equipamento_id, base.data_diario, base.status, base.assinado_em,
              JSON_UNQUOTE(JSON_EXTRACT(df.dados_json, '$.equipment')) AS legacy_equipment,
              JSON_UNQUOTE(JSON_EXTRACT(df.dados_json, '$.equipments')) AS legacy_equipments,
              o.numero AS obra_numero,
              c.razao_social AS cliente,
              e.nome AS equipamento
       FROM (
         SELECT d.id, d.obra_id, d.equipamento_id, d.data_diario, d.status, d.assinado_em
         FROM diarios d
         LEFT JOIN obras o ON o.id = d.obra_id
         ${where}
         ORDER BY d.data_diario DESC, d.id DESC
         LIMIT ? OFFSET ?
       ) base
       JOIN diarios df ON df.id = base.id
       LEFT JOIN obras o ON o.id = base.obra_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN equipamentos e ON e.id = base.equipamento_id
       ORDER BY base.data_diario DESC, base.id DESC`,
      [...params, limit, offset]
    )

    ok(res, { data: rows.map((row) => hydrateDiaryRow(row)), total, page, limit })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/diarios/:id/pdf', async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT d.*, o.numero AS obra_numero, c.razao_social AS cliente, e.nome AS equipamento, u.nome AS operador_nome
       FROM diarios d
       LEFT JOIN obras o ON o.id = d.obra_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN equipamentos e ON e.id = d.equipamento_id
       LEFT JOIN usuarios u ON u.id = d.operador_id
       WHERE d.id = ?`,
      [req.params.id]
    )

    if (!row) return err(res, 'Diario nao encontrado', 404)

    const diario = hydrateDiaryRow(row, { includeJson: true })
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
    const [[row]] = await db.query(
      `SELECT d.*, o.numero AS obra_numero, c.razao_social AS cliente, e.nome AS equipamento, u.nome AS operador_nome
       FROM diarios d
       LEFT JOIN obras o ON o.id = d.obra_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN equipamentos e ON e.id = d.equipamento_id
       LEFT JOIN usuarios u ON u.id = d.operador_id
       WHERE d.id = ?`,
      [req.params.id]
    )

    if (!row) return err(res, 'Diario nao encontrado', 404)

    ok(res, { data: hydrateDiaryRow(row, { includeJson: true }) })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.put('/diarios/:id', async (req, res) => {
  try {
    const { data_diario, status, equipamento_id, dados_json, assinado_em } = req.body
    const parsedJson = safeParseJson(dados_json)
    const normalizedStatus = ['rascunho', 'pendente', 'assinado'].includes(status) ? status : 'pendente'
    const equipamentoId = intOrNull(equipamento_id)
    const resolvedSignedAt =
      normalizedStatus === 'assinado'
        ? textOrNull(assinado_em) || new Date().toISOString().slice(0, 19).replace('T', ' ')
        : null

    await db.query(
      `UPDATE diarios
       SET data_diario = ?, status = ?, equipamento_id = ?, assinado_em = ?, dados_json = ?
       WHERE id = ?`,
      [
        textOrNull(data_diario),
        normalizedStatus,
        equipamentoId,
        resolvedSignedAt,
        parsedJson ? JSON.stringify(parsedJson) : null,
        req.params.id,
      ]
    )

    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.delete('/diarios/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM diarios WHERE id = ?', [req.params.id])
    ok(res, {})
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/dashboard/stats', async (_req, res) => {
  try {
    const [[{ obras_andamento }]] = await db.query("SELECT COUNT(*) AS obras_andamento FROM obras WHERE status = 'em andamento'")
    const [[{ obras_finalizadas }]] = await db.query("SELECT COUNT(*) AS obras_finalizadas FROM obras WHERE status = 'finalizada'")
    const [[{ maquinas_ativas }]] = await db.query("SELECT COUNT(*) AS maquinas_ativas FROM equipamentos WHERE status = 'ativo'")
    const [[{ diarios_pendentes }]] = await db.query("SELECT COUNT(*) AS diarios_pendentes FROM diarios WHERE status = 'pendente'")

    ok(res, { data: { obras_andamento, obras_finalizadas, maquinas_ativas, diarios_pendentes } })
  } catch (e) {
    err(res, e.message, 500)
  }
})

router.get('/dashboard/overview', async (_req, res) => {
  try {
    const [[{ obras_andamento }]] = await db.query("SELECT COUNT(*) AS obras_andamento FROM obras WHERE status = 'em andamento'")
    const [[{ obras_finalizadas }]] = await db.query("SELECT COUNT(*) AS obras_finalizadas FROM obras WHERE status = 'finalizada'")
    const [[{ maquinas_ativas }]] = await db.query("SELECT COUNT(*) AS maquinas_ativas FROM equipamentos WHERE status = 'ativo'")
    const [[{ diarios_pendentes }]] = await db.query("SELECT COUNT(*) AS diarios_pendentes FROM diarios WHERE status = 'pendente'")
    const [[{ equipamentos_sem_modalidade }]] = await db.query(
      'SELECT COUNT(*) AS equipamentos_sem_modalidade FROM equipamentos WHERE modalidade_id IS NULL'
    )
    const [[{ obras_pausadas }]] = await db.query("SELECT COUNT(*) AS obras_pausadas FROM obras WHERE status = 'pausada'")

    const [obraActivities] = await db.query(
      `SELECT id, numero, status, atualizado_em
       FROM obras
       ORDER BY atualizado_em DESC, id DESC
       LIMIT 5`
    )

    const [signedDiaries] = await db.query(
      `SELECT d.id, d.assinado_em, o.numero AS obra_numero, e.nome AS equipamento_nome
       FROM diarios d
       LEFT JOIN obras o ON o.id = d.obra_id
       LEFT JOIN equipamentos e ON e.id = d.equipamento_id
       WHERE d.status = 'assinado'
       ORDER BY d.assinado_em DESC, d.id DESC
       LIMIT 5`
    )

    const recentActivities = [
      ...obraActivities.map((obra) => ({
        id: `obra-${obra.id}`,
        date: obra.atualizado_em,
        type: 'obra',
        title: `Obra ${obra.numero} atualizada`,
        description: `Status atual: ${obra.status}.`,
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
