const CACHE_NAME = 'csirkerkereszt-cache-v1';
// Azok a fájlok, amiket offline is el akarunk érni
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'game.js'
    // Itt kellene listázni az ikonokat is (pl. 'icon-192.png')
];

// 1. Telepítés: A Service Worker letölti a fájlokat
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache megnyitva');
                return cache.addAll(urlsToCache);
            })
    );
});

// 2. Aktiválás: A régi cache-ek törlése (ha van)
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 3. Lekérés (Fetch): Ez az offline varázslat
// Amikor a játék kér egy fájlt (pl. game.js)
self.addEventListener('fetch', event => {
    event.respondWith(
        // Megpróbáljuk először a cache-ből (gyors, offline)
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response; // Ha megvan a cache-ben, visszaadjuk
                }
                
                // Ha nincs meg, megpróbáljuk letölteni a hálózatról
                return fetch(event.request)
                    .then(response => {
                        // Ha sikeres a letöltés, mentsük el a cache-be
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
    );
});
