/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 1: Visual Identity & HUD
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
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. Production Assets Loaded.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    // --- Internal State ---
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;

    // --- DOM Elements Cache ---
    this.scoreDisplay = document.getElementById('score-display');
    this.streakDisplay = document.getElementById('streak-display');

    this.updateUI = () => {
        if (this.scoreDisplay) this.scoreDisplay.innerText = this.score;
        if (this.streakDisplay) this.streakDisplay.innerText = `x${this.streak}`;
    };

    // 1. Background
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);

    // 2. Goalie
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie');
    this.goalie.setImmovable(true);
    this.goalie.setScale(1.5);
    this.goalie.body.setSize(120, 180);

    // 3. Ball
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball');
    this.ball.setCollideWorldBounds(true);
    this.ball.setBounce(0.5);
    this.ball.setDrag(150);
    this.ball.setScale(1.2);
    this.ball.body.setCircle(32);

    this.moveGoalie = () => {
        const targetX = Phaser.Math.Between(centerX - 350, centerX + 350);
        this.tweens.add({
            targets: this.goalie,
            x: targetX,
            duration: 400,
            ease: 'Cubic.easeOut'
        });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        
        // Reset Streak on Save
        this.streak = 0;
        this.updateUI();
        
        console.log("¡ATAJADA!");
        this.time.delayedCall(2000, () => this.resetMatch());
    });

    this.input.on('pointerdown', (pointer) => {
        if (this.isResolving) return;
        this.startX = pointer.x;
        this.startY = pointer.y;
        this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (this.isResolving) return;
        const duration = pointer.time - this.startTime;
        const deltaX = pointer.x - this.startX;
        const deltaY = pointer.y - this.startY;

        if (duration < 1000 && deltaY < -80) {
            this.ball.setVelocity(deltaX * 6, deltaY * 6);
            this.moveGoalie();
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
    if (!this.isResolving && this.ball.y < 200) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        
        // Success Logic: Increment Score and Streak
        this.streak++;
        this.score += (100 * this.streak);
        this.updateUI();
        
        console.log("¡GOL!");
        this.time.delayedCall(2000, () => this.resetMatch());
    }
}
