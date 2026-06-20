/**
 * TÊN FILE: games/cubic-logic.js
 * GAME: CUBIC & LOGIC (Bản Cập Nhật: Time Bomb + Limited Rotate)
 */

window.CurrentGame = {
    // ==========================================
    // KHU VỰC CẤU HÌNH NHANH (BẠN CÓ THỂ CHỈNH SỬA Ở ĐÂY)
    // ==========================================
    config: {
        defaultLevelTime: 45000, // Thời gian gốc mỗi màn: 15000ms (15 giây)
        defaultBombTime: 12000,   // Thời gian nổ của Khối Bộc Phá: 4000ms (4 giây)
        maxRotations: 4,         // Số lượt xoay tối đa mỗi màn: 2 lượt
        penaltyTime: 3000        // Phạt trừ bao nhiêu thời gian khi bom nổ: 3000ms (3 giây)
    },

    // 1. TRẠNG THÁI TRÒ CHƠI
    state: {
        score: 0, level: 1, lives: 3, 
        timeLeft: 0, timerInterval: null,
        bombTimeLeft: 0, bombInterval: null,
        isPlaying: false, isTransitioning: false,
        cubes: [], correctAnswer: 0, 
        isGoldenRound: false, isBombRound: false,
        rotationsLeft: 2,
        audioCtx: null 
    },

    // 2. BỘ TẠO ÂM THANH GỖ & HIỆU ỨNG MỚI
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
        else if (type === 'gold_correct') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1000, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
        else if (type === 'rotate') { // Tiếng trượt mộc (Vooosh)
            osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        }
        else if (type === 'bomb_tick') { // Tiếng tíc tíc của bom
            osc.type = 'square'; osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now); osc.stop(now + 0.05);
        }
        else if (type === 'explosion') { // Tiếng nổ ồn trầm (Sụp đổ khối)
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
            gain.gain.setValueAtTime(0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    },

    // 3. KHỞI TẠO GIAO DIỆN
    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        container.innerHTML = `
            <style>
                .cb-wrapper, .cb-wrapper * { box-sizing: border-box; }
                .cb-wrapper { width: 100%; height: 100%; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-dark); user-select: none; }
                .cb-screen { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 500px;}
                .cb-screen.active { display: flex; }
                
                .cb-header { display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 10px; font-size: 14px; width: 100%; color: var(--text-muted); }
                .cb-score-text { color: var(--primary-color); font-size: 16px;}
                
                .cb-timer-bar { width: 100%; height: 6px; background: var(--border-line); border-radius: 4px; margin-bottom: 15px; overflow: hidden; position: relative;}
                .cb-timer-fill { height: 100%; background: var(--primary-color); width: 100%; transition: width 0.05s linear; }
                
                /* Khu vực cảnh báo BOM */
                .cb-bomb-warning { width: 100%; background: #fee2e2; color: #ef4444; border: 1px solid #f87171; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: bold; margin-bottom: 10px; display: none; justify-content: space-between; align-items: center; animation: flashWarning 1s infinite alternate;}
                @keyframes flashWarning { 0% { background: #fee2e2; } 100% { background: #fca5a5; color: white;} }
                
                .cb-question { font-size: 18px; font-weight: 800; margin-bottom: 10px; line-height: 1.4; color: var(--text-dark); text-align: center;}
                .cb-question.is-gold { color: #f5a623; } 
                
                /* Toolbar xoay khối */
                .cb-rotate-toolbar { display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px; align-items: center; }
                .cb-rotate-btn { background: var(--bg-main); color: var(--text-dark); border: 1px solid var(--border-line); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: 0.2s;}
                .cb-rotate-btn:hover:not(:disabled) { background: var(--border-line); }
                .cb-rotate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .cb-rotate-count { font-size: 12px; font-weight: bold; color: var(--text-muted); }

                /* Sân khấu 3D */
                .cb-canvas-box { width: 100%; height: 180px; border-radius: var(--radius-main); margin-bottom: 20px; position: relative; display: flex; justify-content: center; align-items: center; overflow: visible; }
                .cb-iso-scene { position: relative; width: 0; height: 0; }
                .cb-cube { position: absolute; transform: translate(-50%, -50%); transition: transform 0.3s, left 0.3s, top 0.3s; filter: drop-shadow(0px 6px 4px rgba(0,0,0,0.15)); }
                
                /* Đổ màu Khối thường */
                .cb-cube svg path.face-top { fill: #e2e8f0; } .cb-cube svg path.face-left { fill: #cbd5e0; } .cb-cube svg path.face-right { fill: #a0aec0; }
                [data-theme="dark"] .cb-cube svg path.face-top { fill: #4a5568; } [data-theme="dark"] .cb-cube svg path.face-left { fill: #2d3748; } [data-theme="dark"] .cb-cube svg path.face-right { fill: #1a202c; }

                /* Khối vàng */
                .cb-cube.is-gold svg path.face-top { fill: #fbd38d !important; } .cb-cube.is-gold svg path.face-left { fill: #ed8936 !important; } .cb-cube.is-gold svg path.face-right { fill: #dd6b20 !important; }
                
                /* Khối Bộc phá (Bom) */
                .cb-cube.is-bomb { animation: bombPulse 0.4s infinite alternate; }
                .cb-cube.is-bomb svg path.face-top { fill: #fc8181 !important; } .cb-cube.is-bomb svg path.face-left { fill: #e53e3e !important; } .cb-cube.is-bomb svg path.face-right { fill: #c53030 !important; }
                @keyframes bombPulse { 0% { filter: drop-shadow(0 0 15px rgba(229,62,62,0.8)); transform: translate(-50%, -50%) scale(1); } 100% { filter: drop-shadow(0 0 5px rgba(229,62,62,0.3)); transform: translate(-50%, -50%) scale(0.95); } }
                
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .cb-btn-gold { border: 2px solid #f5a623; color: #f5a623; background-color: var(--bg-card); }
                @media (hover: hover) { .cb-btn-gold:hover { background-color: #f5a623; color: #fff; } }
            </style>

            <div class="cb-wrapper" id="cb-wrapper">
                <div id="cb-menu-screen" class="cb-screen active">
                    <h1 style="font-size: 32px; margin-bottom: 10px; color: var(--text-dark); text-align:center;">CUBIC BỘC PHÁ</h1>
                    <p style="color: var(--text-muted); margin-bottom: 30px; font-size: 14px; line-height: 1.6; text-align: center;">
                        <span style="color: #ef4444; font-weight: bold;">[MỚI]</span> Khối Đỏ: Sẽ gây nổ xáo trộn nếu không trả lời kịp!<br>
                        Sử dụng <b>Nút Xoay Lưới</b> để nhìn các góc chết.
                    </p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">VÀO NHẬN THỬ THÁCH</button>
                </div>

                <div id="cb-game-area" class="cb-screen">
                    <div class="cb-header">
                        <div>MÀN: <span id="cb-level" style="color: var(--text-dark);">1</span></div>
                        <div class="cb-score-text">ĐIỂM: <span id="cb-score">0</span></div>
                        <div>MẠNG: <span id="cb-lives">3</span></div>
                    </div>
                    
                    <div class="cb-timer-bar"><div id="cb-timer-fill" class="cb-timer-fill"></div></div>
                    
                    <div class="cb-bomb-warning" id="cb-bomb-warning">
                        <span>⚠️ KHỐI BỘC PHÁ ĐANG KÍCH HOẠT!</span>
                        <span id="cb-bomb-time-text">0.0s</span>
                    </div>

                    <div class="cb-question" id="cb-question-text">---</div>
                    
                    <!-- Toolbar Xoay -->
                    <div class="cb-rotate-toolbar">
                        <button class="cb-rotate-btn" id="btn-rot-left" onclick="window.CurrentGame.rotateView('left')">↺ Xoay Trái</button>
                        <span class="cb-rotate-count">Lượt xoay: <span id="cb-rot-val">2</span></span>
                        <button class="cb-rotate-btn" id="btn-rot-right" onclick="window.CurrentGame.rotateView('right')">Xoay Phải ↻</button>
                    </div>

                    <div class="cb-canvas-box">
                        <div class="cb-iso-scene" id="cb-scene"></div>
                    </div>

                    <div class="cb-grid" id="cb-buttons"></div>
                </div>

                <div id="cb-gameover-screen" class="cb-screen">
                    <h2 style="color: var(--primary-color); font-size: 36px; margin-bottom: 10px;">KẾT THÚC</h2>
                    <p style="color: var(--text-muted); font-size: 18px; margin-bottom: 30px;">Tổng điểm: <strong id="cb-final-score" style="color: var(--text-dark); font-size: 28px;">0</strong></p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">CHƠI LẠI TỪ ĐẦU</button>
                </div>
            </div>
        `;
    },

    // 4. LUỒNG TRÒ CHƠI
    startGame: function() {
        this.state.score = 0; this.state.level = 1; this.state.lives = 3;
        this.state.isPlaying = true; this.state.isTransitioning = false;
        
        document.getElementById('cb-menu-screen').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.remove('active');
        document.getElementById('cb-game-area').classList.add('active');
        
        this.nextRound();
    },

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        
        // Reset giới hạn xoay mỗi màn bằng số lượng bạn config
        this.state.rotationsLeft = this.config.maxRotations; 
        
        this.generateCubesForLevel();
        this.renderScene();
        this.generateQuestionAndOptions();
        this.updateUI();

        // Chạy giờ tổng
        this.startTimer(this.config.defaultLevelTime); 
        
        // Nếu có bom, khởi động hệ thống nổ riêng biệt
        if (this.state.isBombRound) {
            this.startBombTimer(this.config.defaultBombTime);
        } else {
            document.getElementById('cb-bomb-warning').style.display = 'none';
        }
    },

    // CHỨC NĂNG MỚI: Xoay góc nhìn Không Gian
    rotateView: function(direction) {
        if (this.state.rotationsLeft <= 0 || !this.state.isPlaying || this.state.isTransitioning) return;
        
        this.state.rotationsLeft--;
        this.playWoodenSound('rotate');
        
        // Công thức Toán học Vector quay 90 độ trục Z
        this.state.cubes.forEach(c => {
            let tempX = c.x;
            if (direction === 'left') { c.x = c.y; c.y = -tempX; }
            else { c.x = -c.y; c.y = tempX; }
        });
        
        // Re-sort chiều sâu vẽ đè
        this.state.cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
        this.renderScene();
        this.updateUI();
    },

    generateCubesForLevel: function() {
        this.state.cubes = [];
        const lvl = this.state.level;
        let cubeCount = (lvl <= 3) ? (Math.floor(Math.random() * 3) + 3) : 
                        (lvl <= 6) ? (Math.floor(Math.random() * 5) + 8) : 
                                     (Math.floor(Math.random() * 6) + 13);

        let occupied = new Set();
        const getKey = (x, y, z) => `${x},${y},${z}`;
        
        this.state.cubes.push({ x: 0, y: 0, z: 0, isGold: false, isBomb: false });
        occupied.add(getKey(0, 0, 0));

        while (this.state.cubes.length < cubeCount) {
            let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
            const dirs = [{dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 0, dz: 1}];
            let dir = dirs[Math.floor(Math.random() * dirs.length)];
            let nx = baseCube.x + dir.dx, ny = baseCube.y + dir.dy, nz = baseCube.z + dir.dz;
            
            let nKey = getKey(nx, ny, nz);
            if (!occupied.has(nKey) && (nz === 0 || occupied.has(getKey(nx, ny, nz - 1)))) {
                this.state.cubes.push({ x: nx, y: ny, z: nz, isGold: false, isBomb: false });
                occupied.add(nKey);
            }
        }

        this.state.isGoldenRound = false;
        this.state.isBombRound = false;

        // Sinh khối đặc biệt
        if (Math.random() < 0.25) { 
            this.state.isGoldenRound = true;
            this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)].isGold = true;
        } 
        else if (lvl >= 4 && Math.random() < 0.4) { // Level 4 trở lên mới có Bộc phá, tỷ lệ 40%
            this.state.isBombRound = true;
            let normalCubes = this.state.cubes.filter(c => !c.isGold);
            if(normalCubes.length > 0) normalCubes[Math.floor(Math.random() * normalCubes.length)].isBomb = true;
        }

        this.state.cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
    },

    renderScene: function() {
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.innerHTML = '';
        const tileW = 44, tileH = 24, zHeight = 26; 
        
        this.state.cubes.forEach(c => {
            let screenX = (c.x - c.y) * (tileW / 2);
            let screenY = (c.x + c.y) * (tileH / 2) - (c.z * zHeight);

            let svgCube = document.createElement('div');
            let specialClass = c.isGold ? 'is-gold' : (c.isBomb ? 'is-bomb' : '');
            svgCube.className = `cb-cube ${specialClass}`;
            svgCube.style.left = `${screenX}px`; svgCube.style.top = `${screenY}px`;
            
            svgCube.innerHTML = `
                <svg viewBox="0 0 100 115" width="${tileW}" height="50">
                    <path class="face-top" d="M50 0 L100 28 L50 56 L0 28 Z"/>
                    <path class="face-left" d="M0 28 L50 56 L50 115 L0 87 Z"/>
                    <path class="face-right" d="M100 28 L50 56 L50 115 L100 87 Z"/>
                </svg>
            `;
            sceneEl.appendChild(svgCube);
        });
    },

    generateQuestionAndOptions: function() {
        const lvl = this.state.level;
        let qType = this.state.isGoldenRound ? 'GOLD' : [1, (lvl>=4?2:1), (lvl>=8?3:1)][Math.floor(Math.random() * 3)];
        let ans = 0, qText = "";

        if (qType === 1) { qText = "Có TỔNG CỘNG bao nhiêu khối?"; ans = this.state.cubes.length; } 
        else if (qType === 2) { qText = "Có bao nhiêu khối CHẠM MẶT ĐẤT?"; ans = this.state.cubes.filter(c => c.z === 0).length; } 
        else if (qType === 3) { 
            qText = "Có bao nhiêu khối BỊ KHỐI KHÁC ĐÈ LÊN?";
            let cSet = new Set(this.state.cubes.map(c => `${c.x},${c.y},${c.z}`));
            ans = this.state.cubes.filter(c => cSet.has(`${c.x},${c.y},${c.z + 1}`)).length;
        } 
        else if (qType === 'GOLD') {
            qText = "Khối Vàng CHẠM MẶT với bao nhiêu khối?";
            let gc = this.state.cubes.find(c => c.isGold);
            ans = this.state.cubes.filter(c => !c.isGold && (Math.abs(c.x-gc.x)+Math.abs(c.y-gc.y)+Math.abs(c.z-gc.z) === 1)).length;
        }

        this.state.correctAnswer = ans;
        
        const qEl = document.getElementById('cb-question-text');
        qEl.innerText = qText;
        if(this.state.isGoldenRound) qEl.classList.add('is-gold'); else qEl.classList.remove('is-gold');

        let opts = new Set([ans]);
        while(opts.size < 4) { let f = ans + Math.floor(Math.random()*5)-2; if (f > 0 && f !== ans) opts.add(f); }
        let arrOpts = Array.from(opts).sort(() => Math.random() - 0.5);

        const btnBox = document.getElementById('cb-buttons');
        btnBox.innerHTML = '';
        arrOpts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = `btn-flat ${qType === 'GOLD' ? 'cb-btn-gold' : ''}`;
            
            if(qType !== 'GOLD') btn.style.backgroundColor = 'var(--bg-card)';
            if(qType !== 'GOLD') btn.style.color = 'var(--text-dark)';
            if(qType !== 'GOLD') btn.style.border = '2px solid var(--border-line)';
            
            btn.innerText = opt;
            btn.onclick = () => this.handleChoice(opt);
            btnBox.appendChild(btn);
        });
    },

    handleChoice: function(selected) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        this.state.isTransitioning = true;
        
        clearInterval(this.state.timerInterval);
        clearInterval(this.state.bombInterval);

        if (selected === this.state.correctAnswer) {
            this.state.score += (10 + this.state.level) * (this.state.isGoldenRound ? 2 : 1);
            this.state.level++;
            if (this.state.isGoldenRound) this.playWoodenSound('gold_correct');
            else this.playWoodenSound('correct');
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

    // BỘ THỜI GIAN CỦA BOM ĐỎ (Chạy độc lập)
    startBombTimer: function(dur) {
        clearInterval(this.state.bombInterval);
        this.state.bombTimeLeft = dur;
        const tick = 100;
        const warningUI = document.getElementById('cb-bomb-warning');
        const timeText = document.getElementById('cb-bomb-time-text');
        
        warningUI.style.display = 'flex';

        this.state.bombInterval = setInterval(() => {
            if(this.state.isTransitioning) return; // Dừng bom khi đang nháy chuyển cảnh
            
            this.state.bombTimeLeft -= tick;
            timeText.innerText = (this.state.bombTimeLeft / 1000).toFixed(1) + "s";
            
            // Kêu tíc tíc mỗi giây cuối
            if (this.state.bombTimeLeft <= 2000 && this.state.bombTimeLeft % 500 === 0) {
                this.playWoodenSound('bomb_tick');
            }

            if (this.state.bombTimeLeft <= 0) {
                clearInterval(this.state.bombInterval);
                this.triggerBombExplosion();
            }
        }, tick);
    },

    // LOGIC KHI BOM NỔ XÁO TRỘN CỤM KHỐI
    triggerBombExplosion: function() {
        if(this.state.isTransitioning) return;
        this.playWoodenSound('explosion');
        
        document.getElementById('cb-bomb-warning').style.display = 'none';
        
        // Phạt trừ thẳng thời gian vào thanh Timer chính
        this.state.timeLeft -= this.config.penaltyTime;
        if(this.state.timeLeft < 0) this.state.timeLeft = 0; 
        
        // Nháy đỏ màn hình báo hiệu
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.style.transform = 'scale(1.1)';
        sceneEl.style.filter = 'sepia(1) hue-rotate(300deg) saturate(3)'; // Hiệu ứng bốc lửa
        
        setTimeout(() => {
            sceneEl.style.transform = 'scale(1)';
            sceneEl.style.filter = 'none';
            
            // Hủy bom, sinh lại bố cục khối hoàn toàn mới để đánh lừa
            this.state.isBombRound = false;
            this.generateCubesForLevel();
            this.renderScene();
            this.generateQuestionAndOptions(); // Sinh đáp án mới theo bố cục mới
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
                clearInterval(this.state.bombInterval); // Chết thì dừng bom luôn
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
        
        // Quản lý trạng thái Mờ/Hiện của Nút xoay
        document.getElementById('cb-rot-val').innerText = this.state.rotationsLeft;
        const disableRot = (this.state.rotationsLeft <= 0);
        document.getElementById('btn-rot-left').disabled = disableRot;
        document.getElementById('btn-rot-right').disabled = disableRot;
    },

    gameOver: function() {
        this.state.isPlaying = false;
        clearInterval(this.state.timerInterval);
        clearInterval(this.state.bombInterval);
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
        if (this.state.bombInterval) clearInterval(this.state.bombInterval);
        if (this.state.audioCtx && this.state.audioCtx.state !== 'closed') this.state.audioCtx.suspend();
        this.state.isPlaying = false;
    }
};
