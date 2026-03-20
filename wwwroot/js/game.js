/**
 * Penalty Challenge - Main Game Orchestrator
 * Phase 3: Zonal AI & Dynamic Difficulty Adjustment (DDA)
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
        document.getElementById('btn-start').onclick = () => this.handleAuth();
    }
    async handleAuth() {
        const input = document.getElementById('credential-input');
        const token = input.value.trim();
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                this.game.registry.set('sessionToken', data.token);
                this.game.registry.set('securitySeal', data.seal);
                sessionStorage.setItem('pg_raw_token', token);
                this.scene.start('TutorialScene');
            } else { document.getElementById('validation-error').style.display = 'block'; }
        } catch (e) { document.getElementById('validation-error').style.display = 'block'; }
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
        this.input.once('pointerdown', () => this.scene.start('GameScene'));
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        const { width, height } = this.sys.game.config;
        const centerX = width / 2;
        
        this.score = 0;
        this.streak = 0;
        this.isResolving = false;
        this.ballDrag = -256;

        document.getElementById('screen-tutorial').classList.remove('active');
        document.getElementById('game-hud').classList.remove('hidden');

        this.add.tileSprite(centerX, height / 2, width, height, 'pitch').setAlpha(0.8);
        this.goalie = this.physics.add.sprite(centerX, 400, 'goalie').setScale(1.5).setImmovable(true);
        this.goalie.body.setSize(120, 180);

        this.ball = this.physics.add.sprite(centerX, height - 250, 'ball').setScale(1.2);
        this.ball.setCollideWorldBounds(true).setBounce(0.4);
        this.ball.body.setCircle(32);

        this.input.on('pointerup', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            const dX = (pointer.x - pointer.downX) / width;
            const dY = (pointer.y - pointer.downY) / height;

            if (dY < -0.05) {
                this.ball.setVelocity(dX * 13000, dY * 13000);
                if (this.cache.audio.exists('kick')) this.sound.play('kick', { volume: 0.6 });
                this.moveGoalie(centerX + (dX * 1000));
            }
        });

        this.physics.add.overlap(this.ball, this.goalie, () => this.handleSave());
    }

    // --- Domain 22 & 25: Zonal AI Decision Tree ---
    moveGoalie(predictedX) {
        const centerX = this.sys.game.config.width / 2;
        const relX = predictedX - centerX;
        
        // 1. Zonal Probability Matrix
        // Corners: abs(relX) > 250 -> 35% chance
        // Center: abs(relX) < 150 -> 85% chance
        let baseProb = 0.6;
        if (Math.abs(relX) > 250) baseProb = 0.35;
        else if (Math.abs(relX) < 150) baseProb = 0.85;

        // 2. DDA Factor (Streak increases goalie skill)
        const ddaModifier = Math.min(0.15, this.streak * 0.05);
        const finalProb = baseProb + ddaModifier;

        const willSave = Math.random() < finalProb;
        let targetX = willSave ? predictedX : (predictedX > centerX ? predictedX - 350 : predictedX + 350);

        this.tweens.add({
            targets: this.goalie,
            x: Phaser.Math.Clamp(targetX, centerX - 400, centerX + 400),
            duration: 350 - (this.streak * 10), // Reacts faster on high streaks
            ease: 'Cubic.easeOut'
        });
    }

    handleSave() {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        this.streak = 0;
        this.updateUI();
        this.showMasteryText(this.ball.x, this.ball.y, "¡ATAJADA!", "#ffcc00");
        if (this.cache.audio.exists('miss')) this.sound.play('miss');
        this.time.delayedCall(2000, () => this.resetMatch());
    }

    handleGoal() {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        this.streak++;
        
        const relX = Math.abs(this.ball.x - (this.sys.game.config.width / 2));
        let msg = "¡GOL!";
        let color = "#00f260";
        let points = 100;

        if (relX > 250) { msg = "¡GOLAZO!"; color = "#00d2ff"; points = 500; }
        else if (this.streak >= 3) { msg = "¡IMPARABLE!"; color = "#ffcc00"; }

        this.score += (points * this.streak);
        this.updateUI();
        this.showMasteryText(this.ball.x, this.ball.y, msg, color);
        
        if (this.cache.audio.exists('goal')) this.sound.play('goal');
        this.cameras.main.flash(200, 0, 242, 96, 0.3);
        this.time.delayedCall(2000, () => this.resetMatch());
    }

    showMasteryText(x, y, msg, color) {
        const txt = this.add.text(x, y - 50, msg, { fontFamily: 'Bebas Neue', fontSize: '100px', color: color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: y - 150, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
    }

    updateUI() {
        document.getElementById('score-display').innerText = this.score;
        document.getElementById('streak-display').innerText = `x${this.streak}`;
    }

    resetMatch() {
        const { width, height } = this.sys.game.config;
        this.ball.setPosition(width / 2, height - 250).setVelocity(0, 0);
        this.goalie.setPosition(width / 2, 400);
        this.isResolving = false;
    }

    update(time, delta) {
        if (this.ball.body.speed > 0) {
            const drag = (delta / 1000) * this.ballDrag;
            const dir = this.ball.body.velocity.clone().normalize();
            this.ball.body.velocity.x += dir.x * drag;
            this.ball.body.velocity.y += dir.y * drag;
            if (this.ball.body.speed < 10) this.ball.setVelocity(0, 0);
        }
        if (!this.isResolving && this.ball.y < 250) this.handleGoal();
    }
}

class ResultScene extends Phaser.Scene { constructor() { super('ResultScene'); } create() {} }

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
