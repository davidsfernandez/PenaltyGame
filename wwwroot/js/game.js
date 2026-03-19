import { Normalizer } from './engine/normalizer.js';

/**
 * Domain 28: Experience State Progression
 * Main Entry Point and State Orchestrator.
 * This class manages the lifecycle of the experience, coordinating between 
 * the visual representation (Canvas) and the structural interface (DOM).
 */
class PenaltyGame {
    constructor() {
        // --- Core UI Elements (Domain 5) ---
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        this.messageArea = document.getElementById('message-area');
        
        // --- Game State (Domain 28) ---
        this.state = 'STASIS'; // STASIS, SIMULATION, JUDGMENT
        this.lastTime = 0;
        
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

    /**
     * Domain 34: Adaptive Structure Philosophy
     * Handles viewport changes and re-normalizes the interaction space.
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Signal the UI for semantic re-layout if orientation changed
        const isPortrait = height > width;
        this.uiRoot.dataset.orientation = isPortrait ? 'portrait' : 'landscape';
        
        console.log(`[System] Viewport Resized: ${width}x${height} (${this.uiRoot.dataset.orientation})`);
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('resize', () => this.onResize());
        
        // Mouse interaction
        this.canvas.addEventListener('mousedown', (e) => this.handleInputStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => this.handleInputMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', (e) => this.handleInputEnd(e.clientX, e.clientY));

        // Touch interaction (Domain 38: Context Isolation)
        this.canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            this.handleInputStart(touch.clientX, touch.clientY);
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.handleInputMove(touch.clientX, touch.clientY);
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            this.handleInputEnd(touch.clientX, touch.clientY);
        }, { passive: true });
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
        
        // Normalize the gesture (Domain 27)
        const deltaX = end.x - start.x;
        const deltaY = end.y - start.y;
        const force = Normalizer.calculateNormalizedForce(
            deltaX, 
            deltaY, 
            this.canvas.width, 
            this.canvas.height
        );

        console.log(`[Interaction] Shot Fired: Magnitude ${force.magnitude.toFixed(2)}`);
        
        // Transition to Simulation (Logic to be implemented in Phase 2)
        // this.state = 'SIMULATION';
    }

    /**
     * Domain 29: Visual Interpolation & Frame-rate Decoupling
     * Master render loop.
     */
    mainLoop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.mainLoop(t));
    }

    update(dt) {
        // High-level state updates only
    }

    draw() {
        // Domain 32: Canvas Buffer Flush
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Placeholder for the pitch
        this.drawDebugGrid();
    }

    drawDebugGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.beginPath();
        for(let i=0; i<this.canvas.width; i+=50) {
            this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.canvas.height);
        }
        for(let j=0; j<this.canvas.height; j+=50) {
            this.ctx.moveTo(0, j); this.ctx.lineTo(this.canvas.width, j);
        }
        this.ctx.stroke();
    }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    window.App = new PenaltyGame();
});
