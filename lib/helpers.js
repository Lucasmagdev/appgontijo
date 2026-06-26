// Utilitários puros (sem estado, sem db, sem I/O) usados pelo server.js e módulos.
// Extraído do server.js (refatoração — fase 2, fundação lib/).

function sum(values) {
  return values.filter((value) => Number.isFinite(value)).reduce((total, value) => total + value, 0);
}

function formatDecimalNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "-";
  return Number(value).toFixed(digits).replace(".", ",");
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

function textOrNull(value) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function parsePositiveInteger(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function firstFilledText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text && text !== "null" && text !== "undefined") return text;
  }
  return "";
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

function formatSqlDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isSignatureLinkExpired(link) {
  if (!link?.expires_at) return false;
  return new Date(link.expires_at).getTime() <= Date.now();
}

module.exports = {
  sum,
  formatDecimalNumber,
  normalizeDigits,
  parseBooleanFlag,
  clampNumber,
  textOrNull,
  parsePositiveInteger,
  firstFilledText,
  safeParseJsonObject,
  formatSqlDateTime,
  isSignatureLinkExpired,
};
