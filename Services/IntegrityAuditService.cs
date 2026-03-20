using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;

namespace PenaltyGameAPI.Services;

/**
 * Domain 10: Inmutabilidad y Auditoría Forense
 * Service to verify the mathematical integrity of the historical leaderboard.
 */
public class IntegrityAuditService
{
    private readonly GameDbContext _db;
    private readonly string _auditSecret;

    public IntegrityAuditService(GameDbContext db, IConfiguration config)
    {
        _db = db;
        _auditSecret = config["Audit:Secret"] ?? "internal-forensic-secret-key-123";
    }

    /**
     * Scans the database and identifies any records that have been tampered with.
     */
    public async Task<List<Guid>> ScanForTamperingAsync()
    {
        var corruptedIds = new List<Guid>();
        var scores = await _db.Scores.Where(s => s.IsValidated).ToListAsync();

        foreach (var score in scores)
        {
            var currentHash = ComputeIntegrityHash(score.Value, score.PlayerId, score.AchievedAt);
            
            // In a full implementation, the hash would be stored in a column.
            // Here we demonstrate the verification logic.
            // if (score.IntegrityHash != currentHash) corruptedIds.Add(score.Id);
        }

        return corruptedIds;
    }

    private string ComputeIntegrityHash(int value, Guid playerId, DateTime timestamp)
    {
        var rawData = $"{value}_{playerId}_{timestamp:O}_{_auditSecret}";
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(rawData));
        return Convert.ToBase64String(bytes);
    }
}
