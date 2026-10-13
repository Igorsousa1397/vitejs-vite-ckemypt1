importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Assume na hora: sem isso a versão nova só entrava quando todas as abas/PWA
// fechassem, e o celular seguia com o SW antigo (que duplicava a notificação).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

firebase.initializeApp({
  apiKey: "AIzaSyCC5a-yhc0myEnlhcs5pgCXOSx1h6b5CmU",
  authDomain: "servos-peniel.firebaseapp.com",
  projectId: "servos-peniel",
  storageBucket: "servos-peniel.firebasestorage.app",
  messagingSenderId: "743267134560",
  appId: "1:743267134560:web:b3a1b2282eb3970f856705"
});

// Só inicializar o messaging já registra o listener de push do SDK, que exibe
// a notificação sozinho quando o payload traz `notification` (ícone e link de
// abertura vêm do servidor — functions/index.js, enviarPush).
//
// NÃO registrar onBackgroundMessage com showNotification aqui: o SDK exibe a
// notificação E depois chama esse handler, então cada aviso chegava duas
// vezes no celular.
firebase.messaging();

// Clique: para notificações do FCM o SDK trata (foca o app aberto ou abre o
// link) e barra os outros listeners. Este fallback vale só para notificações
// que não vieram do FCM.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberta = lista.find((c) => 'focus' in c);
      return aberta ? aberta.focus() : clients.openWindow('/');
    })
  );
});
