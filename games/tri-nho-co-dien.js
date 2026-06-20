// ========================================================
// MODULE BĂNG GAME: TRÍ NHỚ MA TRẬN CỔ ĐIỂN (FLAT DESIGN)
// Kế thừa 100% Biến hệ thống từ style.css của Lộc
// ========================================================

(function() {

    // --- 1. MÁY TỔNG HỢP ÂM THANH THUẦN CODE (Web Audio API) ---
    const SfxEngine = {
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
        
        playTone: function(freq, type, duration, vol) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },

        // Tiếng chớp sáng đề bài
        flash: () => SfxEngine.playTone(580, 'sine', 0.18, 0.08),
        
        // YÊU CẦU 1: Tiếng ấn đúng êm ái, giống nhịp gõ phím cơ/click gỗ (Triangle wave)
        correct: () => SfxEngine.playTone(480, 'triangle', 0.09, 0.12),
        
        // YÊU CẦU 1: Tiếng ấn sai siêu nhẹ, trầm mờ giống tiếng "trượt tay"
        wrong: () => SfxEngine.playTone(160, 'sine', 0.15, 0.04),
        
        reveal: () => SfxEngine.playTone(420, 'sine', 0.3, 0.06),
        winTone: () => {
            setTimeout(() => SfxEngine.playTone(523, 'triangle', 0.12, 0.1), 0);
            setTimeout(() => SfxEngine.playTone(659, 'triangle', 0.12, 0.1), 100);
            setTimeout(() => SfxEngine.playTone(783, 'triangle', 0.25, 0.12), 200);
        }
    };

    // --- 2. QUẢN LÝ TRẠNG THÁI NỘI BỘ ---
    let state = {
        level: 1,
        lives: 3,
        score: 0,
        gridSize: 3,
        targetCount: 3,
        sequence: [],
        playerClicks: [],
        isInputAllowed: false,
        wrongClicks: 0,
        consecutiveFails: 0,
        timers: []
    };

    const stage = document.getElementById('game-canvas');

    function setSafeTimeout(cb, delay) {
        let id = setTimeout(cb, delay);
        state.timers.push(id);
        return id;
    }

    // YÊU CẦU 2: Thuật toán Checkpoint lùi 3 màn
    function loadCheckpoint() {
        let highestReached = parseInt(localStorage.getItem('mm_matrix_peak_lvl')) || 1;
        state.level = Math.max(1, highestReached - 3);
        state.score = 0;
        state.lives = 3;
        state.consecutiveFails = 0;
    }

    // --- 3. BƠM GIAO DIỆN CHUẨN FLAT HIỆN ĐẠI ---
    function injectGameDOM() {
        stage.innerHTML = `
            <style>
                .mem-hud {
                    width: 100%; max-width: 380px; display: flex; justify-content: space-between;
                    margin-bottom: 12px; font-weight: 800; font-size: 15px; color: var(--text-muted);
                }
                .mem-hud span { color: var(--text-dark); font-weight: 900; }
                .mem-hud .accent { color: var(--primary-color); }

                .mem-status {
                    font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;
                    color: var(--primary-color); margin-bottom: 18px; min-height: 20px; text-align: center;
                }

                .mem-grid-container {
                    width: 100%; max-width: 340px; aspect-ratio: 1/1;
                    display: grid; gap: 12px; margin: 0 auto;
                }

                /* THIẾT KẾ TILE FLAT chuẩn bo góc 12px của Lộc */
                .mem-tile {
                    background-color: var(--img-placeholder);
                    border: 2px solid var(--border-line);
                    border-radius: 12px; cursor: pointer;
                    transition: transform 0.1s ease, background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
                }
                .mem-tile:hover { border-color: var(--text-muted); }
                .mem-tile:active { transform: scale(0.96); }

                /* Trạng thái chớp đề bài (Màu vàng kim ấm) */
                .mem-tile.state-flash {
                    background-color: #ecc94b !important; border-color: #ecc94b !important;
                    box-shadow: 0 4px 15px rgba(236, 201, 75, 0.4);
                }

                .mem-tile.state-correct {
                    background-color: #48bb78 !important; border-color: #48bb78 !important; cursor: default;
                }

                /* YÊU CẦU 1: Bấm sai -> Biến thành ô rỗng đứt đoạn, chìm vào nền */
                .mem-tile.state-wrong {
                    background-color: transparent !important;
                    border: 2px dashed var(--border-line) !important;
                    opacity: 0.35; transform: scale(0.9); cursor: default;
                }

                /* Lật bài khi thua */
                .mem-tile.state-reveal {
                    background-color: #38a169 !important; opacity: 0.65;
                    border: 2px solid #fff !important;
                }

                /* Bảng điểm Game Over Flat */
                .go-card { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 14px; animation: fadeIn 0.3s ease; }
                .go-card h3 { font-size: 13px; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; text-align: center; }
                .go-card h1 { font-size: 36px; color: var(--primary-color); font-weight: 900; text-align: center; line-height: 1; }
                .go-table { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
                .go-row { display: flex; justify-content: space-between; padding: 10px 14px; background: var(--img-placeholder); border-radius: 8px; font-size: 14px; font-weight: 700; color: var(--text-dark); border: 1px solid var(--border-line); }
                .go-row span:last-child { color: var(--primary-color); font-weight: 900; }
                .go-actions { display: flex; gap: 12px; width: 100%; }
                .btn-half { flex: 1; } /* Kế thừa btn-flat */
            </style>

            <div id="matrix-play-layer" style="width:100%; display:flex; flex-direction:column; align-items:center;">
                <div class="mem-hud">
                    <div>CẤP: <span id="hud-lvl">${state.level}</span></div>
                    <div>ĐIỂM: <span id="hud-score" class="accent">${state.score}</span></div>
                    <div>MẠNG: <span id="hud-live" class="accent">${state.lives}</span></div>
                </div>
                <div class="mem-status" id="hud-status">Đang tạo ma trận...</div>
                <div class="mem-grid-container" id="hud-grid"></div>
            </div>

            <div id="matrix-go-layer" class="go-card" style="display:none;"></div>
        `;
    }

    function updateHUD() {
        document.getElementById('hud-lvl').innerText = state.level;
        document.getElementById('hud-score').innerText = Math.round(state.score);
        document.getElementById('hud-live').innerText = state.lives;
    }

    function setStatusText(txt, color = 'var(--primary-color)') {
        let el = document.getElementById('hud-status');
        if(el) { el.innerText = txt; el.style.color = color; }
    }

    // --- 4. VÒNG LẶP CHƠI GAME ---
    function setupRound() {
        updateHUD();
        state.isInputAllowed = false;
        state.sequence = [];
        state.playerClicks = [];
        state.wrongClicks = 0;

        // Lưu đỉnh cao Level
        let curPeak = parseInt(localStorage.getItem('mm_matrix_peak_lvl')) || 1;
        if (state.level > curPeak) localStorage.setItem('mm_matrix_peak_lvl', state.level);

        state.gridSize = Math.min(3 + Math.floor((state.level - 1) / 3), 7);
        state.targetCount = 2 + state.level;

        const gridEl = document.getElementById('hud-grid');
        gridEl.style.gridTemplateColumns = `repeat(${state.gridSize}, 1fr)`;
        gridEl.innerHTML = '';

        for (let i = 0; i < state.gridSize * state.gridSize; i++) {
            let t = document.createElement('div');
            t.className = 'mem-tile';
            t.onclick = () => onTileClick(t, i);
            gridEl.appendChild(t);
        }

        setStatusText("GHI NHỚ VỊ TRÍ", "var(--text-dark)");

        let pool = Array.from(Array(state.gridSize * state.gridSize).keys());
        for (let i = 0; i < state.targetCount; i++) {
            let r = Math.floor(Math.random() * pool.length);
            state.sequence.push(pool[r]);
            pool.splice(r, 1);
        }

        setSafeTimeout(() => {
            const allTiles = gridEl.querySelectorAll('.mem-tile');
            SfxEngine.flash();
            state.sequence.forEach(id => allTiles[id].classList.add('state-flash'));
            
            let flashDuration = Math.max(1000, state.targetCount * 220);

            setSafeTimeout(() => {
                state.sequence.forEach(id => allTiles[id].classList.remove('state-flash'));
                setStatusText("CHẠM ĐỂ CHỌN MỤC TIÊU");
                state.isInputAllowed = true;
            }, flashDuration);

        }, 450);
    }

    // --- 5. LOGIC CLICK & TÍNH ĐIỂM CÔNG THỨC MỚI ---
    function onTileClick(tile, idx) {
        if (!state.isInputAllowed || tile.classList.contains('state-correct') || tile.classList.contains('state-wrong')) return;

        if (state.sequence.includes(idx)) {
            tile.classList.add('state-correct');
            SfxEngine.correct();
            state.playerClicks.push(idx);

            if (state.playerClicks.length === state.sequence.length) {
                state.isInputAllowed = false;
                SfxEngine.winTone();
                setStatusText("CHÍNH XÁC!", "var(--color-success)");

                // CÔNG THỨC TÍNH ĐIỂM MỚI CỦA LỘC:
                let baseScore = state.targetCount * 10;
                let actualEarned = baseScore;

                if (state.wrongClicks === 1) actualEarned = baseScore * 0.9;
                else if (state.wrongClicks === 2) actualEarned = baseScore * 0.8;

                state.score += actualEarned;
                updateHUD();

                state.level++;
                state.consecutiveFails = 0; // Thắng -> Xóa tội rớt hạng
                setSafeTimeout(setupRound, 1200);
            }
        } 
        else {
            tile.classList.add('state-wrong');
            SfxEngine.wrong();
            state.wrongClicks++;

            if (state.wrongClicks < 3) {
                setStatusText(`SAI VỊ TRÍ! (${state.wrongClicks}/3)`);
            } 
            else {
                // Sai 3 ô -> Thua lượt này
                state.isInputAllowed = false;
                state.lives--;
                state.consecutiveFails++;
                updateHUD();

                // LẬT ĐÁP ÁN CHO NGƯỜI CHƠI XEM
                const allTiles = document.getElementById('hud-grid').querySelectorAll('.mem-tile');
                state.sequence.forEach(id => {
                    if (!state.playerClicks.includes(id)) allTiles[id].classList.add('state-reveal');
                });

                SfxEngine.reveal();
                setStatusText("ĐÁP ÁN BẠN ĐÃ BỎ LỠ", "var(--text-muted)");

                setSafeTimeout(() => {
                    if (state.lives <= 0) {
                        triggerGameOverScreen();
                        return;
                    }

                    if (state.consecutiveFails === 1) {
                        setStatusText("THỬ LẠI CẤP ĐỘ NÀY");
                        setSafeTimeout(setupRound, 1200);
                    } else if (state.consecutiveFails >= 2) {
                        setStatusText("GIẢM 1 CẤP ĐỘ");
                        state.level = Math.max(1, state.level - 1);
                        state.consecutiveFails = 0;
                        setSafeTimeout(setupRound, 1200);
                    }
                }, 1800);
            }
        }
    }

    // --- 6. YÊU CẦU 2: BẢNG XẾP HẠNG TOP 5 CÁ NHÂN 14 NGÀY ---
    function triggerGameOverScreen() {
        document.getElementById('matrix-play-layer').style.display = 'none';
        
        let records = JSON.parse(localStorage.getItem('mm_matrix_history_14d') || '[]');
        let now = Date.now();
        let limit14Days = now - (14 * 86400000);

        if (state.score > 0) {
            records.push({ s: Math.round(state.score), lvl: state.level, date: now });
        }

        // Lọc 14 ngày -> Sắp xếp giảm dần -> Lấy Top 5
        records = records
            .filter(r => r.date >= limit14Days)
            .sort((a, b) => b.s - a.s)
            .slice(0, 5);

        localStorage.setItem('mm_matrix_history_14d', JSON.stringify(records));

        // Bắn điểm về cho Hệ thống tổng (main.js)
        if(window.AppManager) window.AppManager.addScore(Math.round(state.score));

        let rowsHTML = records.map((r, i) => {
            let dStr = new Date(r.date).toLocaleDateString('vi-VN', {day:'2-digit', month:'2-digit'});
            return `<div class="go-row">
                        <span>#0${i+1} &nbsp;[ Màn ${r.lvl} ]</span>
                        <span><small style="color:var(--text-muted); font-weight:400;">${dStr}</small> &nbsp;${r.s}đ</span>
                    </div>`;
        }).join('');

        if(records.length === 0) rowsHTML = `<p style="text-align:center; color:var(--text-muted);">Chưa có kỷ lục nào</p>`;

        const goLayer = document.getElementById('matrix-go-layer');
        goLayer.innerHTML = `
            <h3>KẾT QUẢ HUẤN LUYỆN</h3>
            <h1>${Math.round(state.score)} PTS</h1>
            <p style="font-size:12px; color:var(--text-muted); text-align:center;">
                (Lần tới sẽ khởi động từ Màn ${Math.max(1, state.level - 3)})
            </p>
            
            <div class="go-table">
                <small style="color:var(--text-muted); font-weight:800; margin-bottom:4px;">TOP 5 CÁ NHÂN (14 NGÀY QUA)</small>
                ${rowsHTML}
            </div>

            <div class="go-actions">
                <button class="btn-flat btn-half" onclick="window.CurrentGame.restart()">Chơi Lại</button>
                <button class="btn-back btn-half" style="margin:0; justify-content:center;" onclick="AppManager.quitGame()">Về Menu</button>
            </div>
        `;
        goLayer.style.display = 'flex';
    }

    // --- 7. EXPORT ĐỐI TƯỢNG RA MAIN.JS ---
    window.CurrentGame = {
        init: function() {
            if (SfxEngine.ctx.state === 'suspended') {
                document.addEventListener('click', () => SfxEngine.ctx.resume(), {once: true});
            }
            loadCheckpoint();
            injectGameDOM();
            setupRound();
        },
        restart: function() {
            state.timers.forEach(id => clearTimeout(id));
            state.timers = [];
            this.init();
        },
        cleanup: function() {
            state.timers.forEach(id => clearTimeout(id));
            state.timers = [];
        }
    };

})();
