// ==========================================
// 🟢 DÁN ĐOẠN NÀY LÊN TRÊN CÙNG CỦA FILE main.js 🟢
window.GameInterface = {
    // ... (Các hàm updateScore, updateTime, updateLives, resetStatus của Lộc giữ nguyên ở trên) ...

    // 5. Hiện Menu Tạm Dừng
    showPauseMenu: function() {
        document.getElementById('pause-overlay').classList.remove('hidden');
        // Ra lệnh cho game con TẠM DỪNG (Dừng đồng hồ, khóa click)
        if (window.CurrentGame && typeof window.CurrentGame.pause === 'function') {
            window.CurrentGame.pause();
        }
    },

    // 6. Ẩn Menu Tạm Dừng
    hidePauseMenu: function() {
        document.getElementById('pause-overlay').classList.add('hidden');
    },

    // 7. Tiếp tục chơi
    resumeGame: function() {
        this.hidePauseMenu();
        // Ra lệnh cho game con CHẠY TIẾP
        if (window.CurrentGame && typeof window.CurrentGame.resume === 'function') {
            window.CurrentGame.resume();
        }
    },

    // 8. Chơi lại (Restart)
    restartGame: function() {
        this.hidePauseMenu();
        this.resetStatus(); // Xóa sạch điểm số trên thanh trạng thái hệ thống
        
        // Ra lệnh cho game con CHƠI LẠI (Game con sẽ tự xử lý logic lùi 3 màn)
        if (window.CurrentGame && typeof window.CurrentGame.restart === 'function') {
            window.CurrentGame.restart();
        }
    }
};
// ==========================================

// Khởi tạo Hệ điều hành quản lý chung
window.AppManager = {
    totalScore: 0,
    currentGameScript: null, // Lưu dấu vết file game đang chơi

    // Hàm 1: Mở một game con
    openGame: function(gameId) {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('active');
        
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('active');

        // Bổ sung: Reset điểm/thời gian về 0 mỗi khi mở game mới
        if (window.GameInterface) {
            window.GameInterface.resetStatus();
        }

        // Sân khấu chính là 'game-canvas'
        document.getElementById('game-canvas').innerHTML = '<p style="text-align:center; margin-top:50px;">Đang tải dữ liệu mô-đun...</p>';

        this.loadGameScript(gameId);
    },

    // Hàm 2: Thoát game về Menu
    quitGame: function() {
        // Xóa giao diện
        document.getElementById('game-canvas').innerHTML = '';

        // Dọn dẹp logic (Tắt đếm ngược, tắt sự kiện của game con)
        if (window.CurrentGame && typeof window.CurrentGame.cleanup === 'function') {
            window.CurrentGame.cleanup();
            window.CurrentGame = null;
        }

        // Xóa thẻ <script> khỏi bộ nhớ
        if (this.currentGameScript) {
            this.currentGameScript.remove();
            this.currentGameScript = null;
        }

        // Đảo ngược màn hình
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('active');
        
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-screen').classList.add('active');
    },

    // Hàm 3: Cộng điểm
    addScore: function(points) {
        this.totalScore += points;
        console.log("Tổng điểm hệ thống:", this.totalScore);
        // Lưu ý: Cần thêm <span id="global-score"> vào header của bạn nếu muốn hiển thị điểm nhé
        let scoreEl = document.getElementById('global-score');
        if(scoreEl) scoreEl.innerText = this.totalScore;
    },

    // Hàm Nội Bộ: Nhúng Script
    loadGameScript: function(gameId) {
        const script = document.createElement('script');
        // Thêm ?v=Date.now() để chống Cache trong lúc bạn code, xóa đi khi public web
        script.src = `games/${gameId}.js?v=` + Date.now(); 
        
        script.onload = function() {
            // Khi file tải xong, bắt buộc phải có window.CurrentGame.init()
            if (window.CurrentGame && typeof window.CurrentGame.init === 'function') {
                document.getElementById('game-canvas').innerHTML = ''; // Xóa chữ "đang tải"
                window.CurrentGame.init(); // Kích nổ game
            } else {
                document.getElementById('game-canvas').innerHTML = '<p style="color:red; text-align:center;">Lỗi File Mô đun: Thiếu cấu trúc window.CurrentGame!</p>';
            }
        };

        script.onerror = function() {
            document.getElementById('game-canvas').innerHTML = `<p style="color:red; text-align:center;">Lỗi 404: Không tìm thấy file games/${gameId}.js</p>`;
        };

        document.body.appendChild(script);
        this.currentGameScript = script;
    }
};
