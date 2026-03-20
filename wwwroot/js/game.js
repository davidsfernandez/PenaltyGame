/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 1: Visual Juice & Particles
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
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
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
    // Use ball as a generic particle source
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Adding Visual Juice.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    this.isResolving = false;

    // --- HUD Setup ---
    this.score = 0;
    this.streak = 0;
    this.scoreDisplay = document.getElementById('score-display');
    this.streakDisplay = document.getElementById('streak-display');

    this.updateUI = () => {
        if (this.scoreDisplay) this.scoreDisplay.innerText = this.score;
        if (this.streakDisplay) this.streakDisplay.innerText = `x${this.streak}`;
    };

    // 1. Scene Setup
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);

    // 2. Particle Systems (Phaser Native)
    // Ball Trail
    this.trailEmitter = this.add.particles(0, 0, 'ball', {
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 400,
        blendMode: 'ADD',
        frequency: 20,
        emitting: false
    });

    // Success Burst (Goal)
    this.goalEmitter = this.add.particles(0, 0, 'ball', {
        speed: { min: 200, max: 600 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 800,
        gravityY: 300,
        blendMode: 'ADD',
        emitting: false
    });

    // 3. Game Entities
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5);
    this.goalie.setImmovable(true);
    this.goalie.body.setSize(120, 180);

    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2);
    this.ball.setCollideWorldBounds(true).setBounce(0.5).setDrag(150);
    this.ball.body.setCircle(32);
    
    this.trailEmitter.startFollow(this.ball);

    // --- Interaction & AI ---
    this.moveGoalie = () => {
        const targetX = Phaser.Math.Between(centerX - 350, centerX + 350);
        this.tweens.add({ targets: this.goalie, x: targetX, duration: 400, ease: 'Cubic.easeOut' });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        this.trailEmitter.stop();
        this.streak = 0;
        this.updateUI();
        this.cameras.main.shake(200, 0.01); // Minimal shake for impact
        this.time.delayedCall(2000, () => this.resetMatch());
    });

    this.input.on('pointerdown', (pointer) => {
        if (this.isResolving) return;
        this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (this.isResolving) return;
        const duration = pointer.time - this.startTime;
        const deltaY = pointer.y - this.startY;

        if (duration < 1000 && deltaY < -80) {
            this.ball.setVelocity((pointer.x - this.startX) * 6, deltaY * 6);
            this.trailEmitter.start();
            this.moveGoalie();
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
        this.trailEmitter.stop();
    };
}

function update() {
    // Goal Detection
    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        this.trailEmitter.stop();

        // Goal Burst Effect (Domain 41)
        this.goalEmitter.emitParticleAt(this.ball.x, this.ball.y, 20);
        this.cameras.main.shake(400, 0.02); // Stronger shake for goal success
        this.cameras.main.flash(200, 0, 242, 96, 0.3); // Goal color flash

        this.streak++;
        this.score += (100 * this.streak);
        this.updateUI();
        
        this.time.delayedCall(2000, () => this.resetMatch());
    }
}
