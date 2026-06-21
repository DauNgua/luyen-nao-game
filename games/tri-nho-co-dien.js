// =========================================
// MODULE GAME: TRÍ NHỚ MA TRẬN CỔ ĐIỂN
// Phong cách: Flat Modern Design (Lumosity Style)
// =========================================

window.CurrentGame = (function() {
    
    // --- 1. HỆ THỐNG ÂM THANH (AUDIO SYNTHESIZER) ---
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
        sfxFlash: () => AudioEngine.playTone(600, 'sine', 0.15, 0.08),       
        // Tiếng gõ nhẹ, êm nhưng dứt khoát khi chọn đúng
        sfxCorrect: () => AudioEngine.playTone(500, 'triangle', 0.1, 0.1),   
        // Tiếng trầm, hụt hẫng nhẹ khi chọn sai (Không chói tai)
        sfxWrong: () => AudioEngine.playTone(200, 'sine', 0.2, 0.08),       
        sfxLevelUp: function() {
            setTimeout(() => this.playTone(400, 'sine', 0.1, 0.05), 0);
            setTimeout(() => this.playTone(600, 'sine', 0.1, 0.05), 100);
            setTimeout(() => this.playTone(800, 'triangle', 0.3, 0.1), 200);
        },
        sfxGameOver: () => AudioEngine.playTone(150, 'sine', 0.5, 0.1) 
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

    // Hàm tiện ích: Quản lý Timeout để dọn rác khi thoát
    function setGameTimeout(callback, delay) {
        let id = setTimeout(callback, delay);
        state.gameTimeouts.push(id);
        return id;
    }

    // Nạp Checkpoint lùi 3 màn
    function initCheckpoint() {
        let maxLevel = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
        state.level = Math.max(1, maxLevel - 3);
        state.score = 0;
        state.lives = 3;
        state.consecutiveFails = 0;
    }

    // --- 3. ĐỒNG BỘ TRẠNG THÁI LÊN HEADER HỆ THỐNG ---
    function updateGlobalHeader() {
        // Hỗ trợ chuẩn GameInterface theo yêu cầu
        if (window.GameInterface) {
            if (window.GameInterface.updateScore) window.GameInterface.updateScore(Math.round(state.score));
            if (window.GameInterface.updateLives) window.GameInterface.updateLives(state.lives);
        } else {
            // Fallback an toàn phòng trường hợp index.html dùng ID trực tiếp
            let elScore = document.getElementById('common-score');
            let elLive = document.getElementById('common-lives');
            let elLevel = document.getElementById('common-level');
            if(elScore) elScore.innerText = Math.round(state.score);
            if(elLive) elLive.innerText = state.lives;
            if(elLevel) elLevel.innerText = state.level;
        }
    }

    // --- 4. TẠO GIAO DIỆN PHẲNG (FLAT DESIGN INJECTION) ---
    function renderUI() {
        const canvas = document.getElementById('game-canvas');
        canvas.innerHTML = `
            <style>
                /* Sân khấu trung tâm */
                .game-stage {
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    width: 100%; height: 100%; flex-grow: 1;
                }
                
                /* Text trạng thái (Chỉ báo lượt chơi) */
                .matrix-status {
                    font-size: 16px; font-weight: 800; color: var(--text-dark);
                    margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;
                    transition: color 0.3s; text-align: center;
                }

                /* Lưới Ma trận */
                .matrix-grid { 
                    display: grid; gap: 10px; 
                    width: 100%; max-width: 300px; aspect-ratio: 1/1; 
                }
                
                /* Ô vuông (Tiles) phong cách Flat Bo góc 12px */
                .matrix-tile { 
                    /* Light mode: Màu xám nhạt | Dark mode: Tự ăn theo màu nền tối */
                    background-color: var(--border-line); 
                    border-radius: 12px; cursor: pointer; 
                    transition: transform 0.15s ease, background-color 0.2s ease, box-shadow 0.2s ease; 
                }
                /* Dark Mode Override cho Ô vuông */
                [data-theme="dark"] .matrix-tile { background-color: var(--bg-main); }
                
                /* Hiệu ứng tương tác */
                .matrix-tile:active { transform: scale(0.92); }
                
                /* Màu chớp sáng: Dùng màu thương hiệu nổi bật trên mọi nền */
                .matrix-tile.flash { 
                    background-color: var(--primary-color) !important; 
                    box-shadow: 0 4px 15px rgba(224, 83, 60, 0.4); 
                    transform: scale(1.03);
                }
                /* Bấm Đúng */
                .matrix-tile.correct { 
                    background-color: var(--color-correct, #4CAF50) !important; 
                    cursor: default; transform: none; 
                }
                /* Bấm Sai: Làm chìm, mất màu, viền mỏng */
                .matrix-tile.wrong { 
                    background-color: transparent !important; 
                    border: 2px solid var(--border-line); 
                    transform: scale(0.9); opacity: 0.5; cursor: default;
                }

                /* Hiệu ứng lật mở ô còn thiếu */
                .matrix-tile.reveal-missed { 
                    background-color: var(--color-correct, #4CAF50) !important; 
                    opacity: 0.6;
                    animation: pulse-reveal 1s infinite;
                }
                @keyframes pulse-reveal {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }

                /* Bảng điểm nội bộ (Dùng chung biến màu hệ thống) */
                .matrix-gameover-box {
                    width: 100%; max-width: 320px; background: var(--bg-main);
                    border-radius: 16px; padding: 25px; text-align: center;
                    border: 1px solid var(--border-line); box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                }
                .btn-flat {
                    background-color: var(--primary-color); color: #fff; border: none; border-radius: 8px;
                    padding: 12px 20px; font-weight: 700; font-size: 14px; cursor: pointer;
                    width: 100%; margin-top: 10px; transition: 0.2s;
                }
                .btn-flat:active { transform: scale(0.95); }
                .btn-outline { background: transparent; color: var(--text-dark); border: 2px solid var(--border-line); }
            </style>
            
            <div id="matrix-stage" class="game-stage">
                <div class="matrix-status" id="matrix-status">Đang tải...</div>
                <div class="matrix-grid" id="matrix-grid"></div>
            </div>

            <div id="matrix-gameover" class="game-stage" style="display: none;"></div>
        `;
    }

    function setStatus(text, colorVar = 'var(--text-dark)') {
        let el = document.getElementById('matrix-status');
        if (el) {
            el.innerText = text;
            el.style.color = colorVar;
        }
    }

    // --- 5. LOGIC TRÒ CHƠI ---
    function startLevel() {
        updateGlobalHeader();
        state.isPlayerTurn = false;
        state.sequence = [];
        state.playerClicks = [];
        state.wrongClicksInRound = 0; 

        // Lưu max level check point
        let currentMax = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
        if (state.level > currentMax) {
            localStorage.setItem('mm_matrix_max_level', state.level);
        }

        // Tạo lưới
        state.gridSize = Math.min(3 + Math.floor((state.level - 1) / 3), 6); // Cổ điển max 6x6 cho gọn gàng
        state.targetCount = 2 + state.level; 

        const grid = document.getElementById('matrix-grid');
        grid.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
        grid.innerHTML = '';

        for (let i = 0; i < state.gridSize * state.gridSize; i++) {
            let tile = document.createElement('div');
            tile.className = 'matrix-tile';
            tile.dataset.id = i;
            tile.onclick = () => onTileClick(tile, i);
            grid.appendChild(tile);
        }

        setStatus("GHI NHỚ VỊ TRÍ", "var(--text-dark)");

        // Random mục tiêu
        let allIndices = Array.from(Array(state.gridSize * state.gridSize).keys());
        for (let i = 0; i < state.targetCount; i++) {
            let randomIdx = Math.floor(Math.random() * allIndices.length);
            state.sequence.push(allIndices[randomIdx]);
            allIndices.splice(randomIdx, 1);
        }

        // Chớp sáng
        setGameTimeout(() => {
            const tiles = document.querySelectorAll('.matrix-tile');
            AudioEngine.sfxFlash();
            state.sequence.forEach(id => tiles[id].classList.add('flash'));
            
            let viewTime = Math.max(1000, state.targetCount * 250);

            setGameTimeout(() => {
                state.sequence.forEach(id => tiles[id].classList.remove('flash'));
                setStatus("BẠN HÃY CHỌN LẠI", "var(--primary-color)");
                state.isPlayerTurn = true; 
            }, viewTime);

        }, 600);
    }

    function revealMissedTiles(callback) {
        const tiles = document.querySelectorAll('.matrix-tile');
        let missedCount = 0;

        state.sequence.forEach(id => {
            if (!state.playerClicks.includes(id)) {
                tiles[id].classList.add('reveal-missed');
                missedCount++;
            }
        });

        if (missedCount > 0) {
            AudioEngine.playTone(700, 'sine', 0.15, 0.05); 
            setStatus("CÁC Ô CÒN THIẾU", "var(--text-dark)");
            setGameTimeout(callback, 2000); 
        } else {
            callback(); 
        }
    }

    // --- 6. XỬ LÝ TƯƠNG TÁC (TÍNH ĐIỂM + RANKING) ---
    function onTileClick(tileEl, id) {
        if (!state.isPlayerTurn || tileEl.classList.contains('correct') || tileEl.classList.contains('wrong')) return;

        if (state.sequence.includes(id)) {
            tileEl.classList.add('correct');
            AudioEngine.sfxCorrect();
            state.playerClicks.push(id);
            
            if (state.playerClicks.length === state.sequence.length) {
                state.isPlayerTurn = false;
                AudioEngine.sfxLevelUp();
                setStatus("CHÍNH XÁC!", "var(--color-success, #4CAF50)");
                
                // THUẬT TOÁN ĐIỂM SỐ MỚI
                let baseScore = state.targetCount * 10;
                let finalScoreAdd = baseScore;

                if (state.wrongClicksInRound === 1) finalScoreAdd = baseScore * 0.9;
                else if (state.wrongClicksInRound >= 2) finalScoreAdd = baseScore * 0.8;

                state.score += finalScoreAdd;
                updateGlobalHeader();

                state.level++;
                state.consecutiveFails = 0; 
                setGameTimeout(startLevel, 1200);
            }
        } 
        else {
            tileEl.classList.add('wrong');
            AudioEngine.sfxWrong();
            state.wrongClicksInRound++;

            if (state.wrongClicksInRound < 3) {
                setStatus(`CẢNH BÁO LỖI (${state.wrongClicksInRound}/3)`, "var(--color-error, #e53e3e)");
            } 
            else {
                state.isPlayerTurn = false;
                state.lives--;
                state.consecutiveFails++; 
                updateGlobalHeader();

                if (state.lives <= 0) {
                    revealMissedTiles(() => processGameOver());
                    return;
                }

                if (state.consecutiveFails === 1) {
                    revealMissedTiles(() => {
                        setStatus("LÀM LẠI MÀN NÀY", "var(--text-dark)");
                        setGameTimeout(startLevel, 1200);
                    });
                } 
                else if (state.consecutiveFails >= 2) {
                    revealMissedTiles(() => {
                        setStatus("ĐÃ GIẢM 1 CẤP ĐỘ", "var(--color-error, #e53e3e)");
                        state.level = Math.max(1, state.level - 1); 
                        state.consecutiveFails = 0; 
                        setGameTimeout(startLevel, 1500);
                    });
                }
            }
        }
    }

    // --- 7. MÀN HÌNH GAME OVER NỘI BỘ (14 DAYS LEADERBOARD) ---
    function processGameOver() {
        AudioEngine.sfxGameOver();
        
        // Cập nhật BXH 14 ngày
        let scores = JSON.parse(localStorage.getItem('mm_matrix_records')) || [];
        let now = Date.now();
        let twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
        
        let roundedScore = Math.round(state.score);
        if(roundedScore > 0) {
            scores.push({ score: roundedScore, date: now, level: state.level });
        }

        scores = scores.filter(item => item.date >= twoWeeksAgo)
                       .sort((a, b) => b.score - a.score).slice(0, 5);
        localStorage.setItem('mm_matrix_records', JSON.stringify(scores));

        // Vẽ màn hình
        document.getElementById('matrix-stage').style.display = 'none';
        
        let htmlList = scores.map((item, index) => {
            let dateStr = new Date(item.date).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
            return `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border-line); font-size:14px; font-weight:700; color:var(--text-dark);">
                        <span>#${index+1} <span style="opacity:0.5; font-size:11px;">(Lvl ${item.level})</span></span>
                        <span><span style="opacity:0.5; font-size:11px; margin-right:10px;">${dateStr}</span> <span style="color:var(--primary-color);">${item.score}</span></span>
                    </div>`;
        }).join('');

        let goBox = document.getElementById('matrix-gameover');
        goBox.innerHTML = `
            <div class="matrix-gameover-box">
                <h3 style="font-size:24px; font-weight:900; color:var(--text-dark); margin-bottom:5px;">HẾT LƯỢT</h3>
                <div style="font-size:42px; font-weight:900; color:var(--primary-color); margin-bottom:15px;">${roundedScore}</div>
                <p style="font-size:12px; color:var(--text-muted); margin-bottom:20px;">
                    Lần sau sẽ bắt đầu từ Màn ${Math.max(1, state.level - 3)}
                </p>
                
                <div style="text-align:left; margin-bottom:20px;">
                    <div style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">Thành Tích Cá Nhân (14 Ngày)</div>
                    ${htmlList || '<div style="text-align:center; color:var(--text-muted); font-size:13px;">Chưa có dữ liệu</div>'}
                </div>

                <button class="btn-flat" onclick="window.CurrentGame.init()">Thử Lại Ngay</button>
                <button class="btn-flat btn-outline" onclick="if(window.AppManager) window.AppManager.quitGame()">Trở Về Menu</button>
            </div>
        `;
        goBox.style.display = 'flex';
    }

    // --- XUẤT MODULE BẮT BUỘC ---
    return {
        init: function() {
            // Sửa lỗi policy autoplay
            if (AudioEngine.ctx.state === 'suspended') {
                document.addEventListener('click', () => AudioEngine.ctx.resume(), {once: true});
            }
            
            initCheckpoint();
            renderUI();
            startLevel();
        },
        cleanup: function() {
            // OS gọi hàm này khi ấn nút Thoát / Tạm dừng
            state.gameTimeouts.forEach(id => clearTimeout(id));
            state.gameTimeouts = [];
        }
    };

})();
