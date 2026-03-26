const fs = require("fs");
const path = require("path");
const { isOfficialGoalItem } = require("./official-machine-catalog");

const FALLBACK_STORE_PATH = path.join(__dirname, "..", "data", "goal-targets.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseHeaders(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function getSupabaseTableUrl(query = "") {
  const base = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  return `${base}/rest/v1/daily_goal_targets${query}`;
}

async function supabaseRequest(query = "", options = {}) {
  const response = await fetch(getSupabaseTableUrl(query), {
    ...options,
    headers: getSupabaseHeaders(options.headers || {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || `Supabase error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function readFallbackStore() {
  ensureDir(FALLBACK_STORE_PATH);
  if (!fs.existsSync(FALLBACK_STORE_PATH)) {
    const seed = { items: [] };
    fs.writeFileSync(FALLBACK_STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }

  return JSON.parse(fs.readFileSync(FALLBACK_STORE_PATH, "utf8"));
}

function writeFallbackStore(store) {
  ensureDir(FALLBACK_STORE_PATH);
  fs.writeFileSync(FALLBACK_STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  return store;
}

function normalizeGoalItem(item) {
  return {
    id: item.id,
    date: String(item.date || ""),
    machine_name: String(item.machine_name || ""),
    equipment_label: String(item.equipment_label || item.machine_name || ""),
    imei: String(item.imei || ""),
    obra_code: String(item.obra_code || ""),
    source_image_id: String(item.source_image_id || ""),
    source_file_name: String(item.source_file_name || ""),
    meta_estacas_total: Number(item.meta_estacas_total || 0),
    meta_meq_total: Number(item.meta_meq_total || 0),
    meta_meq_informado: item.meta_meq_informado == null ? null : Number(item.meta_meq_informado),
    segments: Array.isArray(item.segments) ? item.segments : [],
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    errors: Array.isArray(item.errors) ? item.errors : [],
    status: String(item.status || "confirmed"),
    confirmed_by: String(item.confirmed_by || "admin"),
    created_at: item.created_at || nowIso(),
    updated_at: item.updated_at || nowIso(),
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (String(b.date || "") !== String(a.date || "")) {
      return String(b.date || "").localeCompare(String(a.date || ""));
    }
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  });
}

function isDisplayableGoalItem(item) {
  return item.status === "archived" || isOfficialGoalItem(item);
}

async function listGoals({ includeArchived = false, limit = 100, dateFrom = "", dateTo = "" } = {}) {
  if (hasSupabaseConfig()) {
    const filters = ["select=*"];
    if (!includeArchived) {
      filters.push("status=neq.archived");
    }
    if (dateFrom) {
      filters.push(`date=gte.${encodeURIComponent(String(dateFrom))}`);
    }
    if (dateTo) {
      filters.push(`date=lte.${encodeURIComponent(String(dateTo))}`);
    }
    filters.push("order=date.desc,updated_at.desc");
    filters.push(`limit=${Number(limit) || 100}`);
    const items = await supabaseRequest(`?${filters.join("&")}`, { method: "GET" });
    return items
      .map(normalizeGoalItem)
      .filter((item) => isDisplayableGoalItem(item));
  }

  const store = readFallbackStore();
  return sortItems(
    store.items
      .map(normalizeGoalItem)
      .filter((item) => includeArchived || item.status !== "archived")
      .filter((item) => !dateFrom || String(item.date || "") >= String(dateFrom))
      .filter((item) => !dateTo || String(item.date || "") <= String(dateTo))
      .filter((item) => isDisplayableGoalItem(item))
  ).slice(0, Number(limit) || 100);
}

async function saveConfirmedGoals(items, meta = {}) {
  const normalizedItems = items.map((item) =>
    normalizeGoalItem({
      ...item,
      status: "confirmed",
      confirmed_by: meta.confirmedBy || "admin",
      updated_at: nowIso(),
      created_at: item.created_at || nowIso(),
    })
  );

  const invalidItems = normalizedItems.filter((item) => !isOfficialGoalItem(item));
  if (invalidItems.length) {
    throw new Error("Existem metas sem maquina oficial ou IMEI valido.");
  }

  if (hasSupabaseConfig()) {
    const saved = [];

    for (const item of normalizedItems) {
      const query = `?date=eq.${encodeURIComponent(item.date)}&machine_name=eq.${encodeURIComponent(item.machine_name)}&obra_code=eq.${encodeURIComponent(item.obra_code)}`;
      const existing = await supabaseRequest(query, { method: "GET" });
      const payload = {
        date: item.date,
        machine_name: item.machine_name,
        equipment_label: item.equipment_label,
        imei: item.imei || null,
        obra_code: item.obra_code,
        source_image_id: item.source_image_id,
        source_file_name: item.source_file_name,
        meta_estacas_total: item.meta_estacas_total,
        meta_meq_total: item.meta_meq_total,
        meta_meq_informado: item.meta_meq_informado,
        segments: item.segments,
        warnings: item.warnings,
        errors: item.errors,
        status: item.status,
        confirmed_by: item.confirmed_by,
        updated_at: item.updated_at,
      };

      if (existing?.[0]?.id) {
        const result = await supabaseRequest(`?id=eq.${encodeURIComponent(existing[0].id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        saved.push(normalizeGoalItem(result?.[0] || { ...payload, id: existing[0].id }));
      } else {
        const result = await supabaseRequest("", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            ...payload,
            created_at: item.created_at,
          }),
        });
        saved.push(normalizeGoalItem(result?.[0] || payload));
      }
    }

    return saved;
  }

  const store = readFallbackStore();

  for (const item of normalizedItems) {
    const existingIndex = store.items.findIndex(
      (current) =>
        String(current.date || "") === item.date &&
        String(current.machine_name || "") === item.machine_name &&
        String(current.obra_code || "") === item.obra_code
    );

    if (existingIndex >= 0) {
      store.items[existingIndex] = {
        ...store.items[existingIndex],
        ...item,
        id: store.items[existingIndex].id,
      };
    } else {
      store.items.push({
        ...item,
        id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    }
  }

  writeFallbackStore(store);

  return normalizedItems.map((item) =>
    normalizeGoalItem(
      store.items.find(
        (current) =>
          String(current.date || "") === item.date &&
          String(current.machine_name || "") === item.machine_name &&
          String(current.obra_code || "") === item.obra_code
      )
    )
  );
}

function getMode() {
  return hasSupabaseConfig() ? "supabase" : "local";
}

async function archiveInvalidGoals() {
  if (hasSupabaseConfig()) {
    const items = await supabaseRequest("?select=*&status=neq.archived&limit=5000", { method: "GET" });
    const invalidItems = items.map(normalizeGoalItem).filter((item) => !isOfficialGoalItem(item));

    for (const item of invalidItems) {
      await supabaseRequest(`?id=eq.${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "archived",
          updated_at: nowIso(),
        }),
      });
    }

    return invalidItems.length;
  }

  const store = readFallbackStore();
  let archivedCount = 0;
  store.items = store.items.map((item) => {
    const normalizedItem = normalizeGoalItem(item);
    if (normalizedItem.status !== "archived" && !isOfficialGoalItem(normalizedItem)) {
      archivedCount += 1;
      return {
        ...item,
        status: "archived",
        updated_at: nowIso(),
      };
    }
    return item;
  });
  writeFallbackStore(store);
  return archivedCount;
}

module.exports = {
  archiveInvalidGoals,
  getMode,
  listGoals,
  saveConfirmedGoals,
};
