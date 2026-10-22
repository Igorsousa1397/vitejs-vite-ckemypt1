importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const VERSION = 'v1.0.4';

// Toque na notificação mostrada com o app aberto (reg.showNotification no
// onMessage do App): foca a janela do app ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const aberta = lista.find((c) => 'focus' in c);
      return aberta ? aberta.focus() : clients.openWindow('/');
    })
  );
});

// Força atualização ao instalar nova versão
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== VERSION) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

firebase.initializeApp({
  apiKey: "AIzaSyCC5a-yhc0myEnlhcs5pgCXOSx1h6b5CmU",
  authDomain: "servos-peniel.firebaseapp.com",
  projectId: "servos-peniel",
  storageBucket: "servos-peniel.firebasestorage.app",
  messagingSenderId: "743267134560",
  appId: "1:743267134560:web:b3a1b2282eb3970f856705"
});

// O push normalmente chega no /firebase-messaging-sw.js (é ele que o getToken
// registra). Inicializar o messaging aqui só garante que, se alguma assinatura
// antiga estiver presa a este SW, o SDK exiba a notificação do mesmo jeito.
// Sem onBackgroundMessage + showNotification: o SDK já exibe o payload
// `notification` sozinho, e o handler manual fazia a notificação chegar em dobro.
firebase.messaging();
