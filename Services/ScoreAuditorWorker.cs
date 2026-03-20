using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Services;

/**
 * Domain 4, 10 & 15: The Auditor (Background Processing)
 * Manages the transition of data from the Landing Zone to the Official Leaderboard.
 */
public class ScoreAuditorWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ScoreAuditorWorker> _logger;
    private const int BatchSize = 100;
    private const int IntervalSeconds = 10;

    public ScoreAuditorWorker(IServiceProvider serviceProvider, ILogger<ScoreAuditorWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Auditor] Worker started. Monitoring Landing Zone every {Interval}s.", IntervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await AuditPendingScoresAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Auditor] An error occurred during the audit cycle.");
            }

            await Task.Delay(TimeSpan.FromSeconds(IntervalSeconds), stoppingToken);
        }
    }

    private async Task AuditPendingScoresAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<GameDbContext>();

        // Fetch a batch of unvalidated scores (Domain 4: Batching)
        var pendingScores = await db.Scores
            .Where(s => !s.IsValidated)
            .OrderBy(s => s.AchievedAt)
            .Take(BatchSize)
            .ToListAsync();

        if (pendingScores.Count == 0) return;

        _logger.LogInformation("[Auditor] Processing {Count} pending scores...", pendingScores.Count);

        foreach (var score in pendingScores)
        {
            // --- Domain 10: Inmutabilidad y Auditoría ---
            // In a real project, we would re-verify the Trust Signature and Biomechanics 
            // from the Metadata JSON blob here before committing.
            
            if (score.Metadata != null && score.Metadata.Contains("FRAUD_FLAG"))
            {
                // Permanent isolation: It stays in IsValidated = false
                _logger.LogWarning("[Auditor] Fraudulent score detected (ID: {Id}). Isolated.", score.Id);
                // We keep it for forensic analysis but it will never appear in the Leaderboard
                score.IsValidated = false; 
            }
            else
            {
                // Validation passed: Moving to official status
                score.IsValidated = true;
            }
        }

        // Domain 15: Atomic Commit
        await db.SaveChangesAsync();
        _logger.LogInformation("[Auditor] Batch commit successful. Landing Zone cleared.");
    }
}
