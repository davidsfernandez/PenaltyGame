using System.ComponentModel.DataAnnotations;

namespace PenaltyGameAPI.Models;

/**
 * Domain 11: Security & Credential Lifecycle
 * Represents an access token that governs the right to play.
 */
public enum CredentialStatus
{
    Available,
    Active,
    Consumed,
    Voided,
    Expired
}

public class AccessCredential
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(64)]
    public string TokenHash { get; set; } = string.Empty;

    public CredentialStatus Status { get; set; } = CredentialStatus.Available;

    // Domain 11: Soft-Lock Binding
    public string? CurrentSessionId { get; set; }
    public DateTime? LeaseExpiry { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UsedAt { get; set; }
}
