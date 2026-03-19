import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';
import { Normalizer } from './engine/normalizer.js';

/**
 * Domain 28: Experience State Progression
 * Manages the main game loop and transitions between Stasis, Simulation, and Judgment.
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.messageArea = document.getElementById('message-area');
        this.scoreValue = document.getElementById('score-value');
        this.levelValue = document.getElementById('level-value');

        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();

        this.state = 'STASIS'; // STASIS, SIMULATION, JUDGMENT
        this.score = 0;
        this.level = 1;

        this.ball = this.resetBall();
        this.goalie = { x: 0, y: 25 };
        this.aiDecision = null;
        this.simulationTime = 0;

        this.lastTime = 0;
        this.input = {
            isDown: false,
            startX: 0,
            startY: 0,
            points: []
        };

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousedown', (e) => this.handleInputStart(e.clientX, e.clientY));
        this.canvas.addEventListener('mousemove', (e) => this.handleInputMove(e.clientX, e.clientY));
        this.canvas.addEventListener('mouseup', (e) => this.handleInputEnd(e.clientX, e.clientY));

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInputStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleInputMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleInputEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: false });

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
    }

    resetBall() {
        return {
            pos: { x: 0, y: 10, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            spin: 0,
            radius: 5,
            active: false,
            reachedTarget: false
        };
    }

    handleInputStart(x, y) {
        if (this.state !== 'STASIS') return;
        this.input.isDown = true;
        this.input.startX = x;
        this.input.startY = y;
        this.input.points = [{ x, y, t: Date.now() }];
    }

    handleInputMove(x, y) {
        if (!this.input.isDown) return;
        this.input.points.push({ x, y, t: Date.now() });
    }

    handleInputEnd(x, y) {
        if (!this.input.isDown) return;
        this.input.isDown = false;

        const deltaX = x - this.input.startX;
        const deltaY = y - this.input.startY;
        const duration = (Date.now() - this.input.points[0].t) / 1000;

        if (duration < 0.05 || Math.abs(deltaY) < 20) return; // Ignore accidental taps

        // Calculate curvature (Domain 24, Section 4)
        const curvature = this.calculateCurvature(this.input.points);

        // Use Normalizer (Domain 27)
        const force = Normalizer.calculateNormalizedForce(
            deltaX, deltaY, this.canvas.width, this.canvas.height
        );

        // Map to initial state
        const initialState = this.physics.calculateInitialState({
            deltaX: force.x,
            deltaY: force.y,
            velocity: force.magnitude / duration,
            curvature: curvature
        });

        this.ball.vel = initialState.vel;
        this.ball.spin = initialState.spin;
        this.ball.active = true;
        this.state = 'SIMULATION';
        this.simulationTime = 0;
        this.messageArea.innerText = '';

        // AI Decision (Domain 22)
        // Predict where the ball will be at targetZ
        // For simplicity, we'll use a rough estimate or the actual final position if deterministic
        // Here we'll just pass the current state and let the AI decide
        this.aiDecision = this.ai.decide(this.ball, this.level);
    }

    calculateCurvature(points) {
        if (points.length < 3) return 0;
        // Simple curvature: deviation of middle point from line between start and end
        const start = points[0];
        const end = points[points.length - 1];
        const mid = points[Math.floor(points.length / 2)];

        // Distance from point to line
        const numerator = Math.abs((end.y - start.y) * mid.x - (end.x - start.x) * mid.y + end.x * start.y - end.y * start.x);
        const denominator = Math.sqrt((end.y - start.y) ** 2 + (end.x - start.x) ** 2);
        
        const deviation = denominator === 0 ? 0 : numerator / denominator;
        const side = (end.x - start.x) * (mid.y - start.y) - (end.y - start.y) * (mid.x - start.x);
        
        return (side > 0 ? 1 : -1) * (deviation / 100); // Normalized curvature
    }

    loop(time) {
        const dt = Math.min(0.1, (time - this.lastTime) / 1000);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state === 'SIMULATION') {
            this.simulationTime += dt;
            this.physics.update(this.ball, dt);

            // Update Goalie (Domain 22)
            this.goalie = this.ai.getPosition(this.simulationTime, this.aiDecision);

            if (!this.ball.active) {
                this.state = 'JUDGMENT';
                this.judge();
            }
        }
    }

    judge() {
        const isGoal = this.checkGoal();
        const isSaved = this.checkSave();

        if (isSaved) {
            this.messageArea.innerText = '¡PARADA!';
            this.messageArea.style.color = '#ff4444';
        } else if (isGoal) {
            this.messageArea.innerText = '¡GOOOL!';
            this.messageArea.style.color = '#44ff44';
            this.score += 100;
            this.scoreValue.innerText = this.score;
            if (this.score % 500 === 0) {
                this.level++;
                this.levelValue.innerText = this.level;
            }
        } else {
            this.messageArea.innerText = '¡FUERA!';
            this.messageArea.style.color = '#aaaaaa';
        }

        setTimeout(() => {
            this.ball = this.resetBall();
            this.state = 'STASIS';
            this.messageArea.innerText = '¡DESLIZA PARA TIRAR!';
            this.messageArea.style.color = '#ffd700';
            this.goalie = { x: 0, y: 25 };
        }, 2000);
    }

    checkGoal() {
        // Goal dimensions: width 100, height 50, centered at x=0, y=0 to 50
        return Math.abs(this.ball.pos.x) < 50 && this.ball.pos.y > 0 && this.ball.pos.y < 50;
    }

    checkSave() {
        if (!this.aiDecision.willSave) return false;
        
        // Simple collision check between ball and goalie at the goal plane
        const dist = Math.sqrt((this.ball.pos.x - this.goalie.x) ** 2 + (this.ball.pos.y - this.goalie.y) ** 2);
        return dist < 15; // Goalie reach radius
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height * 0.8;

        // Draw Goal
        this.drawGoal(centerX, centerY);

        // Draw Goalie
        this.drawGoalie(centerX, centerY);

        // Draw Ball
        this.drawBall(centerX, centerY);
    }

    drawGoal(centerX, centerY) {
        const p1 = this.physics.project({ x: -50, y: 0, z: 100 }, centerX, centerY);
        const p2 = this.physics.project({ x: -50, y: 50, z: 100 }, centerX, centerY);
        const p3 = this.physics.project({ x: 50, y: 50, z: 100 }, centerX, centerY);
        const p4 = this.physics.project({ x: 50, y: 0, z: 100 }, centerX, centerY);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 5 * p1.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.lineTo(p4.x, p4.y);
        this.ctx.stroke();
    }

    drawGoalie(centerX, centerY) {
        const p = this.physics.project({ x: this.goalie.x, y: this.goalie.y, z: 100 }, centerX, centerY);
        
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 15 * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Body
        this.ctx.fillRect(p.x - 10 * p.scale, p.y, 20 * p.scale, 30 * p.scale);
    }

    drawBall(centerX, centerY) {
        const p = this.physics.project(this.ball.pos, centerX, centerY);
        
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, this.ball.radius * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Shadow
        const s = this.physics.project({ x: this.ball.pos.x, y: 0, z: this.ball.pos.z }, centerX, centerY);
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(s.x, s.y, this.ball.radius * s.scale, this.ball.radius * 0.5 * s.scale, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

// Start the game
new Game();
