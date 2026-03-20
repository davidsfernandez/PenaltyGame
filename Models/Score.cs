using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PenaltyGameAPI.Models;

/**
 * Domain 2, 10 & 15: Scoring, Immutability & Privilege Segregation
 * Represents a single score entry in the Landing Zone.
 */
public class Score
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    public Guid PlayerId { get; set; }

    [ForeignKey("PlayerId")]
    public Player? Player { get; set; }

    [Required]
    public int Value { get; set; }

    public DateTime AchievedAt { get; set; } = DateTime.UtcNow;

    /**
     * Landing Zone Flag: 
     * Initialized as false. Only the background auditor (Phase 4) 
     * should flip this to true after Trust Signature verification.
     */
    public bool IsValidated { get; set; } = false;

    // Forensic Telemetry (Domain 12 & 14)
    public string? Metadata { get; set; } // JSON blob with physics vectors for audit
}
