/**
 * Domain 27: Interaction Normalization
 * Translates pixel coordinates and deltas to normalized 0.0 - 1.0 UAS (Unified Area System) units.
 * Ensures cross-device input parity and viewport-relative scaling.
 */
export class Normalizer {
    /**
     * Normalizes a pixel value relative to a viewport dimension.
     * @param {number} pixelValue - The pixel value (coordinate or delta).
     * @param {number} viewportDimension - The width or height of the viewport.
     * @returns {number} The normalized value (0.0 - 1.0).
     */
    static normalize(pixelValue, viewportDimension) {
        if (viewportDimension === 0) return 0;
        return pixelValue / viewportDimension;
    }

    /**
     * Denormalizes a value relative to a viewport dimension.
     * @param {number} normalizedValue - The normalized value (0.0 - 1.0).
     * @param {number} viewportDimension - The width or height of the viewport.
     * @returns {number} The pixel value.
     */
    static denormalize(normalizedValue, viewportDimension) {
        return normalizedValue * viewportDimension;
    }

    /**
     * Normalizes a 2D point or delta.
     * @param {number} x - Pixel X value.
     * @param {number} y - Pixel Y value.
     * @param {number} width - Viewport width.
     * @param {number} height - Viewport height.
     * @returns {{x: number, y: number}} Normalized coordinates/deltas.
     */
    static normalizeVector(x, y, width, height) {
        return {
            x: this.normalize(x, width),
            y: this.normalize(y, height)
        };
    }

    /**
     * Calculates a normalized force based on a pixel delta and a saturation threshold.
     * Implements the "Sensitivity Window" and "Aspect-Ratio Compensation" from Domain 27.
     * @param {number} deltaX - Pixel delta X.
     * @param {number} deltaY - Pixel delta Y.
     * @param {number} width - Viewport width.
     * @param {number} height - Viewport height.
     * @param {number} saturationThreshold - The percentage of the viewport (0.0 - 1.0) that represents "Full Power".
     * @returns {{x: number, y: number, magnitude: number}} Normalized force vector and magnitude (clamped to 1.0).
     */
    static calculateNormalizedForce(deltaX, deltaY, width, height, saturationThreshold = 0.4) {
        // Use the shortest axis for aspect-ratio compensation as per Domain 27, Section 4.
        const referenceDimension = Math.min(width, height);
        const saturationPixels = referenceDimension * saturationThreshold;
        
        if (saturationPixels === 0) return { x: 0, y: 0, magnitude: 0 };

        const nx = deltaX / saturationPixels;
        const ny = deltaY / saturationPixels;
        
        const magnitude = Math.sqrt(nx * nx + ny * ny);
        const clampedMagnitude = Math.min(magnitude, 1.0);
        
        // Maintain direction but clamp to 1.0 magnitude if it exceeds the threshold
        let finalNx = nx;
        let finalNy = ny;
        
        if (magnitude > 1.0) {
            finalNx /= magnitude;
            finalNy /= magnitude;
        }
        
        return {
            x: finalNx,
            y: finalNy,
            magnitude: clampedMagnitude
        };
    }
}
