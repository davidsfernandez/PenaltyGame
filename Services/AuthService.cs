using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace PenaltyGameAPI.Services;

public interface IAuthService
{
    string GenerateJwt(Guid playerId, string sessionId, string ephemeralSeed);
    string CreateTimeSeal(string sessionId);
    Task ApplyTarpitAsync(int failureCount);
}

/**
 * Domain 12, 13 & 20: Identity and Security Services
 */
public class AuthService : IAuthService
{
    private readonly IConfiguration _config;
    private readonly string _secretKey;

    public AuthService(IConfiguration config)
    {
        _config = config;
        _secretKey = _config["Jwt:Secret"] ?? "a-very-long-and-secure-secret-key-for-development-123!";
    }

    /**
     * Domain 12: Ephemeral Seed Injection
     */
    public string GenerateJwt(Guid playerId, string sessionId, string ephemeralSeed)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(_secretKey);
        
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[] 
            {
                new Claim("playerId", playerId.ToString()),
                new Claim("sessionId", sessionId),
                new Claim("seed", ephemeralSeed) // Domain 12
            }),
            Expires = DateTime.UtcNow.AddMinutes(15),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    /**
     * Domain 20: Cryptographic Time-Seal
     */
    public string CreateTimeSeal(string sessionId)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
        var rawSeal = $"{sessionId}_{timestamp}";
        
        // Sign the seal to make it immutable for the client
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(rawSeal)));
        
        return $"{rawSeal}.{signature}";
    }

    /**
     * Domain 13: Progressive Tarpitting
     */
    public async Task ApplyTarpitAsync(int failureCount)
    {
        if (failureCount <= 0) return;

        // Progresión: 1er fallo = 200ms, 2do = 1s, 3ro = 5s, 4to+ = 15s
        int delayMs = failureCount switch
        {
            1 => 200,
            2 => 1000,
            3 => 5000,
            _ => 15000
        };

        await Task.Delay(delayMs);
    }
}
