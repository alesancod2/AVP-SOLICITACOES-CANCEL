// AVP System - Service Worker v3 (network-first para tudo)
// Garante que usuarios sempre vejam a versao mais recente
const CACHE_NAME = "avp-system-v3";

self.addEventListener("install", (event) => {
  // Ativa imediatamente sem esperar
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Limpa TODOS os caches antigos
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Network-first para TUDO (API e paginas)
  // Se network falhar, tenta cache como fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cacheia resposta valida para uso offline
        if (response.status === 200 && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
