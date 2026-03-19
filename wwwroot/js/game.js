import { Normalizer } from './engine/normalizer.js';
import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';
import { SpatialSoundEngine } from './engine/audio.js';

/**
 * Domain 28: Experience State Progression
 * MASTER ORCHESTRATOR
 */
class PenaltyGame {
    constructor() {
        // --- Engines ---
        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();
        this.audio = new SpatialSoundEngine();
        
        // --- DOM Elements ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        this.messageArea = document.getElementById('message-area');
        this.scoreValue = document.getElementById('score-value');
        this.levelValue = document.getElementById('level-value');
        
        // --- Session State ---
        this.state = 'STASIS'; 
        this.lastTime = 0;
        this.simulationTime = 0;
        
        // --- Mastery Metrics (Domain 43) ---
        this.score = 0;
        this.streak = 0;
        this.level = 1;
        
        // --- Entities ---
        this.ball = this.resetBall();
        this.goalie = { x: 0, y: 25 };
        this.aiDecision = null;
        
        // --- Visual Effects (Domain 41) ---
        this.screenShake = 0;
        
        this.interaction = { isCapturing: false, points: [] };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.onResize();
        
        // Lazy load audio samples
        await this.audio.loadSample('kick', 'assets/audio/kick.mp3');
        await this.audio.loadSample('goal', 'assets/audio/goal.mp3');
        await this.audio.loadSample('post', 'assets/audio/post.mp3');
        
        requestAnimationFrame((t) => this.mainLoop(t));
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
        
        const start = (x, y) => {
            this.audio.init(); // Initialize on first touch (Browser policy)
            this.handleInputStart(x, y);
        };
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
        
        if (duration < 0.05 || Math.abs(end.y - start.y) < 20) return;

        // Domain 27: Normalization
        const force = Normalizer.calculateNormalizedForce(end.x - start.x, end.y - start.y, this.canvas.width, this.canvas.height);
        
        // Simple curvature based on lateral sweep
        const curvature = (end.x - start.x) / this.canvas.width;

        const initialState = this.physics.calculateInitialState(force, curvature);
        
        this.ball.vel = initialState.vel;
        this.ball.spin = initialState.spin;
        this.ball.active = true;
        this.simulationTime = 0;
        this.state = 'SIMULATION';
        
        // Domain 22: AI Decision
        this.aiDecision = this.ai.decide(this.ball, this.level);
        
        // Feedback
        this.messageArea.style.opacity = 0;
        this.audio.play('kick', { volume: force.magnitude, pan: force.x });
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
            
            // Domain 22: Move Goalie
            this.goalie = this.ai.getPosition(this.simulationTime, this.aiDecision);

            if (this.ball.reachedTarget) {
                this.state = 'JUDGMENT';
                this.resolveOutcome();
            }
        }
        
        if (this.screenShake > 0) {
            this.screenShake -= dt * 10;
        }
    }

    resolveOutcome() {
        // Domain 23: Intersection
        const isGoal = Math.abs(this.ball.pos.x) < 25 && this.ball.pos.y < 20;
        const isSaved = this.aiDecision.willSave;

        if (isSaved) {
            this.applyFailure('¡ATAJADA ESPECTACULAR!', '#ff4b2b');
            this.streak = 0;
        } else if (isGoal) {
            this.applySuccess();
        } else {
            this.applyFailure('¡POR FUERA!', '#bdc3c7');
            this.streak = 0;
        }

        // Domain 45: Graceful Transition
        setTimeout(() => {
            this.ball = this.resetBall();
            this.state = 'STASIS';
            this.messageArea.innerText = '¡DESLIZA PARA TIRAR!';
            this.messageArea.style.color = 'white';
            this.messageArea.style.opacity = 1;
        }, 2000);
    }

    applySuccess() {
        this.streak++;
        
        // Domain 43: Progressive Scoring
        let points = 100;
        // Bonus for corners (Domain 43, Section 2.1)
        if (Math.abs(this.ball.pos.x) > 15 && this.ball.pos.y > 15) {
            points = 500;
            this.messageArea.innerText = '¡GOLAZO POR LA ESCUADRA!';
        } else {
            this.messageArea.innerText = '¡GOOOOOL!';
        }

        // Streak Multiplier
        const multiplier = 1 + (this.streak - 1) * 0.2;
        const finalPoints = Math.round(points * multiplier);
        
        this.score += finalPoints;
        this.scoreValue.innerText = this.score;
        this.messageArea.style.color = '#00f260';
        this.messageArea.style.opacity = 1;

        // Domain 41: Juice
        this.screenShake = 5;
        this.uiRoot.classList.add('goal-flash');
        setTimeout(() => this.uiRoot.classList.remove('goal-flash'), 500);
        
        this.audio.play('goal', { volume: 1.0, pitch: 1 + (this.streak * 0.05) });

        // Domain 25: Level Up
        if (this.score >= this.level * 1000) {
            this.level++;
            this.levelValue.innerText = this.level;
        }
    }

    applyFailure(msg, color) {
        this.messageArea.innerText = msg;
        this.messageArea.style.color = color;
        this.messageArea.style.opacity = 1;
        this.audio.play('post', { volume: 0.5 });
    }

    draw() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height * 0.75;

        // Apply Screen Shake (Domain 41)
        const shakeX = (Math.random() - 0.5) * this.screenShake;
        const shakeY = (Math.random() - 0.5) * this.screenShake;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);

        this.drawPitch(cx, cy);
        this.drawGoal(cx, cy);
        this.drawGoalie(cx, cy);
        this.drawBall(cx, cy);

        this.ctx.restore();
    }

    drawPitch(cx, cy) {
        const grd = this.ctx.createLinearGradient(0, cy, 0, this.canvas.height);
        grd.addColorStop(0, '#2d5a27');
        grd.addColorStop(1, '#1e3c1a');
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, cy, this.canvas.width, this.canvas.height - cy);
    }

    drawGoal(cx, cy) {
        const p1 = this.physics.project({ x: -30, y: 0, z: 100 }, cx, cy);
        const p2 = this.physics.project({ x: -30, y: 25, z: 100 }, cx, cy);
        const p3 = this.physics.project({ x: 30, y: 25, z: 100 }, cx, cy);
        const p4 = this.physics.project({ x: 30, y: 0, z: 100 }, cx, cy);

        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 4 * p1.scale;
        this.ctx.lineJoin = 'round';
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
        this.ctx.shadowBlur = 10 * p.scale;
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 12 * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    drawBall(cx, cy) {
        const p = this.physics.project(this.ball.pos, cx, cy);
        this.ctx.fillStyle = 'white';
        this.ctx.shadowBlur = 5 * p.scale;
        this.ctx.shadowColor = 'black';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, this.ball.radius * p.scale, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new PenaltyGame();
});
