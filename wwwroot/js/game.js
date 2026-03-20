/**
 * Penalty Challenge - Main Game Orchestrator
 * Phase 4: Result Persistence & Social Ranking
 */

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }
    create() { this.scene.start('PreloadScene'); }
}

class PreloadScene extends Phaser.Scene {
    constructor() { super('PreloadScene'); }
    preload() {
        this.load.image('ball', 'assets/sprites/ball.png');
        this.load.image('goalie', 'assets/sprites/goalie_idle.png');
        this.load.image('pitch', 'assets/sprites/pitch.png');
        this.load.image('hand', 'assets/sprites/hand_icon.png');
        this.load.audio('kick', 'assets/audio/kick.mp3');
        this.load.audio('goal', 'assets/audio/goal.mp3');
        this.load.audio('miss', 'assets/audio/miss.mp3');
    }
    create() { this.scene.start('MenuScene'); }
}

class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }
    create() {
        this.showScreen('welcome');
        document.getElementById('btn-start').onclick = () => this.handleAuth();
        
        // Auto-recovery (Soft-lock Domain 11)
        const storedToken = sessionStorage.getItem('pg_raw_token');
        if (storedToken) {
            document.getElementById('credential-input').value = storedToken;
            this.handleAuth();
        }
    }
    async handleAuth() {
        const input = document.getElementById('credential-input');
        const token = input.value.trim();
        if (!token) return;
        try {
            const response = await fetch(`/api/access/validate?token=${encodeURIComponent(token)}`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                this.game.registry.set('sessionToken', data.token);
                this.game.registry.set('securitySeal', data.seal);
                sessionStorage.setItem('pg_raw_token', token);
                this.scene.start('TutorialScene');
            } else { document.getElementById('validation-error').style.display = 'block'; }
        } catch (e) { document.getElementById('validation-error').style.display = 'block'; }
    }
    showScreen(key) {
        ['welcome', 'results', 'tutorial', 'pause'].forEach(s => {
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
        document.getElementById('screen-tutorial').classList.add('active');
        this.input.once('pointerdown', () => this.scene.start('GameScene'));
    }
}

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    create() {
        const { width, height } = this.sys.game.config;
        const centerX = width / 2;
        this.score = 0; this.streak = 0; this.isResolving = false; this.ballDrag = -256;

        document.getElementById('screen-tutorial').classList.remove('active');
        document.getElementById('game-hud').classList.remove('hidden');

        this.add.tileSprite(centerX, height / 2, width, height, 'pitch').setAlpha(0.8);
        this.goalie = this.physics.add.sprite(centerX, 400, 'goalie').setScale(1.5).setImmovable(true);
        this.ball = this.physics.add.sprite(centerX, height - 250, 'ball').setScale(1.2).setCollideWorldBounds(true).setBounce(0.4);
        
        this.input.on('pointerup', (pointer) => {
            if (this.isResolving || this.ball.body.speed > 0) return;
            const dX = (pointer.x - pointer.downX) / width;
            const dY = (pointer.y - pointer.downY) / height;
            if (dY < -0.05) {
                this.ball.setVelocity(dX * 13000, dY * 13000);
                if (this.cache.audio.exists('kick')) this.sound.play('kick', { volume: 0.6 });
                this.moveGoalie(centerX + (dX * 1000));
            }
        });

        this.physics.add.overlap(this.ball, this.goalie, () => this.handleSave());
    }

    moveGoalie(predictedX) {
        const relX = predictedX - (this.sys.game.config.width / 2);
        let prob = Math.abs(relX) > 250 ? 0.35 : 0.85;
        const willSave = Math.random() < (prob + Math.min(0.15, this.streak * 0.05));
        let targetX = willSave ? predictedX : (predictedX > 540 ? predictedX - 350 : predictedX + 350);
        this.tweens.add({ targets: this.goalie, x: Phaser.Math.Clamp(targetX, 140, 940), duration: 350 - (this.streak * 10), ease: 'Cubic.easeOut' });
    }

    handleSave() {
        if (this.isResolving) return;
        this.isResolving = true; this.ball.setVelocity(0, 0);
        this.showMasteryText(this.ball.x, this.ball.y, "¡ATAJADA!", "#ffcc00");
        if (this.cache.audio.exists('miss')) this.sound.play('miss');
        
        // End Session on Save (Domain 49)
        this.time.delayedCall(1500, () => {
            this.scene.start('ResultScene', { score: this.score, streak: this.streak });
        });
    }

    handleGoal() {
        this.isResolving = true; this.ball.setVelocity(0, 0);
        this.streak++;
        const relX = Math.abs(this.ball.x - 540);
        let msg = "¡GOL!", color = "#00f260", pts = 100;
        if (relX > 250) { msg = "¡GOLAZO!"; color = "#00d2ff"; pts = 500; }
        this.score += (pts * this.streak); this.updateUI();
        this.showMasteryText(this.ball.x, this.ball.y, msg, color);
        if (this.cache.audio.exists('goal')) this.sound.play('goal');
        this.cameras.main.flash(200, 0, 242, 96, 0.3);
        this.time.delayedCall(2000, () => { this.isResolving = false; this.resetMatch(); });
    }

    showMasteryText(x, y, msg, color) {
        const txt = this.add.text(x, y - 50, msg, { fontFamily: 'Bebas Neue', fontSize: '100px', color: color, stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
        this.tweens.add({ targets: txt, y: y - 150, alpha: 0, duration: 1000, onComplete: () => txt.destroy() });
    }

    updateUI() {
        document.getElementById('score-display').innerText = this.score;
        document.getElementById('streak-display').innerText = `x${this.streak}`;
    }

    resetMatch() {
        this.ball.setPosition(540, 1670).setVelocity(0, 0);
        this.goalie.setPosition(540, 400);
    }

    update(time, delta) {
        if (this.ball.body.speed > 0) {
            const drag = (delta / 1000) * this.ballDrag;
            const dir = this.ball.body.velocity.clone().normalize();
            this.ball.body.velocity.x += dir.x * drag; this.ball.body.velocity.y += dir.y * drag;
            if (this.ball.body.speed < 10) this.ball.setVelocity(0, 0);
        }
        if (!this.isResolving && this.ball.y < 250) this.handleGoal();
    }
}

class ResultScene extends Phaser.Scene {
    constructor() { super('ResultScene'); }

    async create(data) {
        document.getElementById('game-hud').classList.add('hidden');
        this.showScreen('results');
        
        document.getElementById('final-score').innerText = data.score.toLocaleString();
        
        // 1. Persist Results (Domain 11)
        await this.submitPerformance(data.score);
        
        // 2. Load Social Ranking (Domain 44)
        await this.loadLeaderboard();

        // 3. Bind Actions
        document.getElementById('btn-restart').onclick = () => window.location.reload();
        document.getElementById('btn-share').onclick = () => this.shareAchievment(data.score, data.streak);
    }

    async submitPerformance(score) {
        const token = this.game.registry.get('sessionToken');
        const rawToken = sessionStorage.getItem('pg_raw_token');
        if (!token || score === 0) return;

        try {
            console.log("[API] Immortalizing score...");
            await fetch('/api/results', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ credential: rawToken, score: score })
            });
        } catch (e) { console.error("[API] Persitence failed."); }
    }

    async loadLeaderboard() {
        const body = document.getElementById('leaderboard-body');
        const myRawToken = sessionStorage.getItem('pg_raw_token');
        const myAlias = myRawToken ? myRawToken.substring(0, 3) + "***" : "TÚ";

        try {
            const response = await fetch('/api/leaderboard');
            const result = await response.json();
            if (result.success) {
                body.innerHTML = '';
                result.data.forEach((entry, idx) => {
                    const isMe = entry.alias === myAlias;
                    const row = document.createElement('tr');
                    if (isMe) row.style.background = 'rgba(0, 242, 96, 0.1)';
                    row.innerHTML = `
                        <td style="padding:14px; opacity:0.3;">#${idx+1}</td>
                        <td style="padding:14px; font-weight:700; color:${isMe ? '#00f260' : 'white'}">${entry.alias} ${isMe ? '(TÚ)' : ''}</td>
                        <td style="padding:14px; text-align:right; font-weight:900;">${entry.value.toLocaleString()}</td>
                    `;
                    body.appendChild(row);
                });
            }
        } catch (e) { body.innerHTML = '<tr><td colspan="3">Error de red</td></tr>'; }
    }

    shareAchievment(score, streak) {
        const text = `¡Logré ${score} puntos y una racha de x${streak} en Penalty Challenge! ¿Podrás superarme?`;
        if (navigator.share) {
            navigator.share({ title: 'Penalty Challenge', text: text, url: window.location.href });
        } else {
            navigator.clipboard.writeText(text); alert("¡Copiado al portapapeles!");
        }
    }

    showScreen(key) {
        ['welcome', 'results', 'tutorial'].forEach(s => document.getElementById(`screen-${s}`).classList.remove('active'));
        document.getElementById(`screen-${key}`).classList.add('active');
    }
}

const config = {
    type: Phaser.AUTO, parent: 'game-container', width: 1080, height: 1920, backgroundColor: '#050505',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
    scene: [BootScene, PreloadScene, MenuScene, TutorialScene, GameScene, ResultScene]
};
const game = new Phaser.Game(config);
