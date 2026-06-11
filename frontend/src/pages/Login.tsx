import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function formatCpf(digits: string) {
  const d = digits.slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ cpf: '', password: '', remember: false })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.cpf, form.password, form.remember)
      navigate('/')
    } catch {
      setError('CPF ou senha invalidos. Verifique e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0f1117] p-4">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[#c60926]/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#8f0a1d]/15 blur-[100px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[60px]" />
        {/* subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img
            src="/gontijo-logo-transparente.png"
            alt="Gontijo Fundacoes"
            className="h-14 w-auto object-contain"
            style={{ filter: 'invert(1) hue-rotate(180deg)' }}
          />
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <div className="mb-7 border-l-4 border-[#c60926] pl-4">
            <h1 className="text-2xl font-bold text-white">Acesso ao sistema</h1>
            <p className="mt-1 text-sm text-white/50">Entre com suas credenciais para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60" htmlFor="login-cpf">
                CPF
              </label>
              <input
                id="login-cpf"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                value={formatCpf(form.cpf)}
                onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c60926] focus:bg-white/[0.14] focus:ring-0"
                placeholder="000.000.000-00"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/60" htmlFor="login-password">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition focus:border-[#c60926] focus:bg-white/[0.14] focus:ring-0"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-white/30 transition-colors hover:text-white/60"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-white/50 select-none">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                className="h-4 w-4 accent-[#c60926]"
              />
              Manter conectado neste dispositivo
            </label>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#c60926] py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(198,9,38,0.4)] transition hover:bg-[#a80820] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/25">
          &copy; {new Date().getFullYear()} Gontijo Fundacoes. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
