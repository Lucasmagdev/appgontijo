const fs = require("fs");
const path = require("path");
const defaultMachines = require("./default-machines");

const FALLBACK_STORE_PATH = path.join(__dirname, "..", "data", "admin-mappings.json");

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function buildSeedMappings() {
  const now = nowIso();
  return defaultMachines.map((machine, index) => ({
    id: `local-${index + 1}`,
    imei: machine.imei,
    machine_name: machine.machine_name,
    obra_code: "",
    obra_name: "",
    daily_goal_estacas: 0,
    weekly_goal_estacas: 0,
    active: true,
    starts_at: now,
    ends_at: null,
    created_at: now,
    updated_at: now,
  }));
}

async function seedSupabaseIfEmpty() {
  const seed = buildSeedMappings();
  const created = await supabaseRequest("", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(seed.map(({ id, ...item }) => item)),
  });
  return created.map(normalizeLegacyMapping);
}

function readFallbackStore() {
  ensureDir(FALLBACK_STORE_PATH);
  if (!fs.existsSync(FALLBACK_STORE_PATH)) {
    const seed = { mappings: buildSeedMappings() };
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

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function normalizeLegacyMapping(item) {
  if (String(item.obra_name || "").trim() === "Obra nao definida") {
    return {
      ...item,
      obra_name: "",
    };
  }
  return item;
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
  return `${base}/rest/v1/machine_mappings${query}`;
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

function sortMappings(items) {
  return [...items].sort((a, b) => {
    if (Number(Boolean(b.active)) !== Number(Boolean(a.active))) {
      return Number(Boolean(b.active)) - Number(Boolean(a.active));
    }
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  });
}

async function listMappings({ includeInactive = true } = {}) {
  if (hasSupabaseConfig()) {
    const filters = ["select=*"];
    if (!includeInactive) {
      filters.push("active=eq.true");
    }
    filters.push("order=active.desc,updated_at.desc");
    const query = `?${filters.join("&")}`;
    const items = await supabaseRequest(query, { method: "GET" });
    if (!items.length) {
      return seedSupabaseIfEmpty();
    }
    return items.map(normalizeLegacyMapping);
  }

  const store = readFallbackStore();
  return sortMappings(
    store.mappings.map(normalizeLegacyMapping).filter((item) => includeInactive || item.active)
  );
}

async function getMappingById(id) {
  const items = await listMappings({ includeInactive: true });
  return items.find((item) => String(item.id) === String(id)) || null;
}

async function listActiveMappings() {
  return listMappings({ includeInactive: false });
}

async function listMachines() {
  const mappings = await listMappings({ includeInactive: true });
  const grouped = new Map();

  for (const mapping of mappings) {
    const current = grouped.get(mapping.imei) || {
      imei: mapping.imei,
      machine_name: mapping.machine_name,
      active_mapping: null,
      history_count: 0,
      updated_at: mapping.updated_at,
    };
    current.history_count += 1;
    current.updated_at =
      String(mapping.updated_at || "") > String(current.updated_at || "")
        ? mapping.updated_at
        : current.updated_at;
    if (mapping.active && !current.active_mapping) {
      current.active_mapping = mapping;
      current.machine_name = mapping.machine_name;
    }
    grouped.set(mapping.imei, current);
  }

  for (const machine of defaultMachines) {
    if (!grouped.has(machine.imei)) {
      grouped.set(machine.imei, {
        imei: machine.imei,
        machine_name: machine.machine_name,
        active_mapping: null,
        history_count: 0,
        updated_at: null,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.machine_name.localeCompare(b.machine_name));
}

async function createMapping(input) {
  const payload = {
    imei: String(input.imei || "").trim(),
    machine_name: String(input.machine_name || "").trim(),
    obra_code: String(input.obra_code || "").trim(),
    obra_name: String(input.obra_name || "").trim(),
    daily_goal_estacas: Number(input.daily_goal_estacas || 0),
    weekly_goal_estacas: Number(input.weekly_goal_estacas || 0),
    active: Boolean(input.active),
    starts_at: input.starts_at || nowIso(),
    ends_at: input.active ? null : input.ends_at || null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (hasSupabaseConfig()) {
    const created = await supabaseRequest("", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return created?.[0] || null;
  }

  const store = readFallbackStore();
  const created = {
    ...payload,
    id: `local-${Date.now()}`,
  };
  store.mappings.push(created);
  writeFallbackStore(store);
  return created;
}

async function updateMapping(id, updates) {
  const payload = {
    imei: String(updates.imei || "").trim(),
    machine_name: String(updates.machine_name || "").trim(),
    obra_code: String(updates.obra_code || "").trim(),
    obra_name: String(updates.obra_name || "").trim(),
    daily_goal_estacas: Number(updates.daily_goal_estacas || 0),
    weekly_goal_estacas: Number(updates.weekly_goal_estacas || 0),
    updated_at: nowIso(),
  };

  if (hasSupabaseConfig()) {
    const result = await supabaseRequest(`?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return result?.[0] || null;
  }

  const store = readFallbackStore();
  const index = store.mappings.findIndex((item) => String(item.id) === String(id));
  if (index === -1) {
    throw new Error("Mapping not found");
  }
  store.mappings[index] = {
    ...store.mappings[index],
    ...payload,
  };
  writeFallbackStore(store);
  return store.mappings[index];
}

async function activateMapping(id) {
  const current = await getMappingById(id);
  if (!current) {
    throw new Error("Mapping not found");
  }

  const now = nowIso();

  if (hasSupabaseConfig()) {
    await supabaseRequest(
      `?imei=eq.${encodeURIComponent(current.imei)}&active=eq.true&id=neq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          active: false,
          ends_at: now,
          updated_at: now,
        }),
      }
    );

    const result = await supabaseRequest(`?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        active: true,
        ends_at: null,
        starts_at: current.starts_at || now,
        updated_at: now,
      }),
    });
    return result?.[0] || null;
  }

  const store = readFallbackStore();
  store.mappings = store.mappings.map((item) => {
    if (item.imei === current.imei && item.active && String(item.id) !== String(id)) {
      return {
        ...item,
        active: false,
        ends_at: now,
        updated_at: now,
      };
    }
    if (String(item.id) === String(id)) {
      return {
        ...item,
        active: true,
        ends_at: null,
        updated_at: now,
      };
    }
    return item;
  });
  writeFallbackStore(store);
  return store.mappings.find((item) => String(item.id) === String(id)) || null;
}

async function archiveMapping(id) {
  const current = await getMappingById(id);
  if (!current) {
    throw new Error("Mapping not found");
  }

  const payload = {
    active: false,
    ends_at: nowIso(),
    updated_at: nowIso(),
  };

  if (hasSupabaseConfig()) {
    const result = await supabaseRequest(`?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return result?.[0] || null;
  }

  const store = readFallbackStore();
  const index = store.mappings.findIndex((item) => String(item.id) === String(id));
  if (index === -1) {
    throw new Error("Mapping not found");
  }
  store.mappings[index] = {
    ...store.mappings[index],
    ...payload,
  };
  writeFallbackStore(store);
  return store.mappings[index];
}

function getMode() {
  return hasSupabaseConfig() ? "supabase" : "local";
}

module.exports = {
  getMode,
  listMappings,
  listActiveMappings,
  listMachines,
  getMappingById,
  createMapping,
  updateMapping,
  activateMapping,
  archiveMapping,
};
