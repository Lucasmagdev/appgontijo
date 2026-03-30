interface PlaceholderPageProps {
  title: string
  description: string
  status?: string
}

export default function PlaceholderPage({
  title,
  description,
  status = 'Planejado para a proxima fase de implementacao.',
}: PlaceholderPageProps) {
  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>

      <section className="app-panel section-panel">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            Este modulo ja esta previsto na navegacao principal e entra como parte da base do
            sistema administrativo. A tela definitiva sera conectada ao backend, com filtros,
            listagens e regras especificas do negocio.
          </p>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            {status}
          </div>
        </div>
      </section>
    </div>
  )
}
