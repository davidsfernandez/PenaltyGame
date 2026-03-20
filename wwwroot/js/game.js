/**
 * Penalty Challenge - Core Physics Engine
 * Based exactly on phaser-simple-soccer reference code.
 */

const FPS = 60;
const DELTA = 1 / FPS;
const BALL_DRAG = -256;
const BALL_BOUNCE = 0.5;
const BALL_RADIUS = 8;
const MAX_SHOT_POWER = 520;

class SoccerBall extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, "ball");
        this.scene.add.existing(this);
        this.scene.physics.world.enable(this);

        this.setDisplaySize(BALL_RADIUS * 4, BALL_RADIUS * 4); // Adjusted scale for visibility
        this.setCircle(this.width / 2);
        this.setBounce(BALL_BOUNCE, BALL_BOUNCE);
        this.setFrictionX(0);
        this.setDepth(3);
        this.setCollideWorldBounds(true);
    }

    preUpdate(time, delta) {
        if (this.body.speed > 0) {
            const direction = this.body.velocity.clone().normalize();
            const dragForce = (delta / 1000) * BALL_DRAG;
            const drag = new Phaser.Math.Vector2(
                direction.x * dragForce,
                direction.y * dragForce
            );
            const newVelocity = this.body.velocity.clone().add(drag);

            // Stop condition from phaser-simple-soccer
            if (
                Math.abs(newVelocity.x) > Math.abs(this.body.velocity.x) ||
                Phaser.Math.Fuzzy.Equal(newVelocity.x, 0, 0.5)
            ) {
                newVelocity.x = 0;
            }

            if (
                Math.abs(newVelocity.y) > Math.abs(this.body.velocity.y) ||
                Phaser.Math.Fuzzy.Equal(newVelocity.y, 0, 0.5)
            ) {
                newVelocity.y = 0;
            }

            this.setVelocity(newVelocity.x, newVelocity.y);
        }
    }

    kick(vector, power) {
        const direction = vector.clone().normalize();
        this.setVelocity(direction.x * power, direction.y * power);
        return this;
    }

    trap() {
        this.setVelocity(0, 0);
        this.setAngularVelocity(0);
        return this;
    }

    futurePosition(time) {
        const direction = this.body.velocity.clone().normalize();
        const dragForce = 0.5 * BALL_DRAG * time * time;
        const drag = new Phaser.Math.Vector2(
            direction.x * dragForce,
            direction.y * dragForce
        );
        const velocity = new Phaser.Math.Vector2(
            this.body.velocity.x * time,
            this.body.velocity.y * time
        );
        return new Phaser.Math.Vector2(this.x, this.y).add(velocity).add(drag);
    }
}

class Goalkeeper extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, "goalie");
        this.scene.add.existing(this);
        this.scene.physics.world.enable(this);
        
        this.setScale(1.5);
        this.setImmovable(true);
        this.body.setSize(100, 150);
        
        this.home = new Phaser.Math.Vector2(x, y);
        this.target = this.home;
        this.speedPerFrame = 3.5; // Base speed
        this.persuitOn = false;
        this.isReturning = false;
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        const force = new Phaser.Math.Vector2();
        const speedMagnitude = this.speedPerFrame * delta;

        if (this.persuitOn && this.scene.ball.body.speed > 0) {
            // Pursuit logic based on future position
            const ballSpeed = this.scene.ball.body.speed;
            const myPos = new Phaser.Math.Vector2(this.x, this.y);
            const ballPos = new Phaser.Math.Vector2(this.scene.ball.x, this.scene.ball.y);
            const magnitude = ballPos.distance(myPos);
            const lookAheadTime = ballSpeed !== 0 ? magnitude / ballSpeed : 0;
            
            // Goalkeeper targets the future position of the ball clamped to the goal line
            const fPos = this.scene.ball.futurePosition(lookAheadTime);
            this.target = new Phaser.Math.Vector2(Phaser.Math.Clamp(fPos.x, this.home.x - 200, this.home.x + 200), this.home.y);
            
            const angle = Phaser.Math.Angle.BetweenPoints(myPos, this.target);
            force.add(new Phaser.Math.Vector2(Math.cos(angle) * speedMagnitude, Math.sin(angle) * speedMagnitude));
        } else if (this.isReturning) {
            const myPos = new Phaser.Math.Vector2(this.x, this.y);
            if (myPos.distance(this.home) > 10) {
                const angle = Phaser.Math.Angle.BetweenPoints(myPos, this.home);
                force.add(new Phaser.Math.Vector2(Math.cos(angle) * speedMagnitude, Math.sin(angle) * speedMagnitude));
            } else {
                this.isReturning = false;
                this.setPosition(this.home.x, this.home.y);
                this.setVelocity(0, 0);
            }
        }

        if (force.lengthSq() > 0) {
            this.setVelocity(force.x, force.y);
        } else {
            this.setVelocity(0, 0);
        }
    }

    intercept() {
        this.persuitOn = true;
        this.isReturning = false;
    }

    returnHome() {
        this.persuitOn = false;
        this.isReturning = true;
    }
}

class PitchScene extends Phaser.Scene {
    constructor() { super("PitchScene"); }

    preload() {
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('goalie', 'assets/sprites/goalie_idle.png');
        this.load.image('pitch', 'assets/sprites/pitch.png');
    }

    create() {
        const width = this.sys.game.config.width;
        const height = this.sys.game.config.height;
        const centerX = width / 2;

        this.score = 0;
        this.isResolving = false;
        this.uiScore = document.getElementById('score-text');
        this.uiMessage = document.getElementById('message-text');

        // Environment
        this.add.tileSprite(centerX, height / 2, width, height, 'pitch').setAlpha(0.8);
        this.physics.world.setBounds(0, 0, width, height);

        // Entities
        this.goalie = new Goalkeeper(this, centerX, 150);
        this.ball = new SoccerBall(this, centerX, height - 300);

        // Input Setup (Swipe)
        this.input.on('pointerdown', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            this.startX = pointer.x;
            this.startY = pointer.y;
            this.startTime = pointer.time;
        });

        this.input.on('pointerup', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            const duration = pointer.time - this.startTime;
            if (duration < 50 || duration > 1000) return; // Prevent taps or slow drags

            const deltaX = pointer.x - this.startX;
            const deltaY = pointer.y - this.startY;

            // Must be an upward swipe
            if (deltaY < -50) {
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const swipeSpeed = distance / duration;
                
                // Cap power based on research constant
                let power = Math.min(swipeSpeed * 800, MAX_SHOT_POWER * 3); // Multiplied for scale
                
                const direction = new Phaser.Math.Vector2(deltaX, deltaY);
                
                this.ball.kick(direction, power);
                this.goalie.intercept(); // Goalie AI reacts
            }
        });

        // Rules
        this.physics.add.overlap(this.ball, this.goalie, () => {
            if (this.isResolving) return;
            this.handleResolution("¡ATAJADA!", false);
        });
    }

    update() {
        // Goal Line Detection
        if (!this.isResolving && this.ball.y < 130 && this.ball.body.speed > 0) {
            const isGoal = Math.abs(this.ball.x - (this.sys.game.config.width / 2)) < 250;
            if (isGoal) {
                this.handleResolution("¡GOL!", true);
            } else {
                this.handleResolution("¡POR FUERA!", false);
            }
        }
    }

    handleResolution(message, isGoal) {
        this.isResolving = true;
        this.ball.trap();
        this.goalie.returnHome();
        
        this.uiMessage.innerText = message;
        if (isGoal) {
            this.score += 100;
            this.uiScore.innerText = `PUNTOS: ${this.score}`;
        } else {
            this.score = 0; // Reset on miss based on client rule
            this.uiScore.innerText = `PUNTOS: ${this.score}`;
        }

        this.time.delayedCall(2000, () => {
            this.ball.setPosition(this.sys.game.config.width / 2, this.sys.game.config.height - 300);
            this.uiMessage.innerText = "";
            this.isResolving = false;
        });
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: 1080,
    height: 1920,
    backgroundColor: '#050505',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [PitchScene]
};

const game = new Phaser.Game(config);
