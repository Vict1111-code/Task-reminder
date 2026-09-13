const CACHE_NAME = 'task-reminder-v2.1';
const APP_SHELL = ['./', './index.html', './styles.css', './js/app.js', './js/storage.js', './js/tasks.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)); return response;
  }).catch(() => caches.match('./index.html'))));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId;
  if (!taskId) return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const client = clients.find((item) => 'focus' in item);
    const type = event.action === 'done' ? 'COMPLETE_TASK' : 'SNOOZE_TASK';
    if (client) { client.postMessage({ type, taskId }); return client.focus(); }
    return self.clients.openWindow('./');
  }));
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'Task Reminder', {
    body: data.body || "It's time for your task!", icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { taskId: data.taskId }, actions: [{ action: 'snooze', title: 'Snooze 10m' }, { action: 'done', title: 'Done' }]
  }));
});