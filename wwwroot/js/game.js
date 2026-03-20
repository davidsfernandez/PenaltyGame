/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase D: Context Isolation & Pause
 */

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1080,
    height: 1920,
    backgroundColor: '#050505',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('ball', 'assets/sprites/ball.png');
    this.load.image('goalie', 'assets/sprites/goalie_idle.png');
    this.load.image('pitch', 'assets/sprites/pitch.png');
    this.load.image('hand', 'assets/sprites/hand_icon.png');
    this.load.audio('kick', 'assets/audio/kick.mp3');
    this.load.audio('goal', 'assets/audio/goal.mp3');
    this.load.audio('miss', 'assets/audio/miss.mp3');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Context Isolation Phase.");

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
        tutorial: document.getElementById('screen-tutorial'),
        pause: document.getElementById('screen-pause'),
        hud: document.getElementById('game-hud'),
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score'),
        leaderboard: document.getElementById('leaderboard-body'),
        countdown: document.getElementById('countdown-value')
    };

    this.showScreen = (screenKey) => {
        ['welcome', 'results', 'tutorial', 'pause'].forEach(k => this.screens[k].classList.remove('active'));
        if (this.screens[screenKey]) this.screens[screenKey].classList.add('active');
    };

    this.updateUI = () => {
        this.screens.score.innerText = this.score;
        this.screens.streak.innerText = `x${this.streak}`;
    };

    // --- Domain 38: Context Isolation & Smart Pause ---
    this.startResumeCountdown = () => {
        let count = 3;
        this.screens.countdown.innerText = count;
        this.showScreen('pause');

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                this.screens.countdown.innerText = count;
            } else {
                clearInterval(interval);
                this.showScreen('none');
                this.scene.resume();
                this.gameActive = true;
                console.log("[System] Context restored. Physical laws active.");
            }
        }, 1000);
    };

    this.game.events.on('blur', () => {
        if (!this.gameActive) return;
        this.gameActive = false;
        this.scene.pause();
        console.log("[System] Context lost (OS Interruption). Freezing world.");
    });

    this.game.events.on('focus', () => {
        if (this.screens.results.classList.contains('active') || this.screens.welcome.classList.contains('active')) return;
        this.startResumeCountdown();
    });

    // Interaction & Auth
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
            } else { document.getElementById('validation-error').style.display = 'block'; }
        } catch (e) { document.getElementById('validation-error').style.display = 'block'; }
    };

    document.getElementById('btn-start').onclick = () => validateToken(document.getElementById('credential-input').value.trim());
    document.getElementById('btn-restart').onclick = () => window.location.reload();
    document.getElementById('btn-share').onclick = () => this.shareResult();

    // World
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch').setAlpha(0.8);
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5).setImmovable(true);
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2).setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);

    this.trailEmitter = this.add.particles(0, 0, 'ball', { scale: { start: 0.4, end: 0 }, alpha: { start: 0.5, end: 0 }, lifespan: 400, blendMode: 'ADD', frequency: 20, emitting: false });
    this.trailEmitter.startFollow(this.ball);

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
            this.trailEmitter.start();
            if (this.cache.audio.exists('kick')) this.sound.play('kick', { volume: 0.6, pan: Phaser.Math.Clamp((pointer.x - centerX) / (this.sys.game.config.width / 2), -1, 1) });
            const relX = (centerX + (dX * 1000)) - centerX;
            const willSave = Math.random() < ((Math.abs(relX) > 200) ? 0.3 : 0.85);
            let targetX = willSave ? centerX + (dX * 1000) : (dX > 0 ? centerX - 300 : centerX + 300);
            this.tweens.add({ targets: this.goalie, x: Phaser.Math.Clamp(targetX, centerX-400, centerX+400), duration: 350, ease: 'Cubic.out' });
        }
    });

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.trailEmitter.stop();
        if (this.cache.audio.exists('miss')) this.sound.play('miss', { volume: 0.8 });
        this.streak = 0; this.updateUI();
        this.cameras.main.shake(200, 0.01);
        this.submitScore();
        this.time.delayedCall(1500, () => {
            this.screens.finalScore.innerText = this.score;
            this.loadLeaderboard();
            this.showScreen('results');
            this.gameActive = false;
        });
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0).setAccelerationX(0).setScale(1.2);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
        this.trailEmitter.stop();
    };

    const storedToken = sessionStorage.getItem('pg_raw_token');
    if (storedToken) validateToken(storedToken);
}

function update(time, delta) {
    if (this.tutorialHand && this.tutorialHand.active && !this.tweens.isTweening(this.tutorialHand)) this.startTutorialAnimation();
    if (!this.gameActive) return;
    if (this.ball.active && this.ball.y < this.sys.game.config.height - 300) {
        const progress = Phaser.Math.Clamp(((this.sys.game.config.height - 250) - this.ball.y) / 1300, 0, 1);
        this.ball.setScale(1.2 - (progress * 0.6));
    }
    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.trailEmitter.stop();
        const isGoal = Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 300;
        if (isGoal) {
            if (this.cache.audio.exists('goal')) this.sound.play('goal', { volume: 1 });
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++; this.score += (100 * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            if (this.cache.audio.exists('miss')) this.sound.play('miss', { volume: 0.5 });
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
