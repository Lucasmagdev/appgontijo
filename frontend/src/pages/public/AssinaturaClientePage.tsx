import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, Paperclip, RotateCcw, Trash2 } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { diarioSignatureService, extractApiErrorMessage, type PublicDiaryAttachment } from '@/lib/gontijo-api'

type FormState = {
  nome: string
  documento: string
  assinatura: string
  observacao: string
  anexos: PublicDiaryAttachment[]
}

const EMPTY_FORM: FormState = {
  nome: '',
  documento: '',
  assinatura: '',
  observacao: '',
  anexos: [],
}

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024
const ACCEPTED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

function formatDateBr(value: string) {
  const text = String(value || '')
  const [year, month, day] = text.split('-')
  if (!year || !month || !day) return text
  return `${day}/${month}/${year}`
}

function formatDateTimeBr(value: string) {
  const text = String(value || '').trim()
  if (!text) return ''
  const parsed = new Date(text)
  const fallbackParsed = Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2} /.test(text)
    ? new Date(text.replace(' ', 'T'))
    : parsed
  if (Number.isNaN(fallbackParsed.getTime())) return text
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fallbackParsed)
}

export default function AssinaturaClientePage() {
  const { token } = useParams()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
      observacao: data.clientObservationText || '',
      anexos: data.clientAttachments || [],
    })
  }, [signatureQuery.data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#111827'

    if (!form.assinatura) return

    const image = new Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
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
        observacao: form.observacao.trim(),
        anexos: form.anexos,
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
  }

  function saveSignatureFromCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    setField('assinatura', canvas.toDataURL('image/png'))
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isBlocked) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    drawAt(event.clientX, event.clientY, false)
  }

  function moveDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isBlocked || !drawingRef.current) return
    event.preventDefault()
    drawAt(event.clientX, event.clientY, true)
  }

  function stopDrawing(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    saveSignatureFromCanvas()
  }

  function clearSignature() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setField('assinatura', '')
  }

  async function handleAttachmentChange(files: FileList | null) {
    if (!files || isBlocked) return
    setSubmitError('')

    const current = form.anexos
    const selected = Array.from(files)
    if (current.length + selected.length > MAX_ATTACHMENTS) {
      setSubmitError(`Envie no maximo ${MAX_ATTACHMENTS} anexos.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const converted: PublicDiaryAttachment[] = []
    for (const file of selected) {
      if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
        setSubmitError('Use apenas imagens PNG/JPG/WEBP ou arquivos PDF.')
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        setSubmitError('Cada anexo pode ter no maximo 5 MB.')
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      converted.push({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
      })
    }

    setField('anexos', [...current, ...converted])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeAttachment(index: number) {
    setField('anexos', form.anexos.filter((_, current) => current !== index))
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
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827' }}>Observacoes do cliente</div>
              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                Observacoes pertinentes ou o que o cliente gostaria de adicionar ao diario para assinar.
              </div>

              <label style={fieldWrapStyle}>
                <span style={fieldLabelStyle}>Observacoes</span>
                <textarea
                  value={form.observacao}
                  onChange={(event) => setField('observacao', event.target.value)}
                  disabled={isBlocked}
                  rows={5}
                  style={textareaStyle(isBlocked)}
                  placeholder="Escreva aqui uma observacao opcional para constar no diario."
                />
              </label>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={(event) => void handleAttachmentChange(event.target.files)}
              />

              {!isBlocked ? (
                <button type="button" onClick={() => fileInputRef.current?.click()} style={secondaryButtonStyle}>
                  <Paperclip size={16} />
                  Adicionar anexo
                </button>
              ) : null}

              {form.anexos.length ? (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {form.anexos.map((anexo, index) => (
                    <div key={`${anexo.name}-${index}`} style={attachmentRowStyle}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anexo.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{formatFileSize(anexo.size)} · {formatMimeType(anexo.type)}</div>
                      </div>
                      {!isBlocked ? (
                        <button type="button" onClick={() => removeAttachment(index)} style={iconButtonStyle}>
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
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
                    onPointerDown={startDrawing}
                    onPointerMove={moveDrawing}
                    onPointerUp={stopDrawing}
                    onPointerCancel={stopDrawing}
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler anexo.'))
    reader.readAsDataURL(file)
  })
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return '0 KB'
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${Math.ceil(size / 1024)} KB`
}

function formatMimeType(type: string) {
  if (type === 'application/pdf') return 'PDF'
  if (type.startsWith('image/')) return 'Imagem'
  return type || 'Arquivo'
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

function textareaStyle(disabled: boolean): CSSProperties {
  return {
    borderRadius: '16px',
    border: '1.5px solid #d8dee7',
    background: disabled ? '#f8fafc' : '#fff',
    color: '#111827',
    padding: '14px 16px',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: 1.45,
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '130px',
    fontFamily: 'inherit',
  }
}

const attachmentRowStyle: CSSProperties = {
  minHeight: '56px',
  borderRadius: '14px',
  border: '1px solid #e5e7eb',
  background: '#f8fafc',
  padding: '10px 12px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '10px',
}

const iconButtonStyle: CSSProperties = {
  border: '1px solid #fecaca',
  borderRadius: '12px',
  background: '#fff',
  color: '#b91c1c',
  width: '38px',
  height: '38px',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}

const signaturePreviewWrap: CSSProperties = {
  borderRadius: '18px',
  border: '1.5px solid #e5e7eb',
  background: 'transparent',
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
