// Utilitários de data (puros, sem db/I-O). Extraído do server.js (refatoração fase 2b).
// Trabalham com datas em UTC e strings YYYY-MM-DD para evitar bug de fuso.

function formatUtcDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getCurrentDateString(timeZone = process.env.APP_TIMEZONE || "America/Sao_Paulo") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
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

function shiftDate(dateText, days) {
  const date = parseDateString(dateText);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDate(date);
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

function weekdayForSolides(dateText) {
  const date = parseDateString(dateText);
  const day = date.getUTCDay();
  return day === 0 ? 1 : day + 1;
}

function getWeekStartFromDate(dateText) {
  const date = parseDateString(dateText);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return formatUtcDate(date);
}

function buildWeekDates(weekStart) {
  const start = parseDateString(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);
    return formatUtcDate(current);
  });
}

module.exports = {
  formatUtcDate,
  parseDateString,
  normalizeDateOnly,
  getCurrentDateString,
  parseBrDateTime,
  shiftDate,
  shiftDateWithTz,
  daysBetweenInclusive,
  weekdayForSolides,
  getWeekStartFromDate,
  buildWeekDates,
};
