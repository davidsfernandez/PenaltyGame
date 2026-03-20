namespace PenaltyGameAPI.Models;

/**
 * Domain 12 & 14: Trust Signature & Biomechanical Telemetry
 * Represents the payload sent by the client after a shot is completed.
 */
public class ShootRequest
{
    // The claimed result
    public int Score { get; set; }
    
    // Domain 12: Biological Telemetry
    public double DurationMs { get; set; }
    public double DistanceNormalized { get; set; }
    public double Curvature { get; set; }
    
    // Domain 12: The Mathematical Pact
    public string TrustSignature { get; set; } = string.Empty;
    
    // Domain 6: Idempotency Key (usually sent in headers, but included here for completeness if needed)
    public string IdempotencyKey { get; set; } = string.Empty;
}
