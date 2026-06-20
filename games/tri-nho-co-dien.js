// =========================================
// MODULE: TRÍ NHỚ MA TRẬN CỔ ĐIỂN
// Tính năng: Checkpoint, Bảng điểm, Điểm theo Ô, Lật đáp án khi thua
// =========================================

(function() {
    
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

        sfxFlash: () => AudioEngine.playTone(600, 'sine', 0.2, 0.1),       
        
        // NÂNG CẤP: Âm thanh Correct êm ái, giống tiếng gõ "Tốc" của gỗ/phím cơ
        sfxCorrect: () => AudioEngine.playTone(500, 'triangle', 0.1, 0.15),   
        
        sfxWrong: () => AudioEngine.playTone(250, 'sine', 0.2, 0.1),       
        sfxLevelUp: function() {
            setTimeout(() => this.playTone(400, 'sine', 0.1, 0.1), 0);
            setTimeout(() => this.playTone(600, 'sine', 0.1, 0.1), 100);
            setTimeout(() => this.playTone(800, 'sine', 0.3, 0.15), 200);
        },
        sfxGameOver: () => AudioEngine.playTone(150, 'triangle', 0.5, 0.2) 
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

    const canvas = document.getElementById('game-canvas');

    function setGameTimeout(callback, delay) {
        let id = setTimeout(callback, delay);
        state.gameTimeouts.push(id);
        return id;
    }

    function initCheckpoint() {
        let maxLevel = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
        state.level = Math.max(1, maxLevel - 3);
        state.score = 0;
        state.lives = 3;
        state.consecutiveFails = 0;
    }

    // --- 3. XÂY DỰNG GIAO DIỆN (UI) TRONG GAME ---
    function renderUI() {
        canvas.innerHTML = `
            <style>
                .memory-header { display: flex; justify-content: space-between; padding: 10px 0px; color: #a4a5aa; font-weight: 700; width: 100%; max-width: 320px; margin: 0 auto;}
                .memory-status { text-align: center; font-size: 14px; font-weight: 800; min-height: 25px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;}
                
                .memory-grid-wrapper { flex-grow: 1; display: flex; justify-content: center; align-items: center; padding-bottom: 10px; width: 100%;}
                .memory-grid { display: grid; gap: 6px; width: 100%; max-width: 320px; aspect-ratio: 1/1; }
                
                .mem-tile { background-color: #2b2c31; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; border: 2px solid #3e3835; }
                .mem-tile:active { transform: scale(0.95); }
                
                .mem-tile.flash { background-color: #fdfdfd; border-color: #fff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.3); }
                .mem-tile.correct { background-color: #ffd700; border-color: #ffd700; box-shadow: 0 0 10px rgba(255, 215, 0, 0.2); cursor: default;}
                .mem-tile.wrong { background-color: #1a1c1e; border-color: #1a1c1e; transform: scale(0.92); opacity: 0.7; cursor: default; }

                /* CSS cho tính năng Gợi ý Lời Giải (Lật ô còn thiếu) */
                .mem-tile.reveal-missed { 
                    background-color: #48bb78; border-color: #48bb78; 
                    box-shadow: 0 0 15px rgba(72, 187, 120, 0.5); 
                    animation: pulse-reveal 1s infinite;
                }
                @keyframes pulse-reveal {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }

                .scoreboard-box { width: 100%; max-width: 320px; margin: 0 auto; background: #23272a; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #3e3835; }
                .sc-title { font-size: 16px; color: #a4a5aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
                .sc-score { font-size: 36px; font-weight: 900; color: #ffd700; margin-bottom: 15px; text-shadow: 0 4px 10px rgba(255,215,0,0.2);}
                .sc-list { list-style: none; padding: 0; margin-bottom: 20px; text-align: left;}
                .sc-list li { display: flex; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid #3e3835; font-size: 14px; font-weight: 600;}
                .sc-list li:last-child { border-bottom: none; }
                .sc-date { color: #a4a5aa; font-size: 12px;}
                .sc-btn-group { display: flex; gap: 10px; }
                .btn-mem-action { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: bold; font-family: inherit; cursor: pointer; transition: 0.15s;}
                .btn-mem-action:active { transform: scale(0.95); }
                .btn-restart { background: #f05e4b; color: #fff; }
                .btn-home { background: #3e3835; color: #f5f5f5; }
            </style>
            
            <div id="game-playing-ui" style="width: 100%; display: flex; flex-direction: column; flex-grow: 1;">
                <div class="memory-header">
                    <div>Lvl <span id="mem-lvl" style="color: #fdfdfd;">${state.level}</span></div>
                    <div>⭐ <span id="mem-score" style="color: #ffd700;">${state.score}</span></div>
                    <div>❤ <span id="mem-live" style="color: #f05e4b;">${state.lives}</span></div>
                </div>
                <div class="memory-status" id="mem-status">Đang nạp dữ liệu...</div>
                <div class="memory-grid-wrapper">
                    <div class="memory-grid" id="mem-grid"></div>
                </div>
            </div>

            <div id="game-over-ui" class="scoreboard-box" style="display: none;"></div>
        `;
    }

    function updateHUD() {
        document.getElementById('mem-lvl').innerText = state.level;
        document.getElementById('mem-score').innerText = Math.round(state.score); // Làm tròn điểm để tránh số lẻ
        document.getElementById('mem-live').innerText = state.lives;
    }

    function setStatus(text, color = '#f05e4b') {
        let el = document.getElementById('mem-status');
        el.innerText = text;
        el.style.color = color;
    }

    // --- 4. LOGIC TRÒ CHƠI CHÍNH ---
    function startLevel() {
        updateHUD();
        state.isPlayerTurn = false;
        state.sequence = [];
        state.playerClicks = [];
        state.wrongClicksInRound = 0; 

        let currentMax = parseInt(localStorage.getItem('mm_matrix_max_level')) || 1;
        if (state.level > currentMax) {
            localStorage.setItem('mm_matrix_max_level', state.level);
        }

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

        setStatus("GHI NHỚ VỊ TRÍ", "#fdfdfd");

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
                setStatus("CHẠM ĐỂ CHỌN MỤC TIÊU", "#a4a5aa");
                state.isPlayerTurn = true; 
            }, viewTime);

        }, 500);
    }

    // --- XỬ LÝ LỘ LỜI GIẢI (HÀM MỚI) ---
    function revealMissedTiles(callback) {
        const tiles = document.querySelectorAll('.mem-tile');
        let missedCount = 0;

        // Quét mảng máy cho (sequence) xem có id nào chưa nằm trong playerClicks không
        state.sequence.forEach(id => {
            if (!state.playerClicks.includes(id)) {
                tiles[id].classList.add('reveal-missed');
                missedCount++;
            }
        });

        // Nếu có ô bị thiếu, báo âm thanh, đợi 1.5s rồi mới chạy tiếp (callback)
        if (missedCount > 0) {
            AudioEngine.playTone(800, 'sine', 0.1, 0.05); // Ting báo hiệu lời giải
            setStatus("NHỮNG Ô CÒN THIẾU", "#48bb78");
            setGameTimeout(callback, 2000); 
        } else {
            callback(); // Chạy luôn nếu ko lọt trường hợp này
        }
    }

    // --- 5. TƯƠNG TÁC LỖI & TỤT HẠNG & CỘNG ĐIỂM ---
    function onTileClick(tileEl, id) {
        if (!state.isPlayerTurn || tileEl.classList.contains('correct') || tileEl.classList.contains('wrong')) return;

        // KỊCH BẢN A: BẤM ĐÚNG
        if (state.sequence.includes(id)) {
            tileEl.classList.add('correct');
            AudioEngine.sfxCorrect();
            
            state.playerClicks.push(id);
            
            // Nếu tìm đủ ô
            if (state.playerClicks.length === state.sequence.length) {
                state.isPlayerTurn = false;
                AudioEngine.sfxLevelUp();
                setStatus("TUYỆT VỜI!", "#ffd700");
                
                // NÂNG CẤP: TÍNH ĐIỂM THEO Ô
                let baseScore = state.targetCount * 10;
                let finalScoreAdd = baseScore;

                if (state.wrongClicksInRound === 1) {
                    finalScoreAdd = baseScore * 0.9;
                } else if (state.wrongClicksInRound >= 2) {
                    finalScoreAdd = baseScore * 0.8;
                }

                state.score += finalScoreAdd;
                updateHUD();

                state.level++;
                state.consecutiveFails = 0; 
                setGameTimeout(startLevel, 1200);
            }
        } 
        // KỊCH BẢN B: BẤM SAI
        else {
            tileEl.classList.add('wrong');
            AudioEngine.sfxWrong();
            state.wrongClicksInRound++;

            if (state.wrongClicksInRound < 3) {
                setStatus(`CẢNH BÁO! NHẦM Ô (${state.wrongClicksInRound}/3)`, "#f05e4b");
            } 
            else {
                state.isPlayerTurn = false;
                state.lives--;
                state.consecutiveFails++; 
                updateHUD();

                if (state.lives <= 0) {
                    // Hiện kết quả ô còn thiếu trước khi chết hẳn
                    revealMissedTiles(() => {
                        processGameOver();
                    });
                    return;
                }

                if (state.consecutiveFails === 1) {
                    revealMissedTiles(() => {
                        setStatus("MẤT MẠNG! CHƠI LẠI MÀN NÀY", "#ffd700");
                        setGameTimeout(startLevel, 1500);
                    });
                } 
                else if (state.consecutiveFails >= 2) {
                    revealMissedTiles(() => {
                        setStatus("THẤT BẠI NHIỀU! TỤT 1 CẤP ĐỘ", "#f05e4b");
                        state.level = Math.max(1, state.level - 1); 
                        state.consecutiveFails = 0; 
                        setGameTimeout(startLevel, 1500);
                    });
                }
            }
        }
    }

    // --- 6. HỆ THỐNG ĐIỂM SỐ 14 NGÀY VÀ GAME OVER ---
    function processGameOver() {
        AudioEngine.sfxGameOver();
        setStatus("GAME OVER", "#f05e4b");
        
        let scores = JSON.parse(localStorage.getItem('mm_matrix_records')) || [];
        let now = Date.now();
        let twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
        
        let roundedScore = Math.round(state.score);
        if(roundedScore > 0) {
            scores.push({ score: roundedScore, date: now, level: state.level });
        }

        scores = scores
            .filter(item => item.date >= twoWeeksAgo)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        localStorage.setItem('mm_matrix_records', JSON.stringify(scores));

        setGameTimeout(() => {
            document.getElementById('game-playing-ui').style.display = 'none';
            
            let htmlList = scores.map((item, index) => {
                let dateStr = new Date(item.date).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
                return `<li>
                            <span style="color:#fdfdfd;">#${index+1} - Màn ${item.level}</span>
                            <span><span class="sc-date">${dateStr}</span> &nbsp;<span style="color:#ffd700;">${item.score}đ</span></span>
                        </li>`;
            }).join('');

            if(scores.length === 0) htmlList = `<li style="justify-content:center; color:#a4a5aa;">Chưa có dữ liệu</li>`;

            let goBox = document.getElementById('game-over-ui');
            goBox.innerHTML = `
                <div class="sc-title">TỔNG KẾT TẬP HUẤN</div>
                <div class="sc-score">${roundedScore}</div>
                <div style="font-size: 13px; color: #a4a5aa; margin-bottom: 20px; font-weight:bold;">
                    (Đã lưu Checkpoint: Sẽ bắt đầu lại từ màn ${Math.max(1, state.level - 3)})
                </div>
                
                <div class="sc-title" style="text-align:left; font-size:14px; border-bottom: 1px solid #3e3835; padding-bottom:5px;">TOP 5 CÁ NHÂN (14 NGÀY)</div>
                <ul class="sc-list">
                    ${htmlList}
                </ul>

                <div class="sc-btn-group">
                    <button class="btn-mem-action btn-restart" onclick="window.CurrentGame.init()">Chơi Lại</button>
                    <button class="btn-mem-action btn-home" onclick="window.AppManager.quitGame()">Về Menu</button>
                </div>
            `;
            goBox.style.display = 'block';

        }, 1200);
    }

    // --- BƠM API RA NGOÀI ĐỂ APP MANAGER GỌI ---
    window.CurrentGame = {
        init: function() {
            if(state.gameTimeouts.length > 0) this.cleanup();

            if (AudioEngine.ctx.state === 'suspended') {
                document.addEventListener('click', () => AudioEngine.ctx.resume(), {once: true});
            }
            
            initCheckpoint();
            renderUI();
            startLevel();
        },
        cleanup: function() {
            state.gameTimeouts.forEach(id => clearTimeout(id));
            state.gameTimeouts = [];
        }
    };

})();
