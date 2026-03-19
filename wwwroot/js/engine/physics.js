/**
 * Domain 21 & 24: Physics Interaction Model & Artificial Friction
 * Implements 3D-to-2D projectile motion with gravity, drag, and Magnus effect.
 */
export class PhysicsEngine {
    constructor(config = {}) {
        this.gravity = config.gravity || 9.81;
        this.dragCoefficient = config.dragCoefficient || 0.02;
        this.magnusCoefficient = config.magnusCoefficient || 0.05;
        this.focalLength = config.focalLength || 500;
        this.groundY = config.groundY || 0;
        this.targetZ = config.targetZ || 100; // Goal depth
    }

    /**
     * Updates the ball's state based on delta time.
     * @param {Object} ball - The ball state object {pos, vel, spin, radius}.
     * @param {number} dt - Delta time in seconds.
     */
    update(ball, dt) {
        if (!ball.active) return;

        // 1. Apply Gravity (Domain 24, Section 2)
        ball.vel.y -= this.gravity * dt;

        // 2. Apply Atmospheric Drag (Domain 24, Section 3)
        // Quadratic drag: Fd = 0.5 * rho * v^2 * Cd * A
        // Simplified for arcade: v = v * (1 - drag * v * dt)
        const speed = Math.sqrt(ball.vel.x ** 2 + ball.vel.y ** 2 + ball.vel.z ** 2);
        const dragFactor = 1 - (this.dragCoefficient * speed * dt);
        
        ball.vel.x *= dragFactor;
        ball.vel.y *= dragFactor;
        ball.vel.z *= dragFactor;

        // 3. Apply Magnus Effect (Domain 24, Section 4)
        // Lateral acceleration based on spin and velocity
        // Ax = MagnusCoeff * Spin * Vz
        const lateralAcceleration = this.magnusCoefficient * ball.spin * ball.vel.z;
        ball.vel.x += lateralAcceleration * dt;

        // 4. Update Position (Domain 21, Section 3)
        ball.pos.x += ball.vel.x * dt;
        ball.pos.y += ball.vel.y * dt;
        ball.pos.z += ball.vel.z * dt;

        // 5. Collision with ground
        if (ball.pos.y < this.groundY + ball.radius) {
            ball.pos.y = this.groundY + ball.radius;
            ball.vel.y *= -0.4; // Bounce with energy loss
            ball.spin *= 0.8;   // Friction reduces spin
            
            // If vertical velocity is very low, stop bouncing
            if (Math.abs(ball.vel.y) < 0.5) {
                ball.vel.y = 0;
            }
        }

        // 6. Check if target depth reached
        if (ball.pos.z >= this.targetZ) {
            ball.active = false;
            ball.reachedTarget = true;
        }
    }

    /**
     * Projects 3D coordinates to 2D screen coordinates (Domain 21, Section 4).
     * @param {Object} pos - 3D position {x, y, z}.
     * @param {number} centerX - Screen center X.
     * @param {number} centerY - Screen center Y.
     * @returns {Object} 2D screen coordinates {x, y, scale}.
     */
    project(pos, centerX, centerY) {
        const scale = this.focalLength / (this.focalLength + pos.z);
        return {
            x: centerX + pos.x * scale,
            y: centerY - pos.y * scale, // Y is up in 3D, down in 2D
            scale: scale
        };
    }

    /**
     * Calculates initial 3D velocity from 2D swipe data.
     * @param {Object} swipe - {deltaX, deltaY, velocity, curvature}.
     * @returns {Object} Initial state {vel, spin}.
     */
    calculateInitialState(swipe) {
        // Map swipe velocity to Z-depth power
        const vz = swipe.velocity * 50; // Scaling factor for arcade feel
        
        // Map deltaX to horizontal velocity
        const vx = swipe.deltaX * 20;
        
        // Map deltaY to vertical elevation
        const vy = Math.abs(swipe.deltaY) * 25;

        // Map curvature to spin
        const spin = swipe.curvature * 10;

        return {
            vel: { x: vx, y: vy, z: vz },
            spin: spin
        };
    }
}
