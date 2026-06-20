/**
 * TÊN FILE: games/cubic-logic.js
 * GAME: CUBIC & LOGIC (Đếm Khối Không Gian)
 * BẢN CẬP NHẬT: Tích hợp 100% Theme Hệ Thống + Tối ưu Âm Thanh Gỗ Tích Cực
 */

window.CurrentGame = {
    // 1. TRẠNG THÁI TRÒ CHƠI
    state: {
        score: 0, level: 1, lives: 3, timeLeft: 0, timerInterval: null,
        isPlaying: false, isTransitioning: false,
        cubes: [], correctAnswer: 0, isGoldenRound: false,
        audioCtx: null 
    },

    // 2. BỘ TẠO ÂM THANH GỖ (ĐÃ SỬA LẠI TẦN SỐ ĐỂ TẠO CẢM GIÁC CHIẾN THẮNG)
    playWoodenSound: function(type) {
        if (!this.state.audioCtx) this.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.state.audioCtx.state === 'suspended') this.state.audioCtx.resume();
        
        const osc = this.state.audioCtx.createOscillator();
        const gain = this.state.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.state.audioCtx.destination);
        const now = this.state.audioCtx.currentTime;

        if (type === 'tick') { 
            // Tiếng gõ bắt đầu (Nhẹ nhàng)
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } 
        else if (type === 'correct') { 
            // BẢN SỬA: Sóng âm TĂNG DẦN (500Hz -> 800Hz) tạo cảm giác vui vẻ, ăn điểm
            osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } 
        else if (type === 'error') { 
            // Sóng âm HẠ DẦN tạo cảm giác sai/hết mạng
            osc.type = 'triangle'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
            gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        }
        else if (type === 'start') { 
            // Chuông chuỗi (Arpeggio)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now); osc.frequency.setValueAtTime(600, now + 0.1); osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        }
        else if (type === 'gold_appear') { 
            // Vang sáng
            osc.type = 'triangle'; osc.frequency.setValueAtTime(1200, now);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
        else if (type === 'gold_correct') { 
            // Tít tít kép âm cao (Double Score)
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1000, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
    },

    // 3. KHỞI TẠO GAME VÀ GIAO DIỆN (Tuyệt đối tuân thủ biến hệ thống của bạn)
    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        container.innerHTML = `
            <style>
                .cb-wrapper, .cb-wrapper * { box-sizing: border-box; }
                
                /* Kế thừa giao diện thẻ chứa từ Lộc */
                .cb-wrapper {
                    width: 100%; height: 100%; padding: 20px;
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    color: var(--text-dark); user-select: none;
                }
                
                .cb-screen { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 500px;}
                .cb-screen.active { display: flex; }
                
                /* Tiêu đề & Thông số chơi */
                .cb-header { display: flex; justify-content: space-between; font-weight: 800; margin-bottom: 15px; font-size: 14px; width: 100%; color: var(--text-muted); }
                .cb-score-text { color: var(--primary-color); font-size: 16px;}
                
                /* Thanh Timer */
                .cb-timer-bar { width: 100%; height: 6px; background: var(--border-line); border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
                .cb-timer-fill { height: 100%; background: var(--primary-color); width: 100%; transition: width 0.05s linear; }
                
                /* Câu hỏi */
                .cb-question { font-size: 18px; font-weight: 800; margin-bottom: 15px; line-height: 1.4; color: var(--text-dark); text-align: center;}
                .cb-question.is-gold { color: #f5a623; } /* Cố định màu vàng cam cho câu hỏi khối vàng */
                
                /* Sân khấu 3D */
                .cb-canvas-box {
                    width: 100%; height: 220px; border-radius: var(--radius-main); margin-bottom: 25px;
                    position: relative; display: flex; justify-content: center; align-items: center; overflow: visible;
                }
                .cb-iso-scene { position: relative; width: 0; height: 0; }
                .cb-cube { position: absolute; transform: translate(-50%, -50%); transition: transform 0.3s; filter: drop-shadow(0px 8px 4px rgba(0,0,0,0.15)); }
                
                /* ĐIỂU KHIỂN MÀU CỦA KHỐI 3D BẰNG BIẾN HỆ THỐNG THEME */
                .cb-cube svg path.face-top { fill: #e2e8f0; transition: fill 0.3s ease;}
                .cb-cube svg path.face-left { fill: #cbd5e0; transition: fill 0.3s ease;}
                .cb-cube svg path.face-right { fill: #a0aec0; transition: fill 0.3s ease;}

                [data-theme="dark"] .cb-cube svg path.face-top { fill: #4a5568; }
                [data-theme="dark"] .cb-cube svg path.face-left { fill: #2d3748; }
                [data-theme="dark"] .cb-cube svg path.face-right { fill: #1a202c; }

                /* Màu khối vàng */
                .cb-cube.is-gold svg path.face-top { fill: #fbd38d !important; }
                .cb-cube.is-gold svg path.face-left { fill: #ed8936 !important; }
                .cb-cube.is-gold svg path.face-right { fill: #dd6b20 !important; }
                
                /* Bố cục nút bấm (Không can thiệp vào background/hover của hệ thống) */
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                
                /* Tái sử dụng .btn-flat của bạn. Chỉ sửa đổi cho khối vàng bằng viền bọc, không chạm vào màu nền */
                .cb-btn-gold { border: 2px solid #f5a623; color: #f5a623; background-color: var(--bg-card); }
                /* Hủy hiệu ứng hover nền tĩnh trên điện thoại gây dính kẹt */
                @media (hover: hover) { .cb-btn-gold:hover { background-color: #f5a623; color: #fff; } }
            </style>

            <div class="cb-wrapper" id="cb-wrapper">
                
                <!-- MENU BẮT ĐẦU -->
                <div id="cb-menu-screen" class="cb-screen active">
                    <h1 style="font-size: 32px; margin-bottom: 10px; color: var(--text-dark);">Đếm Khối Không Gian</h1>
                    <p style="color: var(--text-muted); margin-bottom: 30px; font-size: 15px; line-height: 1.6; text-align: center;">
                        Kiểm tra tư duy Không gian 3D.<br>
                        Giao diện có thể đánh lừa thị giác của bạn.<br>
                        <span style="color: #f5a623; font-weight: bold;">(Khối Vàng = Nhân Đôi Điểm)</span>
                    </p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">BẮT ĐẦU NGAY</button>
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
                    <h2 style="color: var(--primary-color); font-size: 36px; margin-bottom: 10px;">KẾT THÚC</h2>
                    <p style="color: var(--text-muted); font-size: 18px; margin-bottom: 30px;">Tổng điểm: <strong id="cb-final-score" style="color: var(--text-dark); font-size: 28px;">0</strong></p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">CHƠI LẠI TỪ ĐẦU</button>
                </div>

            </div>
        `;
    },

    // 4. LUỒNG TRÒ CHƠI 
    startGame: function() {
        this.playWoodenSound('start'); 
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
            setTimeout(() => this.playWoodenSound('gold_appear'), 100); 
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
            // Bản sửa: Gắn class is-gold thay vì code cứng màu vào Javascript
            svgCube.className = `cb-cube ${c.isGold ? 'is-gold' : ''}`;
            svgCube.style.left = `${screenX}px`; svgCube.style.top = `${screenY}px`;
            
            // Render giao diện thông qua class CSS, tách bạch UI và Logic
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
            // Tuyệt đối sử dụng class .btn-flat của file style.css
            btn.className = `btn-flat ${qType === 'GOLD' ? 'cb-btn-gold' : ''}`;
            
            // Xóa màu trắng mặc định nếu không phải khối vàng (để nút Flat lấy màu biến hệ thống)
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
