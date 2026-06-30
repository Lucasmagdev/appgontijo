// Rotas de dashboard (daily / weekly / secondary). Extraido do server.js (fase 3c).
// A rota POST /api/dashboard/weekly (custom com filtros) segue no server.js por ora.

const express = require("express");
const adminStore = require("../lib/admin-store");
const goalTargetStore = require("../lib/goal-target-store");
const { missingEnvVars, buildS3Client, getClientLogin, buildPrefix } = require("../lib/s3");
const { getCurrentDateString, getWeekStartFromDate, buildWeekDates } = require("../lib/dates");
const { buildOperationalSummaries } = require("../lib/estacas");
const {
  buildDailyDashboard,
  buildWeeklyDashboard,
  buildSecondaryDashboard,
} = require("../lib/dashboard-service");

const router = express.Router();

router.get("/daily", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await goalTargetStore.ensureSanitized();
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

router.get("/weekly", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await goalTargetStore.ensureSanitized();
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

router.get("/secondary", async (req, res) => {
  const missing = missingEnvVars();
  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      message: "Variaveis de ambiente obrigatorias ausentes.",
      missing,
    });
  }

  try {
    await goalTargetStore.ensureSanitized();
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

module.exports = router;
