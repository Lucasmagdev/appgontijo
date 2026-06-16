import { useAuth } from '@/hooks/useAuth'

export default function HomePage() {
  const { user } = useAuth()
  return (
    <div className="page-shell">
      <div>
        <h1 className="page-heading">Painel Operacional</h1>
        <p className="page-subtitle">
          Bem-vindo, {user?.name?.split(' ')[0] ?? 'Usuario'}! Bom trabalho hoje.
        </p>
      </div>
    </div>
  )
}
