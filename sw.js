// =========================================
// SERVICE WORKER - PRE-CACHE & AUTO-UPDATE
// Đảm bảo 100% không báo 404 khi Offline
// =========================================

const CACHE_NAME = 'brain-os-dynamic-cache';

// DANH SÁCH BẮT BUỘC PHẢI KHAI BÁO CÁC FILE ĐỂ NẠP TRƯỚC
// Bạn phải liệt kê tất cả các file game con vào đây!
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './manifest.json',
    './games/cubic-logic.js',
    './games/tri-nho-co-dien.js', // File game con số 1
    './games/matrix-rotate.js',   // File game con số 2 (Khai báo thêm nếu bạn làm xong)
    './games/mau-sac-lua-doi.js',
    // Cứ mỗi khi tạo 1 game mới, phải thêm đường dẫn file vào danh sách này.
];

// 1. CÀI ĐẶT: Nạp trước toàn bộ Súng Ống Đạn Dược (Pre-caching)
self.addEventListener('install', event => {
    self.skipWaiting(); // Ép kích hoạt ngay
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Đang tải sẵn toàn bộ file hệ thống và Game Con vào ổ cứng...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => {
            console.error('[SW] Lỗi Nạp trước:', err);
        })
    );
});

// 2. KÍCH HOẠT: Chiếm quyền điều khiển
self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// 3. TÌM NẠP (FETCH): Cơ chế Stale-While-Revalidate (Cho Game không bao giờ cũ)
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    // Bỏ qua các API của Supabase và Extension
    if (requestUrl.includes('supabase.co') || requestUrl.startsWith('chrome-extension://')) {
        return;
    }

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(cachedResponse => {
                
                // Mệnh lệnh song song: Cập nhật file mới từ Server về máy
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    console.log('[SW-Auto] Offline, dùng cache cho:', requestUrl);
                });

                // Nhả file từ Cache ra ngay lập tức cho tốc độ tải cực nhanh
                // Nếu chưa có (Bị lọt sổ), chờ kéo từ mạng về.
                return cachedResponse || fetchPromise;
            });
        })
    );
});
