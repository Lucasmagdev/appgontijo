const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
const dotenv = require("dotenv");
const PDFDocument = require("pdfkit");
const multer = require("multer");
const XLSX = require("xlsx");
const compression = require("compression");

dotenv.config();

const bcrypt = require("bcrypt");
const adminStore = require("./lib/admin-store");
const db = require("./lib/db");
const gontijoRoutes = require("./lib/gontijo-routes");
const goalTargetStore = require("./lib/goal-target-store");
const { parseDiameterCm, getMeqFactor, calculateSegmentMeq } = require("./lib/meq");
const { resolveOfficialMachine, isOfficialGoalItem } = require("./lib/official-machine-catalog");
const {
  buildDailyDashboard,
  buildWeeklyDashboard,
  buildSecondaryDashboard,
} = require("./lib/dashboard-service");
const {
  getWhatsAppConfig,
  normalizeBrazilPhone,
  isWhatsAppConfigured,
  isWhatsAppEnabled,
  getConnectionStatus,
  getQrCodeImage,
  sendText: sendWhatsAppText,
} = require("./lib/whatsapp-service");
const {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(compression());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const portalDocsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'portal-docs')
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname)
      const safe = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40)
      cb(null, `${Date.now()}-${safe}${ext}`)
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
})

let _portalDocsTableEnsured = false
async function ensurePortalDocumentsTable() {
  if (_portalDocsTableEnsured) return
  await db.query(`
    CREATE TABLE IF NOT EXISTS portal_documents (
      id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      construction_id INT UNSIGNED NOT NULL,
      tipo         VARCHAR(30)  NOT NULL DEFAULT 'outro',
      nome_original VARCHAR(255) NOT NULL,
      nome_arquivo  VARCHAR(255) NOT NULL,
      tamanho      INT UNSIGNED,
      mime_type    VARCHAR(100),
      criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pd_construction (construction_id)
    )
  `)
  _portalDocsTableEnsured = true
}

const DEFAULT_PREDEFINED_OCCURRENCES = [
  "Chuva forte - paralisacao da atividade",
  "Falta de material / insumo",
  "Falha no equipamento",
  "Manutencao nao programada",
  "Acidente de trabalho",
  "Atraso ou falta da equipe",
  "Paralisacao a pedido do cliente",
  "Falta de agua / concreto",
  "Problema eletrico",
  "Dificuldade no solo / terreno",
  "Interferencia de terceiros na area",
  "Aguardando projeto / liberacao tecnica",
  "Vento forte / condicoes climaticas adversas",
  "Dificuldade de acesso ao local",
];

let _predefinedOccurrencesTableEnsured = false;
async function ensurePredefinedOccurrencesTable() {
  if (_predefinedOccurrencesTableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS predefined_occurrences (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title         VARCHAR(160) NOT NULL,
      category      VARCHAR(80) NULL,
      template_text TEXT NOT NULL,
      active        ENUM('S','N') NOT NULL DEFAULT 'S',
      sort_order    INT NOT NULL DEFAULT 0,
      created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_predefined_occurrences_active_order (active, sort_order, title)
    )
  `);

  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM predefined_occurrences");
  if (Number(row?.total || 0) === 0) {
    for (let index = 0; index < DEFAULT_PREDEFINED_OCCURRENCES.length; index += 1) {
      const title = DEFAULT_PREDEFINED_OCCURRENCES[index];
      await db.query(
        `INSERT INTO predefined_occurrences (title, category, template_text, active, sort_order)
         VALUES (?, ?, ?, 'S', ?)`,
        [title, "Geral", title, (index + 1) * 10]
      );
    }
  }

  _predefinedOccurrencesTableEnsured = true;
}
let goalTargetSanitizePromise = null;

function ensureGoalTargetsSanitized() {
  if (!goalTargetSanitizePromise) {
    goalTargetSanitizePromise = goalTargetStore.archiveInvalidGoals().catch((error) => {
      goalTargetSanitizePromise = null;
      throw error;
    });
  }
  return goalTargetSanitizePromise;
}

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const configuredOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const normalizedRequestOrigin = String(requestOrigin || "").trim().replace(/\/+$/, "");
  const allowedOrigin = configuredOrigins.includes(normalizedRequestOrigin)
    ? normalizedRequestOrigin
    : /^https?:\/\/localhost:\d+$/.test(normalizedRequestOrigin)
      ? normalizedRequestOrigin
      : "";
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json({ limit: "15mb" }));

// Sessoes persistidas no banco (tabela app_sessions) para sobreviver a restart/deploy.
// Mantem um Map em memoria como cache; get/has sao sincronos, set/delete espelham no banco.
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

async function ensureSessionsTable() {
  await db.query(
    `CREATE TABLE IF NOT EXISTS app_sessions (
      token VARCHAR(64) NOT NULL PRIMARY KEY,
      scope VARCHAR(16) NOT NULL,
      data JSON NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_app_sessions_scope (scope)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
  // Limpa sessoes antigas (> 30 dias) para evitar crescimento indefinido.
  await db.query("DELETE FROM app_sessions WHERE created_at < (NOW() - INTERVAL 30 DAY)");
}

async function bootstrapSessions() {
  try {
    await ensureSessionsTable();
    await Promise.all([adminSessions.load(), operadorSessions.load(), clientPortalSessions.load()]);
  } catch (error) {
    console.error("Falha ao inicializar sessoes persistentes:", error.message);
  }
}

const adminSessions = new SessionStore("admin");
const operadorSessions = new SessionStore("operador");
const clientPortalSessions = new SessionStore("client");

const ADMIN_GLOBAL_CPFS = (process.env.ADMIN_CPFS || "")
  .split(",")
  .map((s) => s.trim().replace(/\D/g, ""))
  .filter(Boolean);

const SOLIDES_EMPLOYER_BASE_URL = process.env.SOLIDES_EMPLOYER_BASE_URL || "https://employer.tangerino.com.br";
const SOLIDES_PUNCH_BASE_URL = process.env.SOLIDES_PUNCH_BASE_URL || "https://api.tangerino.com.br/api/punch";
const SOLIDES_PAGE_SIZE = 200;

const requiredEnv = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "S3_BUCKET",
];

function missingEnvVars() {
  return requiredEnv.filter((name) => !process.env[name]);
}

function getSolidesToken() {
  return String(process.env.SOLIDES_BASIC_TOKEN || "").trim();
}

function normalizeDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "sim", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "nao", "não", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function weekdayForSolides(dateText) {
  const date = parseDateString(dateText);
  const day = date.getUTCDay();
  return day === 0 ? 1 : day + 1;
}

function msOfDayToTime(ms) {
  if (!Number.isFinite(Number(ms))) return null;
  const totalMinutes = Math.floor(Number(ms) / 60000);
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function isoToTimeText(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("pt-BR", {
    timeZone: process.env.APP_TIMEZONE || "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isoToTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDayRangeMillis(dateText) {
  const normalized = normalizeDateOnly(dateText) || getCurrentDateString();
  const start = new Date(`${normalized}T00:00:00-03:00`).getTime();
  const end = new Date(`${normalized}T23:59:59.999-03:00`).getTime();
  return { start, end };
}

function workedSecondsToText(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return "-";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function solidesRequest(baseUrl, pathname, params = {}) {
  const token = getSolidesToken();
  if (!token) {
    throw new Error("SOLIDES_BASIC_TOKEN nao configurado no backend.");
  }

  const normalizedPath = String(pathname || "").replace(/^\/+/, "");
  const url = new URL(normalizedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: token,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      response.statusText ||
      "Falha ao consultar a API da Solides.";
    const error = new Error(String(message));
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function solidesFetchAll(baseUrl, pathname, params = {}) {
  const items = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const payload = await solidesRequest(baseUrl, pathname, {
      ...params,
      page,
      size: SOLIDES_PAGE_SIZE,
    });

    const content = Array.isArray(payload?.content) ? payload.content : [];
    items.push(...content);
    totalPages = Number(payload?.totalPages || (content.length < SOLIDES_PAGE_SIZE ? page + 1 : page + 2));
    page += 1;
    if (!Array.isArray(payload?.content) && page > 0) break;
  }

  return items;
}

async function fetchSolidesEmployees(showFired = false) {
  return solidesFetchAll(SOLIDES_EMPLOYER_BASE_URL, "/employee/find-all", {
    showFired: showFired ? 1 : 0,
  });
}

async function fetchSolidesWorkSchedules() {
  return solidesFetchAll(SOLIDES_EMPLOYER_BASE_URL, "/work-schedule");
}

async function fetchSolidesPunchesByEmployeeIds(dateText, employeeIds = [], extraFilters = {}) {
  const ids = [...new Set((Array.isArray(employeeIds) ? employeeIds : []).map((value) => Number(value || 0)).filter(Boolean))];
  if (!ids.length) return [];

  const allPunches = [];
  const batchSize = 12;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const settled = await Promise.allSettled(
      batch.map((employeeId) =>
        solidesRequest(SOLIDES_PUNCH_BASE_URL, "", {
          page: 0,
          size: 100,
          employeeId,
          showFired: extraFilters.showFired ? "true" : "false",
          status: extraFilters.status || undefined,
        })
      )
    );

    for (const result of settled) {
      if (result.status !== "fulfilled") continue;
      const content = Array.isArray(result.value?.content) ? result.value.content : [];
      const filtered = content.filter((item) => String(item?.date || "").slice(0, 10) === dateText);
      allPunches.push(...filtered);
    }
  }

  return allPunches;
}

function getScheduleForDate(schedule, dateText) {
  const weekday = weekdayForSolides(dateText);
  const timetable = Array.isArray(schedule?.workScheduleTimetableList)
    ? schedule.workScheduleTimetableList.find((item) => Number(item.day) === weekday)
    : null;

  if (!timetable) return null;

  return {
    startMs: Number(timetable.startShift1 || 0) || null,
    endMs: Number(timetable.endShift2 || timetable.endShift1 || 0) || null,
    intervalStartMs: Number(timetable.startMainInterval || 0) || null,
    intervalEndMs: Number(timetable.endMainInterval || 0) || null,
  };
}

function groupPunchesByEmployee(punches) {
  const grouped = new Map();

  for (const punch of Array.isArray(punches) ? punches : []) {
    const employeeId = Number(punch?.employeeId || punch?.employee?.id || 0);
    const employeeCpf = normalizeDigits(punch?.employee?.cpf);
    const key = employeeId || employeeCpf;
    if (!key) continue;

    const current = grouped.get(key) || [];
    current.push(punch);
    grouped.set(key, current);
  }

  return grouped;
}

function pickBestSolidesEmployee(candidates = []) {
  if (!Array.isArray(candidates) || !candidates.length) return null;

  const ordered = [...candidates].sort((left, right) => {
    const leftFired = left?.fired ? 1 : 0;
    const rightFired = right?.fired ? 1 : 0;
    if (leftFired !== rightFired) return leftFired - rightFired;

    const leftExcluded = left?.excluded ? 1 : 0;
    const rightExcluded = right?.excluded ? 1 : 0;
    if (leftExcluded !== rightExcluded) return leftExcluded - rightExcluded;

    const leftEffective = Number(left?.effectiveDate || 0);
    const rightEffective = Number(right?.effectiveDate || 0);
    return rightEffective - leftEffective;
  });

  return ordered[0] || null;
}

function buildPunchAggregate(punches) {
  const rows = Array.isArray(punches) ? punches : [];
  if (!rows.length) {
    return {
      count: 0,
      totalPunches: 0,
      totalPhotos: 0,
      firstInTs: null,
      lastOutTs: null,
      firstIn: null,
      lastOut: null,
      workedSeconds: 0,
      statuses: [],
      missingExit: false,
      missingPhoto: false,
    };
  }

  const hasPhoto = (photo) => {
    if (!photo) return false;
    if (typeof photo === "string") return String(photo).trim() !== "";
    if (typeof photo === "object") {
      return Boolean(
        photo.photoURL ||
        photo.url ||
        photo.id ||
        photo.hash ||
        photo.fileId
      );
    }
    return false;
  };

  const totalPunches = rows.reduce((sum, item) => {
    let current = sum;
    if (item?.dateIn || item?.dateInFull || item?.startDate) current += 1;
    if (item?.dateOut || item?.dateOutFull || item?.endDate) current += 1;
    return current;
  }, 0);

  const totalPhotos = rows.reduce((sum, item) => {
    let current = sum;
    if (hasPhoto(item?.photoIn) || item?.hashStart) current += 1;
    if (hasPhoto(item?.photoOut) || item?.hashEnd) current += 1;
    return current;
  }, 0);

  const firstInTs = rows
    .map((item) => isoToTimestamp(item?.dateInFull || item?.dateIn || item?.startDate))
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;

  const lastOutTs = rows
    .map((item) => isoToTimestamp(item?.dateOutFull || item?.dateOut || item?.endDate))
    .filter((value) => value !== null)
    .sort((a, b) => b - a)[0] ?? null;

  return {
    count: rows.length,
    totalPunches,
    totalPhotos,
    firstInTs,
    lastOutTs,
    firstIn: firstInTs ? isoToTimeText(firstInTs) : null,
    lastOut: lastOutTs ? isoToTimeText(lastOutTs) : null,
    workedSeconds: rows.reduce((sum, item) => sum + Number(item?.workedHoursInSeconds || 0), 0),
    statuses: [...new Set(rows.map((item) => String(item?.status || "").trim()).filter(Boolean))],
    missingExit: rows.some((item) => !item?.dateOut && !item?.dateOutFull && !item?.endDate),
    missingPhoto: totalPunches > totalPhotos,
  };
}

function buildDailyPointStatus({ localUser, solidesEmployee, scheduleForDate, aggregate, params }) {
  if (!solidesEmployee) {
    return {
      code: "sem_vinculo",
      label: "Sem vinculo Solides",
      tone: "slate",
      detail: "CPF do usuario nao encontrado na Solides.",
    };
  }

  if (!aggregate.count) {
    return {
      code: "sem_ponto",
      label: "Sem ponto",
      tone: "red",
      detail: "Nenhuma marcacao encontrada para a data selecionada.",
    };
  }

  if (aggregate.totalPunches < 4) {
    return {
      code: "batidas_insuficientes",
      label: "Batidas insuficientes",
      tone: "amber",
      detail: `Foram encontradas ${aggregate.totalPunches} batidas. O minimo esperado para OK eh 4.`,
    };
  }

  if (aggregate.missingPhoto) {
    return {
      code: "sem_foto",
      label: "Sem foto em uma ou mais batidas",
      tone: "amber",
      detail: `Foram encontradas ${aggregate.totalPhotos} foto(s) para ${aggregate.totalPunches} batidas.`,
    };
  }

  if (params.requireClosingPunch && aggregate.missingExit) {
    return {
      code: "marcacoes_incompletas",
      label: "Marcacoes incompletas",
      tone: "amber",
      detail: "Existe marcacao sem saida registrada.",
    };
  }

  if (aggregate.statuses.includes("PENDING")) {
    return {
      code: "pendente_solides",
      label: "Pendente na Solides",
      tone: "amber",
      detail: "A Solides marcou o ponto como pendente.",
    };
  }

  if (aggregate.statuses.includes("REPROVED")) {
    return {
      code: "reprovado_solides",
      label: "Reprovado na Solides",
      tone: "red",
      detail: "A Solides marcou o ponto como reprovado.",
    };
  }

    return {
      code: "ok",
      label: "OK",
      tone: "emerald",
      detail: `Conferencia ok para ${localUser.nome}: 4 ou mais batidas com foto e aprovadas na Solides.`,
    };
}

async function fetchLocalUsersForPointCheck(filters = {}) {
  const params = [];
  const where = [];

  if (filters.onlyActiveUsers) {
    where.push("u.active = 'S'");
  }

  if (filters.sectorId) {
    where.push("u.sector_id = ?");
    params.push(Number(filters.sectorId));
  }

  if (filters.userId) {
    where.push("u.id = ?");
    params.push(Number(filters.userId));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.document, u.phone, u.active, u.sector_id, s.name AS sector_name
     FROM users u
     LEFT JOIN sectors s ON s.id = u.sector_id
     ${whereSql}
     ORDER BY u.name ASC`,
    params
  );

  return rows.map((row) => ({
    id: Number(row.id),
    nome: String(row.name || ""),
    documento: normalizeDigits(row.document),
    telefone: String(row.phone || ""),
    ativo: String(row.active || "N") === "S",
    setorId: row.sector_id == null ? null : Number(row.sector_id),
    setorNome: String(row.sector_name || ""),
  }));
}

async function fetchWhatsAppSchemaStatus() {
  const [logsTable, responsibleColumn, equipmentOperatorColumn] = await Promise.all([
    tableExists("whatsapp_notification_logs"),
    columnExists("constructions", "responsible_operator_user_id"),
    columnExists("equipments", "operator_user_id"),
  ]);

  return {
    logsTable,
    responsibleColumn,
    equipmentOperatorColumn,
  };
}

async function insertWhatsAppLog(entry) {
  const [result] = await db.query(
    `INSERT INTO whatsapp_notification_logs
     (event_type, status, user_id, phone, construction_id, course_id, assignment_id, reference_date,
      dedupe_key, target_name, message_text, provider_message_id, provider_payload_json, metadata_json, error_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.eventType,
      entry.status || "queued",
      entry.userId || null,
      textOrNull(entry.phone),
      entry.constructionId || null,
      entry.courseId || null,
      entry.assignmentId || null,
      normalizeDateOnly(entry.referenceDate),
      textOrNull(entry.dedupeKey),
      textOrNull(entry.targetName),
      textOrNull(entry.messageText),
      textOrNull(entry.providerMessageId),
      stringifyJsonSafe(entry.providerPayload),
      stringifyJsonSafe(entry.metadata),
      textOrNull(entry.errorText),
    ]
  );
  return Number(result.insertId);
}

async function updateWhatsAppLog(logId, patch) {
  await db.query(
    `UPDATE whatsapp_notification_logs
     SET status = ?,
         phone = ?,
         provider_message_id = ?,
         provider_payload_json = ?,
         metadata_json = ?,
         error_text = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [
      patch.status || "failed",
      textOrNull(patch.phone),
      textOrNull(patch.providerMessageId),
      stringifyJsonSafe(patch.providerPayload),
      stringifyJsonSafe(patch.metadata),
      textOrNull(patch.errorText),
      logId,
    ]
  );
}

async function findRecentWhatsAppLogByDedupeKey(dedupeKey) {
  if (!dedupeKey) return null;
  const [rows] = await db.query(
    `SELECT id, status, created_at
     FROM whatsapp_notification_logs
     WHERE dedupe_key = ?
     ORDER BY id DESC
     LIMIT 1`,
    [dedupeKey]
  );
  return rows[0] || null;
}

function shouldSkipDedupeLog(logRow) {
  if (!logRow) return false;
  const status = String(logRow.status || "");
  if (status === "queued" || status === "sent") return true;
  const createdAt = new Date(logRow.created_at || 0).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt < 12 * 60 * 60 * 1000;
}

async function sendLoggedWhatsAppMessage(payload) {
  const schema = await fetchWhatsAppSchemaStatus();
  if (!schema.logsTable) {
    throw new Error("A tabela whatsapp_notification_logs ainda não existe no banco.");
  }

  if (payload.dedupeKey) {
    const existingLog = await findRecentWhatsAppLogByDedupeKey(payload.dedupeKey);
    if (shouldSkipDedupeLog(existingLog)) {
      return {
        ok: true,
        skipped: true,
        reason: "duplicate",
        logId: Number(existingLog.id),
      };
    }
  }

  const normalizedPhone = normalizeBrazilPhone(payload.phone);
  const logId = await insertWhatsAppLog({
    eventType: payload.eventType,
    status: "queued",
    userId: payload.userId,
    phone: normalizedPhone || payload.phone,
    constructionId: payload.constructionId,
    courseId: payload.courseId,
    assignmentId: payload.assignmentId,
    referenceDate: payload.referenceDate,
    dedupeKey: payload.dedupeKey,
    targetName: payload.targetName,
    messageText: payload.messageText,
    metadata: payload.metadata,
  });

  if (payload.skipDispatchReason) {
    await updateWhatsAppLog(logId, {
      status: "skipped",
      phone: payload.phone,
      metadata: {
        ...(payload.metadata || {}),
        skippedReason: payload.skipDispatchReason,
      },
      errorText: payload.skipDispatchMessage || "Envio ignorado.",
    });
    return { ok: true, skipped: true, reason: payload.skipDispatchReason, logId };
  }

  if (!normalizedPhone) {
    await updateWhatsAppLog(logId, {
      status: "skipped",
      phone: payload.phone,
      metadata: {
        ...(payload.metadata || {}),
        skippedReason: "invalid_phone",
      },
      errorText: "Telefone inválido para envio no WhatsApp.",
    });
    return { ok: true, skipped: true, reason: "invalid_phone", logId };
  }

  if (!isWhatsAppEnabled()) {
    await updateWhatsAppLog(logId, {
      status: "skipped",
      phone: normalizedPhone,
      metadata: {
        ...(payload.metadata || {}),
        skippedReason: "whatsapp_disabled",
      },
      errorText: "Integração WhatsApp/Z-API desativada ou não configurada.",
    });
    return { ok: true, skipped: true, reason: "whatsapp_disabled", logId };
  }

  try {
    const result = await sendWhatsAppText(normalizedPhone, payload.messageText, {
      eventType: payload.eventType,
      userId: payload.userId,
      constructionId: payload.constructionId,
      courseId: payload.courseId,
      assignmentId: payload.assignmentId,
    });
    await updateWhatsAppLog(logId, {
      status: "sent",
      phone: result.phone,
      providerMessageId: result.providerMessageId,
      providerPayload: result.payload,
      metadata: payload.metadata,
      errorText: null,
    });
    return {
      ok: true,
      skipped: false,
      logId,
      providerMessageId: result.providerMessageId,
    };
  } catch (error) {
    await updateWhatsAppLog(logId, {
      status: "failed",
      phone: normalizedPhone,
      providerPayload: error?.payload || null,
      metadata: payload.metadata,
      errorText: error?.message || "Falha ao enviar via Z-API.",
    });
    return {
      ok: false,
      skipped: false,
      logId,
      error: error?.message || "Falha ao enviar via Z-API.",
    };
  }
}

async function fetchDiaryReminderCandidates() {
  const schema = await fetchWhatsAppSchemaStatus();
  if (!schema.equipmentOperatorColumn) {
    return { items: [], reason: "missing_equipment_operator_column" };
  }

  const now = new Date();
  const saoPauloNow = new Date(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now));
  const currentDate = getCurrentDateString("America/Sao_Paulo");
  const currentHour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(now));
  const latestOverdueDate = currentHour >= 8 ? shiftDateWithTz(currentDate, -1) : shiftDateWithTz(currentDate, -2);

  const [activeConstructions] = await db.query(
    `SELECT c.id,
            c.construction_number,
            c.start_date,
            c.equipments
     FROM constructions c
     WHERE c.status = '1'`
  );

  if (!activeConstructions.length) return { items: [], reason: "" };

  const equipmentIds = [
    ...new Set(
      activeConstructions
        .flatMap((construction) => parseJsonSafe(construction.equipments, []))
        .map((item) => Number(typeof item === "object" && item ? item.id || item.equipment_id : item))
        .filter(Boolean)
    ),
  ];

  if (!equipmentIds.length) return { items: [], reason: "" };

  const [equipmentRows] = await db.query(
    `SELECT e.id AS equipment_id,
            e.name AS equipment_name,
            e.operator_user_id,
            u.name AS operator_name,
            u.phone AS operator_phone
     FROM equipments e
     LEFT JOIN users u ON u.id = e.operator_user_id
     WHERE e.active = 'Y'
       AND e.id IN (?)`,
    [equipmentIds]
  );

  const equipmentById = new Map(equipmentRows.map((row) => [Number(row.equipment_id || 0), row]));
  const activeEquipmentRows = [];
  for (const construction of activeConstructions) {
    const ids = parseJsonSafe(construction.equipments, [])
      .map((item) => Number(typeof item === "object" && item ? item.id || item.equipment_id : item))
      .filter(Boolean);
    for (const equipmentId of ids) {
      const equipment = equipmentById.get(equipmentId);
      if (!equipment) continue;
      activeEquipmentRows.push({
        ...construction,
        ...equipment,
      });
    }
  }

  if (!activeEquipmentRows.length) return { items: [], reason: "" };

  const constructionIds = [...new Set(activeEquipmentRows.map((item) => Number(item.id)).filter(Boolean))];
  const [diaryRows] = await db.query(
    `SELECT DISTINCT
        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED) AS construction_id,
        CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED) AS equipment_id,
        COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS diary_date
     FROM diaries d
     WHERE CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED) IN (?)
       AND COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) <= ?`,
    [constructionIds, latestOverdueDate]
  );

  const diariesByConstructionEquipment = new Map();
  for (const row of diaryRows) {
    const constructionId = Number(row.construction_id || 0);
    const equipmentId = Number(row.equipment_id || 0);
    const diaryDate = normalizeDateOnly(row.diary_date);
    if (!constructionId || !equipmentId || !diaryDate) continue;
    const mapKey = `${constructionId}:${equipmentId}`;
    const current = diariesByConstructionEquipment.get(mapKey) || new Set();
    current.add(diaryDate);
    diariesByConstructionEquipment.set(mapKey, current);
  }

  const [logRows] = await db.query(
    `SELECT id, construction_id, reference_date, status, created_at, metadata_json
     FROM whatsapp_notification_logs
     WHERE event_type = 'diary_overdue_reminder'
       AND construction_id IN (?)`,
    [constructionIds]
  );

  const logsByKey = new Map();
  for (const row of logRows) {
    const metadata = parseJsonSafe(row.metadata_json, {});
    const equipmentId = Number(metadata.equipmentId || 0);
    const key = `diary_overdue_reminder:${Number(row.construction_id || 0)}:${equipmentId}:${normalizeDateOnly(row.reference_date)}`;
    const current = logsByKey.get(key);
    if (!current || Number(current.id || 0) < Number(row.id || 0)) {
      logsByKey.set(key, row);
    }
  }

  const items = [];
  for (const construction of activeEquipmentRows) {
    const constructionId = Number(construction.id || 0);
    const equipmentId = Number(construction.equipment_id || 0);
    const startDate = normalizeDateOnly(construction.start_date) || latestOverdueDate;
    const diaryDates = diariesByConstructionEquipment.get(`${constructionId}:${equipmentId}`) || new Set();
    const expectedDates = daysBetweenInclusive(startDate, latestOverdueDate);
    const missingDates = expectedDates.filter((dateText) => {
      if (diaryDates.has(dateText)) return false;
      const existingLog = logsByKey.get(`diary_overdue_reminder:${constructionId}:${equipmentId}:${dateText}`);
      return !shouldSkipDedupeLog(existingLog);
    });

    if (!missingDates.length) continue;
    const referenceDate = missingDates[0];
    items.push({
      key: `${constructionId}:${equipmentId}:${referenceDate}`,
      constructionId,
      constructionNumber: String(construction.construction_number || ""),
      equipmentId,
      equipmentName: String(construction.equipment_name || ""),
      referenceDate,
      dueAt: `${shiftDateWithTz(referenceDate, 1)} 08:00`,
      responsibleOperatorUserId: construction.operator_user_id == null ? null : Number(construction.operator_user_id),
      operatorName: String(construction.operator_name || ""),
      operatorPhone: String(construction.operator_phone || ""),
      canSend: Boolean(construction.operator_user_id && normalizeBrazilPhone(construction.operator_phone)),
      reason: !construction.operator_user_id
        ? "missing_equipment_operator"
        : !normalizeBrazilPhone(construction.operator_phone)
          ? "missing_phone"
          : "",
    });
  }

  return { items, reason: "", generatedAt: saoPauloNow.toISOString() };
}

async function runDiaryOverdueReminderSweep() {
  if (whatsappSchedulerState.running) return;
  whatsappSchedulerState.running = true;

  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.logsTable || !schema.equipmentOperatorColumn || !isWhatsAppConfigured()) {
      whatsappSchedulerState.lastRunAt = new Date().toISOString();
      whatsappSchedulerState.lastError = !schema.logsTable
        ? "Tabela whatsapp_notification_logs ausente."
        : !schema.equipmentOperatorColumn
          ? "Coluna equipments.operator_user_id ausente."
          : "Z-API não configurada.";
      return;
    }

    const { items } = await fetchDiaryReminderCandidates();
    for (const item of items) {
      const messageText = renderDiaryReminderMessage("", item);

      if (!item.responsibleOperatorUserId) {
        await sendLoggedWhatsAppMessage({
          eventType: "diary_overdue_reminder",
          userId: null,
          phone: "",
          constructionId: item.constructionId,
          referenceDate: item.referenceDate,
          dedupeKey: `diary_overdue:${item.constructionId}:${item.equipmentId || 0}:${item.referenceDate}:0`,
          targetName: item.operatorName,
          messageText,
          metadata: {
            obraNumero: item.constructionNumber,
            equipmentId: item.equipmentId,
            equipmentName: item.equipmentName,
            dueAt: item.dueAt,
            delayedDiary: true,
            source: "scheduler",
          },
          skipDispatchReason: "missing_responsible_operator",
          skipDispatchMessage: "A obra ativa não possui operador responsável definido.",
        });
        continue;
      }

      if (!normalizeBrazilPhone(item.operatorPhone)) {
        await sendLoggedWhatsAppMessage({
          eventType: "diary_overdue_reminder",
          userId: item.responsibleOperatorUserId,
          phone: item.operatorPhone,
          constructionId: item.constructionId,
          referenceDate: item.referenceDate,
          dedupeKey: `diary_overdue:${item.constructionId}:${item.equipmentId || 0}:${item.referenceDate}:${item.responsibleOperatorUserId}`,
          targetName: item.operatorName,
          messageText,
          metadata: {
            obraNumero: item.constructionNumber,
            equipmentId: item.equipmentId,
            equipmentName: item.equipmentName,
            dueAt: item.dueAt,
            delayedDiary: true,
            source: "scheduler",
          },
          skipDispatchReason: "missing_phone",
          skipDispatchMessage: "O operador responsável da obra não possui telefone válido.",
        });
        continue;
      }

      await sendLoggedWhatsAppMessage({
        eventType: "diary_overdue_reminder",
        userId: item.responsibleOperatorUserId,
        phone: item.operatorPhone,
        constructionId: item.constructionId,
        referenceDate: item.referenceDate,
        dedupeKey: `diary_overdue:${item.constructionId}:${item.equipmentId || 0}:${item.referenceDate}:${item.responsibleOperatorUserId || 0}`,
        targetName: item.operatorName,
        messageText,
        metadata: {
          obraNumero: item.constructionNumber,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          dueAt: item.dueAt,
          delayedDiary: true,
          source: "scheduler",
        },
      });
    }

    whatsappSchedulerState.lastRunAt = new Date().toISOString();
    whatsappSchedulerState.lastError = "";
  } catch (error) {
    whatsappSchedulerState.lastRunAt = new Date().toISOString();
    whatsappSchedulerState.lastError = error?.message || "Falha no scheduler de WhatsApp.";
  } finally {
    whatsappSchedulerState.running = false;
  }
}

function bootstrapWhatsAppScheduler() {
  const enabled = String(process.env.WHATSAPP_SCHEDULER_ENABLED || "true").trim().toLowerCase() === "true";
  if (!enabled) return;

  const intervalMinutes = Math.max(5, Number(process.env.WHATSAPP_SCHEDULER_INTERVAL_MINUTES || 30) || 30);
  setTimeout(() => {
    void runDiaryOverdueReminderSweep();
  }, 20 * 1000);
  setInterval(() => {
    void runDiaryOverdueReminderSweep();
  }, intervalMinutes * 60 * 1000);
}

function buildS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || "sa-east-1",
    // Buckets com pontos no nome podem falhar com TLS em virtual-hosted style.
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function getClientLogin(value) {
  return String(value || process.env.S3_CLIENT_LOGIN || "cgontijo").trim();
}

function buildPrefix(clientLogin, imei, date) {
  const [year, month, day] = date.split("-");
  const base = (process.env.S3_PREFIX_BASE || "c").replace(/\/+$/, "");
  return `${base}/${clientLogin}/h/${imei}/${year}/${month}/${day}/`;
}

function parseEstacaKey(key) {
  const fileName = key.split("/").pop() || "";
  const match = fileName.match(
    /^(\d{6})-([^-]+)-([^-]+)-(.+)$/
  );

  if (!match) {
    return {
      fileName,
      finishedAt: null,
      contrato: null,
      obra: null,
      estaca: null,
    };
  }

  const [, hhmmss, contratoRaw, obraRaw, estacaRaw] = match;
  const decode = (value) =>
    value.replace(/e/g, " ").replace(/s/g, "-").replace(/p/g, ".").replace(/a/g, "+");

  return {
    fileName,
    finishedAt: `${hhmmss.slice(0, 2)}:${hhmmss.slice(2, 4)}:${hhmmss.slice(4, 6)}`,
    contrato: decode(contratoRaw),
    obra: decode(obraRaw),
    estaca: decode(estacaRaw),
  };
}

function getConverterPath() {
  const toolName = process.platform === "win32" ? "sacibin2txt.exe" : "sacibin2txt";
  return path.join(__dirname, "tools", toolName);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getCacheDir() {
  return path.join(__dirname, ".cache", "estacas");
}

function getCacheFilePath(key) {
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  return path.join(getCacheDir(), `${hash}.json`);
}

function readCachedDetail(key) {
  try {
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCachedDetail(key, detail) {
  try {
    ensureDir(getCacheDir());
    fs.writeFileSync(getCacheFilePath(key), JSON.stringify(detail), "utf8");
  } catch {
  }
}

function parseDateString(date) {
  const [year, month, day] = String(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function normalizeDateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function formatUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildWeekDates(weekStart) {
  const start = parseDateString(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    return formatUtcDate(current);
  });
}

function shiftDate(dateText, days) {
  const date = parseDateString(dateText);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
}

function getCurrentDateString(timeZone = process.env.APP_TIMEZONE || "America/Sao_Paulo") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

function getWeekStartFromDate(dateText) {
  const date = parseDateString(dateText);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return formatUtcDate(date);
}

function formatDateBr(dateText) {
  const normalized = normalizeDateOnly(dateText);
  if (!normalized) return "-";
  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function shiftDateWithTz(dateText, days) {
  return shiftDate(normalizeDateOnly(dateText) || getCurrentDateString(), days);
}

function daysBetweenInclusive(startDateText, endDateText) {
  const start = parseDateString(startDateText);
  const end = parseDateString(endDateText);
  const items = [];
  while (start <= end) {
    items.push(formatUtcDate(start));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return items;
}

async function tableExists(tableName, conn = db) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(row?.total || 0) > 0;
}

async function columnExists(tableName, columnName, conn = db) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [tableName, columnName]
  );
  return Number(row?.total || 0) > 0;
}

let userSignaturePermissionColumnEnsured = false;
async function ensureUserSignaturePermissionColumn(conn = db) {
  if (userSignaturePermissionColumnEnsured) return;
  if (!(await columnExists("users", "pode_gerar_link_assinatura", conn))) {
    await conn.query("ALTER TABLE users ADD COLUMN pode_gerar_link_assinatura ENUM('S','N') NOT NULL DEFAULT 'N'");
  }
  userSignaturePermissionColumnEnsured = true;
}

async function userCanGenerateDiarySignatureLink(userId, conn = db) {
  await ensureUserSignaturePermissionColumn(conn);
  const [[row]] = await conn.query(
    "SELECT document, pode_gerar_link_assinatura FROM users WHERE id = ? AND active = 'S'",
    [userId]
  );
  if (ADMIN_GLOBAL_CPFS.includes(row?.document)) return true;
  return String(row?.pode_gerar_link_assinatura || "N") === "S";
}

function parseJsonSafe(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJsonSafe(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify(null);
  }
}

function textOrNull(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function eventTypeLabel(eventType) {
  if (eventType === "diary_overdue_reminder") return "Diário atrasado";
  if (eventType === "point_missing_reminder") return "Ponto pendente";
  if (eventType === "course_available_notice") return "Curso disponível";
  return eventType || "-";
}

function buildWhatsAppHistoryText(row, metadata = {}) {
  const eventType = String(row.event_type || "");
  const status = String(row.status || "");
  const targetName = String(row.target_name || row.user_name || "colaborador");
  const obraNumero = String(row.construction_number || metadata.obraNumero || "-");
  const equipmentName = String(metadata.equipmentName || "");
  const referenceDate = formatDateBr(normalizeDateOnly(row.reference_date));
  const statusPrefix =
    status === "sent"
      ? "Mensagem enviada"
      : status === "failed"
        ? "Falha no envio"
        : status === "skipped"
          ? "Envio ignorado"
          : "Envio registrado";

  if (eventType === "diary_overdue_reminder") {
    const equipmentText = equipmentName ? ` / equipamento ${equipmentName}` : "";
    return `${statusPrefix}: ${targetName} atrasou o diario da obra ${obraNumero}${equipmentText}, referente ao dia ${referenceDate}.`;
  }

  if (eventType === "point_missing_reminder") {
    return `${statusPrefix}: lembrete de ponto para ${targetName}, referente ao dia ${referenceDate}.`;
  }

  if (eventType === "course_available_notice") {
    return `${statusPrefix}: aviso de curso disponivel para ${targetName}${row.course_title ? ` (${row.course_title})` : ""}.`;
  }

  return `${statusPrefix}: ${eventTypeLabel(eventType)} para ${targetName}.`;
}

function buildDiaryReminderMessage({ operatorName, obraNumero, referenceDate }) {
  return `Olá, ${operatorName || "colaborador"}! O diário da obra ${obraNumero || "-"} referente ao dia ${formatDateBr(referenceDate)} está atrasado. Por favor, acesse o app da Gontijo e envie o diário o quanto antes.`;
}

function renderDiaryReminderMessage(template, item) {
  const equipmentText = item.equipmentName ? ` / equipamento ${item.equipmentName}` : "";
  const base = textOrNull(template) || `Ola, ${item.operatorName || "colaborador"}! O diario da obra ${item.constructionNumber || "-"}${equipmentText} referente ao dia ${formatDateBr(item.referenceDate)} esta atrasado. Por favor, acesse o app da Gontijo e envie o diario o quanto antes.`;

  return base
    .replace(/\{operador\}/gi, item.operatorName || "colaborador")
    .replace(/\{obra\}/gi, item.constructionNumber || "-")
    .replace(/\{equipamento\}/gi, item.equipmentName || "-")
    .replace(/\{data\}/gi, formatDateBr(item.referenceDate))
    .replace(/\{prazo\}/gi, item.dueAt || "-");
}

function buildPointReminderMessage({ userName, referenceDate }) {
  return `Olá, ${userName || "colaborador"}! Identificamos que seu ponto de ${formatDateBr(referenceDate)} ainda precisa ser atualizado no Tangerino. Por favor, regularize o ponto o quanto antes.`;
}

function buildCourseAvailableMessage({ userName, courseTitle }) {
  return `Olá, ${userName || "colaborador"}! O curso "${courseTitle || "Treinamento"}" já está disponível na plataforma da Gontijo. Acesse o app, assista ao conteúdo e conclua a prova, se houver.`;
}

function renderCourseNoticeMessage(template, { userName, courseTitle }) {
  const base = textOrNull(template) || buildCourseAvailableMessage({ userName, courseTitle });
  return base
    .replace(/\{colaborador\}/gi, userName || "colaborador")
    .replace(/\{curso\}/gi, courseTitle || "Treinamento");
}

function renderPointReminderMessage(template, { userName, referenceDate }) {
  const base = textOrNull(template) || buildPointReminderMessage({ userName, referenceDate });
  return base
    .replace(/\{colaborador\}/gi, userName || "colaborador")
    .replace(/\{data\}/gi, formatDateBr(referenceDate));
}

const whatsappSchedulerState = {
  running: false,
  lastRunAt: null,
  lastError: "",
};

function normalizeLooseText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "")
    .replace(/ø/gi, "diam")
    .replace(/r\$/gi, "rs")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCompactText(value) {
  return normalizeLooseText(value).replace(/[^a-z0-9]+/g, "");
}

const EXPECTED_GOAL_HEADERS = [
  "Data",
  "Equipamento",
  "N\u00ba Obra",
  "Meta qtd estacas",
  "\u00d81",
  "Profundidade",
  "Valor \u00d81",
  "Meta qtd estacas",
  "\u00d82",
  "Profundidade",
  "Valor (R$)",
];

const GOAL_HEADER_ALIASES = [
  ["data"],
  ["equipamento"],
  ["nobra", "numeroobra", "nordobra"],
  ["metaqtdestacas", "metaquantidadedeestacas", "metaqtddeestacas"],
  ["diam1", "d1"],
  ["profundidade"],
  ["valordiam1", "valor1", "valord1"],
  ["metaqtdestacas", "metaquantidadedeestacas", "metaqtddeestacas"],
  ["diam2", "d2"],
  ["profundidade"],
  ["valorrs", "valorr", "valor2"],
];

function normalizeHeaderLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[ ]+\)/g, ")")
    .trim();
}

function normalizeHeaderKey(value) {
  return normalizeLooseText(String(value || ""))
    .replace(/\((.*?)\)/g, "$1")
    .replace(/quantidade/g, "qtd")
    .replace(/estacas/g, "estacas")
    .replace(/valor/g, "valor")
    .replace(/obra/g, "obra")
    .replace(/numero/g, "n")
    .replace(/nº/g, "n")
    .replace(/n°/g, "n")
    .replace(/n\b/g, "n")
    .replace(/diam_/g, "diam")
    .replace(/diametro/g, "diam")
    .replace(/[^a-z0-9]+/g, "");
}

function parseSpreadsheetDate(value) {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatUtcDate(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())));
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return formatUtcDate(new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)));
    }
  }

  const text = String(value).trim();
  if (!text) return null;

  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (brMatch) {
    const [, day, month, yearRaw] = brMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return text;
  }

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return formatUtcDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
  }

  return null;
}

function parseSpreadsheetNumber(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpectedGoalHeaderRow(row) {
  const compact = row.map(normalizeCompactText);
  const expectedStart = [
    "data",
    "equipamento",
    "nobra",
    "metaquantidadedeestacas",
    "diam1",
    "profundidade",
    "valordiam1",
    "metaquantidadedeestacas",
    "diam2",
    "profundidade",
    "valorrs",
  ];

  return expectedStart.every((item, index) => compact[index] === item);
}

function readGoalSheetRows(file) {
  const workbook = XLSX.read(file.buffer, { type: "buffer", raw: true, cellDates: true });
  const preferredSheetName = workbook.SheetNames.find((name) => String(name).trim().toLowerCase() === "teste");
  const sheetName = preferredSheetName || workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("A planilha enviada nao contem abas legiveis.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  const headerIndex = rows.findIndex(isExpectedGoalHeaderRow);
  if (headerIndex === -1) {
    throw new Error("Cabecalho invalido. Use o layout com Data, Equipamento, Nº Obra, Meta, Ø_1, Profundidade, Valor Ø_1, Meta, Ø_2, Profundidade, Valor(R$).");
  }

  return rows.slice(headerIndex + 1);
}

function isExpectedGoalHeaderRow(row) {
  const keys = row.slice(0, GOAL_HEADER_ALIASES.length).map(normalizeHeaderKey);
  return GOAL_HEADER_ALIASES.every((aliases, index) => aliases.includes(keys[index]));
}

function readGoalSheetRows(file) {
  const workbook = XLSX.read(file.buffer, { type: "buffer", raw: true, cellDates: true });
  const preferredSheetName = workbook.SheetNames.find((name) => String(name).trim().toLowerCase() === "teste");
  const sheetName = preferredSheetName || workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("A planilha enviada nao contem abas legiveis.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  const headerIndex = rows.findIndex(isExpectedGoalHeaderRow);
  if (headerIndex === -1) {
    throw new Error(`Cabecalho invalido. Use este padrao: ${EXPECTED_GOAL_HEADERS.join(" | ")}.`);
  }

  return rows.slice(headerIndex + 1);
}

function findOfficialMachineMatch(equipmentLabel) {
  if (!String(equipmentLabel || "").trim()) {
    return { machine: null, warnings: ["Equipamento vazio na planilha."] };
  }

  const machine = resolveOfficialMachine(equipmentLabel);
  if (!machine) {
    return { machine: null, warnings: ["Maquina nao encontrada no cadastro-base oficial."] };
  }

  return { machine, warnings: [] };

  if (obraExactCandidates.length === 1) {
    return { mapping: obraExactCandidates[0], warnings: [] };
  }
  if (exactCandidates.length === 1) {
    const warnings = obraKey && normalizeCompactText(exactCandidates[0].obra_code) !== obraKey
      ? ["Obra da planilha difere do vinculo ativo; mantido o Nº Obra do arquivo."]
      : [];
    return { mapping: exactCandidates[0], warnings };
  }

  const fuzzyCandidates = mappings.filter((item) => {
    const machineKey = normalizeCompactText(item.machine_name);
    return machineKey && (machineKey.includes(equipmentKey) || equipmentKey.includes(machineKey));
  });

  if (fuzzyCandidates.length === 1) {
    return { mapping: fuzzyCandidates[0], warnings: ["Maquina reconhecida por nome aproximado. Revise antes de salvar."] };
  }

  if (exactCandidates.length > 1 || fuzzyCandidates.length > 1) {
    return { mapping: null, warnings: ["Mais de um vinculo combina com o equipamento. Ajuste o cadastro ou remova a linha."] };
  }

  return { mapping: null, warnings: ["Maquina nao reconhecida no cadastro ativo."] };
}

function isConfiguredGoalImportMapping(mapping) {
  if (!mapping || !mapping.active) return false;

  const hasImei = Boolean(String(mapping.imei || "").trim());
  const hasWorkInfo = Boolean(String(mapping.obra_code || "").trim() || String(mapping.obra_name || "").trim());
  const hasGoalConfig = Number(mapping.daily_goal_estacas || 0) > 0 || Number(mapping.weekly_goal_estacas || 0) > 0;
  const wasManuallyUpdated =
    String(mapping.updated_at || "").trim()
    && String(mapping.created_at || "").trim()
    && String(mapping.updated_at) !== String(mapping.created_at);

  return hasImei && (hasWorkInfo || hasGoalConfig || wasManuallyUpdated);
}

async function parseGoalImportFile(file) {
  if (!file?.buffer?.length) {
    throw new Error("Arquivo de importacao vazio.");
  }

  const rows = readGoalSheetRows(file);
  const items = [];
  let skippedWithoutOfficialMachine = 0;

  rows.forEach((row, index) => {
    const equipmentLabel = String(row[1] || "").trim();
    const obraCode = String(row[2] || "").trim();
    const date = parseSpreadsheetDate(row[0]);
    const sourceText = row.slice(0, 11).map((value) => String(value ?? "").trim()).filter(Boolean).join(" | ");

    if (!date && !equipmentLabel && !obraCode && !sourceText) {
      return;
    }

    const warnings = [];
    const errors = [];

    if (!date) errors.push("Data invalida ou ausente.");
    if (!equipmentLabel) errors.push("Equipamento ausente.");

    const segmentInputs = [
      {
        faixa: 1,
        metaEstacas: Math.round(parseSpreadsheetNumber(row[3])),
        diametroCm: parseDiameterCm(row[4]),
        profundidadeM: parseSpreadsheetNumber(row[5]),
        valor: parseSpreadsheetNumber(row[6]),
      },
      {
        faixa: 2,
        metaEstacas: Math.round(parseSpreadsheetNumber(row[7])),
        diametroCm: parseDiameterCm(row[8]),
        profundidadeM: parseSpreadsheetNumber(row[9]),
        valor: parseSpreadsheetNumber(row[10]),
      },
    ];

    const segments = [];
    let totalMeq = 0;
    let totalEstacas = 0;

    segmentInputs.forEach((segment) => {
      const hasAnyValue = [segment.metaEstacas, segment.diametroCm, segment.profundidadeM, segment.valor].some((value) => Number(value || 0) > 0);
      if (!hasAnyValue) return;

      if (!segment.metaEstacas) warnings.push(`Faixa ${segment.faixa} sem meta de estacas.`);
      if (!segment.diametroCm) warnings.push(`Faixa ${segment.faixa} com diametro invalido.`);
      if (!segment.profundidadeM) warnings.push(`Faixa ${segment.faixa} sem profundidade.`);

      const meq = calculateSegmentMeq(segment.metaEstacas, segment.profundidadeM, segment.diametroCm);
      totalEstacas += Number(segment.metaEstacas || 0);
      totalMeq += Number(meq.metaMeqSegmento || 0);

      segments.push({
        faixa: segment.faixa,
        meta_estacas: Number(segment.metaEstacas || 0),
        diameter_cm: segment.diametroCm,
        profundidade_m: Number(segment.profundidadeM || 0),
        valor: Number(segment.valor || 0),
        meq_factor: meq.meqFactor,
        meta_meq_segmento: meq.metaMeqSegmento,
      });
    });

    if (!segments.length) {
      errors.push("Linha sem faixas de meta preenchidas.");
    }

    const match = findOfficialMachineMatch(equipmentLabel);
    if (!match.machine) {
      skippedWithoutOfficialMachine += 1;
      return;
    }

    warnings.push(...match.warnings);

    items.push({
      source_row_number: index + 2,
      date: date || "",
      machine_name: match.machine.machine_name,
      equipment_label: equipmentLabel,
      imei: match.machine.imei,
      obra_code: obraCode,
      source_image_id: "",
      source_file_name: file.originalname || "",
      source_text: sourceText,
      meta_estacas_total: totalEstacas,
      meta_meq_total: Number(totalMeq.toFixed(2)),
      meta_meq_informado: null,
      segments,
      warnings,
      errors,
    });
  });

  return {
    items,
    skippedWithoutOfficialMachine,
  };
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || "");
  return raw.split(";").reduce((acc, part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function cookieOptionsForRequest(req) {
  const isCrossOrigin = Boolean(process.env.CORS_ORIGIN);
  const forwardedProto = req ? String(req.headers["x-forwarded-proto"] || "") : "";
  const isHttps = forwardedProto === "https" || process.env.FORCE_HTTPS_COOKIES === "true";
  const secure = (process.env.NODE_ENV === "production" || isCrossOrigin) && isHttps;
  return {
    path: "/",
    sameSite: isCrossOrigin ? "None" : "Lax",
    secure,
  };
}

function clearCookie(res, name) {
  setCookie(res, name, "", {
    maxAge: 0,
    ...cookieOptionsForRequest(),
  });
}

function getAdminSession(req) {
  const token = parseCookies(req).admin_session;
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session) return null;
  return { token, ...session };
}

function getClientPortalSession(req) {
  const token = parseCookies(req).client_portal_session;
  if (!token) return null;
  const session = clientPortalSessions.get(token);
  if (!session) return null;
  return { token, ...session };
}

function requireAdmin(req, res, next) {
  const session = getAdminSession(req);
  if (!session) {
    return res.status(401).json({
      ok: false,
      message: "Sessao admin obrigatoria.",
    });
  }
  req.adminSession = session;
  return next();
}

function requireClientPortal(req, res, next) {
  const session = getClientPortalSession(req);
  if (!session) {
    return res.status(401).json({
      ok: false,
      message: "Sessao do portal do cliente obrigatoria.",
    });
  }
  req.clientPortalSession = session;
  return next();
}

function validateMappingPayload(input) {
  const payload = {
    imei: String(input?.imei || "").trim(),
    machine_name: String(input?.machine_name || "").trim(),
    obra_code: String(input?.obra_code || "").trim(),
    obra_name: String(input?.obra_name || "").trim(),
    daily_goal_estacas: Number(input?.daily_goal_estacas || 0),
    weekly_goal_estacas: Number(input?.weekly_goal_estacas || 0),
    active: Boolean(input?.active),
  };

  if (!/^\d{15}$/.test(payload.imei)) {
    throw new Error("IMEI invalido. Informe 15 digitos numericos.");
  }
  if (!payload.machine_name) {
    throw new Error("Nome da maquina obrigatorio.");
  }
  if (payload.daily_goal_estacas < 0 || payload.weekly_goal_estacas < 0) {
    throw new Error("Metas devem ser maiores ou iguais a zero.");
  }

  return payload;
}

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function runConverter(inputBuffer) {
  return new Promise((resolve, reject) => {
    const converterPath = getConverterPath();

    if (!fs.existsSync(converterPath)) {
      reject(new Error(`Conversor nao encontrado em ${converterPath}`));
      return;
    }

    const child = spawn(converterPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Conversor retornou codigo ${code}: ${Buffer.concat(stderrChunks).toString("utf8")}`
          )
        );
        return;
      }

      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });

    child.stdin.write(inputBuffer);
    child.stdin.end();
  });
}

function parseNumericLine(line) {
  return line
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sum(values) {
  return values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0);
}

function parseBrDateTime(text) {
  const match = String(text || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, dd, mm, yy, hh, min] = match.map(Number);
  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  return new Date(Date.UTC(year, mm - 1, dd, hh, min, 0));
}

function minutesBetween(startText, endText) {
  const start = parseBrDateTime(startText);
  const end = parseBrDateTime(endText);
  if (!start || !end) {
    return null;
  }
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

function parseInclination(text) {
  const parts = String(text || "")
    .split(",")
    .map((item) => Number(item.trim()));
  const x = parts[0];
  const y = parts[1];
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const xDeg = x / 10;
  const yDeg = y / 10;
  return {
    xDeg,
    yDeg,
    magnitudeDeg: Math.sqrt((xDeg ** 2) + (yDeg ** 2)),
  };
}

function decodeGps(latitudeRaw, longitudeRaw, altitudeRaw) {
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const altitude = Number(altitudeRaw);

  if (!latitude || !longitude || !altitude) {
    return null;
  }

  const lat = (latitude - 2147483648) / 600000;
  const lon = (longitude - 2147483648) / 600000;
  const alt = altitude - 32768;

  if (lat >= 90 || lat <= -90 || lon >= 180 || lon <= -180) {
    return null;
  }

  return { lat, lon, alt };
}

function parseLine8Metadata(text) {
  const values = String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));

  if (!values.length) {
    return { pulsesPerRotation: null, gps: null, rawValues: [] };
  }

  let gps = null;
  if (values.length === 4) {
    gps = decodeGps(values[1], values[2], values[3]);
  } else if (values.length === 20) {
    gps = decodeGps(values[17], values[18], values[19]);
  }

  return {
    pulsesPerRotation: Number.isFinite(values[0]) ? values[0] : null,
    gps,
    rawValues: values,
  };
}

function convertPressureBar(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  return -3.32 + (28.32 * rawValue) / 256;
}

function convertTorqueBar(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  return -53.1 + (453.1 * rawValue) / 256;
}

function classifyShift(timeText) {
  const match = String(timeText || "").match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return "indefinido";
  }
  const hour = Number(match[1]);
  if (hour >= 6 && hour < 14) return "manha";
  if (hour >= 14 && hour < 22) return "tarde";
  return "noite";
}

function calculateDepthAndPhases(sliceLines) {
  let drilling = 0;
  let concreting = 0;
  let drillingInProgress = true;
  let last = null;

  for (const tick of sliceLines) {
    const [current] = parseNumericLine(tick);

    if (Number.isNaN(current)) {
      continue;
    }

    if (drillingInProgress) {
      if (current === last) {
        drillingInProgress = false;
      } else {
        drilling += 1;
      }
    } else {
      concreting += 1;
    }

    last = current;
  }

  return {
    drillingSlices: drilling,
    concretingSlices: concreting,
    depthCm: Math.max(drilling, concreting) * 8,
  };
}

function parseConvertedText(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const meaningful = lines.filter((line) => line.trim().length > 0);

  if (meaningful.length < 12) {
    throw new Error("Saida do conversor invalida ou incompleta.");
  }

  const headerLines = meaningful.slice(0, 12);
  const sliceLines = meaningful.slice(12);
  const phaseSummary = calculateDepthAndPhases(sliceLines);

  const slices = sliceLines.map((line, index) => {
    const [timeTick, value2, value3] = parseNumericLine(line);
    return {
      index: index + 1,
      raw: line,
      timeTick,
      value2,
      value3,
    };
  });

  return {
    header: {
      version: headerLines[0] || "",
      contrato: headerLines[1] || "",
      obra: headerLines[2] || "",
      numero: headerLines[3] || "",
      diametro: headerLines[4] || "",
      bomba: headerLines[5] || "",
      inclinacao: headerLines[6] || "",
      linha8: headerLines[7] || "",
      inicioPerfuracao: headerLines[8] || "",
      fimPerfuracao: headerLines[9] || "",
      inicioConcretagem: headerLines[10] || "",
      fimConcretagem: headerLines[11] || "",
    },
    phases: phaseSummary,
    slices,
  };
}

async function getObjectBuffer(client, key) {
  const result = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    })
  );

  return streamToBuffer(result.Body);
}

async function buildEstacaDetail(client, key) {
  const cached = readCachedDetail(key);
  if (cached) {
    return cached;
  }

  const bodyBuffer = await getObjectBuffer(client, key);
  const convertedText = await runConverter(bodyBuffer);
  const parsed = parseConvertedText(convertedText);

  const detail = {
    key,
    size: bodyBuffer.length,
    parsed,
  };

  writeCachedDetail(key, detail);
  return detail;
}

function toOperationalSummary(item, detail) {
  const header = detail.parsed.header || {};
  const phases = detail.parsed.phases || {};
  const slices = detail.parsed.slices || [];
  const diameterCm = parseDiameterCm(header.diametro);
  const realizadoLinearM = Number.isFinite(phases.depthCm) ? phases.depthCm / 100 : null;
  const meqFactor = getMeqFactor(diameterCm);
  const realizadoMeq =
    Number.isFinite(realizadoLinearM) && Number.isFinite(meqFactor)
      ? Number((realizadoLinearM * meqFactor).toFixed(2))
      : null;
  const line8 = parseLine8Metadata(header.linha8);
  const inclination = parseInclination(header.inclinacao);
  const drillingDurationMin = minutesBetween(header.inicioPerfuracao, header.fimPerfuracao);
  const concretingDurationMin = minutesBetween(header.inicioConcretagem, header.fimConcretagem);
  const totalDurationMin =
    Number.isFinite(drillingDurationMin) && Number.isFinite(concretingDurationMin)
      ? drillingDurationMin + concretingDurationMin
      : null;
  const drillingSlices = slices.slice(0, phases.drillingSlices);
  const concretingSlices = slices.slice(phases.drillingSlices + 1);
  const pumpVolumeDeciliters = Number(String(header.bomba || "").replace(",", ".").trim());
  const pumpVolumeLiters = Number.isFinite(pumpVolumeDeciliters) ? pumpVolumeDeciliters / 10 : null;
  const estimatedConcreteLiters =
    pumpVolumeLiters != null ? sum(concretingSlices.map((slice) => slice.value3)) * pumpVolumeLiters : null;
  const avgPressureBar = average(concretingSlices.map((slice) => convertPressureBar(slice.value2)));
  const avgTorqueBar = average(drillingSlices.map((slice) => convertTorqueBar(slice.value3)));
  const drillingTicks = drillingSlices.map((slice) => slice.timeTick).filter((value) => Number.isFinite(value));
  const drillingTicksDiff = drillingTicks.length > 1 ? drillingTicks[drillingTicks.length - 1] - drillingTicks[0] : null;
  const drillingMinutesByTicks = Number.isFinite(drillingTicksDiff) ? drillingTicksDiff / 93.75 / 60 : null;
  const avgRotationRpm =
    line8.pulsesPerRotation && drillingMinutesByTicks && drillingMinutesByTicks > 0
      ? (sum(drillingSlices.map((slice) => slice.value2)) / line8.pulsesPerRotation) / drillingMinutesByTicks
      : null;
  const finishedAtDate = item.finishedAt ? `${item.finishedAt}` : null;
  const shift = classifyShift(item.finishedAt);

  return {
    key: item.key,
    fileName: item.fileName,
    finishedAt: item.finishedAt,
    contrato: (header.contrato || item.contrato || "").trim(),
    obra: (header.obra || item.obra || "").trim(),
    estaca: (header.numero || item.estaca || "").trim(),
    diametroCm: diameterCm,
    realizadoM: realizadoLinearM,
    realizadoLinearM,
    realizadoMeq,
    meqFactor,
    profundidadeCm: phases.depthCm ?? 0,
    drillingSlices: phases.drillingSlices ?? 0,
    concretingSlices: phases.concretingSlices ?? 0,
    drillingDurationMin,
    concretingDurationMin,
    totalDurationMin,
    inicioPerfuracao: header.inicioPerfuracao || "",
    fimPerfuracao: header.fimPerfuracao || "",
    inicioConcretagem: header.inicioConcretagem || "",
    fimConcretagem: header.fimConcretagem || "",
    inclination,
    pulsesPerRotation: line8.pulsesPerRotation,
    gps: line8.gps,
    estimatedConcreteLiters,
    avgPressureBar,
    avgTorqueBar,
    avgRotationRpm,
    shift,
    finishedAtDate,
  };
}

async function listEstacasByPrefix(client, prefix) {
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: prefix,
    })
  );

  return (result.Contents || []).map((item) => {
    const parsed = parseEstacaKey(item.Key);
    return {
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      ...parsed,
    };
  });
}

async function buildOperationalSummaries(client, prefix) {
  const objects = await listEstacasByPrefix(client, prefix);
  const summaries = [];

  for (const item of objects) {
    const detail = await buildEstacaDetail(client, item.key);
    summaries.push(toOperationalSummary(item, detail));
  }

  return summaries;
}

function applySummaryFilters(items, obraFilter, contratoFilter) {
  const obraQuery = String(obraFilter || "").trim().toLowerCase();
  const contratoQuery = String(contratoFilter || "").trim().toLowerCase();

  return items.filter((item) => {
    const obraOk = !obraQuery || String(item.obra || "").toLowerCase().includes(obraQuery);
    const contratoOk = !contratoQuery || String(item.contrato || "").toLowerCase().includes(contratoQuery);
    return obraOk && contratoOk;
  });
}

function groupTotals(items, field) {
  const map = new Map();

  for (const item of items) {
    const key = String(item[field] || "Nao informado").trim() || "Nao informado";
    const current = map.get(key) || { name: key, meters: 0, count: 0 };
    current.meters += item.realizadoM || 0;
    current.count += 1;
    map.set(key, current);
  }

  return [...map.values()].sort((a, b) => b.meters - a.meters);
}

function buildTimeline(items) {
  return [...items]
    .sort((a, b) => `${a.date} ${a.finishedAt}`.localeCompare(`${b.date} ${b.finishedAt}`))
    .map((item) => ({
      date: item.date,
      finishedAt: item.finishedAt,
      machine: item.machineName,
      estaca: item.estaca,
      obra: item.obra,
      contrato: item.contrato,
      realizadoM: item.realizadoM,
    }));
}

function buildHeatmap(machineReports, weekDates) {
  return machineReports.map((report) => ({
    machine: report.machine.name,
    imei: report.machine.imei,
    cells: weekDates.map((date) => {
      const daily = report.daily.find((item) => item.date === date);
      return {
        date,
        meters: daily?.totalMeters || 0,
        count: daily?.totalCount || 0,
      };
    }),
  }));
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return null;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function buildBoxplot(items) {
  const grouped = new Map();

  for (const item of items) {
    const key = item.machineName;
    const values = grouped.get(key) || [];
    if (Number.isFinite(item.realizadoM)) {
      values.push(item.realizadoM);
    }
    grouped.set(key, values);
  }

  return [...grouped.entries()].map(([machine, values]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return {
      machine,
      min: sorted[0] ?? null,
      q1: percentile(sorted, 0.25),
      median: percentile(sorted, 0.5),
      q3: percentile(sorted, 0.75),
      max: sorted[sorted.length - 1] ?? null,
    };
  });
}

function buildAlerts(machineReports, previousMachineReports, allItems) {
  const alerts = [];
  const previousMap = new Map(previousMachineReports.map((item) => [item.machine.imei, item]));

  for (const report of machineReports) {
    const previous = previousMap.get(report.machine.imei);
    if (report.daysWithoutProduction > 0) {
      alerts.push({
        type: "warning",
        machine: report.machine.name,
        message: `${report.daysWithoutProduction} dia(s) sem producao na semana.`,
      });
    }
    if (previous && previous.weeklyTotalMeters > 0 && report.weeklyTotalMeters < previous.weeklyTotalMeters * 0.7) {
      alerts.push({
        type: "warning",
        machine: report.machine.name,
        message: "Queda de produtividade superior a 30% em relacao a semana anterior.",
      });
    }
    if ((report.quality?.outOfInclinationLimit || 0) > 0) {
      alerts.push({
        type: "danger",
        machine: report.machine.name,
        message: `${report.quality.outOfInclinationLimit} estaca(s) com inclinacao acima do limite configurado.`,
      });
    }
  }

  const avgDepth = average(allItems.map((item) => item.realizadoM));
  if (Number.isFinite(avgDepth)) {
    for (const item of allItems) {
      if (item.realizadoM > avgDepth * 1.3 || item.realizadoM < avgDepth * 0.7) {
        alerts.push({
          type: "info",
          machine: item.machineName,
          message: `Estaca ${item.estaca} com profundidade fora do padrao medio da semana.`,
        });
      }
    }
  }

  return alerts.slice(0, 20);
}

function ensurePdfSpace(doc, needed = 28) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function formatDateBr(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateText || "");
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatClockFromHeader(text) {
  const match = String(text || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return "";
  return `${match[4]}:${match[5]}`;
}

function buildDiaryContext({ clientLogin, imei, date, items, machineName }) {
  const sortedByTime = [...items].sort((a, b) =>
    String(a.finishedAt || "").localeCompare(String(b.finishedAt || ""))
  );
  const firstItem = sortedByTime[0] || {};
  const lastItem = sortedByTime[sortedByTime.length - 1] || {};
  const totalMeters = sum(items.map((item) => item.realizadoM || 0));
  const totalArmacao = 0;
  const diameters = [...new Set(items.map((item) => item.diametroCm).filter(Number.isFinite))];

  const headerStart = items
    .map((item) => formatClockFromHeader(item.inicioPerfuracao))
    .filter(Boolean)
    .sort()[0] || "";
  const headerEnd = items
    .map((item) => formatClockFromHeader(item.fimConcretagem))
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || "";

  return {
    obraNumber: String(firstItem.obra || "").trim() || "N/A",
    clientName: process.env.DIARY_CLIENT_NAME || String(firstItem.contrato || clientLogin || "").trim() || "N/A",
    machineName: machineName || process.env.DIARY_MACHINE_NAME || imei,
    dateBr: formatDateBr(date),
    address: process.env.DIARY_ADDRESS || "N/A",
    team: process.env.DIARY_TEAM || "N/A",
    weather: {
      ensolarado: process.env.DIARY_WEATHER === "ensolarado",
      nublado: process.env.DIARY_WEATHER === "nublado",
      chuvaFraca: process.env.DIARY_WEATHER === "chuva_fraca",
      chuvaForte: process.env.DIARY_WEATHER === "chuva_forte",
    },
    startTime: headerStart || firstItem.finishedAt || "N/A",
    endTime: headerEnd || lastItem.finishedAt || "N/A",
    totalMeters,
    totalArmacao,
    totalCount: items.length,
    diameters,
    planningRows: diameters.slice(0, 2).map((diameter) => ({
      piles: process.env.DIARY_NEXT_DAY_PILES_PER_ROW || "2",
      diameter: String(Math.round(diameter)),
    })),
  };
}

function drawBox(doc, x, y, w, h, options = {}) {
  const fill = options.fill || null;
  const stroke = options.stroke || "#9f988c";
  if (fill) {
    doc.save();
    doc.fillColor(fill).rect(x, y, w, h).fill();
    doc.restore();
  }
  doc.save();
  doc.lineWidth(options.lineWidth || 1).strokeColor(stroke).rect(x, y, w, h).stroke();
  doc.restore();
}

function drawText(doc, text, x, y, w, options = {}) {
  doc
    .font(options.font || "Helvetica")
    .fontSize(options.size || 9)
    .fillColor(options.color || "#111111")
    .text(String(text ?? ""), x, y, {
      width: w,
      align: options.align || "left",
      continued: false,
    });
}

function drawLine(doc, x1, y1, x2, y2, color = "#9f988c") {
  doc.save();
  doc.strokeColor(color).lineWidth(1).moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.restore();
}

function drawGontijoDiaryLogo(doc, x, y, options = {}) {
  const logoPath = path.join(__dirname, "public", "gontijo-logo-diarios.png");
  const width = options.width || 92;
  const height = options.height || 32;

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, x, y, { fit: [width, height], align: "left", valign: "center" });
      return;
    } catch {
      // Mantem o PDF gerando mesmo se a imagem falhar.
    }
  }

  drawText(doc, "GONTIJO", x, y + 1, width - 10, {
    font: "Helvetica-Bold",
    size: 14,
  });
  drawText(doc, "FUNDAÇÕES", x + 4, y + 21, width - 14, {
    size: 7.5,
    color: "#666666",
  });
}

function buildDiaryPdf({ clientLogin, imei, date, items, prefix, machineName }) {
  const doc = new PDFDocument({ size: "A4", margin: 26 });
  const chunks = [];
  const ctx = buildDiaryContext({ clientLogin, imei, date, items, machineName });

  doc.on("data", (chunk) => chunks.push(chunk));

  const left = 42;
  const top = 52;
  const pageWidth = doc.page.width - left * 2;
  const gray = "#d7d3ce";
  const dark = "#151515";
  const border = "#9e9a94";
  drawBox(doc, left, top, pageWidth, 28, { fill: gray, stroke: border });
  drawText(doc, "GONTIJO", left + 6, top + 4, 78, {
    font: "Helvetica-Bold",
    size: 12,
  });
  drawText(doc, "FUNDACOES", left + 10, top + 16, 72, {
    size: 7.5,
    color: "#666666",
  });
  doc.save();
  doc.fillColor(gray).rect(left + 5, top + 4, 94, 21).fill();
  doc.restore();
  drawGontijoDiaryLogo(doc, left + 6, top + 4, { width: 92, height: 20 });

  drawText(doc, "DIARIO DE OBRA", left + 120, top + 8, 250, {
    font: "Helvetica-Bold",
    size: 13,
    align: "center",
  });
  drawText(doc, `N° DA OBRA: ${ctx.obraNumber}`, left + 380, top + 8, 130, {
    font: "Helvetica-Bold",
    size: 9,
    align: "right",
  });

  const row1Y = top + 28;
  drawBox(doc, left, row1Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row1Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row1Y, 108, 30, { stroke: border });
  drawText(doc, "Cliente:", left + 6, row1Y + 10, 40, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.clientName, left + 44, row1Y + 10, 268, { size: 7 });
  drawText(doc, "Equipamento", left + 322 + 6, row1Y + 10, 60, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, "Data:", left + 396 + 6, row1Y + 10, 26, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.dateBr, left + 396 + 60, row1Y + 10, 40, { size: 7, align: "right" });

  const row2Y = row1Y + 30;
  drawBox(doc, left, row2Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row2Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row2Y, 108, 30, { stroke: border });
  drawText(doc, "Endereco:", left + 6, row2Y + 9, 42, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.address, left + 50, row2Y + 9, 262, { size: 6.6 });
  drawText(doc, ctx.machineName, left + 322, row2Y + 9, 74, { font: "Helvetica-Bold", size: 10, align: "center" });
  drawText(doc, "Horario inicio:", left + 396 + 6, row2Y + 7, 52, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.startTime, left + 396 + 70, row2Y + 7, 28, { size: 7, align: "right" });

  const row3Y = row2Y + 30;
  drawBox(doc, left, row3Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row3Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row3Y, 108, 30, { stroke: border });
  drawText(doc, "Equipe:", left + 6, row3Y + 8, 34, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.team, left + 38, row3Y + 8, 274, { size: 6.2 });
  drawText(doc, "Horario termino:", left + 396 + 6, row3Y + 7, 58, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.endTime, left + 396 + 70, row3Y + 7, 28, { size: 7, align: "right" });

  const weatherY = row3Y + 38;
  drawText(doc, "Ensolarado:", left, weatherY, 70, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.ensolarado ? "X" : "_____", left + 42, weatherY, 34, { size: 7 });
  drawText(doc, "Nublado:", left + 130, weatherY, 52, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.nublado ? "X" : "_____", left + 165, weatherY, 34, { size: 7 });
  drawText(doc, "Chuva fraca:", left + 255, weatherY, 62, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.chuvaFraca ? "X" : "_____", left + 306, weatherY, 34, { size: 7 });
  drawText(doc, "Chuva forte:", left + 378, weatherY, 62, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.chuvaForte ? "X" : "_____", left + 428, weatherY, 34, { size: 7 });

  let y = weatherY + 18;
  drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border });
  drawText(doc, "Servicos Executados", left, y + 7, pageWidth, {
    font: "Helvetica-Bold",
    size: 8,
    align: "center",
  });
  y += 22;

  const serviceCols = [left, left + 118, left + 206, left + 316, left + 413, left + 504];
  drawBox(doc, left, y, pageWidth, 22, { stroke: border });
  ["Pilar/Estaca", "Diametro (cm)", "Realizado (m)", "Bits", "Armacao (m)"].forEach((label, index) => {
    if (index > 0) {
      drawLine(doc, serviceCols[index], y, serviceCols[index], y + 22, border);
    }
    drawText(doc, label, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
      font: "Helvetica",
      size: 6.5,
      align: "center",
    });
  });
  y += 22;

  const rowHeight = 22;
  items.forEach((item) => {
    drawBox(doc, left, y, pageWidth, rowHeight, { stroke: border });
    for (let i = 1; i < serviceCols.length - 1; i += 1) {
      drawLine(doc, serviceCols[i], y, serviceCols[i], y + rowHeight, border);
    }
    const values = [
      String(item.estaca || "").trim(),
      item.diametroCm != null ? String(Math.round(item.diametroCm)).replace(".", ",") : "-",
      item.realizadoM != null ? formatDecimalNumber(item.realizadoM, 2) : "-",
      "Nao",
      "0,00",
    ];
    values.forEach((value, index) => {
      drawText(doc, value, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
        size: 7.5,
        align: "center",
      });
    });
    y += rowHeight;
  });

  drawBox(doc, left, y, pageWidth, rowHeight, { stroke: border });
  for (let i = 1; i < serviceCols.length - 1; i += 1) {
    drawLine(doc, serviceCols[i], y, serviceCols[i], y + rowHeight, border);
  }
  [
    `${ctx.totalCount} estacas`,
    "-",
    formatDecimalNumber(ctx.totalMeters, 2),
    "-",
    formatDecimalNumber(ctx.totalArmacao, 2),
  ].forEach((value, index) => {
    drawText(doc, value, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
      font: "Helvetica-Bold",
      size: 7.5,
      align: "center",
    });
  });

  y += 30;
  drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border });
  drawText(doc, "OCORRENCIAS", left, y + 7, pageWidth, { font: "Helvetica-Bold", size: 8, align: "center" });
  y += 22;
  drawBox(doc, left, y, 150, 20, { stroke: border });
  drawBox(doc, left + 150, y, pageWidth - 150, 20, { stroke: border });
  drawText(doc, "Horario", left, y + 6, 150, { font: "Helvetica-Bold", size: 7, align: "center" });
  drawText(doc, "Descricao", left + 150, y + 6, pageWidth - 150, { font: "Helvetica-Bold", size: 7, align: "center" });
  y += 20;
  drawBox(doc, left, y, 150, 40, { stroke: border });
  drawBox(doc, left + 150, y, pageWidth - 150, 40, { stroke: border });
  drawText(doc, "N/A", left, y + 14, 150, { size: 7, align: "center" });
  drawText(
    doc,
    process.env.DIARY_OCCURRENCES || "Sem ocorrencias registradas automaticamente.",
    left + 158,
    y + 9,
    pageWidth - 166,
    { size: 7 }
  );

  y += 58;
  const fuelHeaderY = y;
  drawBox(doc, left, fuelHeaderY, pageWidth, 24, { fill: gray, stroke: border });
  drawText(doc, "ABASTECIMENTO", left, fuelHeaderY + 8, pageWidth, {
    font: "Helvetica-Bold",
    size: 8,
    align: "center",
  });

  const blockY = fuelHeaderY + 24;
  const leftBlockW = 223;
  const centerBlockW = 175;
  const rightBlockW = pageWidth - leftBlockW - centerBlockW;

  drawBox(doc, left, blockY, leftBlockW, 116, { stroke: border });
  drawBox(doc, left + leftBlockW, blockY, centerBlockW, 116, { stroke: border });
  drawBox(doc, left + leftBlockW + centerBlockW, blockY, rightBlockW, 116, { stroke: border });

  drawLine(doc, left + 76, blockY, left + 76, blockY + 116, border);
  drawLine(doc, left + 150, blockY, left + 150, blockY + 116, border);
  drawLine(doc, left + 150, blockY + 29, left + leftBlockW, blockY + 29, border);
  drawLine(doc, left + 76, blockY + 58, left + leftBlockW, blockY + 58, border);
  drawLine(doc, left + 150, blockY + 87, left + leftBlockW, blockY + 87, border);

  drawText(doc, "Preencher na data da", left + 6, blockY + 16, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "mobilizacao", left + 6, blockY + 24, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "(Antes da montagem)", left + 6, blockY + 39, 64, { font: "Helvetica-Bold", size: 5.8, align: "center" });
  drawText(doc, "Preencher ao final do dia", left + 6, blockY + 77, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "(Todos os dias)", left + 6, blockY + 92, 64, { font: "Helvetica-Bold", size: 5.8, align: "center" });

  drawText(doc, "Litros de diesel no", left + 83, blockY + 9, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "tanque", left + 83, blockY + 17, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_TANQUE_INICIAL || "N/A", left + 156, blockY + 12, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 38, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "galao", left + 83, blockY + 46, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_GALAO_INICIAL || "N/A", left + 156, blockY + 41, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 67, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "tanque", left + 83, blockY + 75, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_TANQUE_FINAL || "N/A", left + 156, blockY + 70, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 96, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "galao", left + 83, blockY + 104, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_GALAO_FINAL || "N/A", left + 156, blockY + 99, 60, { size: 7, align: "center" });

  drawBox(doc, left + leftBlockW, blockY, centerBlockW, 30, { fill: gray, stroke: border });
  drawText(doc, "PREENCHER AO FINAL DO DIA", left + leftBlockW, blockY + 10, centerBlockW, {
    font: "Helvetica-Bold",
    size: 7,
    align: "center",
  });
  drawBox(doc, left + leftBlockW, blockY + 30, centerBlockW, 28, { stroke: border });
  drawLine(doc, left + leftBlockW + 110, blockY + 30, left + leftBlockW + 110, blockY + 58, border);
  drawText(doc, "Horimetro", left + leftBlockW, blockY + 40, 110, { font: "Helvetica-Bold", size: 7, align: "center" });
  drawText(doc, process.env.DIARY_HORIMETRO || "N/A", left + leftBlockW + 110, blockY + 40, centerBlockW - 110, { size: 7, align: "center" });

  drawBox(doc, left + leftBlockW, blockY + 58, 92, 58, { stroke: border });
  drawBox(doc, left + leftBlockW + 92, blockY + 58, 83, 58, { stroke: border });
  drawText(doc, "Planejamento do dia seguinte", left + leftBlockW, blockY + 65, 175, {
    font: "Helvetica-Bold",
    size: 6.4,
    align: "center",
  });
  drawLine(doc, left + leftBlockW, blockY + 82, left + leftBlockW + 175, blockY + 82, border);
  drawText(doc, "Nº de estacas", left + leftBlockW, blockY + 87, 92, { font: "Helvetica-Bold", size: 6.3, align: "center" });
  drawText(doc, "Diametro (cm)", left + leftBlockW + 92, blockY + 87, 83, { font: "Helvetica-Bold", size: 6.3, align: "center" });
  drawText(doc, process.env.DIARY_NEXT_DAY_PILES || "N/A", left + leftBlockW, blockY + 100, 92, { size: 7, align: "center" });
  drawText(doc, process.env.DIARY_NEXT_DAY_DIAMETERS || ctx.diameters.map((value) => Math.round(value)).join(", ") || "N/A", left + leftBlockW + 92, blockY + 100, 83, { size: 7, align: "center" });

  drawText(doc, "Nº de estacas para termino da obra", left + leftBlockW + centerBlockW + 8, blockY + 30, rightBlockW - 16, {
    font: "Helvetica-Bold",
    size: 6.3,
    align: "center",
  });
  drawBox(doc, left + leftBlockW + centerBlockW + 8, blockY + 54, rightBlockW - 16, 50, { stroke: border });
  drawLine(doc, left + leftBlockW + centerBlockW + 66, blockY + 54, left + leftBlockW + centerBlockW + 66, blockY + 104, border);
  drawText(doc, "Nº de estacas", left + leftBlockW + centerBlockW + 8, blockY + 62, 58, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "Diametro (cm)", left + leftBlockW + centerBlockW + 66, blockY + 62, rightBlockW - 74, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_END_REMAINING_PILES || "N/A", left + leftBlockW + centerBlockW + 8, blockY + 81, 58, { size: 7, align: "center" });
  drawText(doc, process.env.DIARY_END_REMAINING_DIAMETERS || "N/A", left + leftBlockW + centerBlockW + 66, blockY + 81, rightBlockW - 74, { size: 7, align: "center" });

  const fuelMetaY = blockY + 128;
  drawText(doc, "Chegou diesel na obra?", left, fuelMetaY, 104, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, process.env.DIARY_CHEGOU_DIESEL || "sim", left + 88, fuelMetaY, 18, { size: 6.5, align: "center" });
  drawText(doc, "x NAO", left + 118, fuelMetaY, 34, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Fornecido por:", left, fuelMetaY + 20, 72, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, process.env.DIARY_FORNECEDOR_DIESEL || "N/A", left + 66, fuelMetaY + 20, 34, { size: 6.5, align: "center" });
  drawText(doc, "x Cliente", left + 118, fuelMetaY + 20, 42, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Quantos litros?", left, fuelMetaY + 42, 62, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Horario de chegada", left + 90, fuelMetaY + 42, 80, { font: "Helvetica-Bold", size: 6.5 });
  drawBox(doc, left, fuelMetaY + 54, 118, 24, { stroke: border });
  drawBox(doc, left + 118, fuelMetaY + 54, 98, 24, { stroke: border });
  drawText(doc, process.env.DIARY_DIESEL_QUANTOS || "N/A", left, fuelMetaY + 62, 118, { size: 6.5, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_HORARIO || "N/A", left + 118, fuelMetaY + 62, 98, { size: 6.5, align: "center" });

  drawBox(doc, left + 228, fuelMetaY + 40, 160, 24, { fill: gray, stroke: border });
  drawText(doc, "Previsao de termino da obra", left + 228, fuelMetaY + 48, 160, {
    font: "Helvetica-Bold",
    size: 6.8,
    align: "center",
  });
  drawBox(doc, left + 388, fuelMetaY + 40, 116, 24, { stroke: border });
  drawText(doc, process.env.DIARY_END_FORECAST || "____/____/____", left + 388, fuelMetaY + 48, 116, {
    size: 7,
    align: "center",
  });

  doc.addPage();
  const p2Left = 42;
  drawText(doc, process.env.DIARY_SIGNATURE_MARK || "", p2Left + 8, 62, 120, {
    size: 8,
    color: "#777777",
  });
  drawLine(doc, p2Left, 92, p2Left + 175, 92, "#505050");
  drawText(doc, process.env.DIARY_COMPANY_SIGNATURE || "Gontijo Fundacoes", p2Left, 98, 175, {
    font: "Helvetica-Bold",
    size: 7,
  });
  drawText(doc, `Nome: ${process.env.DIARY_RESPONSIBLE_NAME || "________________________"}`, p2Left, 108, 190, {
    font: "Helvetica-Bold",
    size: 7,
  });
  drawText(doc, `Documento: ${process.env.DIARY_RESPONSIBLE_DOC || "________________"}`, p2Left, 118, 190, {
    font: "Helvetica-Bold",
    size: 7,
  });

  drawLine(doc, 438, 82, 558, 82, "#505050");
  drawText(doc, "Responsavel da obra", 448, 86, 110, {
    font: "Helvetica-Bold",
    size: 7,
    align: "center",
  });

  drawBox(doc, 42, 390, 500, 18, { fill: gray, stroke: border });
  drawText(doc, "OCORRENCIAS - FOTOS EM ANEXO", 42, 395, 500, {
    font: "Helvetica-Bold",
    size: 10,
    align: "center",
    color: dark,
  });

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function formatDecimalNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(digits).replace(".", ",");
}

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1d",
  etag: true,
}));

app.post("/api/admin/session", async (req, res) => {
  const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
  const password = String(req.body?.password || "");
  const remember = Boolean(req.body?.remember);

  if (!cpf || !password) {
    return res.status(400).json({ ok: false, message: "CPF e senha sao obrigatorios." });
  }

  try {
    const [[user]] = await db.query(
      "SELECT id, name, document, password FROM users WHERE REPLACE(REPLACE(document, '.', ''), '-', '') = ? AND active = 'S'",
      [cpf]
    );

    if (!user) {
      return res.status(401).json({ ok: false, message: "CPF ou senha invalidos." });
    }

    const senhaOk = await bcrypt.compare(password, user.password);
    if (!senhaOk) {
      return res.status(401).json({ ok: false, message: "CPF ou senha invalidos." });
    }

    const isAdmin = ADMIN_GLOBAL_CPFS.includes(user.document);
    const token = crypto.randomUUID();
    adminSessions.set(token, {
      userId: user.id,
      cpf: user.document,
      isAdmin,
      createdAt: new Date().toISOString(),
      remember,
    });
    setCookie(res, "admin_session", token, {
      ...cookieOptionsForRequest(req),
      ...(remember ? { maxAge: 60 * 60 * 12 } : {}),
    });

    return res.json({
      ok: true,
      mode: adminStore.getMode(),
      user: { id: user.id, nome: user.name, isAdmin },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.post("/api/admin/logout", (_req, res) => {
  clearCookie(res, "admin_session");
  return res.json({ ok: true });
});

app.get("/api/admin/status", (req, res) => {
  const session = getAdminSession(req);
  return res.json({
    ok: true,
    authenticated: Boolean(session),
    mode: adminStore.getMode(),
    user: session
      ? { id: session.userId, isAdmin: session.isAdmin ?? false }
      : null,
  });
});

app.get("/api/admin/solides/status", requireAdmin, async (_req, res) => {
  try {
    const tokenConfigured = Boolean(getSolidesToken());
    if (!tokenConfigured) {
      return res.json({
        ok: true,
        data: {
          tokenConfigured: false,
          accountName: null,
          employeesEnabled: false,
          punchEnabled: false,
          message: "Configure SOLIDES_BASIC_TOKEN no backend para ativar a integracao.",
        },
      });
    }

    const [testPayload, employeesPayload] = await Promise.all([
      solidesRequest(SOLIDES_EMPLOYER_BASE_URL, "/test"),
      solidesRequest(SOLIDES_EMPLOYER_BASE_URL, "/employee/find-all", { page: 0, size: 1, showFired: 1 }),
    ]);

    let punchEnabled = true;
    let punchMessage = "";
    try {
      await fetchSolidesPunchesByDate(getCurrentDateString(), { page: 0, size: 1 });
    } catch (error) {
      punchEnabled = false;
      punchMessage = error.message || "Falha ao consultar o modulo de ponto.";
    }

    return res.json({
      ok: true,
      data: {
        tokenConfigured: true,
        accountName: typeof testPayload === "string" ? testPayload.replace(/^Hello,\s*/i, "").replace(/!$/, "") : null,
        employeesEnabled: true,
        punchEnabled,
        employeesCount: Number(employeesPayload?.totalElements || 0),
        message: punchEnabled
          ? "Integracao Solides validada com sucesso."
          : `Cadastros ok, mas o modulo de ponto retornou: ${punchMessage}`,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao validar integracao com a Solides.",
    });
  }
});

app.get("/api/admin/solides/daily-point-check", requireAdmin, async (req, res) => {
  try {
    const date = normalizeDateOnly(req.query.date) || getCurrentDateString();
    const sectorId = Number(req.query.sector_id || 0) || null;
    const userId = Number(req.query.user_id || 0) || null;
    const onlyActiveUsers = parseBooleanFlag(req.query.only_active_users, true);
    const requireClosingPunch = parseBooleanFlag(req.query.require_closing_punch, true);
    const showFired = parseBooleanFlag(req.query.show_fired, false);
    const statusFilter = String(req.query.status_filter || "").trim().toUpperCase();
    const entryToleranceMinutes = clampNumber(req.query.entry_tolerance_minutes, 0, 240, 15);
    const exitToleranceMinutes = clampNumber(req.query.exit_tolerance_minutes, 0, 240, 15);

    const params = {
      date,
      sectorId,
      userId,
      onlyActiveUsers,
      requireClosingPunch,
      showFired,
      statusFilter,
      entryToleranceMinutes,
      exitToleranceMinutes,
    };

    const [localUsers, solidesEmployees] = await Promise.all([
      fetchLocalUsersForPointCheck({ sectorId, userId, onlyActiveUsers }),
      fetchSolidesEmployees(showFired),
    ]);

    const employeesByCpf = new Map();
    for (const employee of Array.isArray(solidesEmployees) ? solidesEmployees : []) {
      const cpf = normalizeDigits(employee?.cpf);
      if (!cpf) continue;
      const current = employeesByCpf.get(cpf) || [];
      current.push(employee);
      employeesByCpf.set(cpf, current);
    }

    const linkedEmployeeIds = localUsers
      .map((localUser) => pickBestSolidesEmployee(employeesByCpf.get(localUser.documento)))
      .filter(Boolean)
      .map((employee) => Number(employee.id || 0))
      .filter(Boolean);

    const solidsPunches = await fetchSolidesPunchesByEmployeeIds(date, linkedEmployeeIds, {
      showFired,
      status: ["APPROVED", "PENDING", "REPROVED"].includes(statusFilter) ? statusFilter : undefined,
    });
    const punchesByEmployee = groupPunchesByEmployee(solidsPunches);

    const rows = localUsers.map((localUser) => {
      const solidesEmployee = pickBestSolidesEmployee(employeesByCpf.get(localUser.documento));
      const aggregate = buildPunchAggregate(
        punchesByEmployee.get(Number(solidesEmployee?.id || 0))
        || punchesByEmployee.get(localUser.documento)
        || []
      );
      const status = buildDailyPointStatus({
        localUser,
        solidesEmployee,
        scheduleForDate: null,
        aggregate,
        params,
      });

      return {
        usuarioId: localUser.id,
        nome: localUser.nome,
        cpf: localUser.documento,
        telefone: localUser.telefone,
        setor: localUser.setorNome || "-",
        setorId: localUser.setorId,
        ativo: localUser.ativo,
        solidesEmployeeId: solidesEmployee ? Number(solidesEmployee.id) : null,
        solidesExternalId: solidesEmployee?.externalId ? String(solidesEmployee.externalId) : "",
        escalaNome: "-",
        jornadaEsperadaInicio: "",
        jornadaEsperadaFim: "",
        primeiraMarcacao: aggregate.firstIn,
        ultimaMarcacao: aggregate.lastOut,
        totalMarcacoes: aggregate.count,
        totalBatidas: aggregate.totalPunches,
        totalFotos: aggregate.totalPhotos,
        horasTrabalhadas: workedSecondsToText(aggregate.workedSeconds),
        statusesSolides: aggregate.statuses,
        status: status.code,
        statusLabel: status.label,
        statusTone: status.tone,
        observacao: status.detail,
      };
    });

    const summary = {
      total: rows.length,
      ok: rows.filter((item) => item.status === "ok").length,
      semVinculo: rows.filter((item) => item.status === "sem_vinculo").length,
      semPonto: rows.filter((item) => item.status === "sem_ponto").length,
      atencao: rows.filter((item) => ["batidas_insuficientes", "sem_foto", "marcacoes_incompletas", "pendente_solides"].includes(item.status)).length,
      reprovado: rows.filter((item) => item.status === "reprovado_solides").length,
    };

    return res.json({
      ok: true,
      data: {
        date,
        params,
        summary,
        items: rows,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao verificar pontos diarios na Solides.",
    });
  }
});

app.get("/api/admin/whatsapp/status", requireAdmin, async (_req, res) => {
  try {
    const config = getWhatsAppConfig();
    const schema = await fetchWhatsAppSchemaStatus();
    const schedulerEnabled = String(process.env.WHATSAPP_SCHEDULER_ENABLED || "true").trim().toLowerCase() === "true";
    let instance = {
      connected: null,
      status: isWhatsAppConfigured(config) ? "unknown" : "not_configured",
      endpoint: "",
      error: "",
    };

    if (isWhatsAppConfigured(config)) {
      try {
        const connection = await getConnectionStatus();
        instance = {
          connected: connection.connected,
          status: connection.status,
          endpoint: connection.endpoint || "",
          error: "",
        };
      } catch (error) {
        instance = {
          connected: null,
          status: "unknown",
          endpoint: "",
          error: error?.message || "Falha ao consultar status da instancia.",
        };
      }
    }

    return res.json({
      ok: true,
      data: {
        enabled: config.enabled,
        configured: isWhatsAppConfigured(config),
        baseUrl: config.baseUrl,
        instanceId: config.instanceId,
        clientTokenConfigured: Boolean(config.clientToken),
        timeoutMs: config.timeoutMs,
        logsTableReady: schema.logsTable,
        responsibleColumnReady: schema.responsibleColumn,
        equipmentOperatorColumnReady: schema.equipmentOperatorColumn,
        schedulerEnabled,
        schedulerIntervalMinutes: Math.max(5, Number(process.env.WHATSAPP_SCHEDULER_INTERVAL_MINUTES || 30) || 30),
        schedulerRunning: whatsappSchedulerState.running,
        schedulerLastRunAt: whatsappSchedulerState.lastRunAt,
        schedulerLastError: whatsappSchedulerState.lastError,
        instance,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao carregar status do WhatsApp.",
    });
  }
});

app.get("/api/admin/whatsapp/qr-code", requireAdmin, async (_req, res) => {
  try {
    const config = getWhatsAppConfig();
    if (!isWhatsAppConfigured(config)) {
      return res.status(400).json({ ok: false, message: "Z-API ainda nao configurada no .env." });
    }

    const qrCode = await getQrCodeImage();
    return res.json({
      ok: true,
      data: {
        image: qrCode.image,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "Falha ao carregar QR Code da Z-API.",
    });
  }
});

app.get("/api/admin/whatsapp/logs", requireAdmin, async (req, res) => {
  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.logsTable) {
      return res.status(503).json({
        ok: false,
        message: "A tabela whatsapp_notification_logs ainda não existe no banco.",
      });
    }

    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 20) || 20));
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (req.query.event_type) {
      where.push("l.event_type = ?");
      params.push(String(req.query.event_type));
    }
    if (req.query.status) {
      where.push("l.status = ?");
      params.push(String(req.query.status));
    }
    if (req.query.date_from) {
      where.push("DATE(l.created_at) >= ?");
      params.push(normalizeDateOnly(req.query.date_from));
    }
    if (req.query.date_to) {
      where.push("DATE(l.created_at) <= ?");
      params.push(normalizeDateOnly(req.query.date_to));
    }
    if (req.query.obra) {
      where.push("(c.construction_number LIKE ? OR l.target_name LIKE ?)");
      params.push(`%${String(req.query.obra).trim()}%`, `%${String(req.query.obra).trim()}%`);
    }
    if (req.query.operator) {
      where.push("(l.target_name LIKE ? OR u.name LIKE ?)");
      params.push(`%${String(req.query.operator).trim()}%`, `%${String(req.query.operator).trim()}%`);
    }
    if (req.query.reference_date) {
      where.push("l.reference_date = ?");
      params.push(normalizeDateOnly(req.query.reference_date));
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM whatsapp_notification_logs l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN constructions c ON c.id = l.construction_id
       ${whereSql}`,
      params
    );

    const diarySummaryWhere = [...where, "l.event_type = 'diary_overdue_reminder'"];
    const diarySummaryWhereSql = `WHERE ${diarySummaryWhere.join(" AND ")}`;
    const diarySummaryParams = [...params];
    const [[summaryRow]] = await db.query(
      `SELECT COUNT(*) AS total_delays,
              SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) AS sent_delays,
              SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) AS failed_delays,
              SUM(CASE WHEN l.status = 'skipped' THEN 1 ELSE 0 END) AS skipped_delays,
              COUNT(DISTINCT COALESCE(l.user_id, l.target_name)) AS operators_count,
              COUNT(DISTINCT l.construction_id) AS constructions_count
       FROM whatsapp_notification_logs l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN constructions c ON c.id = l.construction_id
       LEFT JOIN cursos cu ON cu.id = l.course_id
       ${diarySummaryWhereSql}`,
      diarySummaryParams
    );

    const [operatorSummaryRows] = await db.query(
      `SELECT COALESCE(NULLIF(l.target_name, ''), u.name, 'Sem operador') AS operator_name,
              COUNT(*) AS total_delays,
              SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) AS sent_delays,
              MAX(l.created_at) AS last_delay_at
       FROM whatsapp_notification_logs l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN constructions c ON c.id = l.construction_id
       LEFT JOIN cursos cu ON cu.id = l.course_id
       ${diarySummaryWhereSql}
       GROUP BY operator_name
       ORDER BY total_delays DESC, operator_name ASC
       LIMIT 8`,
      diarySummaryParams
    );

    const [rows] = await db.query(
      `SELECT l.*,
              u.name AS user_name,
              c.construction_number,
              cu.titulo AS course_title
       FROM whatsapp_notification_logs l
       LEFT JOIN users u ON u.id = l.user_id
       LEFT JOIN constructions c ON c.id = l.construction_id
       LEFT JOIN cursos cu ON cu.id = l.course_id
       ${whereSql}
       ORDER BY l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return res.json({
      ok: true,
      data: rows.map((row) => {
        const metadata = parseJsonSafe(row.metadata_json, {});
        return {
          id: Number(row.id),
          eventType: String(row.event_type || ""),
          eventLabel: eventTypeLabel(String(row.event_type || "")),
          historyText: buildWhatsAppHistoryText(row, metadata),
          status: String(row.status || ""),
          userId: row.user_id == null ? null : Number(row.user_id),
          userName: String(row.user_name || ""),
          phone: String(row.phone || ""),
          constructionId: row.construction_id == null ? null : Number(row.construction_id),
          obraNumero: String(row.construction_number || ""),
          courseId: row.course_id == null ? null : Number(row.course_id),
          courseTitle: String(row.course_title || ""),
          referenceDate: normalizeDateOnly(row.reference_date),
          targetName: String(row.target_name || ""),
          messageText: String(row.message_text || ""),
          providerMessageId: String(row.provider_message_id || ""),
          errorText: String(row.error_text || ""),
          createdAt: row.created_at,
          metadata,
        };
      }),
      total: Number(total || 0),
      page,
      limit,
      summary: {
        diaryDelays: {
          total: Number(summaryRow?.total_delays || 0),
          sent: Number(summaryRow?.sent_delays || 0),
          failed: Number(summaryRow?.failed_delays || 0),
          skipped: Number(summaryRow?.skipped_delays || 0),
          operators: Number(summaryRow?.operators_count || 0),
          constructions: Number(summaryRow?.constructions_count || 0),
          topOperators: operatorSummaryRows.map((row) => ({
            name: String(row.operator_name || "Sem operador"),
            total: Number(row.total_delays || 0),
            sent: Number(row.sent_delays || 0),
            lastDelayAt: row.last_delay_at,
          })),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao carregar logs do WhatsApp.",
    });
  }
});

app.get("/api/admin/operational-indicators", requireAdmin, async (req, res) => {
  try {
    const dateFrom = normalizeDateOnly(req.query.date_from);
    const dateTo = normalizeDateOnly(req.query.date_to);
    const operatorSearch = String(req.query.operator || "").trim();
    const obraSearch = String(req.query.obra || "").trim();

    const [hasWhatsappLogs, hasSignatureLinks] = await Promise.all([
      tableExists("whatsapp_notification_logs"),
      tableExists("diary_signature_links"),
    ]);

    const delayWhere = ["l.event_type = 'diary_overdue_reminder'"];
    const delayParams = [];
    if (dateFrom) {
      delayWhere.push("DATE(l.created_at) >= ?");
      delayParams.push(dateFrom);
    }
    if (dateTo) {
      delayWhere.push("DATE(l.created_at) <= ?");
      delayParams.push(dateTo);
    }
    if (operatorSearch) {
      delayWhere.push("(l.target_name LIKE ? OR u.name LIKE ?)");
      delayParams.push(`%${operatorSearch}%`, `%${operatorSearch}%`);
    }
    if (obraSearch) {
      delayWhere.push("(c.construction_number LIKE ? OR l.target_name LIKE ?)");
      delayParams.push(`%${obraSearch}%`, `%${obraSearch}%`);
    }
    const delayWhereSql = `WHERE ${delayWhere.join(" AND ")}`;

    let delaySummary = {
      totalLogs: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      operators: 0,
      constructions: 0,
    };
    let delayOperators = [];
    let delayRows = [];

    if (hasWhatsappLogs) {
      const [[summaryRow]] = await db.query(
        `SELECT COUNT(*) AS total_logs,
                SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
                SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                SUM(CASE WHEN l.status = 'skipped' THEN 1 ELSE 0 END) AS skipped_count,
                COUNT(DISTINCT CASE WHEN l.status = 'sent' THEN COALESCE(l.user_id, l.target_name) END) AS operators_count,
                COUNT(DISTINCT CASE WHEN l.status = 'sent' THEN l.construction_id END) AS constructions_count
         FROM whatsapp_notification_logs l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN constructions c ON c.id = l.construction_id
         ${delayWhereSql}`,
        delayParams
      );

      delaySummary = {
        totalLogs: Number(summaryRow?.total_logs || 0),
        sent: Number(summaryRow?.sent_count || 0),
        failed: Number(summaryRow?.failed_count || 0),
        skipped: Number(summaryRow?.skipped_count || 0),
        operators: Number(summaryRow?.operators_count || 0),
        constructions: Number(summaryRow?.constructions_count || 0),
      };

      const [operatorRows] = await db.query(
        `SELECT COALESCE(NULLIF(l.target_name, ''), u.name, 'Sem operador') AS operator_name,
                MAX(l.phone) AS phone,
                COUNT(*) AS total_notifications,
                SUM(CASE WHEN l.status = 'sent' THEN 1 ELSE 0 END) AS sent_notifications,
                SUM(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) AS failed_notifications,
                COUNT(DISTINCT l.construction_id) AS constructions_count,
                MAX(l.created_at) AS last_notification_at
         FROM whatsapp_notification_logs l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN constructions c ON c.id = l.construction_id
         ${delayWhereSql}
         GROUP BY operator_name
         ORDER BY sent_notifications DESC, total_notifications DESC, operator_name ASC
         LIMIT 12`,
        delayParams
      );

      delayOperators = operatorRows.map((row) => ({
        operatorName: String(row.operator_name || "Sem operador"),
        phone: String(row.phone || ""),
        totalNotifications: Number(row.total_notifications || 0),
        sentNotifications: Number(row.sent_notifications || 0),
        failedNotifications: Number(row.failed_notifications || 0),
        constructions: Number(row.constructions_count || 0),
        lastNotificationAt: row.last_notification_at,
      }));

      const [recentDelayRows] = await db.query(
        `SELECT l.id,
                l.status,
                l.phone,
                l.reference_date,
                l.target_name,
                l.created_at,
                l.error_text,
                u.name AS user_name,
                c.construction_number
         FROM whatsapp_notification_logs l
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN constructions c ON c.id = l.construction_id
         ${delayWhereSql}
         ORDER BY l.created_at DESC, l.id DESC
         LIMIT 30`,
        delayParams
      );

      delayRows = recentDelayRows.map((row) => ({
        id: Number(row.id),
        status: String(row.status || ""),
        operatorName: String(row.target_name || row.user_name || "Sem operador"),
        phone: String(row.phone || ""),
        obraNumero: String(row.construction_number || ""),
        referenceDate: normalizeDateOnly(row.reference_date),
        createdAt: row.created_at,
        errorText: String(row.error_text || ""),
      }));
    }

    const signatureWhere = ["1 = 1"];
    const signatureParams = [];
    if (dateFrom) {
      signatureWhere.push("DATE(COALESCE(l.sent_at, l.created_at)) >= ?");
      signatureParams.push(dateFrom);
    }
    if (dateTo) {
      signatureWhere.push("DATE(COALESCE(l.sent_at, l.created_at)) <= ?");
      signatureParams.push(dateTo);
    }
    if (operatorSearch) {
      signatureWhere.push("u.name LIKE ?");
      signatureParams.push(`%${operatorSearch}%`);
    }
    if (obraSearch) {
      signatureWhere.push("(c.construction_number LIKE ? OR JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number')) LIKE ?)");
      signatureParams.push(`%${obraSearch}%`, `%${obraSearch}%`);
    }
    const signatureWhereSql = `WHERE ${signatureWhere.join(" AND ")}`;

    let signatureSummary = {
      total: 0,
      signed: 0,
      active: 0,
      expired: 0,
      revoked: 0,
      rate: 0,
      averageMinutesToSign: null,
    };
    let signatureRows = [];

    if (hasSignatureLinks) {
      const [[signatureSummaryRow]] = await db.query(
        `SELECT COUNT(*) AS total_links,
                SUM(CASE WHEN l.status = 'signed' THEN 1 ELSE 0 END) AS signed_links,
                SUM(CASE WHEN l.status = 'active' THEN 1 ELSE 0 END) AS active_links,
                SUM(CASE WHEN l.status = 'expired' THEN 1 ELSE 0 END) AS expired_links,
                SUM(CASE WHEN l.status = 'revoked' THEN 1 ELSE 0 END) AS revoked_links,
                AVG(CASE WHEN l.status = 'signed' AND l.signed_at IS NOT NULL
                  THEN TIMESTAMPDIFF(MINUTE, COALESCE(l.sent_at, l.created_at), l.signed_at)
                  ELSE NULL
                END) AS avg_minutes_to_sign
         FROM diary_signature_links l
         INNER JOIN diaries d ON d.id = l.diary_id
         LEFT JOIN users u ON u.id = d.user_id
         LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
         ${signatureWhereSql}`,
        signatureParams
      );

      const total = Number(signatureSummaryRow?.total_links || 0);
      const signed = Number(signatureSummaryRow?.signed_links || 0);
      signatureSummary = {
        total,
        signed,
        active: Number(signatureSummaryRow?.active_links || 0),
        expired: Number(signatureSummaryRow?.expired_links || 0),
        revoked: Number(signatureSummaryRow?.revoked_links || 0),
        rate: total > 0 ? Number(((signed / total) * 100).toFixed(1)) : 0,
        averageMinutesToSign:
          signatureSummaryRow?.avg_minutes_to_sign == null
            ? null
            : Math.round(Number(signatureSummaryRow.avg_minutes_to_sign || 0)),
      };

      const [recentSignatureRows] = await db.query(
        `SELECT l.id,
                l.diary_id,
                l.status,
                l.sent_at,
                l.signed_at,
                l.expires_at,
                l.client_name,
                u.name AS operator_name,
                COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
                COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
                COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
                COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario
         FROM diary_signature_links l
         INNER JOIN diaries d ON d.id = l.diary_id
         LEFT JOIN users u ON u.id = d.user_id
         LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
         LEFT JOIN clients cl ON cl.id = c.client_id
         LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
         ${signatureWhereSql}
         ORDER BY COALESCE(l.sent_at, l.created_at) DESC, l.id DESC
         LIMIT 30`,
        signatureParams
      );

      signatureRows = recentSignatureRows.map((row) => ({
        id: Number(row.id),
        diaryId: Number(row.diary_id),
        status: String(row.status || ""),
        sentAt: row.sent_at,
        signedAt: row.signed_at,
        expiresAt: row.expires_at,
        clientName: String(row.client_name || row.cliente || ""),
        operatorName: String(row.operator_name || ""),
        obraNumero: String(row.obra_numero || ""),
        equipamento: String(row.equipamento || ""),
        dataDiario: normalizeDateOnly(row.data_diario),
      }));
    }

    return res.json({
      ok: true,
      data: {
        filters: {
          dateFrom: dateFrom || "",
          dateTo: dateTo || "",
          operator: operatorSearch,
          obra: obraSearch,
        },
        delays: {
          tableAvailable: hasWhatsappLogs,
          summary: delaySummary,
          operators: delayOperators,
          recent: delayRows,
        },
        signatures: {
          tableAvailable: hasSignatureLinks,
          summary: signatureSummary,
          recent: signatureRows,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao carregar indicadores operacionais.",
    });
  }
});

app.get("/api/admin/whatsapp/diary-overdue-preview", requireAdmin, async (_req, res) => {
  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.equipmentOperatorColumn) {
      return res.status(503).json({ ok: false, message: "A coluna equipments.operator_user_id ainda nao existe no banco. Aplique a migration sql/2026-04-13-add-equipment-operator.sql." });
    }

    const result = await fetchDiaryReminderCandidates();
    return res.json({
      ok: true,
      data: {
        ...result,
        total: result.items.length,
        sendable: result.items.filter((item) => item.canSend).length,
        logsTableReady: schema.logsTable,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao montar preview de diarios atrasados.",
    });
  }
});

app.post("/api/admin/whatsapp/diary-overdue-reminders", requireAdmin, async (req, res) => {
  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.logsTable) {
      return res.status(503).json({ ok: false, message: "A tabela whatsapp_notification_logs ainda nao existe no banco." });
    }
    if (!schema.equipmentOperatorColumn) {
      return res.status(503).json({ ok: false, message: "A coluna equipments.operator_user_id ainda nao existe no banco. Aplique a migration sql/2026-04-13-add-equipment-operator.sql." });
    }

    const keys = [...new Set((Array.isArray(req.body?.keys) ? req.body.keys : []).map((item) => String(item || "").trim()).filter(Boolean))];
    const messageText = textOrNull(req.body?.message_text);
    if (!keys.length) {
      return res.status(400).json({ ok: false, message: "Selecione ao menos um diario atrasado para enviar." });
    }

    const preview = await fetchDiaryReminderCandidates();
    const itemsByKey = new Map(preview.items.map((item) => [item.key, item]));
    const results = [];

    for (const key of keys) {
      const item = itemsByKey.get(key);
      if (!item) {
        results.push({ key, ok: false, skipped: true, reason: "not_found" });
        continue;
      }

      const message = renderDiaryReminderMessage(messageText, item);
      const result = await sendLoggedWhatsAppMessage({
        eventType: "diary_overdue_reminder",
        userId: item.responsibleOperatorUserId,
        phone: item.operatorPhone,
        constructionId: item.constructionId,
        referenceDate: item.referenceDate,
        dedupeKey: `diary_overdue:${item.constructionId}:${item.equipmentId}:${item.referenceDate}:${item.responsibleOperatorUserId || 0}`,
        targetName: item.operatorName,
        messageText: message,
        metadata: {
          obraNumero: item.constructionNumber,
          equipmentId: item.equipmentId,
          equipmentName: item.equipmentName,
          dueAt: item.dueAt,
          delayedDiary: true,
          source: "manual_diary_overdue_preview",
        },
        skipDispatchReason: item.reason || "",
        skipDispatchMessage:
          item.reason === "missing_equipment_operator"
            ? "O equipamento nao possui operador vinculado."
            : item.reason === "missing_phone"
              ? "O operador da maquina nao possui telefone valido."
              : "",
      });

      results.push({
        key,
        obraNumero: item.constructionNumber,
        equipamento: item.equipmentName,
        operador: item.operatorName,
        telefone: item.operatorPhone,
        referenceDate: item.referenceDate,
        ...result,
      });
    }

    return res.json({
      ok: true,
      data: {
        total: results.length,
        sent: results.filter((item) => item.ok && !item.skipped).length,
        skipped: results.filter((item) => item.skipped).length,
        failed: results.filter((item) => item.ok === false && !item.skipped).length,
        items: results,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao enviar lembretes de diario atrasado.",
    });
  }
});

app.post("/api/admin/whatsapp/point-reminders", requireAdmin, async (req, res) => {
  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.logsTable) {
      return res.status(503).json({ ok: false, message: "A tabela whatsapp_notification_logs ainda não existe no banco." });
    }

    const referenceDate = normalizeDateOnly(req.body?.date) || shiftDateWithTz(getCurrentDateString(), -1);
    const userIds = [...new Set((Array.isArray(req.body?.user_ids) ? req.body.user_ids : []).map((item) => Number(item || 0)).filter(Boolean))];
    const messageText = textOrNull(req.body?.message_text);
    if (!userIds.length) {
      return res.status(400).json({ ok: false, message: "Selecione ao menos um colaborador para enviar o lembrete." });
    }

    const localUsers = await fetchLocalUsersForPointCheck({ onlyActiveUsers: false });
    const usersById = new Map(localUsers.map((item) => [item.id, item]));
    const results = [];

    for (const userId of userIds) {
      const user = usersById.get(userId);
      if (!user) {
        results.push({ userId, ok: false, skipped: true, reason: "user_not_found" });
        continue;
      }

      const result = await sendLoggedWhatsAppMessage({
        eventType: "point_missing_reminder",
        userId: user.id,
        phone: user.telefone,
        referenceDate,
        targetName: user.nome,
        messageText: renderPointReminderMessage(messageText, { userName: user.nome, referenceDate }),
        metadata: {
          source: "manual_point_check",
          cpf: user.documento,
        },
      });

      results.push({
        userId: user.id,
        nome: user.nome,
        telefone: user.telefone,
        ...result,
      });
    }

    return res.json({
      ok: true,
      data: {
        referenceDate,
        total: results.length,
        sent: results.filter((item) => item.ok && !item.skipped).length,
        skipped: results.filter((item) => item.skipped).length,
        failed: results.filter((item) => item.ok === false && !item.skipped).length,
        items: results,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao enviar lembretes de ponto.",
    });
  }
});

app.post("/api/admin/whatsapp/courses/:courseId/notify", requireAdmin, async (req, res) => {
  try {
    const schema = await fetchWhatsAppSchemaStatus();
    if (!schema.logsTable) {
      return res.status(503).json({ ok: false, message: "A tabela whatsapp_notification_logs ainda não existe no banco." });
    }

    const courseId = Number(req.params.courseId || 0);
    const assignmentIds = [...new Set((Array.isArray(req.body?.assignment_ids) ? req.body.assignment_ids : []).map((item) => Number(item || 0)).filter(Boolean))];
    const messageText = textOrNull(req.body?.message_text);
    if (!courseId) {
      return res.status(400).json({ ok: false, message: "Curso inválido para envio do aviso." });
    }

    const [[course]] = await db.query("SELECT id, titulo FROM cursos WHERE id = ?", [courseId]);
    if (!course) {
      return res.status(404).json({ ok: false, message: "Curso não encontrado." });
    }

    const assignmentWhere = assignmentIds.length ? "AND a.id IN (?)" : "";
    const assignmentParams = assignmentIds.length ? [courseId, assignmentIds] : [courseId];
    const [assignments] = await db.query(
      `SELECT a.id, a.tipo, a.setor_id, a.usuario_id
       FROM cursos_atribuicoes a
       WHERE a.curso_id = ?
       ${assignmentWhere}`,
      assignmentParams
    );

    if (!assignments.length) {
      return res.status(400).json({ ok: false, message: "Nenhuma atribuição encontrada para notificar." });
    }

    const directUserIds = assignments.map((item) => Number(item.usuario_id || 0)).filter(Boolean);
    const sectorIds = [...new Set(assignments.map((item) => Number(item.setor_id || 0)).filter(Boolean))];
    const [sectorUsers] = sectorIds.length
      ? await db.query(
          `SELECT id, name, phone
           FROM users
           WHERE active = 'S'
             AND sector_id IN (?)`,
          [sectorIds]
        )
      : [[]];

    const [directUsers] = directUserIds.length
      ? await db.query(
          `SELECT id, name, phone
           FROM users
           WHERE active = 'S'
             AND id IN (?)`,
          [directUserIds]
        )
      : [[]];

    const usersById = new Map();
    [...directUsers, ...sectorUsers].forEach((row) => {
      const userId = Number(row.id || 0);
      if (!userId) return;
      usersById.set(userId, {
        id: userId,
        name: String(row.name || ""),
        phone: String(row.phone || ""),
      });
    });

    const results = [];
    for (const user of usersById.values()) {
      const result = await sendLoggedWhatsAppMessage({
        eventType: "course_available_notice",
        userId: user.id,
        phone: user.phone,
        courseId,
        targetName: user.name,
        messageText: renderCourseNoticeMessage(messageText, { userName: user.name, courseTitle: course.titulo }),
        metadata: {
          source: "manual_course_notice",
          courseTitle: String(course.titulo || ""),
          selectedAssignmentIds: assignmentIds,
        },
      });

      results.push({
        userId: user.id,
        nome: user.name,
        telefone: user.phone,
        ...result,
      });
    }

    return res.json({
      ok: true,
      data: {
        courseId,
        courseTitle: String(course.titulo || ""),
        total: results.length,
        sent: results.filter((item) => item.ok && !item.skipped).length,
        skipped: results.filter((item) => item.skipped).length,
        failed: results.filter((item) => item.ok === false && !item.skipped).length,
        items: results,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || "Falha ao enviar aviso de curso disponível.",
    });
  }
});

app.get("/api/admin/client-portals", requireAdmin, async (_req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.id,
              a.construction_id,
              a.login,
              a.active,
              a.last_login_at,
              a.created_at,
              a.updated_at,
              c.construction_number,
              c.type AS construction_type,
              c.state,
              cl.name AS client_name,
              ci.name AS city_name
       FROM client_portal_accesses a
       INNER JOIN constructions c ON c.id = a.construction_id AND c.status = '1'
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN cities ci ON ci.id = c.city_id
       ORDER BY c.construction_number ASC, a.id DESC`
    );

    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar acessos do portal do cliente.",
      details: error.message,
    });
  }
});

app.post("/api/admin/client-portals", requireAdmin, async (req, res) => {
  const constructionId = parsePositiveInteger(req.body?.construction_id);
  const login = normalizePortalLogin(req.body?.login);
  const password = String(req.body?.password || "");
  const active = req.body?.active === false ? "N" : "Y";

  if (!constructionId) {
    return res.status(400).json({ ok: false, message: "Selecione uma obra ativa." });
  }
  if (!login) {
    return res.status(400).json({ ok: false, message: "Informe o login do cliente." });
  }
  if (!password.trim()) {
    return res.status(400).json({ ok: false, message: "Informe uma senha para o acesso do cliente." });
  }

  try {
    const construction = await fetchActiveConstructionById(constructionId);
    if (!construction) {
      return res.status(400).json({ ok: false, message: "A obra selecionada nao esta ativa ou nao foi encontrada." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO client_portal_accesses
       (construction_id, login, password_hash, active, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, NOW(), NOW())`,
      [constructionId, login, passwordHash, active]
    );

    const access = await fetchClientPortalAccessById(result.insertId);
    return res.status(201).json({ ok: true, data: access });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        message: "Ja existe um acesso para essa obra ou o login informado ja esta em uso.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Erro ao criar acesso do portal do cliente.",
      details: error.message,
    });
  }
});

app.put("/api/admin/client-portals/:id", requireAdmin, async (req, res) => {
  const accessId = parsePositiveInteger(req.params.id);
  const login = normalizePortalLogin(req.body?.login);
  const password = String(req.body?.password || "");
  const active = req.body?.active === false ? "N" : "Y";

  if (!accessId) {
    return res.status(400).json({ ok: false, message: "Acesso invalido." });
  }
  if (!login) {
    return res.status(400).json({ ok: false, message: "Informe o login do cliente." });
  }

  try {
    const current = await fetchClientPortalAccessById(accessId);
    if (!current || String(current.construction_status) !== "1") {
      return res.status(404).json({ ok: false, message: "Acesso nao encontrado para obra ativa." });
    }

    if (password.trim()) {
      const passwordHash = await bcrypt.hash(password, 10);
      await db.query(
        `UPDATE client_portal_accesses
         SET login = ?, password_hash = ?, active = ?, updated_at = NOW()
         WHERE id = ?`,
        [login, passwordHash, active, accessId]
      );
    } else {
      await db.query(
        `UPDATE client_portal_accesses
         SET login = ?, active = ?, updated_at = NOW()
         WHERE id = ?`,
        [login, active, accessId]
      );
    }

    const access = await fetchClientPortalAccessById(accessId);
    return res.json({ ok: true, data: access });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        ok: false,
        message: "Ja existe um acesso para essa obra ou o login informado ja esta em uso.",
      });
    }

    return res.status(500).json({
      ok: false,
      message: "Erro ao atualizar acesso do portal do cliente.",
      details: error.message,
    });
  }
});

app.delete("/api/admin/client-portals/:id", requireAdmin, async (req, res) => {
  const accessId = parsePositiveInteger(req.params.id);
  if (!accessId) {
    return res.status(400).json({ ok: false, message: "Acesso invalido." });
  }
  try {
    const current = await fetchClientPortalAccessById(accessId);
    if (!current) {
      return res.status(404).json({ ok: false, message: "Acesso nao encontrado." });
    }
    await db.query(`DELETE FROM client_portal_accesses WHERE id = ?`, [accessId]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao excluir acesso do portal do cliente.",
      details: error.message,
    });
  }
});

// ── Portal documentos (admin) ─────────────────────────────────────────────────

app.post("/api/admin/client-portals/:id/documentos", requireAdmin, portalDocsUpload.single("arquivo"), async (req, res) => {
  const accessId = parsePositiveInteger(req.params.id)
  if (!accessId) return res.status(400).json({ ok: false, message: "Acesso invalido." })
  try {
    await ensurePortalDocumentsTable()
    const access = await fetchClientPortalAccessById(accessId)
    if (!access) {
      if (req.file) { try { fs.unlinkSync(req.file.path) } catch { /* Ignore cleanup failure after invalid access. */ } }
      return res.status(404).json({ ok: false, message: "Acesso nao encontrado." })
    }
    if (!req.file) return res.status(400).json({ ok: false, message: "Nenhum arquivo enviado." })
    const allowedTypes = new Set(["pre_obra", "visita_primeiro_dia", "visita_tecnica", "projeto", "sondagem", "medicao", "outro"])
    const requestedType = String(req.body?.tipo || "outro")
    const tipo = allowedTypes.has(requestedType) ? requestedType : "outro"
    if (tipo === "medicao") {
      const pdfHeader = fs.readFileSync(req.file.path).subarray(0, 5).toString("ascii")
      if (pdfHeader !== "%PDF-") {
        try { fs.unlinkSync(req.file.path) } catch { /* Ignore cleanup failure after invalid upload. */ }
        return res.status(400).json({ ok: false, message: "A medicao deve ser enviada em arquivo PDF." })
      }
    }
    await db.query(
      `INSERT INTO portal_documents (construction_id, tipo, nome_original, nome_arquivo, tamanho, mime_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [access.construction_id, tipo, Buffer.from(req.file.originalname, 'latin1').toString('utf8'), req.file.filename, req.file.size, req.file.mimetype]
    )
    return res.json({ ok: true })
  } catch (error) {
    if (req.file) { try { fs.unlinkSync(req.file.path) } catch {} }
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.get("/api/admin/client-portals/:id/documentos", requireAdmin, async (req, res) => {
  const accessId = parsePositiveInteger(req.params.id)
  if (!accessId) return res.status(400).json({ ok: false, message: "Acesso invalido." })
  try {
    await ensurePortalDocumentsTable()
    const access = await fetchClientPortalAccessById(accessId)
    if (!access) return res.status(404).json({ ok: false, message: "Acesso nao encontrado." })
    const [docs] = await db.query(
      `SELECT id, tipo, nome_original, nome_arquivo, tamanho, mime_type, criado_em
       FROM portal_documents WHERE construction_id = ? ORDER BY tipo, criado_em DESC`,
      [access.construction_id]
    )
    return res.json({ ok: true, data: docs })
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.delete("/api/admin/portal-documentos/:docId", requireAdmin, async (req, res) => {
  const docId = parsePositiveInteger(req.params.docId)
  if (!docId) return res.status(400).json({ ok: false, message: "Documento invalido." })
  try {
    await ensurePortalDocumentsTable()
    const [[doc]] = await db.query("SELECT nome_arquivo FROM portal_documents WHERE id = ?", [docId])
    if (!doc) return res.status(404).json({ ok: false, message: "Documento nao encontrado." })
    await db.query("DELETE FROM portal_documents WHERE id = ?", [docId])
    try { fs.unlinkSync(path.join(__dirname, "uploads", "portal-docs", doc.nome_arquivo)) } catch {}
    return res.json({ ok: true })
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

// ── Sondagens (CRM Pipefy) ────────────────────────────────────────────────────
// Busca metadados em crm_sondagens (banco leve: so caminho + dados do card).
// Arquivos moram no disco do VPS em uploads/sondagens/<card_id>/.

app.get("/api/admin/sondagens", requireAdmin, async (req, res) => {
  const q = String(req.query.q || "").trim()
  const limit = Math.min(parsePositiveInteger(req.query.limit) || 200, 500)
  try {
    let rows
    if (q) {
      const like = `%${q}%`
      ;[rows] = await db.query(
        `SELECT id, card_id, card_title, cliente, contato, endereco_obra, cidade, estado,
                servico, fase, nome_original, nome_arquivo, tamanho, mime_type, criado_em
         FROM crm_sondagens
         WHERE cliente LIKE ? OR endereco_obra LIKE ? OR cidade LIKE ?
            OR card_title LIKE ? OR negociacao LIKE ? OR contato LIKE ?
         ORDER BY card_id DESC, nome_arquivo ASC
         LIMIT ?`,
        [like, like, like, like, like, like, limit * 8]
      )
    } else {
      ;[rows] = await db.query(
        `SELECT id, card_id, card_title, cliente, contato, endereco_obra, cidade, estado,
                servico, fase, nome_original, nome_arquivo, tamanho, mime_type, criado_em
         FROM crm_sondagens
         ORDER BY card_id DESC, nome_arquivo ASC
         LIMIT ?`,
        [limit * 8]
      )
    }
    // agrupa arquivos por card
    const cardsMap = new Map()
    for (const r of rows) {
      let card = cardsMap.get(r.card_id)
      if (!card) {
        card = {
          card_id: r.card_id, card_title: r.card_title, cliente: r.cliente,
          contato: r.contato, endereco_obra: r.endereco_obra, cidade: r.cidade,
          estado: r.estado, servico: r.servico, fase: r.fase, arquivos: [],
        }
        cardsMap.set(r.card_id, card)
      }
      card.arquivos.push({
        id: r.id, nome_original: r.nome_original, tamanho: r.tamanho,
        mime_type: r.mime_type, criado_em: r.criado_em,
      })
    }
    const cards = Array.from(cardsMap.values()).slice(0, limit)
    return res.json({ ok: true, data: cards, total: cards.length })
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.get("/api/admin/sondagens/mapa", requireAdmin, async (_req, res) => {
  const { corDaFase } = require("./lib/sondagem-fases")
  try {
    const [rows] = await db.query(
      `SELECT card_id, card_title, cliente, endereco_obra, cidade, estado, fase,
              MAX(lat) AS lat, MAX(lng) AS lng, COUNT(*) AS arquivos
       FROM crm_sondagens
       WHERE lat IS NOT NULL AND lng IS NOT NULL
       GROUP BY card_id, card_title, cliente, endereco_obra, cidade, estado, fase`
    )
    const pontos = rows.map((r) => ({
      card_id: r.card_id,
      cliente: r.cliente || r.card_title,
      endereco_obra: r.endereco_obra,
      cidade: r.cidade,
      estado: r.estado,
      fase: r.fase,
      cor: corDaFase(r.fase),
      arquivos: Number(r.arquivos),
      lat: Number(r.lat),
      lng: Number(r.lng),
    }))
    return res.json({ ok: true, data: pontos, total: pontos.length })
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.get("/api/admin/sondagens/:id/download", requireAdmin, async (req, res) => {
  const id = parsePositiveInteger(req.params.id)
  if (!id) return res.status(400).json({ ok: false, message: "Arquivo invalido." })
  try {
    const [[row]] = await db.query(
      "SELECT caminho, nome_original FROM crm_sondagens WHERE id = ?",
      [id]
    )
    if (!row) return res.status(404).json({ ok: false, message: "Registro nao encontrado." })
    // guard path traversal: so dentro de uploads/sondagens
    const baseDir = path.join(__dirname, "uploads", "sondagens")
    const filePath = path.resolve(__dirname, row.caminho)
    if (!filePath.startsWith(baseDir)) return res.status(400).json({ ok: false, message: "Caminho invalido." })
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, message: "Arquivo nao encontrado no servidor." })
    return res.download(filePath, row.nome_original || path.basename(filePath))
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

// ── Portal documentos (cliente) ───────────────────────────────────────────────

app.get("/api/client-portal/documentos", requireClientPortal, async (req, res) => {
  const session = req.clientPortalSession
  try {
    await ensurePortalDocumentsTable()
    const [docs] = await db.query(
      `SELECT id, tipo, nome_original, tamanho, mime_type, criado_em
       FROM portal_documents WHERE construction_id = ? ORDER BY tipo, criado_em DESC`,
      [session.constructionId]
    )
    return res.json({ ok: true, data: docs })
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.get("/api/client-portal/documentos/:docId/download", requireClientPortal, async (req, res) => {
  const session = req.clientPortalSession
  const docId = parsePositiveInteger(req.params.docId)
  if (!docId) return res.status(400).json({ ok: false, message: "Documento invalido." })
  try {
    await ensurePortalDocumentsTable()
    const [[doc]] = await db.query(
      "SELECT nome_original, nome_arquivo FROM portal_documents WHERE id = ? AND construction_id = ?",
      [docId, session.constructionId]
    )
    if (!doc) return res.status(404).json({ ok: false, message: "Documento nao encontrado." })
    const filePath = path.join(__dirname, "uploads", "portal-docs", doc.nome_arquivo)
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, message: "Arquivo nao encontrado no servidor." })
    return res.download(filePath, doc.nome_original)
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message })
  }
})

app.post("/api/client-portal/session", async (req, res) => {
  const login = normalizePortalLogin(req.body?.login);
  const password = String(req.body?.password || "");

  if (!login || !password) {
    return res.status(400).json({ ok: false, message: "Login e senha sao obrigatorios." });
  }

  try {
    const access = await fetchClientPortalAccessByLogin(login);
    if (!access || String(access.active || "N") !== "Y" || String(access.construction_status || "") !== "1") {
      return res.status(401).json({ ok: false, message: "Acesso do cliente invalido ou inativo." });
    }

    const passwordOk = await bcrypt.compare(password, String(access.password_hash || ""));
    if (!passwordOk) {
      return res.status(401).json({ ok: false, message: "Acesso do cliente invalido ou inativo." });
    }

    const token = crypto.randomUUID();
    clientPortalSessions.set(token, {
      accessId: Number(access.id),
      constructionId: Number(access.construction_id),
      login: access.login,
      createdAt: new Date().toISOString(),
    });
    setCookie(res, "client_portal_session", token, {
      ...cookieOptionsForRequest(req),
      maxAge: 60 * 60 * 12,
    });

    await db.query(
      "UPDATE client_portal_accesses SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?",
      [access.id]
    );

    return res.json({
      ok: true,
      user: {
        accessId: Number(access.id),
        login: access.login,
        obraNumero: firstFilledText(access.construction_number),
        cliente: firstFilledText(access.client_name),
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao autenticar portal do cliente.",
      details: error.message,
    });
  }
});

app.post("/api/client-portal/logout", (req, res) => {
  const session = getClientPortalSession(req);
  if (session) clientPortalSessions.delete(session.token);
  clearCookie(res, "client_portal_session");
  return res.json({ ok: true });
});

app.get("/api/client-portal/status", async (req, res) => {
  const session = getClientPortalSession(req);
  if (!session) {
    return res.json({ ok: true, authenticated: false });
  }

  try {
    const access = await fetchClientPortalAccessById(session.accessId);
    if (!access || String(access.active || "N") !== "Y" || String(access.construction_status || "") !== "1") {
      clientPortalSessions.delete(session.token);
      clearCookie(res, "client_portal_session");
      return res.json({ ok: true, authenticated: false });
    }

    return res.json({
      ok: true,
      authenticated: true,
      user: {
        accessId: Number(access.id),
        login: firstFilledText(access.login),
        obraNumero: firstFilledText(access.construction_number),
        cliente: firstFilledText(access.client_name),
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao validar sessao do portal do cliente.",
      details: error.message,
    });
  }
});

app.get("/api/client-portal/dashboard", requireClientPortal, async (req, res) => {
  try {
    const dataInicio = textOrNull(req.query.data_inicio) || null
    const dataFim = textOrNull(req.query.data_fim) || null
    const payload = await fetchClientPortalDashboard(req.clientPortalSession.constructionId, { dataInicio, dataFim }, buildDiarySignatureBaseUrl(req));
    if (!payload) {
      clientPortalSessions.delete(req.clientPortalSession.token);
      clearCookie(res, "client_portal_session");
      return res.status(404).json({ ok: false, message: "Obra ativa nao encontrada para este acesso." });
    }

    return res.json({ ok: true, data: payload });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao carregar portal do cliente.",
      details: error.message,
    });
  }
});

app.get("/api/client-portal/diarios/:id/pdf", requireClientPortal, async (req, res) => {
  const diaryId = parsePositiveInteger(req.params.id);
  if (!diaryId) {
    return res.status(400).json({ ok: false, message: "Diario invalido." });
  }

  try {
    const dashboard = await fetchClientPortalDashboard(req.clientPortalSession.constructionId);
    const allowed = dashboard?.diarios?.some((item) => Number(item.id) === diaryId);
    if (!allowed) {
      return res.status(404).json({ ok: false, message: "Diario nao encontrado para esta obra." });
    }

    const expiresAt = Date.now() + 60 * 1000;
    const secret = process.env.GONTIJO_PDF_ACCESS_SECRET || process.env.SESSION_SECRET || "gontijo-pdf-access-dev";
    const signature = crypto.createHmac("sha256", secret).update(`${diaryId}:${expiresAt}`).digest("hex");
    return res.redirect(302, `/api/gontijo/diarios/${diaryId}/pdf?portalPdfExpires=${expiresAt}&portalPdfSignature=${signature}`);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Erro ao abrir PDF do diario.",
      details: error.message,
    });
  }
});

app.post("/api/client-portal/diarios/:id/solicitar-assinatura", requireClientPortal, async (req, res) => {
  const diaryId = parsePositiveInteger(req.params.id);
  if (!diaryId) return res.status(400).json({ ok: false, message: "Diario invalido." });

  try {
    const dashboard = await fetchClientPortalDashboard(req.clientPortalSession.constructionId);
    const diario = dashboard?.diarios?.find((item) => Number(item.id) === diaryId);
    if (!diario) return res.status(404).json({ ok: false, message: "Diario nao encontrado para esta obra." });
    if (diario.status === 'assinado') return res.status(400).json({ ok: false, message: "Diario ja assinado." });
    if (diario.status === 'rascunho') return res.status(400).json({ ok: false, message: "Diario ainda em rascunho." });

    if (!(await tableExists("diary_signature_links"))) {
      return res.status(503).json({ ok: false, message: "Funcionalidade de assinatura nao disponivel." });
    }

    await db.query(
      "UPDATE diary_signature_links SET status = 'revoked', updated_at = NOW() WHERE diary_id = ? AND status = 'active'",
      [diaryId]
    );

    const token = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const expiresAtSql = formatSqlDateTime(addHours(now, 72));
    const sentAtSql = formatSqlDateTime(now);
    const publicUrl = `${buildDiarySignatureBaseUrl(req)}/assinatura/diario/${token}`;

    await db.query(
      `INSERT INTO diary_signature_links (diary_id, token, status, expires_at, sent_at, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, NOW(), NOW())`,
      [diaryId, token, expiresAtSql, sentAtSql]
    );

    return res.json({ ok: true, data: { signingUrl: publicUrl } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro ao gerar link de assinatura.", details: error.message });
  }
});

function getOperadorSession(req) {
  const token = parseCookies(req).operador_session;
  if (token) {
    const session = operadorSessions.get(token);
    if (session) return { token, ...session };
  }
  const adminSession = getAdminSession(req);
  if (adminSession?.isAdmin) {
    return { token: null, userId: adminSession.userId, cpf: adminSession.cpf, isAdminSession: true };
  }
  return null;
}

app.get("/api/gontijo/operador/cursos/:id/certificado", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session?.userId) {
    return res.status(401).json({ ok: false, error: "Não autorizado" });
  }

  try {
    const [[curso]] = await db.query(
      "SELECT id, titulo FROM cursos WHERE id = ? AND ativo = 1",
      [req.params.id]
    );
    if (!curso) {
      return res.status(404).json({ ok: false, error: "Curso não encontrado" });
    }

    const [[usuario]] = await db.query(
      "SELECT name AS nome FROM users WHERE id = ?",
      [session.userId]
    );
    if (!usuario) {
      return res.status(404).json({ ok: false, error: "Usuário não encontrado" });
    }

    const [[prova]] = await db.query(
      "SELECT id FROM provas WHERE curso_id = ? AND ativo = 1 LIMIT 1",
      [req.params.id]
    );

    let autorizado = false;
    if (prova) {
      const [[tent]] = await db.query(
        "SELECT MAX(aprovado) AS aprovado FROM prova_tentativas WHERE prova_id = ? AND usuario_id = ?",
        [prova.id, session.userId]
      );
      autorizado = Number(tent?.aprovado) === 1;
    }

    if (!autorizado) {
      const [[completion]] = await db.query(
        `SELECT id
         FROM training_points_ledger
         WHERE user_id = ?
           AND curso_id = ?
           AND event_type = 'curso_concluido'
         LIMIT 1`,
        [session.userId, req.params.id]
      );
      autorizado = Boolean(completion);
    }

    if (!autorizado) {
      return res.status(403).json({
        ok: false,
        error: "Certificado disponível apenas após conclusão do curso",
      });
    }

    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      const buf = Buffer.concat(chunks);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="certificado-curso-${curso.id}.pdf"`);
      res.send(buf);
    });

    const W = 841.89;
    const H = 595.28;
    const RED = "#c0392b";
    const DARK_RED = "#7b1d1d";
    const nome = String(usuario.nome || "").toUpperCase();

    doc.rect(0, 0, W, H).fill("#ffffff");
    doc.rect(0, 0, 6, H).fill(RED);
    doc.rect(0, 0, W, 88).fill(RED);

    doc.save();
    doc.polygon([0, 88], [100, 88], [0, 150]).fill(DARK_RED);
    doc.restore();

    doc.save();
    doc.polygon([W, 88], [W - 100, 88], [W, 150]).fill(DARK_RED);
    doc.restore();

    doc.rect(0, H - 54, W, 54).fill(RED);

    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13)
      .text("GONTIJO FUNDAÇÕES", 30, 22, { width: 300 });
    doc.fillColor("#fbe4e2").font("Helvetica").fontSize(9)
      .text("Engenharia de Fundações e Estacas", 30, 40, { width: 300 });
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18)
      .text("CERTIFICADO DE CONCLUSÃO", 0, 30, { align: "right", width: W - 32 });

    const cy = 125;
    doc.fillColor("#64748b").font("Helvetica").fontSize(12)
      .text("Certificamos que", 0, cy, { align: "center", width: W });
    doc.fillColor(RED).font("Helvetica-Bold").fontSize(30)
      .text(nome, 60, cy + 26, { align: "center", width: W - 120 });

    doc.moveTo(W / 2 - 160, cy + 70).lineTo(W / 2 + 160, cy + 70)
      .lineWidth(1).strokeColor("#e2e8f0").stroke();

    doc.fillColor("#334155").font("Helvetica").fontSize(13)
      .text("concluiu com êxito o curso", 0, cy + 84, { align: "center", width: W });
    doc.fillColor("#1e293b").font("Helvetica-Bold").fontSize(20)
      .text(curso.titulo, 80, cy + 108, { align: "center", width: W - 160 });

    doc.moveTo(W / 2 - 80, cy + 160).lineTo(W / 2 + 80, cy + 160)
      .lineWidth(1.5).strokeColor(RED).stroke();

    const dataEmissao = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    doc.fillColor("#64748b").font("Helvetica").fontSize(10)
      .text(`Emitido em ${dataEmissao}`, 0, cy + 170, { align: "center", width: W });

    doc.fillColor("#ffffff").font("Helvetica").fontSize(9)
      .text("Gontijo Fundações - Sistema de Treinamento Corporativo", 0, H - 36, {
        align: "center",
        width: W,
      });

    doc.end();
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

function normalizePredefinedOccurrence(row) {
  return {
    id: Number(row.id),
    title: String(row.title || ""),
    category: String(row.category || ""),
    templateText: String(row.template_text || row.title || ""),
    active: String(row.active || "S") === "S",
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at ? String(row.created_at) : "",
    updatedAt: row.updated_at ? String(row.updated_at) : "",
  };
}

function validatePredefinedOccurrencePayload(input, partial = false) {
  const title = String(input?.title || "").trim();
  const templateText = String(input?.templateText || input?.template_text || title).trim();
  const category = String(input?.category || "").trim();
  const sortOrder = Number(input?.sortOrder ?? input?.sort_order ?? 0);
  const active = input?.active === undefined ? true : parseBooleanFlag(input.active, true);

  if (!partial || title || templateText) {
    if (!title) throw new Error("Informe o titulo da pre-ocorrencia.");
    if (!templateText) throw new Error("Informe o texto padrao da pre-ocorrencia.");
  }

  return {
    title,
    category,
    templateText,
    active,
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
  };
}

const COMMON_TEXT_CORRECTIONS = new Map([
  ["faso", "fa\u00e7o"],
  ["fasso", "fa\u00e7o"],
  ["faco", "fa\u00e7o"],
  ["irma", "irm\u00e3"],
  ["maquina", "m\u00e1quina"],
  ["nao", "n\u00e3o"],
  ["nois", "n\u00f3s"],
  ["oleo", "\u00f3leo"],
  ["caminhao", "caminh\u00e3o"],
  ["possivel", "poss\u00edvel"],
  ["quebro", "quebrou"],
]);

function preserveReplacementCase(original, replacement) {
  const source = String(original || "");
  const target = String(replacement || "");
  if (!source || !target) return target;
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return `${target[0].toUpperCase()}${target.slice(1)}`;
  return target;
}

function pickLanguageToolReplacement(text, match) {
  const offset = Number(match?.offset);
  const length = Number(match?.length);
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length <= 0) return "";

  const original = String(text || "").slice(offset, offset + length);
  const knownCorrection = COMMON_TEXT_CORRECTIONS.get(original.toLowerCase());
  if (knownCorrection) return preserveReplacementCase(original, knownCorrection);

  const replacements = Array.isArray(match?.replacements)
    ? match.replacements.map((item) => String(item?.value || "")).filter(Boolean)
    : [];
  if (!replacements.length) return "";

  const originalLower = original.toLowerCase();
  return replacements.find((replacement) => replacement.toLowerCase() !== originalLower) || replacements[0];
}

function applyLanguageToolReplacements(text, matches) {
  let corrected = String(text || "");
  const ordered = [...matches].sort((a, b) => Number(b.offset || 0) - Number(a.offset || 0));
  for (const match of ordered) {
    const replacement = pickLanguageToolReplacement(text, match);
    const offset = Number(match?.offset);
    const length = Number(match?.length);
    if (!replacement || !Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length <= 0) continue;
    corrected = `${corrected.slice(0, offset)}${replacement}${corrected.slice(offset + length)}`;
  }
  return corrected;
}

function applyCommonTextCorrections(text) {
  return String(text || "")
    .replace(/\bda\s+quela\b/gi, (value) => preserveReplacementCase(value, "daquela"))
    .replace(/\bpq\b/gi, "porque")
    .replace(/\bpra\b/gi, "para")
    .replace(/\b[\p{L}]+\b/gu, (word) => {
      const correction = COMMON_TEXT_CORRECTIONS.get(word.toLowerCase());
      return correction ? preserveReplacementCase(word, correction) : word;
    });
}

function cleanAiCorrectionOutput(value) {
  let text = String(value || "").trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  text = text.replace(/^```(?:text)?/i, "").replace(/```$/i, "").trim();
  text = text.replace(/^(texto\s+corrigido|correcao|corre[cç][aã]o)\s*:\s*/i, "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function buildAiCorrectionPrompt(text) {
  return [
    "Voce e um corretor de portugues para diarios de obra.",
    "Tarefa: corrigir o texto do operador sem reescrever livremente.",
    "",
    "Regras obrigatorias:",
    "- Corrija somente ortografia, acentuacao, pontuacao e concordancia.",
    "- Nao troque palavras corretas por sinonimos.",
    "- Nao adicione conectivos como entao, pois, portanto, devido a.",
    "- Nao mude tempo verbal.",
    "- Nao mude termos tecnicos de obra, como maquina, estaca, bloco, bomba, concreto, caminhao.",
    "- Nao adicione informacoes.",
    "- Preserve o maximo possivel as palavras originais.",
    "- Responda somente com o texto corrigido, sem explicacao.",
    "",
    "Exemplos:",
    "Texto: o ajudante não veio hoje e nós ficou parado",
    "Correcao: O ajudante não veio hoje e nós ficamos parados.",
    "Texto: foi feito limpeza no local e retirado os entulho",
    "Correcao: Foi feita limpeza no local e retirados os entulhos.",
    "Texto: maquina parou pq choveu muito",
    "Correcao: Máquina parou porque choveu muito.",
    "Texto: Hoje executamos 12 estacas no bloco A.",
    "Correcao: Hoje executamos 12 estacas no bloco A.",
    "",
    `Texto: ${text}`,
    "Correcao:",
  ].join("\n");
}

async function correctTextWithOllama(text) {
  const enabled = String(process.env.OLLAMA_TEXT_CORRECTION_ENABLED || "true").toLowerCase() !== "false";
  if (!enabled) return null;

  const endpoint = process.env.OLLAMA_API_URL || "http://127.0.0.1:11434/api/generate";
  const model = process.env.OLLAMA_TEXT_CORRECTION_MODEL || "qwen2.5:1.5b";
  const timeoutMs = Number(process.env.OLLAMA_TEXT_CORRECTION_TIMEOUT_MS || 5000);
  const preparedText = applyCommonTextCorrections(text);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 5000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: buildAiCorrectionPrompt(preparedText),
        stream: false,
        keep_alive: process.env.OLLAMA_TEXT_CORRECTION_KEEP_ALIVE || "10m",
        options: {
          temperature: 0,
          num_predict: Number(process.env.OLLAMA_TEXT_CORRECTION_NUM_PREDICT || 180),
          repeat_penalty: 1.05,
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Ollama indisponivel.");

    const correctedText = cleanAiCorrectionOutput(payload?.response);
    if (!correctedText) return null;
    if (correctedText.length > Math.max(text.length * 3, text.length + 180)) return null;

    return {
      textoOriginal: text,
      textoCorrigido: correctedText,
      alterado: correctedText !== text,
      provider: "ollama",
      sugestoes: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function correctTextWithLanguageTool(text) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.LANGUAGETOOL_TIMEOUT_MS || 8000);
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 8000);

  try {
    const endpoint = process.env.LANGUAGETOOL_API_URL || "https://api.languagetool.org/v2/check";
    const body = new URLSearchParams({
      text,
      language: "pt-BR",
      enabledOnly: "false",
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || "LanguageTool indisponivel.");

    const matches = Array.isArray(payload.matches) ? payload.matches : [];
    const suggestions = matches.map((match) => ({
      offset: Number(match.offset || 0),
      length: Number(match.length || 0),
      trecho: text.slice(Number(match.offset || 0), Number(match.offset || 0) + Number(match.length || 0)),
      message: String(match.message || ""),
      ruleId: String(match.rule?.id || ""),
      replacements: Array.isArray(match.replacements)
        ? match.replacements.slice(0, 5).map((item) => String(item.value || "")).filter(Boolean)
        : [],
    }));
    const correctedText = applyLanguageToolReplacements(text, matches);

    return {
      textoOriginal: text,
      textoCorrigido: correctedText,
      alterado: correctedText !== text,
      provider: "languagetool",
      sugestoes: suggestions,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildTextCorrectionFallback(text) {
  return {
    textoOriginal: text,
    textoCorrigido: text,
    alterado: false,
    provider: "none",
    sugestoes: [],
  };
}

function hasGontijoAppAccess(req) {
  return Boolean(getOperadorSession(req)?.userId || getAdminSession(req)?.cpf);
}

app.get("/api/admin/predefined-occurrences", requireAdmin, async (_req, res) => {
  try {
    await ensurePredefinedOccurrencesTable();
    const [rows] = await db.query(
      `SELECT id, title, category, template_text, active, sort_order, created_at, updated_at
       FROM predefined_occurrences
       ORDER BY sort_order ASC, title ASC`
    );
    return res.json({ ok: true, data: rows.map(normalizePredefinedOccurrence) });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.post("/api/admin/predefined-occurrences", requireAdmin, async (req, res) => {
  try {
    await ensurePredefinedOccurrencesTable();
    const payload = validatePredefinedOccurrencePayload(req.body);
    const [result] = await db.query(
      `INSERT INTO predefined_occurrences (title, category, template_text, active, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [payload.title, textOrNull(payload.category), payload.templateText, payload.active ? "S" : "N", payload.sortOrder]
    );
    const [[row]] = await db.query(
      `SELECT id, title, category, template_text, active, sort_order, created_at, updated_at
       FROM predefined_occurrences
       WHERE id = ?`,
      [result.insertId]
    );
    return res.status(201).json({ ok: true, data: normalizePredefinedOccurrence(row) });
  } catch (error) {
    const status = /Informe/.test(error.message) ? 400 : 500;
    return res.status(status).json({ ok: false, message: error.message });
  }
});

app.put("/api/admin/predefined-occurrences/:id", requireAdmin, async (req, res) => {
  try {
    await ensurePredefinedOccurrencesTable();
    const id = parsePositiveInteger(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID invalido." });
    const payload = validatePredefinedOccurrencePayload(req.body);
    await db.query(
      `UPDATE predefined_occurrences
       SET title = ?, category = ?, template_text = ?, active = ?, sort_order = ?
       WHERE id = ?`,
      [payload.title, textOrNull(payload.category), payload.templateText, payload.active ? "S" : "N", payload.sortOrder, id]
    );
    const [[row]] = await db.query(
      `SELECT id, title, category, template_text, active, sort_order, created_at, updated_at
       FROM predefined_occurrences
       WHERE id = ?`,
      [id]
    );
    if (!row) return res.status(404).json({ ok: false, message: "Pre-ocorrencia nao encontrada." });
    return res.json({ ok: true, data: normalizePredefinedOccurrence(row) });
  } catch (error) {
    const status = /Informe|invalido/.test(error.message) ? 400 : 500;
    return res.status(status).json({ ok: false, message: error.message });
  }
});

app.delete("/api/admin/predefined-occurrences/:id", requireAdmin, async (req, res) => {
  try {
    await ensurePredefinedOccurrencesTable();
    const id = parsePositiveInteger(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID invalido." });
    await db.query("DELETE FROM predefined_occurrences WHERE id = ?", [id]);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.get("/api/gontijo/predefined-occurrences", async (_req, res) => {
  try {
    if (!hasGontijoAppAccess(_req)) {
      return res.status(401).json({ ok: false, message: "Sessao obrigatoria." });
    }
    await ensurePredefinedOccurrencesTable();
    const [rows] = await db.query(
      `SELECT id, title, category, template_text, active, sort_order, created_at, updated_at
       FROM predefined_occurrences
       WHERE active = 'S'
       ORDER BY sort_order ASC, title ASC`
    );
    return res.json({ ok: true, data: rows.map(normalizePredefinedOccurrence) });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.post("/api/gontijo/texto/corrigir", async (req, res) => {
  if (!hasGontijoAppAccess(req)) {
    return res.status(401).json({ ok: false, message: "Sessao obrigatoria." });
  }

  const text = String(req.body?.text || req.body?.texto || "").trim();
  if (!text) return res.status(400).json({ ok: false, message: "Informe o texto para corrigir." });
  if (text.length > 3000) return res.status(400).json({ ok: false, message: "Texto limitado a 3000 caracteres." });

  const errors = [];

  try {
    const aiResult = await correctTextWithOllama(text);
    if (aiResult) return res.json({ ok: true, data: aiResult });
  } catch (error) {
    errors.push(`ollama: ${error?.message || "erro desconhecido"}`);
  }

  try {
    const languageToolResult = await correctTextWithLanguageTool(text);
    return res.json({ ok: true, data: languageToolResult });
  } catch (error) {
    errors.push(`languagetool: ${error?.message || "erro desconhecido"}`);
  }

  return res.json({
    ok: true,
    data: {
      ...buildTextCorrectionFallback(text),
      warnings: errors,
    },
  });
});

app.use("/api/gontijo", (req, _res, next) => {
  const operadorSession = getOperadorSession(req);
  const adminSession = getAdminSession(req);

  req.session = req.session || {};

  if (operadorSession?.userId) {
    req.session.operador = {
      ...((req.session.operador) || {}),
      id: operadorSession.userId,
      cpf: operadorSession.cpf,
      isAdmin: operadorSession.isAdminSession === true,
    };
  }

  if (adminSession?.cpf) {
    req.session.adminCpf = adminSession.cpf;
    req.session.adminUserId = adminSession.userId;
    req.session.adminIsAdmin = adminSession.isAdmin ?? false;
  }

  next();
});

app.use('/api/gontijo', gontijoRoutes);

function normalizePortalLogin(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parsePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function safeParseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...parsed } : {};
  } catch {
    return {};
  }
}

function firstFilledText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
}

function formatSqlDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addHours(date, hours) {
  const next = new Date(date);
  next.setTime(next.getTime() + hours * 60 * 60 * 1000);
  return next;
}

function countDiaryStakeRows(data) {
  const source = data && typeof data === "object" ? data : {};
  const hc = Array.isArray(source.stakes) ? source.stakes.length : 0;
  const be = Array.isArray(source.stakesBE) ? source.stakesBE.length : 0;
  return hc + be;
}

function sumConstructionPlanning(endConstruction) {
  if (!Array.isArray(endConstruction)) return 0;

  return endConstruction.reduce((total, item) => {
    if (!item || typeof item !== "object") return total;
    const rawValue =
      item.numeroEstacas ??
      item.numero_estacas ??
      item.qtdEstacas ??
      item.piles ??
      0;
    const numeric = Number(String(rawValue).replace(",", "."));
    return total + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
}

function parsePortalNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const normalized = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizePortalDiameterKey(value) {
  const text = firstFilledText(value);
  if (!text) return "sem_perfil";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPortalDiameterLabel(value) {
  const text = firstFilledText(value);
  return text || "Sem perfil informado";
}

function formatConstructionTypeForPortal(value) {
  const text = firstFilledText(value);
  return text.toLowerCase() === "f" ? "Fundação" : text;
}

function extractStakeDiameter(row) {
  if (!row || typeof row !== "object") return "";
  return firstFilledText(
    row.diameter,
    row.diametro,
    row.section,
    row.secao,
    row.secao_id,
    row.perfil,
    row.tipo
  );
}

function listDiaryStakeObjects(data) {
  const source = data && typeof data === "object" ? data : {};
  const regular = Array.isArray(source.stakes) ? source.stakes : [];
  const driven = Array.isArray(source.stakesBE) ? source.stakesBE : [];
  return [...regular, ...driven].filter((item) => item && typeof item === "object");
}

function buildExecutedByDiameter(diarios) {
  const map = new Map();

  for (const diario of diarios) {
    for (const stake of listDiaryStakeObjects(diario.rawData)) {
      const label = formatPortalDiameterLabel(extractStakeDiameter(stake));
      const key = normalizePortalDiameterKey(label);
      const current = map.get(key) || { label, executadas: 0 };
      current.executadas += 1;
      map.set(key, current);
    }
  }

  return map;
}

function mapPlanningRowsFromDiary(endConstruction) {
  if (!Array.isArray(endConstruction)) return [];
  return endConstruction
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const diametro = firstFilledText(item.diametro, item.diameter, item.perfil, item.tipo);
      const qtd = parsePortalNumber(item.numeroEstacas ?? item.numero_estacas ?? item.qtdEstacas ?? item.piles);
      if (!diametro && !qtd) return null;
      return {
        diametro: formatPortalDiameterLabel(diametro),
        profundidade: 0,
        qtdEstacas: qtd,
        preco: 0,
        subtotal: 0,
      };
    })
    .filter(Boolean);
}

async function fetchPortalProductionRows(constructionId, fallbackRows) {
  if (await tableExists("obra_producao")) {
    const [rows] = await db.query(
      `SELECT diametro, profundidade, qtd_estacas, preco, subtotal
       FROM obra_producao
       WHERE obra_id = ?
       ORDER BY id ASC`,
      [constructionId]
    );

    if (rows.length) {
      return rows.map((row) => ({
        diametro: formatPortalDiameterLabel(row.diametro),
        profundidade: parsePortalNumber(row.profundidade),
        qtdEstacas: parsePortalNumber(row.qtd_estacas),
        preco: parsePortalNumber(row.preco),
        subtotal: parsePortalNumber(row.subtotal),
      }));
    }
  }

  return fallbackRows;
}

function buildProgressByDiameter(productionRows, executedByDiameter) {
  const rows = [];
  const seen = new Set();

  for (const row of Array.isArray(productionRows) ? productionRows : []) {
    const label = formatPortalDiameterLabel(row.diametro);
    const key = normalizePortalDiameterKey(label);
    const executed = executedByDiameter.get(key)?.executadas || 0;
    const planned = parsePortalNumber(row.qtdEstacas);
    seen.add(key);
    rows.push({
      diametro: label,
      profundidade: parsePortalNumber(row.profundidade),
      previstas: planned,
      executadas: executed,
      restantes: Math.max(planned - executed, 0),
      percentual: planned > 0 ? Math.min(Math.round((executed / planned) * 100), 100) : 0,
      subtotal: parsePortalNumber(row.subtotal),
    });
  }

  for (const [key, row] of executedByDiameter.entries()) {
    if (seen.has(key)) continue;
    rows.push({
      diametro: row.label,
      profundidade: 0,
      previstas: 0,
      executadas: row.executadas,
      restantes: 0,
      percentual: 0,
      subtotal: 0,
    });
  }

  return rows;
}

function extractPortalOccurrences(data) {
  const source = data && typeof data === "object" ? data : {};
  const raw = Array.isArray(source.occurrences)
    ? source.occurrences
    : Array.isArray(source.ocorrencias)
      ? source.ocorrencias
      : [];

  return raw
    .map((item) => {
      if (typeof item === "string") return { descricao: item, inicio: "", fim: "" };
      if (!item || typeof item !== "object") return null;
      return {
        descricao: firstFilledText(item.desc, item.descricao, item.description, item.label, item.text),
        inicio: firstFilledText(item.hora_ini, item.horaInicial, item.inicio, item.start),
        fim: firstFilledText(item.hora_fim, item.horaFinal, item.fim, item.end),
      };
    })
    .filter((item) => item && (item.descricao || item.inicio || item.fim));
}

function extractPortalWeatherLabel(data) {
  const source = data && typeof data === "object" ? data : {};
  const clima = source.clima && typeof source.clima === "object" ? source.clima : {};
  const tempo = source.tempo && typeof source.tempo === "object" ? source.tempo : {};
  return firstFilledText(
    clima.label,
    clima.name,
    clima.item,
    clima.id,
    tempo.label,
    tempo.name,
    tempo.item,
    tempo.id
  );
}

function collectPortalPhotoCandidates(value, context, output) {
  if (!value || output.length >= 18) return;

  if (typeof value === "string") {
    const text = value.trim();
    const looksLikeImage =
      /^data:image\//i.test(text) ||
      /^https?:\/\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(text) ||
      /^\/.+\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(text);
    if (looksLikeImage) {
      output.push({
        url: text,
        titulo: context.titulo || "Foto da obra",
        dataDiario: context.dataDiario || "",
        dataFoto: context.dataFoto || context.dataDiario || "",
        diarioId: context.diarioId || 0,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectPortalPhotoCandidates(item, context, output);
    return;
  }

  if (typeof value === "object") {
    const direct = firstFilledText(
      value.url,
      value.src,
      value.href,
      value.photo,
      value.foto,
      value.image,
      value.imagem,
      value.fileUrl,
      value.publicUrl,
      value.previewUrl
    );

    if (direct) {
      collectPortalPhotoCandidates(direct, {
        ...context,
        titulo: firstFilledText(value.title, value.titulo, value.name, value.nome, value.label, context.titulo),
        dataFoto: firstFilledText(
          value.dataFoto,
          value.data_foto,
          value.photoDate,
          value.photo_date,
          value.date,
          value.data,
          value.createdAt,
          value.created_at,
          value.criadoEm,
          value.criado_em,
          context.dataFoto,
          context.dataDiario
        ),
      }, output);
    }
  }
}

function extractPortalPhotos(data, diaryMeta) {
  const source = data && typeof data === "object" ? data : {};
  const keys = [
    "fotos",
    "photos",
    "imagens",
    "images",
    "attachments",
    "anexos",
    "arquivos",
    "evidencias",
    "galeria",
    "gallery",
  ];
  const output = [];

  for (const key of keys) {
    collectPortalPhotoCandidates(source[key], {
      titulo: "Foto do diario",
      dataDiario: diaryMeta.dataDiario,
      diarioId: diaryMeta.id,
    }, output);
  }

  return output;
}

async function fetchActiveConstructionById(constructionId) {
  const [rows] = await db.query(
    `SELECT c.id,
            c.client_id,
            c.construction_number,
            c.type,
            c.state,
            c.street,
            c.number,
            c.neighborhood,
            c.complement,
            c.status,
            cl.name AS client_name,
            ci.name AS city_name
     FROM constructions c
     LEFT JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN cities ci ON ci.id = c.city_id
     WHERE c.id = ? AND c.status = '1'
     LIMIT 1`,
    [constructionId]
  );

  return rows[0] || null;
}

async function fetchClientPortalAccessById(accessId) {
  const [rows] = await db.query(
    `SELECT a.id,
            a.construction_id,
            a.login,
            a.active,
            a.last_login_at,
            a.created_at,
            a.updated_at,
            c.construction_number,
            c.type AS construction_type,
            c.state,
            c.status AS construction_status,
            cl.name AS client_name,
            ci.name AS city_name
     FROM client_portal_accesses a
     INNER JOIN constructions c ON c.id = a.construction_id
     LEFT JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN cities ci ON ci.id = c.city_id
     WHERE a.id = ?
     LIMIT 1`,
    [accessId]
  );

  return rows[0] || null;
}

async function fetchClientPortalAccessByLogin(login) {
  const [rows] = await db.query(
    `SELECT a.id,
            a.construction_id,
            a.login,
            a.password_hash,
            a.active,
            c.construction_number,
            c.status AS construction_status,
            cl.name AS client_name
     FROM client_portal_accesses a
     INNER JOIN constructions c ON c.id = a.construction_id
     LEFT JOIN clients cl ON cl.id = c.client_id
     WHERE a.login = ?
     LIMIT 1`,
    [login]
  );

  return rows[0] || null;
}

async function fetchClientPortalDashboard(constructionId, filters = {}, baseUrl = '') {
  const construction = await fetchActiveConstructionById(constructionId);
  if (!construction) return null;
  let constructionPhotos = [];

  if (await columnExists("constructions", "construction_photos")) {
    const [[photoRow]] = await db.query(
      "SELECT construction_photos FROM constructions WHERE id = ? LIMIT 1",
      [constructionId]
    );
    const parsedPhotos = parseJsonSafe(photoRow?.construction_photos, []);
    collectPortalPhotoCandidates(parsedPhotos, {
      titulo: "Foto da obra",
      dataDiario: "",
      diarioId: 0,
    }, constructionPhotos);
  }

  const { dataInicio, dataFim } = filters
  const hasValorFaturado = await columnExists('diaries', 'valor_faturado')
  const dateExpr = "COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d'))"

  let dateWhere = ''
  const dateParams = []
  if (dataInicio) { dateWhere += ` AND ${dateExpr} >= ?`; dateParams.push(dataInicio) }
  if (dataFim)    { dateWhere += ` AND ${dateExpr} <= ?`; dateParams.push(dataFim) }

  const [rows] = await db.query(
    `SELECT d.id,
            d.created_at,
            d.data,
            u.name AS operator_name,
            COALESCE(
              e.name,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')),
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))
            ) AS equipment_name,
            COALESCE(
              NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''),
              DATE_FORMAT(d.created_at, '%Y-%m-%d')
            ) AS data_diario
            ${hasValorFaturado ? ', d.valor_faturado' : ''}
     FROM diaries d
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN equipments e
       ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
     WHERE (
       CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED) = ?
       OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number')), '') = ?
     )
     AND d.conferencia_status = 'aprovado'
     ${dateWhere}
     ORDER BY data_diario DESC, d.id DESC`,
    [constructionId, String(construction.construction_number || ""), ...dateParams]
  );

  let assinaturasPendentes = [];
  if (await tableExists("diary_signature_links")) {
    const [pendingRows] = await db.query(
      `SELECT d.id,
              ${dateExpr} AS data_diario,
              COALESCE(
                e.name,
                JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')),
                JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))
              ) AS equipment_name,
              l.expires_at,
              l.token
       FROM diaries d
       INNER JOIN diary_signature_links l
         ON l.id = (
           SELECT MAX(latest.id)
           FROM diary_signature_links latest
           WHERE latest.diary_id = d.id
         )
       LEFT JOIN equipments e
         ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       WHERE (
         CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED) = ?
         OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number')), '') = ?
       )
       AND l.status = 'active'
       AND l.expires_at > NOW()
       ${dateWhere}
       ORDER BY data_diario DESC, d.id DESC`,
      [constructionId, String(construction.construction_number || ""), ...dateParams]
    );
    assinaturasPendentes = pendingRows.map((row) => ({
      id: Number(row.id),
      dataDiario: firstFilledText(row.data_diario),
      equipamento: firstFilledText(row.equipment_name),
      expiresAt: row.expires_at ? String(row.expires_at) : "",
      signingUrl: row.token ? `${baseUrl}/assinatura/diario/${row.token}` : '',
    }));
  }

  let estacasExecutadas = 0;
  let estacasPlanejadas = 0;
  let valorProducaoTotal = 0;
  let latestPlanningCursor = "";
  let latestPlanningRows = [];
  const allPhotos = [...constructionPhotos];

  const diarios = rows.map((row) => {
    const data = safeParseJsonObject(row.data);
    const estacasNoDia = countDiaryStakeRows(data);
    const occurrences = extractPortalOccurrences(data);
    const weather = extractPortalWeatherLabel(data);
    const diaryDate = firstFilledText(row.data_diario);
    estacasExecutadas += estacasNoDia;
    if (row.valor_faturado != null) valorProducaoTotal += Number(row.valor_faturado);

    const planned = sumConstructionPlanning(data.endConstruction);
    const planningCursor = `${diaryDate}|${String(row.id).padStart(12, "0")}`;
    if (planned > 0 && planningCursor >= latestPlanningCursor) {
      latestPlanningCursor = planningCursor;
      estacasPlanejadas = planned;
      latestPlanningRows = mapPlanningRowsFromDiary(data.endConstruction);
    }

    const photos = extractPortalPhotos(data, {
      id: Number(row.id),
      dataDiario: diaryDate,
    });
    allPhotos.push(...photos);

    return {
      id: Number(row.id),
      dataDiario: diaryDate,
      status: firstFilledText(data.status, "rascunho"),
      assinadoEm: firstFilledText(data.assinado_em),
      equipamento: firstFilledText(row.equipment_name),
      operadorNome: firstFilledText(row.operator_name),
      estacasNoDia,
      ocorrencias: occurrences,
      clima: weather,
      fotos: photos,
      reviewConfirmed: data.review_confirmed === true || data.revisao_confirmed === true,
      pdfUrl: `/api/client-portal/diarios/${row.id}/pdf`,
      rawData: data,
    };
  });

  const productionRows = await fetchPortalProductionRows(construction.id, latestPlanningRows);
  const totalPlanejadoPorProducao = productionRows.reduce((sum, row) => sum + parsePortalNumber(row.qtdEstacas), 0);
  if (totalPlanejadoPorProducao > 0) {
    estacasPlanejadas = totalPlanejadoPorProducao;
  }

  const progressByDiameter = buildProgressByDiameter(productionRows, buildExecutedByDiameter(diarios));
  const percentualConcluido = estacasPlanejadas > 0
    ? Math.min(Math.round((estacasExecutadas / estacasPlanejadas) * 100), 100)
    : 0;
  const diasTrabalhados = new Set(diarios.map((item) => item.dataDiario).filter(Boolean)).size;
  const diasSemProducao = diarios.filter((item) => item.estacasNoDia === 0).length;
  const mediaDiaria = diasTrabalhados > 0 ? Number((estacasExecutadas / diasTrabalhados).toFixed(1)) : 0;
  const ultimaAtualizacao = diarios[0]?.dataDiario || "";
  let valorFatMinimoCobrado = 0;
  let medicoesComFatMinimo = 0;
  if (await tableExists("medicoes") && typeof gontijoRoutes.calcularTotaisMedicao === "function") {
    let medicaoWhere = "WHERE construction_id = ? AND status = 'fechada'";
    const medicaoParams = [constructionId];
    if (dataInicio) { medicaoWhere += " AND data_fim >= ?"; medicaoParams.push(dataInicio); }
    if (dataFim) { medicaoWhere += " AND data_inicio <= ?"; medicaoParams.push(dataFim); }
    const [medicoesRows] = await db.query(
      `SELECT id FROM medicoes ${medicaoWhere} ORDER BY data_medicao DESC, numero DESC`,
      medicaoParams
    );
    for (const row of medicoesRows) {
      const detalhe = await gontijoRoutes.calcularTotaisMedicao(Number(row.id));
      const valorFatMinimo = Array.isArray(detalhe?.fatMinimoTable)
        ? detalhe.fatMinimoTable
          .filter((dia) => (!dataInicio || dia.data >= dataInicio) && (!dataFim || dia.data <= dataFim))
          .reduce((total, dia) => total + Number(dia.saldo || 0), 0)
        : 0;
      if (valorFatMinimo > 0) medicoesComFatMinimo += 1;
      valorFatMinimoCobrado += valorFatMinimo;
    }
  }
  const timeline = diarios.slice(0, 12).flatMap((diario) => {
    const items = [
      {
        id: `diario-${diario.id}`,
        data: diario.dataDiario,
        tipo: "diario",
        titulo: "Diario aprovado",
        descricao: `${diario.equipamento || "Equipamento"} registrou ${diario.estacasNoDia} estaca${diario.estacasNoDia === 1 ? "" : "s"} no dia.`,
        detalhe: diario.operadorNome ? `Operador: ${diario.operadorNome}` : "",
        pdfUrl: diario.pdfUrl,
      },
    ];

    return items;
  });

  const publicDiarios = diarios.map(({ rawData, ocorrencias, ...diario }) => ({
    ...diario,
    ocorrencias: [],
  }));

  return {
    obra: {
      id: Number(construction.id),
      numero: firstFilledText(construction.construction_number),
      cliente: firstFilledText(construction.client_name),
      tipo: formatConstructionTypeForPortal(construction.type),
      cidade: firstFilledText(construction.city_name),
      estado: firstFilledText(construction.state),
      endereco: [construction.street, construction.number, construction.neighborhood, construction.complement]
        .map((value) => firstFilledText(value))
        .filter(Boolean)
        .join(", "),
      status: "em andamento",
    },
    filtros: { dataInicio: dataInicio || null, dataFim: dataFim || null },
    resumo: {
      totalDiarios: publicDiarios.length,
      estacasExecutadas,
      estacasPlanejadas,
      estacasRestantes: Math.max(estacasPlanejadas - estacasExecutadas, 0),
      percentualConcluido,
      diasTrabalhados,
      diasSemProducao,
      mediaDiaria,
      valorProducao: valorProducaoTotal > 0 ? valorProducaoTotal : null,
      valorFatMinimoCobrado,
      medicoesComFatMinimo,
      diariosPendentesAssinatura: assinaturasPendentes.length,
      ultimaAtualizacao,
    },
    progressoPorDiametro: progressByDiameter,
    fotos: allPhotos.slice(0, 18),
    timeline,
    diarios: publicDiarios,
    assinaturasPendentes,
  };
}

function buildDiarySignatureBaseUrl(req) {
  const configured =
    process.env.SIGNATURE_PUBLIC_BASE_URL ||
    process.env.PUBLIC_WEB_BASE_URL ||
    process.env.APP_PUBLIC_URL ||
    "";
  const origin = String(req.headers.origin || "").trim();

  if (configured) return configured.replace(/\/+$/, "");
  if (/^https?:\/\/.+/i.test(origin)) return origin.replace(/\/+$/, "");

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function buildDiarySignatureShareText({ diary, publicUrl }) {
  const obra = firstFilledText(diary.obra_numero, diary.data?.construction_number, "-");
  const equipamento = firstFilledText(
    diary.equipamento,
    diary.data?.equipment_name,
    diary.data?.equipment,
    "-"
  );
  const dataDiario = firstFilledText(diary.data_diario, diary.data?.date, "-");

  return `Ola! Segue o link para assinatura do diario da obra ${obra}, maquina ${equipamento}, referente ao dia ${dataDiario}: ${publicUrl}\n\nEste link expira em 24 horas.`;
}

function isSignatureLinkExpired(link) {
  if (!link?.expires_at) return false;
  return new Date(link.expires_at).getTime() <= Date.now();
}

function normalizeClientDiaryAttachments(value) {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
  const items = Array.isArray(value) ? value : [];
  return items.slice(0, 5).map((item) => {
    const name = String(item?.name || "anexo").trim().slice(0, 180) || "anexo";
    const type = String(item?.type || "").trim().toLowerCase();
    const size = Math.max(0, Number(item?.size || 0) || 0);
    const dataUrl = String(item?.dataUrl || "").trim();

    if (!allowedTypes.has(type)) return null;
    if (size > 5 * 1024 * 1024) return null;
    if (!dataUrl.startsWith(`data:${type};base64,`)) return null;

    return { name, type, size, dataUrl };
  }).filter(Boolean);
}

function normalizeClientDiaryObservation(value) {
  return String(value || "").trim().slice(0, 5000);
}

async function fetchDiaryForSignatureFlow(diaryId, { operatorUserId = null, conn = db } = {}) {
  const params = [diaryId];
  let where = "WHERE d.id = ?";

  if (operatorUserId) {
    where += " AND d.user_id = ?";
    params.push(operatorUserId);
  }

  const [rows] = await conn.query(
    `SELECT d.id,
            d.user_id,
            d.data,
            u.name AS operator_name,
            u.document AS operator_document,
            u.signature AS operator_signature,
            COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
            COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
            COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
            COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario
     FROM diaries d
     LEFT JOIN users u ON u.id = d.user_id
     LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
     LEFT JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
     ${where}
     LIMIT 1`,
    params
  );

  const row = rows[0] || null;
  if (!row) return null;

  return {
    id: Number(row.id),
    user_id: Number(row.user_id),
    obra_numero: firstFilledText(row.obra_numero),
    cliente: firstFilledText(row.cliente),
    equipamento: firstFilledText(row.equipamento),
    data_diario: firstFilledText(row.data_diario),
    operator_name: firstFilledText(row.operator_name),
    operator_document: firstFilledText(row.operator_document),
    operator_signature: firstFilledText(row.operator_signature),
    data: safeParseJsonObject(row.data),
  };
}

async function fetchLatestDiarySignatureLink(diaryId) {
  const [rows] = await db.query(
    `SELECT id, diary_id, token, status, expires_at, sent_at, signed_at, client_name, client_document, created_at, updated_at
     FROM diary_signature_links
     WHERE diary_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [diaryId]
  );

  return rows[0] || null;
}

async function expireDiarySignatureLinkIfNeeded(link, diary = null) {
  if (!link || link.status !== "active" || !isSignatureLinkExpired(link)) return link;

  await db.query(
    "UPDATE diary_signature_links SET status = 'expired', updated_at = NOW() WHERE id = ?",
    [link.id]
  );

  if (diary) {
    const nextData = {
      ...diary.data,
      signature_request: {
        ...(diary.data.signature_request && typeof diary.data.signature_request === "object" ? diary.data.signature_request : {}),
        status: "expirado",
        expiresAt: link.expires_at,
      },
    };

    await db.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
      JSON.stringify(nextData),
      diary.id,
    ]);
    diary.data = nextData;
  }

  return { ...link, status: "expired" };
}

function buildSignatureStatusPayload({ diary, link, publicUrl }) {
  const requestMeta =
    diary.data.signature_request && typeof diary.data.signature_request === "object"
      ? diary.data.signature_request
      : {};
  const signed =
    firstFilledText(diary.data.signature, diary.data.clientSignature?.signature) !== "" ||
    String(diary.data.status || "") === "assinado";
  const operatorSignature = firstFilledText(
    diary.data.operatorSignature,
    diary.operator_signature
  );
  const operatorName = firstFilledText(
    diary.data.operatorSignatureName,
    diary.operator_name
  );
  const operatorDocument = firstFilledText(
    diary.data.operatorSignatureDoc,
    diary.operator_document
  );

  const computedStatus = signed
    ? "assinado"
    : link?.status === "active"
      ? "aguardando_assinatura"
      : link?.status === "expired"
        ? "expirado"
        : "nao_gerado";

  const finalPublicUrl = publicUrl || firstFilledText(requestMeta.publicUrl);

  return {
    diaryId: diary.id,
    status: computedStatus,
    publicUrl: finalPublicUrl,
    expiresAt: firstFilledText(link?.expires_at, requestMeta.expiresAt),
    sentAt: firstFilledText(link?.sent_at, diary.data.enviado_em, requestMeta.sentAt),
    signedAt: firstFilledText(
      link?.signed_at,
      requestMeta.signedAt,
      diary.data.assinado_em
    ),
    clientName: firstFilledText(diary.data.signatureName, requestMeta.clientName),
    clientDocument: firstFilledText(diary.data.signatureDoc, requestMeta.clientDocument),
    hasOperatorSignature: Boolean(operatorSignature),
    hasClientSignature: Boolean(firstFilledText(diary.data.signature)),
    operatorName,
    operatorDocument,
    operatorSignature,
    obraNumero: diary.obra_numero,
    cliente: diary.cliente,
    equipamento: diary.equipamento,
    dataDiario: diary.data_diario,
    reviewConfirmed:
      diary.data.revisao_confirmed === true || diary.data.review_confirmed === true,
  };
}

async function generateDiarySignatureLink(req, conn, diary, createdByUserId) {
  if (!diary.operator_signature) {
    const error = new Error("Cadastre a assinatura do operador no perfil antes de enviar para o cliente.");
    error.statusCode = 400;
    throw error;
  }

  if (String(diary.data.status || "") === "assinado") {
    const error = new Error("Este diario ja foi assinado pelo cliente.");
    error.statusCode = 400;
    throw error;
  }

  await conn.query(
    "UPDATE diary_signature_links SET status = 'revoked', updated_at = NOW() WHERE diary_id = ? AND status = 'active'",
    [diary.id]
  );

  const token = crypto.randomBytes(24).toString("hex");
  const now = new Date();
  const expiresAtDate = addHours(now, 24);
  const sentAtSql = formatSqlDateTime(now);
  const expiresAtSql = formatSqlDateTime(expiresAtDate);
  const publicUrl = `${buildDiarySignatureBaseUrl(req)}/assinatura/diario/${token}`;

  await conn.query(
    `INSERT INTO diary_signature_links
     (diary_id, token, status, expires_at, sent_at, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
    [diary.id, token, expiresAtSql, sentAtSql, createdByUserId]
  );

  const nextData = {
    ...diary.data,
    status: diary.data.status === "assinado" ? "assinado" : "pendente",
    enviado_em: sentAtSql,
    operatorSignature: diary.operator_signature,
    operatorSignatureName: diary.operator_name,
    operatorSignatureDoc: diary.operator_document,
    signature_request: {
      ...(diary.data.signature_request && typeof diary.data.signature_request === "object" ? diary.data.signature_request : {}),
      status: "aguardando_assinatura",
      publicUrl,
      sentAt: sentAtSql,
      expiresAt: expiresAtSql,
      signedAt: null,
      clientName: "",
      clientDocument: "",
    },
  };

  await conn.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
    JSON.stringify(nextData),
    diary.id,
  ]);

  const link = {
    status: "active",
    expires_at: expiresAtSql,
    sent_at: sentAtSql,
    signed_at: null,
  };
  const nextDiary = { ...diary, data: nextData };
  const payload = buildSignatureStatusPayload({ diary: nextDiary, link, publicUrl });

  return {
    diary: nextDiary,
    payload: {
      ...payload,
      whatsappText: buildDiarySignatureShareText({ diary: nextDiary, publicUrl }),
    },
  };
}

app.post("/api/operador/session", async (req, res) => {
  const cpf = String(req.body?.cpf || "").replace(/\D/g, "");
  const senha = String(req.body?.senha || "");

  if (!cpf || !senha) {
    return res.status(400).json({ ok: false, message: "CPF e senha sao obrigatorios." });
  }

  try {
    await ensureUserSignaturePermissionColumn();
    const [[user]] = await db.query(
      "SELECT id, name, document, phone, password, active, cargo, pode_gerar_link_assinatura FROM users WHERE REPLACE(REPLACE(document, '.', ''), '-', '') = ? AND active = 'S'",
      [cpf]
    );

    if (!user) {
      return res.status(401).json({ ok: false, message: "CPF ou senha invalidos." });
    }

    const senhaOk = await bcrypt.compare(senha, user.password);
    if (!senhaOk) {
      return res.status(401).json({ ok: false, message: "CPF ou senha invalidos." });
    }

    const isAdminGlobal = ADMIN_GLOBAL_CPFS.includes(user.document.replace(/\D/g, ""));
    if ((user.cargo || "").toLowerCase() !== "operador" && !isAdminGlobal) {
      return res.status(403).json({ ok: false, message: "Acesso restrito a operadores." });
    }

    const token = crypto.randomUUID();
    operadorSessions.set(token, {
      userId: user.id,
      cpf: user.document,
      cargo: user.cargo,
      isAdminSession: isAdminGlobal,
      createdAt: new Date().toISOString(),
    });
    setCookie(res, "operador_session", token, cookieOptionsForRequest(req));

    return res.json({
      ok: true,
      user: {
        id: user.id,
        nome: user.name,
        cargo: isAdminGlobal ? "admin" : user.cargo,
        perfil: isAdminGlobal ? "admin" : "operador",
        podeGerarLinkAssinatura: isAdminGlobal ? true : String(user.pode_gerar_link_assinatura || "N") === "S",
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.post("/api/operador/logout", (req, res) => {
  const session = getOperadorSession(req);
  if (session) operadorSessions.delete(session.token);
  clearCookie(res, "operador_session");
  return res.json({ ok: true });
});

app.get("/api/operador/status", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) return res.json({ ok: true, authenticated: false });

  try {
    await ensureUserSignaturePermissionColumn();
    const [[user]] = await db.query(
      "SELECT id, name, document, cargo, pode_gerar_link_assinatura FROM users WHERE id = ? AND active = 'S'",
      [session.userId]
    );
    const cargoOk = user && (user.cargo || "").toLowerCase() === "operador";
    if (!user || (!cargoOk && !session.isAdminSession)) {
      if (!session.isAdminSession) {
        operadorSessions.delete(session.token);
        clearCookie(res, "operador_session");
      }
      return res.json({ ok: true, authenticated: false });
    }
    return res.json({
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        nome: user.name,
        cargo: session.isAdminSession ? "admin" : user.cargo,
        perfil: session.isAdminSession ? "admin" : "operador",
        podeGerarLinkAssinatura: session.isAdminSession ? true : String(user.pode_gerar_link_assinatura || "N") === "S",
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

function resolveUserPhotoUrl(filename, req) {
  if (!filename || filename === "user.png") return "";
  if (/^https?:\/\//i.test(filename) || filename.startsWith("data:image/")) return filename;
  const configured = (process.env.USER_PHOTOS_BASE_URL || "").replace(/\/+$/, "");
  if (configured) return `${configured}/${filename}`;
  const protocol = req?.headers["x-forwarded-proto"] || req?.protocol || "http";
  const host = req?.headers["x-forwarded-host"] || req?.get("host") || "localhost:3000";
  return `${protocol}://${host}/api/operador/profile/photo/${encodeURIComponent(filename)}`;
}

app.get("/api/operador/profile/photo/:filename", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) return res.status(401).end();

  const filename = req.params.filename;
  if (!filename || /[/\\]/.test(filename)) return res.status(400).end();

  const candidateDirs = [
    process.env.USER_PHOTOS_DIR,
    path.join(__dirname, "uploads", "photos"),
    path.join(__dirname, "uploads", "users"),
    path.join(__dirname, "uploads"),
    path.join(__dirname, "public", "storage"),
    path.join(__dirname, "public", "photos"),
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, filename);
    if (fullPath.startsWith(dir) && fs.existsSync(fullPath)) {
      return res.sendFile(fullPath);
    }
  }

  return res.status(404).end();
});

app.get("/api/operador/profile", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Sessao do operador nao encontrada." });
  }

  try {
    const [[user]] = await db.query(
      "SELECT id, name, alias, email, phone, photo, signature, document, active FROM users WHERE id = ? AND active = 'S'",
      [session.userId]
    );

    if (!user) {
      operadorSessions.delete(session.token);
      clearCookie(res, "operador_session");
      return res.status(401).json({ ok: false, message: "Operador nao encontrado." });
    }

    const emailRaw = user.email || "";
    const emailPublic = emailRaw.endsWith("@internal.com") ? "" : emailRaw;

    return res.json({
      ok: true,
      data: {
        id: user.id,
        nome: user.name,
        apelido: user.alias || "",
        email: emailPublic,
        telefone: user.phone || "",
        foto: resolveUserPhotoUrl(user.photo, req),
        assinatura: user.signature || "",
        documento: user.document || "",
        perfil: "operador",
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.put("/api/operador/profile", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Sessao do operador nao encontrada." });
  }

  const assinatura = String(req.body?.assinatura || "").trim();

  try {
    await db.query(
      "UPDATE users SET signature = ?, updated_at = NOW() WHERE id = ?",
      [assinatura || null, session.userId]
    );

    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.get("/api/operador/diarios/:id/signature-link", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Sessao do operador nao encontrada." });
  }

  try {
    const diary = await fetchDiaryForSignatureFlow(req.params.id, { operatorUserId: session.userId });
    if (!diary) {
      return res.status(404).json({ ok: false, message: "Diario nao encontrado para este operador." });
    }

    let link = await fetchLatestDiarySignatureLink(diary.id);
    link = await expireDiarySignatureLinkIfNeeded(link, diary);

    return res.json({
      ok: true,
      data: buildSignatureStatusPayload({ diary, link }),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.post("/api/operador/diarios/:id/signature-link", async (req, res) => {
  const session = getOperadorSession(req);
  if (!session) {
    return res.status(401).json({ ok: false, message: "Sessao do operador nao encontrada." });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const canGenerateSignatureLink = await userCanGenerateDiarySignatureLink(session.userId, conn);
    if (!canGenerateSignatureLink) {
      await conn.rollback();
      return res.status(403).json({
        ok: false,
        message: "Seu usuario nao tem permissao para gerar link de assinatura.",
      });
    }

    const [rows] = await conn.query(
      `SELECT d.id,
              d.user_id,
              d.data,
              u.name AS operator_name,
              u.document AS operator_document,
              u.signature AS operator_signature,
              COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
              COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
              COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario
       FROM diaries d
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       WHERE d.id = ? AND d.user_id = ?
       LIMIT 1`,
      [req.params.id, session.userId]
    );

    const row = rows[0] || null;
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Diario nao encontrado para este operador." });
    }

    const diary = {
      id: Number(row.id),
      user_id: Number(row.user_id),
      obra_numero: firstFilledText(row.obra_numero),
      cliente: firstFilledText(row.cliente),
      equipamento: firstFilledText(row.equipamento),
      data_diario: firstFilledText(row.data_diario),
      operator_name: firstFilledText(row.operator_name),
      operator_document: firstFilledText(row.operator_document),
      operator_signature: firstFilledText(row.operator_signature),
      data: safeParseJsonObject(row.data),
    };

    const diaryStatus = String(diary.data.status || "");
    if (diaryStatus === "rascunho" || diaryStatus === "") {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        message: "O diario precisa ser finalizado antes de enviar para assinatura do cliente.",
      });
    }

    if (!diary.operator_signature) {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        message: "Cadastre a assinatura do operador no perfil antes de enviar para o cliente.",
      });
    }

    if (diaryStatus === "assinado") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Este diario ja foi assinado pelo cliente." });
    }

    await conn.query(
      "UPDATE diary_signature_links SET status = 'revoked', updated_at = NOW() WHERE diary_id = ? AND status = 'active'",
      [diary.id]
    );

    const token = crypto.randomBytes(24).toString("hex");
    const now = new Date();
    const expiresAtDate = addHours(now, 24);
    const sentAtSql = formatSqlDateTime(now);
    const expiresAtSql = formatSqlDateTime(expiresAtDate);
    const publicUrl = `${buildDiarySignatureBaseUrl(req)}/assinatura/diario/${token}`;

    await conn.query(
      `INSERT INTO diary_signature_links
       (diary_id, token, status, expires_at, sent_at, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, NOW(), NOW())`,
      [diary.id, token, expiresAtSql, sentAtSql, session.userId]
    );

    const nextData = {
      ...diary.data,
      status: diary.data.status === "assinado" ? "assinado" : "pendente",
      enviado_em: sentAtSql,
      operatorSignature: diary.operator_signature,
      operatorSignatureName: diary.operator_name,
      operatorSignatureDoc: diary.operator_document,
      signature_request: {
        ...(diary.data.signature_request && typeof diary.data.signature_request === "object" ? diary.data.signature_request : {}),
        status: "aguardando_assinatura",
        publicUrl,
        sentAt: sentAtSql,
        expiresAt: expiresAtSql,
        signedAt: null,
        clientName: "",
        clientDocument: "",
      },
    };

    await conn.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
      JSON.stringify(nextData),
      diary.id,
    ]);

    await conn.commit();

    // Diary is now 'pendente' — trigger auto-approval check against obra_producao
    const obraIdForConferencia = parseInt(diary.data.construction_id || diary.data.obra_id || 0) || null;
    if (obraIdForConferencia) {
      await gontijoRoutes.tryAutoAprovarConferencia(conn, diary.id, obraIdForConferencia);
    }

    const payload = buildSignatureStatusPayload({
      diary: { ...diary, data: nextData },
      link: {
        status: "active",
        expires_at: expiresAtSql,
        sent_at: sentAtSql,
        signed_at: null,
      },
      publicUrl,
    });

    return res.json({
      ok: true,
      data: {
        ...payload,
        whatsappText: buildDiarySignatureShareText({
          diary: { ...diary, data: nextData },
          publicUrl,
        }),
      },
    });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/admin/diarios/:id/signature-link", requireAdmin, async (req, res) => {
  if (!req.adminSession?.isAdmin) {
    return res.status(403).json({ ok: false, message: "Apenas administradores podem consultar link de assinatura." });
  }

  try {
    const diary = await fetchDiaryForSignatureFlow(req.params.id);
    if (!diary) {
      return res.status(404).json({ ok: false, message: "Diario nao encontrado." });
    }

    let link = await fetchLatestDiarySignatureLink(diary.id);
    link = await expireDiarySignatureLinkIfNeeded(link, diary);
    const payload = buildSignatureStatusPayload({ diary, link });

    return res.json({
      ok: true,
      data: {
        ...payload,
        whatsappText: payload.publicUrl ? buildDiarySignatureShareText({ diary, publicUrl: payload.publicUrl }) : "",
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.post("/api/admin/diarios/:id/signature-link", requireAdmin, async (req, res) => {
  if (!req.adminSession?.isAdmin) {
    return res.status(403).json({ ok: false, message: "Apenas administradores podem gerar link de assinatura." });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const diary = await fetchDiaryForSignatureFlow(req.params.id, { conn });
    if (!diary) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Diario nao encontrado." });
    }

    const result = await generateDiarySignatureLink(req, conn, diary, req.adminSession.userId || null);

    await conn.commit();

    const obraIdForConferencia = parseInt(diary.data.construction_id || diary.data.obra_id || 0) || null;
    if (obraIdForConferencia) {
      await gontijoRoutes.tryAutoAprovarConferencia(conn, diary.id, obraIdForConferencia);
    }

    return res.json({ ok: true, data: result.payload });
  } catch (error) {
    await conn.rollback();
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.statusCode ? error.message : "Erro interno.",
      details: error.statusCode ? undefined : error.message,
    });
  } finally {
    conn.release();
  }
});

app.get("/api/public/diarios/signature/:token", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT l.id AS link_id,
              l.diary_id,
              l.token,
              l.status AS link_status,
              l.expires_at,
              l.sent_at,
              l.signed_at,
              l.client_name,
              l.client_document,
              d.data,
              COALESCE(c.construction_number, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_number'))) AS obra_numero,
              COALESCE(cl.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.client'))) AS cliente,
              COALESCE(e.name, JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_name')), JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment'))) AS equipamento,
              COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.date')), ''), DATE_FORMAT(d.created_at, '%Y-%m-%d')) AS data_diario,
              JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.enviado_em')) AS enviado_em,
              u.name AS operator_name,
              u.document AS operator_document,
              u.signature AS operator_signature
       FROM diary_signature_links l
       INNER JOIN diaries d ON d.id = l.diary_id
       LEFT JOIN users u ON u.id = d.user_id
       LEFT JOIN constructions c ON c.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.construction_id')), '') AS UNSIGNED)
       LEFT JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN equipments e ON e.id = CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(d.data, '$.equipment_id')), '') AS UNSIGNED)
       WHERE l.token = ?
       LIMIT 1`,
      [req.params.token]
    );

    const row = rows[0] || null;
    if (!row) {
      return res.status(404).json({ ok: false, message: "Link de assinatura nao encontrado." });
    }

    const diary = {
      id: Number(row.diary_id),
      obra_numero: firstFilledText(row.obra_numero),
      cliente: firstFilledText(row.cliente),
      equipamento: firstFilledText(row.equipamento),
      data_diario: firstFilledText(row.data_diario),
      operator_name: firstFilledText(row.operator_name),
      operator_document: firstFilledText(row.operator_document),
      operator_signature: firstFilledText(row.operator_signature),
      data: safeParseJsonObject(row.data),
    };

    let link = {
      id: Number(row.link_id),
      status: firstFilledText(row.link_status),
      expires_at: row.expires_at,
      sent_at: row.sent_at,
      signed_at: row.signed_at,
      client_name: firstFilledText(row.client_name),
      client_document: firstFilledText(row.client_document),
    };

    if (link.status === "active" && isSignatureLinkExpired(link)) {
      await db.query(
        "UPDATE diary_signature_links SET status = 'expired', updated_at = NOW() WHERE id = ?",
        [link.id]
      );

      const nextData = {
        ...diary.data,
        signature_request: {
          ...(diary.data.signature_request && typeof diary.data.signature_request === "object" ? diary.data.signature_request : {}),
          status: "expirado",
          expiresAt: row.expires_at,
        },
      };

      await db.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
        JSON.stringify(nextData),
        diary.id,
      ]);
      diary.data = nextData;
      link = { ...link, status: "expired" };
    }

    const requestMeta =
      diary.data.signature_request && typeof diary.data.signature_request === "object"
        ? diary.data.signature_request
        : {};

    return res.json({
      ok: true,
      data: {
        tokenStatus: String(link.status || ""),
        diaryId: diary.id,
        obraNumero: diary.obra_numero,
        cliente: diary.cliente,
        equipamento: diary.equipamento,
        dataDiario: diary.data_diario,
        sentAt: firstFilledText(link.sent_at, diary.data.enviado_em, requestMeta.sentAt),
        pdfUrl: `/api/gontijo/diarios/${diary.id}/pdf?signatureToken=${encodeURIComponent(req.params.token)}`,
        operatorName: firstFilledText(diary.data.operatorSignatureName, diary.operator_name),
        operatorDocument: firstFilledText(diary.data.operatorSignatureDoc, diary.operator_document),
        operatorSignature: firstFilledText(diary.data.operatorSignature, diary.operator_signature),
        clientName: firstFilledText(diary.data.signatureName, link.client_name, requestMeta.clientName),
        clientDocument: firstFilledText(diary.data.signatureDoc, link.client_document, requestMeta.clientDocument),
        clientSignature: firstFilledText(diary.data.signature),
        clientObservationText: firstFilledText(diary.data.clientObservation?.text),
        clientAttachments: Array.isArray(diary.data.clientObservation?.attachments)
          ? diary.data.clientObservation.attachments.map((item) => ({
              name: firstFilledText(item?.name),
              type: firstFilledText(item?.type),
              size: Number(item?.size || 0) || 0,
              dataUrl: firstFilledText(item?.dataUrl),
            })).filter((item) => item.name)
          : [],
        signedAt: firstFilledText(link.signed_at, diary.data.assinado_em, requestMeta.signedAt),
        expiresAt: firstFilledText(link.expires_at, requestMeta.expiresAt),
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

app.post("/api/public/diarios/signature/:token", async (req, res) => {
  const nome = String(req.body?.nome || "").trim();
  const documento = String(req.body?.documento || "").trim();
  const assinatura = String(req.body?.assinatura || "").trim();
  const observacao = normalizeClientDiaryObservation(req.body?.observacao);
  const anexos = normalizeClientDiaryAttachments(req.body?.anexos);

  if (!nome || !documento || !assinatura) {
    return res.status(400).json({
      ok: false,
      message: "Nome, documento e assinatura do cliente sao obrigatorios.",
    });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT l.id AS link_id,
              l.diary_id,
              l.status AS link_status,
              l.expires_at,
              d.data
       FROM diary_signature_links l
       INNER JOIN diaries d ON d.id = l.diary_id
       WHERE l.token = ?
       LIMIT 1
       FOR UPDATE`,
      [req.params.token]
    );

    const row = rows[0] || null;
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ ok: false, message: "Link de assinatura nao encontrado." });
    }

    if (String(row.link_status) === "signed") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Este link ja foi utilizado." });
    }

    if (String(row.link_status) !== "active") {
      await conn.rollback();
      return res.status(400).json({ ok: false, message: "Este link nao esta mais disponivel." });
    }

    if (isSignatureLinkExpired(row)) {
      const diaryData = safeParseJsonObject(row.data);
      const nextData = {
        ...diaryData,
        signature_request: {
          ...(diaryData.signature_request && typeof diaryData.signature_request === "object" ? diaryData.signature_request : {}),
          status: "expirado",
          expiresAt: row.expires_at,
        },
      };
      await conn.query(
        "UPDATE diary_signature_links SET status = 'expired', updated_at = NOW() WHERE id = ?",
        [row.link_id]
      );
      await conn.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
        JSON.stringify(nextData),
        row.diary_id,
      ]);
      await conn.commit();
      return res.status(400).json({ ok: false, message: "Este link de assinatura expirou." });
    }

    const diaryData = safeParseJsonObject(row.data);
    const signedAt = formatSqlDateTime();
    const nextData = {
      ...diaryData,
      status: "assinado",
      assinado_em: signedAt,
      signatureName: nome,
      signatureDoc: documento,
      signature: assinatura,
      clientSignature: {
        name: nome,
        document: documento,
        signature: assinatura,
        signedAt,
      },
      clientObservation: {
        text: observacao,
        attachments: anexos,
        createdAt: signedAt,
      },
      signature_request: {
        ...(diaryData.signature_request && typeof diaryData.signature_request === "object" ? diaryData.signature_request : {}),
        status: "assinado",
        signedAt,
        clientName: nome,
        clientDocument: documento,
      },
    };

    await conn.query(
      "UPDATE diary_signature_links SET status = 'signed', signed_at = ?, client_name = ?, client_document = ?, updated_at = NOW() WHERE id = ?",
      [signedAt, nome, documento, row.link_id]
    );

    await conn.query("UPDATE diaries SET data = ?, updated_at = NOW() WHERE id = ?", [
      JSON.stringify(nextData),
      row.diary_id,
    ]);

    await conn.commit();

    // Trigger auto-approval check now that the diary is signed
    const obraId = parseInt(diaryData.construction_id || diaryData.obra_id || 0) || null;
    if (obraId) {
      await gontijoRoutes.tryAutoAprovarConferencia(conn, row.diary_id, obraId);
    }

    return res.json({
      ok: true,
      data: {
        signedAt,
        diaryId: Number(row.diary_id),
      },
    });
  } catch (error) {
    await conn.rollback();
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  } finally {
    conn.release();
  }
});

app.get("/api/admin/machines", requireAdmin, async (_req, res) => {
  try {
    return res.json({
      ok: true,
      items: await adminStore.listMachines(),
      mode: adminStore.getMode(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao listar maquinas admin.",
      details: error.message,
    });
  }
});

app.get("/api/admin/mappings", requireAdmin, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || "false") === "true";
    return res.json({
      ok: true,
      items: await adminStore.listMappings({ includeInactive }),
      mode: adminStore.getMode(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao listar vinculos admin.",
      details: error.message,
    });
  }
});

app.post("/api/admin/mappings", requireAdmin, async (req, res) => {
  try {
    const mapping = await adminStore.createMapping(validateMappingPayload(req.body || {}));
    if (mapping?.active) {
      await adminStore.activateMapping(mapping.id);
    }
    return res.status(201).json({
      ok: true,
      item: mapping?.active ? await adminStore.getMappingById(mapping.id) : mapping,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao criar vinculo admin.",
      details: error.message,
    });
  }
});

app.put("/api/admin/mappings/:id", requireAdmin, async (req, res) => {
  try {
    const mapping = await adminStore.updateMapping(req.params.id, validateMappingPayload(req.body || {}));
    return res.json({
      ok: true,
      item: mapping,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao atualizar vinculo admin.",
      details: error.message,
    });
  }
});

app.post("/api/admin/mappings/:id/activate", requireAdmin, async (req, res) => {
  try {
    const mapping = await adminStore.activateMapping(req.params.id);
    return res.json({
      ok: true,
      item: mapping,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao ativar vinculo admin.",
      details: error.message,
    });
  }
});

app.post("/api/admin/mappings/:id/archive", requireAdmin, async (req, res) => {
  try {
    const mapping = await adminStore.archiveMapping(req.params.id);
    return res.json({
      ok: true,
      item: mapping,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao encerrar vinculo admin.",
      details: error.message,
    });
  }
});

app.get("/api/admin/goal-targets", requireAdmin, async (req, res) => {
  try {
    await ensureGoalTargetsSanitized();
    const includeArchived = String(req.query.includeArchived || "false") === "true";
    const limit = Number(req.query.limit || 100);
    return res.json({
      ok: true,
      items: await goalTargetStore.listGoals({ includeArchived, limit }),
      mode: goalTargetStore.getMode(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao listar metas importadas.",
      details: error.message,
    });
  }
});

app.post("/api/admin/goal-imports/parse", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: "Envie um arquivo .xlsx, .xls ou .csv.",
      });
    }

    const result = await parseGoalImportFile(req.file);
    return res.json({
      ok: true,
      items: result.items,
      skippedWithoutOfficialMachine: result.skippedWithoutOfficialMachine,
      sourceFileName: req.file.originalname,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao ler planilha de metas.",
      details: error.message,
    });
  }
});

app.post("/api/admin/goal-imports/confirm", requireAdmin, async (req, res) => {
  try {
    await ensureGoalTargetsSanitized();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({
        ok: false,
        message: "Nenhuma linha enviada para confirmacao.",
      });
    }

    const invalidItems = [];
    const validItems = [];

    for (const item of items) {
      const officialMachine = resolveOfficialMachine(item?.machine_name || item?.equipment_label);
      const normalizedItem = officialMachine
        ? {
          ...item,
          machine_name: officialMachine.machine_name,
          imei: officialMachine.imei,
        }
        : item;

      const isInvalid =
        !normalizedItem?.date
        || !normalizedItem?.equipment_label
        || !String(normalizedItem?.imei || "").trim()
        || !String(normalizedItem?.machine_name || "").trim()
        || !Array.isArray(normalizedItem?.segments)
        || !normalizedItem.segments.length
        || (Array.isArray(normalizedItem?.errors) && normalizedItem.errors.length > 0)
        || !isOfficialGoalItem(normalizedItem);

      if (isInvalid) {
        invalidItems.push(item);
      } else {
        validItems.push(normalizedItem);
      }
    }

    if (!validItems.length) {
      return res.status(400).json({
        ok: false,
        message: "Nenhuma linha valida para salvar. Revise as linhas com erro.",
      });
    }

    const saved = await goalTargetStore.saveConfirmedGoals(validItems, { confirmedBy: "admin" });
    return res.json({
      ok: true,
      savedCount: saved.length,
      rejectedCount: invalidItems.length,
      items: saved,
      rejectedItems: invalidItems,
    });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      message: "Falha ao confirmar metas importadas.",
      details: error.message,
    });
  }
});

app.get("/api/display/config", (req, res) => {
  const screen = String(req.query.screen || "primary");
  const rotationSeconds = Number(process.env.TV_ROTATION_SECONDS || 300);
  const autoRefreshSeconds = Number(process.env.TV_AUTO_REFRESH_SECONDS || 60);

  return res.json({
    ok: true,
    item: {
      screen,
      tvMode: true,
      rotationSeconds: screen === "secondary" ? Number(process.env.TV_SECONDARY_ROTATION_SECONDS || 120) : rotationSeconds,
      autoRefreshSeconds,
      tabs: screen === "secondary"
        ? ["secondary-overview", "secondary-heatmap", "secondary-timeline"]
        : ["daily", "weekly"],
    },
  });
});

app.get("/api/estacas/sync", async (req, res) => {
  try {
    const imei = String(req.query.imei || "").trim();
    const date = String(req.query.date || "").trim();

    if (!imei) {
      return res.status(400).json({ ok: false, message: "IMEI obrigatorio." });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, message: "Data invalida. Use YYYY-MM-DD." });
    }

    const missing = missingEnvVars();
    if (missing.length > 0) {
      return res.json({ ok: true, data: [], noS3: true, message: "Configuracao S3 ausente." });
    }

    const clientLogin = getClientLogin(req.query.clientLogin);
    const client = buildS3Client();
    const prefix = buildPrefix(clientLogin, imei, date);
    const summaries = await buildOperationalSummaries(client, prefix);

    const data = summaries.map((item) => ({
      s3Key: item.key,
      pilar: item.estaca || "",
      diametro: item.diametroCm != null ? String(item.diametroCm) : "",
      realizado: item.realizadoLinearM ?? null,
      finishedAt: item.finishedAt || null,
      obra: item.obra || "",
    }));

    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

app.get("/api/dashboard/daily", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await ensureGoalTargetsSanitized();
    const date = String(req.query.date || getCurrentDateString());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        ok: false,
        message: "Data invalida. Use o formato YYYY-MM-DD.",
      });
    }

    const clientLogin = getClientLogin(req.query.clientLogin);
    const client = buildS3Client();
    const mappings = await adminStore.listActiveMappings();
    const goalTargets = await goalTargetStore.listGoals({ dateFrom: date, dateTo: date, limit: 1000 });
    const dashboard = await buildDailyDashboard({
      mappings,
      date,
      goalTargets,
      loadSummaries: async (imei, summaryDate) => {
        const prefix = buildPrefix(clientLogin, imei, summaryDate);
        return buildOperationalSummaries(client, prefix);
      },
    });

    return res.json({
      ok: true,
      clientLogin,
      ...dashboard,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar dashboard diario.",
      details: error.message,
    });
  }
});

app.get("/api/dashboard/weekly", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await ensureGoalTargetsSanitized();
    const weekStart = String(req.query.weekStart || getWeekStartFromDate(getCurrentDateString()));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({
        ok: false,
        message: "weekStart invalido. Use o formato YYYY-MM-DD.",
      });
    }

    const clientLogin = getClientLogin(req.query.clientLogin);
    const client = buildS3Client();
    const weekDates = buildWeekDates(weekStart);
    const mappings = await adminStore.listActiveMappings();
    const goalTargets = await goalTargetStore.listGoals({
      dateFrom: weekDates[0],
      dateTo: weekDates[weekDates.length - 1],
      limit: 5000,
    });
    const dashboard = await buildWeeklyDashboard({
      mappings,
      weekStart,
      weekDates,
      goalTargets,
      loadSummaries: async (imei, summaryDate) => {
        const prefix = buildPrefix(clientLogin, imei, summaryDate);
        return buildOperationalSummaries(client, prefix);
      },
    });

    return res.json({
      ok: true,
      clientLogin,
      ...dashboard,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar dashboard semanal.",
      details: error.message,
    });
  }
});

app.get("/api/dashboard/secondary", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await ensureGoalTargetsSanitized();
    const date = String(req.query.date || getCurrentDateString());
    const weekStart = String(req.query.weekStart || getWeekStartFromDate(date));
    const clientLogin = getClientLogin(req.query.clientLogin);
    const client = buildS3Client();
    const mappings = await adminStore.listActiveMappings();
    const weekDates = buildWeekDates(weekStart);
    const goalTargets = await goalTargetStore.listGoals({
      dateFrom: weekDates[0],
      dateTo: weekDates[weekDates.length - 1],
      limit: 5000,
    });
    const dailyGoalTargets = goalTargets.filter((item) => String(item.date || "") === date);

    const dailyDashboard = await buildDailyDashboard({
      mappings,
      date,
      goalTargets: dailyGoalTargets,
      loadSummaries: async (imei, summaryDate) => {
        const prefix = buildPrefix(clientLogin, imei, summaryDate);
        return buildOperationalSummaries(client, prefix);
      },
    });

    const weeklyDashboard = await buildWeeklyDashboard({
      mappings,
      weekStart,
      weekDates,
      goalTargets,
      loadSummaries: async (imei, summaryDate) => {
        const prefix = buildPrefix(clientLogin, imei, summaryDate);
        return buildOperationalSummaries(client, prefix);
      },
    });

    return res.json({
      ok: true,
      clientLogin,
      date,
      weekStart,
      item: buildSecondaryDashboard({
        dailyDashboard,
        weeklyDashboard,
      }),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar painel secundario.",
      details: error.message,
    });
  }
});

app.get("/api/health", async (_req, res) => {
  const missing = missingEnvVars();

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    const client = buildS3Client();
    await client.send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET }));

    return res.json({
      ok: true,
      message: "Conexao com o bucket validada.",
      bucket: process.env.S3_BUCKET,
      region: process.env.AWS_REGION || "sa-east-1",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao validar acesso ao bucket.",
      error: error.name,
      details: error.message,
    });
  }
});

app.get("/api/estacas", async (req, res) => {
  const missing = missingEnvVars();
  const { imei, date, clientLogin } = req.query;

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  if (!/^\d{15}$/.test(String(imei || ""))) {
    return res.status(400).json({
      ok: false,
      message: "IMEI invalido. Informe 15 digitos numericos.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({
      ok: false,
      message: "Data invalida. Use o formato YYYY-MM-DD.",
    });
  }

  const normalizedClientLogin = getClientLogin(clientLogin);
  const prefix = buildPrefix(normalizedClientLogin, imei, date);

  try {
    const client = buildS3Client();
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET,
        Prefix: prefix,
      })
    );

    const objects = (result.Contents || []).map((item) => {
      const parsed = parseEstacaKey(item.Key);
      return {
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        ...parsed,
      };
    });

    return res.json({
      ok: true,
      bucket: process.env.S3_BUCKET,
      clientLogin: normalizedClientLogin,
      prefix,
      count: objects.length,
      items: objects,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao consultar objetos no S3.",
      error: error.name,
      details: error.message,
      prefix,
    });
  }
});

app.get("/api/estacas/summary", async (req, res) => {
  const missing = missingEnvVars();
  const { imei, date, clientLogin } = req.query;

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  if (!/^\d{15}$/.test(String(imei || ""))) {
    return res.status(400).json({
      ok: false,
      message: "IMEI invalido. Informe 15 digitos numericos.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({
      ok: false,
      message: "Data invalida. Use o formato YYYY-MM-DD.",
    });
  }

  const normalizedClientLogin = getClientLogin(clientLogin);
  const prefix = buildPrefix(normalizedClientLogin, imei, date);

  try {
    const client = buildS3Client();
    const summaries = await buildOperationalSummaries(client, prefix);

    return res.json({
      ok: true,
      bucket: process.env.S3_BUCKET,
      clientLogin: normalizedClientLogin,
      prefix,
      count: summaries.length,
      items: summaries,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar resumo das estacas.",
      error: error.name,
      details: error.message,
      prefix,
    });
  }
});

app.get("/api/estacas/summary/pdf", async (req, res) => {
  const missing = missingEnvVars();
  const { imei, date, clientLogin, machineName } = req.query;

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  if (!/^\d{15}$/.test(String(imei || ""))) {
    return res.status(400).json({
      ok: false,
      message: "IMEI invalido. Informe 15 digitos numericos.",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({
      ok: false,
      message: "Data invalida. Use o formato YYYY-MM-DD.",
    });
  }

  const normalizedClientLogin = getClientLogin(clientLogin);
  const prefix = buildPrefix(normalizedClientLogin, imei, date);

  try {
    const client = buildS3Client();
    const items = await buildOperationalSummaries(client, prefix);
    const pdfBuffer = await buildDiaryPdf({
      clientLogin: normalizedClientLogin,
      imei,
      date,
      items,
      prefix,
      machineName: String(machineName || "").trim(),
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=\"diario-estacas-${normalizedClientLogin}-${imei}-${date}.pdf\"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar diario em PDF.",
      error: error.name,
      details: error.message,
      prefix,
    });
  }
});

app.post("/api/dashboard/weekly", async (req, res) => {
  const missing = missingEnvVars();
  const { clientLogin, weekStart, machines, obraFilter, contratoFilter } = req.body || {};

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(weekStart || ""))) {
    return res.status(400).json({
      ok: false,
      message: "weekStart invalido. Use o formato YYYY-MM-DD.",
    });
  }

  if (!Array.isArray(machines) || machines.length === 0) {
    return res.status(400).json({
      ok: false,
      message: "Informe ao menos uma maquina para o dashboard semanal.",
    });
  }

  const normalizedClientLogin = getClientLogin(clientLogin);
  const weekDates = buildWeekDates(weekStart);
  const normalizedMachines = machines
    .map((item) => ({
      name: String(item?.name || "").trim(),
      imei: String(item?.imei || "").trim(),
    }))
    .filter((item) => item.name && /^\d{15}$/.test(item.imei));

  if (!normalizedMachines.length) {
    return res.status(400).json({
      ok: false,
      message: "Nenhuma maquina valida foi enviada.",
    });
  }

  try {
    const client = buildS3Client();
    const machineReports = [];
    const previousMachineReports = [];
    const allItems = [];
    const previousAllItems = [];
    const previousWeekDates = buildWeekDates(shiftDate(weekStart, -7));

    for (const machine of normalizedMachines) {
      const daily = [];
      const previousDaily = [];
      let weeklyTotalMeters = 0;
      let weeklyTotalCount = 0;
      let firstFinishedAt = null;
      let lastFinishedAt = null;
      const shiftStats = {
        manha: { meters: 0, count: 0 },
        tarde: { meters: 0, count: 0 },
        noite: { meters: 0, count: 0 },
        indefinido: { meters: 0, count: 0 },
      };
      const weeklyItems = [];

      for (const date of weekDates) {
        const prefix = buildPrefix(normalizedClientLogin, machine.imei, date);
        const summaries = applySummaryFilters(await buildOperationalSummaries(client, prefix), obraFilter, contratoFilter)
          .map((item) => ({ ...item, machineName: machine.name, machineImei: machine.imei, date }));
        const totalMeters = summaries.reduce((sum, item) => sum + (item.realizadoM || 0), 0);
        const totalCount = summaries.length;
        const firstTime = summaries.map((item) => item.finishedAt).filter(Boolean).sort()[0] || null;
        const lastTime = summaries.map((item) => item.finishedAt).filter(Boolean).sort().at(-1) || null;

        daily.push({
          date,
          totalMeters,
          totalCount,
          firstTime,
          lastTime,
        });

        weeklyTotalMeters += totalMeters;
        weeklyTotalCount += totalCount;
        weeklyItems.push(...summaries);
        allItems.push(...summaries);

        if (firstTime && (!firstFinishedAt || `${date} ${firstTime}` < firstFinishedAt)) {
          firstFinishedAt = `${date} ${firstTime}`;
        }
        if (lastTime && (!lastFinishedAt || `${date} ${lastTime}` > lastFinishedAt)) {
          lastFinishedAt = `${date} ${lastTime}`;
        }

        for (const item of summaries) {
          const bucket = shiftStats[item.shift] || shiftStats.indefinido;
          bucket.meters += item.realizadoM || 0;
          bucket.count += 1;
        }
      }

      let previousWeeklyTotalMeters = 0;
      let previousWeeklyTotalCount = 0;
      for (const date of previousWeekDates) {
        const prefix = buildPrefix(normalizedClientLogin, machine.imei, date);
        const summaries = applySummaryFilters(await buildOperationalSummaries(client, prefix), obraFilter, contratoFilter)
          .map((item) => ({ ...item, machineName: machine.name, machineImei: machine.imei, date }));
        const totalMeters = summaries.reduce((sum, item) => sum + (item.realizadoM || 0), 0);
        const totalCount = summaries.length;
        previousDaily.push({ date, totalMeters, totalCount });
        previousWeeklyTotalMeters += totalMeters;
        previousWeeklyTotalCount += totalCount;
        previousAllItems.push(...summaries);
      }

      const avgInclination = average(weeklyItems.map((item) => item.inclination?.magnitudeDeg));
      const outOfInclinationLimit = weeklyItems.filter((item) => (item.inclination?.magnitudeDeg || 0) > 5).length;
      const avgDrillingDurationMin = average(weeklyItems.map((item) => item.drillingDurationMin));
      const avgConcretingDurationMin = average(weeklyItems.map((item) => item.concretingDurationMin));
      const utilizationRate = weekDates.length ? ((weekDates.length - daily.filter((item) => item.totalCount === 0).length) / weekDates.length) * 100 : 0;
      const avgConcreteLiters = average(weeklyItems.map((item) => item.estimatedConcreteLiters));
      const avgPressureBar = average(weeklyItems.map((item) => item.avgPressureBar));
      const avgTorqueBar = average(weeklyItems.map((item) => item.avgTorqueBar));
      const avgRotationRpm = average(weeklyItems.map((item) => item.avgRotationRpm));
      const gpsPoints = weeklyItems.filter((item) => item.gps);

      machineReports.push({
        machine,
        daily,
        previousDaily,
        weeklyTotalMeters,
        weeklyTotalCount,
        previousWeeklyTotalMeters,
        previousWeeklyTotalCount,
        firstFinishedAt,
        lastFinishedAt,
        daysWithoutProduction: daily.filter((item) => item.totalCount === 0).length,
        utilizationRate,
        shifts: shiftStats,
        quality: {
          avgInclination,
          outOfInclinationLimit,
          avgPressureBar,
          avgTorqueBar,
          avgRotationRpm,
          avgConcreteLiters,
        },
        operations: {
          avgDrillingDurationMin,
          avgConcretingDurationMin,
          avgMetersPerPile: weeklyTotalCount ? weeklyTotalMeters / weeklyTotalCount : 0,
        },
        gpsPoints: gpsPoints.map((item) => ({
          lat: item.gps.lat,
          lon: item.gps.lon,
          alt: item.gps.alt,
          estaca: item.estaca,
          obra: item.obra,
        })),
      });

      previousMachineReports.push({
        machine,
        weeklyTotalMeters: previousWeeklyTotalMeters,
        weeklyTotalCount: previousWeeklyTotalCount,
      });
    }

    const obraTotals = groupTotals(allItems, "obra");
    const contratoTotals = groupTotals(allItems, "contrato");
    const previousTotalMeters = previousMachineReports.reduce((sum, item) => sum + item.weeklyTotalMeters, 0);
    const previousTotalCount = previousMachineReports.reduce((sum, item) => sum + item.weeklyTotalCount, 0);

    return res.json({
      ok: true,
      clientLogin: normalizedClientLogin,
      weekStart,
      weekDates,
      previousWeekStart: previousWeekDates[0],
      previousWeekDates,
      previousTotals: {
        meters: previousTotalMeters,
        count: previousTotalCount,
      },
      obraTotals,
      contratoTotals,
      timeline: buildTimeline(allItems).slice(0, 50),
      heatmap: buildHeatmap(machineReports, weekDates),
      boxplot: buildBoxplot(allItems),
      alerts: buildAlerts(machineReports, previousMachineReports, allItems),
      machines: machineReports,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao gerar dashboard semanal.",
      error: error.name,
      details: error.message,
    });
  }
});

app.get("/api/estacas/detail", async (req, res) => {
  const missing = missingEnvVars();
  const { key } = req.query;

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  if (!key || typeof key !== "string") {
    return res.status(400).json({
      ok: false,
      message: "Parametro key obrigatorio.",
    });
  }

  try {
    const client = buildS3Client();
    const detail = await buildEstacaDetail(client, key);

    return res.json({
      ok: true,
      bucket: process.env.S3_BUCKET,
      key: detail.key,
      size: detail.size,
      parsed: detail.parsed,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Falha ao baixar ou converter a estaca.",
      error: error.name,
      details: error.message,
      key,
    });
  }
});

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  if (path.extname(req.path)) return next();
  return res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (!process.env.VERCEL) {
  bootstrapSessions();
  bootstrapWhatsAppScheduler();
  app.listen(port, () => {
    console.log(`Servidor em http://localhost:${port}`);
  });
}

module.exports = app;

