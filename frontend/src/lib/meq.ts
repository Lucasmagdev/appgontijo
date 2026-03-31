const MEQ_FACTORS = new Map<number, number>([
  [25, 0.5],
  [30, 0.6],
  [40, 0.8],
  [50, 1],
  [60, 1.2],
  [70, 1.4],
  [80, 1.6],
  [90, 1.8],
  [100, 2],
  [110, 2.2],
  [120, 2.4],
])

const MEQ_FACTOR_POINTS = [...MEQ_FACTORS.entries()].sort((a, b) => a[0] - b[0])

export function parseDiameterCm(rawValue: unknown) {
  const normalized = Number(String(rawValue || '').replace(',', '.').trim())
  if (!Number.isFinite(normalized)) return null

  if (normalized > 0 && normalized < 10) {
    return normalized * 100
  }

  if (normalized >= 10) {
    return normalized / 10
  }

  return null
}

export function getMeqFactor(diameterCm: number | null) {
  if (!Number.isFinite(diameterCm ?? NaN)) return null

  const roundedDiameter = Math.round((diameterCm as number) * 1000) / 1000
  const exact = MEQ_FACTORS.get(roundedDiameter) ?? MEQ_FACTORS.get(Math.round(roundedDiameter))

  if (typeof exact === 'number') {
    return exact
  }

  const minDiameter = MEQ_FACTOR_POINTS[0]?.[0]
  const maxDiameter = MEQ_FACTOR_POINTS[MEQ_FACTOR_POINTS.length - 1]?.[0]

  if (typeof minDiameter !== 'number' || typeof maxDiameter !== 'number') return null
  if (roundedDiameter < minDiameter || roundedDiameter > maxDiameter) return null

  for (let index = 0; index < MEQ_FACTOR_POINTS.length - 1; index += 1) {
    const [startDiameter, startFactor] = MEQ_FACTOR_POINTS[index]
    const [endDiameter, endFactor] = MEQ_FACTOR_POINTS[index + 1]

    if (roundedDiameter < startDiameter || roundedDiameter > endDiameter) continue

    const ratio = (roundedDiameter - startDiameter) / (endDiameter - startDiameter)
    return Number((startFactor + (endFactor - startFactor) * ratio).toFixed(4))
  }

  return null
}

export function calculateSegmentMeq(metaEstacas: number | null, profundidadeM: number | null, diametroCm: number | null) {
  const estacas = Number(metaEstacas || 0)
  const profundidade = Number(profundidadeM || 0)
  const factor = getMeqFactor(diametroCm)

  if (!Number.isFinite(estacas) || !Number.isFinite(profundidade) || !Number.isFinite(factor ?? NaN)) {
    return {
      meqFactor: factor,
      metaMeqSegmento: null as number | null,
    }
  }

  return {
    meqFactor: factor,
    metaMeqSegmento: Number((estacas * profundidade * (factor as number)).toFixed(2)),
  }
}
