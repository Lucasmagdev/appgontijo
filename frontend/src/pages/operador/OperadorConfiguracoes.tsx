import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Home, LogOut, Pencil, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { operadorProfileService, extractApiErrorMessage } from '@/lib/gontijo-api'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'

type FormState = {
  assinatura: string
}

const EMPTY_FORM: FormState = {
  assinatura: '',
}

export default function OperadorConfiguracoesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { logout } = useOperadorAuth()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitError, setSubmitError] = useState('')

  const profileQuery = useQuery({
    queryKey: ['operador-profile'],
    queryFn: operadorProfileService.getProfile,
  })

  useEffect(() => {
    if (!profileQuery.data) return
    setForm({
      assinatura: profileQuery.data.assinatura,
    })
  }, [profileQuery.data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#111827'

    if (!form.assinatura) return

    const image = new Image()
    image.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = form.assinatura
  }, [form.assinatura])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await operadorProfileService.updateProfile({
        assinatura: form.assinatura,
      })
    },
    onSuccess: async () => {
      setSubmitError('')
      setEditing(false)
      await queryClient.invalidateQueries({ queryKey: ['operador-profile'] })
    },
    onError: (error) => setSubmitError(extractApiErrorMessage(error)),
  })

  const avatarSrc = useMemo(() => {
    const foto = profileQuery.data?.foto || ''
    if (foto.startsWith('data:image/') || foto.startsWith('http://') || foto.startsWith('https://')) {
      return foto
    }
    return ''
  }, [profileQuery.data?.foto])

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
    if (!editing) return
    drawingRef.current = true
    drawAt(clientX, clientY, false)
  }

  function moveDrawing(clientX: number, clientY: number) {
    if (!editing || !drawingRef.current) return
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
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setField('assinatura', '')
  }

  const initials = (profileQuery.data?.nome || 'Operador')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'linear-gradient(to right, #b12222 42%, #ffffff 42%)',
        maxWidth: '430px',
        margin: '0 auto',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '42%', height: '100%', background: '#b12222' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 8px' }}>
          <button onClick={() => navigate('/operador')} style={iconNavButtonStyle}>
            <Home size={22} color="#fff" />
          </button>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.14em' }}>CONFIGURACOES</div>
        </div>

        <div
          style={{
            margin: '12px 18px 0 38px',
            flex: 1,
            borderRadius: '28px',
            background: '#fff',
            border: '2px solid #111827',
            boxShadow: '0 16px 30px rgba(15,23,42,0.08)',
            padding: '22px 18px 26px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {profileQuery.isLoading ? <div style={{ color: '#6b7280', fontSize: '14px' }}>Carregando perfil...</div> : null}
          {profileQuery.isError ? <FeedbackBox>{extractApiErrorMessage(profileQuery.error)}</FeedbackBox> : null}
          {submitError ? <FeedbackBox>{submitError}</FeedbackBox> : null}

          {!profileQuery.isLoading && !profileQuery.isError && profileQuery.data ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={profileQuery.data.nome}
                    style={{ width: '118px', height: '118px', borderRadius: '999px', objectFit: 'cover', border: '4px solid #fff' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '118px',
                      height: '118px',
                      borderRadius: '999px',
                      background: '#f3f4f6',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#b12222',
                      fontSize: '34px',
                      fontWeight: 900,
                    }}
                  >
                    {initials}
                  </div>
                )}

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#111827', lineHeight: '1.15' }}>
                    {profileQuery.data.nome.toUpperCase()}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '19px', color: '#111827' }}>Operador</div>
                </div>
              </div>

              <ProfileField label="Apelido:" value={profileQuery.data.apelido || '-'} />

              <ProfileField label="E-mail:" value={profileQuery.data.email || '-'} />

              <ProfileField label="Telefone:" value={profileQuery.data.telefone || '-'} />

              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#111827', textAlign: 'center' }}>Assinatura:</div>
                <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', lineHeight: '1.45' }}>
                  Apelido, e-mail e telefone sao gerenciados pelo administrativo. Aqui o operador altera apenas a propria assinatura.
                </div>
                <div
                  style={{
                    borderRadius: '18px',
                    overflow: 'hidden',
                    border: '1.5px solid #e5e7eb',
                    background: '#f3f4f6',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={220}
                    style={{
                      width: '100%',
                      height: '180px',
                      display: 'block',
                      touchAction: 'none',
                      cursor: editing ? 'crosshair' : 'default',
                    }}
                    onPointerDown={(event) => startDrawing(event.clientX, event.clientY)}
                    onPointerMove={(event) => moveDrawing(event.clientX, event.clientY)}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                  />
                </div>

                {editing ? (
                  <button onClick={clearSignature} type="button" style={lightActionStyle}>
                    <Trash2 size={16} />
                    Limpar assinatura
                  </button>
                ) : null}
              </div>

              <div style={{ marginTop: '4px' }}>
                {editing ? (
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    style={primaryActionStyle(saveMutation.isPending)}
                  >
                    <Save size={18} />
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    style={primaryActionStyle(false)}
                  >
                    <Pencil size={18} />
                    Editar assinatura
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 28px' }}>
          <button onClick={() => void logout()} style={logoutStyle}>
            <LogOut size={18} />
          </button>
          <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.14em', color: '#111827' }}>GONTIJO FUNDACOES</div>
        </div>
      </div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: '8px' }}>
      <div style={{ fontSize: '20px', fontWeight: 900, color: '#111827' }}>{label}</div>
      <div style={{ fontSize: typeof value === 'string' ? '20px' : undefined, color: '#111827', lineHeight: '1.35' }}>{value}</div>
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

const iconNavButtonStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  borderRadius: '12px',
  border: 'none',
  background: 'transparent',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
}

const logoutStyle: CSSProperties = {
  width: '44px',
  height: '44px',
  border: 'none',
  background: 'transparent',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  color: '#fff',
}

function primaryActionStyle(disabled: boolean): CSSProperties {
  return {
    width: '100%',
    border: 'none',
    borderRadius: '22px',
    background: disabled ? '#ef9a9a' : '#b12222',
    color: '#fff',
    minHeight: '60px',
    fontSize: '18px',
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: disabled ? 'none' : '0 14px 28px rgba(177,34,34,0.22)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }
}

const lightActionStyle: CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '14px',
  background: '#fff',
  color: '#374151',
  minHeight: '42px',
  padding: '0 14px',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
}
