import { createRoot } from 'react-dom/client';
import { Component } from 'react';
import App from './App.jsx';

// Registrar service worker com segurança
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registrado!'))
      .catch((err) => console.log('SW erro:', err));
  });
}

// Patch de segurança para localStorage em WebViews restritivos (Instagram, WhatsApp iOS)
try {
  localStorage.setItem('__test__', '1');
  localStorage.removeItem('__test__');
} catch (e) {
  const mem = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k) => mem[k] ?? null,
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; },
      clear: () => { Object.keys(mem).forEach(k => delete mem[k]); },
    },
    writable: false,
  });
}

// Error Boundary real do React — captura erros durante render/lifecycle
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crash capturado:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 32, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Algo deu errado</div>
          <div style={{ color: '#888', fontSize: 14, maxWidth: 320 }}>
            Esse navegador embutido (WhatsApp/Instagram) pode ter limitações. Toque nos três pontinhos no topo e escolha "Abrir no navegador" (Safari/Chrome).
          </div>
          <div style={{ color: '#ff6b6b', fontSize: 12, maxWidth: 340, textAlign: 'left', background: '#1a1a1a', padding: 12, borderRadius: 10, overflowWrap: 'break-word', fontFamily: 'monospace' }}>
            {String(this.state.error?.message || this.state.error)}
            {this.state.error?.stack && (
              <div style={{ marginTop: 8, fontSize: 10, color: '#666', whiteSpace: 'pre-wrap' }}>
                {String(this.state.error.stack).slice(0, 500)}
              </div>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 8, background: '#30d158', color: '#000', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Watchdog: se a tela continuar vazia/preta após 6s, força um fallback visível
const watchdog = setTimeout(() => {
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `
      <div style="color:#fff;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:32px;text-align:center;font-family:sans-serif;">
        <div style="font-size:32px">⚠️</div>
        <div style="font-size:18px;font-weight:700">Não foi possível carregar</div>
        <div style="font-size:14px;color:#888;max-width:320px;">Esse navegador embutido pode ter limitações. Toque nos três pontinhos no topo e escolha "Abrir no navegador" (Safari/Chrome).</div>
        <button onclick="window.location.reload()" style="margin-top:8px;background:#30d158;color:#000;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:700;">Tentar novamente</button>
      </div>
    `;
  }
}, 6000);

try {
  createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  // Se o render chegou até aqui sem lançar, cancela o watchdog após o próximo frame
  requestAnimationFrame(() => requestAnimationFrame(() => clearTimeout(watchdog)));
} catch (err) {
  console.error('Erro síncrono ao inicializar app:', err);
  clearTimeout(watchdog);
  document.getElementById('root').innerHTML = `
    <div style="color:#fff;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:32px;text-align:center;font-family:sans-serif;">
      <div style="font-size:32px">⚠️</div>
      <div style="font-size:18px;font-weight:700">Erro ao carregar</div>
      <div style="font-size:14px;color:#888;">Abra o app no Safari ou Chrome para melhor experiência.</div>
      <button onclick="window.location.reload()" style="margin-top:8px;background:#30d158;color:#000;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:700;">Tentar novamente</button>
    </div>
  `;
}
