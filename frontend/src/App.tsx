import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useOperadorAuth } from '@/hooks/useOperadorAuth'
import { useClientePortalAuth } from '@/hooks/useClientePortalAuth'
import AppLayout from '@/components/layout/AppLayout'

// Admin pages — carregadas sob demanda
const LoginPage = lazy(() => import('@/pages/Login'))
const HomePage = lazy(() => import('@/pages/Home'))
const UsuariosPage = lazy(() => import('@/pages/usuarios/Usuarios'))
const UsuarioFormPage = lazy(() => import('@/pages/usuarios/UsuarioForm'))
const ClientesPage = lazy(() => import('@/pages/clientes/Clientes'))
const ClienteFormPage = lazy(() => import('@/pages/clientes/ClienteForm'))
const ObrasPage = lazy(() => import('@/pages/obras/Obras'))
const ObraFormPage = lazy(() => import('@/pages/obras/ObraForm'))
const EquipamentosPage = lazy(() => import('@/pages/equipamentos/Equipamentos'))
const DiariosPage = lazy(() => import('@/pages/diarios/Diarios'))
const DiarioFormPage = lazy(() => import('@/pages/diarios/DiarioForm'))
const DiarioConferenciaPage = lazy(() => import('@/pages/diarios/DiarioConferenciaPage'))
const ProducaoPage = lazy(() => import('@/pages/producao/Producao'))
const PortalClientesPage = lazy(() => import('@/pages/clientes-portal/PortalClientesPage'))
const CursosPage = lazy(() => import('@/pages/cursos/Cursos'))
const CursoFormPage = lazy(() => import('@/pages/cursos/CursoForm'))
const CursoProvaPage = lazy(() => import('@/pages/cursos/CursoProva'))
const CursoAtribuicoesPage = lazy(() => import('@/pages/cursos/CursoAtribuicoes'))
const CursosResultadosPage = lazy(() => import('@/pages/cursos/CursosResultados'))
const CursosPontosPage = lazy(() => import('@/pages/cursos/CursosPontos'))
const PontoVerificacaoPage = lazy(() => import('@/pages/ponto/PontoVerificacaoPage'))
const AjudantesAvaliacaoPage = lazy(() => import('@/pages/ponto/AjudantesAvaliacaoPage'))
const WhatsAppLogsPage = lazy(() => import('@/pages/whatsapp/WhatsAppLogsPage'))

// Operador PWA — chunk separado
const OperadorLoginPage = lazy(() => import('@/pages/operador/OperadorLogin'))
const OperadorHomePage = lazy(() => import('@/pages/operador/OperadorHome'))
const OperadorSplashPage = lazy(() => import('@/pages/operador/OperadorSplash'))
const OperadorConfiguracoesPage = lazy(() => import('@/pages/operador/OperadorConfiguracoes'))
const DiarioMenu = lazy(() => import('@/pages/operador/diarios/DiarioMenu'))
const DiarioPesquisar = lazy(() => import('@/pages/operador/diarios/DiarioPesquisar'))
const DiarioNovoObra = lazy(() => import('@/pages/operador/diarios/DiarioNovoObra'))
const DiarioPainel = lazy(() => import('@/pages/operador/diarios/DiarioPainel'))
const DiarioModuloPage = lazy(() => import('@/pages/operador/diarios/DiarioModuloPage'))
const OperadorCursosPage = lazy(() => import('@/pages/operador/cursos/OperadorCursos'))
const OperadorCursoDetalhePage = lazy(() => import('@/pages/operador/cursos/OperadorCursoDetalhe'))
const OperadorProvaPage = lazy(() => import('@/pages/operador/cursos/OperadorProva'))
const FatoObservadoPage = lazy(() => import('@/pages/operador/FatoObservadoPage'))
const IndiqueUmaObraPage = lazy(() => import('@/pages/operador/IndiqueUmaObraPage'))

// Portal público
const AssinaturaClientePage = lazy(() => import('@/pages/public/AssinaturaClientePage'))
const ClientePortalLoginPage = lazy(() => import('@/pages/public/ClientePortalLoginPage'))
const ClientePortalDashboardPage = lazy(() => import('@/pages/public/ClientePortalDashboardPage'))

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

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

function OperadorOfflineBanner() {
  const online = useOnlineStatus()
  const [justReconnected, setJustReconnected] = useState(false)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (online) {
      setJustReconnected(true)
      const t = setTimeout(() => setJustReconnected(false), 3000)
      return () => clearTimeout(t)
    }
  }, [online])

  if (online && !justReconnected) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '10px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.02em',
        background: online ? '#16a34a' : '#b91c1c',
        color: '#fff',
        transition: 'background 0.3s',
      }}
    >
      {online
        ? '✓ Conexão restabelecida'
        : '⚠ Sem conexão com a internet — salvar não funcionará até voltar a rede'}
    </div>
  )
}

function OperadorPrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isReady } = useOperadorAuth()
  if (!isReady) return null
  return isAuthenticated ? (
    <>
      <OperadorOfflineBanner />
      {children}
    </>
  ) : <Navigate to="/operador/login" replace />
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
        <img
          src="/gontijo-logo-diarios.png"
          alt="Gontijo Fundações"
          className="mx-auto h-16 w-auto object-contain"
        />
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

      <Suspense fallback={<AppLoading />}>
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
          <Route path="whatsapp" element={<WhatsAppLogsPage />} />
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
      </Suspense>
    </BrowserRouter>
  )
}
