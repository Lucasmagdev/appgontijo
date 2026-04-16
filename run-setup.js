/**
 * Executa o setup-complete.sql no banco de dados configurado no .env
 * Uso: node run-setup.js
 * Requer que o tunnel SSH esteja ativo (porta 3307)
 */
require('dotenv').config()
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

async function main() {
  const db = await mysql.createConnection({
    host:     process.env.MYSQL_HOST     || '127.0.0.1',
    port:     Number(process.env.MYSQL_PORT || 3306),
    user:     process.env.MYSQL_USER     || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'gontijo_clone',
    multipleStatements: true,
    connectTimeout: 15000,
  })

  console.log('✔ Conectado ao banco:', process.env.MYSQL_DATABASE)

  const sql = fs.readFileSync(path.join(__dirname, 'setup-complete.sql'), 'utf8')

  // Divide em statements individuais para melhor controle de erro
  // Remove o USE no início pois já passamos o database na conexão
  const cleaned = sql
    .replace(/^USE\s+\w+\s*;/im, '')
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let ok = 0
  let skipped = 0
  let errors = []

  for (const stmt of cleaned) {
    try {
      await db.query(stmt)
      ok++
    } catch (err) {
      // Erros esperados: coluna já existe, constraint já existe, etc.
      const ignorable = [
        'already exists',
        'Duplicate column',
        'Duplicate key name',
        'CONSTRAINT',
        'doesn\'t exist',
      ]
      if (ignorable.some(msg => err.message.includes(msg))) {
        skipped++
      } else {
        errors.push({ stmt: stmt.substring(0, 80), error: err.message })
      }
    }
  }

  console.log(`\n✔ Executados:  ${ok}`)
  console.log(`⚠ Ignorados:   ${skipped} (já existiam)`)
  if (errors.length > 0) {
    console.log(`✖ Erros reais: ${errors.length}`)
    errors.forEach(e => console.log(`  → ${e.stmt}...\n    ${e.error}`))
    process.exit(1)
  } else {
    console.log('\n✔ Setup concluído sem erros!')
  }

  await db.end()
}

main().catch(err => {
  console.error('Erro fatal:', err.message)
  process.exit(1)
})
