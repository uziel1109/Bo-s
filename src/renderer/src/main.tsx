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

async function boot() {
  // Sin el puente de Electron estamos en la versión web (iPad/navegador): se crea el puente local.
  if (!window.bodyos) {
    const { createWebBridge } = await import('./web/bridge');
    try {
      window.bodyos = await createWebBridge();
    } catch (e) {
      document.getElementById('root')!.innerHTML = `<div style="padding:32px;font-family:system-ui;color:#eee">No se pudo iniciar el almacenamiento local de este navegador: ${(e as Error).message}</div>`;
      return;
    }
    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('./sw.js').catch(() => {});
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
}

boot();
