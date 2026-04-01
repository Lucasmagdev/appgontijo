import { useMemo, useState, type ComponentType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CloudSun,
  DoorClosed,
  DoorOpen,
  Droplets,
  FileCheck2,
  FileText,
  HardHat,
  MapPin,
  PenTool,
  ShieldAlert,
  Tractor,
  Users,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import { diarioService, equipamentoService, extractApiErrorMessage, obraService } from '@/lib/gontijo-api'

const TOP_BUTTONS = [
  { key: 'data', label: 'Data', icon: CalendarDays },
  { key: 'entrada', label: 'Entrada', icon: DoorOpen },
  { key: 'saida', label: 'Saida', icon: DoorClosed },
] as const

const MODULE_BUTTONS = [
  { key: 'equipe', label: 'Equipe', icon: Users },
  { key: 'equipamento', label: 'Equipamento', icon: Tractor },
  { key: 'estacas', label: 'Estacas', icon: HardHat },
  { key: 'ocorrencias', label: 'Ocorrencias', icon: ShieldAlert },
  { key: 'abastecimento', label: 'Abastecimento', icon: Droplets },
  { key: 'planejamento-diario', label: 'Planejamento\nDiario', icon: FileText },
  { key: 'planejamento-final', label: 'Planejamento\nFinal', icon: FileCheck2 },
  { key: 'horimetro', label: 'Horimetro', icon: Clock3 },
  { key: 'clima', label: 'Condicoes\nClimaticas', icon: CloudSun },
  { key: 'assinatura', label: 'Assinatura do\ncliente', icon: PenTool },
] as const

type TopFieldKey = (typeof TOP_BUTTONS)[number]['key']
type TimeStep = 'hour' | 'minute'

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function buildAddress(detail: {
  logradouro: string
  bairro: string
  numeroEnd: string
  cidade: string
  estado: string
}) {
  const firstLine = [detail.logradouro, detail.numeroEnd].filter(Boolean).join(', ')
  const secondLine = [detail.bairro, detail.cidade, detail.estado].filter(Boolean).join(' - ')
  return [firstLine, secondLine].filter(Boolean).join(' | ')
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createMonthGrid(currentMonth: Date) {
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(start.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      iso: formatIsoDate(date),
      isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
    }
  })
}

function formatDateLabel(value: unknown) {
  const text = String(value || '')
  if (!text) return ''
  const [year, month, day] = text.split('-')
  if (!year || !month || !day) return text
  return `${day}/${month}/${year}`
}

function formatTimeLabel(value: unknown) {
  const text = String(value || '')
  if (!text) return ''
  return text.slice(0, 5)
}

function formatHeaderDate(value: string) {
  const parsed = parseIsoDate(value)
  if (!parsed) return 'Escolha a data'
  const formatted = LONG_DATE_FORMATTER.format(parsed).replace(/\.$/, '')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatMonthTitle(date: Date) {
  const formatted = MONTH_FORMATTER.format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function getTimeParts(value: string) {
  const [hourText, minuteText] = value.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  return {
    hour: Number.isFinite(hour) ? hour : 7,
    minute: Number.isFinite(minute) ? minute : 0,
  }
}

function mergeTimeValue(baseValue: string, patch: Partial<{ hour: number; minute: number }>) {
  const { hour, minute } = getTimeParts(baseValue || '07:00')
  const nextHour = patch.hour ?? hour
  const nextMinute = patch.minute ?? minute
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

function addMinutes(value: string, delta: number) {
  const { hour, minute } = getTimeParts(value || '07:00')
  const total = Math.max(0, Math.min(23 * 60 + 59, hour * 60 + minute + delta))
  const nextHour = Math.floor(total / 60)
  const nextMinute = total % 60
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`
}

function OpeningDiaryLoading() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(180deg, #faf6f6 0%, #ffffff 100%)',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          borderRadius: '24px',
          background: '#fff',
          padding: '28px 24px',
          boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '999px',
            border: '4px solid #f3d4d4',
            borderTopColor: '#a72727',
            animation: 'spin 0.9s linear infinite',
          }}
        />
        <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>Abrindo diario...</div>
        <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
          Preparando informacoes da obra e da maquina.
        </div>
      </div>
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '7px 12px',
        borderRadius: '999px',
        background: '#fbe8e8',
        color: '#a72727',
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  )
}

function ActionCard(_props: {
  label: string
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
  onClick: () => void
  compact?: boolean
  complete?: boolean
  value?: string
}) {
  const { label, icon: Icon, onClick, compact = false, complete = false, value } = _props

  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        minHeight: compact ? '128px' : '122px',
        border: `1.5px solid ${complete ? 'rgba(22,163,74,0.34)' : 'rgba(167,39,39,0.24)'}`,
        borderRadius: compact ? '22px' : '20px',
        background: complete
          ? 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(241,253,245,1) 100%)'
          : 'linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,249,249,1) 100%)',
        boxShadow: complete ? '0 12px 24px rgba(22,163,74,0.08)' : '0 10px 24px rgba(15,23,42,0.06)',
        padding: compact ? '16px 14px' : '14px 10px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: compact ? 'flex-start' : 'center',
        justifyContent: compact ? 'space-between' : 'center',
        gap: compact ? '16px' : '12px',
        textAlign: compact ? 'left' : 'center',
        cursor: 'pointer',
      }}
    >
      {complete ? (
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '24px',
            height: '24px',
            borderRadius: '999px',
            background: '#16a34a',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px rgba(22,163,74,0.25)',
          }}
        >
          <CheckCircle2 size={15} />
        </div>
      ) : null}

      <div
        style={{
          width: compact ? '52px' : '50px',
          height: compact ? '52px' : '50px',
          borderRadius: '16px',
          background: complete ? '#ecfdf3' : '#fff1f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `inset 0 0 0 1px ${complete ? 'rgba(22,163,74,0.14)' : 'rgba(167,39,39,0.1)'}`,
        }}
      >
        <Icon size={compact ? 28 : 27} color={complete ? '#16a34a' : '#a72727'} strokeWidth={2.1} />
      </div>

      <span
        style={{
          fontSize: compact ? '17px' : '13px',
          fontWeight: 800,
          color: '#1f2937',
          lineHeight: compact ? '1.08' : '1.18',
          whiteSpace: 'pre-line',
        }}
      >
        {label}
      </span>

      {compact ? (
        <span
          style={{
            minHeight: '18px',
            fontSize: '12px',
            fontWeight: 700,
            color: complete ? '#15803d' : '#6b7280',
            lineHeight: '1.2',
          }}
        >
          {value || 'Nao preenchido'}
        </span>
      ) : null}
    </button>
  )
}

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.56)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px',
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '360px',
          borderRadius: '18px',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 28px 70px rgba(0,0,0,0.28)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function DatePickerModal(_props: {
  month: Date
  value: string
  onMonthChange: (direction: -1 | 1) => void
  onSelect: (value: string) => void
  onCancel: () => void
  onConfirm: () => void
  isSaving: boolean
}) {
  const { month, value, onMonthChange, onSelect, onCancel, onConfirm, isSaving } = _props
  const days = useMemo(() => createMonthGrid(month), [month])

  return (
    <ModalShell>
      <div
        style={{
          background: '#0f9488',
          color: '#fff',
          padding: '18px 18px 22px',
        }}
      >
        <div style={{ fontSize: '16px', opacity: 0.78, fontWeight: 700 }}>{value ? value.slice(0, 4) : '----'}</div>
        <div style={{ marginTop: '8px', fontSize: '28px', lineHeight: '1.08', fontWeight: 800 }}>{formatHeaderDate(value)}</div>
      </div>

      <div style={{ padding: '18px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => onMonthChange(-1)}
            style={{
              border: 'none',
              background: 'transparent',
              width: '38px',
              height: '38px',
              display: 'grid',
              placeItems: 'center',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={24} />
          </button>

          <div style={{ fontSize: '17px', fontWeight: 800, color: '#1f2937', textTransform: 'lowercase' }}>
            {formatMonthTitle(month)}
          </div>

          <button
            onClick={() => onMonthChange(1)}
            style={{
              border: 'none',
              background: 'transparent',
              width: '38px',
              height: '38px',
              display: 'grid',
              placeItems: 'center',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
          {WEEKDAY_LABELS.map((item, index) => (
            <div key={`${item}-${index}`} style={{ fontSize: '13px', color: '#6b7280', fontWeight: 600, paddingBottom: '4px' }}>
              {item}
            </div>
          ))}
          {days.map((item) => {
            const selected = item.iso === value
            return (
              <button
                key={item.iso}
                onClick={() => onSelect(item.iso)}
                style={{
                  border: 'none',
                  background: selected ? '#0f9488' : 'transparent',
                  color: selected ? '#fff' : item.isCurrentMonth ? '#1f2937' : '#9ca3af',
                  width: '38px',
                  height: '38px',
                  borderRadius: '999px',
                  margin: '0 auto',
                  fontSize: '15px',
                  fontWeight: selected ? 800 : 600,
                  cursor: 'pointer',
                }}
              >
                {item.date.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '24px',
          padding: '10px 22px 20px',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#111827',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          CANCELAR
        </button>
        <button
          onClick={onConfirm}
          disabled={!value || isSaving}
          style={{
            border: 'none',
            background: 'transparent',
            color: !value || isSaving ? '#94a3b8' : '#0f9488',
            fontSize: '15px',
            fontWeight: 900,
            cursor: !value || isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'SALVANDO...' : 'OK'}
        </button>
      </div>
    </ModalShell>
  )
}

function ClockFace(_props: {
  value: string
  step: TimeStep
  onPickHour: (hour: number) => void
  onPickMinute: (minute: number) => void
}) {
  const { value, step, onPickHour, onPickMinute } = _props
  const { hour, minute } = getTimeParts(value)
  const hourInner = Array.from({ length: 12 }, (_, index) => index + 1)
  const hourOuter = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0]
  const minuteMarks = Array.from({ length: 12 }, (_, index) => index * 5)

  return (
    <div
      style={{
        position: 'relative',
        width: '280px',
        height: '280px',
        margin: '0 auto',
        borderRadius: '999px',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '12px',
          height: '12px',
          borderRadius: '999px',
          background: '#a72727',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {step === 'hour'
        ? (
            <>
              {hourOuter.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 112
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = hour === item
                return (
                  <button
                    key={`outer-${item}`}
                    onClick={() => onPickHour(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '34px',
                      height: '34px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#374151',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {String(item).padStart(2, '0')}
                  </button>
                )
              })}

              {hourInner.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 72
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = hour === item
                return (
                  <button
                    key={`inner-${item}`}
                    onClick={() => onPickHour(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '40px',
                      height: '40px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#111827',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {item}
                  </button>
                )
              })}
            </>
          )
        : (
            <>
              {minuteMarks.map((item, index) => {
                const angle = (index * 30 - 60) * (Math.PI / 180)
                const radius = 108
                const x = 140 + Math.cos(angle) * radius
                const y = 140 + Math.sin(angle) * radius
                const selected = minute === item
                return (
                  <button
                    key={`minute-${item}`}
                    onClick={() => onPickMinute(item)}
                    style={{
                      position: 'absolute',
                      left: x,
                      top: y,
                      transform: 'translate(-50%, -50%)',
                      width: '42px',
                      height: '42px',
                      borderRadius: '999px',
                      border: 'none',
                      background: selected ? '#a72727' : 'transparent',
                      color: selected ? '#fff' : '#111827',
                      fontSize: '15px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {String(item).padStart(2, '0')}
                  </button>
                )
              })}
            </>
          )}
    </div>
  )
}

function TimePickerModal(_props: {
  title: string
  value: string
  step: TimeStep
  onStepChange: (step: TimeStep) => void
  onPickHour: (hour: number) => void
  onPickMinute: (minute: number) => void
  onAdjustMinute: (delta: number) => void
  onCancel: () => void
  onConfirm: () => void
  isSaving: boolean
}) {
  const { title, value, step, onStepChange, onPickHour, onPickMinute, onAdjustMinute, onCancel, onConfirm, isSaving } =
    _props
  const { hour, minute } = getTimeParts(value || '07:00')

  return (
    <ModalShell>
      <div
        style={{
          background: '#a72727',
          color: '#fff',
          padding: '18px 18px 20px',
        }}
      >
        <div style={{ fontSize: '15px', opacity: 0.84, fontWeight: 700 }}>{title}</div>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <button
            onClick={() => onStepChange('hour')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#fff',
              opacity: step === 'hour' ? 1 : 0.7,
              fontSize: '36px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {String(hour).padStart(2, '0')}
          </button>
          <span style={{ fontSize: '34px', fontWeight: 800, opacity: 0.8 }}>:</span>
          <button
            onClick={() => onStepChange('minute')}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#fff',
              opacity: step === 'minute' ? 1 : 0.7,
              fontSize: '36px',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {String(minute).padStart(2, '0')}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 18px 12px' }}>
        <div
          style={{
            display: 'inline-flex',
            gap: '8px',
            borderRadius: '999px',
            background: '#f3f4f6',
            padding: '4px',
            marginBottom: '14px',
          }}
        >
          <button
            onClick={() => onStepChange('hour')}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '8px 14px',
              background: step === 'hour' ? '#fff' : 'transparent',
              fontSize: '13px',
              fontWeight: 800,
              color: '#111827',
              cursor: 'pointer',
            }}
          >
            Hora
          </button>
          <button
            onClick={() => onStepChange('minute')}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '8px 14px',
              background: step === 'minute' ? '#fff' : 'transparent',
              fontSize: '13px',
              fontWeight: 800,
              color: '#111827',
              cursor: 'pointer',
            }}
          >
            Minuto
          </button>
        </div>

        <ClockFace value={value} step={step} onPickHour={onPickHour} onPickMinute={onPickMinute} />

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <button
            onClick={() => onAdjustMinute(-1)}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '999px',
              background: '#fff',
              color: '#111827',
              fontSize: '13px',
              fontWeight: 800,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            -1 min
          </button>
          <button
            onClick={() => onAdjustMinute(1)}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '999px',
              background: '#fff',
              color: '#111827',
              fontSize: '13px',
              fontWeight: 800,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            +1 min
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '24px',
          padding: '10px 22px 20px',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            border: 'none',
            background: 'transparent',
            color: '#111827',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          CANCELAR
        </button>
        <button
          onClick={onConfirm}
          disabled={!value || isSaving}
          style={{
            border: 'none',
            background: 'transparent',
            color: !value || isSaving ? '#94a3b8' : '#a72727',
            fontSize: '15px',
            fontWeight: 900,
            cursor: !value || isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'SALVANDO...' : 'OK'}
        </button>
      </div>
    </ModalShell>
  )
}

export default function DiarioPainel() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { equipamentoId } = useParams()
  const { user } = useOperadorAuth()
  const selectedId = Number(equipamentoId)
  const [activeTopModal, setActiveTopModal] = useState<TopFieldKey | null>(null)
  const [topModalValue, setTopModalValue] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [timeStep, setTimeStep] = useState<TimeStep>('hour')
  const [topModalError, setTopModalError] = useState('')

  const equipamentosQuery = useQuery({
    queryKey: ['equipamentos-parametrizados'],
    queryFn: equipamentoService.listParametrizados,
  })

  const equipamento = equipamentosQuery.data?.find((item) => item.id === selectedId) ?? null

  const draftQuery = useQuery({
    queryKey: ['operador-diario-draft', selectedId, equipamento?.obraNumero, user?.id],
    enabled: Boolean(selectedId && equipamento?.obraNumero && user?.id),
    queryFn: () =>
      diarioService.resolveDraft({
        equipamentoId: selectedId,
        operadorId: user!.id,
        obraNumero: equipamento!.obraNumero,
      }),
  })

  const obraDetailQuery = useQuery({
    queryKey: ['obra-detail-operador', draftQuery.data?.obraId],
    enabled: Boolean(draftQuery.data?.obraId),
    queryFn: () => obraService.getById(draftQuery.data!.obraId),
  })

  const topSaveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: TopFieldKey; value: string }) => {
      if (!draftQuery.data) return

      const currentJson = (draftQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const nextJson = {
        ...currentJson,
        [key === 'data' ? 'date' : key === 'entrada' ? 'start' : 'end']: value,
      }

      if (key === 'data') {
        nextJson.date_confirmed = true
      }

      if (key === 'saida') {
        const entrada = String(currentJson.start || '')
        if (entrada && value && value < entrada) {
          throw new Error('A saida nao pode ser antes da entrada.')
        }
      }

      if (key === 'entrada') {
        const saida = String(currentJson.end || '')
        if (saida && value && value > saida) {
          throw new Error('A entrada nao pode ser depois da saida ja informada.')
        }
      }

      await diarioService.update(draftQuery.data.id, {
        dataDiario: key === 'data' ? value : draftQuery.data.dataDiario,
        status: draftQuery.data.status,
        equipamentoId: draftQuery.data.equipamentoId,
        assinadoEm: draftQuery.data.assinadoEm,
        dadosJson: nextJson,
      })
    },
    onSuccess: async () => {
      setTopModalError('')
      setActiveTopModal(null)
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (error) => {
      setTopModalError(extractApiErrorMessage(error))
    },
  })

  const obraTitulo = draftQuery.data
    ? `${draftQuery.data.obraNumero} - ${draftQuery.data.cliente || 'Obra selecionada'}`
    : equipamento
      ? `${equipamento.obraNumero} - Obra selecionada`
      : 'Diario de obras'
  const endereco = obraDetailQuery.data
    ? buildAddress(obraDetailQuery.data)
    : 'Endereco da obra em carregamento'
  const draftJson = (draftQuery.data?.dadosJson as Record<string, unknown> | null) || {}
  const isDateConfirmed = draftJson.date_confirmed === true
  const topCompletion = {
    data: isDateConfirmed && Boolean(draftJson.date),
    entrada: Boolean(draftJson.start),
    saida: Boolean(draftJson.end),
  }
  const topValues = {
    data: isDateConfirmed ? formatDateLabel(draftJson.date) : '',
    entrada: formatTimeLabel(draftJson.start),
    saida: formatTimeLabel(draftJson.end),
  }
  const moduleCompletion = {
    equipe:
      Array.isArray(draftJson.staff) &&
      draftJson.staff.some((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>
          return String(row.item || row.name || '').trim()
        }
        return false
      }),
    equipamento: draftJson.equipment_confirmed === true,
    estacas: draftJson.estacas_confirmed === true,
    ocorrencias:
      draftJson.ocorrencias_confirmed === true ||
      draftJson.occurrences_confirmed === true ||
      (Array.isArray(draftJson.ocorrencias) && draftJson.ocorrencias.length > 0) ||
      (Array.isArray(draftJson.occurrences) && draftJson.occurrences.length > 0),
    abastecimento:
      Boolean(
        draftJson.supply &&
        typeof draftJson.supply === 'object' &&
        (
          (draftJson.supply as Record<string, unknown>).litrosTanqueAntes ||
          (draftJson.supply as Record<string, unknown>).litrosGalaoAntes ||
          (draftJson.supply as Record<string, unknown>).litrosTanque ||
          (draftJson.supply as Record<string, unknown>).litrosGalao ||
          (draftJson.supply as Record<string, unknown>).chegouDiesel
        )
      ),
    horimetro: Boolean(String(draftJson.horimetro || '').trim()),
    planejamentoDiario: Array.isArray(draftJson.planning) && draftJson.planning.length > 0,
    planejamentoFinal:
      Boolean(String(draftJson.endDate || '').trim()) ||
      (Array.isArray(draftJson.endConstruction) && draftJson.endConstruction.length > 0),
    clima:
      Boolean(
        draftJson.clima &&
        typeof draftJson.clima === 'object' &&
        (
          (draftJson.clima as Record<string, unknown>).id ||
          (draftJson.clima as Record<string, unknown>).name ||
          (draftJson.clima as Record<string, unknown>).label ||
          (draftJson.clima as Record<string, unknown>).item
        )
      ),
    assinatura:
      String(draftQuery.data?.status || '') === 'assinado' ||
      Boolean(String(draftJson.signature || '').trim()) ||
      Boolean(
        draftJson.signature_request &&
        typeof draftJson.signature_request === 'object' &&
        ((draftJson.signature_request as Record<string, unknown>).status === 'assinado' ||
          (draftJson.signature_request as Record<string, unknown>).status === 'signed')
      ),
    revisao: draftJson.revisao_confirmed === true || draftJson.review_confirmed === true,
    finalizacao: String(draftQuery.data?.status || '') === 'assinado',
  }

  function openTopModal(key: TopFieldKey) {
    if (!draftQuery.data) return
    setTopModalError('')
    setActiveTopModal(key)

    if (key === 'data') {
      const anchorDate = String(draftJson.date || draftQuery.data.dataDiario || new Date().toISOString().slice(0, 10))
      setTopModalValue(isDateConfirmed ? String(draftJson.date || '') : '')
      setCalendarMonth(parseIsoDate(anchorDate) || new Date())
      return
    }

    const currentTime = String(key === 'entrada' ? draftJson.start || '07:00' : draftJson.end || draftJson.start || '17:00')
    setTopModalValue(formatTimeLabel(currentTime) || currentTime)
    setTimeStep('hour')
  }

  function closeTopModal() {
    if (topSaveMutation.isPending) return
    setTopModalError('')
    setActiveTopModal(null)
  }

  function saveTopModal() {
    if (!activeTopModal || !topModalValue) return
    setTopModalError('')
    topSaveMutation.mutate({ key: activeTopModal, value: topModalValue })
  }

  function openModulo(modulo: string) {
    if (!draftQuery.data?.id) return
    navigate(`/operador/diario-de-obras/novo/${selectedId}/${modulo}?diario=${draftQuery.data.id}`)
  }

  if (equipamentosQuery.isLoading || draftQuery.isLoading) {
    return <OpeningDiaryLoading />
  }

  if (equipamentosQuery.isError) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #faf6f6 0%, #ffffff 100%)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '340px',
            borderRadius: '24px',
            background: '#fff',
            padding: '24px',
            boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>Nao foi possivel abrir o diario</div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            {extractApiErrorMessage(equipamentosQuery.error)}
          </div>
        </div>
      </div>
    )
  }

  if (!equipamento) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #faf6f6 0%, #ffffff 100%)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '340px',
            borderRadius: '24px',
            background: '#fff',
            padding: '24px',
            boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>Maquina nao encontrada</div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            Volte e escolha uma maquina parametrizada para iniciar o diario.
          </div>
          <button
            onClick={() => navigate('/operador/diario-de-obras/novo')}
            style={{
              marginTop: '18px',
              border: 'none',
              borderRadius: '14px',
              background: '#a72727',
              color: '#fff',
              padding: '13px 18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (draftQuery.isError || !draftQuery.data) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg, #faf6f6 0%, #ffffff 100%)',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '340px',
            borderRadius: '24px',
            background: '#fff',
            padding: '24px',
            boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#1f2937' }}>Nao foi possivel abrir o diario</div>
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
            {draftQuery.isError ? extractApiErrorMessage(draftQuery.error) : 'Diario indisponivel para esta maquina.'}
          </div>
          <button
            onClick={() => navigate('/operador/diario-de-obras/novo')}
            style={{
              marginTop: '18px',
              border: 'none',
              borderRadius: '14px',
              background: '#a72727',
              color: '#fff',
              padding: '13px 18px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
          maxWidth: '430px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
            padding: '0 16px',
            height: '72px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
            boxShadow: '0 10px 22px rgba(167,39,39,0.18)',
          }}
        >
          <button
            onClick={() => navigate('/operador/diario-de-obras/novo')}
            style={{
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Operador
            </span>
            <span style={{ color: '#fff', fontSize: '21px', fontWeight: 800, letterSpacing: '0.02em' }}>
              Diario de obras
            </span>
          </div>
        </div>

        <div style={{ padding: '22px 18px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div
            style={{
              borderRadius: '26px',
              padding: '20px 18px 18px',
              background:
                'radial-gradient(circle at top right, rgba(167,39,39,0.1), transparent 28%), linear-gradient(180deg, #ffffff 0%, #fff8f8 100%)',
              border: '1px solid rgba(167,39,39,0.14)',
              boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <SectionLabel text="Obra selecionada" />

            <h1
              style={{
                margin: 0,
                color: '#a72727',
                fontSize: '27px',
                lineHeight: '1.02',
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              {obraTitulo}
            </h1>

            <div
              style={{
                display: 'grid',
                gap: '12px',
                padding: '14px',
                borderRadius: '18px',
                background: '#fff',
                border: '1px solid rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '14px',
                    background: '#fff1f1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={22} color="#ef4444" strokeWidth={2.4} />
                </div>
                <div style={{ fontSize: '14px', color: '#374151', lineHeight: '1.35', fontWeight: 700 }}>
                  {obraDetailQuery.isError ? extractApiErrorMessage(obraDetailQuery.error) : endereco}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '999px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                    color: '#374151',
                    fontWeight: 700,
                  }}
                >
                  Maquina: {equipamento.nome}
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '999px',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    fontSize: '12px',
                    color: '#374151',
                    fontWeight: 700,
                  }}
                >
                  IMEI: {equipamento.imei}
                </div>
              </div>
            </div>
          </div>

          <SectionLabel text="Inicio do diario" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
            {TOP_BUTTONS.map((item) => (
              <ActionCard
                key={item.key}
                label={item.label}
                icon={item.icon}
                compact
                complete={topCompletion[item.key]}
                value={topValues[item.key]}
                onClick={() => openTopModal(item.key)}
              />
            ))}
          </div>

          {topModalError ? (
            <div
              style={{
                border: '1px solid #fecaca',
                borderRadius: '14px',
                padding: '12px 14px',
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              {topModalError}
            </div>
          ) : null}

          <div
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, #d1d5db 18%, #d1d5db 82%, transparent 100%)',
              margin: '2px 0',
            }}
          />

          <SectionLabel text="Preenchimento" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px 10px' }}>
            {MODULE_BUTTONS.map((item) => (
              <ActionCard
                key={item.key}
                label={item.label}
                icon={item.icon}
                complete={
                  item.key === 'equipe' ? Boolean(moduleCompletion.equipe) :
                  item.key === 'equipamento' ? Boolean(moduleCompletion.equipamento) :
                  item.key === 'estacas' ? Boolean(moduleCompletion.estacas) :
                  item.key === 'ocorrencias' ? Boolean(moduleCompletion.ocorrencias) :
                  item.key === 'abastecimento' ? Boolean(moduleCompletion.abastecimento) :
                  item.key === 'horimetro' ? Boolean(moduleCompletion.horimetro) :
                  item.key === 'planejamento-diario' ? Boolean(moduleCompletion.planejamentoDiario) :
                  item.key === 'planejamento-final' ? Boolean(moduleCompletion.planejamentoFinal) :
                  item.key === 'clima' ? Boolean(moduleCompletion.clima) :
                  item.key === 'assinatura' ? Boolean(moduleCompletion.assinatura) :
                  false
                }
                onClick={() => openModulo(item.key)}
              />
            ))}
          </div>

          <div style={{ marginTop: '8px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => openModulo('finalizar')}
              style={{
                border: 'none',
                borderRadius: '20px',
                background: moduleCompletion.finalizacao
                  ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                  : 'linear-gradient(180deg, #5b6470 0%, #434b56 100%)',
                color: '#fff',
                minHeight: '60px',
                fontSize: '18px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                boxShadow: moduleCompletion.finalizacao
                  ? '0 12px 24px rgba(22,163,74,0.18)'
                  : '0 12px 24px rgba(67,75,86,0.18)',
              }}
            >
              Finalizar Diario
            </button>
            <button
              onClick={() => openModulo('revisao')}
              style={{
                border: 'none',
                borderRadius: '18px',
                background: moduleCompletion.revisao
                  ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                  : 'linear-gradient(180deg, #b42b2b 0%, #9b2121 100%)',
                color: '#fff',
                minHeight: '60px',
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                boxShadow: moduleCompletion.revisao
                  ? '0 14px 28px rgba(22,163,74,0.2)'
                  : '0 14px 28px rgba(167,39,39,0.2)',
              }}
            >
              Revisao do Diario
            </button>
          </div>
        </div>
      </div>

      {activeTopModal === 'data' ? (
        <DatePickerModal
          month={calendarMonth}
          value={topModalValue}
          onMonthChange={(direction) =>
            setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))
          }
          onSelect={setTopModalValue}
          onCancel={closeTopModal}
          onConfirm={saveTopModal}
          isSaving={topSaveMutation.isPending}
        />
      ) : null}

      {activeTopModal === 'entrada' || activeTopModal === 'saida' ? (
        <TimePickerModal
          title={activeTopModal === 'entrada' ? 'Horario de entrada' : 'Horario de saida'}
          value={topModalValue}
          step={timeStep}
          onStepChange={setTimeStep}
          onPickHour={(hour) => {
            setTopModalValue((prev) => mergeTimeValue(prev, { hour }))
            setTimeStep('minute')
          }}
          onPickMinute={(minute) => setTopModalValue((prev) => mergeTimeValue(prev, { minute }))}
          onAdjustMinute={(delta) => setTopModalValue((prev) => addMinutes(prev, delta))}
          onCancel={closeTopModal}
          onConfirm={saveTopModal}
          isSaving={topSaveMutation.isPending}
        />
      ) : null}
    </>
  )
}
