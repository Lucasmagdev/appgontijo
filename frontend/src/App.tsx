import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/Login'
import OperadorLoginPage from '@/pages/operador/OperadorLogin'
import OperadorHomePage from '@/pages/operador/OperadorHome'
import OperadorSplashPage from '@/pages/operador/OperadorSplash'
import OperadorConfiguracoesPage from '@/pages/operador/OperadorConfiguracoes'
import AssinaturaClientePage from '@/pages/public/AssinaturaClientePage'
import ClientePortalLoginPage from '@/pages/public/ClientePortalLoginPage'
import ClientePortalDashboardPage from '@/pages/public/ClientePortalDashboardPage'
import DiarioMenu from '@/pages/operador/diarios/DiarioMenu'
import DiarioPesquisar from '@/pages/operador/diarios/DiarioPesquisar'
import DiarioNovoObra from '@/pages/operador/diarios/DiarioNovoObra'
import DiarioPainel from '@/pages/operador/diarios/DiarioPainel'
import DiarioModuloPage from '@/pages/operador/diarios/DiarioModuloPage'
import HomePage from '@/pages/Home'
import UsuariosPage from '@/pages/usuarios/Usuarios'
import UsuarioFormPage from '@/pages/usuarios/UsuarioForm'
import ClientesPage from '@/pages/clientes/Clientes'
import ClienteFormPage from '@/pages/clientes/ClienteForm'
import ObrasPage from '@/pages/obras/Obras'
import ObraFormPage from '@/pages/obras/ObraForm'
import EquipamentosPage from '@/pages/equipamentos/Equipamentos'
import DiariosPage from '@/pages/diarios/Diarios'
import DiarioFormPage from '@/pages/diarios/DiarioForm'
import DiarioConferenciaPage from '@/pages/diarios/DiarioConferenciaPage'
import ProducaoPage from '@/pages/producao/Producao'
import PortalClientesPage from '@/pages/clientes-portal/PortalClientesPage'
import CursosPage from '@/pages/cursos/Cursos'
import CursoFormPage from '@/pages/cursos/CursoForm'
import CursoProvaPage from '@/pages/cursos/CursoProva'
import CursoAtribuicoesPage from '@/pages/cursos/CursoAtribuicoes'
import CursosResultadosPage from '@/pages/cursos/CursosResultados'
import CursosPontosPage from '@/pages/cursos/CursosPontos'
import PontoVerificacaoPage from '@/pages/ponto/PontoVerificacaoPage'
import AjudantesAvaliacaoPage from '@/pages/ponto/AjudantesAvaliacaoPage'
import OperadorCursosPage from '@/pages/operador/cursos/OperadorCursos'
import OperadorCursoDetalhePage from '@/pages/operador/cursos/OperadorCursoDetalhe'
import OperadorProvaPage from '@/pages/operador/cursos/OperadorProva'
import FatoObservadoPage from '@/pages/operador/FatoObservadoPage'
import IndiqueUmaObraPage from '@/pages/operador/IndiqueUmaObraPage'

function AppBootstrap() {
  const initAdmin = useAuth((state) => state.initialize)
  const initOperador = useOperadorAuth((state) => state.initialize)
  const initClientePortal = useClientePortalAuth((state) => state.initialize)

  useEffect(() => {
    void initAdmin()
    void initOperador()
    void initClientePortal()
  }, [initAdmin, initOperador, initClientePortal])

  return null
}

function OperadorPrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useOperadorAuth()
  if (!isReady) return null
  return isAuthenticated ? <>{children}</> : <Navigate to="/operador/login" replace />
}

function OperadorLoginRoute() {
  const { isAuthenticated, isReady } = useOperadorAuth()
  if (!isReady) return null
  return isAuthenticated ? <Navigate to="/operador" replace /> : <OperadorLoginPage />
}

function ClientePortalPrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useClientePortalAuth()
  if (!isReady) return null
  return isAuthenticated ? <>{children}</> : <Navigate to="/portal-cliente/login" replace />
}

function ClientePortalLoginRoute() {
  const { isAuthenticated, isReady } = useClientePortalAuth()
  if (!isReady) return null
  return isAuthenticated ? <Navigate to="/portal-cliente" replace /> : <ClientePortalLoginPage />
}

function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4">
      <div className="app-panel w-full max-w-md px-6 py-10 text-center">
        <div className="app-title text-3xl tracking-[0.16em] text-slate-800">GONTIJO</div>
        <p className="mt-3 text-sm text-slate-500">Validando sessao administrativa...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useAuth()

  if (!isReady) return <AppLoading />

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function LoginRoute() {
  const { isAuthenticated, isReady } = useAuth()

  if (!isReady) return <AppLoading />

  return isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppBootstrap />

      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="usuarios/novo" element={<UsuarioFormPage />} />
          <Route path="usuarios/:id/editar" element={<UsuarioFormPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/novo" element={<ClienteFormPage />} />
          <Route path="clientes/:id/editar" element={<ClienteFormPage />} />
          <Route path="obras" element={<ObrasPage />} />
          <Route path="obras/nova" element={<ObraFormPage />} />
          <Route path="obras/:id/editar" element={<ObraFormPage />} />
          <Route path="equipamentos" element={<EquipamentosPage />} />
          <Route path="producao" element={<ProducaoPage />} />
          <Route path="ponto-verificacao" element={<PontoVerificacaoPage />} />
          <Route path="avaliacao-ajudantes" element={<AjudantesAvaliacaoPage />} />
          <Route path="diarios" element={<DiariosPage />} />
          <Route path="diarios/conferencia" element={<DiarioConferenciaPage />} />
          <Route path="diarios/:id/editar" element={<DiarioFormPage />} />
          <Route path="portal-clientes" element={<PortalClientesPage />} />
          <Route path="cursos" element={<CursosPage />} />
          <Route path="cursos/novo" element={<CursoFormPage />} />
          <Route path="cursos/resultados" element={<CursosResultadosPage />} />
          <Route path="cursos/pontos" element={<CursosPontosPage />} />
          <Route path="cursos/:id/editar" element={<CursoFormPage />} />
          <Route path="cursos/:id/prova" element={<CursoProvaPage />} />
          <Route path="cursos/:id/atribuicoes" element={<CursoAtribuicoesPage />} />
        </Route>

        <Route path="/operador/login" element={<OperadorLoginRoute />} />
        <Route path="/operador/carregando" element={<OperadorSplashPage />} />
        <Route path="/assinatura/diario/:token" element={<AssinaturaClientePage />} />
        <Route path="/portal-cliente/login" element={<ClientePortalLoginRoute />} />
        <Route path="/portal-cliente" element={<ClientePortalPrivateRoute><ClientePortalDashboardPage /></ClientePortalPrivateRoute>} />
        <Route
          path="/operador"
          element={
            <OperadorPrivateRoute>
              <OperadorHomePage />
            </OperadorPrivateRoute>
          }
        />
        <Route path="/operador/diario-de-obras" element={<OperadorPrivateRoute><DiarioMenu /></OperadorPrivateRoute>} />
        <Route path="/operador/diario-de-obras/pesquisar" element={<OperadorPrivateRoute><DiarioPesquisar /></OperadorPrivateRoute>} />
        <Route path="/operador/diario-de-obras/novo" element={<OperadorPrivateRoute><DiarioNovoObra /></OperadorPrivateRoute>} />
        <Route path="/operador/diario-de-obras/novo/:equipamentoId" element={<OperadorPrivateRoute><DiarioPainel /></OperadorPrivateRoute>} />
        <Route path="/operador/diario-de-obras/novo/:equipamentoId/:modulo" element={<OperadorPrivateRoute><DiarioModuloPage /></OperadorPrivateRoute>} />
        <Route path="/operador/indique-uma-obra" element={<OperadorPrivateRoute><IndiqueUmaObraPage /></OperadorPrivateRoute>} />
        <Route path="/operador/fato-observado" element={<OperadorPrivateRoute><FatoObservadoPage /></OperadorPrivateRoute>} />
        <Route path="/operador/configuracoes" element={<OperadorPrivateRoute><OperadorConfiguracoesPage /></OperadorPrivateRoute>} />
        <Route path="/operador/cursos" element={<OperadorPrivateRoute><OperadorCursosPage /></OperadorPrivateRoute>} />
        <Route path="/operador/cursos/:id" element={<OperadorPrivateRoute><OperadorCursoDetalhePage /></OperadorPrivateRoute>} />
        <Route path="/operador/cursos/:id/prova" element={<OperadorPrivateRoute><OperadorProvaPage /></OperadorPrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
