using System.ComponentModel.DataAnnotations;

namespace PenaltyGameAPI.Models;

/**
 * Domain 10: Shadow Log for Forensic Audit
 * Stores immutable records of interactions for verification.
 */
public class AuditLog
{
    [Key]
    public Guid Id { get; set; }

    public Guid? PlayerId { get; set; }
    
    [Required]
    public string EventType { get; set; } = string.Empty; // e.g., "SHOT_VALIDATION", "AUTH_FAILURE"

    [Required]
    public string Description { get; set; } = string.Empty;

    public string? Metadata { get; set; } // JSON blob with raw vectors or request headers

    public string? IpAddress { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
