// ==========================================
// 🟢 DÁN ĐOẠN NÀY LÊN TRÊN CÙNG CỦA FILE main.js 🟢
window.GameInterface = {
    // 1. Hàm cập nhật điểm
    updateScore: function(points) {
        document.getElementById('global-score').innerText = points;
    },
    
    // 2. Hàm cập nhật thời gian (Game con tự format chuỗi "0:45" rồi đẩy ra đây)
    updateTime: function(timeString) {
        document.getElementById('global-time').innerText = timeString;
    },
    
    // 3. Hàm cập nhật mạng (Game con truyền vào số mạng còn lại, ví dụ: 2)
    updateLives: function(remainingLives) {
        const dots = document.querySelectorAll('#global-lives .dot');
        dots.forEach((dot, index) => {
            if (index < remainingLives) {
                dot.classList.add('active'); // Còn mạng thì sáng
            } else {
                dot.classList.remove('active'); // Mất mạng thì mờ đi
            }
        });
    },

    // 4. Hàm Reset (Đưa mọi thứ về số 0 khi bắt đầu game mới)
    resetStatus: function() {
        this.updateScore(0);
        this.updateTime("0:00");
        this.updateLives(3); // Mặc định reset về 3 mạng
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
