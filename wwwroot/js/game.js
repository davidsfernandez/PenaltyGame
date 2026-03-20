/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase C: Social Sharing & UI Refinement
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
    this.load.image('hand', 'assets/sprites/hand_icon.png');
    this.load.audio('kick', 'https://labs.phaser.io/assets/audio/SoundEffects/squit.mp3');
    this.load.audio('goal', 'https://labs.phaser.io/assets/audio/SoundEffects/success.mp3');
    this.load.audio('miss', 'https://labs.phaser.io/assets/audio/SoundEffects/p-achoo.mp3');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Social Integration Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;
    this.sessionToken = null;
    this.securitySeal = null;
    this.sessionSeed = "seed-123";
    this.lastShotTelemetry = { durationMs: 0, distanceNormalized: 0, curvature: 0 };

    this.screens = {
        welcome: document.getElementById('screen-welcome'),
        results: document.getElementById('screen-results'),
        hud: document.getElementById('game-hud'),
        tutorial: document.getElementById('screen-tutorial'),
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
        this.screens.tutorial.classList.remove('active');
        if (this.screens[screenKey]) this.screens[screenKey].classList.add('active');
    };

    this.updateUI = () => {
        this.screens.score.innerText = this.score;
        this.screens.streak.innerText = `x${this.streak}`;
    };

    // --- Domain 48: Social Sharing Logic ---
    this.shareResult = async () => {
        const text = `¡Acabo de lograr ${this.score.toLocaleString()} puntos en Penalty Challenge! ¿Podrás superar mi racha de x${this.streak}? Juega aquí:`;
        const url = window.location.href;

        if (navigator.share) {
            try {
                await navigator.share({ title: 'Penalty Challenge', text: text, url: url });
                console.log("[Social] Share successful.");
            } catch (e) { console.log("[Social] Share cancelled."); }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(`${text} ${url}`);
            alert("¡Mensaje copiado al portapapeles! Compártelo con tus amigos.");
        }
    };

    this.loadLeaderboard = async () => {
        if (!this.screens.leaderboard) return;
        this.screens.leaderboard.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; opacity:0.5;">Cargando clasificación...</td></tr>';

        try {
            const rawToken = sessionStorage.getItem('pg_raw_token');
            const myAlias = rawToken ? rawToken.substring(0, 3) + "***" : "TÚ";

            const response = await fetch('/api/leaderboard');
            const result = await response.json();

            if (result.success) {
                this.screens.leaderboard.innerHTML = '';
                result.data.forEach((entry, index) => {
                    const row = document.createElement('tr');
                    const isCurrentUser = (entry.alias === myAlias);
                    
                    row.style.background = isCurrentUser ? 'rgba(0, 242, 96, 0.1)' : 'transparent';
                    row.style.color = isCurrentUser ? '#00f260' : 'white';

                    row.innerHTML = `
                        <td style="padding:14px 20px; font-weight:900; opacity:0.3;">${index + 1}</td>
                        <td style="padding:14px 20px; font-weight:700;">${entry.alias} ${isCurrentUser ? '<b>(TÚ)</b>' : ''}</td>
                        <td style="padding:14px 20px; text-align:right; font-weight:900;">${entry.value.toLocaleString()}</td>
                    `;
                    this.screens.leaderboard.appendChild(row);
                });
            }
        } catch (error) {
            this.screens.leaderboard.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Sin conexión</td></tr>';
        }
    };

    this.submitScore = async () => {
        if (!this.sessionToken || this.score === 0) return;
        try {
            const rawToken = sessionStorage.getItem('pg_raw_token');
            const signature = await this.generateSignature(this.score);
            const payload = { credential: rawToken, score: this.score, signature: signature, durationMs: this.lastShotTelemetry.durationMs, distanceNormalized: this.lastShotTelemetry.distanceNormalized, curvature: this.lastShotTelemetry.curvature };
            await fetch('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.sessionToken}` }, body: JSON.stringify(payload) });
        } catch (e) { console.error("[API] Submission failed."); }
    };

    const validateToken = async (token) => {
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Accept': 'application/json' } });
            if (response.ok) {
                const data = await response.json();
                this.sessionToken = data.token;
                this.securitySeal = data.seal;
                sessionStorage.setItem('pg_raw_token', token);
                this.showScreen('tutorial');
                this.gameActive = false;
            } else { this.screens.error.classList.remove('hidden'); }
        } catch (error) { this.screens.error.classList.remove('hidden'); }
    };

    document.getElementById('btn-start').onclick = () => validateToken(this.screens.input.value.trim());
    document.getElementById('btn-restart').onclick = () => window.location.reload();
    document.getElementById('btn-share').onclick = () => this.shareResult();

    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch').setAlpha(0.8);
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5).setImmovable(true);
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2).setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);

    this.tutorialHand = this.add.sprite(centerX, bottomY, 'hand').setScale(1.5).setAlpha(0).setDepth(100);

    this.startTutorialAnimation = () => {
        this.tutorialHand.setAlpha(1);
        this.tweens.add({ targets: this.tutorialHand, y: bottomY - 450, alpha: { from: 1, to: 0 }, duration: 2000, repeat: -1, ease: 'Sine.easeInOut' });
    };

    this.input.on('pointerdown', (pointer) => {
        if (this.tutorialHand && this.tutorialHand.active) {
            this.tweens.killTweensOf(this.tutorialHand);
            this.tutorialHand.destroy();
            this.showScreen('none');
            this.screens.hud.classList.remove('hidden');
            this.gameActive = true;
            if (this.game.sound.context.state === 'suspended') this.game.sound.context.resume();
            return;
        }
        if (!this.gameActive || this.isResolving) return;
        this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        if (pointer.time - this.startTime < 50) return;
        const dX = (pointer.x - this.startX) / this.sys.game.config.width;
        const dY = (pointer.y - this.startY) / this.sys.game.config.height;
        if (dY < -0.05) {
            this.lastShotTelemetry.durationMs = pointer.time - this.startTime;
            this.lastShotTelemetry.distanceNormalized = Math.sqrt(dX**2 + dY**2);
            this.lastShotTelemetry.curvature = dX;
            this.ball.setVelocity(dX * 13000, dY * 13000);
            this.ball.setAccelerationX(dX * 2500);
            this.sound.play('kick', { volume: 0.6, pan: Phaser.Math.Clamp((pointer.x - centerX) / (this.sys.game.config.width / 2), -1, 1) });
            const relX = (centerX + (dX * 1000)) - centerX;
            const willSave = Math.random() < ((Math.abs(relX) > 200) ? 0.3 : 0.85);
            let targetX = willSave ? centerX + (dX * 1000) : (dX > 0 ? centerX - 300 : centerX + 300);
            this.tweens.add({ targets: this.goalie, x: Phaser.Math.Clamp(targetX, centerX-400, centerX+400), duration: 350, ease: 'Cubic.out' });
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0).setAccelerationX(0).setScale(1.2);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
    };

    this.generateSignature = async (score) => {
        const rawData = `${this.sessionSeed}_${score}_${this.securitySeal}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(rawData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };
}

function update(time, delta) {
    if (!this.gameActive && this.state === 'TUTORIAL' && this.tutorialHand && !this.tweens.isTweening(this.tutorialHand)) {
        this.startTutorialAnimation();
    }
    if (!this.gameActive) return;
    if (this.ball.active && this.ball.y < this.sys.game.config.height - 300) {
        const progress = Phaser.Math.Clamp(((this.sys.game.config.height - 250) - this.ball.y) / 1300, 0, 1);
        this.ball.setScale(1.2 - (progress * 0.6));
    }
    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        const isGoal = Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 300;
        if (isGoal) {
            this.sound.play('goal', { volume: 1 });
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++; this.score += (100 * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            this.sound.play('miss', { volume: 0.5 });
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
