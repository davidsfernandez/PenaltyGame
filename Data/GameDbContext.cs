using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Data;

/**
 * Domain 2 & 4: Data Consistency & High Scalability
 */
public class GameDbContext : DbContext
{
    public GameDbContext(DbContextOptions<GameDbContext> options) : base(options) { }

    public DbSet<Player> Players => Set<Player>();
    public DbSet<Score> Scores => Set<Score>();
    public DbSet<AccessCredential> AccessCredentials => Set<AccessCredential>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Player configuration
        modelBuilder.Entity<Player>()
            .HasIndex(p => p.Username)
            .IsUnique();

        // AccessCredential configuration
        modelBuilder.Entity<AccessCredential>()
            .HasIndex(ac => ac.TokenHash)
            .IsUnique();

        // Score configuration & Composite Index for Leaderboard optimization
        // Domain 4: High Scalability
        modelBuilder.Entity<Score>()
            .HasIndex(s => new { s.IsValidated, s.Value, s.AchievedAt })
            .HasDatabaseName("IX_Leaderboard_Optimized");

        // Relationships
        modelBuilder.Entity<Score>()
            .HasOne(s => s.Player)
            .WithMany(p => p.Scores)
            .HasForeignKey(s => s.PlayerId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
