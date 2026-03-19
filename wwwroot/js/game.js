import { Normalizer } from './engine/normalizer.js';
import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';

/**
 * Domain 28: Experience State Progression
 * Main Entry Point and State Orchestrator.
 */
class PenaltyGame {
    constructor() {
        // --- Engines (Phases 1 & 2) ---
        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();
        
        // --- Core UI Elements (Domain 5) ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        this.messageArea = document.getElementById('message-area');
        this.scoreValue = document.getElementById('score-value');
        
        // --- Game State (Domain 28) ---
        this.state = 'STASIS'; // STASIS, SIMULATION, JUDGMENT
        this.lastTime = 0;
        this.simulationTime = 0;
        this.score = 0;
        this.level = 1;
        
        // --- Entities ---
        this.ball = this.resetBall();
        this.goalie = { x: 0, y: 25 };
        this.aiDecision = null;
        
        // --- Interaction Data (Domain 27) ---
        this.interaction = {
            isCapturing: false,
            points: []
        };

        this.setupEventListeners();
        this.onResize();
        
        // Start the master loop (Domain 29)
        requestAnimationFrame((timestamp) => this.mainLoop(timestamp));
    }

    resetBall() {
        return {
            pos: { x: 0, y: 5, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            spin: 0,
            radius: 3,
            active: false,
            reachedTarget: false
        };
    }

    onResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.uiRoot.dataset.orientation = (this.canvas.height > this.canvas.width) ? 'portrait' : 'landscape';
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        // Input Handling (Mouse & Touch)
        const start = (x, y) => this.handleInputStart(x, y);
        const move = (x, y) => this.handleInputMove(x, y);
        const end = (x, y) => this.handleInputEnd(x, y);

        this.canvas.addEventListener('mousedown', e => start(e.clientX, e.clientY));
        window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
        window.addEventListener('mouseup', e => end(e.clientX, e.clientY));

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            start(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            move(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            end(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: false });
    }

    handleInputStart(x, y) {
        if (this.state !== 'STASIS') return;
        this.interaction.isCapturing = true;
        this.interaction.points = [{ x, y, t: performance.now() }];
    }

    handleInputMove(x, y) {
        if (!this.interaction.isCapturing) return;
        this.interaction.points.push({ x, y, t: performance.now() });
    }

    handleInputEnd(x, y) {
        if (!this.interaction.isCapturing) return;
        this.interaction.isCapturing = false;
        
        const points = this.interaction.points;
        if (points.length < 2) return;

        const start = points[0];
        const end = points[points.length - 1];
        const duration = (end.t - start.t) / 1000;
        
        if (duration < 0.05) return;

        const force = Normalizer.calculateNormalizedForce(end.x - start.x, end.y - start.y, this.canvas.width, this.canvas.height);
        
        // Curvature calculation (simplified Domain 24)
        const curvature = (end.x - start.x) / this.canvas.width; 

        const initialState = this.physics.calculateInitialState(force, curvature);
        
        this.ball.vel = initialState.vel;
        this.ball.spin = initialState.spin;
        this.ball.active = true;
        this.simulationTime = 0;
        this.state = 'SIMULATION';
        
        this.aiDecision = this.ai.decide(this.ball, this.level);
        this.messageArea.style.opacity = 0;
    }

    mainLoop(timestamp) {
        const dt = Math.min(0.032, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.mainLoop(t));
    }

    update(dt) {
        if (this.state === 'SIMULATION') {
            this.simulationTime += dt;
            this.physics.update(this.ball, dt);
            this.goalie = this.ai.getPosition(this.simulationTime, this.aiDecision);

            if (this.ball.reachedTarget) {
                this.state = 'JUDGMENT';
                this.resolveOutcome();
            }
        }
    }

    resolveOutcome() {
        const isGoal = Math.abs(this.ball.pos.x) < 20 && this.ball.pos.y < 25; // Goal plane check
        const isSaved = this.aiDecision.willSave;

        if (isSaved) {
            this.messageArea.innerText = '¡PARADÓN DEL PORTERO!';
            this.messageArea.style.color = '#ff4b2b';
        } else if (isGoal) {
            this.messageArea.innerText = '¡GOOOOOL!';
            this.messageArea.style.color = '#00f260';
            this.score += 100;
            this.scoreValue.innerText = this.score;
        } else {
            this.messageArea.innerText = '¡FUERA DEL ARCO!';
            this.messageArea.style.color = '#bdc3c7';
        }

        this.messageArea.style.opacity = 1;

        // Transition back to Stasis after buffer (Domain 45)
        setTimeout(() => {
            this.ball = this.resetBall();
            this.state = 'STASIS';
            this.messageArea.innerText = '¡DESLIZA PARA TIRAR!';
            this.messageArea.style.color = 'white';
        }, 2000);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height * 0.75;

        this.drawPitch(cx, cy);
        this.drawGoal(cx, cy);
        this.drawGoalie(cx, cy);
        this.drawBall(cx, cy);
    }

    drawPitch(cx, cy) {
        this.ctx.fillStyle = '#2d5a27';
        this.ctx.fillRect(0, cy, this.canvas.width, this.canvas.height - cy);
    }

    drawGoal(cx, cy) {
        const p1 = this.physics.project({ x: -30, y: 0, z: 100 }, cx, cy);
        const p2 = this.physics.project({ x: -30, y: 25, z: 100 }, cx, cy);
        const p3 = this.physics.project({ x: 30, y: 25, z: 100 }, cx, cy);
        const p4 = this.physics.project({ x: 30, y: 0, z: 100 }, cx, cy);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 4 * p1.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.lineTo(p4.x, p4.y);
        this.ctx.stroke();
    }

    drawGoalie(cx, cy) {
        const p = this.physics.project({ x: this.goalie.x, y: this.goalie.y, z: 100 }, cx, cy);
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 10 * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawBall(cx, cy) {
        const p = this.physics.project(this.ball.pos, cx, cy);
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, this.ball.radius * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new PenaltyGame();
});
