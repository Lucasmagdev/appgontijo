import { type CSSProperties, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, MessageCircle, PenTool, Send, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { diarioService, diarioSignatureService, extractApiErrorMessage, type DiaryCompletionResult } from '@/lib/gontijo-api'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'

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
  const queryClient = useQueryClient()
  const { user } = useOperadorAuth()
  const [completionResult, setCompletionResult] = useState<DiaryCompletionResult | null>(null)
  const [showRewardOverlay, setShowRewardOverlay] = useState(false)
  const [sharing, setSharing] = useState(false)
  const canGenerateSignatureLink = Boolean(user?.podeGerarLinkAssinatura)
  const backUrl = `/operador/diario-de-obras/novo/${equipamentoId || ''}?diario=${diarioId}`

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
  const diaryJson = (diary?.dadosJson as Record<string, unknown> | null) || {}
  const operatorCompletedAt = String(diaryJson.operator_completed_at || '')
  const operatorCompletedLate = diaryJson.operator_completed_late === true
  const isOperatorCompleted = Boolean(operatorCompletedAt) || Boolean(completionResult?.completed)
  const isCompletionLate = operatorCompletedLate || completionResult?.late
  const isCompletionSuccess = isOperatorCompleted && !isCompletionLate

  const missingRequired = (() => {
    if (isOperatorCompleted) return [] as string[]
    const list: string[] = []
    if (!String(diaryJson.date || '').trim()) list.push('Data')
    if (!String(diaryJson.start || '').trim()) list.push('Entrada')
    if (!String(diaryJson.end || '').trim()) list.push('Saida')
    const staff = Array.isArray(diaryJson.staff) ? diaryJson.staff : []
    const hasStaff = staff.some((item) => {
      if (typeof item === 'string') return Boolean(item.trim())
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>
        return Boolean(String(row.item || row.name || '').trim())
      }
      return false
    })
    if (!hasStaff) list.push('Equipe')
    return list
  })()
  const hasPendencias = missingRequired.length > 0

  const concludeMutation = useMutation({
    mutationFn: () => diarioService.conclude(diarioId),
    onSuccess: async (result) => {
      setCompletionResult(result)
      setShowRewardOverlay(true)
      await queryClient.invalidateQueries({ queryKey: ['operador-diario', diarioId] })
      await queryClient.invalidateQueries({ queryKey: ['operador-diario-draft'] })
      await queryClient.invalidateQueries({ queryKey: ['operador-cursos-pontos'] })
      window.setTimeout(() => setShowRewardOverlay(false), 3100)
    },
  })

  async function handleEnviarGrupo() {
    if (sharing) return
    const pdfUrl = diarioService.getPdfUrl(diarioId)
    const mensagem = [
      'Diário de obra concluído',
      `Obra: ${signatureStatus?.obraNumero || '-'}`,
      `Máquina: ${signatureStatus?.equipamento || '-'}`,
      `Data: ${formatDateBr(signatureStatus?.dataDiario || '')}`,
    ].join('\n')
    const filename = `diario-${(signatureStatus?.equipamento || diarioId).toString().replace(/\s+/g, '-')}-${signatureStatus?.dataDiario || ''}.pdf`

    setSharing(true)
    try {
      // Busca o PDF autenticado (cookie) e compartilha o arquivo. Assim o grupo
      // recebe o PDF anexado, sem precisar de sessao para abrir um link.
      const resp = await fetch(pdfUrl, { credentials: 'include' })
      if (!resp.ok) throw new Error('pdf')
      const blob = await resp.blob()
      const file = new File([blob], filename, { type: 'application/pdf' })
      const navAny = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        // Abre a folha de compartilhamento -> WhatsApp -> tela de "quem enviar"
        await navigator.share({ files: [file], title: 'Diário de obra', text: mensagem })
        return
      }
      // Sem Web Share de arquivos (ex.: desktop): abre o PDF para anexar manualmente
      const objectUrl = URL.createObjectURL(blob)
      window.open(objectUrl, '_blank', 'noopener,noreferrer')
      window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return
      window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div style={pageStyle}>
      <RewardOverlay result={completionResult} visible={showRewardOverlay} />
      <Header title="Finalizar diario" onBack={() => navigate(backUrl)} />

      <div style={{ padding: '22px 18px 28px', display: 'grid', gap: '18px' }}>
        {diaryQuery.isLoading || signatureStatusQuery.isLoading ? <InfoBox>Carregando situacao final do diario...</InfoBox> : null}
        {diaryQuery.isError ? <ErrorBox>{extractApiErrorMessage(diaryQuery.error)}</ErrorBox> : null}
        {signatureStatusQuery.isError ? <ErrorBox>{extractApiErrorMessage(signatureStatusQuery.error)}</ErrorBox> : null}
        {concludeMutation.isError ? <ErrorBox>{extractApiErrorMessage(concludeMutation.error)}</ErrorBox> : null}

        {diary && signatureStatus ? (
          <>
            <div style={panelStyle}>
              <div style={{ fontSize: '24px', fontWeight: 900, color: isOperatorCompleted ? (isCompletionSuccess ? '#15803d' : '#a72727') : '#a72727' }}>
                {isOperatorCompleted
                  ? isCompletionSuccess
                    ? 'Diário concluído no prazo'
                    : 'Diário concluído com atraso'
                  : 'Concluir diário'}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                {isOperatorCompleted
                  ? isCompletionSuccess
                    ? 'Boa. Este diário foi concluído dentro do prazo e pontuou no app.'
                    : 'O diário foi registrado, mas passou do prazo de pontuação.'
                  : 'Toque em concluir quando todas as informações do diário estiverem revisadas.'}
              </div>

              <SummaryRow label="Obra" value={signatureStatus.obraNumero || '-'} />
              <SummaryRow label="Maquina" value={signatureStatus.equipamento || '-'} />
              <SummaryRow label="Data" value={formatDateBr(signatureStatus.dataDiario)} />
              <SummaryRow label="Status do link" value={signatureStatus.status.replace(/_/g, ' ')} />
              <SummaryRow label="Enviado em" value={signatureStatus.sentAt ? formatDateTimeBr(signatureStatus.sentAt) : '-'} />
              <SummaryRow label="Expira em" value={signatureStatus.expiresAt ? formatDateTimeBr(signatureStatus.expiresAt) : '-'} />
              <SummaryRow label="Assinado em" value={signatureStatus.signedAt ? formatDateTimeBr(signatureStatus.signedAt) : '-'} />
              <SummaryRow label="Cliente assinante" value={signatureStatus.clientName || '-'} />
              {operatorCompletedAt ? <SummaryRow label="Concluido pelo operador" value={formatDateTimeBr(operatorCompletedAt)} /> : null}
            </div>

            <div style={panelStyle}>
              {hasPendencias ? (
                <ErrorBox>
                  Preencha antes de concluir: {missingRequired.join(', ')}.
                </ErrorBox>
              ) : null}

              <button
                onClick={() => concludeMutation.mutate()}
                disabled={concludeMutation.isPending || isOperatorCompleted || hasPendencias}
                style={completeButtonStyle(concludeMutation.isPending || isOperatorCompleted || hasPendencias, isCompletionSuccess)}
              >
                {isOperatorCompleted ? <CheckCircle2 size={19} /> : <Trophy size={19} />}
                {concludeMutation.isPending
                  ? 'Concluindo diario...'
                  : isOperatorCompleted
                    ? 'Diario concluido'
                    : 'Concluir diario'}
              </button>

              {isOperatorCompleted ? (
                <>
                  {isCompletionSuccess ? (
                    <SuccessBox>
                      +{completionResult?.points || 5} Pontos Gontijo registrados! Continue assim.
                    </SuccessBox>
                  ) : (
                    <ErrorBox>
                      Diário realizado com atraso. Sem pontos desta vez.
                    </ErrorBox>
                  )}

                  <button onClick={handleEnviarGrupo} disabled={sharing} style={actionButtonStyle('#128c4a')}>
                    <MessageCircle size={18} />
                    {sharing ? 'Preparando PDF...' : 'Enviar para grupo da maquina'}
                  </button>

                  {canGenerateSignatureLink ? (
                    <button
                      onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId || ''}/assinatura?diario=${diarioId}`)}
                      style={actionButtonStyle(isSigned ? '#166534' : '#a72727')}
                    >
                      {isSigned ? <CheckCircle2 size={18} /> : <Send size={18} />}
                      {isSigned ? 'Ver assinatura do cliente' : 'Ir para envio de assinatura'}
                    </button>
                  ) : (
                    <InfoBox>O link de assinatura sera gerado pelo administrativo ou pela conferencia autorizada.</InfoBox>
                  )}

                  <button
                    onClick={() => window.open(diarioService.getPdfUrl(diarioId), '_blank', 'noopener,noreferrer')}
                    style={secondaryButtonStyle}
                  >
                    <FileText size={18} />
                    Abrir PDF do diario
                  </button>

                  {!isSigned && canGenerateSignatureLink ? (
                    <button
                      onClick={() => navigate(`/operador/diario-de-obras/novo/${equipamentoId || ''}/assinatura?diario=${diarioId}`)}
                      style={secondaryButtonStyle}
                    >
                      <PenTool size={18} />
                      Acompanhar assinatura pendente
                    </button>
                  ) : null}
                </>
              ) : (
                <InfoBox>Conclua o diário acima para liberar o envio ao grupo, o PDF e a assinatura.</InfoBox>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function RewardOverlay({ result, visible }: { result: DiaryCompletionResult | null; visible: boolean }) {
  if (!visible || !result) return null

  const isLate = result.late || !result.awarded
  const isSuccess = result.awarded && !result.late

  return (
    <div style={{ ...rewardOverlayStyle, background: isSuccess ? 'rgba(5, 150, 105, 0.92)' : 'rgba(60, 6, 10, 0.96)' }}>
      <style>{rewardOverlayCss}</style>
      <div style={rewardGridStyle}>
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            className={isSuccess ? 'diary-reward-spark diary-reward-spark--success' : isLate ? 'diary-reward-spark diary-reward-spark--late' : 'diary-reward-spark'}
            style={{
              left: `${12 + ((index * 17) % 76)}%`,
              top: `${18 + ((index * 23) % 64)}%`,
              animationDelay: `${index * 46}ms`,
            }}
          />
        ))}
        <div style={rewardBadgeStyle(isSuccess)}>
          {isSuccess ? `+${result.points || 5}` : '!' }
        </div>
        <div style={rewardTitleStyle}>
          {isSuccess ? 'Diário concluído no prazo' : 'Diário realizado com atraso'}
        </div>
        <div style={rewardSubtitleStyle}>
          {isSuccess ? 'Pontos Gontijo liberados! Continue assim.' : 'Sem pontos desta vez. Conclua até 08:00 para pontuar.'}
        </div>
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

function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div style={{ ...boxStyle, borderColor: '#a7f3d0', background: '#dcfce7', color: '#065f46' }}>{children}</div>
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

function completeButtonStyle(disabled: boolean, success: boolean): CSSProperties {
  return {
    border: 'none',
    borderRadius: '18px',
    background: success
      ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
      : disabled
        ? '#cbd5e1'
        : 'linear-gradient(180deg, #b42b2b 0%, #981f1f 100%)',
    color: '#fff',
    minHeight: '58px',
    fontSize: '17px',
    fontWeight: 900,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: success ? '0 12px 24px rgba(22,163,74,0.18)' : '0 12px 24px rgba(167,39,39,0.18)',
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

const rewardOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147482000,
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  color: '#fff',
}

const rewardGridStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 360px)',
  minHeight: '320px',
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: '14px',
  overflow: 'hidden',
}

function rewardBadgeStyle(success: boolean): CSSProperties {
  return {
    width: '132px',
    height: '132px',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    background: success
      ? 'radial-gradient(circle at 38% 28%, #a7f3d0 0%, #22c55e 42%, #115e59 100%)'
      : 'radial-gradient(circle at 38% 28%, #ef4444 0%, #a72727 48%, #5f1111 100%)',
    boxShadow: success
      ? '0 0 52px rgba(16,185,129,0.56), 0 18px 44px rgba(0,0,0,0.36)'
      : '0 0 44px rgba(239,68,68,0.42), 0 18px 44px rgba(0,0,0,0.36)',
    fontSize: '58px',
    fontWeight: 950,
    letterSpacing: '0',
    animation: 'diary-reward-pop 620ms cubic-bezier(.18,.9,.2,1.18) both',
    color: success ? '#064e3b' : '#fff',
  }
}

const rewardTitleStyle: CSSProperties = {
  marginTop: '10px',
  fontSize: '24px',
  lineHeight: 1.05,
  fontWeight: 950,
  textAlign: 'center',
}

const rewardSubtitleStyle: CSSProperties = {
  maxWidth: '280px',
  color: 'rgba(255,255,255,0.76)',
  fontSize: '14px',
  lineHeight: 1.45,
  fontWeight: 700,
  textAlign: 'center',
}

const rewardOverlayCss = `
@keyframes diary-reward-pop {
  0% { opacity: 0; transform: scale(.72); }
  68% { opacity: 1; transform: scale(1.06); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes diary-reward-spark {
  0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(.4); }
  18% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(calc(-50% + var(--dx, 0px)), calc(-50% - 120px), 0) scale(1); }
}

.diary-reward-spark {
  --dx: 28px;
  position: absolute;
  width: 4px;
  height: 20px;
  border-radius: 999px;
  background: linear-gradient(180deg, #fff, #a72727);
  box-shadow: 0 0 16px rgba(167,39,39,.72);
  animation: diary-reward-spark 1250ms ease-out both;
}

.diary-reward-spark:nth-child(2n) {
  --dx: -36px;
  width: 3px;
  height: 16px;
  background: #fff;
}

.diary-reward-spark:nth-child(3n) {
  --dx: 54px;
  background: #a72727;
}

.diary-reward-spark--late {
  background: linear-gradient(180deg, #fecaca, #ef4444);
  box-shadow: 0 0 18px rgba(239,68,68,.62);
}

.diary-reward-spark--success {
  background: linear-gradient(180deg, #bbf7d0, #22c55e);
  box-shadow: 0 0 18px rgba(34,197,94,.72);
}
`
