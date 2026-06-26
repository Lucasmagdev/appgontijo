// Sessões persistidas no banco (tabela app_sessions) para sobreviver a restart/deploy.
// Mantém um Map em memória como cache; get/has são síncronos, set/delete espelham no banco.
// Extraído do server.js (refatoração fase 2c).

const db = require("./db");

class SessionStore {
  constructor(scope) {
    this.scope = scope;
    this.map = new Map();
  }

  async load() {
    try {
      const [rows] = await db.query(
        "SELECT token, data FROM app_sessions WHERE scope = ?",
        [this.scope]
      );
      for (const row of rows) {
        try {
          this.map.set(row.token, typeof row.data === "string" ? JSON.parse(row.data) : row.data);
        } catch {
          // ignora linha corrompida
        }
      }
    } catch (error) {
      console.error(`Falha ao carregar sessoes (${this.scope}):`, error.message);
    }
  }

  get(token) {
    return this.map.get(token);
  }

  has(token) {
    return this.map.has(token);
  }

  set(token, value) {
    this.map.set(token, value);
    db.query(
      "INSERT INTO app_sessions (token, scope, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
      [token, this.scope, JSON.stringify(value)]
    ).catch((error) => console.error(`Falha ao gravar sessao (${this.scope}):`, error.message));
    return this;
  }

  delete(token) {
    const existed = this.map.delete(token);
    db.query("DELETE FROM app_sessions WHERE token = ?", [token]).catch((error) =>
      console.error(`Falha ao remover sessao (${this.scope}):`, error.message)
    );
    return existed;
  }
}

const adminSessions = new SessionStore("admin");
const operadorSessions = new SessionStore("operador");
const clientPortalSessions = new SessionStore("client");

// Tabela app_sessions vive no banco (DDL em migrations/001_app_tables_baseline.sql).
// Aqui só a manutenção: limpa sessões antigas (> 30 dias) para evitar crescimento indefinido.
async function cleanupOldSessions() {
  await db.query("DELETE FROM app_sessions WHERE created_at < (NOW() - INTERVAL 30 DAY)");
}

async function bootstrapSessions() {
  try {
    await cleanupOldSessions();
    await Promise.all([adminSessions.load(), operadorSessions.load(), clientPortalSessions.load()]);
  } catch (error) {
    console.error("Falha ao inicializar sessoes persistentes:", error.message);
  }
}

module.exports = {
  SessionStore,
  adminSessions,
  operadorSessions,
  clientPortalSessions,
  cleanupOldSessions,
  bootstrapSessions,
};
