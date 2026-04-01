import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, RotateCcw } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { diarioSignatureService, extractApiErrorMessage } from '@/lib/gontijo-api'

type FormState = {
  nome: string
  documento: string
  assinatura: string
}

const EMPTY_FORM: FormState = {
  nome: '',
  documento: '',
  assinatura: '',
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

export default function AssinaturaClientePage() {
  const { token } = useParams()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')

  const signatureQuery = useQuery({
    queryKey: ['public-diary-signature', token],
    enabled: Boolean(token),
    queryFn: () => diarioSignatureService.getPublic(String(token)),
  })

  useEffect(() => {
    const data = signatureQuery.data
    if (!data) return

    setForm({
      nome: data.clientName || '',
      documento: data.clientDocument || '',
      assinatura: data.clientSignature || '',
    })
  }, [signatureQuery.data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#111827'

    if (!form.assinatura) return

    const image = new Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = form.assinatura
  }, [form.assinatura])

  const submitMutation = useMutation({
    mutationFn: () =>
      diarioSignatureService.submitPublic(String(token), {
        nome: form.nome.trim(),
        documento: form.documento.trim(),
        assinatura: form.assinatura,
      }),
    onSuccess: () => {
      setSubmitError('')
      void signatureQuery.refetch()
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  const data = signatureQuery.data
  const isSigned = data?.tokenStatus === 'signed'
  const isExpired = data?.tokenStatus === 'expired' || data?.tokenStatus === 'revoked'
  const isBlocked = isSigned || isExpired

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSubmitError('')
  }

  function drawAt(clientX: number, clientY: number, move: boolean) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (clientX - rect.left) * scaleX
    const y = (clientY - rect.top) * scaleY

    if (!move) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      return
    }

    ctx.lineTo(x, y)
    ctx.stroke()
    setField('assinatura', canvas.toDataURL('image/png'))
  }

  function startDrawing(clientX: number, clientY: number) {
    if (isBlocked) return
    drawingRef.current = true
    drawAt(clientX, clientY, false)
  }

  function moveDrawing(clientX: number, clientY: number) {
    if (isBlocked || !drawingRef.current) return
    drawAt(clientX, clientY, true)
  }

  function stopDrawing() {
    drawingRef.current = false
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setField('assinatura', '')
  }

  const canSubmit = useMemo(() => {
    return !isBlocked && Boolean(form.nome.trim() && form.documento.trim() && form.assinatura)
  }, [form, isBlocked])

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em' }}>Assinatura do diario</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.82)', lineHeight: '1.5' }}>
          Revise os dados e assine para concluir o diario de obra.
        </div>
      </div>

      <div style={{ padding: '20px 18px 32px', display: 'grid', gap: '18px' }}>
        {signatureQuery.isLoading ? <InfoBox>Carregando link de assinatura...</InfoBox> : null}
        {signatureQuery.isError ? <ErrorBox>{extractApiErrorMessage(signatureQuery.error)}</ErrorBox> : null}
        {submitError ? <ErrorBox>{submitError}</ErrorBox> : null}

        {data ? (
          <>
            <div style={panelStyle}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: isSigned ? '#15803d' : '#a72727' }}>
                  {isSigned ? 'Diario assinado com sucesso' : isExpired ? 'Link expirado' : 'Resumo do diario'}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
                  {isSigned
                    ? 'A assinatura foi registrada e o diario foi fechado.'
                    : isExpired
                      ? 'Este link passou da validade de 24 horas. Solicite um novo envio ao operador.'
                      : 'Confira os dados principais antes de registrar a sua assinatura.'}
                </div>
              </div>

              <SummaryRow label="Obra" value={data.obraNumero || '-'} />
              <SummaryRow label="Cliente" value={data.cliente || '-'} />
              <SummaryRow label="Maquina" value={data.equipamento || '-'} />
              <SummaryRow label="Data" value={formatDateBr(data.dataDiario)} />
              <SummaryRow label="Expira em" value={data.expiresAt ? formatDateTimeBr(data.expiresAt) : '-'} />
              <SummaryRow label="Assinado em" value={data.signedAt ? formatDateTimeBr(data.signedAt) : '-'} />

              <button
                onClick={() => window.open(data.pdfUrl, '_blank', 'noopener,noreferrer')}
                style={secondaryButtonStyle}
              >
                <FileText size={18} />
                Abrir PDF
              </button>
            </div>

            <div style={panelStyle}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Assinatura do operador</div>
              <div style={signaturePreviewWrap}>
                {data.operatorSignature ? (
                  <img src={data.operatorSignature} alt="Assinatura do operador" style={signatureImageStyle} />
                ) : (
                  <div style={emptySignatureStyle}>Assinatura do operador indisponivel.</div>
                )}
              </div>
              <SummaryRow label="Operador" value={data.operatorName || '-'} />
              <SummaryRow label="Documento" value={data.operatorDocument || '-'} />
            </div>

            <div style={panelStyle}>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Assinatura do cliente</div>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Nome do responsavel</span>
                <input
                  value={form.nome}
                  onChange={(event) => setField('nome', event.target.value)}
                  disabled={isBlocked}
                  style={inputStyle(isBlocked)}
                />
              </label>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Documento</span>
                <input
                  value={form.documento}
                  onChange={(event) => setField('documento', event.target.value)}
                  disabled={isBlocked}
                  style={inputStyle(isBlocked)}
                />
              </label>

              <div style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Desenhe a assinatura</span>
                <div style={signaturePreviewWrap}>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={220}
                    style={{
                      width: '100%',
                      height: '180px',
                      display: 'block',
                      touchAction: 'none',
                      cursor: isBlocked ? 'default' : 'crosshair',
                    }}
                    onPointerDown={(event) => startDrawing(event.clientX, event.clientY)}
                    onPointerMove={(event) => moveDrawing(event.clientX, event.clientY)}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                  />
                </div>
              </div>

              {!isBlocked ? (
                <button onClick={clearSignature} type="button" style={secondaryButtonStyle}>
                  <RotateCcw size={16} />
                  Limpar assinatura
                </button>
              ) : null}

              {isSigned ? (
                <div style={successStateStyle}>
                  <CheckCircle2 size={18} />
                  Assinatura concluida com sucesso.
                </div>
              ) : (
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={!canSubmit || submitMutation.isPending}
                  style={primaryButtonStyle(!canSubmit || submitMutation.isPending)}
                >
                  {submitMutation.isPending ? 'Enviando assinatura...' : 'Assinar diario'}
                </button>
              )}
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

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div style={{ ...boxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>{children}</div>
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div style={{ ...boxStyle, borderColor: '#e5e7eb', background: '#fff', color: '#6b7280' }}>{children}</div>
}

const pageStyle: CSSProperties = {
  minHeight: '100dvh',
  background: 'linear-gradient(180deg, #f8f3f2 0%, #ffffff 18%)',
  maxWidth: '640px',
  margin: '0 auto',
}

const headerStyle: CSSProperties = {
  background: 'linear-gradient(180deg, #a72727 0%, #981f1f 100%)',
  color: '#fff',
  padding: '28px 18px 24px',
  display: 'grid',
  gap: '8px',
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

const fieldWrapStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const fieldLabelStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  color: '#6b7280',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

function inputStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: '54px',
    borderRadius: '16px',
    border: '1.5px solid #d8dee7',
    background: disabled ? '#f8fafc' : '#fff',
    color: '#111827',
    padding: '0 16px',
    fontSize: '16px',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
  }
}

const signaturePreviewWrap: CSSProperties = {
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: '#f8fafc',
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

const emptySignatureStyle: CSSProperties = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center',
  lineHeight: '1.5',
  padding: '16px',
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
  }
}

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '16px',
  background: '#fff',
  color: '#374151',
  minHeight: '48px',
  fontSize: '14px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}

const successStateStyle: CSSProperties = {
  borderRadius: '16px',
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
  minHeight: '50px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  fontSize: '15px',
  fontWeight: 800,
}
