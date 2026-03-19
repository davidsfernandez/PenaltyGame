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
        
        // UI Cache
        this.screens = {
            landing: document.getElementById('screen-landing'),
            tutorial: document.getElementById('screen-tutorial'),
            results: document.getElementById('screen-results'),
            hud: document.getElementById('game-hud')
        };
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        
        // State
        this.state = 'INIT'; 
        this.score = 0;
        this.streak = 0;
        this.level = 1;
        this.lastTime = 0;
        
        this.init();
    }

    async init() {
        this.setupUIListeners();
        this.setupInputListeners();
        this.onResize();
        
        // Domain 31: Sensory Acquisition
        await this.loadInitialAssets();
        
        requestAnimationFrame((t) => this.mainLoop(t));
    }

    async loadInitialAssets() {
        try {
            await Promise.all([
                assets.loadImage('ball', 'assets/sprites/ball.png'),
                assets.loadImage('goalie', 'assets/sprites/goalie_idle.png'),
                assets.loadImage('stadium', 'assets/sprites/stadium_bg.png'),
                assets.loadImage('hand', 'assets/sprites/hand_icon.png')
            ]);
        } catch (e) { console.warn("Assets fallback enabled."); }
    }

    setupUIListeners() {
        window.addEventListener('resize', () => this.onResize());
        
        document.getElementById('btn-validate').onclick = () => this.validateToken();
        document.getElementById('btn-restart').onclick = () => this.startNewGame();
        
        // Domain 48: Sharing
        document.getElementById('btn-share').onclick = () => {
            const text = `¡Logré ${this.score} puntos en Penalty Challenge! ¿Puedes superarme?`;
            if (navigator.share) {
                navigator.share({ title: 'Penalty Challenge', text, url: window.location.href });
            } else {
                alert("Copiado al portapapeles: " + text);
            }
        };
    }

    async validateToken() {
        const token = document.getElementById('token-input').value;
        if (!token) return;

        // Phase 6: Auth Handshake
        try {
            const response = await fetch('/api/access/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(token)
            });

            if (response.ok) {
                const data = await response.json();
                this.session = data;
                this.transitionTo('TUTORIAL');
            } else {
                this.showError("CÓDIGO INVÁLIDO");
            }
        } catch (e) { this.showError("ERROR DE CONEXIÓN"); }
    }

    transitionTo(newState) {
        // Hide all screens
        Object.values(this.screens).forEach(s => s.style.display = 'none');
        this.state = newState;

        switch(newState) {
            case 'TUTORIAL':
                this.screens.tutorial.style.display = 'flex';
                // Wait for first interaction to start game
                break;
            case 'PLAYING':
                this.screens.hud.style.display = 'flex';
                this.resetMatch();
                break;
            case 'RESULTS':
                this.screens.results.style.display = 'flex';
                this.populateLeaderboard();
                document.getElementById('final-score-value').innerText = this.score;
                break;
        }
        this.uiRoot.dataset.state = newState;
    }

    async populateLeaderboard() {
        // Domain 44: Proximity Ranking
        const list = document.getElementById('results-leaderboard');
        list.innerHTML = '<li>Cargando rivales...</li>';
        
        try {
            const res = await fetch('/api/leaderboard?period=daily&limit=5');
            const data = await res.json();
            list.innerHTML = '';
            data.forEach((entry, i) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>#${i+1} ${entry.player}</span> <span>${entry.score}</span>`;
                if (entry.player === "TÚ") li.className = 'current';
                list.appendChild(li);
            });
        } catch (e) { list.innerHTML = '<li>Ranking no disponible</li>'; }
    }

    // --- Interaction & Loop logic (Simplified for space) ---
    setupInputListeners() {
        const start = (x, y) => {
            if (this.state === 'TUTORIAL') this.transitionTo('PLAYING');
            if (this.state === 'PLAYING') this.handleInputStart(x,y);
        };
        this.canvas.addEventListener('mousedown', e => start(e.clientX, e.clientY));
        this.canvas.addEventListener('touchstart', e => start(e.touches[0].clientX, e.touches[0].clientY));
        // ... rest of event listeners remain similar to phase 2/5
    }

    handleInputStart(x,y) { /* implementation from phase 5 */ }
    resetMatch() { this.ball = this.resetBall(); this.score = 0; this.streak = 0; }
    resetBall() { return { pos: {x:0, y:5, z:0}, vel: {x:0,y:0,z:0}, active: false, reachedTarget: false, radius: 3 }; }
    onResize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }
    
    mainLoop(t) {
        const dt = (t - this.lastTime) / 1000;
        this.lastTime = t;
        this.update(dt);
        this.draw();
        requestAnimationFrame((ts) => this.mainLoop(ts));
    }

    update(dt) {
        if (this.state === 'PLAYING' && this.ball.active) {
            this.physics.update(this.ball, dt);
            if (this.ball.reachedTarget) this.resolveShot();
        }
    }

    resolveShot() {
        // Scoring logic from Phase 5 + Transition to RESULTS if game ends
        // For now, let's keep it in a loop
        this.streak++;
        this.score += 100;
        document.getElementById('score-value').innerText = this.score;
        document.getElementById('streak-value').innerText = `x${this.streak}`;
        
        setTimeout(() => {
            if (this.streak > 5) this.transitionTo('RESULTS');
            else this.ball = this.resetBall();
        }, 1500);
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.state === 'PLAYING' || this.state === 'TUTORIAL') {
            // Draw logic from phase 5.5
        }
    }

    showError(msg) {
        const err = document.getElementById('login-error');
        err.innerText = msg;
        err.style.display = 'block';
    }
}

window.addEventListener('DOMContentLoaded', () => { new PenaltyGame(); });
