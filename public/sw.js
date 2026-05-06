importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

const VERSION = 'v1.0.2';

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

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
  });
});
