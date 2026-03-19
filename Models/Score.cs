using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PenaltyGameAPI.Models;

public class Score
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    public Guid PlayerId { get; set; }

    [Required]
    public int Value { get; set; }

    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Landing Zone flag: Scores are initially marked as IsValidated = false.
    /// Phase 4 will handle validation.
    /// </summary>
    public bool IsValidated { get; set; } = false;

    // Navigation property
    [ForeignKey(nameof(PlayerId))]
    public Player? Player { get; set; }
}
