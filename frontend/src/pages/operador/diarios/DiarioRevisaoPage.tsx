import { type CSSProperties, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { diarioService, extractApiErrorMessage } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

export default function DiarioRevisaoPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState('')
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [markedOnce, setMarkedOnce] = useState(false)

  const diarioQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const routeEquipmentId = Number(equipamentoId || '') || null
  const currentEquipmentId = diarioQuery.data?.equipamentoId ?? routeEquipmentId
  const backUrl = `/operador/diario-de-obras/novo/${currentEquipmentId || equipamentoId || ''}`
  const pdfUrl = `${diarioService.getPdfUrl(diarioId)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`

  const markReviewedMutation = useMutation({
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
          revisao_confirmed: true,
          review_confirmed: true,
        },
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  useEffect(() => {
    const json = (diarioQuery.data?.dadosJson as Record<string, unknown> | null) || {}
    const alreadyReviewed = json.revisao_confirmed === true || json.review_confirmed === true
    if (!pdfLoaded || markedOnce || !diarioQuery.data || alreadyReviewed) return
    markReviewedMutation.mutate()
    setMarkedOnce(true)
  }, [diarioQuery.data, markReviewedMutation, markedOnce, pdfLoaded])

  return (
    <div style={pageStyle}>
      <Header title="Revisao do diario" onBack={() => navigate(backUrl)} />

      <div style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0, flex: 1 }}>
        {diarioQuery.isLoading ? <div style={mutedTextStyle}>Carregando diario...</div> : null}
        {diarioQuery.isError ? <FeedbackBox>{extractApiErrorMessage(diarioQuery.error)}</FeedbackBox> : null}
        {submitError ? <FeedbackBox>{submitError}</FeedbackBox> : null}

        {!diarioQuery.isLoading && !diarioQuery.isError ? (
          <div style={viewerWrapStyle}>
            <iframe
              title="Preview PDF do diario"
              src={pdfUrl}
              style={iframeStyle}
              onLoad={() => setPdfLoaded(true)}
            />
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

const viewerWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 'calc(100dvh - 72px)',
  overflow: 'hidden',
  background: '#fff',
  border: 'none',
  boxShadow: 'none',
}

const iframeStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 'calc(100dvh - 72px)',
  border: 'none',
  background: '#fff',
}

const mutedTextStyle: CSSProperties = {
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

function FeedbackBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin: '12px 12px 0',
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
