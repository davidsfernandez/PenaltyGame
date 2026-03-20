/**
 * Penalty Challenge - Main Game Orchestrator
 * Scene-Based Architecture Implementation
 */

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    preload() {
        // Load loading bar assets if needed
    }
    create() {
        this.scene.start('PreloadScene');
    }
}

class PreloadScene extends Phaser.Scene {
    constructor() { super('PreloadScene'); }
    preload() {
        // Load Kenney Production Assets
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('goalie', 'assets/sprites/goalie_idle.png');
        this.load.image('pitch', 'assets/sprites/pitch.png');
        this.load.image('hand', 'assets/sprites/hand_icon.png');
        
        // Load Audio (Fixed paths from stabilization phase)
        this.load.audio('kick', 'assets/audio/kick.mp3');
        this.load.audio('goal', 'assets/audio/goal.mp3');
        this.load.audio('miss', 'assets/audio/miss.mp3');
    }
    create() {
        this.scene.start('MenuScene');
    }
}

class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }
    create() {
        this.showScreen('welcome');
        
        const btnStart = document.getElementById('btn-start');
        btnStart.onclick = () => this.handleAuth();
    }

    async handleAuth() {
        const input = document.getElementById('credential-input');
        const token = input.value.trim();
        const error = document.getElementById('validation-error');

        if (!token) return;

        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const data = await response.json();
                this.game.registry.set('sessionToken', data.token);
                this.game.registry.set('securitySeal', data.seal);
                sessionStorage.setItem('pg_raw_token', token);
                
                this.scene.start('TutorialScene');
            } else {
                error.style.display = 'block';
            }
        } catch (e) {
            error.style.display = 'block';
        }
    }

    showScreen(key) {
        const screens = ['welcome', 'results', 'tutorial', 'pause'];
        screens.forEach(s => {
            const el = document.getElementById(`screen-${s}`);
            if (el) el.classList.remove('active');
        });
        const target = document.getElementById(`screen-${key}`);
        if (target) target.classList.add('active');
    }
}

class TutorialScene extends Phaser.Scene {
    constructor() { super('TutorialScene'); }
    create() {
        this.showScreen('tutorial');
        this.input.once('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
    showScreen(key) {
        document.getElementById('screen-tutorial').classList.add('active');
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }
    create() {
        // Initial setup for the pitch and basic HUD activation
        document.getElementById('screen-tutorial').classList.remove('active');
        document.getElementById('game-hud').classList.remove('hidden');
        console.log("[Engine] Game Arena Ready.");
        
        // Physics logic will be implemented in the next step
    }
}

class ResultScene extends Phaser.Scene {
    constructor() { super('ResultScene'); }
    create(data) {
        // Handle result visualization
    }
}

// --- Engine Bootstrapping ---
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
    scene: [BootScene, PreloadScene, MenuScene, TutorialScene, GameScene, ResultScene]
};

const game = new Phaser.Game(config);
