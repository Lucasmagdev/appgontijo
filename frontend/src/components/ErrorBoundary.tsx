import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Captura erros de render em qualquer página e mostra uma tela de recuperação
 * em vez de desmontar a árvore inteira (tela branca = "o app fechou").
 * É a rede de segurança que garante que um bug pontual numa página não derrube
 * o aplicativo todo do operador.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log para diagnóstico — aparece no console do dispositivo / monitoramento.
    console.error('[ErrorBoundary] erro de render capturado:', error, info.componentStack)
  }

  handleReload = () => {
    // Recarrega a aplicação do zero. A sessão persiste no localStorage, então
    // o operador volta para onde estava sem precisar logar de novo.
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/operador'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '24px',
          background: '#0f1117',
          color: '#fff',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '44px' }}>⚠️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Algo deu errado nesta tela</h1>
          <p style={{ margin: '10px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)', maxWidth: '320px' }}>
            Tente recarregar. Sua sessão continua ativa — você não precisa entrar de novo.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={this.handleReload}
            style={{
              border: 'none',
              borderRadius: '12px',
              background: '#c60926',
              color: '#fff',
              padding: '12px 22px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          <button
            onClick={this.handleGoHome}
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px',
              background: 'transparent',
              color: '#fff',
              padding: '12px 22px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Início
          </button>
        </div>
      </div>
    )
  }
}
