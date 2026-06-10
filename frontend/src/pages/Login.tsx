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
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3f4751_0,#2f353d_45%,#23272d_100%)] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* Brand panel */}
        <section className="relative hidden overflow-hidden bg-[linear-gradient(155deg,#c60926_0%,#8f0a1d_55%,#2f353d_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          {/* decorative glows */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-black/20 blur-3xl" />

          <div className="relative flex justify-center">
            <div className="inline-flex rounded-2xl bg-white px-7 py-5 shadow-lg shadow-black/20">
              <img
                src="/gontijo-logo-diarios.png"
                alt="Gontijo Fundacoes"
                className="h-16 w-auto object-contain"
              />
            </div>
          </div>

          <div className="relative">
            <h2 className="text-2xl font-bold leading-tight">Diario de Obras</h2>
            <p className="mt-2 max-w-sm text-sm text-white/80">
              Gestao de medicoes, equipamentos e diarios de campo da Gontijo Fundacoes em um so lugar.
            </p>
          </div>

          <p className="relative text-xs text-white/55">
            &copy; {new Date().getFullYear()} Gontijo Fundacoes. Todos os direitos reservados.
          </p>
        </section>

        {/* Form panel */}
        <section className="bg-[#f5f6f8] p-8 lg:p-10">
          {/* mobile logo */}
          <div className="mb-6 flex justify-center lg:hidden">
            <img src="/gontijo-logo-diarios.png" alt="Gontijo Fundacoes" className="h-12 w-auto object-contain" />
          </div>

          <div className="mb-8 border-l-4 border-[var(--brand-red)] pl-4">
            <div className="app-title text-3xl text-slate-800">Acesso ao sistema</div>
            <p className="mt-1 text-sm text-slate-500">
              Entre com suas credenciais para abrir o painel administrativo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label" htmlFor="login-cpf">CPF</label>
              <input
                id="login-cpf"
                type="text"
                inputMode="numeric"
                autoComplete="username"
                value={formatCpf(form.cpf)}
                onChange={(e) => setForm({ ...form, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                className="field-input"
                placeholder="000.000.000-00"
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="login-password">Senha</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="field-input pr-11"
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.remember}
                onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                className="h-4 w-4 accent-[var(--brand-red)]"
              />
              Manter conectado neste dispositivo
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Entre com seu CPF e senha de operador cadastrados no sistema.
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
