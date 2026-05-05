import { createRoot } from 'react-dom/client';
import App from './App.jsx';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Service Worker registrado!'))
      .catch((err) => console.log('SW erro:', err));
  });
}

createRoot(document.getElementById('root')).render(<App />);