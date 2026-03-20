using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;

namespace PenaltyGameAPI.Endpoints;

/**
 * Domain 4 & 44: High Scalability & Social Exposure
 * Handles the retrieval of filtered rankings.
 */
public static class LeaderboardEndpoints
{
    public static void MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/leaderboard", async (GameDbContext db, string period = "all", int limit = 10) =>
        {
            var query = db.Scores
                .Include(s => s.Player)
                .Where(s => s.IsValidated); // Only show validated results (Domain 15)

            // Apply Temporal Filters (Domain 3)
            query = period.ToLower() switch
            {
                "daily" => query.Where(s => s.AchievedAt >= DateTime.UtcNow.AddDays(-1)),
                "weekly" => query.Where(s => s.AchievedAt >= DateTime.UtcNow.AddDays(-7)),
                _ => query
            };

            var results = await query
                .OrderByDescending(s => s.Value)
                .ThenBy(s => s.AchievedAt)
                .Take(limit)
                .Select(s => new
                {
                    Player = s.Player!.Username,
                    Score = s.Value,
                    Date = s.AchievedAt,
                    Rank = 0 // Position would be calculated in a separate logic if needed
                })
                .AsNoTracking()
                .ToListAsync();

            return Results.Ok(results);
        })
        .WithName("GetLeaderboard")
        .WithOpenApi(operation => new(operation) {
            Summary = "Get Global Leaderboard",
            Description = "Returns the top 10 players sorted by score."
        });
    }
}
