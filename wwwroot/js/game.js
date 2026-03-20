/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 1: Visual Identity, Typography & UI Polish
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
    console.log("[Engine] Phaser 3 Initialized. UI Polish Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    // --- State & UI Cache ---
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;

    this.screens = {
        welcome: document.getElementById('screen-welcome'),
        results: document.getElementById('screen-results'),
        hud: document.getElementById('game-hud'),
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score')
    };

    // --- UI Methods ---
    this.showScreen = (screenKey) => {
        // Hide all major screens
        this.screens.welcome.classList.remove('active');
        this.screens.results.classList.remove('active');
        
        // Show target
        if (this.screens[screenKey]) {
            this.screens[screenKey].classList.add('active');
        }
    };

    this.updateUI = () => {
        this.screens.score.innerText = this.score;
        this.screens.streak.innerText = `x${this.streak}`;
    };

    // --- Interaction Bindings ---
    document.getElementById('btn-start').onclick = () => {
        this.showScreen('none'); // Hide all screens
        this.screens.hud.classList.remove('hidden');
        this.gameActive = true;
    };

    document.getElementById('btn-restart').onclick = () => {
        this.score = 0;
        this.streak = 0;
        this.updateUI();
        this.resetMatch();
        this.showScreen('none');
        this.gameActive = true;
    };

    // --- World Objects ---
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);

    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5);
    this.goalie.setImmovable(true);

    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2);
    this.ball.setCollideWorldBounds(true).setBounce(0.5).setDrag(150);
    this.ball.body.setCircle(32);

    // --- Mechanics ---
    this.moveGoalie = () => {
        const targetX = Phaser.Math.Between(centerX - 350, centerX + 350);
        this.tweens.add({ targets: this.goalie, x: targetX, duration: 400, ease: 'Cubic.easeOut' });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        
        // Fail transition (Domain 45)
        this.cameras.main.shake(200, 0.01);
        this.time.delayedCall(1500, () => {
            this.screens.finalScore.innerText = this.score;
            this.showScreen('results');
            this.gameActive = false;
        });
    });

    this.input.on('pointerdown', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        this.startX = pointer.x;
        this.startY = pointer.y;
        this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        const duration = pointer.time - this.startTime;
        const deltaY = pointer.y - this.startY;

        if (duration < 1000 && deltaY < -80) {
            this.ball.setVelocity((pointer.x - this.startX) * 6, deltaY * 6);
            this.moveGoalie();
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
    };
}

function update() {
    if (this.gameActive && !this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        
        this.cameras.main.flash(200, 0, 242, 96, 0.3);
        this.streak++;
        this.score += (100 * this.streak);
        this.updateUI();
        
        this.time.delayedCall(1500, () => this.resetMatch());
    }
}
