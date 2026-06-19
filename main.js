// Khởi tạo Hệ điều hành quản lý chung
window.AppManager = {
    totalScore: 0,
    currentGameScript: null, // Lưu dấu vết file game đang chơi

    // Hàm 1: Mở một game con
    openGame: function(gameId) {
        // 1. Chuyển đổi giao diện (Ẩn menu, Hiện sân khấu game)
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('active');
        
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('game-screen').classList.add('active');

        // 2. Dọn sạch rác ở sân khấu cũ (nếu có)
        document.getElementById('game-canvas').innerHTML = '<p>Đang tải game...</p>';

        // 3. Tải file logic của game con vào hệ thống
        this.loadGameScript(gameId);
    },

    // Hàm 2: Thoát game về Menu
    quitGame: function() {
        // 1. Dọn dẹp giao diện sân khấu
        document.getElementById('game-canvas').innerHTML = '';

        // 2. Gỡ bỏ file game cũ khỏi hệ thống để giải phóng bộ nhớ
        if (this.currentGameScript) {
            this.currentGameScript.remove();
            this.currentGameScript = null;
        }

        // Nếu game con có hàm dọn dẹp riêng, gọi nó để dừng các vòng lặp thời gian
        if (window.CurrentGame && typeof window.CurrentGame.cleanup === 'function') {
            window.CurrentGame.cleanup();
            window.CurrentGame = null; // Xóa sổ game con
        }

        // 3. Đảo ngược giao diện (Ẩn game, Hiện menu)
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('active');
        
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-screen').classList.add('active');
    },

    // Hàm 3: Cộng điểm từ game con gửi ra
    addScore: function(points) {
        this.totalScore += points;
        document.getElementById('global-score').innerText = this.totalScore;
    },

    // --- HÀM NỘI BỘ: Kỹ thuật nhúng file JS động (Dynamic Script Loading) ---
    loadGameScript: function(gameId) {
        // Tạo ra một thẻ <script src="games/ten-game.js"></script>
        const script = document.createElement('script');
        script.src = `games/${gameId}.js`;
        
        // Bắt sự kiện khi tải xong
        script.onload = function() {
            // Khi file tải xong, gọi hàm bắt đầu của game đó
            if (window.CurrentGame && typeof window.CurrentGame.init === 'function') {
                window.CurrentGame.init();
            }
        };

        // Gắn vào cuối thẻ body để chạy
        document.body.appendChild(script);
        this.currentGameScript = script; // Lưu lại để tí nữa xóa
    }
};