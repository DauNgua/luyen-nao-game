/**
 * TÊN FILE: games/mau-sac-lua-doi.js
 * GAME: MÀU SẮC LỪA DỐI (Stroop Effect)
 */

window.CurrentGame = {
    // 1. KHO LƯU TRỮ TRẠNG THÁI (Chỉ dùng riêng cho game này)
    state: {
        score: 0,
        level: 1,
        lives: 3,
        timeLeft: 0,
        timerInterval: null,
        correctColorId: '',
        isPlaying: false,
        isTransitioning: false,
        
        // Cấu hình danh sách màu
        COLORS: [
            { id: 'red', hex: '#FF3B30', name: 'ĐỎ' },
            { id: 'blue', hex: '#007AFF', name: 'XANH DƯƠNG' },
            { id: 'green', hex: '#34C759', name: 'XANH LÁ' },
            { id: 'yellow', hex: '#FFCC00', name: 'VÀNG' },
            { id: 'purple', hex: '#AF52DE', name: 'TÍM' }
        ]
    },


    // --- BỘ TẠO ÂM THANH GỖ (WOODEN SOUND ENGINE) ---
    audioCtx: null,
    playWoodenSound: function(type) {
        // Khởi tạo AudioContext khi người dùng tương tác lần đầu để tránh lỗi block của trình duyệt
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;

        if (type === 'tick') { // Tiếng click mộc nhẹ khi bắt đầu
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'correct') { // Tiếng gõ mõ trúc thanh tót (Trả lời đúng)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.15);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'error') { // Tiếng cộc gỗ trầm đục (Trả lời sai / Hết giờ)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    },

    // ==========================================
    // 2. HÀM KHỞI TẠO GAME (AppManager sẽ gọi hàm này)
    // ==========================================
    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        // Sinh toàn bộ giao diện và CSS tự động (Scoped CSS)
        container.innerHTML = `
            <style>
                /* THÊM BỘ CHỐNG CO RÚT TỪ CSS HỆ THỐNG */
                .stroop-wrapper, .stroop-wrapper * { box-sizing: border-box; }

                .stroop-wrapper {
                    background: var(--bg-card, #1E293B);
                    color: var(--text-main, #FFFFFF);
                    width: 100%; max-width: 450px;
                    margin: 0 auto; padding: 25px;
                    border-radius: 16px; text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    transition: background-color 0.2s ease;
                    user-select: none;
                }
                
                /* Ép chiều rộng 100% cho mọi khối để không bị ép nhỏ lại */
                .stroop-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 20px; font-size: 14px; opacity: 0.8; width: 100%;}
                .stroop-word-box {
                    width: 100%; height: 140px; display: flex; justify-content: center; align-items: center;
                    background: rgba(0,0,0,0.1); border-radius: 12px; margin-bottom: 20px;
                }
                .stroop-word { font-size: 50px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
                .stroop-timer-bar { width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
                .stroop-timer-fill { height: 100%; background: var(--color-primary, #3B82F6); width: 100%; transition: width 0.05s linear; }
                .stroop-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                
                /* Nút bấm */
                .stroop-wrapper .btn-flat {
                    background: var(--color-primary, #3B82F6); color: white; border: none; padding: 15px; font-size: 14px; font-weight: bold;
                    border-radius: 8px; cursor: pointer; transition: background 0.2s, transform 0.1s; width: 100%; outline: none;
                }
                .stroop-wrapper .btn-flat:hover { background: var(--color-primary-hover, #2563EB); }
                .stroop-wrapper .btn-flat:active { transform: scale(0.95); }
                
                /* Layout màn hình */
                .stroop-screen { display: none; flex-direction: column; align-items: center; min-height: 400px; justify-content: center; width: 100%;}
                .stroop-screen.active { display: flex; }
                
                /* FIX LỖI Ở ĐÂY: Ép giao diện chơi game thành dạng cột (column) giống màn Game Over */
                #stroop-game-area { display: none; flex-direction: column; align-items: center; width: 100%;}
                #stroop-game-area.active { display: flex; }
            </style>

            <div class="stroop-wrapper" id="stroop-wrapper">
                
                <!-- MENU BẮT ĐẦU CỦA GAME -->
                <div id="stroop-menu-screen" class="stroop-screen active">
                    <h1 style="font-size: 30px; margin-bottom: 10px; color: var(--color-primary);">MÀU SẮC LỪA DỐI</h1>
                    <p style="opacity: 0.8; margin-bottom: 30px; font-size: 15px; line-height: 1.6;">
                        Nhiệm vụ: Hãy chọn <b>MÀU SẮC</b> của nét chữ.<br>
                        Tuyệt đối không chọn <b>Ý NGHĨA</b> của từ!<br>
                        (Ví dụ: Chữ "ĐỎ" tô màu XANH -> Phải bấm XANH)
                    </p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">BẮT ĐẦU CHƠI</button>
                </div>

                <!-- KHU VỰC CHƠI -->
                <div id="stroop-game-area">
                    <div class="stroop-header">
                        <div>MÀN: <span id="stroop-level">1</span></div>
                        <div style="color: var(--color-success, #F59E0B);">ĐIỂM: <span id="stroop-score">0</span></div>
                        <div>MẠNG: <span id="stroop-lives">3</span></div>
                    </div>
                    
                    <div class="stroop-timer-bar"><div id="stroop-timer-fill" class="stroop-timer-fill"></div></div>
                    <div style="font-style: italic; margin-bottom: 10px;">Chữ này được tô màu gì?</div>
                    
                    <div class="stroop-word-box">
                        <div id="stroop-word" class="stroop-word">---</div>
                    </div>

                    <div class="stroop-grid" id="stroop-buttons-container"></div>
                </div>

                <!-- MENU GAME OVER -->
                <div id="stroop-gameover-screen" class="stroop-screen">
                    <h2 style="color: var(--color-error, #E11D48); font-size: 36px; margin-bottom: 10px;">HẾT MẠNG</h2>
                    <p style="font-size: 18px; margin-bottom: 20px;">Đạt được: <strong id="stroop-final-score" style="color: var(--color-success, #F59E0B); font-size: 24px;">0</strong> điểm</p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">CHƠI LẠI TỪ ĐẦU</button>
                </div>

            </div>
        `;
    },

    // ==========================================
    // 3. CÁC HÀM LOGIC CỦA GAME 
    // ==========================================
    startGame: function() {
        this.state.score = 0;
        this.playWoodenSound('tick');
        this.state.level = 1;
        this.state.lives = 3;
        this.state.isPlaying = true;
        this.state.isTransitioning = false;
        
        document.getElementById('stroop-menu-screen').classList.remove('active');
        document.getElementById('stroop-gameover-screen').classList.remove('active');
        document.getElementById('stroop-game-area').classList.add('active');
        
        this.updateUI();
        this.nextRound();
    },

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        this.updateUI();
        
        // Random Ý nghĩa (chữ) và Màu sắc (mực)
        let wordData = this.state.COLORS[Math.floor(Math.random() * this.state.COLORS.length)];
        let inkData = this.state.COLORS[Math.floor(Math.random() * this.state.COLORS.length)];
        
        // Tỷ lệ lừa đảo cao (70% ra màu mực khác ý nghĩa)
        if (Math.random() < 0.7) {
            while (inkData.id === wordData.id) {
                inkData = this.state.COLORS[Math.floor(Math.random() * this.state.COLORS.length)];
            }
        }

        const wordEl = document.getElementById('stroop-word');
        wordEl.innerText = wordData.name;
        wordEl.style.color = inkData.hex;
        
        this.state.correctColorId = inkData.id; // Ghi nhớ đáp án đúng là Màu Mực
        this.renderColorButtons();

        // Độ khó tăng dần: Timer tối đa 5s, giảm dần, nhưng không thấp hơn 1.2s
        const maxTime = Math.max(1200, 5000 - (this.state.level * 250)); 
        this.startTimer(maxTime);
    },

    renderColorButtons: function() {
        const btnContainer = document.getElementById('stroop-buttons-container');
        btnContainer.innerHTML = '';
        
        // Xáo trộn vị trí các nút màu
        let shuffledColors = [...this.state.COLORS].sort(() => Math.random() - 0.5);
        
        shuffledColors.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'btn-flat'; // Sử dụng biến hệ thống
            btn.innerText = color.name;
            // Gọi hàm kiểm tra kết quả khi bấm
            btn.onclick = () => this.handleChoice(color.id);
            btnContainer.appendChild(btn);
        });
    },

    handleChoice: function(selectedId) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        this.state.isTransitioning = true;
        clearInterval(this.state.timerInterval);

        const isCorrect = (selectedId === this.state.correctColorId);
        
        if (isCorrect) {
            this.playWoodenSound('correct'); // Thêm dòng này
            this.state.score += (10 + this.state.level);
            this.state.level++;
            this.triggerFeedback('success');
        } else {
            this.playWoodenSound('error'); // Thêm dòng này
            this.state.lives--;
            this.triggerFeedback('error');
        }

        setTimeout(() => {
            this.state.isTransitioning = false;
            this.nextRound();
        }, 300);
    },

    triggerFeedback: function(type) {
        const wrapperEl = document.getElementById('stroop-wrapper');
        const colorVar = type === 'success' ? 'var(--color-success, #4CAF50)' : 'var(--color-error, #6A1B9A)';
        const originalBg = wrapperEl.style.background;
        
        wrapperEl.style.background = colorVar;
        setTimeout(() => {
            if (this.state.isPlaying && document.getElementById('stroop-wrapper')) {
                wrapperEl.style.background = originalBg || 'var(--bg-card, #1E293B)';
            }
        }, 150);
    },

    startTimer: function(durationMs) {
        clearInterval(this.state.timerInterval);
        this.state.timeLeft = durationMs;
        const tickRate = 20; // 50fps cho thanh progress mượt mà
        const timerFillEl = document.getElementById('stroop-timer-fill');

        this.state.timerInterval = setInterval(() => {
            this.state.timeLeft -= tickRate;
            let percent = (this.state.timeLeft / durationMs) * 100;
            if(timerFillEl) timerFillEl.style.width = `${percent}%`;

            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timerInterval);
                if(timerFillEl) timerFillEl.style.width = `0%`;
                
                if (!this.state.isTransitioning) {
                    this.state.isTransitioning = true;
                    this.state.lives--; // Hết giờ = Mất 1 mạng

                    this.playWoodenSound('error');
                    
                    this.triggerFeedback('error');
                    setTimeout(() => {
                        this.state.isTransitioning = false;
                        this.nextRound();
                    }, 300);
                }
            }
        }, tickRate);
    },

    updateUI: function() {
        document.getElementById('stroop-level').innerText = this.state.level;
        document.getElementById('stroop-score').innerText = this.state.score;
        document.getElementById('stroop-lives').innerText = '❤️'.repeat(Math.max(0, this.state.lives));
    },

    gameOver: function() {
        this.state.isPlaying = false;
        clearInterval(this.state.timerInterval);
        
        document.getElementById('stroop-game-area').classList.remove('active');
        document.getElementById('stroop-gameover-screen').classList.add('active');
        document.getElementById('stroop-final-score').innerText = this.state.score;
        document.getElementById('stroop-wrapper').style.background = 'var(--bg-card, #1E293B)';
        
        // CỘNG ĐIỂM TỔNG VÀO HỆ THỐNG KHI GAME KẾT THÚC
        if(window.AppManager && typeof window.AppManager.addScore === 'function') {
            window.AppManager.addScore(this.state.score);
        }
    },

    // ==========================================
    // 4. HÀM DỌN DẸP BỘ NHỚ KHI THOÁT GAME BẰNG APPMANAGER
    // ==========================================
    cleanup: function() {
        // Rất quan trọng: Phải tắt đếm ngược, nếu không hàm ẩn vẫn chạy gây lag thiết bị
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
        }
        this.state.isPlaying = false;
    }
};
