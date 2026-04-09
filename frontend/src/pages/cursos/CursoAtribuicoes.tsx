import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Users, Building2, BookOpen, ClipboardList } from 'lucide-react'
import { cursosApi, type AtribuicaoRecord } from '@/lib/gontijo-api'
import { api } from '@/lib/api'

type TipoAcesso = 'curso_e_prova' | 'so_curso' | 'so_prova'

const TIPO_ACESSO_OPTIONS: { value: TipoAcesso; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'curso_e_prova',
    label: 'Curso + Prova',
    desc: 'Acessa o vídeo e faz a prova',
    icon: <><BookOpen size={13} /><ClipboardList size={13} /></>,
  },
  {
    value: 'so_curso',
    label: 'Só Curso',
    desc: 'Apenas assiste o vídeo',
    icon: <BookOpen size={13} />,
  },
  {
    value: 'so_prova',
    label: 'Só Prova',
    desc: 'Direto para a prova',
    icon: <ClipboardList size={13} />,
  },
]

function tipoAcessoLabel(v: string) {
  return TIPO_ACESSO_OPTIONS.find((o) => o.value === v)?.label ?? v
}

function tipoAcessoBadge(v: string) {
  if (v === 'so_curso') return 'bg-blue-50 text-blue-600'
  if (v === 'so_prova') return 'bg-amber-50 text-amber-600'
  return 'bg-slate-100 text-slate-600'
}

export default function CursoAtribuicoesPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'setor' | 'usuario'>('setor')
  const [setorId, setSetorId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [tipoAcesso, setTipoAcesso] = useState<TipoAcesso>('curso_e_prova')
  const [error, setError] = useState('')

  const { data: curso } = useQuery({
    queryKey: ['curso', id],
    queryFn: () => cursosApi.get(Number(id)),
    enabled: !!id,
  })

  const hasActiveProof = Array.isArray((curso as { provas?: { ativo?: number }[] } | undefined)?.provas)
    ? ((curso as { provas?: { ativo?: number }[] }).provas ?? []).some((prova) => Number(prova.ativo ?? 1) === 1)
    : false

  useEffect(() => {
    if (!hasActiveProof && tipoAcesso !== 'so_curso') {
      setTipoAcesso('so_curso')
    }
  }, [hasActiveProof, tipoAcesso])

  const { data: atribuicoes = [] } = useQuery({
    queryKey: ['atribuicoes', id],
    queryFn: () => cursosApi.getAtribuicoes(Number(id)),
    enabled: !!id,
  })

  const { data: setores = [] } = useQuery({
    queryKey: ['setores-list'],
    queryFn: async () => {
      const res = await api.get<{ ok: boolean; data: { id: number; nome: string }[] }>('/gontijo/setores')
      return res.data.data ?? []
    },
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-list'],
    queryFn: async () => {
      const res = await api.get<{ ok: boolean; data: { id: number; nome: string }[] }>('/gontijo/usuarios?limit=500')
      return res.data.data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      cursosApi.createAtribuicao(Number(id), {
        tipo,
        setor_id: tipo === 'setor' ? Number(setorId) : undefined,
        usuario_id: tipo === 'usuario' ? Number(usuarioId) : undefined,
        tipo_acesso: tipoAcesso,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['atribuicoes', id] })
      setSetorId('')
      setUsuarioId('')
      setError('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: cursosApi.deleteAtribuicao,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['atribuicoes', id] }),
  })

  const handleAdd = () => {
    setError('')
    if (tipo === 'setor' && !setorId) { setError('Selecione um setor'); return }
    if (tipo === 'usuario' && !usuarioId) { setError('Selecione um colaborador'); return }
    if (tipoAcesso !== 'so_curso' && !hasActiveProof) {
      setError('Cadastre ou ative uma prova neste curso antes de atribuir acesso com prova.')
      return
    }
    createMutation.mutate()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(`/cursos/${id}/prova`)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Atribuições</h1>
          <p className="text-sm text-slate-500">{curso?.titulo}</p>
        </div>
      </div>

      {/* Adicionar atribuição */}
      <div className="app-panel mb-5 p-5 flex flex-col gap-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Nova atribuição</h2>

        {/* Para quem */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">Atribuir a</p>
          <div className="flex gap-3">
            {(['setor', 'usuario'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  tipo === t
                    ? 'border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t === 'setor' ? <Building2 size={14} /> : <Users size={14} />}
                {t === 'setor' ? 'Setor' : 'Colaborador'}
              </button>
            ))}
          </div>
          <div className="mt-3">
            {tipo === 'setor' ? (
              <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="app-input w-full">
                <option value="">— Selecione o setor —</option>
                {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            ) : (
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="app-input w-full">
                <option value="">— Selecione o colaborador —</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* O que pode acessar */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">O que pode acessar</p>
          <div className="flex flex-col gap-2">
            {TIPO_ACESSO_OPTIONS.map((opt) => (
              (() => {
                const requiresProof = opt.value !== 'so_curso'
                const disabled = requiresProof && !hasActiveProof

                return (
              <button
                key={opt.value}
                onClick={() => setTipoAcesso(opt.value)}
                disabled={disabled}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  tipoAcesso === opt.value
                    ? 'border-[var(--brand-red)] bg-red-50'
                    : 'border-slate-200 hover:bg-slate-50'
                } ${disabled ? 'cursor-not-allowed opacity-45 hover:bg-white' : ''}`}
              >
                <div className={`flex items-center gap-0.5 ${tipoAcesso === opt.value ? 'text-[var(--brand-red)]' : 'text-slate-400'}`}>
                  {opt.icon}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${tipoAcesso === opt.value ? 'text-[var(--brand-red)]' : 'text-slate-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {disabled ? 'Indisponível até existir uma prova ativa para este curso.' : opt.desc}
                  </p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 ${tipoAcesso === opt.value ? 'border-[var(--brand-red)] bg-[var(--brand-red)]' : 'border-slate-300'}`} />
              </button>
                )
              })()
            ))}
          </div>
          {!hasActiveProof && (
            <p className="mt-2 text-xs text-amber-600">
              Este curso ainda não possui prova ativa. Por isso, por enquanto só é possível atribuir como <strong>Só Curso</strong>.
            </p>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 self-start"
        >
          <Plus size={14} /> {createMutation.isPending ? 'Adicionando...' : 'Adicionar atribuição'}
        </button>
      </div>

      {/* Lista de atribuições */}
      <div className="app-panel p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Atribuições atuais ({atribuicoes.length})
        </h2>
        {atribuicoes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhuma atribuição ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {atribuicoes.map((a: AtribuicaoRecord) => (
              <div key={a.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {a.tipo === 'setor'
                    ? <Building2 size={14} className="shrink-0 text-blue-500" />
                    : <Users size={14} className="shrink-0 text-green-500" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {a.tipo === 'setor' ? a.setor_nome : a.usuario_nome}
                    </p>
                    <p className="text-xs text-slate-400">{a.tipo === 'setor' ? 'Setor' : 'Colaborador'}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tipoAcessoBadge(a.tipo_acesso ?? 'curso_e_prova')}`}>
                  {tipoAcessoLabel(a.tipo_acesso ?? 'curso_e_prova')}
                </span>
                <button
                  onClick={() => { if (confirm('Remover esta atribuição?')) deleteMutation.mutate(a.id) }}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
