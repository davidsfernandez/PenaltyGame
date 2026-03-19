using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Endpoints;
using PenaltyGameAPI.Middleware;
using PenaltyGameAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// --- Phase 1 & 3: Foundation & Persistence ---

// Configure SQLite
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=game.db";
builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseSqlite(connectionString));

// Configure OpenAPI for technical documentation (English)
builder.Services.AddOpenApi();

// --- Phase 4: Security & Validation ---
builder.Services.AddMemoryCache(); // Required for Idempotency
builder.Services.AddSingleton<IValidationService, ValidationService>();

// Configure CORS - Production Grade
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("GamePolicy", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
        else if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        }
    });
});

builder.Services.AddHttpLogging(logging =>
{
    logging.LoggingFields = HttpLoggingFields.All;
});

var app = builder.Build();

// --- Phase 4: Opaque Error Shield ---
// Must be first in pipeline to catch all exceptions silently
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

// --- Phase 4: Transactional Integrity ---
app.UseMiddleware<IdempotencyMiddleware>();

// --- API Endpoints ---
app.MapLeaderboardEndpoints();
app.MapShootEndpoints();

// Root health check
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

app.Run();

