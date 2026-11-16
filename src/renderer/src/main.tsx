import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { StoreProvider } from './store';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="page">
          <div className="card">
            <h2>Ocurrió un error en la interfaz</h2>
            <p className="muted mt8">Tus datos están a salvo en la base local. Reinicia la vista para continuar.</p>
            <pre className="small" style={{ whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
            <button className="btn primary mt16" onClick={() => this.setState({ error: null })}>
              Reintentar
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
