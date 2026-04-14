import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'

export default function ClientePortalLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useClientePortalAuth()
  const [form, setForm] = useState({ login: searchParams.get('login') || '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form.login, form.password)
      navigate('/portal-cliente')
    } catch {
      setError('Acesso do cliente invalido ou inativo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#9e2121_0%,#7d1818_28%,#f6f2ef_28%,#f6f2ef_100%)] px-4 py-10">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[32px] border border-black/10 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-[linear-gradient(160deg,#a72727_0%,#881c1c_100%)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="app-title text-5xl tracking-[0.18em]">GONTIJO</div>
            <div className="mt-2 text-sm font-semibold uppercase tracking-[0.28em] text-red-100/80">
              Portal do cliente
            </div>
          </div>

          <div className="space-y-4">
            <div className="max-w-sm text-3xl font-semibold leading-tight">
              Acompanhamento direto da obra ativa com acesso exclusivo para o cliente.
            </div>
            <p className="max-w-md text-sm leading-6 text-red-50/80">
              Consulte diarios, progresso das estacas e PDFs do canteiro em uma area separada do sistema interno.
            </p>
          </div>
        </section>

        <section className="bg-[#f8f4f2] p-8 lg:p-10">
          <div className="mb-8 border-l-4 border-[var(--brand-red)] pl-4">
            <div className="app-title text-3xl text-slate-900">Entrar no portal</div>
            <p className="mt-1 text-sm text-slate-500">
              Use o login criado pela equipe administrativa para consultar os diarios da obra.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="field-label">Login</label>
              <input
                type="text"
                value={form.login}
                onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
                className="field-input"
                placeholder="cliente.obra123"
                required
              />
            </div>

            <div>
              <label className="field-label">Senha</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="field-input"
                placeholder="Sua senha de acesso"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? 'Entrando...' : 'Abrir portal da obra'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
