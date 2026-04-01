import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/Login'
import OperadorLoginPage from '@/pages/operador/OperadorLogin'
import OperadorHomePage from '@/pages/operador/OperadorHome'
import OperadorSplashPage from '@/pages/operador/OperadorSplash'
import OperadorPlaceholder from '@/pages/operador/OperadorPlaceholder'
import OperadorConfiguracoesPage from '@/pages/operador/OperadorConfiguracoes'
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
import ProducaoPage from '@/pages/producao/Producao'

function AppBootstrap() {
  const initAdmin = useAuth((state) => state.initialize)
  const initOperador = useOperadorAuth((state) => state.initialize)

  useEffect(() => {
    void initAdmin()
    void initOperador()
  }, [initAdmin, initOperador])

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
          <Route path="diarios" element={<DiariosPage />} />
          <Route path="diarios/:id/editar" element={<DiarioFormPage />} />
        </Route>

        <Route path="/operador/login" element={<OperadorLoginRoute />} />
        <Route path="/operador/carregando" element={<OperadorSplashPage />} />
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
        <Route path="/operador/indique-uma-obra" element={<OperadorPrivateRoute><OperadorPlaceholder titulo="Indique uma Obra" /></OperadorPrivateRoute>} />
        <Route path="/operador/mapa-de-obras" element={<OperadorPrivateRoute><OperadorPlaceholder titulo="Mapa de Obras" /></OperadorPrivateRoute>} />
        <Route path="/operador/fato-observado" element={<OperadorPrivateRoute><OperadorPlaceholder titulo="Fato Observado" /></OperadorPrivateRoute>} />
        <Route path="/operador/configuracoes" element={<OperadorPrivateRoute><OperadorConfiguracoesPage /></OperadorPrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
