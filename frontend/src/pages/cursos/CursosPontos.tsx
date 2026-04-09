import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Gift, Medal, Save, Settings2, Ticket } from 'lucide-react'
import { cursosApi, extractApiErrorMessage } from '@/lib/gontijo-api'

function monthToLabel(value: string) {
  if (!value) return '-'
  const [year, month] = value.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date)
}

function formatCpf(value: string) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length !== 11) return value || '-'
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

function currentMonthInput() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
}

export default function CursosPontosPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(currentMonthInput)
  const [configForm, setConfigForm] = useState({
    points_course_completion: 5,
    points_proof_approved: 10,
    points_proof_failed: 2,
  })
  const [raffleForm, setRaffleForm] = useState({
    title: '',
    description: '',
    prize: '',
    draw_date: '',
    status: 'draft' as 'draft' | 'active' | 'closed',
    banner_label: '',
  })
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')

  const configQuery = useQuery({
    queryKey: ['cursos-pontos-config', month],
    queryFn: () => cursosApi.getPontosConfig(month),
  })

  useEffect(() => {
    if (!configQuery.data) return
    setConfigForm({
      points_course_completion: configQuery.data.settings.points_course_completion,
      points_proof_approved: configQuery.data.settings.points_proof_approved,
      points_proof_failed: configQuery.data.settings.points_proof_failed,
    })
    setRaffleForm({
      title: configQuery.data.raffle?.title || `Sorteio ${monthToLabel(configQuery.data.month_ref)}`,
      description: configQuery.data.raffle?.description || '',
      prize: configQuery.data.raffle?.prize || '',
      draw_date: configQuery.data.raffle?.draw_date || '',
      status: configQuery.data.raffle?.status || 'draft',
      banner_label: configQuery.data.raffle?.banner_label || 'Sorteio do mês',
    })
  }, [configQuery.data])

  const totals = useMemo(() => {
    const ranking = configQuery.data?.ranking || []
    return ranking.reduce(
      (acc, row, index) => {
        acc.points += Number(row.pontos || 0)
        acc.people += 1
        if (index === 0) acc.leader = row.nome
        return acc
      },
      { points: 0, people: 0, leader: '' }
    )
  }, [configQuery.data?.ranking])

  const saveConfigMutation = useMutation({
    mutationFn: () =>
      cursosApi.updatePontosConfig({
        month,
        ...configForm,
      }),
    onSuccess: async () => {
      setError('')
      setFeedback('Pontuação atualizada com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['cursos-pontos-config', month] })
    },
    onError: (mutationError) => {
      setFeedback('')
      setError(extractApiErrorMessage(mutationError))
    },
  })

  const saveRaffleMutation = useMutation({
    mutationFn: () =>
      cursosApi.updateSorteioAtual({
        month_ref: `${month}-01`,
        ...raffleForm,
      }),
    onSuccess: async () => {
      setError('')
      setFeedback('Sorteio do mês atualizado com sucesso.')
      await queryClient.invalidateQueries({ queryKey: ['cursos-pontos-config', month] })
    },
    onError: (mutationError) => {
      setFeedback('')
      setError(extractApiErrorMessage(mutationError))
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cursos')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Ticket size={20} className="text-[var(--brand-red)]" />
            Pontos e Sorteio
          </h1>
          <p className="text-sm text-slate-500">Configure quanto cada ação vale e acompanhe o ranking mensal.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="app-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mês</p>
          <input type="month" className="app-input mt-3" value={month} onChange={(event) => setMonth(event.target.value)} />
          <p className="mt-3 text-sm font-semibold text-slate-800">{monthToLabel(`${month}-01`)}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Participantes</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totals.people}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pontos no mês</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totals.points}</p>
        </div>
        <div className="app-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Líder atual</p>
          <p className="mt-3 text-base font-bold text-slate-900">{totals.leader || 'Sem movimentação'}</p>
        </div>
      </div>

      {feedback ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <section className="app-panel p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Settings2 size={18} />
            <h2 className="text-lg font-bold text-slate-900">Pontuação por ação</h2>
          </div>
          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Curso sem prova concluído</span>
              <input
                type="number"
                className="app-input"
                value={configForm.points_course_completion}
                onChange={(event) => setConfigForm((current) => ({ ...current, points_course_completion: Number(event.target.value || 0) }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Prova aprovada</span>
              <input
                type="number"
                className="app-input"
                value={configForm.points_proof_approved}
                onChange={(event) => setConfigForm((current) => ({ ...current, points_proof_approved: Number(event.target.value || 0) }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Prova reprovada</span>
              <input
                type="number"
                className="app-input"
                value={configForm.points_proof_failed}
                onChange={(event) => setConfigForm((current) => ({ ...current, points_proof_failed: Number(event.target.value || 0) }))}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => saveConfigMutation.mutate()}
            disabled={saveConfigMutation.isPending}
            className="btn btn-primary mt-5"
          >
            <Save size={15} />
            {saveConfigMutation.isPending ? 'Salvando pontuação...' : 'Salvar pontuação'}
          </button>
        </section>

        <section className="app-panel p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Gift size={18} />
            <h2 className="text-lg font-bold text-slate-900">Sorteio do mês</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Título</span>
              <input className="app-input" value={raffleForm.title} onChange={(event) => setRaffleForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Banner curto</span>
              <input className="app-input" value={raffleForm.banner_label} onChange={(event) => setRaffleForm((current) => ({ ...current, banner_label: event.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Status</span>
              <select className="app-input" value={raffleForm.status} onChange={(event) => setRaffleForm((current) => ({ ...current, status: event.target.value as 'draft' | 'active' | 'closed' }))}>
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="closed">Encerrado</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Prêmio</span>
              <input className="app-input" value={raffleForm.prize} onChange={(event) => setRaffleForm((current) => ({ ...current, prize: event.target.value }))} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Descrição</span>
              <textarea className="app-input min-h-[110px]" value={raffleForm.description} onChange={(event) => setRaffleForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-600">Data do sorteio</span>
              <input type="date" className="app-input" value={raffleForm.draw_date} onChange={(event) => setRaffleForm((current) => ({ ...current, draw_date: event.target.value }))} />
            </label>
          </div>

          <button
            type="button"
            onClick={() => saveRaffleMutation.mutate()}
            disabled={saveRaffleMutation.isPending}
            className="btn btn-primary mt-5"
          >
            <Gift size={15} />
            {saveRaffleMutation.isPending ? 'Salvando sorteio...' : 'Salvar sorteio do mês'}
          </button>
        </section>
      </div>

      <section className="app-panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Medal size={18} />
            <h2 className="text-lg font-bold text-slate-900">Ranking do mês</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Cada ponto representa uma chance a mais no sorteio do mês.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Posição</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Colaborador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Setor</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Pontos</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Eventos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {configQuery.isLoading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">Carregando ranking...</td></tr>
              ) : !configQuery.data?.ranking?.length ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">Ainda não há pontos acumulados neste mês.</td></tr>
              ) : (
                configQuery.data.ranking.map((row, index) => (
                  <tr key={row.usuario_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-500">#{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{row.nome}</div>
                      <div className="text-xs text-slate-400">{row.apelido || formatCpf(row.documento)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.setor_nome || 'Sem setor'}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">{row.pontos}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{row.eventos}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
