// =========================================
// SERVICE WORKER - BỘ XỬ LÝ OFFLINE (ZERO-TOUCH)
// Kỹ thuật: Không cần Versioning, Tự động Revalidate
// =========================================

// Chỉ dùng 1 kho lưu trữ duy nhất, không đánh số phiên bản
const CACHE_NAME = 'brain-os-dynamic-cache';

// Sự kiện Cài đặt: Tự động kích hoạt ngay lập tức
self.addEventListener('install', event => {
    self.skipWaiting();
});

// Sự kiện Kích hoạt: Chiếm quyền điều khiển các tab
self.addEventListener('activate', event => {
    event.waitUntil(self.clients.claim());
});

// Sự kiện Tìm nạp (Fetch): Trái tim của sự Tự Động
self.addEventListener('fetch', event => {
    const requestUrl = event.request.url;

    // 1. CẤM LƯU ĐỆM CÁC TÀI NGUYÊN ĐẶC BIỆT
    // Bỏ qua các API của Supabase và các Chrome Extension nội bộ
    if (requestUrl.includes('supabase.co') || requestUrl.startsWith('chrome-extension://')) {
        return;
    }

    // Nếu người dùng thực hiện POST, PUT (VD: Gửi điểm lên server thủ công) thì không bắt
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            // CƠ CHẾ: STALE-WHILE-REVALIDATE
            return cache.match(event.request).then(cachedResponse => {
                
                // --- NHIỆM VỤ NGẦM: LÊN SERVER TÌM BẢN MỚI ---
                // Dù có Cache hay không, luôn luôn lên Server kéo file về
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Nếu mạng tải về thành công và hợp lệ
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        // Tự động GHI ĐÈ file cũ trong Cache bằng file mới tải về.
                        // => Đây là mấu chốt để bạn không bao giờ cần đổi số Version!
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(err => {
                    // Nếu mất mạng, hệ thống im lặng nuốt lỗi, giữ nguyên file cũ trong kho
                    console.log('[SW-Auto] Offline, dùng cache cho:', requestUrl);
                });

                // --- NHIỆM VỤ CHÍNH: XUẤT RA MÀN HÌNH ---
                // NẾU TÌM THẤY TRONG KHO: Nhả ngay ra màn hình cho Tốc Độ Phản Hồi Bàn Thờ (0.01s).
                // Phía sau hậu trường, 'fetchPromise' vẫn đang tải file mới đè vào kho để LẦN SAU người dùng xài.
                // NẾU CHƯA TỪNG VÀO GAME (Trống Cache): Chờ 'fetchPromise' tải về rồi mới nhả ra.
                return cachedResponse || fetchPromise;
            });
        })
    );
});
