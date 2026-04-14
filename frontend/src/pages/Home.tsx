import { useAuth } from '@/hooks/useAuth'

export default function HomePage() {
  const { user } = useAuth()
  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">Painel Operacional</h1>
        <p className="page-subtitle">
          Visao consolidada para {user?.name?.split(' ')[0] ?? 'Usuario'} acompanhar o dia.
        </p>
      </div>
    </div>
  )
}
