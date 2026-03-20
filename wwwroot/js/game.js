import { Normalizer } from './engine/normalizer.js';
import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';
import { SpatialSoundEngine } from './engine/audio.js';
import { assets } from './engine/assets.js';
import { vault } from './engine/vault.js';

/**
 * MASTER ORCHESTRATOR - High Fidelity Production Version
 * Focus: Spectacle, Functionality, and Robustness.
 */
class PenaltyGame {
    constructor() {
        // --- Core Systems ---
        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();
        this.audio = new SpatialSoundEngine();
        
        // --- UI & DOM ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        this.landingScreen = document.getElementById('landing-screen');
        this.resultsScreen = document.getElementById('results-screen');
        this.credentialInput = document.getElementById('credential-input');
        
        // --- Game State (Domain 28) ---
        this.state = 'INIT'; // INIT, LANDING, TUTORIAL, PLAYING, JUDGMENT, ENDED
        this.score = 0;
        this.streak = 0;
        this.level = 1;
        this.lastTime = 0;
        this.simulationTime = 0;
        
        // --- Entities ---
        this.baseWidth = 1080;
        this.baseHeight = 1920;
        this.scale = 1;
        this.ball = this.resetBall();
        this.goalie = { x: 0, y: 25 };
        this.aiDecision = null;
        
        // --- Effects ---
        this.screenShake = 0;
        this.interaction = { isCapturing: false, points: [] };

        this.init();
    }

    async init() {
        this.onResize();
        this.setupEventListeners();
        
        // Load high-fidelity assets (Domain 31)
        try {
            await Promise.all([
                assets.loadImage('ball', 'assets/sprites/ball.png'),
                assets.loadImage('goalie', 'assets/sprites/goalie_idle.png'),
                assets.loadImage('pitch', 'assets/sprites/pitch.png'),
                assets.loadImage('hand', 'assets/sprites/hand_icon.png')
            ]);
        } catch (e) {
            console.warn("[System] High-fidelity assets missing, using professional vector fallbacks.");
        }

        await vault.init();
        this.state = 'LANDING';
        requestAnimationFrame((t) => this.mainLoop(t));
    }

    resetBall() {
        return {
            pos: { x: 0, y: 5, z: 0 },
            vel: { x: 0, y: 0, z: 0 },
            spin: 0,
            radius: 4,
            active: false,
            reachedTarget: false,
            visualScale: 1.0
        };
    }

    onResize() {
        this.scale = Math.min(window.innerWidth / this.baseWidth, window.innerHeight / this.baseHeight);
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        // Auth Submit
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAuth();
            });
        }

        // Mouse & Touch Interaction
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
            move(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            end(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }, { passive: false });
    }

    handleAuth() {
        const token = this.credentialInput.value.trim();
        if (token === "JUGO-2026") {
            console.log("[Auth] Success. Transitioning to game...");
            this.landingScreen.classList.replace('opacity-100', 'opacity-0');
            setTimeout(() => {
                this.landingScreen.classList.add('hidden');
                this.state = 'PLAYING'; // Skipping tutorial for immediate functionality
                this.audio.init(); 
            }, 700);
        } else {
            const err = document.getElementById('validation-error');
            err.classList.remove('hidden');
        }
    }

    handleInputStart(x, y) {
        if (this.state !== 'PLAYING' || this.ball.active) return;
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

        // Normalization (Domain 27)
        const force = Normalizer.calculateNormalizedForce(end.x - start.x, end.y - start.y, this.canvas.width, this.canvas.height);
        
        const initialState = this.physics.calculateInitialState(force, (end.x - start.x) / this.canvas.width);
        
        this.ball.vel = initialState.vel;
        this.ball.spin = initialState.spin;
        this.ball.active = true;
        this.simulationTime = 0;
        this.state = 'PLAYING'; // Ensure we stay in playing mode
        
        // AI Decides now (Domain 22)
        this.aiDecision = this.ai.decide(this.ball, this.level);
    }

    mainLoop(timestamp) {
        const dt = Math.min(0.032, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.mainLoop(t));
    }

    update(dt) {
        if (this.state === 'PLAYING' && this.ball.active) {
            this.simulationTime += dt;
            this.physics.update(this.ball, dt);
            
            // Visual depth interpolation (Domain 29)
            const progress = Math.max(0, (5 - this.ball.pos.y) / (5 - 25)); // Simplified Y depth
            this.ball.visualScale = Math.max(0.3, 1.0 - progress);

            this.goalie = this.ai.getPosition(this.simulationTime, this.aiDecision);

            if (this.ball.reachedTarget) {
                this.resolveShot();
            }
        }
        
        if (this.screenShake > 0) this.screenShake -= dt * 15;
    }

    resolveShot() {
        const isGoal = Math.abs(this.ball.pos.x) < 25 && this.ball.pos.y < 20;
        const isSaved = this.aiDecision.willSave;

        if (isSaved) {
            this.streak = 0;
            console.log("¡ATAJADA!");
        } else if (isGoal) {
            this.score += 100;
            this.streak++;
            this.screenShake = 10;
            console.log("¡GOL!");
        }

        setTimeout(() => {
            this.ball = this.resetBall();
        }, 1500);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.state === 'LANDING' || this.state === 'INIT') return;

        const cx = this.canvas.width / 2;
        const cy = this.canvas.height * 0.8;

        const shakeX = (Math.random() - 0.5) * this.screenShake;
        const shakeY = (Math.random() - 0.5) * this.screenShake;

        this.ctx.save();
        this.ctx.translate(shakeX, shakeY);
        this.ctx.scale(this.scale, this.scale);

        this.drawPitch(cx, cy);
        this.drawGoal(cx, cy);
        this.drawGoalie(cx, cy);
        this.drawBall(cx, cy);

        this.ctx.restore();
    }

    drawPitch(cx, cy) {
        const grd = this.ctx.createLinearGradient(0, cy, 0, this.baseHeight);
        grd.addColorStop(0, '#1a3a16');
        grd.addColorStop(1, '#050505');
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, cy, this.baseWidth, this.baseHeight - cy);
    }

    drawGoal(cx, cy) {
        const p1 = this.physics.project({ x: -30, y: 0, z: 100 }, cx, cy);
        const p2 = this.physics.project({ x: -30, y: 30, z: 100 }, cx, cy);
        const p3 = this.physics.project({ x: 30, y: 30, z: 100 }, cx, cy);
        const p4 = this.physics.project({ x: 30, y: 0, z: 100 }, cx, cy);

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 10 * p1.scale;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x / this.scale, p1.y / this.scale);
        this.ctx.lineTo(p2.x / this.scale, p2.y / this.scale);
        this.ctx.lineTo(p3.x / this.scale, p3.y / this.scale);
        this.ctx.lineTo(p4.x / this.scale, p4.y / this.scale);
        this.ctx.stroke();
    }

    drawGoalie(cx, cy) {
        const p = this.physics.project({ x: this.goalie.x, y: this.goalie.y, z: 100 }, cx, cy);
        const img = assets.getImage('goalie');
        if (img) {
            this.ctx.drawImage(img, (p.x / this.scale) - 50, (p.y / this.scale) - 60, 100, 120);
        } else {
            this.ctx.fillStyle = '#ff4b2b';
            this.ctx.fillRect((p.x / this.scale) - 40, (p.y / this.scale) - 80, 80, 120);
        }
    }

    drawBall(cx, cy) {
        const p = this.physics.project(this.ball.pos, cx, cy);
        const img = assets.getImage('ball');
        const s = this.ball.visualScale;
        if (img) {
            this.ctx.drawImage(img, (p.x / this.scale) - (30 * s), (p.y / this.scale) - (30 * s), 60 * s, 60 * s);
        } else {
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(p.x / this.scale, p.y / this.scale, 20 * s, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new PenaltyGame();
});
