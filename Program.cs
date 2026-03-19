using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Endpoints;
using PenaltyGameAPI.Middleware;
using PenaltyGameAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// --- Phase 1 & 3: Foundation & Persistence ---
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=game.db";
builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseSqlite(connectionString));

builder.Services.AddOpenApi();

// --- Phase 4 & 6: Security & Identity ---
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IValidationService, ValidationService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// --- Domain 50: Legacy Configuration ---
bool isCampaignActive = builder.Configuration.GetValue<bool>("Campaign:IsActive", true);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"] ?? "a-very-long-and-secure-secret-key-for-development-123!"))
        };
    });

builder.Services.AddAuthorization();

// Configure CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddPolicy("GamePolicy", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader();
        }
        else if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
        }
    });
});

builder.Services.AddHttpLogging(logging => { logging.LoggingFields = HttpLoggingFields.All; });

// --- Phase 7: Background Processing ---
builder.Services.AddHostedService<ScoreAuditorWorker>();

var app = builder.Build();

// --- Middleware Pipeline ---
app.UseMiddleware<OpaqueErrorMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseHttpLogging();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        const int durationInSeconds = 60 * 60 * 24 * 7;
        ctx.Context.Response.Headers.Append("Cache-Control", $"public,max-age={durationInSeconds}");
    }
});

app.UseCors("GamePolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<IdempotencyMiddleware>();

// --- Domain 50: Campaign Lifecycle Gates ---
// If campaign is inactive, block write endpoints with a themed response
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value?.ToLower() ?? "";
    if (!isCampaignActive && (path.Contains("/api/game/shoot") || path.Contains("/api/access/validate")))
    {
        context.Response.StatusCode = StatusCodes.Status410Gone;
        await context.Response.WriteAsJsonAsync(new { success = false, message = "The campaign has concluded. Thank you for participating." });
        return;
    }
    await next();
});

// --- API Endpoints ---
app.MapAccessEndpoints(); 
app.MapLeaderboardEndpoints(); 
app.MapShootEndpoints(); 

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", isCampaignActive, timestamp = DateTime.UtcNow }));

app.Run();
