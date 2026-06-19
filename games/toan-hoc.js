// Gói toàn bộ game vào một Object tên là CurrentGame để main.js gọi
window.CurrentGame = {
    init: function() {
        // Lấy sân khấu từ index.html
        const canvas = document.getElementById('game-canvas');
        
        // Vẽ giao diện riêng của game Toán học
        canvas.innerHTML = `
            <h2 style="margin-bottom: 20px;">Game Toán Tốc Độ</h2>
            <p style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">1 + 1 = ?</p>
            <button style="padding: 10px 20px; font-size: 18px; cursor: pointer;" onclick="window.CurrentGame.win()">Đáp án là 2</button>
        `;
    },

    win: function() {
        alert("Chúc mừng! Trả lời đúng, +10 điểm!");
        // Gọi hàm của hệ điều hành main.js để cộng điểm
        window.AppManager.addScore(10);
        // Chơi xong thì tự thoát ra Menu
        window.AppManager.quitGame();
    },

    cleanup: function() {
        // Hàm này sẽ tự động chạy khi người chơi bấm nút "Thoát Về Menu"
        console.log("Game Toán đã được dọn dẹp sạch sẽ khỏi bộ nhớ!");
    }
};