import { type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, PenTool, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, diarioSignatureService, extractApiErrorMessage } from '@/lib/gontijo-api'

type Props = {
  diarioId: number
  equipamentoId?: string
}

function formatDateBr(value: string) {
  const text = String(value || '')
  const [year, month, day] = text.split('-')
  if (!year || !month || !day) return text
  return `${day}/${month}/${year}`
}

function formatDateTimeBr(value: string) {
  const text = String(value || '').trim()
  if (!text) return ''
  const parsed = new Date(text.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return text
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

export default function DiarioFinalizacaoPage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const backUrl = `/operador/diario-de-obras/novo/${equipamentoId || ''}`

  const diaryQuery = useQuery({
    queryKey: ['operador-diario', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioService.getById(diarioId),
  })

  const signatureStatusQuery = useQuery({
    queryKey: ['operador-diario-signature-link', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioSignatureService.getStatus(diarioId),
  })

  const diary = diaryQuery.data
  const signatureStatus = signatureStatusQuery.data
  const isSigned = signatureStatus?.status === 'assinado' || diary?.status === 'assinado'

  return (
    <div style={pageStyle}>
      <Header title="Finalizar diario" onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        {diaryQuery.isLoading || signatureStatusQuery.isLoading ? <InfoBox>Carregando situacao final do diario...</InfoBox> : null}
        {diaryQuery.isError ? <ErrorBox>{extractApiErrorMessage(diaryQuery.error)}</ErrorBox> : null}
        {signatureStatusQuery.isError ? <ErrorBox>{extractApiErrorMessage(signatureStatusQuery.error)}</ErrorBox> : null}

        {diary && signatureStatus ? (
          <>
            <div style={panelStyle}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: isSigned ? '#15803d' : '#a72727' }}>
                {isSigned ? 'Diario assinado' : 'Aguardando assinatura'}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                {isSigned
                  ? 'O cliente ja concluiu a assinatura. O diario agora esta fechado oficialmente.'
                  : 'O diario so sera considerado assinado depois que o cliente concluir a assinatura pelo link enviado.'}
              </div>

              <SummaryRow label="Obra" value={signatureStatus.obraNumero || '-'} />
              <SummaryRow label="Maquina" value={signatureStatus.equipamento || '-'} />
              <SummaryRow label="Data" value={formatDateBr(signatureStatus.dataDiario)} />
              <SummaryRow label="Status do link" value={signatureStatus.status.replace(/_/g, ' ')} />
              <SummaryRow label="Expira em" value={signatureStatus.expiresAt ? formatDateTimeBr(signatureStatus.expiresAt) : '-'} />
              <SummaryRow label="Assinado em" value={signatureStatus.signedAt ? formatDateTimeBr(signatureStatus.signedAt) : '-'} />
              <SummaryRow label="Cliente assinante" value={signatureStatus.clientName || '-'} />
            </div>

            <div style={panelStyle}>
              <button
                onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId || ''}/assinatura?diario=${diarioId}`)}
                style={actionButtonStyle(isSigned ? '#166534' : '#a72727')}
              >
                {isSigned ? <CheckCircle2 size={18} /> : <Send size={18} />}
                {isSigned ? 'Ver assinatura do cliente' : 'Ir para envio de assinatura'}
              </button>

              <button
                onClick={() => window.open(diarioService.getPdfUrl(diarioId), '_blank', 'noopener,noreferrer')}
                style={secondaryButtonStyle}
              >
                <FileText size={18} />
                Abrir PDF do diario
              </button>

              {!isSigned ? (
                <button
                  onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId || ''}/assinatura?diario=${diarioId}`)}
                  style={secondaryButtonStyle}
                >
                  <PenTool size={18} />
                  Acompanhar assinatura pendente
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
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
      <button onClick={onBack} style={headerButtonStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div style={{ color: '#fff', fontSize: '21px', fontWeight: 800 }}>{title}</div>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: '4px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{value || '-'}</div>
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ ...boxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{children}</div>
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div style={{ ...boxStyle, borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }}>{children}</div>
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
  borderRadius: '24px',
  background: '#fff',
  border: '1px solid rgba(167,39,39,0.14)',
  boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
  padding: '20px 18px',
  display: 'grid',
  gap: '12px',
}

const boxStyle: CSSProperties = {
  border: '1px solid',
  borderRadius: '14px',
  padding: '14px',
  fontSize: '14px',
  fontWeight: 700,
}

const headerButtonStyle: CSSProperties = {
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
}

function actionButtonStyle(color: string): CSSProperties {
  return {
    border: 'none',
    borderRadius: '18px',
    background: `linear-gradient(180deg, ${color} 0%, ${color === '#166534' ? '#15803d' : '#981f1f'} 100%)`,
    color: '#fff',
    minHeight: '54px',
    fontSize: '16px',
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  background: '#fff',
  color: '#374151',
  minHeight: '50px',
  fontSize: '15px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}
