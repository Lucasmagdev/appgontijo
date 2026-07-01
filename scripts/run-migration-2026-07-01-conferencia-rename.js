const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const mysql = require('mysql2/promise')

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    connectionLimit: 2,
    multipleStatements: true,
    enableKeepAlive: true,
    keepAliveInitialDelay: 2000,
    connectTimeout: 30000,
  })

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'sql', '2026-07-01-rename-conferencia-aprovado-rejeitado.sql'),
    'utf8'
  )
  const statements = sql
    .split(';')
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim()
    )
    .filter(Boolean)

  try {
    for (const stmt of statements) {
      console.log('Running:', stmt.slice(0, 80).replace(/\s+/g, ' '), '...')
      await pool.query(stmt)
    }
    console.log('Migration applied OK.')

    const [diariesCheck] = await pool.query(
      "SELECT conferencia_status, COUNT(*) AS n FROM diaries GROUP BY conferencia_status"
    )
    console.log('diaries.conferencia_status distribution:', diariesCheck)

    const [stakeRows] = await pool.query(
      "SELECT status, COUNT(*) AS n FROM diary_stake_conference_items GROUP BY status"
    )
    console.log('diary_stake_conference_items.status distribution:', stakeRows)
  } catch (err) {
    console.error('Migration FAILED:', err.message)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
