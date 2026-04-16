require('dotenv').config()
const bcrypt = require('bcrypt')
const db = require('./lib/db')

async function main() {
  const hash = await bcrypt.hash('12345678', 10)
  const [result] = await db.query('UPDATE users SET password = ?', [hash])
  console.log('Atualizados:', result.affectedRows, 'usuarios')
  process.exit(0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
