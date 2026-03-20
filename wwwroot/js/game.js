/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 2: AI Goalie Refinement (DDA)
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
    console.log("[Engine] Phaser 3 Initialized. AI Refinement Phase.");

    const centerX = this.sys.game.config.width / 2;
    const bottomY = this.sys.game.config.height - 250;
    const topY = 400;
    
    this.score = 0;
    this.streak = 0;
    this.isResolving = false;
    this.gameActive = false;

    // UI Elements Mapping
    this.screens = {
        welcome: document.getElementById('screen-welcome'),
        results: document.getElementById('screen-results'),
        hud: document.getElementById('game-hud'),
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score')
    };

    this.showScreen = (screenKey) => {
        this.screens.welcome.classList.remove('active');
        this.screens.results.classList.remove('active');
        if (this.screens[screenKey]) this.screens[screenKey].classList.add('active');
    };

    this.updateUI = () => {
        this.screens.score.innerText = this.score;
        this.screens.streak.innerText = `x${this.streak}`;
    };

    // Events
    document.getElementById('btn-start').onclick = () => {
        this.showScreen('none');
        this.screens.hud.classList.remove('hidden');
        this.gameActive = true;
    };

    document.getElementById('btn-restart').onclick = () => {
        this.score = 0; this.streak = 0;
        this.updateUI();
        this.resetMatch();
        this.showScreen('none');
        this.gameActive = true;
    };

    // World Objects
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);

    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5);
    this.goalie.setImmovable(true);
    this.goalie.body.setSize(120, 180);

    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2);
    this.ball.setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);

    // --- Domain 22: AI Decision Tree ---
    this.aiDecision = { willSave: false, targetX: centerX };

    this.moveGoalie = (predictedX, predictedY) => {
        // 1. Zonal Probability Matrix (Domain 22)
        // Horizontal: Left (-350 to -150), Center (-150 to 150), Right (150 to 350)
        const relX = predictedX - centerX;
        let zoneModifier = 0.5; // Default

        if (Math.abs(relX) > 200) zoneModifier = 0.3; // Corners are harder
        else if (Math.abs(relX) < 100) zoneModifier = 0.9; // Center is easier

        // 2. Dynamic Difficulty Adjustment (Domain 25)
        // High streak increases goalie skill
        const ddaFactor = Math.min(0.2, this.streak * 0.05);
        const saveProbability = zoneModifier + ddaFactor;

        // 3. The Decision
        this.aiDecision.willSave = Math.random() < saveProbability;
        
        // 4. Execution (Tween)
        // If save: move to the ball. If fail: move away or stay late.
        let targetX = predictedX;
        if (!this.aiDecision.willSave) {
            targetX = (predictedX > centerX) ? predictedX - 300 : predictedX + 300;
        }

        this.tweens.add({
            targets: this.goalie,
            x: Phaser.Math.Clamp(targetX, centerX - 400, centerX + 400),
            duration: 350,
            ease: 'Cubic.easeOut'
        });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        
        this.streak = 0;
        this.updateUI();
        this.cameras.main.shake(200, 0.01);
        console.log("[AI] Save successful.");
        this.time.delayedCall(1500, () => this.resetMatch());
    });

    this.input.on('pointerdown', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        const duration = pointer.time - this.startTime;
        if (duration < 50) return;

        const deltaX = (pointer.x - this.startX) / this.sys.game.config.width;
        const deltaY = (pointer.y - this.startY) / this.sys.game.config.height;

        if (deltaY < -0.05) {
            const power = 12500;
            this.ball.setVelocity(deltaX * power, deltaY * power);
            this.ball.setAccelerationX(deltaX * 2500);

            // Predict ball landing position roughly (Domain 22)
            // Logic: linear projection based on velocity
            const predictedX = centerX + (deltaX * 1000); 
            this.moveGoalie(predictedX, topY);
        }
    });

    this.resetMatch = () => {
        this.ball.setPosition(centerX, bottomY).setVelocity(0, 0).setAccelerationX(0).setScale(1.2);
        this.goalie.setPosition(centerX, topY);
        this.isResolving = false;
    };
}

function update() {
    if (!this.gameActive) return;

    if (this.ball.active && this.ball.y < this.sys.game.config.height - 300) {
        const progress = Phaser.Math.Clamp(( (this.sys.game.config.height - 250) - this.ball.y) / 1300, 0, 1);
        this.ball.setScale(1.2 - (progress * 0.6));
    }

    // Goal Detection (Domain 23)
    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        
        const isWithinGoal = Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 300;

        if (isWithinGoal) {
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++;
            this.score += (100 * this.streak);
            console.log("[Logic] Goal scored.");
        } else {
            this.streak = 0;
            console.log("[Logic] Missed target.");
        }
        
        this.updateUI();
        this.time.delayedCall(1500, () => {
            if (this.streak === 0 && this.score > 0) {
                this.screens.finalScore.innerText = this.score;
                this.showScreen('results');
                this.gameActive = false;
            } else {
                this.resetMatch();
            }
        });
    }
}
