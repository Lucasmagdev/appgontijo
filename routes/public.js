// Rotas publicas de assinatura de diario (cliente assina via token, sem login).
// Extraido do server.js (refatoracao fase 3b).

const express = require("express");
const db = require("../lib/db");
const gontijoRoutes = require("../lib/gontijo-routes");
const {
  firstFilledText,
  safeParseJsonObject,
  formatSqlDateTime,
  isSignatureLinkExpired,
} = require("../lib/helpers");

const router = express.Router();

router.get("/diarios/signature/:token", async (req, res) => {
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
        signedAt: firstFilledText(link.signed_at, diary.data.assinado_em, requestMeta.signedAt),
        expiresAt: firstFilledText(link.expires_at, requestMeta.expiresAt),
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: "Erro interno.", details: error.message });
  }
});

router.post("/diarios/signature/:token", async (req, res) => {
  const nome = String(req.body?.nome || "").trim();
  const documento = String(req.body?.documento || "").trim();
  const assinatura = String(req.body?.assinatura || "").trim();

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
      await gontijoRoutes.tryAutoCobrarConferencia(conn, row.diary_id, obraId);
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

module.exports = router;
