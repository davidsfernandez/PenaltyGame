import { Normalizer } from './engine/normalizer.js';
import { PhysicsEngine } from './engine/physics.js';
import { AIGoalie } from './engine/ai.js';
import { SpatialSoundEngine } from './engine/audio.js';
import { assets } from './engine/assets.js';
import { vault } from './engine/vault.js';

class PenaltyGame {
    constructor() {
        this.physics = new PhysicsEngine();
        this.ai = new AIGoalie();
        this.audio = new SpatialSoundEngine();
        
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.uiRoot = document.getElementById('ui-root');
        
        this.state = 'INIT'; 
        this.init();
    }

    async init() {
        this.onResize();
        
        // --- Domain 33: Connectivity Grace ---
        // 1. Initialize the Local Vault (IndexedDB)
        await vault.init();
        
        // 2. Attempt to sync pending results from previous dead-zones
        this.syncVault();

        // Continue with normal init
        requestAnimationFrame((t) => this.mainLoop(t));
    }

    /**
     * Domain 33: Reconnaissance & Replay Loop
     */
    async syncVault() {
        const pending = await vault.getPendingShots();
        if (pending.length === 0) return;

        console.log(`[System] Found ${pending.length} unsynced shots in vault. Retrying...`);
        
        for (const shot of pending) {
            try {
                const res = await fetch('/api/game/shoot', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Idempotency-Key': shot.idempotencyKey 
                    },
                    body: JSON.stringify(shot.payload)
                });

                if (res.ok) {
                    await vault.clearShot(shot.id);
                    console.log(`[System] Shot ${shot.id} synced successfully.`);
                }
            } catch (e) {
                console.warn("[System] Connection still unstable. Sync postponed.");
                break; // Stop trying if connection is still down
            }
        }
    }

    async submitResult(payload, idempotencyKey) {
        // --- Domain 33: Secure-then-Transmit ---
        // 1. Save to local vault first
        const vaultId = await vault.savePendingShot({ payload, idempotencyKey });

        // 2. Attempt transmission
        try {
            const res = await fetch('/api/game/shoot', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-Idempotency-Key': idempotencyKey 
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                // 3. If success, clear from vault
                await vault.clearShot(vaultId);
            }
        } catch (e) {
            console.error("[System] Offline mode active. Result secured in vault.");
        }
    }

    onResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    mainLoop(t) { /* ... loop logic ... */ }
    update(dt) { /* ... update logic ... */ }
    draw() { /* ... draw logic ... */ }
}

window.addEventListener('DOMContentLoaded', () => { new PenaltyGame(); });
