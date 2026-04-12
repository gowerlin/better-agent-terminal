import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Unknown error',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.electronAPI?.debug?.log(
      `[ErrorBoundary] Caught render error: ${error.message}\n` +
      `Component stack: ${info.componentStack}`
    )
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠</div>
            <div className="error-boundary-title">發生錯誤</div>
            <div className="error-boundary-message">{this.state.errorMessage}</div>
            <button className="error-boundary-reload" onClick={this.handleReload}>
              重新載入
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
