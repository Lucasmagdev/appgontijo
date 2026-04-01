import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, CloudDrizzle, CloudRain, CloudSun } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

type ClimaOption = {
  id: string
  label: string
  icon: ReactNode
}

const CLIMA_OPTIONS: ClimaOption[] = [
  { id: 'ensolarado', label: 'Ensolarado', icon: <CloudSun size={30} color="#111827" /> },
  { id: 'nublado', label: 'Nublado', icon: <Cloud size={30} color="#111827" /> },
  { id: 'chuva-fraca', label: 'Chuva fraca', icon: <CloudDrizzle size={30} color="#b91c1c" /> },
  { id: 'chuva-forte', label: 'Chuva forte', icon: <CloudRain size={30} color="#111827" /> },
]

function normalizeClima(source: unknown) {
  if (!source || typeof source !== 'object') return ''
  const clima = source as Record<string, unknown>
  const parts = [clima.id, clima.name, clima.label, clima.item].filter(Boolean).join(' ').toLowerCase()
  if (parts.includes('fraca')) return 'chuva-fraca'
  if (parts.includes('forte')) return 'chuva-forte'
  if (parts.includes('nublado')) return 'nublado'
  if (parts.includes('sol')) return 'ensolarado'
  return ''
}

function toLegacyClima(value: string) {
  const option = CLIMA_OPTIONS.find((item) => item.id === value)
  if (!option) return null
  return {
    id: option.id,
    name: option.label,
    label: option.label,
    item: option.label,
  }
}

export default function DiarioClimaPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [clima, setClima] = useState('')
  const [submitError, setSubmitError] = useState('')

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`

  useEffect(() => {
    const json = (diarioQuery.data?.dadosJson as Record<string, unknown> | null) || {}
    setClima(normalizeClima(json.clima || json.tempo))
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      const nextClima = toLegacyClima(clima)
      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          clima: nextClima,
        },
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
      navigate(backUrl)
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  return (
    <div style={pageStyle}>
      <Header onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Condições Climáticas</div>

        {diarioQuery.isLoading ? <div style={loadingTextStyle}>Carregando dados do diario...</div> : null}
        {diarioQuery.isError ? <FeedbackBox>{extractApiErrorMessage(diarioQuery.error)}</FeedbackBox> : null}

        {!diarioQuery.isLoading && !diarioQuery.isError ? (
          <div style={panelStyle}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>
              Selecione a condição climática do dia:
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
              }}
            >
              {CLIMA_OPTIONS.map((item) => {
                const active = clima === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setClima(item.id)
                      setSubmitError('')
                    }}
                    style={{
                      border: `1.5px solid ${active ? '#b91c1c' : '#111827'}`,
                      borderRadius: '18px',
                      background: active ? '#fff7f7' : '#fff',
                      minHeight: '96px',
                      padding: '10px 8px',
                      display: 'grid',
                      placeItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    {item.icon}
                    <span style={{ fontSize: '14px', fontWeight: 700, color: active ? '#b91c1c' : '#111827' }}>{item.label}</span>
                  </button>
                )
              })}
            </div>

            {submitError ? <FeedbackBox>{submitError}</FeedbackBox> : null}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={!clima || saveMutation.isPending}
              style={backButtonStyle(!clima || saveMutation.isPending)}
            >
              {saveMutation.isPending ? 'Salvando...' : 'Voltar'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 24%)',
  maxWidth: '430px',
  margin: '0 auto',
}

const panelStyle: CSSProperties = {
  borderRadius: '22px',
  background: '#fff',
  border: '1px solid rgba(15,23,42,0.06)',
  boxShadow: '0 10px 22px rgba(15,23,42,0.05)',
  padding: '18px 16px',
  display: 'grid',
  gap: '16px',
}

const loadingTextStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
        padding: '0 16px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onBack}
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
      <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>Diario de obras</div>
    </div>
  )
}

function FeedbackBox({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #fecaca',
        borderRadius: '14px',
        padding: '14px',
        background: '#fef2f2',
        color: '#b91c1c',
        fontSize: '14px',
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  )
}

function backButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: '22px',
    background: disabled ? '#9ca3af' : '#4b5563',
    color: '#fff',
    minHeight: '64px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 14px 28px rgba(75,85,99,0.18)',
    marginTop: '8px',
  }
}
