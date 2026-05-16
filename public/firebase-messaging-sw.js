importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

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

// Evita duplicata quando o app está aberto
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});

self.addEventListener('push', (event) => {
  // Se o app está em foreground (cliente focado), não mostra a notificação do SW
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const focused = clientList.some((c) => c.focused);
      if (focused) return; // app aberto e focado — FCM já entrega direto
      // se não está focado, deixa o onBackgroundMessage cuidar
    })
  );
});