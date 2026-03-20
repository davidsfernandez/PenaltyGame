/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase B: Integrity Trust Shield
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
    console.log("[Engine] Phaser 3 Initialized. Security & Integrity Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;
    
    // Auth and Session State (Domain 11 & 12)
    this.sessionToken = null;
    this.securitySeal = null;
    this.sessionSeed = "mocked-seed"; // Will be updated on login

    // UI Cache
    this.screens = {
        welcome: document.getElementById('screen-welcome'),
        results: document.getElementById('screen-results'),
        hud: document.getElementById('game-hud'),
        tutorial: document.getElementById('screen-tutorial'),
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score'),
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

    // --- Domain 12: Trust Signature & Integrity ---
    this.generateSignature = async (score) => {
        // Simple mathematical pact: Hash(Seed + Score + Seal)
        const rawData = `${this.sessionSeed}_${score}_${this.securitySeal}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(rawData);
        
        // Native Web Crypto API (No over-engineering)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.ToString(16).padStart(2, '0')).join('');
    };

    // --- Domain 33: Persistence & Resilience ---
    this.submitScore = async () => {
        if (!this.sessionToken || this.score === 0) return;

        try {
            const rawToken = sessionStorage.getItem('pg_raw_token');
            // Create the signature pact before sending (Domain 12)
            const signature = await this.generateSignature(this.score);

            const payload = { 
                credential: rawToken, 
                score: this.score,
                signature: signature // The pact
            };

            await fetch('/api/results', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${this.sessionToken}` 
                },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error("[API] Resilient submission failed."); }
    };

    // Interaction & Logic
    const validateToken = async (token) => {
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });
            if (response.ok) {
                const data = await response.json();
                this.sessionToken = data.token;
                this.securitySeal = data.seal;
                this.sessionSeed = "seed-123"; // In prod, extract from JWT claims if possible
                sessionStorage.setItem('pg_raw_token', token);
                this.showScreen('tutorial');
                this.gameActive = false;
            } else { this.screens.error.classList.remove('hidden'); }
        } catch (e) { this.screens.error.classList.remove('hidden'); }
    };

    document.getElementById('btn-start').onclick = () => validateToken(this.screens.input.value.trim());
    document.getElementById('btn-restart').onclick = () => window.location.reload();

    // World & Audio
    this.playSpatialSound = (key, x) => {
        const pan = (x - centerX) / (this.sys.game.config.width / 2);
        this.sound.play(key, { volume: 0.8, pan: Phaser.Math.Clamp(pan, -1, 1) });
    };

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
            this.audio.init(); 
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
            this.ball.setVelocity(dX * 13000, dY * 13000);
            this.ball.setAccelerationX(dX * 2500);
            this.playSpatialSound('kick', pointer.x);
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
            this.playSpatialSound('goal', this.ball.x);
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++; this.score += (100 * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            this.playSpatialSound('miss', this.ball.x);
            this.submitScore();
            this.time.delayedCall(1500, () => {
                this.screens.finalScore.innerText = this.score;
                this.showScreen('results');
                this.gameActive = false;
            });
        }
    }
}
