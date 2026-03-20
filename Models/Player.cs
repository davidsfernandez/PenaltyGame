using System.ComponentModel.DataAnnotations;

namespace PenaltyGameAPI.Models;

/**
 * Domain 2 & 18: Abstract Information Model & Zero-Trust Identification
 * Represents a game participant.
 */
public class Player
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(25)]
    public string Username { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public ICollection<Score> Scores { get; set; } = new List<Score>();
}
