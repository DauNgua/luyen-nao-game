/**
 * TÊN FILE: games/cubic-logic.js
 * GAME: ĐẾM KHỐI LOGIC (BẢN HOÀN THIỆN CAO CẤP)
 * TÍNH NĂNG: True 3D Engine, Auto-Camera, Dynamic Timer, Parallax, Scaffolding (Học bạ).
 */

window.CurrentGame = {
    // =====================================================================
    // 1. CẤU HÌNH HỆ THỐNG
    // =====================================================================
    config: {
        maxRotations: 4,         // Lượt xoay tối đa mỗi màn
        rotateSpeed: 450         // Tốc độ xoay (mili-giây)
    },

    state: {
        score: 0, 
        level: 1, 
        lives: 3, 
        timeLeft: 0, 
        timerInterval: null,
        isPlaying: false, 
        isTransitioning: false,
        cubes: [], 
        correctAnswer: 0, 
        rotationsLeft: 4,
        lastFormationSignature: null, 
        currentAngle: 45,         
        audioCtx: null,
        highestLevel: 1,
        scoreMultiplier: 1.0,
        cubeIdCounter: 0,
        currentRoundSetup: {},
        hintData: null,
        parallaxInitialized: false
    },

    // =====================================================================
    // 2. HỆ THỐNG ÂM THANH MỘC BẢN
    // =====================================================================
    playWoodenSound: function(type) {
        if (!this.state.audioCtx) {
            this.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.state.audioCtx.state === 'suspended') {
            this.state.audioCtx.resume();
        }
        
        const osc = this.state.audioCtx.createOscillator();
        const gain = this.state.audioCtx.createGain();
        osc.connect(gain); 
        gain.connect(this.state.audioCtx.destination);
        const now = this.state.audioCtx.currentTime;

        if (type === 'start') {
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(400, now); 
            osc.frequency.setValueAtTime(600, now + 0.1); 
            osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.3, now); 
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now); osc.stop(now + 0.4);
        }
        else if (type === 'correct') { 
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(500, now); 
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
            gain.gain.setValueAtTime(0.5, now); 
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } 
        else if (type === 'error') { 
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(300, now); 
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.25);
            gain.gain.setValueAtTime(0.6, now); 
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now); osc.stop(now + 0.25);
        }
        else if (type === 'rotate') { 
            osc.type = 'sine'; 
            osc.frequency.setValueAtTime(150, now); 
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
            gain.gain.setValueAtTime(0.4, now); 
            gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        }
    },

    // =====================================================================
    // 3. KHỞI TẠO GIAO DIỆN (ĐÃ TÁCH BẠCH CSS RÕ RÀNG)
    // =====================================================================
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
                
                /* KÍNH MỜ CHO POPUP HƯỚNG DẪN */
                .cb-modal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; display: none; justify-content: center; align-items: flex-end; padding: 20px; padding-bottom: 30px; pointer-events: none;}
                .cb-modal-box { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); border-radius: 16px; padding: 25px 20px; text-align: center; width: 100%; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); animation: slideUpGlass 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); pointer-events: auto; }
                [data-theme="dark"] .cb-modal-box { background: rgba(30, 30, 35, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 40px rgba(0,0,0,0.4); }
                @keyframes slideUpGlass { 0% { transform: translateY(40px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

                .cb-modal-title { font-size: 16px; font-weight: 900; color: var(--primary-color); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px;}
                .cb-modal-desc { font-size: 14px; color: var(--text-dark); line-height: 1.5; margin-bottom: 20px; }
                
                .cb-question { font-size: 17px; font-weight: 800; margin-bottom: 10px; line-height: 1.4; color: var(--text-dark); text-align: center; min-height: 48px; display: flex; align-items: center; justify-content: center;}
                
                .cb-rotate-toolbar { display: flex; justify-content: space-between; width: 100%; margin-bottom: 10px; align-items: center; }
                .cb-rotate-btn { background: var(--bg-main); color: var(--text-dark); border: 1px solid var(--border-line); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: bold; cursor: pointer; transition: 0.2s;}
                .cb-rotate-btn:hover:not(:disabled) { background: var(--border-line); }
                .cb-rotate-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .cb-rotate-count { font-size: 12px; font-weight: bold; color: var(--text-muted); }

                /* 3D ENGINE (Đã thêm touch-action: none để kéo vuốt khối trên Mobile mượt mà) */
                .cb-canvas-box { width: 100%; height: 180px; border-radius: var(--radius-main); margin-bottom: 20px; position: relative; display: flex; justify-content: center; align-items: center; overflow: visible; perspective: 1200px; touch-action: none; }
                
                /* [BỘ ĐIỀU KHIỂN CAMERA 2D] (Chịu trách nhiệm Zoom và Căn giữa) */
                .cb-camera { 
                    position: absolute; transform-style: preserve-3d;
                    transform: scale(var(--scene-scale, 1)) translate(var(--scene-tx, 0px), var(--scene-ty, 0px));
                    /* [ĐÃ SỬA] Đổi biến transition sang --cam-speed để điều khiển riêng biệt */
                    transition: transform var(--cam-speed, 800ms) cubic-bezier(0.25, 1, 0.5, 1);
                }

                /* Mâm quay 3D kết hợp Parallax Trục X và Z */
                .cb-iso-scene { 
                    position: relative; width: 0; height: 0; transform-style: preserve-3d; 
                    transform: rotateX(calc(60deg + var(--tilt-y, 0deg))) rotateZ(calc(var(--scene-z, 45deg) + var(--tilt-x, 0deg))); 
                    transition: transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1); 
                }
                .cb-iso-scene.parallax-active { transition: transform 0.1s ease-out; }
                
                /* Không gian từng khối riêng biệt */
                .cb-cube-3d { position: absolute; width: 32px; height: 32px; margin-left: -16px; margin-top: -16px; transform-style: preserve-3d; transition: opacity 0.5s ease; }
                
                /* Viền khối linh hoạt theo Javascript */
                .cb-face { 
                    position: absolute; width: 32px; height: 32px; box-sizing: border-box; 
                    border: var(--stroke-w, 1.5px) solid rgba(0,0,0,0.15); 
                    backface-visibility: hidden; stroke-linejoin: round;
                }
                [data-theme="dark"] .cb-face { border-color: rgba(0,0,0,0.5); }
                
                /* Đổ màu 6 mặt rõ ràng. Tương phản tính bằng Filter Brightness tuyệt đối an toàn. */
                .f-t  { transform: translateZ(16px); background: #e2e8f0; filter: brightness(calc(1 + var(--lum-adjust, 0))); } 
                .f-b  { transform: rotateX(180deg) translateZ(16px); background: #94a3b8; } 
                .f-r  { transform: rotateY(90deg) translateZ(16px); background: #cbd5e0; filter: brightness(calc(1 - var(--lum-adjust, 0))); } 
                .f-l  { transform: rotateY(-90deg) translateZ(16px); background: #a0aec0; filter: brightness(calc(1 - var(--lum-adjust, 0))); } 
                .f-fr { transform: rotateX(90deg) translateZ(16px); background: #cbd5e0; filter: brightness(calc(1 - var(--lum-adjust, 0))); } 
                .f-bk { transform: rotateX(-90deg) translateZ(16px); background: #a0aec0; filter: brightness(calc(1 - var(--lum-adjust, 0))); } 
                
                /* Phối màu Dark mode an toàn */
                [data-theme="dark"] .f-t { background: #4a5568; } 
                [data-theme="dark"] .f-r { background: #2d3748; } 
                [data-theme="dark"] .f-fr{ background: #2d3748; } 
                [data-theme="dark"] .f-l { background: #1a202c; } 
                [data-theme="dark"] .f-bk{ background: #1a202c; }

                /* ----------------------------------------------------
                   GỢI Ý THỊ GIÁC (VISUAL HINTS)
                   ---------------------------------------------------- */
                /* 1. Xuyên thấu (Cắt lớp) */
                .cb-cube-3d.hint-fade .cb-face { background: rgba(0, 0, 0, 0.03) !important; border-color: rgba(0, 0, 0, 0.15) !important; }
                [data-theme="dark"] .cb-cube-3d.hint-fade .cb-face { background: rgba(255, 255, 255, 0.03) !important; border-color: rgba(255, 255, 255, 0.15) !important; }
                
                /* 2. Nháy Vàng (Mật độ) */
                .cb-cube-3d.hint-glow .cb-face { border-color: #f5a623 !important; border-width: 2px !important; }
                .cb-cube-3d.hint-glow .f-t { background: #fbd38d !important; } 
                .cb-cube-3d.hint-glow .f-r { background: #ed8936 !important; } 
                .cb-cube-3d.hint-glow .f-fr{ background: #ed8936 !important; } 
                .cb-cube-3d.hint-glow .f-l { background: #dd6b20 !important; } 
                .cb-cube-3d.hint-glow .f-bk{ background: #dd6b20 !important; }
                
                /* 3. Sơn Xanh (Diện tích) */
                .cb-cube-3d.hint-paint .cb-face { background-color: rgba(59, 130, 246, 0.4) !important; border: 2px solid #3b82f6 !important; animation: paintPulse 0.8s infinite alternate; }
                [data-theme="dark"] .cb-cube-3d.hint-paint .cb-face { background-color: rgba(96, 165, 250, 0.25) !important; border: 2px solid #60a5fa !important; }
                @keyframes paintPulse { 0% { filter: brightness(1); } 100% { filter: brightness(1.5) drop-shadow(0 0 8px rgba(59,130,246,0.6)); } }
                
                /* Bố cục nút bấm dưới */
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
                        <!-- CAMERA SYSTEM WRAPPER -->
                        <div class="cb-camera" id="cb-camera">
                            <div class="cb-iso-scene" id="cb-scene"></div>
                        </div>
                    </div>

                    <div class="cb-grid" id="cb-buttons"></div>

                    <!-- POPUP HƯỚNG DẪN CHUYÊN DỤNG -->
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

        // --- HỆ THỐNG PARALLAX KÉP: HOVER CHO PC & DÂY CHUN CHO MOBILE ---
        if (!this.state.parallaxInitialized) {
            
            // 1. DÀNH CHO PC (Di chuột Hover nhẹ nhàng)
            document.addEventListener('mousemove', (e) => {
                // Kiểm tra nếu là thiết bị cảm ứng (Mobile) thì chặn ngay, tránh lỗi giật hình khi bấm nút
                if (window.matchMedia("(pointer: coarse)").matches) return;
                if (!window.CurrentGame.state.isPlaying || window.CurrentGame.state.isTransitioning) return;
                
                const scene = document.getElementById('cb-scene');
                if (!scene) return;

                scene.classList.add('parallax-active');
                const x = (e.clientX / window.innerWidth - 0.5) * 2;
                const y = (e.clientY / window.innerHeight - 0.5) * 2;
                
                scene.style.setProperty('--tilt-x', `${x * 6}deg`);
                scene.style.setProperty('--tilt-y', `${y * 6}deg`);
            });

            // 2. DÀNH CHO MOBILE (Chạm & Kéo Dây Chun - Rubber Band Drag)
            let touchStartX = 0;
            let touchStartY = 0;

            document.addEventListener('touchstart', (e) => {
                // Chỉ nhận lệnh chạm nếu ngón tay đặt đúng vào khu vực cụm khối 3D (.cb-canvas-box)
                const box = e.target.closest('.cb-canvas-box');
                if (!box || !window.CurrentGame.state.isPlaying) return;

                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                
                const scene = document.getElementById('cb-scene');
                if (scene) scene.classList.add('parallax-active');
            }, { passive: false });

            document.addEventListener('touchmove', (e) => {
                const box = e.target.closest('.cb-canvas-box');
                if (!box || !window.CurrentGame.state.isPlaying) return;

                // Chặn cuộn trang web khi đang kéo nghiêng khối
                if (e.cancelable) e.preventDefault();

                const deltaX = e.touches[0].clientX - touchStartX;
                const deltaY = e.touches[0].clientY - touchStartY;

                // Công thức Dây chun: Độ nhạy 0.08 độ/pixel. KHÓA CỨNG TỐI ĐA ±8 ĐỘ (Chống gian lận nhìn ra sau)
                const tiltX = Math.max(-8, Math.min(8, deltaX * 0.08));
                const tiltY = Math.max(-8, Math.min(8, -deltaY * 0.08));

                const scene = document.getElementById('cb-scene');
                if (scene) {
                    scene.style.setProperty('--tilt-x', `${tiltX}deg`);
                    scene.style.setProperty('--tilt-y', `${tiltY}deg`);
                }
            }, { passive: false });

            // Hiệu ứng Đàn hồi: Thả ngón tay -> Khối tự động nảy về 0 độ
            document.addEventListener('touchend', () => {
                const scene = document.getElementById('cb-scene');
                if (scene) {
                    scene.style.setProperty('--tilt-x', `0deg`);
                    scene.style.setProperty('--tilt-y', `0deg`);
                }
            });

            this.state.parallaxInitialized = true;
        }
    },

    

    // =====================================================================
    // 4. QUẢN LÝ MENU VÀ HẠNG CÂN ĐỘNG
    // =====================================================================
    showMenu: function() {
        document.getElementById('cb-game-area').classList.remove('active');
        document.getElementById('cb-gameover-screen').classList.remove('active');
        document.getElementById('cb-menu-screen').classList.add('active');

        this.state.highestLevel = parseInt(localStorage.getItem('cb_highest_level')) || 1;
        let record = this.state.highestLevel;

        let lvlMid = Math.floor(record * 0.5);
        let lvlHigh = Math.floor(record * 0.7);

        const actionsContainer = document.getElementById('cb-start-actions');
        actionsContainer.innerHTML = `
            <button class="btn-flat" onclick="window.CurrentGame.startGame(1, 1.0)">
                [Khởi động] Từ Màn 1 (x1.0 Điểm)
            </button>
        `;

        if (lvlMid > 1) {
            let multMid = 1 + (lvlMid * 0.05);
            actionsContainer.innerHTML += `
                <button class="btn-flat btn-adv" style="opacity: 0.85;" onclick="window.CurrentGame.startGame(${lvlMid}, ${multMid})">
                    [Làm nóng] Từ Màn ${lvlMid} (x${multMid.toFixed(2)} Điểm)
                </button>
            `;
        }

        if (lvlHigh > lvlMid && lvlHigh > 1) {
            let multHigh = 1 + (lvlHigh * 0.05);
            actionsContainer.innerHTML += `
                <button class="btn-flat btn-adv" style="border-width: 3px !important; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" onclick="window.CurrentGame.startGame(${lvlHigh}, ${multHigh})">
                    [Thử thách] Từ Màn ${lvlHigh} (x${multHigh.toFixed(2)} Điểm)
                </button>
            `;
        }
    },

    startGame: function(startLvl = 1, multiplier = 1.0) {
        this.playWoodenSound('start'); 
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

    // =====================================================================
    // 5. CƠ CHẾ LOGIC: HỌC BẠ (SCAFFOLDING)
    // =====================================================================
    setupRoundLogic: function() {
        const lvl = this.state.level;
        let pool = [1, 2, 3];
        if (lvl >= 15) pool.push(4); 
        if (lvl >= 19) pool.push(5); 
        if (lvl >= 25) pool.push(6); 

        let qType;
        if (lvl === 15) qType = 4;
        else if (lvl === 19) qType = 5;
        else if (lvl === 25) qType = 6;
        else qType = pool[Math.floor(Math.random() * pool.length)];

        let progress = 3; // Mặc định là Tốt nghiệp cho các câu 1, 2, 3
        if (qType >= 4) {
            progress = parseInt(localStorage.getItem('cb_rule_' + qType)) || 0;
        }

        let setup = { type: qType, progress: progress, isTutorial: false, cubeCount: 0 };

        // [Giai đoạn 0] Học luật (5-6 khối)
        if (progress === 0) {
            setup.isTutorial = true;
            if (qType === 6) setup.cubeCount = Math.floor(Math.random() * 2) + 3; 
            else if (qType === 5) setup.cubeCount = Math.floor(Math.random() * 2) + 6; 
            else setup.cubeCount = Math.floor(Math.random() * 3) + 4; 
        } 
        // [Giai đoạn 1] Thực hành nhẹ (7-9 khối)
        else if (progress === 1) {
            setup.isTutorial = false;
            setup.cubeCount = Math.floor(Math.random() * 3) + 7; 
        } 
        // [Giai đoạn 2] Thực hành khá (10-14 khối)
        else if (progress === 2) {
            setup.isTutorial = false;
            setup.cubeCount = Math.floor(Math.random() * 5) + 10; 
        }
        // [Giai đoạn 3] Tốt nghiệp (Khối lượng lớn theo Level thực tế)
        else {
            setup.isTutorial = false;
            if (lvl <= 5) setup.cubeCount = Math.floor(Math.random() * 3) + 4;       
            else if (lvl <= 12) setup.cubeCount = Math.floor(Math.random() * 5) + 8; 
            else if (lvl <= 18) setup.cubeCount = Math.floor(Math.random() * 6) + 14;
            else if (lvl <= 24) setup.cubeCount = Math.floor(Math.random() * 8) + 21;
            else setup.cubeCount = Math.floor(Math.random() * 10) + 26;               
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
        const cameraEl = document.getElementById('cb-camera');
        
        sceneEl.style.transition = 'none'; 
        cameraEl.style.transition = 'none'; 
        sceneEl.style.setProperty('--scene-z', `${this.state.currentAngle}deg`);
        
        // Set tốc độ xoay khối (nhanh)
        sceneEl.style.setProperty('--rot-speed', `${this.config.rotateSpeed}ms`);
        
        // [CẬP NHẬT] Set tốc độ Camera (Zoom chậm, mượt). Bạn có thể chỉnh 800ms thành 1000ms tùy ý ở đây:
        let cameraSpeed = 800; 
        cameraEl.style.setProperty('--cam-speed', `${cameraSpeed}ms`);
        
        this.generateCubesForLevel();
        this.adjustCamera(); 
        this.renderScene();
        this.generateQuestionAndOptions();
        this.updateUI();

        void cameraEl.offsetWidth; // Ép Reflow DOM

        if (this.state.currentRoundSetup.isTutorial) {
            clearInterval(this.state.timerInterval); 
            document.querySelector('.cb-timer-bar').style.display = 'none';
            this.showTutorialPopup();
        } else {
            document.querySelector('.cb-timer-bar').style.display = 'block';
            
            // --- [CẬP NHẬT] CÔNG THỨC THỜI GIAN ĐỘNG THEO NHÓM KỸ NĂNG ---
            let baseTime = 10000; // Luôn cho 10s mặc định làm "Khoảng thở" để đọc đề
            let cubeCount = this.state.cubes.length;
            let qType = this.state.currentRoundSetup.type;
            
            let timePerCube = 500; // Nhóm Dễ (Câu 1, 2): Quét mắt nhanh -> +0.5s mỗi khối
            
            if (qType === 3 || qType === 5) {
                timePerCube = 1200; // Nhóm Vừa (Câu 3, 5): Cô lập không gian -> +1.2s mỗi khối
            } else if (qType === 4 || qType === 6) {
                timePerCube = 2500; // Nhóm Khó (Câu 4, 6): Phân tích bề mặt -> +2.5s mỗi khối
            }

            // Tính tổng thời gian = 10s + (Số khối * Thời gian cấp độ)
            let finalRoundTime = baseTime + (cubeCount * timePerCube);
            this.startTimer(finalRoundTime); 
        }
    },

    // =====================================================================
    // 6. THUẬT TOÁN TẠO KHỐI (Giới hạn kích thước + Đục rỗng)
    // =====================================================================
    generateCubesForLevel: function() {
        let isDuplicate = false;
        let safetyCounter = 0; 
        const targetCount = this.state.currentRoundSetup.cubeCount;
        const lvl = this.state.level;
        
        do {
            this.state.cubes = [];
            this.state.cubeIdCounter = 0;
            let occupied = new Set();
            const getKey = (x, y, z) => `${x},${y},${z}`;

            // Thuật toán gọt khối (Carving) cho màn siêu khó
            if (lvl >= 20 && targetCount > 15 && Math.random() < 0.5) {
                let size = (lvl >= 30) ? 4 : 3;
                let half = Math.floor(size/2);
                let tempCubes = [];
                for(let x=-half; x<=-half+(size-1); x++) {
                    for(let y=-half; y<=-half+(size-1); y++) {
                        for(let z=0; z<size; z++) {
                            tempCubes.push({x, y, z});
                        }
                    }
                }

                let targetRemove = Math.floor(tempCubes.length * (0.2 + Math.random() * 0.2));
                let removedCount = 0;
                tempCubes.sort(() => Math.random() - 0.5);

                tempCubes.forEach(c => {
                    let key = getKey(c.x, c.y, c.z);
                    if (removedCount < targetRemove && (c.x !== 0 || c.y !== 0 || c.z !== 0)) {
                        removedCount++;
                    } else {
                        this.state.cubes.push({ id: this.state.cubeIdCounter++, x: c.x, y: c.y, z: c.z });
                        occupied.add(key);
                    }
                });
            } else {
                // Thuật toán mọc rễ bình thường
                this.state.cubes.push({ id: this.state.cubeIdCounter++, x: 0, y: 0, z: 0 });
                occupied.add(getKey(0, 0, 0));

                let forceHeight = (this.state.currentRoundSetup.type === 5 && targetCount > 5) ? true : false;

                while (this.state.cubes.length < targetCount) {
                    let baseCube = this.state.cubes[Math.floor(Math.random() * this.state.cubes.length)];
                    let dirs = [{dx: 1, dy: 0, dz: 0}, {dx: -1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}, {dx: 0, dy: -1, dz: 0}, {dx: 0, dy: 0, dz: 1}];
                    
                    if (forceHeight && Math.random() < 0.5) dirs = [{dx: 0, dy: 0, dz: 1}, {dx: 0, dy: 0, dz: 1}, {dx: 1, dy: 0, dz: 0}, {dx: 0, dy: 1, dz: 0}];

                    let dir = dirs[Math.floor(Math.random() * dirs.length)];
                    let nx = baseCube.x + dir.dx, ny = baseCube.y + dir.dy, nz = baseCube.z + dir.dz;
                    
                    // Giới hạn khu vực an toàn (Size Capping)
                    if (nx > 2 || nx < -2 || ny > 2 || ny < -2 || nz > 4) {
                        continue; 
                    }
                    
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

    // =====================================================================
    // 7. CAMERA TOÁN HỌC (AUTO-ZOOM)
    // =====================================================================
    adjustCamera: function() {
        if (this.state.cubes.length === 0) return;

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        const size = 32; 

        const rad = this.state.currentAngle * (Math.PI / 180);
        const cosZ = Math.cos(rad);
        const sinZ = Math.sin(rad);
        const cosX = 0.5; 
        const sinX = 0.866025; 

        this.state.cubes.forEach(c => {
            let cx = c.x * size;
            let cy = c.y * size;
            let cz = c.z * size;

            let rX = cx * cosZ - cy * sinZ;
            let rY = cx * sinZ + cy * cosZ;

            let screenX = rX;
            let screenY = rY * cosX - cz * sinX;

            if (screenX < minX) minX = screenX;
            if (screenX > maxX) maxX = screenX;
            if (screenY < minY) minY = screenY;
            if (screenY > maxY) maxY = screenY;
        });

        minX -= 25; maxX += 25; 
        minY -= 35; maxY += 30; 

        let clusterWidth = maxX - minX;
        let clusterHeight = maxY - minY;
        let centerX = (minX + maxX) / 2;
        let centerY = (minY + maxY) / 2;

        let scaleX = 360 / clusterWidth;
        let scaleY = 140 / clusterHeight;
        let finalScale = Math.min(scaleX, scaleY, 1.2); 
        
        // Điều chỉnh Viền và Ánh sáng động theo Scale
        let strokeWidth = 1.5; 
        let lumAdjust = 0;     
        if (finalScale < 1.0) {
            strokeWidth = Math.min(1.5 / finalScale, 3.5); 
            lumAdjust = Math.min((1.0 - finalScale) * 0.4, 0.2); 
        }

        const cameraEl = document.getElementById('cb-camera');
        if (cameraEl) {
            cameraEl.style.transform = `scale(${finalScale}) translate(${-centerX}px, ${-centerY}px)`;
        }
        
        const gameArea = document.getElementById('cb-game-area');
        if (gameArea) {
            gameArea.style.setProperty('--stroke-w', `${strokeWidth.toFixed(2)}px`);
            gameArea.style.setProperty('--lum-adjust', `${lumAdjust.toFixed(3)}`);
        }
    },

    // =====================================================================
    // 8. KẾT XUẤT ĐỒ HỌA
    // =====================================================================
    renderScene: function() {
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.innerHTML = '';
        const size = 32; 
        
        this.state.cubes.forEach(c => {
            let cssCube = document.createElement('div');
            cssCube.className = `cb-cube-3d`;
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

    // =====================================================================
    // 9. CÂU HỎI VÀ ĐÁP ÁN
    // =====================================================================
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

        if (setup.type === 1) { 
            qText = "Có TỔNG CỘNG bao nhiêu khối?"; 
            ans = this.state.cubes.length; 
        } 
        else if (setup.type === 2) { 
            qText = "Có bao nhiêu khối ĐANG CHẠM MẶT ĐẤT?"; 
            ans = this.state.cubes.filter(c => c.z === 0).length; 
        } 
        else if (setup.type === 3) { 
            qText = "Có bao nhiêu khối BỊ KHỐI KHÁC ĐÈ LÊN?";
            let cSet = new Set(this.state.cubes.map(c => `${c.x},${c.y},${c.z}`));
            let buried = this.state.cubes.filter(c => cSet.has(`${c.x},${c.y},${c.z + 1}`));
            ans = buried.length;
            
            // Ép buộc màn hướng dẫn phải có đáp án
            if (setup.isTutorial && ans === 0) return this.nextRound(); 
            if (setup.isTutorial) this.state.hintData = { exampleIds: buried.map(c => c.id) };
        }
        else if (setup.type === 4) {
            qText = "Có bao nhiêu khối bị che ≥3 MẶT? (Chỉ đếm mặt chạm khối khác)";
            let adjData = getAdjacencies();
            let covered = this.state.cubes.filter(c => adjData.map.get(c.id) >= 3);
            ans = covered.length;
            
            if (setup.isTutorial && ans === 0) return this.nextRound(); 
            if (setup.isTutorial) this.state.hintData = { exampleIds: covered.map(c => c.id) };
        }
        else if (setup.type === 5) {
            let targetZ = 1; 
            if (setup.isTutorial || !this.state.cubes.some(c => c.z >= 1)) targetZ = 0; 
            
            qText = `Nếu CẮT NGANG Tầng ${targetZ + 1}, lát cắt có bao nhiêu khối?`;
            ans = this.state.cubes.filter(c => c.z === targetZ).length;
            if (setup.isTutorial) this.state.hintData = { targetZ: targetZ };
        }
        else if (setup.type === 6) {
            qText = "Nếu đem đi SƠN, bạn cần sơn bao nhiêu MẶT VUÔNG?";
            let adjData = getAdjacencies();
            ans = (this.state.cubes.length * 6) - (adjData.pairs * 2);
            if (setup.isTutorial) this.state.hintData = { triggerPaint: true };
        }

        this.state.correctAnswer = ans;
        document.getElementById('cb-question-text').innerText = qText;

        // Sinh đáp án nhiễu
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

    // =====================================================================
    // 10. XỬ LÝ HƯỚNG DẪN & TƯƠNG TÁC
    // =====================================================================
    showTutorialPopup: function() {
        const modal = document.getElementById('cb-tutorial-modal');
        const title = document.getElementById('cb-modal-title');
        const desc = document.getElementById('cb-modal-desc');
        const qType = this.state.currentRoundSetup.type;

        if (qType === 4) {
            title.innerText = "Tư Duy: Mật Độ";
            desc.innerHTML = "Tìm khối bị <b>kẹp chặt</b> bởi khối khác.<br><br>👉 <i>Khối cần tìm (khối bị che ít nhất 3 mặt) ở màn này sẽ để màu vàng. (Các mặt chạm đất không tính là che mặt).</i>";
        } else if (qType === 5) {
            title.innerText = "Tư Duy: Cắt Lớp";
            desc.innerHTML = "Hãy tưởng tượng dùng một con dao cắt ngang khối nhà ở một tầng chỉ định (Tầng chạm đất là Tầng 1).<br><br>👉 <i>Những tầng nằm bên trên (trong suốt) bị cắt bỏ đi. Bạn chỉ đếm khối ở tầng dưới cùng đặc màu!</i>";
        } else if (qType === 6) {
            title.innerText = "Tư Duy: Vỏ Bọc Ngoại Vi";
            desc.innerHTML = "Hãy tưởng tượng bạn phải <b>CẦM CHỔI SƠN</b> quét màu lên toàn bộ cụm khối này.<br><br>👉 <i>Bạn cần sơn bao nhiêu MẶT HÌNH VUÔNG? (Các mặt dính chặt vào nhau ở bên trong lõi thì không cần sơn).</i>";
        }
        modal.style.display = 'flex';
    },

    closeTutorial: function() {
        document.getElementById('cb-tutorial-modal').style.display = 'none';
        this.applyVisualHints(); 
    },

    applyVisualHints: function() {
        if (!this.state.hintData) return;
        let qType = this.state.currentRoundSetup.type;

        if (qType === 3 || qType === 4) {
            let ids = this.state.hintData.exampleIds;
            if (ids && ids.length > 0) {
                ids.forEach(id => {
                    let targetCube = document.querySelector(`.cb-cube-3d[data-id="${id}"]`);
                    if (targetCube) targetCube.classList.add('hint-glow');
                });
            }
        } 
        else if (qType === 5) {
            let targetZ = this.state.hintData.targetZ;
            document.querySelectorAll('.cb-cube-3d').forEach(el => {
                let z = parseInt(el.getAttribute('data-z'));
                if (z > targetZ) el.classList.add('hint-fade');
            });
        }
        else if (qType === 6) {
            document.querySelectorAll('.cb-cube-3d').forEach(el => {
                el.classList.add('hint-paint');
            });
        }
    },

    handleChoice: function(selected) {
        if (!this.state.isPlaying || this.state.isTransitioning) return;
        if (document.getElementById('cb-tutorial-modal').style.display === 'flex') return;

        this.state.isTransitioning = true;
        clearInterval(this.state.timerInterval);

        if (selected === this.state.correctAnswer) {
            let setup = this.state.currentRoundSetup;
            if (setup.type >= 4 && setup.progress < 3) {
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

    rotateView: function(direction) {
        if (this.state.rotationsLeft <= 0 || !this.state.isPlaying || this.state.isTransitioning) return;
        this.state.rotationsLeft--;
        this.state.isTransitioning = true; 
        this.playWoodenSound('rotate');
        
        const sceneEl = document.getElementById('cb-scene');
        sceneEl.classList.remove('parallax-active');
        sceneEl.style.setProperty('--tilt-x', `0deg`);
        sceneEl.style.setProperty('--tilt-y', `0deg`);

        this.state.currentAngle += (direction === 'left' ? -90 : 90);
        
        const cameraEl = document.getElementById('cb-camera');
        
        sceneEl.style.transition = `transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1)`;
        sceneEl.style.setProperty('--scene-z', `${this.state.currentAngle}deg`);
        
        cameraEl.style.transition = `transform var(--rot-speed) cubic-bezier(0.25, 1, 0.5, 1)`;
        this.adjustCamera();

        this.updateUI();
        setTimeout(() => { this.state.isTransitioning = false; }, this.config.rotateSpeed);
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
