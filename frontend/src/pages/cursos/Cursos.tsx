import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, BookOpen, ClipboardList, BarChart2, Pencil, Trash2, Users } from 'lucide-react'
import { cursosApi, type CursoRecord } from '@/lib/gontijo-api'

function CursoCard({ curso, onEdit, onDelete }: { curso: CursoRecord; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="app-panel flex flex-col gap-3 p-4">
      {curso.thumbnail_url && (
        <img
          src={curso.thumbnail_url}
          alt={curso.titulo}
          className="h-36 w-full rounded-md object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 leading-tight">{curso.titulo}</h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${curso.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {curso.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        {curso.descricao && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{curso.descricao}</p>}
        <div className="mt-2 flex gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><ClipboardList size={12} /> {curso.total_provas ?? 0} prova(s)</span>
          <span className="flex items-center gap-1"><Users size={12} /> {curso.total_atribuicoes ?? 0} atrib.</span>
        </div>
      </div>
      <div className="flex gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Pencil size={12} /> Editar
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center rounded-md border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

export default function CursosPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page] = useState(1)
  const [tab, setTab] = useState<'cursos' | 'resultados'>('cursos')

  const { data, isLoading } = useQuery({
    queryKey: ['cursos', page],
    queryFn: () => cursosApi.list(page, 50),
  })

  const deleteMutation = useMutation({
    mutationFn: cursosApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cursos'] }),
  })

  const handleDelete = (curso: CursoRecord) => {
    if (confirm(`Excluir o curso "${curso.titulo}"? Esta ação não pode ser desfeita.`)) {
      deleteMutation.mutate(curso.id)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen size={20} className="text-[var(--brand-red)]" />
            Cursos e Provas
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Gerencie cursos, provas e acompanhe desempenho</p>
        </div>
        <button
          onClick={() => navigate('/cursos/novo')}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Novo Curso
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'cursos', label: 'Cursos', icon: BookOpen },
          { key: 'resultados', label: 'Resultados', icon: BarChart2 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              if (key === 'resultados') navigate('/cursos/resultados')
              else setTab(key as 'cursos')
            }}
            className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-[var(--brand-red)] text-[var(--brand-red)]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Grid de cursos */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Carregando...</div>
      ) : !data?.items?.length ? (
        <div className="app-panel py-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm font-medium text-slate-400">Nenhum curso cadastrado</p>
          <button
            onClick={() => navigate('/cursos/novo')}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--brand-red)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={14} /> Criar primeiro curso
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((curso) => (
            <CursoCard
              key={curso.id}
              curso={curso}
              onEdit={() => navigate(`/cursos/${curso.id}/editar`)}
              onDelete={() => handleDelete(curso)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
