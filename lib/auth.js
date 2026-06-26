// Cookies + leitura de sessão + middlewares de autenticação.
// Extraído do server.js (refatoração fase 2c).
// Depende de lib/sessions para os stores em memória.

const { adminSessions, operadorSessions, clientPortalSessions } = require("./sessions");

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
  const host = req ? String(req.headers.host || "") : "";
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const isHttps = forwardedProto === "https" || process.env.FORCE_HTTPS_COOKIES === "true";
  const secure =
    isHttps ||
    ((process.env.NODE_ENV === "production" || isCrossOrigin) && !isLocalHost);
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

module.exports = {
  parseCookies,
  setCookie,
  cookieOptionsForRequest,
  clearCookie,
  getAdminSession,
  getOperadorSession,
  getClientPortalSession,
  requireAdmin,
  requireClientPortal,
};
