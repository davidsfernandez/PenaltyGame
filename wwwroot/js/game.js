/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase A: Spatial Audio Integration
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

    // --- Phase A: Spatial Audio Assets ---
    this.load.audio('kick', 'https://labs.phaser.io/assets/audio/SoundEffects/squit.mp3');
    this.load.audio('goal', 'https://labs.phaser.io/assets/audio/SoundEffects/success.mp3');
    this.load.audio('miss', 'https://labs.phaser.io/assets/audio/SoundEffects/p-achoo.mp3');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Spatial Audio Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;
    this.sessionToken = null;

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

    // --- Domain 35: Spatial Audio Implementation ---
    this.playSpatialSound = (key, x, volume = 1.0) => {
        // Calculate pan: -1 (Left) to 1 (Right)
        const pan = (x - centerX) / (this.sys.game.config.width / 2);
        this.sound.play(key, { volume: volume, pan: Phaser.Math.Clamp(pan, -1, 1) });
    };

    this.showMasteryText = (x, y, message, color = '#00f260') => {
        const text = this.add.text(x, y, message, {
            fontFamily: '"Bebas Neue", cursive',
            fontSize: '120px',
            color: color,
            stroke: '#000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: text,
            y: y - 150,
            alpha: 0,
            duration: 1000,
            ease: 'Cubic.easeOut',
            onComplete: () => text.destroy()
        });
    };

    // --- Interaction & Auth ---
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
                sessionStorage.setItem('pg_raw_token', token);
                this.showScreen('tutorial');
                this.gameActive = false;
            } else {
                this.screens.error.classList.remove('hidden');
            }
        } catch (e) { this.screens.error.classList.remove('hidden'); }
    };

    document.getElementById('btn-start').onclick = () => validateToken(this.screens.input.value.trim());
    document.getElementById('btn-restart').onclick = () => window.location.reload();

    // World
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch').setAlpha(0.8);
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5).setImmovable(true);
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2).setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);

    this.tutorialHand = this.add.sprite(centerX, bottomY, 'hand').setScale(1.5).setAlpha(0).setDepth(100);

    this.startTutorialAnimation = () => {
        this.tutorialHand.setAlpha(1);
        this.tweens.add({
            targets: this.tutorialHand,
            y: bottomY - 450,
            alpha: { from: 1, to: 0 },
            duration: 2000,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onRepeat: () => { this.tutorialHand.y = bottomY; this.tutorialHand.alpha = 1; }
        });
    };

    this.stopTutorial = () => {
        this.tweens.killTweensOf(this.tutorialHand);
        this.tutorialHand.destroy();
        this.showScreen('none');
        this.screens.hud.classList.remove('hidden');
        this.gameActive = true;
    };

    const storedToken = sessionStorage.getItem('pg_raw_token');
    if (storedToken) validateToken(storedToken);

    this.input.on('pointerdown', (pointer) => {
        if (this.tutorialHand && this.tutorialHand.active) { this.stopTutorial(); return; }
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
            
            // Spatial Kick Sound
            this.playSpatialSound('kick', pointer.x, 0.6);

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
        
        // Spatial Save Sound
        this.playSpatialSound('miss', this.ball.x, 0.8);
        
        this.streak = 0;
        this.updateUI();
        this.cameras.main.shake(200, 0.01);
        this.time.delayedCall(1500, () => this.resetMatch());
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
        
        const relX = this.ball.x - (this.sys.game.config.width / 2);
        const isGoal = Math.abs(relX) < 300;

        if (isGoal) {
            // Spatial Goal Sound
            this.playSpatialSound('goal', this.ball.x, 1.0);
            
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++;
            
            let msg = "¡GOL!";
            let color = "#00f260";
            let points = 100;

            if (Math.abs(relX) > 200) {
                msg = "¡GOLAZO!"; color = "#00d2ff"; points = 500;
            } else if (this.streak >= 3) {
                msg = "¡IMPARABLE!"; color = "#ffcc00";
            }

            this.showMasteryText(this.ball.x, this.ball.y, msg, color);
            this.score += (points * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            this.playSpatialSound('miss', this.ball.x, 0.5);
            this.showMasteryText(this.ball.x, this.ball.y, "¡POR FUERA!", "#ff4b2b");
            this.time.delayedCall(1500, () => {
                this.screens.finalScore.innerText = this.score;
                this.showScreen('results');
                this.gameActive = false;
            });
        }
    }
}
