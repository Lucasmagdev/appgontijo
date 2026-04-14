import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm] = useState({ login: '', password: '', remember: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form.login, form.password, form.remember)
      navigate('/')
    } catch {
      setError('Login ou senha invalidos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3f4751_0,#2f353d_45%,#23272d_100%)] p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-[linear-gradient(160deg,#3a4048_0%,#31363e_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex rounded-2xl px-5 py-4">
              <img
                src="/gontijo-logo-diarios.png"
                alt="Gontijo Fundações"
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>

          <div>
            <div className="max-w-sm text-3xl font-semibold leading-tight">
              Controle administrativo com linguagem visual industrial e direta.
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Acesso rapido ao operacional, cadastros, diarios e monitoramento da producao.
            </p>
          </div>
        </section>

        <section className="bg-[#f5f6f8] p-8 lg:p-10">
          <div className="mb-8 border-l-4 border-[var(--brand-red)] pl-4">
            <div className="app-title text-3xl text-slate-800">Acesso ao sistema</div>
            <p className="mt-1 text-sm text-slate-500">
              Entre com suas credenciais para abrir o painel administrativo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">Login ou telefone</label>
              <input
                type="text"
                value={form.login}
                onChange={(e) => setForm({ ...form, login: e.target.value })}
                className="field-input"
                placeholder="admin"
                required
              />
            </div>

            <div>
              <label className="field-label">Senha</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field-input"
                placeholder="admin"
                required
              />
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
              Acesso local atual: login livre e senha <strong>admin</strong>.
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
