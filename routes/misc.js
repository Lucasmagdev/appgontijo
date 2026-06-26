// Rotas utilitarias: health (S3), clientlog (telemetria), display/config (TV).
// Extraido do server.js (refatoracao fase 3a).

const express = require("express");
const { HeadBucketCommand } = require("@aws-sdk/client-s3");
const { missingEnvVars, buildS3Client } = require("../lib/s3");

const router = express.Router();

// Telemetria de boot do cliente (enviada via sendBeacon como text/plain pela
// rede de seguranca no index.html). Sem auth, so loga pro pm2 pra diagnostico
// de "tela branca / abre e fecha" em dispositivos que nao conseguimos reproduzir.
router.post("/clientlog", express.text({ type: "*/*", limit: "16kb" }), (req, res) => {
  try {
    let data = req.body;
    if (typeof data === "string" && data) {
      try { data = JSON.parse(data); } catch { /* mantem string */ }
    }
    const d = data && typeof data === "object" ? data : { raw: String(data || "") };
    console.warn(
      `[CLIENTLOG] ${d.kind || "?"} | ${d.message || ""} | extra=${d.extra || ""} | url=${d.url || ""} | ua=${d.ua || ""} | ts=${d.ts || ""}`
    );
  } catch (error) {
    console.warn("[CLIENTLOG] falha ao processar:", error.message);
  }
  res.status(204).end();
});

router.get("/display/config", (req, res) => {
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

router.get("/health", async (_req, res) => {
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

module.exports = router;
