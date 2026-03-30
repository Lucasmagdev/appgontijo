const express = require('express')
const bcrypt = require('bcrypt')
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
      `SELECT d.id, d.obra_id, d.equipamento_id, d.data_diario, d.status, d.assinado_em,
              o.numero AS obra_numero,
              c.razao_social AS cliente,
              e.nome AS equipamento
       FROM diarios d
       LEFT JOIN obras o ON o.id = d.obra_id
       LEFT JOIN clientes c ON c.id = o.cliente_id
       LEFT JOIN equipamentos e ON e.id = d.equipamento_id
       ${where}
       ORDER BY d.data_diario DESC, d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    ok(res, { data: rows, total, page, limit })
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
