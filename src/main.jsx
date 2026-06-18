import { createRoot } from 'react-dom/client';
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
  // localStorage bloqueado — substituir por memória
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

// Render com fallback de erro visível
try {
  createRoot(document.getElementById('root')).render(<App />);
} catch (err) {
  console.error('Erro ao inicializar app:', err);
  document.getElementById('root').innerHTML = `
    <div style="color:#fff;background:#000;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;padding:32px;text-align:center;font-family:sans-serif;">
      <div style="font-size:32px">⚠️</div>
      <div style="font-size:18px;font-weight:700">Erro ao carregar</div>
      <div style="font-size:14px;color:#888;">Abra o app no Safari ou Chrome para melhor experiência.</div>
      <a href="${window.location.href}" style="color:#30d158;font-size:14px;">Tentar novamente</a>
    </div>
  `;
}
