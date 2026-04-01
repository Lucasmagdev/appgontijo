import { type CSSProperties, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, MessageCircle, RefreshCcw, Send, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioSignatureService, extractApiErrorMessage } from '@/lib/gontijo-api'

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
  const normalized = text.replace(' ', 'T')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return text
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function buildFallbackWhatsappText(status: {
  obraNumero: string
  equipamento: string
  dataDiario: string
  publicUrl: string
}) {
  return `Ola! Segue o link para assinatura do diario da obra ${status.obraNumero || '-'}, maquina ${status.equipamento || '-'}, referente ao dia ${formatDateBr(status.dataDiario)}: ${status.publicUrl}\n\nEste link expira em 24 horas.`
}

export default function DiarioAssinaturaClientePage({ diarioId, equipamentoId }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const statusQuery = useQuery({
    queryKey: ['operador-diario-signature-link', diarioId],
    enabled: diarioId > 0,
    queryFn: () => diarioSignatureService.getStatus(diarioId),
  })

  const status = statusQuery.data
  const backUrl = `/operador/diario-de-obras/novo/${equipamentoId || ''}`

  const generateMutation = useMutation({
    mutationFn: () => diarioSignatureService.generate(diarioId),
    onSuccess: async (result) => {
      setErrorMessage('')
      setFeedback('Link de assinatura gerado com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-signature-link', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      copyToClipboard(result.publicUrl, 'Link copiado para a area de transferencia.')
    },
    onError: (error) => setErrorMessage(extractApiErrorMessage(error)),
  })

  const shareText = useMemo(() => {
    if (!status) return ''
    return status.whatsappText || buildFallbackWhatsappText(status)
  }, [status])

  function copyToClipboard(text: string, successMessage = 'Link copiado para a area de transferencia.') {
    if (!text) return
    setErrorMessage('')

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => setFeedback(successMessage))
        .catch(() => setErrorMessage('Nao foi possivel copiar o link automaticamente.'))
      return
    }

    setFeedback(text)
  }

  function openWhatsapp() {
    if (!status?.publicUrl) return
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const statusTone =
    status?.status === 'assinado'
      ? {
          background: '#dcfce7',
          color: '#166534',
          border: '#86efac',
          label: 'Cliente assinou',
        }
      : status?.status === 'aguardando_assinatura'
        ? {
            background: '#fef3c7',
            color: '#92400e',
            border: '#fcd34d',
            label: 'Aguardando assinatura',
          }
        : status?.status === 'expirado'
          ? {
              background: '#fee2e2',
              color: '#b91c1c',
              border: '#fca5a5',
              label: 'Link expirado',
            }
          : {
              background: '#e5e7eb',
              color: '#374151',
              border: '#d1d5db',
              label: 'Link ainda nao gerado',
            }

  return (
    <div style={pageStyle}>
      <Header title="Assinatura do cliente" onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        {statusQuery.isLoading ? <MutedBox>Carregando status da assinatura...</MutedBox> : null}
        {statusQuery.isError ? <FeedbackBox>{extractApiErrorMessage(statusQuery.error)}</FeedbackBox> : null}
        {errorMessage ? <FeedbackBox>{errorMessage}</FeedbackBox> : null}
        {feedback ? <SuccessBox>{feedback}</SuccessBox> : null}

        {status ? (
          <>
            <div style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#a72727' }}>Enviar para assinatura</div>
                <div
                  style={{
                    borderRadius: '999px',
                    padding: '8px 12px',
                    background: statusTone.background,
                    color: statusTone.color,
                    border: `1px solid ${statusTone.border}`,
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  {statusTone.label}
                </div>
              </div>

              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                Gere um link de 24 horas, compartilhe no WhatsApp e acompanhe quando o cliente concluir a assinatura.
              </div>

              {!status.reviewConfirmed ? (
                <WarningBox>
                  Revise o PDF do diario antes de enviar para assinatura do cliente.
                </WarningBox>
              ) : null}

              <SummaryRow label="Obra" value={status.obraNumero || '-'} />
              <SummaryRow label="Maquina" value={status.equipamento || '-'} />
              <SummaryRow label="Data" value={formatDateBr(status.dataDiario)} />
              <SummaryRow label="Expira em" value={status.expiresAt ? formatDateTimeBr(status.expiresAt) : '-'} />
              <SummaryRow label="Assinado em" value={status.signedAt ? formatDateTimeBr(status.signedAt) : '-'} />
            </div>

            <div style={panelStyle}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Assinatura do operador</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Essa assinatura vai junto no documento final enviado para o cliente.
              </div>
              <SummaryRow label="Operador" value={status.operatorName || '-'} />
              <SummaryRow label="Documento" value={status.operatorDocument || '-'} />

              <div style={signaturePreviewWrap}>
                {status.operatorSignature ? (
                  <img src={status.operatorSignature} alt="Assinatura do operador" style={signatureImageStyle} />
                ) : (
                  <div style={emptySignatureText}>Cadastre a assinatura no perfil do operador para liberar o envio.</div>
                )}
              </div>
            </div>

            <div style={panelStyle}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Acoes</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                <button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  style={primaryButtonStyle(generateMutation.isPending)}
                >
                  {status.status === 'nao_gerado' ? <Send size={18} /> : <RefreshCcw size={18} />}
                  {generateMutation.isPending
                    ? 'Gerando link...'
                    : status.status === 'nao_gerado'
                      ? 'Gerar link de assinatura'
                      : 'Gerar novo link'}
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => copyToClipboard(status.publicUrl)}
                    disabled={!status.publicUrl}
                    style={secondaryButtonStyle(!status.publicUrl)}
                  >
                    <Copy size={16} />
                    Copiar link
                  </button>
                  <button
                    onClick={openWhatsapp}
                    disabled={!status.publicUrl}
                    style={secondaryButtonStyle(!status.publicUrl)}
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </button>
                </div>

                {status.status === 'assinado' ? (
                  <button
                    onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId || ''}/finalizar?diario=${diarioId}`)}
                    style={signedButtonStyle}
                  >
                    <ShieldCheck size={18} />
                    Assinatura concluida
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
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

function FeedbackBox({ children }: { children: React.ReactNode }) {
  return <div style={feedbackStyle('#fecaca', '#fef2f2', '#b91c1c')}>{children}</div>
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div style={feedbackStyle('#bbf7d0', '#f0fdf4', '#166534')}>{children}</div>
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return <div style={feedbackStyle('#fde68a', '#fffbeb', '#92400e')}>{children}</div>
}

function MutedBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        background: '#fff',
        padding: '16px',
        color: '#6b7280',
        fontSize: '14px',
      }}
    >
      {children}
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
  borderRadius: '24px',
  background: '#fff',
  border: '1px solid rgba(167,39,39,0.14)',
  boxShadow: '0 18px 32px rgba(15,23,42,0.08)',
  padding: '20px 18px',
  display: 'grid',
  gap: '12px',
}

const signaturePreviewWrap: CSSProperties = {
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: '#f3f4f6',
  minHeight: '130px',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
}

const signatureImageStyle: CSSProperties = {
  width: '100%',
  maxHeight: '130px',
  objectFit: 'contain',
  display: 'block',
}

const emptySignatureText: CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center',
  lineHeight: '1.5',
  padding: '16px',
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

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: '18px',
    background: disabled ? '#cbd5e1' : 'linear-gradient(180deg, #b42b2b 0%, #9b2121 100%)',
    color: '#fff',
    minHeight: '54px',
    fontSize: '16px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }
}

function secondaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    background: disabled ? '#f8fafc' : '#fff',
    color: disabled ? '#94a3b8' : '#374151',
    minHeight: '48px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }
}

const signedButtonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '18px',
  background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)',
  color: '#fff',
  minHeight: '52px',
  fontSize: '16px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}

function feedbackStyle(borderColor: string, background: string, color: string): CSSProperties {
  return {
    border: `1px solid ${borderColor}`,
    borderRadius: '14px',
    padding: '14px',
    background,
    color,
    fontSize: '14px',
    fontWeight: 700,
  }
}
