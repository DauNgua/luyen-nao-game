/**
 * TÊN FILE: games/cubic-logic.js
 * GAME: CUBIC & LOGIC (Đếm Khối Không Gian)
 */

window.CurrentGame = {
    // 1. TRẠNG THÁI TRÒ CHƠI
    state: {
        score: 0,
        level: 1,
        lives: 3,
        timeLeft: 0,
        timerInterval: null,
        isPlaying: false,
        isTransitioning: false,
        
        cubes: [], // Lưu tọa độ 3D của các khối {x, y, z, isGold}
        correctAnswer: 0,
        isGoldenRound: false, // Vòng có nhân đôi điểm
        
        audioCtx: null // Engine âm thanh gỗ
    },

    // 2. KHỞI TẠO ÂM THANH "GÕ MÕ GỖ" 
    playWoodenSound: function(type) {
        if (!this.state.audioCtx) this.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.state.audioCtx.state === 'suspended') this.state.audioCtx.resume();
        
        const osc = this.state.audioCtx.createOscillator();
        const gain = this.state.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.state.audioCtx.destination);
        const now = this.state.audioCtx.currentTime;

        if (type === 'tick') { 
            osc.type = 'triangle'; osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'correct') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(500, now); osc.frequency.exponentialRampToValueAtTime(250, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'error') { 
            osc.type = 'triangle'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            gain.gain.setValueAtTime(0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now); osc.stop(now + 0.2);
        }
    },

    // 3. KHỞI TẠO GAME VÀ GIAO DIỆN
    init: function() {
        const container = document.getElementById('game-canvas');
        if (!container) return;

        // Sinh HTML & CSS 
        container.innerHTML = `
            <style>
                .cubic-wrapper, .cubic-wrapper * { box-sizing: border-box; }
                .cubic-wrapper {
                    background: var(--bg-card, #1E293B); color: var(--text-main, #FFFFFF);
                    width: 100%; max-width: 480px; margin: 0 auto; padding: 25px;
                    border-radius: 16px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    transition: background-color 0.2s ease; user-select: none;
                }
                
                /* Layout */
                .cb-screen { display: none; flex-direction: column; align-items: center; min-height: 400px; justify-content: center; width: 100%; }
                .cb-screen.active { display: flex; }
                #cb-game-area { display: none; flex-direction: column; align-items: center; width: 100%; }
                #cb-game-area.active { display: flex; }
                
                /* UI Hệ thống */
                .cb-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 15px; font-size: 14px; opacity: 0.8; width: 100%; }
                .cb-timer-bar { width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; margin-bottom: 20px; overflow: hidden; }
                .cb-timer-fill { height: 100%; background: var(--color-primary, #3B82F6); width: 100%; transition: width 0.05s linear; }
                
                /* Giao diện chính game */
                .cb-question { font-size: 18px; font-weight: bold; margin-bottom: 15px; line-height: 1.4; color: var(--color-success, #F59E0B);}
                .cb-canvas-box {
                    width: 100%; height: 220px; background: rgba(0,0,0,0.15); border-radius: 12px; margin-bottom: 20px;
                    position: relative; display: flex; justify-content: center; align-items: center; overflow: visible;
                }
                
                /* Bố cục Không gian ảo chứa khối */
                .cb-iso-scene { position: relative; width: 0; height: 0; }
                .cb-cube { position: absolute; transform: translate(-50%, -50%); transition: transform 0.3s; filter: drop-shadow(0px 8px 4px rgba(0,0,0,0.25)); }
                
                /* Nút trắc nghiệm */
                .cb-grid { width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .cb-wrapper .btn-flat {
                    background: var(--color-primary, #3B82F6); color: white; border: none; padding: 15px; font-size: 20px; font-weight: bold;
                    border-radius: 8px; cursor: pointer; transition: background 0.2s, transform 0.1s; width: 100%; outline: none;
                }
                .cb-wrapper .btn-flat:hover { background: var(--color-primary-hover, #2563EB); }
                .cb-wrapper .btn-flat:active { transform: scale(0.95); }
                .cb-btn-gold { box-shadow: 0 0 10px var(--color-success, #ffca28); border: 2px solid var(--color-success, #ffca28) !important;}
            </style>

            <div class="cubic-wrapper" id="cb-wrapper">
                
                <!-- MENU BẮT ĐẦU -->
                <div id="cb-menu-screen" class="cb-screen active">
                    <h1 style="font-size: 32px; margin-bottom: 10px; color: var(--color-primary, #3B82F6);">CUBIC & LOGIC</h1>
                    <p style="opacity: 0.8; margin-bottom: 30px; font-size: 15px; line-height: 1.6;">
                        Kiểm tra tư duy Không gian 3D của bạn.<br>
                        Hãy đọc kỹ câu hỏi và đếm số khối chính xác.<br>
                        <i>Đặc biệt: Bắt được Khối Vàng sẽ x2 Điểm số!</i>
                    </p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">BẮT ĐẦU (15s/Màn)</button>
                </div>

                <!-- KHU VỰC CHƠI -->
                <div id="cb-game-area">
                    <div class="cb-header">
                        <div>MÀN: <span id="cb-level">1</span></div>
                        <div style="color: var(--color-success, #F59E0B);">ĐIỂM: <span id="cb-score">0</span></div>
                        <div>MẠNG: <span id="cb-lives">3</span></div>
                    </div>
                    
                    <div class="cb-timer-bar"><div id="cb-timer-fill" class="cb-timer-fill"></div></div>
                    
                    <div class="cb-question" id="cb-question-text">Câu hỏi sẽ hiện ở đây?</div>
                    
                    <div class="cb-canvas-box">
                        <div class="cb-iso-scene" id="cb-scene">
                            <!-- Các khối SVG đếm động được chèn tại đây -->
                        </div>
                    </div>

                    <div class="cb-grid" id="cb-buttons"></div>
                </div>

                <!-- GAME OVER -->
                <div id="cb-gameover-screen" class="cb-screen">
                    <h2 style="color: var(--color-error, #E11D48); font-size: 36px; margin-bottom: 10px;">HẾT MẠNG</h2>
                    <p style="font-size: 18px; margin-bottom: 20px;">Bạn đạt: <strong id="cb-final-score" style="color: var(--color-success, #F59E0B); font-size: 24px;">0</strong> điểm</p>
                    <button class="btn-flat" onclick="window.CurrentGame.startGame()">CHƠI LẠI TỪ ĐẦU</button>
                </div>

            </div>
        `;
    },

    // 4. LUỒNG TRÒ CHƠI 
    startGame: function() {
        this.playWoodenSound('tick');
        this.state.score = 0;
        this.state.level = 1;
        this.state.lives = 3;
        this.state.isPlaying = true;
        this.state.isTransitioning = false;
        
        document.getElementById('cb-menu-screen').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.remove('active');
        document.getElementById('cb-game-area').classList.add('active');
        
        this.updateUI();
        this.nextRound();
    },

    nextRound: function() {
        if (this.state.lives <= 0) return this.gameOver();
        this.updateUI();
        
        // 4.1 Tạo cụm Khối Isometric 
        this.generateCubesForLevel();
        this.renderScene();
        
        // 4.2 Sinh câu hỏi và Đáp án dựa trên cụm khối vừa sinh
        this.generateQuestionAndOptions();
        
        // 4.3 Khởi động Timer 15s cứng
        this.startTimer(15000); 
    },

    // --- CƠ TRÍ TẠO KHỐI LẬP PHƯƠNG KHÔNG TRỌNG LỰC ---
    generateCubesForLevel: function() {
        this.state.cubes = [];
        const lvl = this.state.level;
        
        let cubeCount = 0;
        if (lvl <= 3) cubeCount = Math.floor(Math.random() * 3) + 3; // 3 - 5
        else if (lvl <= 7) cubeCount = Math.floor(Math.random() * 5) + 8; // 8 - 12
        else cubeCount = Math.floor(Math.random() * 6) + 13; // 13 - 18

        let occupied = new Set();
        const getKey = (x, y, z) => `${x},${y},${z}`;
        
        // Luôn có khối gốc tọa độ
        this.state.cubes.push({ x: 0, y: 0, z: 0, isGold: false });
        occupied.add(getKey(0, 0, 0));

        // Logic sinh khối liền kề (Không bao giờ có khối lơ lửng)
        while (this.state.cubes.length < cubeCount) {
            let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
            
            // Random hướng lan tỏa: x+, x-, y+, y-, z+ (Lên trên)
            const directions = [
                {dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0},
                {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0},
                {dx: 0, dy: 0, dz: 1} // Đè lên trên
            ];
            
            let dir = directions[Math.floor(Math.random() * directions.length)];
            let nx = baseCube.x + dir.dx;
            let ny = baseCube.y + dir.dy;
            let nz = baseCube.z + dir.dz;
            
            let nKey = getKey(nx, ny, nz);
            
            // Nếu slot chưa có ai chiếm, VÀ (nếu nằm trên cao thì ở dưới phải có móng đỡ)
            if (!occupied.has(nKey)) {
                if (nz === 0 || occupied.has(getKey(nx, ny, nz - 1))) {
                    this.state.cubes.push({ x: nx, y: ny, z: nz, isGold: false });
                    occupied.add(nKey);
                }
            }
        }

        // Random Golden Cube (20% cơ hội)
        this.state.isGoldenRound = false;
        if (Math.random() < 0.25) { // Nâng tỷ lệ cho dễ test
            this.state.isGoldenRound = true;
            let randIndex = Math.floor(Math.random() * this.state.cubes.length);
            this.state.cubes[randIndex].isGold = true;
        }

        // Bước rất quan trọng của 2.5D: Sắp xếp các mảng Họa sĩ.
        // Khối nào tọa độ (X+Y+Z) nhỏ thì nằm sau, phải vẽ trước.
        this.state.cubes.sort((a, b) => (a.x + a.y + a.z) - (b.x + b.y + b.z));
    },

    // --- CHẾ TẠO ĐỒ HỌA BẰNG SVG ---
    renderScene: function() {
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.innerHTML = '';
        
        // Constants tỷ lệ Isometric
        const tileW = 44; 
        const tileH = 24; 
        const zHeight = 26; 

        // Offset center màn hình
        let minX = 0, maxX = 0, minY = 0, maxY = 0;

        this.state.cubes.forEach(c => {
            // Công thức quy đổi tọa độ 3D thành 2D screen
            let screenX = (c.x - c.y) * (tileW / 2);
            let screenY = (c.x + c.y) * (tileH / 2) - (c.z * zHeight);
            
            // Vẽ khối vuông SVG màu sắc tinh tế
            let colorTop = c.isGold ? '#FFCA28' : '#e0eaff'; // Vàng nhạt : Trắng sữa
            let colorLeft = c.isGold ? '#FF9800' : '#8daaf2'; // Cam nhạt : Xanh tối
            let colorRight = c.isGold ? '#F57C00' : '#6a8dec'; // Cam sậm : Xanh đậm

            let svgCube = document.createElement('div');
            svgCube.className = 'cb-cube';
            svgCube.style.left = `${screenX}px`;
            svgCube.style.top = `${screenY}px`;
            
            svgCube.innerHTML = `
                <svg viewBox="0 0 100 115" width="${tileW}" height="50">
                    <path d="M50 0 L100 28 L50 56 L0 28 Z" fill="${colorTop}"/> <!-- Mặt trên -->
                    <path d="M0 28 L50 56 L50 115 L0 87 Z" fill="${colorLeft}"/> <!-- Mặt trái -->
                    <path d="M100 28 L50 56 L50 115 L100 87 Z" fill="${colorRight}"/> <!-- Mặt phải -->
                </svg>
            `;
            sceneEl.appendChild(svgCube);
        });
    },

    // --- CƠ TRÍ HỎI & ĐÁP ---
    generateQuestionAndOptions: function() {
        const lvl = this.state.level;
        let qType = 1; 

        // Ghi đè Câu hỏi nếu có khối VÀNG
        if (this.state.isGoldenRound) {
            qType = 'GOLD';
        } else {
            let possibleQ = [1];
            if (lvl >= 4) possibleQ.push(2); // Thêm loại 2
            if (lvl >= 8) possibleQ.push(3); // Thêm loại 3
            qType = possibleQ[Math.floor(Math.random() * possibleQ.length)];
        }

        let ans = 0;
        let qText = "";

        if (qType === 1) {
            qText = "Có TỔNG CỘNG bao nhiêu khối?";
            ans = this.state.cubes.length;
        } 
        else if (qType === 2) {
            qText = "Có bao nhiêu khối NẰM CHẠM ĐÁY?";
            ans = this.state.cubes.filter(c => c.z === 0).length;
        } 
        else if (qType === 3) {
            qText = "Có bao nhiêu khối BỊ ĐÈ LÊN trên?";
            // Tìm khối nào tồn tại khối z+1 đè trực tiếp lên
            let cubeSet = new Set(this.state.cubes.map(c => `${c.x},${c.y},${c.z}`));
            ans = this.state.cubes.filter(c => cubeSet.has(`${c.x},${c.y},${c.z + 1}`)).length;
        } 
        else if (qType === 'GOLD') {
            qText = "Khối Vàng CHẠM vào bao nhiêu khối?";
            let gc = this.state.cubes.find(c => c.isGold);
            ans = this.state.cubes.filter(c => {
                let d = Math.abs(c.x - gc.x) + Math.abs(c.y - gc.y) + Math.abs(c.z - gc.z);
                return d === 1; // Khoảng cách Manhattan = 1 nghĩa là chạm mặt
            }).length;
        }

        this.state.correctAnswer = ans;
        document.getElementById('cb-question-text').innerText = qText;

        // Sinh 4 đáp án (Bảo vệ không bị trùng và số âm)
        let optionsSet = new Set([ans]);
        while(optionsSet.size < 4) {
            let fakeAns = ans + Math.floor(Math.random() * 5) - 2; // Giao động -2 đến +2
            if (fakeAns > 0 && fakeAns !== ans) optionsSet.add(fakeAns);
        }
        let finalOptions = Array.from(optionsSet).sort(() => Math.random() - 0.5);

        // Render nút bấm
        const btnBox = document.getElementById('cb-buttons');
        btnBox.innerHTML = '';
        finalOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn-flat';
            if (qType === 'GOLD') btn.classList.add('cb-btn-gold');
            btn.innerText = opt;
            btn.onclick = () => this.handleChoice(opt);
            btnBox.appendChild(btn);
        });
    },

    handleChoice: function(selectedNumber) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        this.state.isTransitioning = true;
        clearInterval(this.state.timerInterval);

        const isCorrect = (selectedNumber === this.state.correctAnswer);
        
        if (isCorrect) {
            this.playWoodenSound('correct');
            // Logic nhân đôi điểm nếu màn có Golden Cube
            let gainedPoints = (10 + this.state.level);
            if (this.state.isGoldenRound) gainedPoints *= 2; 

            this.state.score += gainedPoints;
            this.state.level++;
            
            // Nháy sáng xanh/vàng
            this.triggerFeedback(this.state.isGoldenRound ? 'gold' : 'success');
        } else {
            this.playWoodenSound('error');
            this.state.lives--;
            this.triggerFeedback('error');
        }

        setTimeout(() => {
            this.state.isTransitioning = false;
            this.nextRound();
        }, 300);
    },

    // --- HỆ THỐNG XUNG PHẢN HỒI MÀU ---
    triggerFeedback: function(type) {
        const wrapperEl = document.getElementById('cb-wrapper');
        let colorVar = '';
        if (type === 'success') colorVar = 'var(--color-success, #4CAF50)';
        else if (type === 'gold') colorVar = '#FFC107'; // Vàng sáng mạnh
        else colorVar = 'var(--color-error, #6A1B9A)';
        
        const originalBg = wrapperEl.style.background;
        wrapperEl.style.background = colorVar;
        setTimeout(() => {
            if (this.state.isPlaying && document.getElementById('cb-wrapper')) {
                wrapperEl.style.background = originalBg || 'var(--bg-card, #1E293B)';
            }
        }, 150);
    },

    startTimer: function(durationMs) {
        clearInterval(this.state.timerInterval);
        this.state.timeLeft = durationMs;
        const tickRate = 20; 
        const timerFillEl = document.getElementById('cb-timer-fill');

        this.state.timerInterval = setInterval(() => {
            this.state.timeLeft -= tickRate;
            let percent = (this.state.timeLeft / durationMs) * 100;
            if(timerFillEl) timerFillEl.style.width = `${percent}%`;

            if (this.state.timeLeft <= 0) {
                clearInterval(this.state.timerInterval);
                if(timerFillEl) timerFillEl.style.width = `0%`;
                
                if (!this.state.isTransitioning) {
                    this.state.isTransitioning = true;
                    this.playWoodenSound('error');
                    this.state.lives--; 
                    this.triggerFeedback('error');
                    setTimeout(() => { this.state.isTransitioning = false; this.nextRound(); }, 300);
                }
            }
        }, tickRate);
    },

    updateUI: function() {
        document.getElementById('cb-level').innerText = this.state.level;
        document.getElementById('cb-score').innerText = this.state.score;
        document.getElementById('cb-lives').innerText = '❤️'.repeat(Math.max(0, this.state.lives));
    },

    gameOver: function() {
        this.state.isPlaying = false;
        clearInterval(this.state.timerInterval);
        
        document.getElementById('cb-game-area').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.add('active');
        document.getElementById('cb-final-score').innerText = this.state.score;
        document.getElementById('cb-wrapper').style.background = 'var(--bg-card, #1E293B)';
        
        // Gọi lệnh Hệ thống để cộng dồn điểm Toàn Cục
        if(window.AppManager && typeof window.AppManager.addScore === 'function') {
            window.AppManager.addScore(this.state.score);
        }
    },

    // 5. HÀM DỌN DẸP BẮT BUỘC 
    cleanup: function() {
        if (this.state.timerInterval) clearInterval(this.state.timerInterval);
        if (this.state.audioCtx && this.state.audioCtx.state !== 'closed') this.state.audioCtx.suspend();
        this.state.isPlaying = false;
    }
};
