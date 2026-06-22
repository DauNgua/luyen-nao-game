/**
 * TÊN FILE: games/cubic-logic.js
 * CẬP NHẬT: Xóa Bom. Thêm Hệ thống Tư duy Không gian chuyên sâu (Mặt cắt, Tiếp xúc, Diện tích mặt, Lõi rỗng).
 * Scaling: Khối lượng hình học to dần theo Level.
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
        cubeIdCounter: 0
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
                
                .cb-question { font-size: 18px; font-weight: 800; margin-bottom: 10px; line-height: 1.4; color: var(--text-dark); text-align: center;}
                
                .cb-rotate-toolbar { display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px; align-items: center; }
                .cb-rotate-btn { background: var(--bg-main); color: var(--text-dark); border: 1px solid var(--border-line); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: 0.2s;}
                .cb-rotate-btn:hover:not(:disabled) { background: var(--border-line); }
                .cb-rotate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .cb-rotate-count { font-size: 12px; font-weight: bold; color: var(--text-muted); }

                /* 3D ENGINE */
                .cb-canvas-box { width: 100%; height: 180px; border-radius: var(--radius-main); margin-bottom: 20px; position: relative; display: flex; justify-content: center; align-items: center; overflow: visible; perspective: 1200px; }
                .cb-iso-scene { position: relative; width: 0; height: 0; transform-style: preserve-3d; transform: rotateX(60deg) rotateZ(var(--scene-z, 45deg)); transition: transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1); }
                
                .cb-cube-3d { position: absolute; width: 32px; height: 32px; margin-left: -16px; margin-top: -16px; transform-style: preserve-3d; }
                .cb-face { position: absolute; width: 32px; height: 32px; box-sizing: border-box; border: 1px solid rgba(0,0,0,0.15); backface-visibility: hidden; }
                [data-theme="dark"] .cb-face { border-color: rgba(0,0,0,0.5); }
                
                .f-t { transform: translateZ(16px); background: #e2e8f0; } .f-b { transform: rotateX(180deg) translateZ(16px); background: #94a3b8; } .f-r { transform: rotateY(90deg) translateZ(16px); background: #cbd5e0; } .f-l { transform: rotateY(-90deg) translateZ(16px); background: #a0aec0; } .f-fr { transform: rotateX(90deg) translateZ(16px); background: #cbd5e0; } .f-bk { transform: rotateX(-90deg) translateZ(16px); background: #a0aec0; }
                [data-theme="dark"] .f-t { background: #4a5568; } [data-theme="dark"] .f-r, [data-theme="dark"] .f-fr { background: #2d3748; } [data-theme="dark"] .f-l, [data-theme="dark"] .f-bk { background: #1a202c; }
                
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                
                .cb-rules-box { background: var(--bg-main); border: 1px solid var(--border-line); border-radius: var(--radius-main); padding: 15px; width: 100%; text-align: left; margin-bottom: 25px; }
                .cb-rules-box ul { padding-left: 20px; font-size: 13px; color: var(--text-muted); line-height: 1.6; margin-bottom: 10px; }
                .cb-rules-box li { margin-bottom: 4px; }
                .cb-rules-title { font-weight: 800; font-size: 14px; margin-bottom: 8px; color: var(--text-dark); }
                .cb-rules-title.alert { color: var(--primary-color); }

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
                            <li><b>Màn 1-14:</b> Đếm số lượng khối kết hợp tưởng tượng bề mặt.</li>
                            <li><b>Màn 15+:</b> Phân tích mật độ tiếp xúc mặt (Adjacency).</li>
                            <li><b>Màn 19+:</b> Cắt lớp không gian (Cross-Section).</li>
                            <li><b>Màn 23+:</b> Tính diện tích mặt hở & Suy luận Lõi Rỗng.</li>
                        </ul>
                        <p style="font-size: 12px; color: var(--primary-color); font-style: italic; margin-top: 10px; text-align: center;">Mẹo: Sử dụng Nút Xoay Lưới cẩn thận vì số lượt có hạn!</p>
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

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        
        this.state.rotationsLeft = this.config.maxRotations; 
        this.state.currentAngle = 45;
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.style.transition = 'none'; 
        sceneEl.style.setProperty('--scene-z', `${this.state.currentAngle}deg`);
        sceneEl.style.setProperty('--rot-speed', `${this.config.rotateSpeed}ms`);
        
        this.generateCubesForLevel(); 
        this.renderScene();
        this.generateQuestionAndOptions();
        this.updateUI();

        this.startTimer(this.config.defaultLevelTime); 
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

    // THUẬT TOÁN SINH KHỐI MỞ RỘNG (SCALE LỚN + TẠO LÕI RỖNG Ở MÀN > 23)
    generateCubesForLevel: function() {
        let isDuplicate = false;
        let safetyCounter = 0; 
        const lvl = this.state.level;
        
        // Tăng mạnh số lượng khối khi level cao
        let cubeCount = 4;
        if (lvl >= 5) cubeCount = Math.floor(Math.random() * 4) + 6;   // 6-9 khối
        if (lvl >= 10) cubeCount = Math.floor(Math.random() * 5) + 10; // 10-14 khối
        if (lvl >= 15) cubeCount = Math.floor(Math.random() * 6) + 15; // 15-20 khối
        if (lvl >= 20) cubeCount = Math.floor(Math.random() * 8) + 21; // 21-28 khối
        
        do {
            this.state.cubes = [];
            this.state.cubeIdCounter = 0;
            let occupied = new Set();
            const getKey = (x, y, z) => `${x},${y},${z}`;

            // NẾU LEVEL >= 23, CÓ 50% TỶ LỆ DÙNG THUẬT TOÁN "HẦM RỖNG"
            if (lvl >= 23 && Math.random() < 0.5) {
                // Xây khung 3x3x3
                for(let x=-1; x<=1; x++) {
                    for(let y=-1; y<=1; y++) {
                        for(let z=0; z<3; z++) {
                            // Đục lõi trung tâm
                            if(x===0 && y===0 && (z===0 || z===1)) continue; 
                            this.state.cubes.push({ id: this.state.cubeIdCounter++, x, y, z });
                            occupied.add(getKey(x,y,z));
                        }
                    }
                }
                // Random gọt lớp vỏ ngoài để nhìn tự nhiên
                let finalCubes = [];
                this.state.cubes.forEach(c => {
                    if (c.z === 2 && Math.random() < 0.4) {
                        occupied.delete(getKey(c.x, c.y, c.z)); 
                    } else if (c.z === 1 && Math.random() < 0.2 && !occupied.has(getKey(c.x, c.y, 2))) {
                        occupied.delete(getKey(c.x, c.y, c.z)); 
                    } else {
                        finalCubes.push(c);
                    }
                });
                this.state.cubes = finalCubes;

            } else {
                // Thuật toán phát triển ngẫu nhiên thông thường
                this.state.cubes.push({ id: this.state.cubeIdCounter++, x: 0, y: 0, z: 0 });
                occupied.add(getKey(0, 0, 0));

                while (this.state.cubes.length < cubeCount) {
                    let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
                    const dirs = [{dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 0, dz: 1}];
                    let dir = dirs[Math.floor(Math.random() * dirs.length)];
                    let nx = baseCube.x + dir.dx, ny = baseCube.y + dir.dy, nz = baseCube.z + dir.dz;
                    
                    let nKey = getKey(nx, ny, nz);
                    if (!occupied.has(nKey) && (nz === 0 || occupied.has(getKey(nx, ny, nz - 1)))) {
                        this.state.cubes.push({ id: this.state.cubeIdCounter++, x: nx, y: ny, z: nz });
                        occupied.add(nKey);
                    }
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
            cssCube.style.transform = `translate3d(${c.x * size}px, ${c.y * size}px, ${c.z * size}px)`;
            cssCube.innerHTML = `
                <div class="cb-face f-t"></div><div class="cb-face f-b"></div><div class="cb-face f-r"></div>
                <div class="cb-face f-l"></div><div class="cb-face f-fr"></div><div class="cb-face f-bk"></div>
            `;
            sceneEl.appendChild(cssCube);
        });
    },

    // BỂ CÂU HỎI TRỘN ĐỀU & THUẬT TOÁN LOGIC
    generateQuestionAndOptions: function() {
        const lvl = this.state.level;
        let pool = [1, 2, 3];
        if (lvl >= 15) pool.push(4); // Mặt tiếp xúc ẩn
        if (lvl >= 19) pool.push(5); // Cắt lớp (Slice)
        if (lvl >= 23) pool.push(6); // Diện tích bề mặt

        let qType = pool[Math.floor(Math.random() * pool.length)];
        let ans = 0, qText = "";

        // Hàm phụ trợ tính số mặt tiếp xúc (Manhattan distance == 1)
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

        if (qType === 1) { 
            qText = "Có TỔNG CỘNG bao nhiêu khối?"; 
            ans = this.state.cubes.length; 
        } 
        else if (qType === 2) { 
            qText = "Có bao nhiêu khối CHẠM MẶT ĐẤT?"; 
            ans = this.state.cubes.filter(c => c.z === 0).length; 
        } 
        else if (qType === 3) { 
            qText = "Có bao nhiêu khối BỊ ĐÈ LÊN?";
            let cSet = new Set(this.state.cubes.map(c => `${c.x},${c.y},${c.z}`));
            ans = this.state.cubes.filter(c => cSet.has(`${c.x},${c.y},${c.z + 1}`)).length;
        }
        else if (qType === 4) {
            qText = "Có bao nhiêu khối bị che ≥3 MẶT?";
            adjData = getAdjacencies();
            ans = this.state.cubes.filter(c => adjData.map.get(c.id) >= 3).length;
        }
        else if (qType === 5) {
            qText = "Nếu Lát Cắt ngang Tầng 2, có bao nhiêu khối?";
            // Tầng 2 nghĩa là Z=1. Nếu vô tình cụm khối lùn (Zmax=0), thì hỏi Tầng 1.
            let hasLevel2 = this.state.cubes.some(c => c.z === 1);
            let targetZ = hasLevel2 ? 1 : 0;
            qText = `Lát cắt ngang Tầng ${targetZ + 1} có bao nhiêu khối?`;
            ans = this.state.cubes.filter(c => c.z === targetZ).length;
        }
        else if (qType === 6) {
            qText = "Tổng DIỆN TÍCH BỀ MẶT ngoài là bao nhiêu?";
            adjData = getAdjacencies();
            // Công thức: (Tổng khối * 6) - (Số cặp dính nhau * 2)
            ans = (this.state.cubes.length * 6) - (adjData.pairs * 2);
        }

        this.state.correctAnswer = ans;
        document.getElementById('cb-question-text').innerText = qText;

        // Sinh đáp án giả thông minh (Co giãn theo độ lớn đáp án)
        let opts = new Set([ans]);
        let attempts = 0;
        
        while(opts.size < 4) {
            attempts++;
            // Nếu đáp án là Diện tích bề mặt (vd 80), biên độ phải lớn hơn so với đếm khối (vd 10)
            let variance = (ans > 30) ? 6 : 3; 
            let f = ans + Math.floor(Math.random() * (variance * 2 + 1)) - variance;
            if (f > 0 && f !== ans) opts.add(f);
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
        this.state.isTransitioning = true;
        
        clearInterval(this.state.timerInterval);

        if (selected === this.state.correctAnswer) {
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
