using Microsoft.AspNetCore.HttpLogging;
using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Endpoints;
using PenaltyGameAPI.Middleware;
using PenaltyGameAPI.Models;
using PenaltyGameAPI.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// --- Infrastructure ---
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=game.db";
builder.Services.AddDbContext<GameDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddOpenApi();
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<IValidationService, ValidationService>();
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer = false, ValidateAudience = false, ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"] ?? "dev-secret-key-123!"))
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(options => {
    options.AddPolicy("GamePolicy", policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

var app = builder.Build();

// --- Pipeline ---
app.UseMiddleware<OpaqueErrorMiddleware>();
if (app.Environment.IsDevelopment()) app.MapOpenApi();
app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseCors("GamePolicy");
app.UseAuthentication();
app.UseAuthorization();

// --- API Endpoints (Prompt 10) ---
app.MapResultEndpoints(); 
app.MapAccessEndpoints(); 
app.MapLeaderboardEndpoints(); 

app.Run();
