import type { ProductionDailyDashboard, ProductionWeeklyDashboard, ProductionMachineRow } from '@/lib/gontijo-api'

export const REFRESH_DAILY = 60
export const REFRESH_WEEKLY = 300

export function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

export function getCurrentWeekStart() {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() + diff)
  return weekStart.toISOString().slice(0, 10)
}

export function fmt(n: number, decimals = 0) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function toneColor(percent: number | null) {
  if (percent == null) return '#64748b'
  if (percent >= 100) return '#22c55e'
  if (percent >= 70) return '#f59e0b'
  return '#ef4444'
}

export function toneBg(percent: number | null) {
  if (percent == null) return 'rgba(100,116,139,0.15)'
  if (percent >= 100) return 'rgba(34,197,94,0.15)'
  if (percent >= 70) return 'rgba(245,158,11,0.15)'
  return 'rgba(239,68,68,0.15)'
}

// ─── Card: Estacas realizadas no dia ─────────────────────────────────────────

export function CardEstacasDia({ data }: { data: ProductionDailyDashboard }) {
  const fill = data.totalProgressPercent == null ? 0 : Math.max(0, Math.min(data.totalProgressPercent, 100))

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(198,9,38,0.18) 0%, rgba(255,255,255,0.04) 100%)',
      border: '1px solid rgba(198,9,38,0.25)',
      borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div>
        <div style={{ color: '#c60926', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Principal</div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 2 }}>Estacas realizadas no dia</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ color: '#fff', fontSize: 64, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {fmt(data.totalRealizedEstacas)}
        </div>
        <div style={{
          marginBottom: 8, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: toneBg(data.totalProgressPercent),
          color: toneColor(data.totalProgressPercent),
        }}>
          {data.totalProgressPercent == null ? 'Sem meta' : `${fmt(data.totalProgressPercent, 1)}%`}
        </div>
      </div>

      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${fill}%`,
          background: toneColor(data.totalProgressPercent),
          borderRadius: 3, transition: 'width 1.2s ease',
        }} />
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Meta dia</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{fmt(data.totalGoalEstacas)}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metros</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{fmt(data.totalRealizedLinearMeters, 1)} m</div>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>MEQ</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{fmt(data.totalRealizedMeq, 1)}</div>
        </div>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Máquinas</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{data.machines.filter(m => m.active).length}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Card: Máquina em destaque ────────────────────────────────────────────────

export function CardMaquinaDestaque({ machine }: { machine: ProductionMachineRow | undefined }) {
  if (!machine) {
    return (
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Nenhuma máquina disponível.</div>
      </div>
    )
  }

  const fill = machine.progressPercent == null ? 0 : Math.min(machine.progressPercent, 100)

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Máquina em destaque</div>
          <div style={{ color: '#fff', fontSize: 28, fontWeight: 800, marginTop: 4 }}>{machine.machineName}</div>
          <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 2 }}>{machine.obraName || 'Sem obra'}</div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: toneBg(machine.progressPercent),
          color: toneColor(machine.progressPercent),
        }}>
          {machine.progressPercent == null ? 'Sem meta' : `${fmt(machine.progressPercent, 1)}%`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Estacas</div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 40, lineHeight: 1 }}>{machine.realizedEstacas}</div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.07)' }} />
        <div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metros</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 22 }}>{fmt(machine.realizedLinearMeters, 2)} m</div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 10 }}>Obra</div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{machine.obraCode || '—'}</div>
        </div>
      </div>

      <div>
        <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${fill}%`, background: toneColor(machine.progressPercent), borderRadius: 3 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>0</span>
          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>Meta {machine.dailyGoalEstacas || 0}</span>
        </div>
      </div>

      <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: -4 }}>{machine.imei}</div>
    </div>
  )
}

// ─── Card: Obras em destaque ──────────────────────────────────────────────────

export function CardObrasDestaque({ data }: { data: ProductionDailyDashboard }) {
  const obras = [...data.topWorks]
    .sort((a, b) => b.realizedEstacas - a.realizedEstacas)
    .filter(o => o.realizedEstacas > 0)
    .slice(0, 6)
  const max = obras[0]?.realizedEstacas || 1

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Resumo</div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 2 }}>Obras em destaque</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 }}>Distribuição de produção</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {obras.map((obra) => {
          const pct = (obra.realizedEstacas / max) * 100
          return (
            <div key={obra.obraName}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Obra</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{obra.obraName || 'Sem obra'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{obra.realizedEstacas} estacas · {fmt(obra.realizedLinearMeters, 2)} m</div>
                </div>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 22, alignSelf: 'center' }}>{obra.realizedEstacas}</div>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: '#c60926', borderRadius: 2 }} />
              </div>
            </div>
          )
        })}
        {!obras.length && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nenhuma obra com produção.</div>
        )}
      </div>
    </div>
  )
}

// ─── Grid de máquinas ─────────────────────────────────────────────────────────

export function GridMaquinas({ machines }: { machines: ProductionMachineRow[] }) {
  const active = machines.filter(m => m.realizedEstacas > 0).sort((a, b) => b.realizedEstacas - a.realizedEstacas)
  const idle = machines.filter(m => m.realizedEstacas === 0)
  const all = [...active, ...idle]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
        Máquinas do dia — {machines.filter(m => m.active).length} ativas
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 10,
        overflowY: 'auto',
        flex: 1,
      }}>
        {all.map((m) => {
          const fill = m.progressPercent == null ? 0 : Math.min(m.progressPercent, 100)
          const hasProduction = m.realizedEstacas > 0
          return (
            <div
              key={m.imei}
              style={{
                background: hasProduction ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hasProduction ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 12, padding: '12px 16px',
                opacity: hasProduction ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{m.machineName}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 1 }}>{m.obraName || 'Sem obra'}</div>
                  <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 1 }}>{m.workSource === 'admin' ? 'Admin' : m.workSource === 'api' ? 'Operação' : 'Sem fonte'}</div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: toneBg(m.progressPercent),
                  color: toneColor(m.progressPercent),
                  flexShrink: 0,
                }}>
                  {m.progressPercent == null ? 'Sem meta' : `${fmt(m.progressPercent, 0)}%`}
                </div>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${fill}%`, background: toneColor(m.progressPercent), borderRadius: 2 }} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dia</div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{m.realizedEstacas}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Estacas</div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{m.realizedEstacas}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Meta</div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{m.dailyGoalEstacas || 0}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function Timeline({ data }: { data: ProductionDailyDashboard }) {
  const items = [...data.timeline].reverse().slice(0, 40)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden', height: '100%' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
        Timeline do dia — últimas estacas registradas
      </div>
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Nenhum registro.</div>
        )}
        {items.map((item, i) => (
          <div
            key={`${item.date}-${item.machineName}-${item.estaca}-${i}`}
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 14px', borderRadius: 10,
              background: i === 0 ? 'rgba(198,9,38,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === 0 ? 'rgba(198,9,38,0.2)' : 'rgba(255,255,255,0.05)'}`,
            }}
          >
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ color: '#c60926', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                {item.finishedAt || '--:--'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{item.machineName}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}>
                {item.estaca || 'Sem estaca'} | {item.obraName || 'Sem obra'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Primary view ─────────────────────────────────────────────────────────────

export function PrimaryView({ data }: { data: ProductionDailyDashboard }) {
  const spotlight = [...data.machines].sort((a, b) => b.realizedEstacas - a.realizedEstacas)[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 28px 20px', overflow: 'hidden', minHeight: 0 }}>
      {/* Top: 3 hero cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, flexShrink: 0 }}>
        <CardEstacasDia data={data} />
        <CardMaquinaDestaque machine={spotlight} />
        <CardObrasDestaque data={data} />
      </div>

      {/* Bottom: machines + timeline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
        <GridMaquinas machines={data.machines} />
        <Timeline data={data} />
      </div>
    </div>
  )
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

export function TvTrendChart({ labels, primary, secondary }: {
  labels: string[]
  primary: number[]
  secondary?: number[]
}) {
  const W = 700, H = 200, PAD = 28
  const maxVal = Math.max(...primary, ...(secondary || []), 1)

  function pts(vals: number[]) {
    if (!vals.length) return ''
    return vals.map((v, i) => {
      const x = PAD + (i * (W - PAD * 2)) / Math.max(vals.length - 1, 1)
      const y = H - PAD - (v / maxVal) * (H - PAD * 2)
      return `${x},${y}`
    }).join(' ')
  }

  function area(points: string) {
    if (!points) return ''
    const parts = points.split(' ')
    const x0 = parts[0]?.split(',')[0] ?? PAD
    const x1 = parts.at(-1)?.split(',')[0] ?? W - PAD
    return `${x0},${H - PAD} ${points} ${x1},${H - PAD}`
  }

  const pPts = pts(primary)
  const sPts = secondary?.length ? pts(secondary) : ''

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="tv-area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c60926" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c60926" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, i) => {
        const y = PAD + (i * (H - PAD * 2)) / 4
        return <line key={i} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      })}
      {pPts && <polygon points={area(pPts)} fill="url(#tv-area-fill)" />}
      {sPts && <polyline points={sPts} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="6 4" />}
      {pPts && <polyline points={pPts} fill="none" stroke="#c60926" strokeWidth="2.5" strokeLinejoin="round" />}
      {labels.map((label, i) => {
        const x = PAD + (i * (W - PAD * 2)) / Math.max(labels.length - 1, 1)
        return (
          <text key={label} x={x} y={H - 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="11">{label}</text>
        )
      })}
    </svg>
  )
}

// ─── Secondary view ───────────────────────────────────────────────────────────

export function SecondaryView({ data }: { data: ProductionWeeklyDashboard }) {
  const machines = [...data.machines].sort((a, b) => b.realizedEstacas - a.realizedEstacas).slice(0, 10)
  const lastDay = data.accumulatedByDay.at(-1)
  const saldoVsEsperado = lastDay
    ? (lastDay.accumulatedEstacas - lastDay.expectedAccumulatedEstacas)
    : null

  const chartLabels = data.accumulatedByDay.map(d =>
    new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 28px 18px', overflow: 'hidden', minHeight: 0 }}>

      {/* Top: 3 hero cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, flexShrink: 0 }}>

        {/* Principal */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(198,9,38,0.18) 0%, rgba(255,255,255,0.04) 100%)',
          border: '1px solid rgba(198,9,38,0.25)', borderRadius: 14, padding: '18px 22px',
        }}>
          <div style={{ color: '#c60926', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Principal</div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 2, marginBottom: 10 }}>Estacas acumuladas na semana</div>
          <div style={{ color: '#fff', fontSize: 60, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {fmt(data.totalRealizedEstacas)}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metros</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmt(data.totalRealizedLinearMeters, 1)} m</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>MEQ</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmt(data.totalRealizedMeq, 1)}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Máquinas</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{data.machines.length}</div>
            </div>
          </div>
        </div>

        {/* Meta semanal */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Meta semanal</div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 2 }}>Meta consolidada da semana</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ color: '#fff', fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{fmt(data.totalGoalEstacas)}</div>
            <div style={{
              marginBottom: 6, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: toneBg(data.totalProgressPercent),
              color: toneColor(data.totalProgressPercent),
            }}>
              {data.totalProgressPercent == null ? 'Sem meta' : `${fmt(data.totalProgressPercent, 1)}%`}
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${data.totalProgressPercent == null ? 0 : Math.min(data.totalProgressPercent, 100)}%`,
              background: toneColor(data.totalProgressPercent), borderRadius: 3,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Realizado</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmt(data.totalRealizedEstacas)}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Faltam</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{fmt(Math.max(data.totalGoalEstacas - data.totalRealizedEstacas, 0))}</div>
            </div>
          </div>
        </div>

        {/* Ritmo da semana */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Consolidado</div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 2 }}>Ritmo da semana</div>
            </div>
            {saldoVsEsperado !== null && (
              <div style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: saldoVsEsperado >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: saldoVsEsperado >= 0 ? '#4ade80' : '#f87171',
              }}>
                {saldoVsEsperado >= 0 ? '+' : ''}{fmt(saldoVsEsperado, 1)} vs esperado
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto', flex: 1 }}>
            {data.accumulatedByDay.map((day) => {
              const ok = day.accumulatedEstacas >= day.expectedAccumulatedEstacas
              const pct = day.expectedAccumulatedEstacas > 0
                ? Math.min((day.accumulatedEstacas / day.expectedAccumulatedEstacas) * 100, 100) : 0
              return (
                <div key={day.date}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                      {new Date(day.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </span>
                    <span style={{ color: ok ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 700 }}>
                      {fmt(day.accumulatedEstacas)}
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400, fontSize: 10 }}> / {Math.round(day.expectedAccumulatedEstacas)}</span>
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: ok ? '#22c55e' : '#ef4444', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Bottom: evolução + ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>

        {/* Evolução da semana */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Evolução da semana</div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 2 }}>Série por dia</div>
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                <span style={{ width: 20, height: 2, background: '#c60926', display: 'inline-block', borderRadius: 1 }} />
                Realizado acumulado
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                <span style={{ width: 20, height: 2, background: 'rgba(255,255,255,0.3)', display: 'inline-block', borderRadius: 1, borderTop: '2px dashed rgba(255,255,255,0.3)' }} />
                Esperado acumulado
              </span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TvTrendChart
              labels={chartLabels}
              primary={data.accumulatedByDay.map(d => d.accumulatedEstacas)}
              secondary={data.accumulatedByDay.map(d => d.expectedAccumulatedEstacas)}
            />
          </div>
        </div>

        {/* Ranking semanal */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden',
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Ranking semanal</div>
            <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 2 }}>Maior realizado</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>
            {machines.map((m, i) => {
              const pct = (m.realizedEstacas / (machines[0]?.realizedEstacas || 1)) * 100
              const isFirst = i === 0
              return (
                <div key={m.imei} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    background: isFirst ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                    color: isFirst ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                    fontSize: 12, fontWeight: 700,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.machineName}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{m.obraName || 'Sem obra'}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{fmt(m.realizedEstacas)}</div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{fmt(m.realizedLinearMeters, 1)} m</div>
                      </div>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: isFirst ? '#fbbf24' : '#c60926', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
