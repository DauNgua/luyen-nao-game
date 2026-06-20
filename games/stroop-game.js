/**
 * TÊN GAME: Màu Sắc Lừa Dối (Stroop Effect)
 * MÔ TẢ: Bắt người chơi chọn MÀU SẮC của chữ, không phải Ý NGHĨA của chữ.
 * YÊU CẦU HTML: <div id="game-container"></div>
 */

function initStroopGame() {
    const container = document.getElementById('game-container');
    if (!container) {
        console.error("Lỗi: Không tìm thấy <div id='game-container'></div>");
        return;
    }

    // --- 1. DỮ LIỆU & TRẠNG THÁI GAME ---
    const COLORS = [
        { id: 'red', hex: '#FF3B30', name: 'ĐỎ' },
        { id: 'blue', hex: '#007AFF', name: 'XANH DƯƠNG' },
        { id: 'green', hex: '#34C759', name: 'XANH LÁ' },
        { id: 'yellow', hex: '#FFCC00', name: 'VÀNG' },
        { id: 'purple', hex: '#AF52DE', name: 'TÍM' }
    ];

    let state = {
        score: 0,
        level: 1,
        lives: 3,
        timeLeft: 0,
        timerInterval: null,
        correctColorId: '',
        isPlaying: false,
        isTransitioning: false
    };

    // --- 2. RENDER GIAO DIỆN VÀ CSS (Mô-đun hóa) ---
    // CSS fallback được cung cấp phòng trường hợp hệ thống chưa định nghĩa biến CSS
    const layoutHTML = `
        <style>
            .stroop-wrapper {
                background: var(--bg-card, #1E293B);
                color: var(--text-main, #FFFFFF);
                width: 100%;
                max-width: 450px;
                margin: 0 auto;
                padding: 20px;
                border-radius: 16px;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                transition: background-color 0.3s ease;
                user-select: none;
            }
            .stroop-header {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
                font-size: 14px;
                margin-bottom: 20px;
                opacity: 0.8;
            }
            .stroop-question {
                font-size: 16px;
                font-style: italic;
                margin-bottom: 10px;
            }
            .stroop-word-box {
                height: 120px;
                display: flex;
                justify-content: center;
                align-items: center;
                background: rgba(0,0,0,0.2);
                border-radius: 12px;
                margin-bottom: 20px;
            }
            .stroop-word {
                font-size: 48px;
                font-weight: 900;
                letter-spacing: 2px;
                text-transform: uppercase;
                text-shadow: 0 2px 4px rgba(0,0,0,0.5);
            }
            .stroop-timer-bar {
                height: 6px;
                background: rgba(255,255,255,0.1);
                border-radius: 3px;
                margin-bottom: 20px;
                overflow: hidden;
            }
            .stroop-timer-fill {
                height: 100%;
                background: var(--color-primary, #3B82F6);
                width: 100%;
                transition: width 0.1s linear;
            }
            .stroop-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
            }
            /* Ghi đè cấu trúc button hệ thống cho vừa với game */
            .btn-flat {
                background: var(--color-primary, #3B82F6);
                color: #fff;
                border: none;
                padding: 15px;
                font-size: 14px;
                font-weight: bold;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.2s, transform 0.1s;
                width: 100%;
            }
            .btn-flat:hover {
                background: var(--color-primary-hover, #2563EB);
            }
            .btn-flat:active {
                transform: scale(0.96);
            }
            
            /* Khu vực Màn hình ẩn (Overlay) */
            .stroop-screen { display: none; flex-direction: column; align-items: center; justify-content: center; height: 350px;}
            .stroop-screen.active { display: flex; }
            #stroop-game-area { display: none; }
            #stroop-game-area.active { display: block; }
        </style>

        <div class="stroop-wrapper" id="stroop-wrapper">
            
            <!-- MÀN HÌNH BẮT ĐẦU -->
            <div id="stroop-menu-screen" class="stroop-screen active">
                <h1 style="font-size: 32px; margin-bottom: 10px;">Màu Sắc Lừa Dối</h1>
                <p style="opacity: 0.8; margin-bottom: 30px; font-size: 14px; line-height: 1.5;">
                    Não trái đọc chữ, Não phải nhìn màu.<br>
                    Nhiệm vụ: Hãy chọn <b>MÀU CỦA CHỮ</b>, đừng để bị lừa bởi <b>Ý NGHĨA</b> của nó!
                </p>
                <button class="btn-flat" id="stroop-btn-start">BẮT ĐẦU NGAY</button>
            </div>

            <!-- MÀN HÌNH CHƠI GAME -->
            <div id="stroop-game-area">
                <div class="stroop-header">
                    <div>MÀN: <span id="stroop-level">1</span></div>
                    <div>ĐIỂM: <span id="stroop-score" style="color: var(--color-success, #F59E0B);">0</span></div>
                    <div>MẠNG: <span id="stroop-lives">3</span></div>
                </div>
                
                <div class="stroop-timer-bar">
                    <div id="stroop-timer-fill" class="stroop-timer-fill"></div>
                </div>

                <div class="stroop-question">Màu của chữ này là màu gì?</div>
                <div class="stroop-word-box">
                    <div id="stroop-word" class="stroop-word">ĐANG TẢI...</div>
                </div>

                <div class="stroop-grid" id="stroop-buttons-container">
                    <!-- Các nút màu sẽ được sinh tự động ở đây -->
                </div>
            </div>

            <!-- MÀN HÌNH THUA CUỘC -->
            <div id="stroop-gameover-screen" class="stroop-screen">
                <h2 style="color: var(--color-error, #E11D48); font-size: 36px; margin-bottom: 10px;">KẾT THÚC</h2>
                <p style="font-size: 18px; margin-bottom: 20px;">Tổng điểm: <strong id="stroop-final-score" style="color: var(--color-success, #F59E0B); font-size: 24px;">0</strong></p>
                <button class="btn-flat" id="stroop-btn-restart">CHƠI LẠI TỪ ĐẦU</button>
            </div>

        </div>
    `;

    // Reset container (Xóa rác từ game cũ nếu có) và Gán HTML mới
    container.innerHTML = layoutHTML;

    // --- 3. LẤY CÁC DOM ELEMENTS ---
    const wrapperEl = document.getElementById('stroop-wrapper');
    const menuScreen = document.getElementById('stroop-menu-screen');
    const gameArea = document.getElementById('stroop-game-area');
    const gameoverScreen = document.getElementById('stroop-gameover-screen');
    
    const wordEl = document.getElementById('stroop-word');
    const btnContainer = document.getElementById('stroop-buttons-container');
    const timerFillEl = document.getElementById('stroop-timer-fill');
    
    const levelEl = document.getElementById('stroop-level');
    const scoreEl = document.getElementById('stroop-score');
    const livesEl = document.getElementById('stroop-lives');
    const finalScoreEl = document.getElementById('stroop-final-score');

    // --- 4. LOGIC TRÒ CHƠI ---

    function startGame() {
        state = { score: 0, level: 1, lives: 3, isPlaying: true, isTransitioning: false };
        updateUI();
        menuScreen.classList.remove('active');
        gameoverScreen.classList.remove('active');
        gameArea.classList.add('active');
        nextRound();
    }

    function nextRound() {
        if (state.lives <= 0) return gameOver();
        
        // Cập nhật UI độ khó
        updateUI();
        
        // Random ra Nội dung chữ (Ý nghĩa) và Màu mực hiển thị (Đánh lừa)
        let wordData = COLORS[Math.floor(Math.random() * COLORS.length)];
        let inkData = COLORS[Math.floor(Math.random() * COLORS.length)];
        
        // 75% cơ hội ra màu lừa đảo (chữ và màu khác nhau)
        if (Math.random() < 0.75) {
            while (inkData.id === wordData.id) {
                inkData = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
        }

        // Áp dụng hiển thị
        wordEl.innerText = wordData.name;
        wordEl.style.color = inkData.hex;
        
        // ĐÁP ÁN ĐÚNG LÀ MÀU MỰC, KHÔNG PHẢI Ý NGHĨA CHỮ
        state.correctColorId = inkData.id; 

        // Sinh ra các nút bấm đảo lộn vị trí
        renderColorButtons();

        // Tính thời gian đếm ngược dựa theo level (Tối đa 5s, tối thiểu 1.5s)
        const maxTime = Math.max(1500, 5000 - (state.level * 200)); 
        startTimer(maxTime);
    }

    function renderColorButtons() {
        btnContainer.innerHTML = '';
        // Xáo trộn mảng màu
        let shuffledColors = [...COLORS].sort(() => Math.random() - 0.5);
        
        shuffledColors.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'btn-flat'; // Sử dụng class chuẩn hệ thống
            btn.innerText = color.name;
            // Ép màu nút theo màu hệ thống, không dùng màu thật để tránh giúp người chơi quá dễ
            // Người chơi bắt buộc phải đọc chữ trên nút
            btn.addEventListener('click', () => handleChoice(color.id));
            btnContainer.appendChild(btn);
        });
    }

    function handleChoice(selectedId) {
        if (!state.isPlaying || state.isTransitioning) return;
        state.isTransitioning = true;
        clearInterval(state.timerInterval);

        const isCorrect = (selectedId === state.correctColorId);
        
        if (isCorrect) {
            state.score += (10 + state.level); // Càng level cao điểm càng nhiều
            state.level++;
            triggerFeedback('success');
        } else {
            state.lives--;
            triggerFeedback('error');
        }

        // Delay 0.3s cho mượt trước khi sang màn mới
        setTimeout(() => {
            state.isTransitioning = false;
            nextRound();
        }, 300);
    }

    function triggerFeedback(type) {
        // Áp dụng biến CSS hệ thống: --color-success hoặc --color-error
        const colorVar = type === 'success' ? 'var(--color-success, #4CAF50)' : 'var(--color-error, #6A1B9A)';
        const originalBg = wrapperEl.style.background;
        
        wrapperEl.style.background = colorVar;
        setTimeout(() => {
            if (state.isPlaying) {
                wrapperEl.style.background = originalBg || 'var(--bg-card, #1E293B)';
            }
        }, 200);
    }

    function startTimer(durationMs) {
        clearInterval(state.timerInterval);
        state.timeLeft = durationMs;
        const tickRate = 20; // Cập nhật mỗi 20ms cho mượt thanh fill

        state.timerInterval = setInterval(() => {
            state.timeLeft -= tickRate;
            let percent = (state.timeLeft / durationMs) * 100;
            timerFillEl.style.width = `${percent}%`;

            if (state.timeLeft <= 0) {
                clearInterval(state.timerInterval);
                timerFillEl.style.width = `0%`;
                // Timeout (Hết giờ coi như mất 1 mạng)
                if (!state.isTransitioning) {
                    state.isTransitioning = true;
                    state.lives--;
                    triggerFeedback('error');
                    setTimeout(() => {
                        state.isTransitioning = false;
                        nextRound();
                    }, 300);
                }
            }
        }, tickRate);
    }

    function updateUI() {
        levelEl.innerText = state.level;
        scoreEl.innerText = state.score;
        livesEl.innerText = '❤️'.repeat(Math.max(0, state.lives));
    }

    function gameOver() {
        state.isPlaying = false;
        clearInterval(state.timerInterval);
        gameArea.classList.remove('active');
        gameoverScreen.classList.add('active');
        finalScoreEl.innerText = state.score;
        wrapperEl.style.background = 'var(--bg-card, #1E293B)'; // Trả lại màu nền
    }

    // --- 5. GẮN SỰ KIỆN NÚT ĐIỀU HƯỚNG ---
    document.getElementById('stroop-btn-start').addEventListener('click', startGame);
    document.getElementById('stroop-btn-restart').addEventListener('click', startGame);

}

// Kích hoạt ngay khi load script (Tùy thuộc vào luồng của bạn, có thể xóa dòng này nếu bạn tự gọi hàm từ file main.js)
// initStroopGame();
