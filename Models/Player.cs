using System.ComponentModel.DataAnnotations;

namespace PenaltyGameAPI.Models;

public class Player
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property
    public ICollection<Score> Scores { get; set; } = new List<Score>();
}
