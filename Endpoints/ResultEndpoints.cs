using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Endpoints;

/**
 * Layer 6: Persistence & Service Layer (REST Backend)
 */
public static class ResultEndpoints
{
    public static void MapResultEndpoints(this IEndpointRouteBuilder app)
    {
        /**
         * Prompt 11: Submission & Persistence
         */
        app.MapPost("/api/results", async ([FromBody] InteractionResult request, GameDbContext db, ILogger<InteractionResult> logger) =>
        {
            if (string.IsNullOrWhiteSpace(request.Credential)) return Results.BadRequest(new { error = "Credential required." });

            var player = await db.Players.FirstOrDefaultAsync(p => p.Username == request.Credential);
            if (player == null)
            {
                player = new Player { Id = Guid.NewGuid(), Username = request.Credential };
                db.Players.Add(player);
                db.Scores.Add(new Score { PlayerId = player.Id, Value = request.Score, IsValidated = true });
            }
            else
            {
                var score = await db.Scores.FirstOrDefaultAsync(s => s.PlayerId == player.Id);
                if (score != null && request.Score > score.Value) { score.Value = request.Score; score.AchievedAt = DateTime.UtcNow; }
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { success = true });
        })
        .WithName("PostResult")
        .WithOpenApi(operation => new(operation) {
            Summary = "Submit Final Performance",
            Description = "Submits the player's score for validation and auditing."
        });

        /**
         * Prompt 12: Leaderboard Read Access.
         * Efficient query for top performance records.
         */
        app.MapGet("/api/leaderboard", async (GameDbContext db) =>
        {
            const int topLimit = 10;

            // Efficient query: Top N validated scores, descending
            var topScores = await db.Scores
                .AsNoTracking() // Optimize for read-only access
                .Where(s => s.IsValidated)
                .OrderByDescending(s => s.Value)
                .ThenBy(s => s.AchievedAt)
                .Take(topLimit)
                .Select(s => new
                {
                    // Ofuscated Credential/Alias (e.g., first 3 chars + ***)
                    Alias = s.Player != null && s.Player.Username.Length > 3 
                        ? s.Player.Username.Substring(0, 3) + "***" 
                        : "Player***",
                    Value = s.Value
                })
                .ToListAsync();

            // Returns standardized object notation (JSON)
            return Results.Ok(new {
                success = true,
                data = topScores,
                count = topScores.Count,
                timestamp = DateTime.UtcNow
            });
        })
        .WithName("GetTopScores")
        .WithOpenApi(operation => new(operation) {
            Summary = "Submit Final Performance",
            Description = "Submits the player's score for validation and auditing."
        });
    }
}

public class InteractionResult
{
    public string Credential { get; set; } = string.Empty;
    public int Score { get; set; }
}
