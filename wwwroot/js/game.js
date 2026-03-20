/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 5: Dynamic FPS Scaling (FPS Sentinel)
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1080,
    height: 1920,
    backgroundColor: '#050505',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('ball', 'assets/sprites/ball.png');
    this.load.image('goalie', 'assets/sprites/goalie_idle.png');
    this.load.image('pitch', 'assets/sprites/pitch.png');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. FPS Sentinel Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;
    this.sessionToken = null;

    // --- Domain 36: Performance Sentinel State ---
    this.performance = {
        fpsThreshold: 45,
        lowPerfMode: false,
        frameHistory: [],
        checkInterval: 60 // frames
    };

    // UI Cache
    this.screens = {
        welcome: document.getElementById('screen-welcome'),
        results: document.getElementById('screen-results'),
        hud: document.getElementById('game-hud'),
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score'),
        leaderboard: document.getElementById('leaderboard-body'),
        input: document.getElementById('credential-input'),
        error: document.getElementById('validation-error')
    };

    this.showScreen = (screenKey) => {
        this.screens.welcome.classList.remove('active');
        this.screens.results.classList.remove('active');
        if (this.screens[screenKey]) this.screens[screenKey].classList.add('active');
    };

    this.updateUI = () => {
        this.screens.score.innerText = this.score;
        this.screens.streak.innerText = `x${this.streak}`;
    };

    // --- Particle Systems (Subject to Sentinel) ---
    this.trailEmitter = this.add.particles(0, 0, 'ball', {
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        blendMode: 'ADD',
        frequency: 20,
        emitting: false
    });

    this.goalEmitter = this.add.particles(0, 0, 'ball', {
        speed: { min: 200, max: 600 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        gravityY: 300,
        blendMode: 'ADD',
        emitting: false
    });

    // --- Domain 33: Local Vault Logic ---
    this.syncOfflineScores = async () => {
        const pending = localStorage.getItem('pg_pending_score');
        if (!pending || !this.sessionToken) return;
        const payload = JSON.parse(pending);
        try {
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.sessionToken}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) localStorage.removeItem('pg_pending_score');
        } catch (e) { console.warn("[Resilience] Sync failed."); }
    };

    this.submitScore = async () => {
        if (!this.sessionToken || this.score === 0) return;
        const rawToken = sessionStorage.getItem('pg_raw_token');
        const payload = { credential: rawToken, score: this.score };
        localStorage.setItem('pg_pending_score', JSON.stringify(payload));
        try {
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.sessionToken}` },
                body: JSON.stringify(payload)
            });
            if (response.ok) localStorage.removeItem('pg_pending_score');
        } catch (error) { console.error("[Resilience] Saved to Vault."); }
    };

    this.loadLeaderboard = async () => {
        if (!this.screens.leaderboard) return;
        this.screens.leaderboard.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; opacity:0.5;">Cargando clasificación...</td></tr>';
        try {
            const response = await fetch('/api/leaderboard');
            const result = await response.json();
            if (result.success) {
                this.screens.leaderboard.innerHTML = '';
                result.data.forEach((entry, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td style="padding:16px; font-weight:900; opacity:0.3;">#${index + 1}</td><td style="padding:16px;">${entry.alias}</td><td style="padding:16px; text-align:right; font-weight:900; color:#00f260;">${entry.value.toLocaleString()}</td>`;
                    this.screens.leaderboard.appendChild(row);
                });
            }
        } catch (e) { this.screens.leaderboard.innerHTML = '<tr><td colspan="3" style="text-align:center;">Servidor no disponible</td></tr>'; }
    };

    this.validateToken = async (token) => {
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                this.sessionToken = data.token;
                sessionStorage.setItem('pg_raw_token', token);
                this.showScreen('none');
                this.screens.hud.classList.remove('hidden');
                this.gameActive = true;
                this.syncOfflineScores();
            } else {
                this.screens.error.classList.remove('hidden');
            }
        } catch (error) { this.screens.error.classList.remove('hidden'); }
    };

    document.getElementById('btn-start').onclick = () => this.validateToken(this.screens.input.value.trim());
    const storedToken = sessionStorage.getItem('pg_raw_token');
    if (storedToken) this.validateToken(storedToken);

    document.getElementById('btn-restart').onclick = () => window.location.reload();

    // World & Entities
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5);
    this.goalie.setImmovable(true);
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2);
    this.ball.setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);
    this.trailEmitter.startFollow(this.ball);

    this.moveGoalie = (predictedX) => {
        const relX = predictedX - centerX;
        let zoneModifier = (Math.abs(relX) > 200) ? 0.3 : (Math.abs(relX) < 100 ? 0.9 : 0.5);
        const willSave = Math.random() < (zoneModifier + Math.min(0.2, this.streak * 0.05));
        let targetX = willSave ? predictedX : (predictedX > centerX ? predictedX - 300 : predictedX + 300);
        this.tweens.add({ targets: this.goalie, x: Phaser.Math.Clamp(targetX, centerX - 400, centerX + 400), duration: 350, ease: 'Cubic.easeOut' });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.trailEmitter.stop();
        this.cameras.main.shake(200, 0.01);
        this.submitScore();
        this.time.delayedCall(1500, () => {
            this.screens.finalScore.innerText = this.score;
            this.loadLeaderboard();
            this.showScreen('results');
            this.gameActive = false;
        });
    });

    this.input.on('pointerdown', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        if (pointer.time - this.startTime < 50) return;
        const dX = (pointer.x - this.startX) / this.sys.game.config.width;
        const dY = (pointer.y - this.startY) / this.sys.game.config.height;
        if (dY < -0.05) {
            this.ball.setVelocity(dX * 12500, dY * 12500);
            this.ball.setAccelerationX(dX * 2500);
            this.moveGoalie(centerX + (dX * 1000));
            
            // Only emit trail if not in Low Performance mode (Domain 36)
            if (!this.performance.lowPerfMode) {
                this.trailEmitter.start();
            }
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0).setAccelerationX(0).setScale(1.2);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
        this.trailEmitter.stop();
    };
}

function update(time, delta) {
    if (!this.gameActive) return;

    // --- Domain 36: FPS Sentinel Monitoring ---
    const currentFps = 1000 / delta;
    this.performance.frameHistory.push(currentFps);
    if (this.performance.frameHistory.length > this.performance.checkInterval) {
        this.performance.frameHistory.shift();
        const avgFps = this.performance.frameHistory.reduce((a, b) => a + b) / this.performance.checkInterval;
        
        if (avgFps < this.performance.fpsThreshold && !this.performance.lowPerfMode) {
            console.warn(`[Sentinel] Performance drop detected (${Math.round(avgFps)} FPS). Activating Eco-Mode.`);
            this.performance.lowPerfMode = true;
            this.trailEmitter.stop(); // Aesthetic Pruning (Tier 1)
        }
    }

    if (this.ball.active && this.ball.y < this.sys.game.config.height - 300) {
        const progress = Phaser.Math.Clamp(((this.sys.game.config.height - 250) - this.ball.y) / 1300, 0, 1);
        this.ball.setScale(1.2 - (progress * 0.6));
    }

    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.trailEmitter.stop();

        if (Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 300) {
            this.goalEmitter.emitParticleAt(this.ball.x, this.ball.y, 20);
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++;
            this.score += (100 * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            this.submitScore();
            this.time.delayedCall(1500, () => {
                this.screens.finalScore.innerText = this.score;
                this.loadLeaderboard();
                this.showScreen('results');
                this.gameActive = false;
            });
        }
    }
}
