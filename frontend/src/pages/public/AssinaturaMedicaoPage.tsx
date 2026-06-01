import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, RotateCcw, Star } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { extractApiErrorMessage, medicaoSignaturePublicApi } from '@/lib/gontijo-api'

function formatDate(value: string) {
  const [year, month, day] = String(value || '').split('-')
  return day && month && year ? `${day}/${month}/${year}` : value
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AssinaturaMedicaoPage() {
  const { token } = useParams()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [assinatura, setAssinatura] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [npsNota, setNpsNota] = useState<number | null>(null)
  const [npsComentario, setNpsComentario] = useState('')
  const [npsSuccess, setNpsSuccess] = useState(false)

  const query = useQuery({
    queryKey: ['public-medicao-signature', token],
    enabled: Boolean(token),
    queryFn: () => medicaoSignaturePublicApi.get(String(token)),
  })

  const submitMutation = useMutation({
    mutationFn: () => medicaoSignaturePublicApi.submit(String(token), { nome: nome.trim(), documento: documento.trim(), assinatura }),
    onSuccess: () => {
      setSubmitError('')
      void query.refetch()
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  const npsMutation = useMutation({
    mutationFn: () => medicaoSignaturePublicApi.submitNps(String(token), { nota: npsNota ?? 0, comentario: npsComentario.trim() || undefined }),
    onSuccess: async () => {
      setSubmitError('')
      setNpsSuccess(true)
      await query.refetch()
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  const data = query.data
  const isSigned = data?.tokenStatus === 'signed'
  const isBlocked = isSigned || data?.tokenStatus === 'expired' || data?.tokenStatus === 'revoked'
  const isFinalMedicao = data?.tipoMedicao === 'final'
  const npsAnswered = Boolean(data?.npsRespondido || npsSuccess)
  const signatureLockedByNps = Boolean(isFinalMedicao && !npsAnswered && !isSigned)
  const showNps = Boolean(isFinalMedicao && !npsAnswered && !isBlocked)
  const canSubmit = useMemo(
    () => !isBlocked && !signatureLockedByNps && Boolean(nome.trim() && documento.trim() && assinatura),
    [assinatura, documento, isBlocked, nome, signatureLockedByNps]
  )

  function draw(clientX: number, clientY: number, move: boolean) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) * (canvas.width / rect.width)
    const y = (clientY - rect.top) * (canvas.height / rect.height)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2
    context.strokeStyle = '#111827'
    if (!move) {
      context.beginPath()
      context.moveTo(x, y)
    } else {
      context.lineTo(x, y)
      context.stroke()
    }
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isBlocked || signatureLockedByNps) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    draw(event.clientX, event.clientY, false)
  }

  function moveDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || isBlocked || signatureLockedByNps) return
    event.preventDefault()
    draw(event.clientX, event.clientY, true)
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setAssinatura(event.currentTarget.toDataURL('image/png'))
  }

  function clearSignature() {
    const context = canvasRef.current?.getContext('2d')
    if (context && canvasRef.current) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    setAssinatura('')
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-slate-50">
      <header className="bg-red-800 px-5 py-7 text-white">
        <h1 className="text-2xl font-black">Assinatura da medição</h1>
        <p className="mt-1 text-sm text-white/80">Confira o documento e assine para concluir a medição.</p>
      </header>
      <div className="grid gap-4 p-4">
        {query.isLoading && <Message>Carregando link de assinatura...</Message>}
        {query.isError && <ErrorMessage>{extractApiErrorMessage(query.error)}</ErrorMessage>}
        {submitError && <ErrorMessage>{submitError}</ErrorMessage>}
        {data && (
          <>
            {showNps ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Pesquisa NPS</h2>
                <div className="mt-4 grid gap-4">
                  <p className="text-sm font-semibold text-slate-700">De 0 a 10, o quanto você recomendaria a Gontijo?</p>
                  <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
                    {Array.from({ length: 11 }, (_, nota) => (
                      <button
                        key={nota}
                        type="button"
                        onClick={() => setNpsNota(nota)}
                        className={`rounded-lg border px-0 py-2 text-sm font-black transition ${npsNota === nota ? 'border-red-700 bg-red-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {nota}
                      </button>
                    ))}
                  </div>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    Comentário
                    <textarea className="field-input min-h-24" value={npsComentario} onChange={(event) => setNpsComentario(event.target.value)} placeholder="Opcional" />
                  </label>
                  <button type="button" onClick={() => npsMutation.mutate()} disabled={npsNota == null || npsMutation.isPending} className="btn btn-primary">
                    <Star size={16} /> {npsMutation.isPending ? 'Enviando...' : 'Liberar assinatura'}
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className={`text-lg font-bold ${isSigned ? 'text-emerald-700' : 'text-slate-800'}`}>
                {isSigned ? 'Medição assinada com sucesso' : isBlocked ? 'Link indisponível' : `Medição #${data.numero}`}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Summary label="Obra" value={data.obraNumero || '-'} />
                <Summary label="Cliente" value={data.cliente || '-'} />
                <Summary label="Período" value={`${formatDate(data.dataInicio)} até ${formatDate(data.dataFim)}`} />
                <Summary label={isSigned ? 'Assinada em' : 'Link válido até'} value={formatDateTime(isSigned ? data.signedAt : data.expiresAt)} />
              </div>
              {!isBlocked || isSigned ? (
                <a href={data.pdfUrl} target="_blank" rel="noreferrer" className="btn btn-secondary mt-5 inline-flex">
                  <FileText size={16} /> Abrir PDF da medição
                </a>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800">Assinatura do cliente</h2>
              {isSigned ? (
                <>
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 size={17} className="mr-2 inline-block" /> Assinatura registrada.
                  </div>
                  {data.clientSignature && <img className="mt-4 h-36 w-full rounded-xl border object-contain" src={data.clientSignature} alt="Assinatura do cliente" />}
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Summary label="Nome" value={data.clientName} />
                    <Summary label="Documento" value={data.clientDocument} />
                  </div>
                </>
              ) : isBlocked ? (
                <p className="mt-4 text-sm text-red-700">Este link expirou ou foi substituído. Solicite um novo link.</p>
              ) : signatureLockedByNps ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  Responda a pesquisa NPS acima para liberar a assinatura da medição final.
                </div>
              ) : (
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    Nome do responsável
                    <input className="field-input" value={nome} onChange={(event) => setNome(event.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                    Documento
                    <input className="field-input" value={documento} onChange={(event) => setDocumento(event.target.value)} />
                  </label>
                  <div>
                    <div className="mb-1.5 text-sm font-semibold text-slate-700">Desenhe a assinatura</div>
                    <canvas
                      ref={canvasRef}
                      width={640}
                      height={220}
                      className="h-40 w-full touch-none rounded-xl border border-slate-300 bg-white"
                      onPointerDown={startDrawing}
                      onPointerMove={moveDrawing}
                      onPointerUp={stopDrawing}
                      onPointerCancel={stopDrawing}
                    />
                    <button type="button" onClick={clearSignature} className="btn btn-secondary mt-2 text-xs">
                      <RotateCcw size={13} /> Limpar assinatura
                    </button>
                  </div>
                  <button type="button" onClick={() => submitMutation.mutate()} disabled={!canSubmit || submitMutation.isPending} className="btn btn-primary">
                    {submitMutation.isPending ? 'Registrando...' : 'Assinar medição'}
                  </button>
                </div>
              )}
            </section>

            {false && showNps ? (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-800">Pesquisa NPS</h2>
                {data?.npsRespondido || npsSuccess ? (
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle2 size={17} className="mr-2 inline-block" /> Obrigado pela avaliação.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    <p className="text-sm font-semibold text-slate-700">De 0 a 10, o quanto você recomendaria a Gontijo?</p>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
                      {Array.from({ length: 11 }, (_, nota) => (
                        <button
                          key={nota}
                          type="button"
                          onClick={() => setNpsNota(nota)}
                          className={`rounded-lg border px-0 py-2 text-sm font-black transition ${npsNota === nota ? 'border-red-700 bg-red-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          {nota}
                        </button>
                      ))}
                    </div>
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                      Comentário
                      <textarea className="field-input min-h-24" value={npsComentario} onChange={(event) => setNpsComentario(event.target.value)} placeholder="Opcional" />
                    </label>
                    <button type="button" onClick={() => npsMutation.mutate()} disabled={npsNota == null || npsMutation.isPending} className="btn btn-primary">
                      <Star size={16} /> {npsMutation.isPending ? 'Enviando...' : 'Enviar NPS'}
                    </button>
                  </div>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value || '-'}</div>
    </div>
  )
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{children}</div>
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{children}</div>
}
