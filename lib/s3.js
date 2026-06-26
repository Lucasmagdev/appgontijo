// Helpers de S3 / estacas (cliente, prefixo, parsing de chave). Puros / config.
// Extraído do server.js (refatoração fase 3 — foundation de S3).
// O agregador buildOperationalSummaries (grande) segue no server.js por enquanto.

const { S3Client } = require("@aws-sdk/client-s3");

const requiredEnv = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET"];

function missingEnvVars() {
  return requiredEnv.filter((name) => !process.env[name]);
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

module.exports = {
  missingEnvVars,
  buildS3Client,
  getClientLogin,
  buildPrefix,
  parseEstacaKey,
};
