// Service worker mínimo — existe só pra deixar o painel instalável como app (PWA) no Android/Chrome.
// De propósito NÃO guarda nada em cache: os dados (leads, candidatos, agenda) mudam o tempo todo,
// então toda requisição sempre vai direto pra rede, igual seria sem service worker nenhum.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
