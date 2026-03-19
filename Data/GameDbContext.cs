using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Models;

namespace PenaltyGameAPI.Data;

public class GameDbContext : DbContext
{
    public GameDbContext(DbContextOptions<GameDbContext> options) : base(options)
    {
    }

    public DbSet<Player> Players => Set<Player>();
    public DbSet<Score> Scores => Set<Score>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure Player
        modelBuilder.Entity<Player>(entity =>
        {
            entity.HasIndex(p => p.Username).IsUnique();
            entity.Property(p => p.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        // Configure Score
        modelBuilder.Entity<Score>(entity =>
        {
            entity.HasOne(s => s.Player)
                  .WithMany(p => p.Scores)
                  .HasForeignKey(s => s.PlayerId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.Property(s => s.AchievedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.Property(s => s.IsValidated).HasDefaultValue(false);

            // Index for leaderboard queries
            entity.HasIndex(s => new { s.IsValidated, s.Value, s.AchievedAt });
        });
    }
}
