import { type CSSProperties, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '56px',
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: '#f8fafc',
  padding: '0 16px',
  fontSize: '18px',
  fontWeight: 700,
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function DiarioHorimetroPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [horimetro, setHorimetro] = useState('')
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
    setHorimetro(String(json.horimetro || ''))
  }, [diarioQuery.data?.dadosJson])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!diarioQuery.data) throw new Error('Diario nao carregado.')
      const currentJson = (diarioQuery.data.dadosJson as Record<string, unknown> | null) || {}
      await diarioService.update(diarioId, {
        dataDiario: diarioQuery.data.dataDiario,
        status: diarioQuery.data.status,
        equipamentoId: diarioQuery.data.equipamentoId,
        assinadoEm: diarioQuery.data.assinadoEm,
        dadosJson: {
          ...currentJson,
          horimetro: horimetro.trim(),
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
      <Header title="Diario de obras" onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconBadge><Clock3 size={22} color="#a72727" /></IconBadge>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Horimetro</div>
        </div>

        {diarioQuery.isLoading ? <div style={loadingTextStyle}>Carregando dados do diario...</div> : null}
        {diarioQuery.isError ? <FeedbackBox>{extractApiErrorMessage(diarioQuery.error)}</FeedbackBox> : null}

        {!diarioQuery.isLoading && !diarioQuery.isError ? (
          <div style={panelStyle}>
            <label style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>
                Informe o horimetro no final do dia:
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={horimetro}
                onChange={(event) => {
                  setHorimetro(event.target.value)
                  setSubmitError('')
                }}
                style={inputStyle}
              />
            </label>

            {submitError ? <FeedbackBox>{submitError}</FeedbackBox> : null}

            <button
              onClick={() => saveMutation.mutate()}
              disabled={!horimetro.trim() || saveMutation.isPending}
              style={backButtonStyle(!horimetro.trim() || saveMutation.isPending)}
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

function Header({ title, onBack }: { title: string; onBack: () => void }) {
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
      <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>{title}</div>
    </div>
  )
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '42px',
        height: '42px',
        borderRadius: '14px',
        background: '#fff1f1',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

function FeedbackBox({ children }: { children: React.ReactNode }) {
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
