import { Normalizer } from './engine/normalizer.js';
import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';
import { SpatialSoundEngine } from './engine/audio.js';
import { assets } from './engine/assets.js';

class PenaltyGame {
    constructor() {
        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();
        this.audio = new SpatialSoundEngine();
        
        // UI Elements
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        this.landingScreen = document.getElementById('landing-screen');
        this.resultsScreen = document.getElementById('results-screen');
        this.hud = document.getElementById('game-hud');
        this.tutorial = document.getElementById('screen-tutorial');
        this.messageArea = document.getElementById('message-area');
        
        // State
        this.state = 'INIT'; 
        this.score = 0;
        this.streak = 0;
        this.level = 1;
        this.lastTime = 0;
        this.simulationTime = 0;
        this.screenShake = 0;
        
        this.ball = this.resetBall();
        this.goalie = { x: 0, y: 25 };
        this.aiDecision = null;
        this.interaction = { isCapturing: false, points: [] };

        this.init();
    }

    async init() {
        this.onResize();
        this.setupListeners();
        
        // Load fallback visual assets if sprites are missing
        try {
            await Promise.all([
                assets.loadImage('ball', 'assets/sprites/ball.png'),
                assets.loadImage('goalie', 'assets/sprites/goalie_idle.png')
            ]);
        } catch (e) { console.warn("[System] Using vector rendering fallbacks."); }

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
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.scale = Math.min(this.canvas.width / 1080, this.canvas.height / 1920);
    }

    setupListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        document.getElementById('auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAuth();
        });

        const start = (x, y) => {
            if (this.state === 'TUTORIAL') this.startGame();
            else if (this.state === 'PLAYING') this.handleInputStart(x, y);
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

        document.getElementById('btn-restart').onclick = () => window.location.reload();
    }

    handleAuth() {
        const input = document.getElementById('credential-input');
        if (input.value.trim() === "JUGO-2026") {
            this.audio.init();
            this.landingScreen.classList.add('hidden');
            this.tutorial.classList.remove('hidden');
            this.state = 'TUTORIAL';
        } else {
            document.getElementById('validation-error').classList.remove('hidden');
        }
    }

    startGame() {
        this.tutorial.classList.add('hidden');
        this.hud.classList.remove('hidden');
        this.state = 'PLAYING';
    }

    handleInputStart(x, y) {
        if (this.ball.active) return;
        this.interaction.isCapturing = true;
        this.interaction.points = [{ x, y, t: performance.now() }];
    }

    handleInputMove(x, y) {
        if (this.interaction.isCapturing) this.interaction.points.push({ x, y, t: performance.now() });
    }

    handleInputEnd(x, y) {
        if (!this.interaction.isCapturing) return;
        this.interaction.isCapturing = false;
        
        const pts = this.interaction.points;
        if (pts.length < 2) return;

        const start = pts[0], end = pts[pts.length - 1];
        const dur = (end.t - start.t) / 1000;
        if (dur < 0.05) return;

        const force = Normalizer.calculateNormalizedForce(end.x - start.x, end.y - start.y, this.canvas.width, this.canvas.height);
        const initial = this.physics.calculateInitialState(force, (end.x - start.x) / this.canvas.width);
        
        this.ball.vel = initial.vel;
        this.ball.spin = initial.spin;
        this.ball.active = true;
        this.simulationTime = 0;
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
            
            // Depth scale interpolation
            const progress = Math.max(0, (5 - this.ball.pos.y) / (5 - 30));
            this.ball.visualScale = Math.max(0.3, 1.0 - progress);

            this.goalie = this.ai.getPosition(this.simulationTime, this.aiDecision);

            if (this.ball.reachedTarget) this.resolveShot();
        }
        if (this.screenShake > 0) this.screenShake -= dt * 15;
    }

    resolveShot() {
        const isGoal = Math.abs(this.ball.pos.x) < 25 && this.ball.pos.y < 20;
        const isSaved = this.aiDecision.willSave;

        if (isSaved) {
            this.streak = 0;
            this.showMessage("¡ATAJADA!", "#ff4b2b");
        } else if (isGoal) {
            this.score += 100;
            this.streak++;
            this.screenShake = 10;
            this.showMessage("¡GOOOOOL!", "#00f260");
        } else {
            this.streak = 0;
            this.showMessage("¡FUERA!", "#aaa");
        }

        document.getElementById('score-value').innerText = this.score;
        document.getElementById('streak-value').innerText = `x${this.streak}`;

        setTimeout(() => {
            if (this.streak === 0 && this.score > 0) this.endSession();
            else this.ball = this.resetBall();
        }, 1500);
    }

    showMessage(txt, color) {
        this.messageArea.innerText = txt;
        this.messageArea.style.color = color;
        this.messageArea.classList.remove('hidden');
        this.messageArea.style.opacity = 1;
        setTimeout(() => { this.messageArea.style.opacity = 0; }, 1000);
    }

    async endSession() {
        this.state = 'ENDED';
        this.hud.classList.add('hidden');
        this.resultsScreen.classList.remove('hidden');
        document.getElementById('final-score-value').innerText = this.score;
        this.loadLeaderboard();
    }

    async loadLeaderboard() {
        const body = document.getElementById('leaderboard-body');
        body.innerHTML = '<tr><td colspan="3" class="text-center p-4 opacity-50">Cargando ranking...</td></tr>';
        try {
            const res = await fetch('/api/leaderboard');
            const result = await res.json();
            body.innerHTML = '';
            result.data.forEach((e, i) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td class="p-4 opacity-30 italic">#${i+1}</td><td class="p-4 font-bold">${e.alias}</td><td class="p-4 text-right text-[#00f260] font-black">${e.value}</td>`;
                body.appendChild(tr);
            });
        } catch (e) { body.innerHTML = '<tr><td colspan="3" class="text-center p-4">Ranking no disponible</td></tr>'; }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.state === 'LANDING' || this.state === 'INIT') return;

        const cx = this.canvas.width / 2, cy = this.canvas.height * 0.8;
        this.ctx.save();
        this.ctx.translate((Math.random()-0.5)*this.screenShake, (Math.random()-0.5)*this.screenShake);
        
        // Pitch
        const grd = this.ctx.createLinearGradient(0, cy, 0, this.canvas.height);
        grd.addColorStop(0, '#1a3a16'); grd.addColorStop(1, '#050505');
        this.ctx.fillStyle = grd;
        this.ctx.fillRect(0, cy, this.canvas.width, this.canvas.height - cy);

        // Goal
        const p1 = this.physics.project({x:-30, y:0, z:100}, cx, cy);
        const p2 = this.physics.project({x:-30, y:30, z:100}, cx, cy);
        const p3 = this.physics.project({x:30, y:30, z:100}, cx, cy);
        const p4 = this.physics.project({x:30, y:0, z:100}, cx, cy);
        this.ctx.strokeStyle = '#fff'; this.ctx.lineWidth = 8 * p1.scale;
        this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.lineTo(p3.x, p3.y); this.ctx.lineTo(p4.x, p4.y); this.ctx.stroke();

        // Goalie
        const gp = this.physics.project({x:this.goalie.x, y:this.goalie.y, z:100}, cx, cy);
        this.ctx.fillStyle = '#ff4b2b';
        this.ctx.shadowBlur = 15 * gp.scale; this.ctx.shadowColor = 'red';
        this.ctx.fillRect(gp.x - 40*gp.scale, gp.y - 80*gp.scale, 80*gp.scale, 120*gp.scale);
        this.ctx.shadowBlur = 0;

        // Ball
        const bp = this.physics.project(this.ball.pos, cx, cy);
        const s = this.ball.visualScale;
        this.ctx.fillStyle = '#fff';
        this.ctx.shadowBlur = 10 * s; this.ctx.shadowColor = 'white';
        this.ctx.beginPath(); this.ctx.arc(bp.x, bp.y, 25*s, 0, Math.PI*2); this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => { new PenaltyGame(); });
