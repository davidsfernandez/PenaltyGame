/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation - Phase 4: Authenticated Result Submission
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
    console.log("[Engine] Phaser 3 Initialized. Result Persistence Phase.");

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
        score: document.getElementById('score-display'),
        streak: document.getElementById('streak-display'),
        finalScore: document.getElementById('final-score'),
        input: document.getElementById('credential-input'),
        error: document.getElementById('validation-error')
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

    // --- Phase 4: Secure Submission Logic ---
    this.submitScore = async () => {
        if (!this.sessionToken || this.score === 0) return;

        console.log("[API] Submitting final performance...");
        try {
            const rawToken = sessionStorage.getItem('pg_raw_token');
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}` // Secure link (Domain 11)
                },
                body: JSON.stringify({
                    credential: rawToken, // Server uses this to match identity
                    score: this.score
                })
            });

            if (response.ok) {
                console.log("[API] Score immortalized successfully.");
            } else {
                console.error("[API] Failed to persist score.");
            }
        } catch (error) {
            console.error("[API] Communication error during submission:", error);
        }
    };

    // --- Auth Logic (Refined from Phase 3) ---
    this.validateToken = async (token) => {
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
                this.showScreen('none');
                this.screens.hud.classList.remove('hidden');
                this.gameActive = true;
            } else {
                this.screens.error.classList.remove('hidden');
                sessionStorage.removeItem('pg_raw_token');
            }
        } catch (error) { this.screens.error.classList.remove('hidden'); }
    };

    document.getElementById('btn-start').onclick = () => {
        this.validateToken(this.screens.input.value.trim());
    };

    const storedToken = sessionStorage.getItem('pg_raw_token');
    if (storedToken) this.validateToken(storedToken);

    document.getElementById('btn-restart').onclick = () => window.location.reload();

    // World
    this.pitch = this.add.tileSprite(centerX, this.sys.game.config.height / 2, 1080, 1920, 'pitch');
    this.pitch.setAlpha(0.8);
    this.goalie = this.physics.add.sprite(centerX, topY, 'goalie').setScale(1.5);
    this.goalie.setImmovable(true);
    this.ball = this.physics.add.sprite(centerX, bottomY, 'ball').setScale(1.2);
    this.ball.setCollideWorldBounds(true).setBounce(0.4).setDrag(180);
    this.ball.body.setCircle(32);

    this.moveGoalie = (predictedX) => {
        const relX = predictedX - centerX;
        let zoneModifier = (Math.abs(relX) > 200) ? 0.3 : (Math.abs(relX) < 100 ? 0.9 : 0.5);
        const ddaFactor = Math.min(0.2, this.streak * 0.05);
        const willSave = Math.random() < (zoneModifier + ddaFactor);
        let targetX = willSave ? predictedX : (predictedX > centerX ? predictedX - 300 : predictedX + 300);
        this.tweens.add({ targets: this.goalie, x: Phaser.Math.Clamp(targetX, centerX - 400, centerX + 400), duration: 350, ease: 'Cubic.easeOut' });
    };

    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        this.cameras.main.shake(200, 0.01);
        
        // Save and Transition
        this.submitScore(); // Async trigger
        this.time.delayedCall(1500, () => {
            this.screens.finalScore.innerText = this.score;
            this.showScreen('results');
            this.gameActive = false;
        });
    });

    this.input.on('pointerdown', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        this.startX = pointer.x; this.startY = pointer.y; this.startTime = pointer.time;
    });

    this.input.on('pointerup', (pointer) => {
        if (!this.gameActive || this.isResolving) return;
        if (pointer.time - this.startTime < 50) return;
        const dX = (pointer.x - this.startX) / this.sys.game.config.width;
        const dY = (pointer.y - this.startY) / this.sys.game.config.height;
        if (dY < -0.05) {
            const p = 12500;
            this.ball.setVelocity(dX * p, dY * p);
            this.ball.setAccelerationX(dX * 2500);
            this.moveGoalie(centerX + (dX * 1000));
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
    if (!this.isResolving && this.ball.y < 250) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0).setAccelerationX(0);
        if (Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 300) {
            this.cameras.main.flash(200, 0, 242, 96, 0.3);
            this.streak++;
            this.score += (100 * this.streak);
            this.updateUI();
            this.time.delayedCall(1500, () => this.resetMatch());
        } else {
            // Missed: Resolve game
            this.submitScore();
            this.time.delayedCall(1500, () => {
                this.screens.finalScore.innerText = this.score;
                this.showScreen('results');
                this.gameActive = false;
            });
        }
    }
}
