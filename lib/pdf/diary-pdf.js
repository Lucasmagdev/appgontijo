// Geração do PDF do Diário de Obra.
// Extraído do server.js (refatoração modularização — fase 1).
// Comportamento idêntico ao original; só mudou de lugar.

const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const { sum, formatDecimalNumber } = require("../helpers");

function ensurePdfSpace(doc, needed = 28) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function formatDateBr(dateText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(dateText || "");
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatClockFromHeader(text) {
  const match = String(text || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  if (!match) return "";
  return `${match[4]}:${match[5]}`;
}

function buildDiaryContext({ clientLogin, imei, date, items, machineName }) {
  const sortedByTime = [...items].sort((a, b) =>
    String(a.finishedAt || "").localeCompare(String(b.finishedAt || ""))
  );
  const firstItem = sortedByTime[0] || {};
  const lastItem = sortedByTime[sortedByTime.length - 1] || {};
  const totalMeters = sum(items.map((item) => item.realizadoM || 0));
  const totalArmacao = 0;
  const diameters = [...new Set(items.map((item) => item.diametroCm).filter(Number.isFinite))];

  const headerStart = items
    .map((item) => formatClockFromHeader(item.inicioPerfuracao))
    .filter(Boolean)
    .sort()[0] || "";
  const headerEnd = items
    .map((item) => formatClockFromHeader(item.fimConcretagem))
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || "";

  return {
    obraNumber: String(firstItem.obra || "").trim() || "N/A",
    clientName: process.env.DIARY_CLIENT_NAME || String(firstItem.contrato || clientLogin || "").trim() || "N/A",
    machineName: machineName || process.env.DIARY_MACHINE_NAME || imei,
    dateBr: formatDateBr(date),
    address: process.env.DIARY_ADDRESS || "N/A",
    team: process.env.DIARY_TEAM || "N/A",
    weather: {
      ensolarado: process.env.DIARY_WEATHER === "ensolarado",
      nublado: process.env.DIARY_WEATHER === "nublado",
      chuvaFraca: process.env.DIARY_WEATHER === "chuva_fraca",
      chuvaForte: process.env.DIARY_WEATHER === "chuva_forte",
    },
    startTime: headerStart || firstItem.finishedAt || "N/A",
    endTime: headerEnd || lastItem.finishedAt || "N/A",
    totalMeters,
    totalArmacao,
    totalCount: items.length,
    diameters,
    planningRows: diameters.slice(0, 2).map((diameter) => ({
      piles: process.env.DIARY_NEXT_DAY_PILES_PER_ROW || "2",
      diameter: String(Math.round(diameter)),
    })),
  };
}

function drawBox(doc, x, y, w, h, options = {}) {
  const fill = options.fill || null;
  const stroke = options.stroke || "#9f988c";
  if (fill) {
    doc.save();
    doc.fillColor(fill).rect(x, y, w, h).fill();
    doc.restore();
  }
  doc.save();
  doc.lineWidth(options.lineWidth || 1).strokeColor(stroke).rect(x, y, w, h).stroke();
  doc.restore();
}

function drawText(doc, text, x, y, w, options = {}) {
  doc
    .font(options.font || "Helvetica")
    .fontSize(options.size || 9)
    .fillColor(options.color || "#111111")
    .text(String(text ?? ""), x, y, {
      width: w,
      align: options.align || "left",
      continued: false,
    });
}

function drawLine(doc, x1, y1, x2, y2, color = "#9f988c") {
  doc.save();
  doc.strokeColor(color).lineWidth(1).moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.restore();
}

function drawGontijoDiaryLogo(doc, x, y, options = {}) {
  // __dirname aqui = lib/pdf, então sobe 2 níveis até a raiz do projeto.
  const logoPath = path.join(__dirname, "..", "..", "public", "gontijo-logo-diarios.png");
  const width = options.width || 92;
  const height = options.height || 32;

  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, x, y, { fit: [width, height], align: "left", valign: "center" });
      return;
    } catch {
      // Mantem o PDF gerando mesmo se a imagem falhar.
    }
  }

  drawText(doc, "GONTIJO", x, y + 1, width - 10, {
    font: "Helvetica-Bold",
    size: 14,
  });
  drawText(doc, "FUNDAÇÕES", x + 4, y + 21, width - 14, {
    size: 7.5,
    color: "#666666",
  });
}

function buildDiaryPdf({ clientLogin, imei, date, items, prefix, machineName }) {
  const doc = new PDFDocument({ size: "A4", margin: 26 });
  const chunks = [];
  const ctx = buildDiaryContext({ clientLogin, imei, date, items, machineName });

  doc.on("data", (chunk) => chunks.push(chunk));

  const left = 42;
  const top = 52;
  const pageWidth = doc.page.width - left * 2;
  const gray = "#d7d3ce";
  const dark = "#151515";
  const border = "#9e9a94";
  drawBox(doc, left, top, pageWidth, 28, { fill: gray, stroke: border });
  drawText(doc, "GONTIJO", left + 6, top + 4, 78, {
    font: "Helvetica-Bold",
    size: 12,
  });
  drawText(doc, "FUNDACOES", left + 10, top + 16, 72, {
    size: 7.5,
    color: "#666666",
  });
  doc.save();
  doc.fillColor(gray).rect(left + 5, top + 4, 94, 21).fill();
  doc.restore();
  drawGontijoDiaryLogo(doc, left + 6, top + 4, { width: 92, height: 20 });

  drawText(doc, "DIARIO DE OBRA", left + 120, top + 8, 250, {
    font: "Helvetica-Bold",
    size: 13,
    align: "center",
  });
  drawText(doc, `N° DA OBRA: ${ctx.obraNumber}`, left + 380, top + 8, 130, {
    font: "Helvetica-Bold",
    size: 9,
    align: "right",
  });

  const row1Y = top + 28;
  drawBox(doc, left, row1Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row1Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row1Y, 108, 30, { stroke: border });
  drawText(doc, "Cliente:", left + 6, row1Y + 10, 40, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.clientName, left + 44, row1Y + 10, 268, { size: 7 });
  drawText(doc, "Equipamento", left + 322 + 6, row1Y + 10, 60, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, "Data:", left + 396 + 6, row1Y + 10, 26, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.dateBr, left + 396 + 60, row1Y + 10, 40, { size: 7, align: "right" });

  const row2Y = row1Y + 30;
  drawBox(doc, left, row2Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row2Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row2Y, 108, 30, { stroke: border });
  drawText(doc, "Endereco:", left + 6, row2Y + 9, 42, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.address, left + 50, row2Y + 9, 262, { size: 6.6 });
  drawText(doc, ctx.machineName, left + 322, row2Y + 9, 74, { font: "Helvetica-Bold", size: 10, align: "center" });
  drawText(doc, "Horario inicio:", left + 396 + 6, row2Y + 7, 52, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.startTime, left + 396 + 70, row2Y + 7, 28, { size: 7, align: "right" });

  const row3Y = row2Y + 30;
  drawBox(doc, left, row3Y, 322, 30, { stroke: border });
  drawBox(doc, left + 322, row3Y, 74, 30, { stroke: border });
  drawBox(doc, left + 396, row3Y, 108, 30, { stroke: border });
  drawText(doc, "Equipe:", left + 6, row3Y + 8, 34, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.team, left + 38, row3Y + 8, 274, { size: 6.2 });
  drawText(doc, "Horario termino:", left + 396 + 6, row3Y + 7, 58, { font: "Helvetica-Bold", size: 6.8 });
  drawText(doc, ctx.endTime, left + 396 + 70, row3Y + 7, 28, { size: 7, align: "right" });

  const weatherY = row3Y + 38;
  drawText(doc, "Ensolarado:", left, weatherY, 70, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.ensolarado ? "X" : "_____", left + 42, weatherY, 34, { size: 7 });
  drawText(doc, "Nublado:", left + 130, weatherY, 52, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.nublado ? "X" : "_____", left + 165, weatherY, 34, { size: 7 });
  drawText(doc, "Chuva fraca:", left + 255, weatherY, 62, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.chuvaFraca ? "X" : "_____", left + 306, weatherY, 34, { size: 7 });
  drawText(doc, "Chuva forte:", left + 378, weatherY, 62, { font: "Helvetica-Bold", size: 7 });
  drawText(doc, ctx.weather.chuvaForte ? "X" : "_____", left + 428, weatherY, 34, { size: 7 });

  let y = weatherY + 18;
  drawBox(doc, left, y, pageWidth, 22, { fill: gray, stroke: border });
  drawText(doc, "Servicos Executados", left, y + 7, pageWidth, {
    font: "Helvetica-Bold",
    size: 8,
    align: "center",
  });
  y += 22;

  const serviceCols = [left, left + 118, left + 206, left + 316, left + 413, left + 504];
  drawBox(doc, left, y, pageWidth, 22, { stroke: border });
  ["Pilar/Estaca", "Diametro (cm)", "Realizado (m)", "Bits", "Armacao (m)"].forEach((label, index) => {
    if (index > 0) {
      drawLine(doc, serviceCols[index], y, serviceCols[index], y + 22, border);
    }
    drawText(doc, label, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
      font: "Helvetica",
      size: 6.5,
      align: "center",
    });
  });
  y += 22;

  const rowHeight = 22;
  items.forEach((item) => {
    drawBox(doc, left, y, pageWidth, rowHeight, { stroke: border });
    for (let i = 1; i < serviceCols.length - 1; i += 1) {
      drawLine(doc, serviceCols[i], y, serviceCols[i], y + rowHeight, border);
    }
    const values = [
      String(item.estaca || "").trim(),
      item.diametroCm != null ? String(Math.round(item.diametroCm)).replace(".", ",") : "-",
      item.realizadoM != null ? formatDecimalNumber(item.realizadoM, 2) : "-",
      "Nao",
      "0,00",
    ];
    values.forEach((value, index) => {
      drawText(doc, value, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
        size: 7.5,
        align: "center",
      });
    });
    y += rowHeight;
  });

  drawBox(doc, left, y, pageWidth, rowHeight, { stroke: border });
  for (let i = 1; i < serviceCols.length - 1; i += 1) {
    drawLine(doc, serviceCols[i], y, serviceCols[i], y + rowHeight, border);
  }
  [
    `${ctx.totalCount} estacas`,
    "-",
    formatDecimalNumber(ctx.totalMeters, 2),
    "-",
    formatDecimalNumber(ctx.totalArmacao, 2),
  ].forEach((value, index) => {
    drawText(doc, value, serviceCols[index], y + 7, serviceCols[index + 1] - serviceCols[index], {
      font: "Helvetica-Bold",
      size: 7.5,
      align: "center",
    });
  });

  // Secao OCORRENCIAS (observacao do cliente) removida a pedido - 2026-06-26.
  y += 30;
  const fuelHeaderY = y;
  drawBox(doc, left, fuelHeaderY, pageWidth, 24, { fill: gray, stroke: border });
  drawText(doc, "ABASTECIMENTO", left, fuelHeaderY + 8, pageWidth, {
    font: "Helvetica-Bold",
    size: 8,
    align: "center",
  });

  const blockY = fuelHeaderY + 24;
  const leftBlockW = 223;
  const centerBlockW = 175;
  const rightBlockW = pageWidth - leftBlockW - centerBlockW;

  drawBox(doc, left, blockY, leftBlockW, 116, { stroke: border });
  drawBox(doc, left + leftBlockW, blockY, centerBlockW, 116, { stroke: border });
  drawBox(doc, left + leftBlockW + centerBlockW, blockY, rightBlockW, 116, { stroke: border });

  drawLine(doc, left + 76, blockY, left + 76, blockY + 116, border);
  drawLine(doc, left + 150, blockY, left + 150, blockY + 116, border);
  drawLine(doc, left + 150, blockY + 29, left + leftBlockW, blockY + 29, border);
  drawLine(doc, left + 76, blockY + 58, left + leftBlockW, blockY + 58, border);
  drawLine(doc, left + 150, blockY + 87, left + leftBlockW, blockY + 87, border);

  drawText(doc, "Preencher na data da", left + 6, blockY + 16, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "mobilizacao", left + 6, blockY + 24, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "(Antes da montagem)", left + 6, blockY + 39, 64, { font: "Helvetica-Bold", size: 5.8, align: "center" });
  drawText(doc, "Preencher ao final do dia", left + 6, blockY + 77, 64, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "(Todos os dias)", left + 6, blockY + 92, 64, { font: "Helvetica-Bold", size: 5.8, align: "center" });

  drawText(doc, "Litros de diesel no", left + 83, blockY + 9, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "tanque", left + 83, blockY + 17, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_TANQUE_INICIAL || "N/A", left + 156, blockY + 12, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 38, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "galao", left + 83, blockY + 46, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_GALAO_INICIAL || "N/A", left + 156, blockY + 41, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 67, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "tanque", left + 83, blockY + 75, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_TANQUE_FINAL || "N/A", left + 156, blockY + 70, 60, { size: 7, align: "center" });
  drawText(doc, "Litros de diesel no", left + 83, blockY + 96, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "galao", left + 83, blockY + 104, 62, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_GALAO_FINAL || "N/A", left + 156, blockY + 99, 60, { size: 7, align: "center" });

  drawBox(doc, left + leftBlockW, blockY, centerBlockW, 30, { fill: gray, stroke: border });
  drawText(doc, "PREENCHER AO FINAL DO DIA", left + leftBlockW, blockY + 10, centerBlockW, {
    font: "Helvetica-Bold",
    size: 7,
    align: "center",
  });
  drawBox(doc, left + leftBlockW, blockY + 30, centerBlockW, 28, { stroke: border });
  drawLine(doc, left + leftBlockW + 110, blockY + 30, left + leftBlockW + 110, blockY + 58, border);
  drawText(doc, "Horimetro", left + leftBlockW, blockY + 40, 110, { font: "Helvetica-Bold", size: 7, align: "center" });
  drawText(doc, process.env.DIARY_HORIMETRO || "N/A", left + leftBlockW + 110, blockY + 40, centerBlockW - 110, { size: 7, align: "center" });

  drawBox(doc, left + leftBlockW, blockY + 58, 92, 58, { stroke: border });
  drawBox(doc, left + leftBlockW + 92, blockY + 58, 83, 58, { stroke: border });
  drawText(doc, "Planejamento do dia seguinte", left + leftBlockW, blockY + 65, 175, {
    font: "Helvetica-Bold",
    size: 6.4,
    align: "center",
  });
  drawLine(doc, left + leftBlockW, blockY + 82, left + leftBlockW + 175, blockY + 82, border);
  drawText(doc, "Nº de estacas", left + leftBlockW, blockY + 87, 92, { font: "Helvetica-Bold", size: 6.3, align: "center" });
  drawText(doc, "Diametro (cm)", left + leftBlockW + 92, blockY + 87, 83, { font: "Helvetica-Bold", size: 6.3, align: "center" });
  drawText(doc, process.env.DIARY_NEXT_DAY_PILES || "N/A", left + leftBlockW, blockY + 100, 92, { size: 7, align: "center" });
  drawText(doc, process.env.DIARY_NEXT_DAY_DIAMETERS || ctx.diameters.map((value) => Math.round(value)).join(", ") || "N/A", left + leftBlockW + 92, blockY + 100, 83, { size: 7, align: "center" });

  drawText(doc, "Nº de estacas para termino da obra", left + leftBlockW + centerBlockW + 8, blockY + 30, rightBlockW - 16, {
    font: "Helvetica-Bold",
    size: 6.3,
    align: "center",
  });
  drawBox(doc, left + leftBlockW + centerBlockW + 8, blockY + 54, rightBlockW - 16, 50, { stroke: border });
  drawLine(doc, left + leftBlockW + centerBlockW + 66, blockY + 54, left + leftBlockW + centerBlockW + 66, blockY + 104, border);
  drawText(doc, "Nº de estacas", left + leftBlockW + centerBlockW + 8, blockY + 62, 58, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, "Diametro (cm)", left + leftBlockW + centerBlockW + 66, blockY + 62, rightBlockW - 74, { font: "Helvetica-Bold", size: 6.2, align: "center" });
  drawText(doc, process.env.DIARY_END_REMAINING_PILES || "N/A", left + leftBlockW + centerBlockW + 8, blockY + 81, 58, { size: 7, align: "center" });
  drawText(doc, process.env.DIARY_END_REMAINING_DIAMETERS || "N/A", left + leftBlockW + centerBlockW + 66, blockY + 81, rightBlockW - 74, { size: 7, align: "center" });

  const fuelMetaY = blockY + 128;
  drawText(doc, "Chegou diesel na obra?", left, fuelMetaY, 104, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, process.env.DIARY_CHEGOU_DIESEL || "sim", left + 88, fuelMetaY, 18, { size: 6.5, align: "center" });
  drawText(doc, "x NAO", left + 118, fuelMetaY, 34, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Fornecido por:", left, fuelMetaY + 20, 72, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, process.env.DIARY_FORNECEDOR_DIESEL || "N/A", left + 66, fuelMetaY + 20, 34, { size: 6.5, align: "center" });
  drawText(doc, "x Cliente", left + 118, fuelMetaY + 20, 42, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Quantos litros?", left, fuelMetaY + 42, 62, { font: "Helvetica-Bold", size: 6.5 });
  drawText(doc, "Horario de chegada", left + 90, fuelMetaY + 42, 80, { font: "Helvetica-Bold", size: 6.5 });
  drawBox(doc, left, fuelMetaY + 54, 118, 24, { stroke: border });
  drawBox(doc, left + 118, fuelMetaY + 54, 98, 24, { stroke: border });
  drawText(doc, process.env.DIARY_DIESEL_QUANTOS || "N/A", left, fuelMetaY + 62, 118, { size: 6.5, align: "center" });
  drawText(doc, process.env.DIARY_DIESEL_HORARIO || "N/A", left + 118, fuelMetaY + 62, 98, { size: 6.5, align: "center" });

  drawBox(doc, left + 228, fuelMetaY + 40, 160, 24, { fill: gray, stroke: border });
  drawText(doc, "Previsao de termino da obra", left + 228, fuelMetaY + 48, 160, {
    font: "Helvetica-Bold",
    size: 6.8,
    align: "center",
  });
  drawBox(doc, left + 388, fuelMetaY + 40, 116, 24, { stroke: border });
  drawText(doc, process.env.DIARY_END_FORECAST || "____/____/____", left + 388, fuelMetaY + 48, 116, {
    size: 7,
    align: "center",
  });

  doc.addPage();
  const p2Left = 42;
  drawText(doc, process.env.DIARY_SIGNATURE_MARK || "", p2Left + 8, 62, 120, {
    size: 8,
    color: "#777777",
  });
  drawLine(doc, p2Left, 92, p2Left + 175, 92, "#505050");
  drawText(doc, process.env.DIARY_COMPANY_SIGNATURE || "Gontijo Fundacoes", p2Left, 98, 175, {
    font: "Helvetica-Bold",
    size: 7,
  });
  drawText(doc, `Nome: ${process.env.DIARY_RESPONSIBLE_NAME || "________________________"}`, p2Left, 108, 190, {
    font: "Helvetica-Bold",
    size: 7,
  });
  drawText(doc, `Documento: ${process.env.DIARY_RESPONSIBLE_DOC || "________________"}`, p2Left, 118, 190, {
    font: "Helvetica-Bold",
    size: 7,
  });

  drawLine(doc, 438, 82, 558, 82, "#505050");
  drawText(doc, "Responsavel da obra", 448, 86, 110, {
    font: "Helvetica-Bold",
    size: 7,
    align: "center",
  });

  // Secao "OCORRENCIAS - FOTOS EM ANEXO" (anexo do cliente) removida a pedido - 2026-06-26.

  doc.end();

  return new Promise((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

module.exports = { buildDiaryPdf };
