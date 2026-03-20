/**
 * Penalty Challenge - Main Game Orchestrator
 * Pure Phaser 3 Implementation
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
    this.load.image('ball', 'https://labs.phaser.io/assets/sprites/shinyball.png');
    this.load.image('goalie', 'https://labs.phaser.io/assets/sprites/block.png');
}

function create() {
    console.log("[Engine] Phaser 3 Initialized. World Ready.");

    this.centerX = this.sys.game.config.width / 2;
    this.bottomY = this.sys.game.config.height - 200;
    this.topY = 300;
    this.isResolving = false; // Bandera para evitar múltiples detecciones

    // Entidades
    this.goalie = this.physics.add.sprite(this.centerX, this.topY, 'goalie');
    this.goalie.setImmovable(true);

    this.ball = this.physics.add.sprite(this.centerX, this.bottomY, 'ball');
    this.ball.setCollideWorldBounds(true);
    this.ball.setBounce(0.5);
    this.ball.setDrag(100);

    // Prompt 4: Logic to move the goalie
    this.moveGoalie = () => {
        const targetX = Phaser.Math.Between(this.centerX - 300, this.centerX + 300);
        this.tweens.add({
            targets: this.goalie,
            x: targetX,
            duration: 300,
            ease: 'Power2'
        });
    };

    // Prompt 4: Detección de atajada (Overlap)
    this.physics.add.overlap(this.ball, this.goalie, () => {
        if (this.isResolving) return;
        this.isResolving = true;

        this.ball.setVelocity(0, 0);
        console.log("¡ATAJADA!");

        this.time.delayedCall(2000, () => this.resetBall());
    });

    // Lógica de Swipe
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

        if (duration < 1000 && deltaY < -50) {
            this.ball.setVelocity(deltaX * 5, deltaY * 5);
            this.moveGoalie(); // IA call
            console.log("[Interaction] Shot performed.");
        }
    });

    // Función de reinicio
    this.resetBall = () => {
        this.ball.setPosition(this.centerX, this.bottomY);
        this.ball.setVelocity(0, 0);
        this.goalie.setPosition(this.centerX, this.topY);
        this.isResolving = false;
    };
}

function update() {
    // Prompt 4: Verificación de Gol
    if (!this.isResolving && this.ball.y < 150) {
        this.isResolving = true;
        this.ball.setVelocity(0, 0);
        console.log("¡GOL!");

        this.time.delayedCall(2000, () => this.resetBall());
    }
}
