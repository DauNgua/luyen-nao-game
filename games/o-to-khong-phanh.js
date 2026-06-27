// =========================================
// MODULE GAME: PHẢN XẠ TRÁNH VẬT CẢN KÉP
// Phong cách: Flat Modern Design
// Tương thích chuẩn API: window.CurrentGame
// =========================================

window.CurrentGame = (function () {
    // DOM Elements
    const container = document.getElementById('game-canvas');
    let canvas, ctx;
    
    // Core Game Variables
    let animationFrameId;
    let canvasW, canvasH;
    let colors = {};
    
    // Quản lý Trạng thái Trò chơi Nội bộ (Game Local State)
    let state = {
        level: 1,
        lives: 3,
        score: 0,
        isPlaying: false,
        isPaused: false,
        gameTimeouts: []
    };

    let gameData = {
        playerLeft: { lane: 0 }, // Làn trái của nửa trái màn hình (0 hoặc 1)
        playerRight: { lane: 1 }, // Làn phải của nửa phải màn hình (0 hoặc 1)
        obstacles: [],
        consecutiveDodges: 0,
        isResetting: false,
        lastSpawnTimeLeft: 0,
        lastSpawnTimeRight: 0,
        baseSize: 0 
    };

    // --- HỆ THỐNG ÂM THANH (AUDIO SYNTHESIZER) ---
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
        sfxMove: () => AudioEngine.playTone(300, 'sine', 0.1, 0.05), // Tiếng lách nhẹ
        sfxScore: () => AudioEngine.playTone(800, 'sine', 0.1, 0.05), // Điểm lên
        sfxWrong: () => AudioEngine.playTone(200, 'sine', 0.2, 0.1),  // Va chạm
        sfxLevelUp: function() {
            setTimeout(() => this.playTone(400, 'sine', 0.1, 0.05), 0);
            setTimeout(() => this.playTone(600, 'sine', 0.1, 0.05), 100);
            setTimeout(() => this.playTone(800, 'triangle', 0.3, 0.1), 200);
        }
    };

    // --- 1. GIAO TIẾP VỚI HỆ ĐIỀU HÀNH CHUNG ---
    function updateGlobalHeader() {
        if (window.GameInterface) {
            if (window.GameInterface.updateScore) window.GameInterface.updateScore(state.score);
            if (window.GameInterface.updateLives) window.GameInterface.updateLives(state.lives);
            // Có thể bổ sung hàm cập nhật cấp độ nếu GameInterface hỗ trợ
        }
    }

    // --- 2. XỬ LÝ ĐỒ HOẠ & CANVAS ---
    function initCanvas() {
        container.innerHTML = ''; 
        // Bắt buộc Set Box CSS cho thẻ div chứa để Canvas bung đầy
        container.style.padding = "0"; 
        container.style.position = "relative";
        
        canvas = document.createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none'; 
        canvas.style.borderRadius = "var(--radius-main)"; // Khớp thiết kế
        container.appendChild(canvas);
        
        ctx = canvas.getContext('2d');
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        canvas.addEventListener('pointerdown', handleInput);
    }

    function resizeCanvas() {
        if (!canvas) return;
        const rect = container.getBoundingClientRect();
        canvasW = canvas.width = rect.width;
        canvasH = canvas.height = rect.height;
        gameData.baseSize = Math.min(canvasW / 6, canvasH / 8); 
        
        const computedStyle = getComputedStyle(document.body);
        colors.bg = computedStyle.getPropertyValue('--bg-card').trim() || '#23272a';
        colors.border = computedStyle.getPropertyValue('--border-line').trim() || '#3e3835';
        colors.text = computedStyle.getPropertyValue('--text-dark').trim() || '#f5f5f5';
        colors.primary = computedStyle.getPropertyValue('--primary-color').trim() || '#e0533c';
        colors.error = computedStyle.getPropertyValue('--color-error').trim() || '#4a283d';
    }

    // Hàm vẽ hình bo góc 12px Flat Design
    function drawRoundRect(x, y, w, h, radius, color) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.closePath();
    }

    function getLaneX(side, lane) {
        const laneWidth = canvasW / 4;
        let index = side === 'left' ? lane : lane + 2; 
        return (index * laneWidth) + (laneWidth / 2) - (gameData.baseSize / 2);
    }

    const PLAYER_Y_OFFSET = 20; 

    // --- 3. LOGIC GAME: TƯƠNG TÁC (INPUT) ---
    function handleInput(e) {
        if (!state.isPlaying || state.isPaused || gameData.isResetting) return;
        
        // Resume AudioContext khi có tương tác đầu tiên
        if (AudioEngine.ctx.state === 'suspended') {
            AudioEngine.ctx.resume();
        }

        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        
        AudioEngine.sfxMove(); // Tiếng di chuyển

        if (clickX < canvasW / 2) {
            gameData.playerLeft.lane = gameData.playerLeft.lane === 0 ? 1 : 0;
        } else {
            gameData.playerRight.lane = gameData.playerRight.lane === 0 ? 1 : 0;
        }
    }

    // --- 4. LOGIC GAME: VẬT CẢN & VA CHẠM ---
    function spawnObstacle(timestamp) {
        if (gameData.isResetting) return;

        const baseSpeed = canvasH / 100; 
        const speedMult = 1 + (state.level * 0.1); 
        const spawnDelayBase = Math.max(800 - (state.level * 50), 300); 
        
        const isLevel1 = state.level === 1;

        if (timestamp - gameData.lastSpawnTimeLeft > spawnDelayBase * (isLevel1 ? 1.5 : 1)) {
            if (!isLevel1 || Math.random() > 0.5) { 
                gameData.obstacles.push({
                    side: 'left',
                    lane: Math.random() > 0.5 ? 1 : 0,
                    y: -gameData.baseSize,
                    speed: baseSpeed * speedMult * (Math.random() * 0.2 + 0.9), 
                    passed: false
                });
            }
            gameData.lastSpawnTimeLeft = timestamp + (Math.random() * 200); 
        }

        if (!isLevel1 || (timestamp - gameData.lastSpawnTimeLeft <= spawnDelayBase * 1.5)) { 
            if (timestamp - gameData.lastSpawnTimeRight > spawnDelayBase * 1.2) { 
                if (!isLevel1 || gameData.obstacles.length === 0) { 
                    gameData.obstacles.push({
                        side: 'right',
                        lane: Math.random() > 0.5 ? 1 : 0,
                        y: -gameData.baseSize,
                        speed: baseSpeed * speedMult * (Math.random() * 0.2 + 1), 
                        passed: false
                    });
                }
                gameData.lastSpawnTimeRight = timestamp + (Math.random() * 200);
            }
        }
    }

    function handleCollision() {
        gameData.isResetting = true;
        state.lives--;
        updateGlobalHeader(); // Trừ mạng trên OS
        AudioEngine.sfxWrong(); // Tiếng đâm
        
        if (state.lives <= 0) {
            state.isPlaying = false;
            // Dọn rác
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            // Chờ 1 giây rồi Báo cho HĐH quit
            setTimeout(() => {
                // Xử lý gửi điểm về AppManager
                if (window.AppManager && window.AppManager.addScore) {
                    window.AppManager.addScore(state.score);
                }
                if (window.AppManager && window.AppManager.quitGame) {
                    window.AppManager.quitGame();
                }
            }, 1000);
            return;
        }

        const timeout = setTimeout(() => {
            gameData.obstacles = []; 
            gameData.consecutiveDodges = 0; 
            gameData.isResetting = false;
            
            const now = performance.now();
            gameData.lastSpawnTimeLeft = now;
            gameData.lastSpawnTimeRight = now;
        }, 1000);
        
        state.gameTimeouts.push(timeout);
    }

    function updateLogic(timestamp) {
        if (!state.isPlaying || state.isPaused || gameData.isResetting) return;

        spawnObstacle(timestamp);

        const playerY = canvasH - gameData.baseSize - PLAYER_Y_OFFSET;
        const playerSize = gameData.baseSize;

        for (let i = gameData.obstacles.length - 1; i >= 0; i--) {
            let obs = gameData.obstacles[i];
            obs.y += obs.speed;

            let pLane = obs.side === 'left' ? gameData.playerLeft.lane : gameData.playerRight.lane;
            
            // Kiểm tra va chạm (Đâm)
            if (obs.lane === pLane) {
                if (obs.y < playerY + playerSize && obs.y + playerSize > playerY) {
                    handleCollision();
                    return; 
                }
            }

            // Ghi điểm khi vật cản đi qua an toàn
            if (!obs.passed && obs.y > playerY + playerSize) {
                obs.passed = true;
                state.score += 10;
                gameData.consecutiveDodges++;
                
                if (state.score % 50 !== 0) AudioEngine.sfxScore(); // Âm lích chích lên điểm
                
                // Tăng cấp độ
                if (gameData.consecutiveDodges >= 20) {
                    state.level++;
                    gameData.consecutiveDodges = 0;
                    AudioEngine.sfxLevelUp();
                }
                updateGlobalHeader();
            }

            // Xóa rác
            if (obs.y > canvasH + playerSize) {
                gameData.obstacles.splice(i, 1);
            }
        }
    }

    // --- 5. RENDER ĐỒ HOẠ XUỐNG CANVAS ---
    function render() {
        ctx.clearRect(0, 0, canvasW, canvasH);
        
        // Vẽ dải phân cách giữa (Dạng đường đứt khúc Flat Design)
        ctx.beginPath();
        ctx.setLineDash([12, 12]);
        ctx.moveTo(canvasW / 2, 0);
        ctx.lineTo(canvasW / 2, canvasH);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]); 
        
        const playerY = canvasH - gameData.baseSize - PLAYER_Y_OFFSET;
        const pSize = gameData.baseSize;

        // Vẽ chớp đỏ nhẹ khi va chạm
        if (gameData.isResetting && state.lives > 0) {
            ctx.fillStyle = colors.error; 
            ctx.globalAlpha = 0.3;
            ctx.fillRect(0, 0, canvasW, canvasH);
            ctx.globalAlpha = 1.0; // Reset
        }

        // Vẽ 2 khối Người chơi (Dùng màu Primary của hệ thống)
        const leftX = getLaneX('left', gameData.playerLeft.lane);
        drawRoundRect(leftX, playerY, pSize, pSize, 12, colors.primary);

        const rightX = getLaneX('right', gameData.playerRight.lane);
        drawRoundRect(rightX, playerY, pSize, pSize, 12, colors.primary);

        // Vẽ các khối chướng ngại vật đang rơi (Màu xám tối)
        gameData.obstacles.forEach(obs => {
            const obsX = getLaneX(obs.side, obs.lane);
            drawRoundRect(obsX, obs.y, pSize, pSize, 12, colors.text); 
        });
    }

    function gameLoop(timestamp) {
        updateLogic(timestamp);
        render();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- 6. EXPORT CẤU TRÚC CHUẨN KHIỂN HỆ THỐNG ---
    return {
        // Hàm init là lệnh bắt buộc do Hệ Điều Hành (main.js) gọi!
        init: function() {
            // Nạp thông số ban đầu
            state.level = 1;
            state.score = 0;
            state.lives = 3;
            state.isPlaying = true;
            state.isPaused = false;
            
            updateGlobalHeader();
            initCanvas();

            // Khởi chạy cơ chế trò chơi
            gameData.obstacles = [];
            gameData.consecutiveDodges = 0;
            gameData.isResetting = false;
            gameData.playerLeft.lane = 0; 
            gameData.playerRight.lane = 1; 
            
            const now = performance.now();
            gameData.lastSpawnTimeLeft = now;
            gameData.lastSpawnTimeRight = now;

            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(gameLoop);
        },
        
        cleanup: function() {
            state.isPlaying = false;
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            window.removeEventListener('resize', resizeCanvas);
            if (canvas) canvas.removeEventListener('pointerdown', handleInput);

            if (state.gameTimeouts && state.gameTimeouts.length > 0) {
                state.gameTimeouts.forEach(id => clearTimeout(id));
                state.gameTimeouts = [];
            }
            
            // Bỏ viền và màu nền tạm thời trước khi trả về Menu
            container.style.padding = ""; 
        }
    };
})();
