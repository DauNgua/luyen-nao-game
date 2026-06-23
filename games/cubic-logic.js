/**
 * TÊN FILE: games/cubic-logic.js
 * CẬP NHẬT: Fix hiệu ứng mờ Tầng (Mặt Cắt). Cập nhật text hướng dẫn Khối vàng.
 */

window.CurrentGame = {
    config: {
        defaultLevelTime: 45000, 
        maxRotations: 4,         
        rotateSpeed: 450
    },

    state: {
        score: 0, level: 1, lives: 3, 
        timeLeft: 0, timerInterval: null,
        isPlaying: false, isTransitioning: false,
        cubes: [], correctAnswer: 0, 
        rotationsLeft: 4,
        lastFormationSignature: null, 
        currentAngle: 45,         
        audioCtx: null,
        highestLevel: 1,
        scoreMultiplier: 1.0,
        cubeIdCounter: 0,
        currentRoundSetup: {},
        hintData: null 
    },

    playWoodenSound: function(type) {
        if (!this.state.audioCtx) this.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.state.audioCtx.state === 'suspended') this.state.audioCtx.resume();
        const osc = this.state.audioCtx.createOscillator();
        const gain = this.state.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.state.audioCtx.destination);
        const now = this.state.audioCtx.currentTime;

        if (type === 'correct') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } 
        else if (type === 'error') { 
            osc.type = 'triangle'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
            gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        }
        else if (type === 'rotate') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        }
    },

    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        container.innerHTML = `
            <style>
                .cb-wrapper, .cb-wrapper * { box-sizing: border-box; }
                .cb-wrapper { width: 100%; height: 100%; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-dark); user-select: none; }
                
                .cb-screen { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 500px; min-height: 480px; justify-content: center; }
                .cb-screen.active { display: flex; }
                #cb-game-area { justify-content: flex-start; } 
                
                .cb-header { display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 10px; font-size: 14px; width: 100%; color: var(--text-muted); }
                .cb-score-text { color: var(--primary-color); font-size: 16px; display: flex; align-items: center; gap: 5px;}
                .cb-multiplier-badge { background: #f5a623; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 900;}
                
                .cb-timer-bar { width: 100%; height: 6px; background: var(--border-line); border-radius: 4px; margin-bottom: 15px; overflow: hidden; position: relative;}
                .cb-timer-fill { height: 100%; background: var(--primary-color); width: 100%; transition: width 0.05s linear; }
                
                /* POPUP MODAL HƯỚNG DẪN */
                .cb-modal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); z-index: 100; display: none; justify-content: center; align-items: center; padding: 20px; border-radius: var(--radius-main);}
                .cb-modal-box { background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 12px; padding: 20px; text-align: center; width: 100%; max-width: 320px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                @keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                .cb-modal-title { font-size: 18px; font-weight: 900; color: var(--primary-color); margin-bottom: 10px; text-transform: uppercase; }
                .cb-modal-desc { font-size: 14px; color: var(--text-dark); line-height: 1.5; margin-bottom: 20px; }
                
                .cb-question { font-size: 17px; font-weight: 800; margin-bottom: 10px; line-height: 1.4; color: var(--text-dark); text-align: center; min-height: 48px; display: flex; align-items: center; justify-content: center;}
                
                .cb-rotate-toolbar { display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px; align-items: center; }
                .cb-rotate-btn { background: var(--bg-main); color: var(--text-dark); border: 1px solid var(--border-line); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: 0.2s;}
                .cb-rotate-btn:hover:not(:disabled) { background: var(--border-line); }
                .cb-rotate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .cb-rotate-count { font-size: 12px; font-weight: bold; color: var(--text-muted); }

                /* 3D ENGINE */
                .cb-canvas-box { width: 100%; height: 180px; border-radius: var(--radius-main); margin-bottom: 20px; position: relative; display: flex; justify-content: center; align-items: center; overflow: visible; perspective: 1200px; }
                .cb-iso-scene { position: relative; width: 0; height: 0; transform-style: preserve-3d; transform: rotateX(60deg) rotateZ(var(--scene-z, 45deg)); transition: transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1); }
                
                .cb-cube-3d { position: absolute; width: 32px; height: 32px; margin-left: -16px; margin-top: -16px; transform-style: preserve-3d; transition: opacity 0.5s ease; }
                .cb-face { position: absolute; width: 32px; height: 32px; box-sizing: border-box; border: 1px solid rgba(0,0,0,0.15); backface-visibility: hidden; }
                [data-theme="dark"] .cb-face { border-color: rgba(0,0,0,0.5); }
                
                .f-t { transform: translateZ(16px); background: #e2e8f0; } .f-b { transform: rotateX(180deg) translateZ(16px); background: #94a3b8; } .f-r { transform: rotateY(90deg) translateZ(16px); background: #cbd5e0; } .f-l { transform: rotateY(-90deg) translateZ(16px); background: #a0aec0; } .f-fr { transform: rotateX(90deg) translateZ(16px); background: #cbd5e0; } .f-bk { transform: rotateX(-90deg) translateZ(16px); background: #a0aec0; }
                [data-theme="dark"] .f-t { background: #4a5568; } [data-theme="dark"] .f-r, [data-theme="dark"] .f-fr { background: #2d3748; } [data-theme="dark"] .f-l, [data-theme="dark"] .f-bk { background: #1a202c; }
                
                /* GỢI Ý THỊ GIÁC (Đã sửa lỗi bẹp 2D) */
                /* Biến khối bị cắt thành khối Thủy tinh 3D (Hologram) */
                /* --- GỢI Ý THỊ GIÁC (Đã Fix lỗi tẩy màu khối bên dưới) --- */
                .cb-cube-3d.hint-fade .cb-face {
                    /* Dùng màu đen cực kỳ nhạt (3%) thay vì màu trắng, để không làm lóa màu khối bên dưới */
                    background: rgba(0, 0, 0, 0.03) !important; 
                    border-color: rgba(0, 0, 0, 0.15) !important;
                }
                [data-theme="dark"] .cb-cube-3d.hint-fade .cb-face {
                    /* Dark mode dùng màu trắng cực nhạt (3%) */
                    background: rgba(255, 255, 255, 0.03) !important; 
                    border-color: rgba(255, 255, 255, 0.15) !important;
                }
                .cb-cube-3d.hint-glow .cb-face { border-color: #f5a623 !important; border-width: 2px; }
                .cb-cube-3d.hint-glow .f-t { background: #fbd38d !important; } .cb-cube-3d.hint-glow .f-r, .cb-cube-3d.hint-glow .f-fr { background: #ed8936 !important; } .cb-cube-3d.hint-glow .f-l, .cb-cube-3d.hint-glow .f-bk { background: #dd6b20 !important; }
                
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                
                .cb-rules-box { background: var(--bg-main); border: 1px solid var(--border-line); border-radius: var(--radius-main); padding: 15px; width: 100%; text-align: left; margin-bottom: 25px; }
                .cb-rules-box ul { padding-left: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 10px; }
                .cb-rules-box li { margin-bottom: 4px; }
                .cb-rules-title { font-weight: 800; font-size: 14px; margin-bottom: 8px; color: var(--text-dark); }
                
                .start-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; }
                .btn-adv { background-color: var(--bg-card) !important; color: var(--primary-color) !important; border: 2px solid var(--primary-color) !important; }
                @media (hover: hover) { .btn-adv:hover { background-color: var(--primary-color) !important; color: white !important; } }
            </style>

            <div class="cb-wrapper" id="cb-wrapper">
                <!-- MENU BẮT ĐẦU -->
                <div id="cb-menu-screen" class="cb-screen active">
                    <h1 style="font-size: 28px; margin-bottom: 20px; color: var(--text-dark); text-align:center;">ĐẾM KHỐI LOGIC</h1>
                    
                    <div class="cb-rules-box">
                        <p class="cb-rules-title">🎯 TIẾN TRÌNH TƯ DUY:</p>
                        <ul>
                            <li><b>Màn 1-14:</b> Đếm số lượng, đếm tầng, đếm khối ẩn.</li>
                            <li><b>Màn 15+:</b> Phân tích khối bị che lấp (Góc khuất).</li>
                            <li><b>Màn 19+:</b> Tưởng tượng Cắt lớp không gian.</li>
                            <li><b>Màn 25+:</b> Tính diện tích bề mặt lộ ra ngoài.</li>
                        </ul>
                        <p style="font-size: 12px; color: var(--primary-color); font-style: italic; margin-top: 10px; text-align: center;">Mẹo: Các kỹ năng mới sẽ có màn Hướng Dẫn không tính giờ!</p>
                    </div>

                    <div class="start-actions" id="cb-start-actions"></div>
                </div>

                <!-- KHU VỰC CHƠI -->
                <div id="cb-game-area" class="cb-screen">
                    <div class="cb-header">
                        <div>MÀN: <span id="cb-level" style="color: var(--text-dark);">1</span></div>
                        <div class="cb-score-text">ĐIỂM: <span id="cb-score">0</span> <span id="cb-multiplier-ui" class="cb-multiplier-badge" style="display:none;"></span></div>
                        <div>MẠNG: <span id="cb-lives">3</span></div>
                    </div>
                    
                    <div class="cb-timer-bar"><div id="cb-timer-fill" class="cb-timer-fill"></div></div>

                    <div class="cb-question" id="cb-question-text">---</div>
                    
                    <div class="cb-rotate-toolbar">
                        <button class="cb-rotate-btn" id="btn-rot-left" onclick="window.CurrentGame.rotateView('left')">↺ Xoay Trái</button>
                        <span class="cb-rotate-count">Lượt xoay: <span id="cb-rot-val">4</span></span>
                        <button class="cb-rotate-btn" id="btn-rot-right" onclick="window.CurrentGame.rotateView('right')">Xoay Phải ↻</button>
                    </div>

                    <div class="cb-canvas-box">
                        <div class="cb-iso-scene" id="cb-scene"></div>
                    </div>

                    <div class="cb-grid" id="cb-buttons"></div>

                    <!-- POPUP HƯỚNG DẪN -->
                    <div id="cb-tutorial-modal" class="cb-modal-overlay">
                        <div class="cb-modal-box">
                            <div class="cb-modal-title" id="cb-modal-title">KỸ NĂNG MỚI</div>
                            <div class="cb-modal-desc" id="cb-modal-desc">Giải thích ở đây</div>
                            <button class="btn-flat" onclick="window.CurrentGame.closeTutorial()" style="width: 100%; font-size: 14px;">ĐÃ HIỂU, CHƠI NGAY</button>
                        </div>
                    </div>
                </div>

                <!-- GAME OVER -->
                <div id="cb-gameover-screen" class="cb-screen">
                    <h2 style="color: var(--primary-color); font-size: 36px; margin-bottom: 10px;">KẾT THÚC</h2>
                    <p style="color: var(--text-muted); font-size: 18px; margin-bottom: 30px;">Tổng điểm: <strong id="cb-final-score" style="color: var(--text-dark); font-size: 28px;">0</strong></p>
                    <button class="btn-flat" onclick="window.CurrentGame.showMenu()">VỀ MENU CHÍNH</button>
                </div>
            </div>
        `;
        this.showMenu();
    },

    showMenu: function() {
        document.getElementById('cb-game-area').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.remove('active');
        document.getElementById('cb-menu-screen').classList.add('active');

        this.state.highestLevel = parseInt(localStorage.getItem('cb_highest_level')) || 1;
        let advLevel = Math.floor(this.state.highestLevel * 0.7);
        if (advLevel < 2) advLevel = 1; 

        let advMult = 1 + (advLevel * 0.05);

        const actionsContainer = document.getElementById('cb-start-actions');
        actionsContainer.innerHTML = `
            <button class="btn-flat" onclick="window.CurrentGame.startGame(1, 1.0)">
                Chơi từ Màn 1 (x1.0 Điểm)
            </button>
        `;

        if (advLevel > 1) {
            actionsContainer.innerHTML += `
                <button class="btn-flat btn-adv" onclick="window.CurrentGame.startGame(${advLevel}, ${advMult})">
                    Bỏ qua đến Màn ${advLevel} (x${advMult.toFixed(2)} Điểm)
                </button>
            `;
        }
    },

    startGame: function(startLvl = 1, multiplier = 1.0) {
        this.state.score = 0; 
        this.state.level = startLvl; 
        this.state.scoreMultiplier = multiplier;
        this.state.lives = 3;
        this.state.isPlaying = true; 
        this.state.isTransitioning = false;
        this.state.lastFormationSignature = null; 
        
        document.getElementById('cb-menu-screen').classList.remove('active');
        document.getElementById('cb-game-area').classList.add('active');
        
        const badge = document.getElementById('cb-multiplier-ui');
        if (multiplier > 1.0) {
            badge.style.display = 'inline-block';
            badge.innerText = `x${multiplier.toFixed(2)}`;
        } else {
            badge.style.display = 'none';
        }

        this.nextRound();
    },

    // --- SETUP MÀN CHƠI & LẤY DỮ LIỆU HỌC BẠ ---
    setupRoundLogic: function() {
        const lvl = this.state.level;
        let pool = [1, 2, 3];
        if (lvl >= 15) pool.push(4); // Mặt tiếp xúc (15+)
        if (lvl >= 19) pool.push(5); // Cắt lớp (19+)
        if (lvl >= 25) pool.push(6); // Diện tích bề mặt (25+)

        let qType;
        if (lvl === 15) qType = 4;
        else if (lvl === 19) qType = 5;
        else if (lvl === 25) qType = 6;
        else qType = pool[Math.floor(Math.random() * pool.length)];

        let progress = 2; 
        if (qType >= 4) progress = parseInt(localStorage.getItem('cb_rule_' + qType)) || 0;

        let setup = { type: qType, progress: progress, isTutorial: false, cubeCount: 0 };

        if (progress === 0) {
            setup.isTutorial = true;
            // Số lượng khối khi hướng dẫn
            if (qType === 6) setup.cubeCount = Math.floor(Math.random() * 2) + 3; // 3-4 khối
            else if (qType === 5) setup.cubeCount = 8; // Cắt lớp cần ép xây tầng 2, nên cần ít nhất 8 khối
            else setup.cubeCount = Math.floor(Math.random() * 2) + 5; 
        } 
        else if (progress === 1) {
            setup.isTutorial = false;
            setup.cubeCount = Math.floor(Math.random() * 3) + 8; // Thực hành
        } 
        else {
            setup.isTutorial = false;
            if (lvl <= 5) setup.cubeCount = Math.floor(Math.random() * 3) + 4;       
            else if (lvl <= 12) setup.cubeCount = Math.floor(Math.random() * 5) + 8; 
            else if (lvl <= 18) setup.cubeCount = Math.floor(Math.random() * 6) + 14;
            else setup.cubeCount = Math.floor(Math.random() * 8) + 21;               
        }

        this.state.currentRoundSetup = setup;
    },

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        
        this.setupRoundLogic(); 
        this.state.rotationsLeft = this.config.maxRotations; 
        this.state.currentAngle = 45;
        this.state.hintData = null; 

        const sceneEl = document.getElementById('cb-scene');
        sceneEl.style.transition = 'none'; 
        sceneEl.style.setProperty('--scene-z', `${this.state.currentAngle}deg`);
        sceneEl.style.setProperty('--rot-speed', `${this.config.rotateSpeed}ms`);
        
        this.generateCubesForLevel(); 
        this.renderScene();
        this.generateQuestionAndOptions();
        this.updateUI();

        if (this.state.currentRoundSetup.isTutorial) {
            clearInterval(this.state.timerInterval); 
            document.querySelector('.cb-timer-bar').style.display = 'none';
            this.showTutorialPopup();
        } else {
            document.querySelector('.cb-timer-bar').style.display = 'block';
            this.startTimer(this.config.defaultLevelTime); 
        }
    },

    // --- XỬ LÝ POPUP & GỢI Ý THỊ GIÁC ---
    showTutorialPopup: function() {
        const modal = document.getElementById('cb-tutorial-modal');
        const title = document.getElementById('cb-modal-title');
        const desc = document.getElementById('cb-modal-desc');
        const qType = this.state.currentRoundSetup.type;

        if (qType === 4) {
            title.innerText = "Tư Duy: Mật Độ";
            desc.innerHTML = "Tìm khối bị <b>kẹp chặt</b> bởi khối khác.<br><br>👉 <i>Khối cần tìm (khối bị che ít nhất 3 mặt) sẽ có màu vàng. (Các mặt chạm đất không tính là che mặt).</i>";
        } else if (qType === 5) {
            title.innerText = "Tư Duy: Cắt Lớp";
            desc.innerHTML = "Hãy tưởng tượng dùng một con dao cắt ngang khối nhà ở một tầng chỉ định (Tầng chạm đất là Tầng 1).<br><br>👉 <i>Những tầng nằm bên trên (trong suốt) bị cắt bỏ đi. Bạn chỉ đếm khối ở tầng dưới cùng đặc màu!</i>";
        } else if (qType === 6) {
            title.innerText = "Tư Duy: Diện Tích Hở";
            desc.innerHTML = "Câu hỏi cao cấp: Hãy đếm tất cả các <b>mặt vuông</b> lộ ra ngoài không khí.<br><br>👉 <i>Mỗi khối cô lập có 6 mặt hở. Nhưng khi 2 khối dính nhau, 2 mặt tiếp xúc sẽ bị giấu đi. Hãy quét kỹ!</i>";
        }

        modal.style.display = 'flex';
    },

    closeTutorial: function() {
        document.getElementById('cb-tutorial-modal').style.display = 'none';
        this.applyVisualHints(); // Kích hoạt hiệu ứng trên khối sau khi đóng popup
    },

    applyVisualHints: function() {
        if (!this.state.hintData) return;
        let qType = this.state.currentRoundSetup.type;

        if (qType === 4) {
            // Nháy sáng khối ví dụ
            let targetCube = document.querySelector(`.cb-cube-3d[data-id="${this.state.hintData.exampleId}"]`);
            if (targetCube) targetCube.classList.add('hint-glow');
        } 
        else if (qType === 5) {
            // Làm mờ tầng nằm TRÊN lát cắt
            let targetZ = this.state.hintData.targetZ;
            document.querySelectorAll('.cb-cube-3d').forEach(el => {
                let z = parseInt(el.getAttribute('data-z'));
                if (z > targetZ) el.classList.add('hint-fade');
            });
        }
    },

    rotateView: function(direction) {
        if (this.state.rotationsLeft <= 0 || !this.state.isPlaying || this.state.isTransitioning) return;
        this.state.rotationsLeft--;
        this.state.isTransitioning = true; 
        this.playWoodenSound('rotate');
        
        this.state.currentAngle += (direction === 'left' ? -90 : 90);
        
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.style.transition = `transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1)`;
        sceneEl.style.setProperty('--scene-z', `${this.state.currentAngle}deg`);
        
        this.updateUI();
        setTimeout(() => { this.state.isTransitioning = false; }, this.config.rotateSpeed);
    },

    generateCubesForLevel: function() {
        let isDuplicate = false;
        let safetyCounter = 0; 
        const targetCount = this.state.currentRoundSetup.cubeCount;
        
        do {
            this.state.cubes = [];
            this.state.cubeIdCounter = 0;
            let occupied = new Set();
            const getKey = (x, y, z) => `${x},${y},${z}`;

            this.state.cubes.push({ id: this.state.cubeIdCounter++, x: 0, y: 0, z: 0 });
            occupied.add(getKey(0, 0, 0));

            while (this.state.cubes.length < targetCount) {
                let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
                
                let dirs = [{dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 0, dz: 1}];
                
                // [FIX LỖI MẶT CẮT]: Ép các khối phải mọc thẳng lên Tầng 2, Tầng 3
                if (this.state.currentRoundSetup.type === 5) {
                    dirs = [{dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: 1}, {dx: 1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}];
                }

                let dir = dirs[Math.floor(Math.random() * dirs.length)];
                let nx = baseCube.x + dir.dx, ny = baseCube.y + dir.dy, nz = baseCube.z + dir.dz;
                
                let nKey = getKey(nx, ny, nz);
                if (!occupied.has(nKey) && (nz === 0 || occupied.has(getKey(nx, ny, nz - 1)))) {
                    this.state.cubes.push({ id: this.state.cubeIdCounter++, x: nx, y: ny, z: nz });
                    occupied.add(nKey);
                }
            }

            let currentSignature = this.state.cubes.map(c => `${c.x},${c.y},${c.z}`).sort().join('|');
            if (currentSignature === this.state.lastFormationSignature && safetyCounter < 5) {
                isDuplicate = true; safetyCounter++;
            } else {
                isDuplicate = false; this.state.lastFormationSignature = currentSignature; 
            }
        } while (isDuplicate);

        this.state.cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
    },

    renderScene: function() {
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.innerHTML = '';
        const size = 32; 
        
        this.state.cubes.forEach(c => {
            let cssCube = document.createElement('div');
            cssCube.className = `cb-cube-3d`;
            // Cài data-id và data-z để Javascript làm mờ tầng cắt và bôi vàng khối dễ dàng
            cssCube.setAttribute('data-id', c.id);
            cssCube.setAttribute('data-z', c.z);

            cssCube.style.transform = `translate3d(${c.x * size}px, ${c.y * size}px, ${c.z * size}px)`;
            cssCube.innerHTML = `
                <div class="cb-face f-t"></div><div class="cb-face f-b"></div><div class="cb-face f-r"></div>
                <div class="cb-face f-l"></div><div class="cb-face f-fr"></div><div class="cb-face f-bk"></div>
            `;
            sceneEl.appendChild(cssCube);
        });
    },

    generateQuestionAndOptions: function() {
        let setup = this.state.currentRoundSetup;
        let ans = 0, qText = "";

        const getAdjacencies = () => {
            let pairs = 0;
            let adjMap = new Map();
            this.state.cubes.forEach(c => adjMap.set(c.id, 0));
            for(let i=0; i<this.state.cubes.length; i++) {
                for(let j=i+1; j<this.state.cubes.length; j++) {
                    let d = Math.abs(this.state.cubes[i].x - this.state.cubes[j].x) + Math.abs(this.state.cubes[i].y - this.state.cubes[j].y) + Math.abs(this.state.cubes[i].z - this.state.cubes[j].z);
                    if(d === 1) {
                        adjMap.set(this.state.cubes[i].id, adjMap.get(this.state.cubes[i].id) + 1);
                        adjMap.set(this.state.cubes[j].id, adjMap.get(this.state.cubes[j].id) + 1);
                        pairs++;
                    }
                }
            }
            return { map: adjMap, pairs: pairs };
        };

        let adjData = null;

        if (setup.type === 1) { 
            qText = "Có TỔNG CỘNG bao nhiêu khối?"; ans = this.state.cubes.length; 
        } 
        else if (setup.type === 2) { 
            qText = "Có bao nhiêu khối ĐANG CHẠM MẶT ĐẤT?"; ans = this.state.cubes.filter(c => c.z === 0).length; 
        } 
        else if (setup.type === 3) { 
            qText = "Có bao nhiêu khối BỊ KHỐI KHÁC ĐÈ LÊN?";
            let cSet = new Set(this.state.cubes.map(c => `${c.x},${c.y},${c.z}`));
            ans = this.state.cubes.filter(c => cSet.has(`${c.x},${c.y},${c.z + 1}`)).length;
        }
        else if (setup.type === 4) {
            qText = "Có bao nhiêu khối bị che ≥3 MẶT? (Chỉ đếm mặt chạm khối khác)";
            adjData = getAdjacencies();
            let covered = this.state.cubes.filter(c => adjData.map.get(c.id) >= 3);
            ans = covered.length;
            if (setup.isTutorial && covered.length > 0) this.state.hintData = { exampleId: covered[0].id };
        }
        else if (setup.type === 5) {
            // [FIX LỖI]: Màn hướng dẫn BẮT BUỘC hỏi Tầng 1 (Z=0) để các Tầng 2,3 (Z>0) mờ đi
            let targetZ = 1; // Hỏi tầng 2
            if (setup.isTutorial) {
                targetZ = 0; 
            } else if (!this.state.cubes.some(c => c.z >= 1)) {
                targetZ = 0; // Đề phòng lỗi thiếu khối
            }
            
            qText = `Nếu CẮT NGANG Tầng ${targetZ + 1}, lát cắt có bao nhiêu khối?`;
            ans = this.state.cubes.filter(c => c.z === targetZ).length;
            if (setup.isTutorial) this.state.hintData = { targetZ: targetZ };
        }
        else if (setup.type === 6) {
            qText = "Tổng DIỆN TÍCH BỀ MẶT hở ra ngoài là bao nhiêu?";
            adjData = getAdjacencies();
            ans = (this.state.cubes.length * 6) - (adjData.pairs * 2);
        }

        this.state.correctAnswer = ans;
        document.getElementById('cb-question-text').innerText = qText;

        let opts = new Set([ans]);
        let attempts = 0;
        
        while(opts.size < 4) {
            attempts++;
            let variance = (setup.type === 6) ? 4 + Math.floor(attempts / 4) : 2 + Math.floor(attempts / 5); 
            let f = ans + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
            if (f >= 0 && f !== ans) opts.add(f); 
            if (attempts > 50) opts.add(ans + opts.size + 1);
        }
        
        let arrOpts = Array.from(opts).sort(() => Math.random() - 0.5);

        const btnBox = document.getElementById('cb-buttons');
        btnBox.innerHTML = '';
        arrOpts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = `btn-flat`;
            btn.style.backgroundColor = 'var(--bg-card)';
            btn.style.color = 'var(--text-dark)';
            btn.style.border = '2px solid var(--border-line)';
            btn.innerText = opt;
            btn.onclick = () => this.handleChoice(opt);
            btnBox.appendChild(btn);
        });
    },

    handleChoice: function(selected) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        if (document.getElementById('cb-tutorial-modal').style.display === 'flex') return;

        this.state.isTransitioning = true;
        clearInterval(this.state.timerInterval);

        if (selected === this.state.correctAnswer) {
            let setup = this.state.currentRoundSetup;
            if (setup.type >= 4 && setup.progress < 2) {
                localStorage.setItem('cb_rule_' + setup.type, setup.progress + 1);
            }

            let basePoints = 10 + this.state.level;
            let finalPoints = Math.floor(basePoints * this.state.scoreMultiplier);
            this.state.score += finalPoints;
            
            if (this.state.level > this.state.highestLevel) {
                this.state.highestLevel = this.state.level;
                localStorage.setItem('cb_highest_level', this.state.highestLevel);
            }
            
            this.state.level++;
            this.playWoodenSound('correct');
        } else {
            this.playWoodenSound('error');
            this.state.lives--;
        }

        document.getElementById('cb-game-area').style.opacity = '0.4';
        setTimeout(() => {
            document.getElementById('cb-game-area').style.opacity = '1';
            this.state.isTransitioning = false;
            this.nextRound();
        }, 300);
    },

    startTimer: function(dur) {
        clearInterval(this.state.timerInterval);
        this.state.timeLeft = dur;
        const tick = 20, fill = document.getElementById('cb-timer-fill');

        this.state.timerInterval = setInterval(() => {
            if(this.state.isTransitioning) return;

            this.state.timeLeft -= tick;
            if(fill) fill.style.width = `${(this.state.timeLeft/dur)*100}%`;

            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timerInterval);
                if(fill) fill.style.width = `0%`;
                
                if (!this.state.isTransitioning) {
                    this.state.isTransitioning = true;
                    this.playWoodenSound('error');
                    this.state.lives--; 
                    document.getElementById('cb-game-area').style.opacity = '0.4';
                    setTimeout(() => { document.getElementById('cb-game-area').style.opacity = '1'; this.state.isTransitioning = false; this.nextRound(); }, 300);
                }
            }
        }, tick);
    },

    updateUI: function() {
        document.getElementById('cb-level').innerText = this.state.level;
        document.getElementById('cb-score').innerText = this.state.score;
        document.getElementById('cb-lives').innerText = '❤️'.repeat(Math.max(0, this.state.lives));
        
        document.getElementById('cb-rot-val').innerText = this.state.rotationsLeft;
        const disableRot = (this.state.rotationsLeft <= 0);
        document.getElementById('btn-rot-left').disabled = disableRot;
        document.getElementById('btn-rot-right').disabled = disableRot;
    },

    gameOver: function() {
        this.state.isPlaying = false;
        clearInterval(this.state.timerInterval);
        this.playWoodenSound('error');
        
        document.getElementById('cb-game-area').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.add('active');
        document.getElementById('cb-final-score').innerText = this.state.score;
        
        if(window.AppManager && typeof window.AppManager.addScore === 'function') {
            window.AppManager.addScore(this.state.score);
        }
    },

    cleanup: function() {
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);
        if (this.state.audioCtx && this.state.audioCtx.state !== 'closed') this.state.audioCtx.suspend();
        this.state.isPlaying = false;
    }
};
