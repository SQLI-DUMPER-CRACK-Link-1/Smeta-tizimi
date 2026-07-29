import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

// Xatolarni avtomatik GAS ga yuborish
function xatoYubor(manba: string, xabar: string, url?: string, line?: number) {
  fetch('/api/xato', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manba, xabar, url, line })
  }).catch(() => {});
}

window.addEventListener('error', e => xatoYubor('js', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', e => xatoYubor('promise', String(e.reason)));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Don't refetch on tab switch for this kind of app
      retry: 1, // Only retry once on failure
    },
  },
})

import { Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:32, color:'#FF5A5A', fontFamily:'monospace', background:'#0B0E14', minHeight:'100vh'}}>
          <h2>Sahifada xatolik</h2>
          <pre style={{whiteSpace:'pre-wrap'}}>{this.state.error.message}</pre>
          <button onClick={() => location.reload()} style={{marginTop:16, padding:'8px 16px', background:'#232A3B', color:'white', border:'none', borderRadius:4, cursor:'pointer'}}>Qayta yuklash</button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
