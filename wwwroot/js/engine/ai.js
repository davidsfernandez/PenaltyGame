/**
 * Domain 22: AI Decision Tree & Probabilistic Opponent
 * Implements the Goalie's zonal logic, reaction time, and save probability.
 */
export class AIGoalie {
    constructor(config = {}) {
        this.baseSkill = config.baseSkill || 0.7;
        this.reactionTimeRange = config.reactionTimeRange || [0.15, 0.3]; // Seconds
        this.goalWidth = config.goalWidth || 100;
        this.goalHeight = config.goalHeight || 50;
        
        // Zonal modifiers (Domain 22, Section 2)
        this.zonalModifiers = {
            'top-left': 0.3, 'top-center': 0.6, 'top-right': 0.3,
            'mid-left': 0.5, 'mid-center': 0.9, 'mid-right': 0.5,
            'bottom-left': 0.5, 'bottom-center': 0.9, 'bottom-right': 0.5
        };
    }

    /**
     * Identifies the goal zone based on 3D coordinates.
     * @param {number} x - Lateral position.
     * @param {number} y - Vertical position.
     * @returns {string} Zone identifier.
     */
    identifyZone(x, y) {
        const thirdWidth = this.goalWidth / 3;
        const halfWidth = this.goalWidth / 2;
        const thirdHeight = this.goalHeight / 3;

        let horizontal = 'center';
        if (x < -halfWidth + thirdWidth) horizontal = 'left';
        else if (x > halfWidth - thirdWidth) horizontal = 'right';

        let vertical = 'mid';
        if (y > (2 * thirdHeight)) vertical = 'top';
        else if (y < thirdHeight) vertical = 'bottom';

        return `${vertical}-${horizontal}`;
    }

    /**
     * Decides whether the goalie saves the ball (Domain 22, Section 3).
     * @param {Object} ballState - {pos, vel, spin}.
     * @param {number} difficultyLevel - Current game difficulty.
     * @returns {Object} Decision {willSave, reactionTime, targetPos}.
     */
    decide(ballState, difficultyLevel = 1) {
        const zone = this.identifyZone(ballState.pos.x, ballState.pos.y);
        const zoneModifier = this.zonalModifiers[zone] || 0.5;
        
        // Velocity penalty: Harder shots reduce save probability
        const velocityFactor = Math.abs(ballState.vel.z) / 100;
        
        // Difficulty scaling (Domain 22, Section 4)
        const difficultyBonus = (difficultyLevel - 1) * 0.05;
        const currentSkill = Math.min(0.95, this.baseSkill + difficultyBonus);

        // P_Save = (Base_Skill * M_zone) - (Velocity_Factor * 0.1)
        const pSave = (currentSkill * zoneModifier) - (velocityFactor * 0.1);
        
        const randomRoll = Math.random();
        const willSave = randomRoll <= pSave;

        // Simulated reaction time (Domain 22, Section 3, Phase 1)
        const reactionTime = this.reactionTimeRange[0] + 
            Math.random() * (this.reactionTimeRange[1] - this.reactionTimeRange[0]);

        return {
            willSave: willSave,
            reactionTime: reactionTime,
            targetPos: { x: ballState.pos.x, y: ballState.pos.y },
            zone: zone
        };
    }

    /**
     * Calculates the goalie's position at a given time.
     * @param {number} currentTime - Time since the shot started.
     * @param {Object} decision - The decision object from decide().
     * @param {Object} startPos - Goalie's initial position.
     * @returns {Object} Current goalie position {x, y}.
     */
    getPosition(currentTime, decision, startPos = { x: 0, y: 25 }) {
        if (currentTime < decision.reactionTime) {
            return { ...startPos };
        }

        // If it's a save, move towards the target. 
        // If it's a fail, move towards a "wrong" or "late" position.
        const moveTime = currentTime - decision.reactionTime;
        const duration = 0.5; // Seconds to reach target
        const t = Math.min(1, moveTime / duration);

        let targetX = decision.targetPos.x;
        let targetY = decision.targetPos.y;

        if (!decision.willSave) {
            // Fail branch: "Dive to the wrong side" or "Dive too late"
            // For simplicity, we'll just offset the target or slow it down
            targetX *= -0.5; // Dive wrong way
            targetY *= 0.8;
        }

        return {
            x: startPos.x + (targetX - startPos.x) * t,
            y: startPos.y + (targetY - startPos.y) * t
        };
    }
}
