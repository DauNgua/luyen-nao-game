// Gói Game vào một Hàm tự chạy (IIFE)
(function() {
    
    // --- BỘ MÁY ÂM THANH BẰNG CODE THUẦN TÚY (Web Audio API) ---
    const AudioEngine = {
        ctx: new (window.AudioContext || window.webkitAudioContext)(),
        
        playTone: function(freq, type, duration, vol) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            // Thiết lập Envelope (Âm lượng mờ dần cho êm tai)
            gainNode.gain.setValueAtTime(vol, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        },

        sfxFlash: () => AudioEngine.playTone(600, 'sine', 0.2, 0.1),       // Típ nhẹ
        sfxCorrect: () => AudioEngine.playTone(900, 'sine', 0.15, 0.15),   // Đinh! (Đúng)
        sfxWrong: () => AudioEngine.playTone(150, 'sawtooth', 0.3, 0.2),   // Rèèè! (Sai)
        sfxLevelUp: function() {
            // Âm thanh vút lên khi qua màn
            setTimeout(() => this.playTone(400, 'sine', 0.1, 0.1), 0);
            setTimeout(() => this.playTone(600, 'sine', 0.1, 0.1), 100);
            setTimeout(() => this.playTone(800, 'sine', 0.3, 0.15), 200);
        }
    };

    // --- 1. KHAI BÁO STATE (TRẠNG THÁI) GAME ---
    let state = {
        level: 1,
        lives: 3,
        score: 0,
        gridSize: 3,
        targetCount: 3,
        sequence: [],
        playerClicks: [],
        isPlayerTurn: false,
        wrongClicksInRound: 0,   // Số ô sai trong 1 màn
        consecutiveFails: 0,     // NEW: Số màn bị thua liên tiếp tại 1 Level
        gameTimeouts: [] 
    };

    const canvas = document.getElementById('game-canvas');

    function setGameTimeout(callback, delay) {
        let id = setTimeout(callback, delay);
        state.gameTimeouts.push(id);
        return id;
    }

    // --- 2. XÂY DỰNG GIAO DIỆN (UI INJECTION) ---
    function renderUI() {
        canvas.innerHTML = `
            <style>
                .memory-header { display: flex; justify-content: space-between; padding: 10px 20px; color: #fff; font-weight: bold; }
                .memory-status { text-align: center; color: #f05e4b; font-size: 16px; font-weight: 800; min-height: 25px; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px;}
                
                .memory-grid-wrapper { flex-grow: 1; display: flex; justify-content: center; align-items: center; padding-bottom: 20px;}
                .memory-grid { 
                    display: grid; gap: 8px; 
                    width: 100%; max-width: 320px; aspect-ratio: 1/1; 
                }
                
                .mem-tile { 
                    background-color: #2d3748; border-radius: 6px; cursor: pointer; 
                    transition: all 0.15s; border: 2px solid transparent; 
                }
                
                /* Tắt box-shadow lún ở các mode khó hơn để tránh rối, nhưng làm sáng bóng hơn */
                .mem-tile.flash { background-color: #fdfdfd; border-color: #fff; box-shadow: 0 0 20px rgba(255, 255, 255, 0.4); }
                .mem-tile.correct { background-color: #48bb78; cursor: default;}
                .mem-tile.wrong { background-color: #e53e3e; animation: err-shake 0.3s; cursor: default;}

                @keyframes err-shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
            </style>
            
            <div class="memory-header">
                <div style="color: #63b3ed;">Màn: <span id="mem-lvl">${state.level}</span></div>
                <div style="color: #48bb78;">Điểm: <span id="mem-score">${state.score}</span></div>
                <div style="color: #fc8181;">❤ <span id="mem-live">${state.lives}</span></div>
            </div>

            <div class="memory-status" id="mem-status">Đang nạp dữ liệu...</div>

            <div class="memory-grid-wrapper">
                <div class="memory-grid" id="mem-grid"></div>
            </div>
        `;
    }

    function updateHUD() {
        document.getElementById('mem-lvl').innerText = state.level;
        document.getElementById('mem-score').innerText = state.score;
        document.getElementById('mem-live').innerText = state.lives;
    }

    function setStatus(text, color = '#f05e4b') {
        let el = document.getElementById('mem-status');
        el.innerText = text;
        el.style.color = color;
    }

    // --- 3. LOGIC TRÒ CHƠI CHÍNH ---
    function startLevel() {
        updateHUD();
        state.isPlayerTurn = false;
        state.sequence = [];
        state.playerClicks = [];
        state.wrongClicksInRound = 0; // Reset đếm lỗi cho màn mới

        // Giới hạn max grid là 8x8 (Mức độ Siêu Khó)
        state.gridSize = Math.min(3 + Math.floor((state.level - 1) / 3), 8);
        state.targetCount = 2 + state.level; 

        // Vẽ bàn cờ
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

        setStatus("GHI NHỚ VỊ TRÍ", "#63b3ed");

        // Random lấy các ô đích
        let allIndices = Array.from(Array(state.gridSize * state.gridSize).keys());
        for (let i = 0; i < state.targetCount; i++) {
            let randomIdx = Math.floor(Math.random() * allIndices.length);
            state.sequence.push(allIndices[randomIdx]);
            allIndices.splice(randomIdx, 1);
        }

        setGameTimeout(() => {
            const tiles = document.querySelectorAll('.mem-tile');
            
            // Phát âm thanh và làm sáng đồng loạt
            AudioEngine.sfxFlash();
            state.sequence.forEach(id => tiles[id].classList.add('flash'));
            
            // Lượng thời gian cho người chơi nhìn: 1 ô = 0.25s
            let viewTime = Math.max(1000, state.targetCount * 250);

            setGameTimeout(() => {
                state.sequence.forEach(id => tiles[id].classList.remove('flash'));
                setStatus("CHẠM ĐỂ CHỌN MỤC TIÊU", "#fdfdfd");
                state.isPlayerTurn = true; 
            }, viewTime);

        }, 500);
    }

    // --- 4. CƠ CHẾ CLICK, PHẠT VÀ TỤT HẠNG ---
    function onTileClick(tileEl, id) {
        if (!state.isPlayerTurn || tileEl.classList.contains('correct') || tileEl.classList.contains('wrong')) return;

        // KỊCH BẢN A: BẤM ĐÚNG
        if (state.sequence.includes(id)) {
            tileEl.classList.add('correct');
            AudioEngine.sfxCorrect();
            
            state.playerClicks.push(id);
            state.score += 50;
            updateHUD();

            // Kích hoạt Chiến Thắng: Hoàn thành màn chơi
            if (state.playerClicks.length === state.sequence.length) {
                state.isPlayerTurn = false;
                AudioEngine.sfxLevelUp();
                
                setStatus("HOÀN HẢO! + CẤP ĐỘ", "#48bb78");
                
                // Trả thưởng Bonus qua màn (tính theo level và nếu không bấm xịt ô nào)
                if (state.wrongClicksInRound === 0) state.score += state.level * 100;
                else state.score += state.level * 50;

                state.level++;
                state.consecutiveFails = 0; // Thắng thì reset bộ đếm rớt hạng ngay!
                
                setGameTimeout(startLevel, 1500);
            }
        } 
        // KỊCH BẢN B: BẤM SAI
        else {
            tileEl.classList.add('wrong');
            AudioEngine.sfxWrong();
            state.wrongClicksInRound++;

            // Mức chịu đựng: Cho phép sai 2 lần trong 1 màn, tới lần 3 thì Xử lý Thua
            if (state.wrongClicksInRound < 3) {
                setStatus(`CẢNH BÁO! NHẦM Ô (${state.wrongClicksInRound}/3)`, "#fc8181");
            } 
            else {
                // Đã sai 3 lần -> Bị tính là Thua (Fail) màn này
                state.isPlayerTurn = false;
                state.lives--;
                state.consecutiveFails++; // Tăng vạch cảnh báo Rớt hạng
                
                updateHUD();

                if (state.lives <= 0) {
                    setStatus("HẾT MẠNG! GAME OVER", "#f56565");
                    setGameTimeout(() => {
                        window.AppManager.addScore(state.score);
                        window.AppManager.quitGame();
                    }, 1500);
                    return;
                }

                // CƠ CHẾ RỚT HẠNG THEO YÊU CẦU:
                if (state.consecutiveFails === 1) {
                    // Thua lần đầu ở cấp này -> Chơi lại Level này, đổi ma trận mới
                    setStatus("MẤT MẠNG! CHƠI LẠI MÀN NÀY", "#f6e05e");
                    setGameTimeout(startLevel, 2000);
                } 
                else if (state.consecutiveFails >= 2) {
                    // Cố chấp sai 2 lần -> Bị đuổi ngược về 1 Level cho bớt ngáo
                    setStatus("THẤT BẠI QUÁ NHIỀU! TỤT 1 LEVEL", "#e53e3e");
                    
                    state.level = Math.max(1, state.level - 1); // Rớt xuống tối thiểu cấp 1
                    state.consecutiveFails = 0; // Đã phạt xong, reset tội trạng về 0
                    
                    setGameTimeout(startLevel, 2000);
                }
            }
        }
    }


    // --- 5. CÔNG BỐ OBJECT CHO MAIN.JS QUẢN LÝ ---
    window.CurrentGame = {
        init: function() {
            // Ngay khi khởi động, thiết lập Context Âm thanh (Vượt policy Autoplay của Chrome)
            if (AudioEngine.ctx.state === 'suspended') {
                document.addEventListener('click', () => AudioEngine.ctx.resume(), {once: true});
            }
            
            renderUI();
            startLevel();
        },
        cleanup: function() {
            state.gameTimeouts.forEach(id => clearTimeout(id));
            state.gameTimeouts = [];
        }
    };

})();