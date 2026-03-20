/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 1: Visual Identity
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
    // Phase 1: Loading Real Production Assets
    this.load.image('ball', 'assets/sprites/ball.png');
    this.load.image('goalie', 'assets/sprites/goalie_idle.png');
    this.load.image('pitch', 'assets/sprites/pitch.png');
    this.load.image('hand', 'assets/sprites/hand_icon.png');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Production Assets Loaded.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    this.isResolving = false;

    // 1. Background: The Pitch (Domain 39: Texture Tiling)
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8); // Dimming for better focus

    // 2. Defensive Entity: Goalie (Professional Sprite)
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie');
    this.goalie.setImmovable(true);
    this.goalie.setScale(1.5); // Adjusting size for the 1080p area
    this.goalie.body.setSize(120, 180); // Precise collision box

    // 3. Interactive Projectile: Ball (Professional Sprite)
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball');
    this.ball.setCollideWorldBounds(true);
    this.ball.setBounce(0.5);
    this.ball.setDrag(150);
    this.ball.setScale(1.2);
    this.ball.body.setCircle(32); // Circular collision for the ball

    // AI Logic
    this.moveGoalie = () => {
        const targetX = Phaser.Math.Between(centerX - 350, centerX + 350);
        this.tweens.add({
            targets: this.goalie,
            x: targetX,
            duration: 400,
            ease: 'Cubic.easeOut'
        });
    };

    // Collision Detection
    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        console.log("¡ATAJADA!");
        this.time.delayedCall(2000, () => this.resetMatch());
    });

    // Interaction Loop
    this.input.on('pointerdown', (pointer) => {
        if (this.isResolving) return;
        this.startX = pointer.x;
        this.startY = pointer.y;
        this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (this.isResolving || this.ball.active === false) return;
        const duration = pointer.time - this.startTime;
        const deltaX = pointer.x - this.startX;
        const deltaY = pointer.y - this.startY;

        if (duration < 1000 && deltaY < -80) {
            this.ball.setVelocity(deltaX * 6, deltaY * 6);
            this.moveGoalie();
            console.log("[Interaction] Shot fired with real assets.");
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY);
        this.ball.setVelocity(0, 0);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
    };
}

function update() {
    // Scoring Logic (Goal detection)
    if (!this.isResolving && this.ball.y < 200) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        console.log("¡GOL!");
        this.time.delayedCall(2000, () => this.resetMatch());
    }
}
