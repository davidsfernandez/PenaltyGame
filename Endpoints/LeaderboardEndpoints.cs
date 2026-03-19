using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Endpoints;

public static class LeaderboardEndpoints
{
    public static void MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/leaderboard");

        group.MapGet("/", async (string? timeframe, int? limit, GameDbContext db) =>
        {
            var query = db.Scores
                .AsNoTracking()
                .Where(s => s.IsValidated) // Only validated scores for the public leaderboard
                .Include(s => s.Player)
                .AsQueryable();

            var now = DateTime.UtcNow;
            if (timeframe?.ToLower() == "daily")
            {
                var startOfDay = now.Date;
                query = query.Where(s => s.AchievedAt >= startOfDay);
            }
            else if (timeframe?.ToLower() == "weekly")
            {
                var startOfWeek = now.AddDays(-(int)now.DayOfWeek);
                query = query.Where(s => s.AchievedAt >= startOfWeek);
            }

            var results = await query
                .OrderByDescending(s => s.Value)
                .ThenBy(s => s.AchievedAt)
                .Take(limit ?? 10)
                .Select(s => new LeaderboardEntry(
                    s.Player!.Username,
                    s.Value,
                    s.AchievedAt
                ))
                .ToListAsync();

            return Results.Ok(results);
        })
        .WithName("GetLeaderboard")
        .WithOpenApi();
    }
}

public record LeaderboardEntry(string Username, int Score, DateTime AchievedAt);
