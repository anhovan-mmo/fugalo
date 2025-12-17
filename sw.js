
const CACHE_NAME = 'fugalo-crm-v4-pro';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './index.css'
];

// 1. INSTALL: Cache static assets immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force activation immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch(err => console.error('[SW] Cache fail:', err));
    })
  );
});

// 2. ACTIVATE: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients immediately
  );
});

// 3. FETCH: Network First for API/Data, Cache First for Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http requests (e.g., chrome-extension)
  if (!url.protocol.startsWith('http')) return;

  // Strategy for Images/Fonts/Static: Cache First -> Network -> Fallback
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|woff2)$/) || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Strategy for HTML/Navigation: Network First -> Cache Fallback (Ensure fresh data)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('./index.html'); // Offline fallback
        })
    );
    return;
  }
});

// 4. PUSH NOTIFICATION: Handle incoming push
self.addEventListener('push', function(event) {
  let data = { 
      title: 'Fugalo CRM', 
      body: 'Bạn có thông báo mới!', 
      url: './', 
      icon: 'https://i.imgur.com/KzXj0XJ.png' 
  };
  
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: 'https://cdn-icons-png.flaticon.com/512/9187/9187604.png', // Small monochrome icon
    vibrate: [100, 50, 100],
    data: {
      url: data.url
    },
    actions: [
      { action: 'open', title: 'Xem ngay' },
      { action: 'close', title: 'Đóng' }
    ],
    tag: 'fugalo-notification' // Group notifications
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. NOTIFICATION CLICK: Focus existing tab instead of opening new one
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = new URL(event.notification.data.url || './', self.location.origin).href;

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    // Check if there is already a window/tab open with the target URL
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      // If URL matches or it's the base root, focus it
      if ((client.url === urlToOpen || client.url.includes('index.html')) && 'focus' in client) {
        return client.focus();
      }
    }
    // If no window is open, open a new one
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen);
    }
  });

  event.waitUntil(promiseChain);
});
