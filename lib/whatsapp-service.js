const DEFAULT_ZAPI_BASE_URL = "https://api.z-api.io";

function getWhatsAppConfig() {
  return {
    enabled: String(process.env.WHATSAPP_ENABLED || "").trim().toLowerCase() === "true",
    baseUrl: String(process.env.ZAPI_BASE_URL || DEFAULT_ZAPI_BASE_URL).trim().replace(/\/+$/, ""),
    instanceId: String(process.env.ZAPI_INSTANCE_ID || "").trim(),
    token: String(process.env.ZAPI_TOKEN || "").trim(),
    clientToken: String(process.env.ZAPI_CLIENT_TOKEN || "").trim(),
    timeoutMs: Math.max(1000, Number(process.env.ZAPI_TIMEOUT_MS || 15000) || 15000),
  };
}

function normalizeBrazilPhone(value) {
  let digits = String(value || "").replace(/\D+/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  if (!digits.startsWith("55")) return null;
  if (digits.length < 12 || digits.length > 13) return null;

  return digits;
}

function isWhatsAppConfigured(config = getWhatsAppConfig()) {
  return Boolean(config.baseUrl && config.instanceId && config.token);
}

function isWhatsAppEnabled(config = getWhatsAppConfig()) {
  return config.enabled && isWhatsAppConfigured(config);
}

function buildInstanceUrl(config, path) {
  return `${config.baseUrl}/instances/${encodeURIComponent(config.instanceId)}/token/${encodeURIComponent(config.token)}/${path.replace(/^\/+/, "")}`;
}

async function zapiRequest(path, options = {}) {
  const config = getWhatsAppConfig();
  if (!isWhatsAppConfigured(config)) {
    throw new Error("Integracao WhatsApp/Z-API nao configurada.");
  }

  const response = await fetch(buildInstanceUrl(config, path), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(config.clientToken ? { "Client-Token": config.clientToken } : {}),
      ...(options.headers || {}),
    },
    body: options.body == null ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    const messageText =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      (response.status === 400 && !config.clientToken ? "Z-API retornou 400. Confira se o Client-Token/Token de Seguranca da instancia precisa ser preenchido." : "") ||
      response.statusText ||
      "Falha ao consultar a Z-API.";
    const error = new Error(String(messageText));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function normalizeQrCodeImagePayload(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const value = payload.value || payload.image || payload.qrCode || payload.qrcode || payload.base64 || payload.data;
  return typeof value === "string" ? value : "";
}

function normalizeConnectionStatusPayload(payload) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const text = JSON.stringify(raw).toLowerCase();
  const connected =
    raw.connected === true ||
    raw.isConnected === true ||
    raw.connected === "true" ||
    raw.isConnected === "true" ||
    raw.status === "connected" ||
    raw.status === "CONNECTED" ||
    raw.status === "open" ||
    raw.instanceStatus === "connected" ||
    raw.session === "connected";
  const disconnected =
    raw.connected === false ||
    raw.isConnected === false ||
    raw.connected === "false" ||
    raw.isConnected === "false" ||
    raw.status === "disconnected" ||
    raw.status === "DISCONNECTED" ||
    raw.status === "closed" ||
    text.includes("disconnected") ||
    text.includes("not connected");

  return {
    connected: connected ? true : disconnected ? false : null,
    status: String(raw.status || raw.instanceStatus || raw.session || (connected ? "connected" : disconnected ? "disconnected" : "unknown")),
    raw,
  };
}

async function getQrCodeImage() {
  const payload = await zapiRequest("qr-code/image");
  return {
    image: normalizeQrCodeImagePayload(payload),
    raw: payload,
  };
}

async function getConnectionStatus() {
  const attempts = ["status", "connection", "me"];
  let lastError = null;

  for (const path of attempts) {
    try {
      const payload = await zapiRequest(path);
      return {
        ...normalizeConnectionStatusPayload(payload),
        endpoint: path,
      };
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 404) break;
    }
  }

  throw lastError || new Error("Nao foi possivel consultar o status da Z-API.");
}

async function sendText(to, message, context = {}) {
  const config = getWhatsAppConfig();
  if (!isWhatsAppEnabled(config)) {
    throw new Error("Integração WhatsApp/Z-API não configurada ou desativada.");
  }

  const phone = normalizeBrazilPhone(to);
  if (!phone) {
    throw new Error("Telefone inválido para envio no WhatsApp.");
  }

  const response = await fetch(
    buildInstanceUrl(config, "send-text"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(config.clientToken ? { "Client-Token": config.clientToken } : {}),
      },
      body: JSON.stringify({
        phone,
        message: String(message || ""),
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    }
  );

  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = rawText;
  }

  if (!response.ok) {
    const messageText =
      (payload && typeof payload === "object" && (payload.error || payload.message)) ||
      response.statusText ||
      "Falha ao enviar mensagem pela Z-API.";
    const error = new Error(String(messageText));
    error.status = response.status;
    error.payload = payload;
    error.context = context;
    throw error;
  }

  return {
    ok: true,
    phone,
    payload,
    providerMessageId:
      payload && typeof payload === "object"
        ? String(payload.zaapId || payload.messageId || payload.id || "")
        : "",
  };
}

module.exports = {
  DEFAULT_ZAPI_BASE_URL,
  getWhatsAppConfig,
  normalizeBrazilPhone,
  isWhatsAppConfigured,
  isWhatsAppEnabled,
  getConnectionStatus,
  getQrCodeImage,
  sendText,
};
