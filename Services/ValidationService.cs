using System.Security.Cryptography;
using System.Text;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Services;

public interface IValidationService
{
    bool VerifyTrustSignature(ShootRequest request, string sessionSeed);
    bool IsBiologicallyFeasible(ShootRequest request);
}

/**
 * Domain 12 & 14: Security and Real-Time Validation Engine
 */
public class ValidationService : IValidationService
{
    /**
     * Domain 12: The Mathematical Pact
     * Reconstructs the signature server-side and compares it with the client's signature.
     */
    public bool VerifyTrustSignature(ShootRequest request, string sessionSeed)
    {
        // Format: Seed + Score + Duration + Distance + Curvature
        var rawData = $"{sessionSeed}_{request.Score}_{request.DurationMs:F2}_{request.DistanceNormalized:F2}_{request.Curvature:F2}";
        var expectedSignature = ComputeSha256Hash(rawData);
        
        return string.Equals(request.TrustSignature, expectedSignature, StringComparison.OrdinalIgnoreCase);
    }

    /**
     * Domain 14: Window of Human Possibility
     * Checks if the gesture defies human physics.
     */
    public bool IsBiologicallyFeasible(ShootRequest request)
    {
        // A swipe cannot happen in less than 50ms (T_Gesture constraint)
        if (request.DurationMs < 50.0) return false;

        // A swipe cannot traverse the entire screen in less than 60ms
        if (request.DistanceNormalized >= 1.0 && request.DurationMs < 60.0) return false;

        // If the gesture is perfectly linear (0 curvature) over a long distance, it might be a bot (Input Entropy)
        // Though we allow some leniency, a strict 0.000 curvature on a full swipe is suspicious.
        if (request.DistanceNormalized > 0.8 && request.Curvature == 0.0) return false;

        return true;
    }

    private string ComputeSha256Hash(string rawData)
    {
        using var sha256Hash = SHA256.Create();
        byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));

        var builder = new StringBuilder();
        foreach (var b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }
}
