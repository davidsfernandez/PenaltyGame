using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Models;
using PenaltyGameAPI.Services;

namespace PenaltyGameAPI.Endpoints;

/**
 * Domain 11, 13 & 20: Access Gateway
 * Handles the secure handshake and credential lifecycle.
 */
public static class AccessEndpoints
{
    public static void MapAccessEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/access/validate", async (
            string token, 
            GameDbContext db, 
            IAuthService authService,
            IConfiguration config,
            HttpContext context) =>
        {
            // --- Domain 50: Campaign Closure Check ---
            var isClosed = config.GetValue<bool>("CampaignSettings:IsClosed");
            if (isClosed)
            {
                return Results.Json(new { 
                    error = "CampaignConcluded", 
                    message = config.GetValue<string>("CampaignSettings:ClosureMessage") 
                }, statusCode: 410); // 410 Gone
            }

            // --- Domain 13: Brute Force Shield ---
            // In a real project, failure count would be tracked by IP in Redis/Cache.
            // For now, we simulate a failure counter.
            int simulatedFailCount = 0; 

            var credential = await db.AccessCredentials
                .FirstOrDefaultAsync(ac => ac.TokenHash == token);

            if (credential == null || credential.Status == CredentialStatus.Consumed || credential.Status == CredentialStatus.Voided)
            {
                await authService.ApplyTarpitAsync(++simulatedFailCount);
                return Results.Unauthorized();
            }

            // --- Domain 11: Lease Management ---
            var now = DateTime.UtcNow;
            string sessionId = Guid.NewGuid().ToString();
            string ephemeralSeed = Guid.NewGuid().ToString().Substring(0, 8);

            if (credential.Status == CredentialStatus.Available)
            {
                // First time use: Start the lease
                credential.Status = CredentialStatus.Active;
                credential.CurrentSessionId = sessionId;
                credential.LeaseExpiry = now.AddMinutes(5); // 5 minute lease
                credential.UsedAt = now;
            }
            else if (credential.Status == CredentialStatus.Active)
            {
                // Re-entry during active lease
                if (credential.LeaseExpiry < now)
                {
                    credential.Status = CredentialStatus.Expired;
                    await db.SaveChangesAsync();
                    return Results.Unauthorized();
                }
                
                // Keep existing session if possible or issue new one for the same lease
                sessionId = credential.CurrentSessionId ?? sessionId;
            }

            await db.SaveChangesAsync();

            // --- Domain 12 & 20: Security Artifacts ---
            var jwt = authService.GenerateJwt(Guid.Empty, sessionId, ephemeralSeed);
            var timeSeal = authService.CreateTimeSeal(sessionId);

            return Results.Ok(new
            {
                token = jwt,
                seal = timeSeal,
                expiresIn = 300, // 5 minutes
                uiCulture = "es-ES"
            });
        })
        .WithName("ValidateAccess")
        .WithOpenApi(operation => new(operation) {
            Summary = "Validate access token",
            Description = "Verifies the promotional code and returns a session JWT."
        });
    }
}
