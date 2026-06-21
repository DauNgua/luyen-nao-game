// =========================================
// MODULE GAME: TRÍ NHỚ MA TRẬN (CỔ ĐIỂN)
// Tích hợp: GameInterface, Flat Design, Động cơ Âm thanh
// =========================================

window.CurrentGame = (function() {
    
    // --- 1. MÁY PHÁT ÂM THANH (AUDIO ENGINE) ---
    const AudioEngine = {
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
        
        playTone: function(freq, type, duration, vol) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },

        sfxFlash: () => AudioEngine.playTone(600, 'sine', 0.15, 0.05),       
        // Tiếng Click đúng: Nốt hơi cao, dạng triangle tạo cảm giác gõ "tốc" nhẹ nhàng
        sfxCorrect: () => AudioEngine.playTone(550, 'triangle', 0.1, 0.1),   
        // Tiếng Click sai: Nốt trầm, êm, dạng sine không gây chói tai
        sfxWrong: () => AudioEngine.playTone(200, 'sine', 0.2, 0.08),       
        sfxLevelUp: function() {
            setTimeout(() => this.playTone(400, 'sine', 0.1, 0.05), 0);
            setTimeout(() => this.playTone(600, 'sine', 0.1, 0.05), 100);
            setTimeout(() => this.playTone(800, 'sine', 0.2, 0.1), 200);
        },
        sfxGameOver: () => AudioEngine.playTone(150, 'triangle', 0.4, 0.1) 
    };

    // --- 2. QUẢN LÝ TRẠNG THÁI (STATE) ---
    let state = {
        level: 1,
        lives: 3,
        score: 0,
        gridSize: 3,
        targetCount: 3,
        sequence: [],
        playerClicks: [],
        isPlayerTurn: false,
        wrongClicksInRound: 0,
        consecutiveFails: 0,
        gameTimeouts: [] 
    };

    // Hàm tiện ích: Bọc setTimeout để dọn dẹp khi thoát game
    function setGameTimeout(callback, delay) {
        let id = setTimeout(callback, delay);
        state.gameTimeouts.push(id);
        return id;
    }

    // --- 3. ĐỒNG BỘ GIAO DIỆN (UI INJECTION) ---
    function renderUI() {
        const canvas = document.getElementById('game-canvas');
        canvas.innerHTML = `
            <style>
                .matrix-container {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    width: 100%; height: 100%;
                }
                .matrix-status {
                    font-family: 'Nunito', sans-serif;
                    font-size: 16px; font-weight: 800; text-transform: uppercase;
                    letter-spacing: 1px; margin-bottom: 20px; text-align: center;
                    color: var(--text-dark); transition: color 0.3s;
                }
                .matrix-grid { 
                    display: grid; gap: 8px; width: 100%; max-width: 320px; aspect-ratio: 1/1; 
                }
                /* THIẾT KẾ FLAT DESIGN TỐI GIẢN */
                .mem-tile { 
                    background-color: var(--border-line); /* Tự thích ứng sáng/tối */
                    border-radius: 12px; /* Bo góc chuẩn Lumosity */
                    cursor: pointer; transition: all 0.15s ease; 
                }
                .mem-tile:active { transform: scale(0.95); }
                
                /* Tương phản mạnh: Màu chớp sáng dùng Primary Color để chống chói ở Light Mode */
                .mem-tile.flash { background-color: var(--primary-color); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .mem-tile.correct { background-color: var(--color-success); cursor: default; }
                .mem-tile.wrong { background-color: var(--color-error); transform: scale(0.92); opacity: 0.7; cursor: default; }

                /* Lật ô còn thiếu khi người chơi thua */
                .mem-tile.reveal-missed { 
                    background-color: var(--text-muted); 
                    animation: pulse-reveal 1s infinite; cursor: default;
                }
                @keyframes pulse-reveal {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(0.9); opacity: 0.6; }
                    100% { transform: scale(1); opacity: 1; }
                }

                /* Bảng điểm nội bộ (Cuối ván) */
                .matrix-scoreboard {
                    width: 100%; max-width: 320px; background-color: var(--bg-main);
                    border-radius: 12px; padding: 20px; text-align: center; border: 1px solid var(--border-line);
                }
                .sc-title { font-size: 14px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 10px; }
                .sc-list { list-style: none; padding: 0; margin-bottom: 20px; text-align: left; }
                .sc-list li { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-line); font-size: 14px; font-weight: 700; color: var(--text-dark);}
                .btn-mem-action { width: 100%; background-color: var(--primary-color); color: #fff; padding: 12px; border: none; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.2s;}
                .btn-mem-action:active { transform: scale(0.97); opacity: 0.9; }
            </style>
            
            <div id="matrix-play-area" class="matrix-container">
                <div id="mem-status" class="matrix-status">Đang nạp dữ liệu...</div>
                <div id="mem-grid" class="matrix-grid"></div>
            </div>

            <div id="matrix-end-area" class="matrix-container" style="display: none;"></div>
        `;
    }

    function setStatus(text, type = 'normal') {
        let el = document.getElementById('mem-status');
        el.innerText = text;
        if (type === 'highlight') el.style.color = 'var(--primary-color)';
        else if (type === 'success') el.style.color = 'var(--color-success)';
        else el.style.color = 'var(--text-dark)';
    }

    // --- GIAO TIẾP VỚI HỆ THỐNG MẸ (MAIN.JS) ---
    function syncToSystem() {
        if (window.GameInterface) {
            if (window.GameInterface.updateScore) window.GameInterface.updateScore(Math.round(state.score));
            if (window.GameInterface.updateLives) window.GameInterface.updateLives(state.lives);
            // Gửi cả level lên thanh trạng thái chung (Nếu hệ thống có hỗ trợ hiển thị Màn)
            if (window.GameInterface.updateLevel) window.GameInterface.updateLevel(state.level);
        }
    }

    // --- 4. LOGIC TRÒ CHƠI CHÍNH ---
    function startLevel() {
        syncToSystem();
        state.isPlayerTurn = false;
        state.sequence = [];
        state.playerClicks = [];
        state.wrongClicksInRound = 0; 

        // Checkpoint lưu cấp độ cao nhất
        let currentMax = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
        if (state.level > currentMax) localStorage.setItem('mm_matrix_max_level', state.level);

        state.gridSize = Math.min(3 + Math.floor((state.level - 1) / 3), 8);
        state.targetCount = 2 + state.level; 

        const grid = document.getElementById('mem-grid');
        grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
        grid.innerHTML = '';

        for (let i = 0; i < state.gridSize * state.gridSize; i++) {
            let tile = document.createElement('div');
            tile.className = 'mem-tile';
            tile.dataset.id = i;
            tile.onclick = () => onTileClick(tile, i);
            grid.appendChild(tile);
        }

        setStatus("GHI NHỚ VỊ TRÍ", "highlight");

        let allIndices = Array.from(Array(state.gridSize * state.gridSize).keys());
        for (let i = 0; i < state.targetCount; i++) {
            let randomIdx = Math.floor(Math.random() * allIndices.length);
            state.sequence.push(allIndices[randomIdx]);
            allIndices.splice(randomIdx, 1);
        }

        setGameTimeout(() => {
            const tiles = document.querySelectorAll('.mem-tile');
            AudioEngine.sfxFlash();
            state.sequence.forEach(id => tiles[id].classList.add('flash'));
            
            let viewTime = Math.max(1000, state.targetCount * 250);

            setGameTimeout(() => {
                state.sequence.forEach(id => tiles[id].classList.remove('flash'));
                setStatus("CHẠM ĐỂ CHỌN", "normal");
                state.isPlayerTurn = true; 
            }, viewTime);

        }, 500);
    }

    // Lật ô còn thiếu khi thua
    function revealMissedTiles(callback) {
        const tiles = document.querySelectorAll('.mem-tile');
        let missedCount = 0;

        state.sequence.forEach(id => {
            if (!state.playerClicks.includes(id)) {
                tiles[id].classList.add('reveal-missed');
                missedCount++;
            }
        });

        if (missedCount > 0) {
            AudioEngine.playTone(800, 'sine', 0.1, 0.03); 
            setStatus("NHỮNG Ô BẠN BỎ LỠ", "normal");
            setGameTimeout(callback, 2000); 
        } else {
            callback();
        }
    }

    // --- 5. TƯƠNG TÁC LỖI & TỤT HẠNG & CỘNG ĐIỂM ---
    function onTileClick(tileEl, id) {
        if (!state.isPlayerTurn || tileEl.classList.contains('correct') || tileEl.classList.contains('wrong')) return;

        // BẤM ĐÚNG
        if (state.sequence.includes(id)) {
            tileEl.classList.add('correct');
            AudioEngine.sfxCorrect();
            state.playerClicks.push(id);
            
            // Xong màn
            if (state.playerClicks.length === state.sequence.length) {
                state.isPlayerTurn = false;
                AudioEngine.sfxLevelUp();
                setStatus("TUYỆT VỜI!", "success");
                
                // TÍNH ĐIỂM DỰA TRÊN SỐ Ô (Mới)
                let baseScore = state.targetCount * 10;
                let finalScoreAdd = baseScore;

                if (state.wrongClicksInRound === 1) finalScoreAdd = baseScore * 0.9;
                else if (state.wrongClicksInRound >= 2) finalScoreAdd = baseScore * 0.8;

                state.score += finalScoreAdd;
                state.level++;
                state.consecutiveFails = 0; 
                
                syncToSystem();
                setGameTimeout(startLevel, 1200);
            }
        } 
        // BẤM SAI
        else {
            tileEl.classList.add('wrong');
            AudioEngine.sfxWrong();
            state.wrongClicksInRound++;

            if (state.wrongClicksInRound < 3) {
                setStatus(`CẢNH BÁO! NHẦM Ô (${state.wrongClicksInRound}/3)`, "highlight");
            } 
            else {
                state.isPlayerTurn = false;
                state.lives--;
                state.consecutiveFails++; 
                syncToSystem();

                if (state.lives <= 0) {
                    revealMissedTiles(() => { processGameOver(); });
                    return;
                }

                // CƠ CHẾ RỚT HẠNG
                if (state.consecutiveFails === 1) {
                    revealMissedTiles(() => {
                        setStatus("MẤT MẠNG! CHƠI LẠI MÀN NÀY", "highlight");
                        setGameTimeout(startLevel, 1500);
                    });
                } 
                else if (state.consecutiveFails >= 2) {
                    revealMissedTiles(() => {
                        setStatus("TỤT 1 CẤP ĐỘ", "highlight");
                        state.level = Math.max(1, state.level - 1); 
                        state.consecutiveFails = 0; 
                        setGameTimeout(startLevel, 1500);
                    });
                }
            }
        }
    }

    // --- 6. KẾT THÚC GAME & BẢNG ĐIỂM NỘI BỘ 14 NGÀY ---
    function processGameOver() {
        AudioEngine.sfxGameOver();
        
        let scores = JSON.parse(localStorage.getItem('mm_matrix_records')) || [];
        let now = Date.now();
        let twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
        
        let roundedScore = Math.round(state.score);
        if(roundedScore > 0) scores.push({ score: roundedScore, date: now, level: state.level });

        // Lọc 14 ngày & Top 5
        scores = scores.filter(item => item.date >= twoWeeksAgo)
                       .sort((a, b) => b.score - a.score)
                       .slice(0, 5);
        localStorage.setItem('mm_matrix_records', JSON.stringify(scores));

        setGameTimeout(() => {
            document.getElementById('matrix-play-area').style.display = 'none';
            let endArea = document.getElementById('matrix-end-area');
            
            let htmlList = scores.map((item, index) => {
                let dateStr = new Date(item.date).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
                return `<li>
                            <span>#${index+1} - Màn ${item.level}</span>
                            <span style="color: var(--text-muted); font-size:12px;">${dateStr} <b style="color: var(--color-success); font-size:14px; margin-left:8px;">${item.score}</b></span>
                        </li>`;
            }).join('');
            if(scores.length === 0) htmlList = `<li style="justify-content:center; color:var(--text-muted);">Chưa có dữ liệu</li>`;

            endArea.innerHTML = `
                <div class="matrix-scoreboard">
                    <div class="sc-title">KẾT QUẢ HUẤN LUYỆN</div>
                    <div style="font-size: 40px; font-weight: 900; color: var(--color-success); margin-bottom: 5px;">${roundedScore}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
                        Đã lưu mốc: Bắt đầu lại từ màn ${Math.max(1, state.level - 3)}
                    </div>
                    
                    <div class="sc-title" style="text-align:left; border-bottom: 1px solid var(--border-line); padding-bottom:5px;">TOP CÁ NHÂN (14 NGÀY)</div>
                    <ul class="sc-list">${htmlList}</ul>

                    <button class="btn-mem-action" onclick="window.CurrentGame.init()">CHƠI LẠI NGAY</button>
                </div>
            `;
            endArea.style.display = 'flex';

            // Bắn tín hiệu kết thúc tổng cho Hệ thống nếu cần
            if(window.GameInterface && window.GameInterface.onGameOver) {
                window.GameInterface.onGameOver(roundedScore);
            }

        }, 1200);
    }

    // --- XUẤT MODULE QUY CHUẨN ---
    return {
        init: function() {
            // Mở khóa Audio trên Browser
            if (AudioEngine.ctx.state === 'suspended') {
                document.addEventListener('click', () => AudioEngine.ctx.resume(), {once: true});
            }
            
            // Xử lý nạp mốc Checkpoint
            let maxLevel = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
            state.level = Math.max(1, maxLevel - 3);
            state.score = 0; state.lives = 3; state.consecutiveFails = 0;

            renderUI();
            startLevel();
        },
        cleanup: function() {
            // Dập tắt mọi vòng lặp khi user nhấn nút Tạm dừng -> Thoát ở Main UI
            state.gameTimeouts.forEach(id => clearTimeout(id));
            state.gameTimeouts = [];
        }
    };

})();
