// =========================================
// SERVICE WORKER - PRE-CACHE & AUTO-UPDATE V3
// =========================================

const CACHE_NAME = 'brain-os-dynamic-v3';

// Liệt kê chính xác tên thư mục. Đừng thừa dấu '/' nào.
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './manifest.json',
    './games/tri-nho-co-dien.js',
    './games/matrix-rotate.js',
    './games/cubic-logic.js',
    './games/mau-sac-lua-doi.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Cài đặt PWA: Lưu đệm toàn bộ tài sản...');
            // Dùng { cache: 'reload' } để bỏ qua cache thừa của HTTP
            const requests = ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
            return cache.addAll(requests);
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // 1. Chặn request API và các lệnh tải ngoài
    if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Chiến thuật "Bắt hai tay": Trả cache nếu có, ngầm lên mạng tải mới!
            const fetchPromise = fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(err => {
                console.log('[SW] Đang Mất Mạng!');
            });

            // Nếu trong máy không có, mạng cũng rớt -> Quăng Phao Cứu Sinh (Fallback HTML)
            if (!cachedResponse) {
                return fetchPromise.catch(() => {
                    // Trả về trang lỗi HTML tự sinh (Áp dụng nếu là request HTML, nếu là JS/CSS thì kệ)
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return new Response(
                            `<div style="color:white; background:#2b2c31; height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:sans-serif;">
                                <h1 style="color:#f05e4b;">⚠️ CẤT MẠNG RỒI SẾP ƠI!</h1>
                                <p>Cần kết nối Wifi 1 lần duy nhất để tôi tải game vào ổ cứng đã nha!</p>
                            </div>`,
                            { headers: { 'Content-Type': 'text/html' } }
                        );
                    }
                });
            }

            return cachedResponse || fetchPromise;
        })
    );
});
