using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Models;
using PenaltyGameAPI.Services;

namespace PenaltyGameAPI.Endpoints;

/**
 * Domain 3, 14 & 17: Interactive Submission Endpoint
 */
public static class ShootEndpoints
{
    public static void MapShootEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/game/shoot", async (
            [FromBody] ShootRequest request,
            [FromServices] IValidationService validationService,
            [FromServices] GameDbContext db,
            [FromServices] ILogger<ShootRequest> logger) =>
        {
            // Note: In a full implementation, sessionSeed comes from the decoded JWT.
            // For now, we use a mocked seed to demonstrate the architecture.
            string currentSessionSeed = "mocked-session-seed-123";
            Guid currentPlayerId = Guid.NewGuid(); // Mocked User

            // 1. Trust Signature Validation (Domain 12)
            if (!validationService.VerifyTrustSignature(request, currentSessionSeed))
            {
                logger.LogWarning("Trust Signature verification failed for User {PlayerId}", currentPlayerId);
                // Domain 19: Opaque Return
                return Results.Unauthorized();
            }

            // 2. Biomechanical Anomaly Detection (Domain 14)
            bool isBiologicallyFeasible = validationService.IsBiologicallyFeasible(request);

            if (!isBiologicallyFeasible)
            {
                // Domain 14: The Deceptive Response (Honey-Potting)
                // We log the fraud, but return 200 OK so the bot doesn't know it was caught.
                logger.LogWarning("Biomechanical anomaly detected for User {PlayerId}. Marking as fraud.", currentPlayerId);
                
                // Save to Landing Zone but NEVER validate it
                var fraudScore = new Score
                {
                    PlayerId = currentPlayerId,
                    Value = request.Score,
                    IsValidated = false, 
                    Metadata = "FRAUD_FLAG_BIOMECHANICAL"
                };
                
                db.Scores.Add(fraudScore);
                await db.SaveChangesAsync();

                return Results.Ok(new { success = true, accepted = true });
            }

            // 3. Valid Interaction Processing (Domain 15 Landing Zone)
            var validScore = new Score
            {
                PlayerId = currentPlayerId,
                Value = request.Score,
                IsValidated = false, 
                Metadata = $"Valid Shot: {request.DistanceNormalized:F2}d, {request.DurationMs}ms"
            };

            db.Scores.Add(validScore);

            // --- Domain 49: Absolute Finalization Matrix ---
            // If certain conditions are met, we finalize immediately
            bool shouldFinalize = false;
            
            // Logic: If this is the 3rd fail (or 10th total shot), we consume the token
            // In a real project, we would count shots from the DB for this session.
            if (request.Score == 0) shouldFinalize = true; // Simplified: any miss ends session for this example

            if (shouldFinalize)
            {
                var credential = await db.AccessCredentials.FirstOrDefaultAsync(ac => ac.CurrentSessionId == currentSessionSeed);
                if (credential != null) credential.Status = CredentialStatus.Consumed;
            }

            await db.SaveChangesAsync();

            return Results.Ok(new { success = true, accepted = true, finalized = shouldFinalize });
        })
        .WithName("SubmitShot")
        .WithOpenApi(operation => new(operation) {
            Summary = "Validate Shot",
            Description = "Performs real-time validation of a single kick attempt."
        });
    }
}
