/**
 * Penalty Challenge - Main Game Orchestrator
 * Phase 2: Professional Physics & AI Injection (Ref: phaser-simple-soccer)
 */

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() { this.scene.start('PreloadScene'); }
}

class PreloadScene extends Phaser.Scene {
    constructor() { super('PreloadScene'); }
    preload() {
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('goalie', 'assets/sprites/goalie_idle.png');
        this.load.image('pitch', 'assets/sprites/pitch.png');
        this.load.image('hand', 'assets/sprites/hand_icon.png');
        this.load.audio('kick', 'assets/audio/kick.mp3');
        this.load.audio('goal', 'assets/audio/goal.mp3');
        this.load.audio('miss', 'assets/audio/miss.mp3');
    }
    create() { this.scene.start('MenuScene'); }
}

class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }
    create() {
        this.showScreen('welcome');
        const btnStart = document.getElementById('btn-start');
        btnStart.onclick = () => this.handleAuth();
    }
    async handleAuth() {
        const input = document.getElementById('credential-input');
        const token = input.value.trim();
        const error = document.getElementById('validation-error');
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                this.game.registry.set('sessionToken', data.token);
                this.game.registry.set('securitySeal', data.seal);
                sessionStorage.setItem('pg_raw_token', token);
                this.scene.start('TutorialScene');
            } else { error.style.display = 'block'; }
        } catch (e) { error.style.display = 'block'; }
    }
    showScreen(key) {
        ['welcome', 'results', 'tutorial', 'pause'].forEach(s => {
            const el = document.getElementById(`screen-${s}`);
            if (el) el.classList.remove('active');
        });
        const target = document.getElementById(`screen-${key}`);
        if (target) target.classList.add('active');
    }
}

class TutorialScene extends Phaser.Scene {
    constructor() { super('TutorialScene'); }
    create() {
        document.getElementById('screen-tutorial').classList.add('active');
        this.input.once('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        const { width, height } = this.sys.game.config;
        const centerX = width / 2;
        
        // UI Setup
        document.getElementById('screen-tutorial').classList.remove('active');
        document.getElementById('game-hud').classList.remove('hidden');

        // World Objects
        this.add.tileSprite(centerX, height / 2, width, height, 'pitch').setAlpha(0.8);
        
        // Goalie (Ref: Interpose Behavior)
        this.goalie = this.physics.add.sprite(centerX, 400, 'goalie').setScale(1.5).setImmovable(true);
        this.goalie.body.setSize(120, 180);

        // Ball (Ref: Vectorial Friction)
        this.ball = this.physics.add.sprite(centerX, height - 250, 'ball').setScale(1.2);
        this.ball.setCollideWorldBounds(true).setBounce(0.4);
        this.ball.body.setCircle(32);

        // State
        this.isResolving = false;
        this.ballDrag = -256; // Constante extraída del análisis de referencia

        // --- Interaction ---
        this.input.on('pointerdown', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
        });

        this.input.on('pointerup', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            const duration = pointer.time - this.startTime;
            const dX = (pointer.x - this.startX) / width;
            const dY = (pointer.y - this.startY) / height;

            if (duration > 50 && dY < -0.05) {
                this.ball.setVelocity(dX * 13000, dY * 13000);
                if (this.cache.audio.exists('kick')) this.sound.play('kick', { volume: 0.6 });
                
                // Goalie Reaction
                this.moveGoalie(centerX + (dX * 1000));
            }
        });

        this.physics.add.overlap(this.ball, this.goalie, () => this.handleSave());
    }

    moveGoalie(predictedX) {
        const willSave = Math.random() < 0.5; // Probabilidad base
        let targetX = willSave ? predictedX : (predictedX > 540 ? predictedX - 300 : predictedX + 300);
        
        this.tweens.add({
            targets: this.goalie,
            x: Phaser.Math.Clamp(targetX, 200, 880),
            duration: 350,
            ease: 'Cubic.easeOut'
        });
    }

    handleSave() {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.cameras.main.shake(200, 0.01);
        if (this.cache.audio.exists('miss')) this.sound.play('miss');
        this.time.delayedCall(2000, () => this.resetMatch());
    }

    resetMatch() {
        const { width, height } = this.sys.game.config;
        this.ball.setPosition(width / 2, height - 250).setVelocity(0, 0);
        this.goalie.setPosition(width / 2, 400);
        this.isResolving = false;
    }

    update(time, delta) {
        // --- Ref: Vectorial Drag Implementation ---
        if (this.ball.body.speed > 0) {
            const dragForce = (delta / 1000) * this.ballDrag;
            const direction = this.ball.body.velocity.clone().normalize();
            this.ball.body.velocity.x += direction.x * dragForce;
            this.ball.body.velocity.y += direction.y * dragForce;

            // Stop threshold to avoid jitter
            if (this.ball.body.speed < 10) this.ball.setVelocity(0, 0);
        }

        // Goal Detection
        if (!this.isResolving && this.ball.y < 250) {
            this.handleGoal();
        }
    }

    handleGoal() {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        if (this.cache.audio.exists('goal')) this.sound.play('goal');
        this.cameras.main.flash(200, 0, 242, 96, 0.3);
        this.time.delayedCall(2000, () => this.resetMatch());
    }
}

class ResultScene extends Phaser.Scene {
    constructor() { super('ResultScene'); }
    create() {}
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1080,
    height: 1920,
    backgroundColor: '#050505',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [BootScene, PreloadScene, MenuScene, TutorialScene, GameScene, ResultScene]
};

const game = new Phaser.Game(config);
