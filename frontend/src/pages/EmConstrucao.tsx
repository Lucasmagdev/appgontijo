import { Construction } from 'lucide-react'

interface Props {
  titulo: string
}

export default function EmConstrucao({ titulo }: Props) {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-heading">{titulo}</h1>
        </div>
      </div>

      <section className="app-panel section-panel flex flex-col items-center justify-center py-16 text-center">
        <Construction size={40} className="mb-4 text-slate-300" />
        <p className="text-slate-500 font-medium">Modulo em desenvolvimento</p>
        <p className="mt-1 text-sm text-slate-400">Esta secao sera implementada nas proximas fases.</p>
      </section>
    </div>
  )
}
