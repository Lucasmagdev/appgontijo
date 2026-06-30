// Subsistema de processamento de estacas: S3 -> conversor externo (sacibin2txt)
// -> parsing -> sumarios operacionais. Extraido do server.js (refatoracao fase 3 - keystone).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { parseDiameterCm, getMeqFactor } = require("./meq");
const { sum } = require("./helpers");
const { parseEstacaKey } = require("./s3");
const { parseBrDateTime } = require("./dates");

function getConverterPath() {
  const toolName = process.platform === "win32" ? "sacibin2txt.exe" : "sacibin2txt";
  return path.join(__dirname, "..", "tools", toolName);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getCacheDir() {
  return path.join(__dirname, "..", ".cache", "estacas");
}

function getCacheFilePath(key) {
  const hash = crypto.createHash("sha1").update(key).digest("hex");
  return path.join(getCacheDir(), `${hash}.json`);
}

function readCachedDetail(key) {
  try {
    const filePath = getCacheFilePath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeCachedDetail(key, detail) {
  try {
    ensureDir(getCacheDir());
    fs.writeFileSync(getCacheFilePath(key), JSON.stringify(detail), "utf8");
  } catch {
  }
}

// parseDateString -> lib/dates.js

// normalizeDateOnly -> lib/dates.js

// formatUtcDate -> lib/dates.js

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function runConverter(inputBuffer) {
  return new Promise((resolve, reject) => {
    const converterPath = getConverterPath();

    if (!fs.existsSync(converterPath)) {
      reject(new Error(`Conversor nao encontrado em ${converterPath}`));
      return;
    }

    const child = spawn(converterPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Conversor retornou codigo ${code}: ${Buffer.concat(stderrChunks).toString("utf8")}`
          )
        );
        return;
      }

      resolve(Buffer.concat(stdoutChunks).toString("utf8"));
    });

    child.stdin.write(inputBuffer);
    child.stdin.end();
  });
}

function parseNumericLine(line) {
  return line
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

// sum -> lib/helpers.js

// parseBrDateTime -> lib/dates.js

function minutesBetween(startText, endText) {
  const start = parseBrDateTime(startText);
  const end = parseBrDateTime(endText);
  if (!start || !end) {
    return null;
  }
  return Math.max(0, (end.getTime() - start.getTime()) / 60000);
}

function parseInclination(text) {
  const parts = String(text || "")
    .split(",")
    .map((item) => Number(item.trim()));
  const x = parts[0];
  const y = parts[1];
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const xDeg = x / 10;
  const yDeg = y / 10;
  return {
    xDeg,
    yDeg,
    magnitudeDeg: Math.sqrt((xDeg ** 2) + (yDeg ** 2)),
  };
}

function decodeGps(latitudeRaw, longitudeRaw, altitudeRaw) {
  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const altitude = Number(altitudeRaw);

  if (!latitude || !longitude || !altitude) {
    return null;
  }

  const lat = (latitude - 2147483648) / 600000;
  const lon = (longitude - 2147483648) / 600000;
  const alt = altitude - 32768;

  if (lat >= 90 || lat <= -90 || lon >= 180 || lon <= -180) {
    return null;
  }

  return { lat, lon, alt };
}

function parseLine8Metadata(text) {
  const values = String(text || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item));

  if (!values.length) {
    return { pulsesPerRotation: null, gps: null, rawValues: [] };
  }

  let gps = null;
  if (values.length === 4) {
    gps = decodeGps(values[1], values[2], values[3]);
  } else if (values.length === 20) {
    gps = decodeGps(values[17], values[18], values[19]);
  }

  return {
    pulsesPerRotation: Number.isFinite(values[0]) ? values[0] : null,
    gps,
    rawValues: values,
  };
}

function convertPressureBar(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  return -3.32 + (28.32 * rawValue) / 256;
}

function convertTorqueBar(rawValue) {
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  return -53.1 + (453.1 * rawValue) / 256;
}

function classifyShift(timeText) {
  const match = String(timeText || "").match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) {
    return "indefinido";
  }
  const hour = Number(match[1]);
  if (hour >= 6 && hour < 14) return "manha";
  if (hour >= 14 && hour < 22) return "tarde";
  return "noite";
}

function calculateDepthAndPhases(sliceLines) {
  let drilling = 0;
  let concreting = 0;
  let drillingInProgress = true;
  let last = null;

  for (const tick of sliceLines) {
    const [current] = parseNumericLine(tick);

    if (Number.isNaN(current)) {
      continue;
    }

    if (drillingInProgress) {
      if (current === last) {
        drillingInProgress = false;
      } else {
        drilling += 1;
      }
    } else {
      concreting += 1;
    }

    last = current;
  }

  return {
    drillingSlices: drilling,
    concretingSlices: concreting,
    depthCm: Math.max(drilling, concreting) * 8,
  };
}

function parseConvertedText(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const meaningful = lines.filter((line) => line.trim().length > 0);

  if (meaningful.length < 12) {
    throw new Error("Saida do conversor invalida ou incompleta.");
  }

  const headerLines = meaningful.slice(0, 12);
  const sliceLines = meaningful.slice(12);
  const phaseSummary = calculateDepthAndPhases(sliceLines);

  const slices = sliceLines.map((line, index) => {
    const [timeTick, value2, value3] = parseNumericLine(line);
    return {
      index: index + 1,
      raw: line,
      timeTick,
      value2,
      value3,
    };
  });

  return {
    header: {
      version: headerLines[0] || "",
      contrato: headerLines[1] || "",
      obra: headerLines[2] || "",
      numero: headerLines[3] || "",
      diametro: headerLines[4] || "",
      bomba: headerLines[5] || "",
      inclinacao: headerLines[6] || "",
      linha8: headerLines[7] || "",
      inicioPerfuracao: headerLines[8] || "",
      fimPerfuracao: headerLines[9] || "",
      inicioConcretagem: headerLines[10] || "",
      fimConcretagem: headerLines[11] || "",
    },
    phases: phaseSummary,
    slices,
  };
}

async function getObjectBuffer(client, key) {
  const result = await client.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    })
  );

  return streamToBuffer(result.Body);
}

async function buildEstacaDetail(client, key) {
  const cached = readCachedDetail(key);
  if (cached) {
    return cached;
  }

  const bodyBuffer = await getObjectBuffer(client, key);
  const convertedText = await runConverter(bodyBuffer);
  const parsed = parseConvertedText(convertedText);

  const detail = {
    key,
    size: bodyBuffer.length,
    parsed,
  };

  writeCachedDetail(key, detail);
  return detail;
}

function toOperationalSummary(item, detail) {
  const header = detail.parsed.header || {};
  const phases = detail.parsed.phases || {};
  const slices = detail.parsed.slices || [];
  const diameterCm = parseDiameterCm(header.diametro);
  const realizadoLinearM = Number.isFinite(phases.depthCm) ? phases.depthCm / 100 : null;
  const meqFactor = getMeqFactor(diameterCm);
  const realizadoMeq =
    Number.isFinite(realizadoLinearM) && Number.isFinite(meqFactor)
      ? Number((realizadoLinearM * meqFactor).toFixed(2))
      : null;
  const line8 = parseLine8Metadata(header.linha8);
  const inclination = parseInclination(header.inclinacao);
  const drillingDurationMin = minutesBetween(header.inicioPerfuracao, header.fimPerfuracao);
  const concretingDurationMin = minutesBetween(header.inicioConcretagem, header.fimConcretagem);
  const totalDurationMin =
    Number.isFinite(drillingDurationMin) && Number.isFinite(concretingDurationMin)
      ? drillingDurationMin + concretingDurationMin
      : null;
  const drillingSlices = slices.slice(0, phases.drillingSlices);
  const concretingSlices = slices.slice(phases.drillingSlices + 1);
  const pumpVolumeDeciliters = Number(String(header.bomba || "").replace(",", ".").trim());
  const pumpVolumeLiters = Number.isFinite(pumpVolumeDeciliters) ? pumpVolumeDeciliters / 10 : null;
  const estimatedConcreteLiters =
    pumpVolumeLiters != null ? sum(concretingSlices.map((slice) => slice.value3)) * pumpVolumeLiters : null;
  const avgPressureBar = average(concretingSlices.map((slice) => convertPressureBar(slice.value2)));
  const avgTorqueBar = average(drillingSlices.map((slice) => convertTorqueBar(slice.value3)));
  const drillingTicks = drillingSlices.map((slice) => slice.timeTick).filter((value) => Number.isFinite(value));
  const drillingTicksDiff = drillingTicks.length > 1 ? drillingTicks[drillingTicks.length - 1] - drillingTicks[0] : null;
  const drillingMinutesByTicks = Number.isFinite(drillingTicksDiff) ? drillingTicksDiff / 93.75 / 60 : null;
  const avgRotationRpm =
    line8.pulsesPerRotation && drillingMinutesByTicks && drillingMinutesByTicks > 0
      ? (sum(drillingSlices.map((slice) => slice.value2)) / line8.pulsesPerRotation) / drillingMinutesByTicks
      : null;
  const finishedAtDate = item.finishedAt ? `${item.finishedAt}` : null;
  const shift = classifyShift(item.finishedAt);

  return {
    key: item.key,
    fileName: item.fileName,
    finishedAt: item.finishedAt,
    contrato: (header.contrato || item.contrato || "").trim(),
    obra: (header.obra || item.obra || "").trim(),
    estaca: (header.numero || item.estaca || "").trim(),
    diametroCm: diameterCm,
    realizadoM: realizadoLinearM,
    realizadoLinearM,
    realizadoMeq,
    meqFactor,
    profundidadeCm: phases.depthCm ?? 0,
    drillingSlices: phases.drillingSlices ?? 0,
    concretingSlices: phases.concretingSlices ?? 0,
    drillingDurationMin,
    concretingDurationMin,
    totalDurationMin,
    inicioPerfuracao: header.inicioPerfuracao || "",
    fimPerfuracao: header.fimPerfuracao || "",
    inicioConcretagem: header.inicioConcretagem || "",
    fimConcretagem: header.fimConcretagem || "",
    inclination,
    pulsesPerRotation: line8.pulsesPerRotation,
    gps: line8.gps,
    estimatedConcreteLiters,
    avgPressureBar,
    avgTorqueBar,
    avgRotationRpm,
    shift,
    finishedAtDate,
  };
}

async function listEstacasByPrefix(client, prefix) {
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET,
      Prefix: prefix,
    })
  );

  return (result.Contents || []).map((item) => {
    const parsed = parseEstacaKey(item.Key);
    return {
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      ...parsed,
    };
  });
}

async function buildOperationalSummaries(client, prefix) {
  const objects = await listEstacasByPrefix(client, prefix);
  const summaries = [];

  for (const item of objects) {
    const detail = await buildEstacaDetail(client, item.key);
    summaries.push(toOperationalSummary(item, detail));
  }

  return summaries;
}

module.exports = {
  buildOperationalSummaries,
  buildEstacaDetail,
  average,
};
