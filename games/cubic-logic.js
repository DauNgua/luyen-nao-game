/**
 * TÊN FILE: games/cubic-logic.js
 * GAME: CUBIC & LOGIC (Đếm Khối Không Gian) - GIAO DIỆN ĐỒNG BỘ THEME + MỞ RỘNG ÂM THANH
 */

window.CurrentGame = {
    // 1. TRẠNG THÁI TRÒ CHƠI
    state: {
        score: 0, level: 1, lives: 3, timeLeft: 0, timerInterval: null,
        isPlaying: false, isTransitioning: false,
        cubes: [], correctAnswer: 0, isGoldenRound: false,
        audioCtx: null 
    },

    // 2. BỘ TẠO ÂM THANH GỖ (MỞ RỘNG)
    playWoodenSound: function(type) {
        if (!this.state.audioCtx) this.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.state.audioCtx.state === 'suspended') this.state.audioCtx.resume();
        
        const osc = this.state.audioCtx.createOscillator();
        const gain = this.state.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.state.audioCtx.destination);
        const now = this.state.audioCtx.currentTime;

        // Mô phỏng tiếng gỗ: Sóng sine/triangle kết hợp giảm âm lượng đột ngột (exponentialRamp)
        if (type === 'tick') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } 
        else if (type === 'correct') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        } 
        else if (type === 'error') { 
            osc.type = 'triangle'; osc.frequency.setValueAtTime(250, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
        else if (type === 'start') { // Âm thanh mộc bản chuỗi tăng dần
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        }
        else if (type === 'gold_appear') { // Tiếng gõ sáng, vang khi Khối Vàng xuất hiện
            osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now);
            gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
        else if (type === 'gold_correct') { // Tiếng gõ đôi ăn điểm nhân 2
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1000, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
        else if (type === 'gameover') { // Cộc.. cộc.. trầm buồn
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(200, now); osc.frequency.setValueAtTime(150, now + 0.2);
            gain.gain.setValueAtTime(0.6, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
            osc.start(now); osc.stop(now + 0.5);
        }
    },

    // 3. KHỞI TẠO GAME VÀ GIAO DIỆN (Sử dụng 100% biến CSS từ hệ thống)
    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        container.innerHTML = `
            <style>
                .cb-wrapper, .cb-wrapper * { box-sizing: border-box; }
                
                /* Kế thừa hoàn toàn từ thẻ game-canvas tổng, nên để nền trong suốt */
                .cb-wrapper {
                    width: 100%; height: 100%; padding: 25px 15px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: var(--text-dark); user-select: none;
                }
                
                /* Layout */
                .cb-screen { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 500px;}
                .cb-screen.active { display: flex; }
                
                /* Khối Header UI */
                .cb-header { display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 15px; font-size: 14px; width: 100%; color: var(--text-muted); }
                .cb-score-text { color: var(--primary-color); font-size: 16px;}
                
                /* Thanh Timer chuẩn hệ thống */
                .cb-timer-bar { width: 100%; height: 6px; background: var(--border-line); border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
                .cb-timer-fill { height: 100%; background: var(--primary-color); width: 100%; transition: width 0.05s linear; }
                
                /* Tiêu đề câu hỏi */
                .cb-question { font-size: 18px; font-weight: 800; margin-bottom: 15px; line-height: 1.4; color: var(--text-dark); text-align: center;}
                
                /* Sân khấu 3D */
                .cb-canvas-box {
                    width: 100%; height: 220px; border-radius: var(--radius-main); margin-bottom: 25px;
                    position: relative; display: flex; justify-content: center; align-items: center; overflow: visible;
                }
                .cb-iso-scene { position: relative; width: 0; height: 0; }
                .cb-cube { position: absolute; transform: translate(-50%, -50%); transition: transform 0.3s; filter: drop-shadow(0px 8px 4px rgba(0,0,0,0.15)); }
                
                /* Nút trắc nghiệm đồng bộ Theme */
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                .cb-wrapper .btn-flat {
                    background: var(--bg-card); color: var(--text-dark); 
                    border: 2px solid var(--border-line); padding: 15px; font-size: 20px; font-weight: 800;
                    border-radius: var(--radius-main); cursor: pointer; transition: all 0.2s; outline: none;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                }
                .cb-wrapper .btn-flat:hover { 
                    background: var(--primary-color); color: #fff; border-color: var(--primary-color); 
                    transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.1);
                }
                .cb-wrapper .btn-flat:active { transform: translateY(0); }
                
                /* Style cho nút Khối Vàng */
                .cb-btn-gold { border-color: #f5a623 !important; color: #f5a623 !important; }
                .cb-btn-gold:hover { background: #f5a623 !important; color: #fff !important; }
            </style>

            <div class="cb-wrapper" id="cb-wrapper">
                
                <!-- MENU BẮT ĐẦU -->
                <div id="cb-menu-screen" class="cb-screen active">
                    <h1 style="font-size: 32px; margin-bottom: 10px; color: var(--text-dark);">Đếm Khối & Tìm Từ</h1>
                    <p style="color: var(--text-muted); margin-bottom: 30px; font-size: 15px; line-height: 1.6; text-align: center;">
                        Đọc kỹ yêu cầu và đếm số khối trên màn hình.<br>
                        Giao diện có thể đánh lừa thị giác của bạn.<br>
                        <span style="color: #f5a623; font-weight: bold;">(Khối Vàng = Nhân Đôi Điểm)</span>
                    </p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()" style="background: var(--primary-color); color: white; border:none;">BẮT ĐẦU CHƠI</button>
                </div>

                <!-- KHU VỰC CHƠI -->
                <div id="cb-game-area" class="cb-screen">
                    <div class="cb-header">
                        <div>MÀN: <span id="cb-level" style="color: var(--text-dark);">1</span></div>
                        <div class="cb-score-text">ĐIỂM: <span id="cb-score">0</span></div>
                        <div>MẠNG: <span id="cb-lives">3</span></div>
                    </div>
                    
                    <div class="cb-timer-bar"><div id="cb-timer-fill" class="cb-timer-fill"></div></div>
                    
                    <div class="cb-question" id="cb-question-text">---</div>
                    
                    <div class="cb-canvas-box">
                        <div class="cb-iso-scene" id="cb-scene"></div>
                    </div>

                    <div class="cb-grid" id="cb-buttons"></div>
                </div>

                <!-- GAME OVER -->
                <div id="cb-gameover-screen" class="cb-screen">
                    <h2 style="color: var(--primary-color); font-size: 36px; margin-bottom: 10px;">HẾT MẠNG</h2>
                    <p style="color: var(--text-muted); font-size: 18px; margin-bottom: 30px;">Tổng điểm: <strong id="cb-final-score" style="color: var(--text-dark); font-size: 28px;">0</strong></p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">CHƠI LẠI TỪ ĐẦU</button>
                </div>

            </div>
        `;
    },

    // 4. LUỒNG TRÒ CHƠI 
    startGame: function() {
        this.playWoodenSound('start'); // Âm thanh chào mừng
        this.state.score = 0; this.state.level = 1; this.state.lives = 3;
        this.state.isPlaying = true; this.state.isTransitioning = false;
        
        document.getElementById('cb-menu-screen').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.remove('active');
        document.getElementById('cb-game-area').classList.add('active');
        
        this.updateUI();
        this.nextRound();
    },

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        this.updateUI();
        
        this.generateCubesForLevel();
        this.renderScene();
        this.generateQuestionAndOptions();
        this.startTimer(15000); 
    },

    generateCubesForLevel: function() {
        this.state.cubes = [];
        const lvl = this.state.level;
        let cubeCount = (lvl <= 3) ? (Math.floor(Math.random() * 3) + 3) : 
                        (lvl <= 7) ? (Math.floor(Math.random() * 5) + 8) : 
                                     (Math.floor(Math.random() * 6) + 13);

        let occupied = new Set();
        const getKey = (x, y, z) => `${x},${y},${z}`;
        
        this.state.cubes.push({ x: 0, y: 0, z: 0, isGold: false });
        occupied.add(getKey(0, 0, 0));

        while (this.state.cubes.length < cubeCount) {
            let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
            const dirs = [{dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 0, dz: 1}];
            let dir = dirs[Math.floor(Math.random() * dirs.length)];
            let nx = baseCube.x + dir.dx, ny = baseCube.y + dir.dy, nz = baseCube.z + dir.dz;
            
            let nKey = getKey(nx, ny, nz);
            if (!occupied.has(nKey) && (nz === 0 || occupied.has(getKey(nx, ny, nz - 1)))) {
                this.state.cubes.push({ x: nx, y: ny, z: nz, isGold: false });
                occupied.add(nKey);
            }
        }

        this.state.isGoldenRound = false;
        if (Math.random() < 0.25) { 
            this.state.isGoldenRound = true;
            this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)].isGold = true;
            setTimeout(() => this.playWoodenSound('gold_appear'), 100); // Kêu cộc khi khối vàng rơi xuống
        }

        this.state.cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
    },

    renderScene: function() {
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.innerHTML = '';
        
        const tileW = 44, tileH = 24, zHeight = 26; 

        // Nhận diện Theme sáng tối để vẽ màu mảng tối của SVG
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        
        this.state.cubes.forEach(c => {
            let screenX = (c.x - c.y) * (tileW / 2);
            let screenY = (c.x + c.y) * (tileH / 2) - (c.z * zHeight);
            
            // Phối màu hòa hợp với UI Light/Dark
            let colorTop = c.isGold ? '#fbd38d' : (isDark ? '#4a5568' : '#e2e8f0'); 
            let colorLeft = c.isGold ? '#ed8936' : (isDark ? '#2d3748' : '#cbd5e0');
            let colorRight = c.isGold ? '#dd6b20' : (isDark ? '#1a202c' : '#a0aec0');

            let svgCube = document.createElement('div');
            svgCube.className = 'cb-cube';
            svgCube.style.left = `${screenX}px`; svgCube.style.top = `${screenY}px`;
            
            svgCube.innerHTML = `
                <svg viewBox="0 0 100 115" width="${tileW}" height="50">
                    <path d="M50 0 L100 28 L50 56 L0 28 Z" fill="${colorTop}"/>
                    <path d="M0 28 L50 56 L50 115 L0 87 Z" fill="${colorLeft}"/>
                    <path d="M100 28 L50 56 L50 115 L100 87 Z" fill="${colorRight}"/>
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
            qText = "Khối Vàng CHẠM vào bao nhiêu khối xám?";
            let gc = this.state.cubes.find(c => c.isGold);
            ans = this.state.cubes.filter(c => !c.isGold && (Math.abs(c.x-gc.x)+Math.abs(c.y-gc.y)+Math.abs(c.z-gc.z) === 1)).length;
        }

        this.state.correctAnswer = ans;
        document.getElementById('cb-question-text').innerText = qText;
        if(this.state.isGoldenRound) document.getElementById('cb-question-text').style.color = '#f5a623';
        else document.getElementById('cb-question-text').style.color = 'var(--text-dark)';

        let opts = new Set([ans]);
        while(opts.size < 4) { let f = ans + Math.floor(Math.random()*5)-2; if (f >= 0 && f !== ans) opts.add(f); }
        let arrOpts = Array.from(opts).sort(() => Math.random() - 0.5);

        const btnBox = document.getElementById('cb-buttons');
        btnBox.innerHTML = '';
        arrOpts.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn-flat';
            if (qType === 'GOLD') btn.classList.add('cb-btn-gold');
            btn.innerText = opt;
            btn.onclick = () => this.handleChoice(opt);
            btnBox.appendChild(btn);
        });
    },

    handleChoice: function(selected) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        this.state.isTransitioning = true;
        clearInterval(this.state.timerInterval);

        if (selected === this.state.correctAnswer) {
            this.state.score += (10 + this.state.level) * (this.state.isGoldenRound ? 2 : 1);
            this.state.level++;
            // Chơi âm thanh khác nhau nếu là khối vàng
            if (this.state.isGoldenRound) this.playWoodenSound('gold_correct');
            else this.playWoodenSound('correct');
        } else {
            this.playWoodenSound('error');
            this.state.lives--;
        }

        // Tạm mờ sân khấu tạo hiệu ứng chuyển cảnh mềm mại
        document.getElementById('cb-game-area').style.opacity = '0.5';
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
            this.state.timeLeft -= tick;
            if(fill) fill.style.width = `${(this.state.timeLeft/dur)*100}%`;

            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timerInterval);
                if(fill) fill.style.width = `0%`;
                
                if (!this.state.isTransitioning) {
                    this.state.isTransitioning = true;
                    this.playWoodenSound('error');
                    this.state.lives--; 
                    setTimeout(() => { this.state.isTransitioning = false; this.nextRound(); }, 300);
                }
            }
        }, tick);
    },

    updateUI: function() {
        document.getElementById('cb-level').innerText = this.state.level;
        document.getElementById('cb-score').innerText = this.state.score;
        document.getElementById('cb-lives').innerText = '❤️'.repeat(Math.max(0, this.state.lives));
    },

    gameOver: function() {
        this.state.isPlaying = false;
        clearInterval(this.state.timerInterval);
        this.playWoodenSound('gameover');
        
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
