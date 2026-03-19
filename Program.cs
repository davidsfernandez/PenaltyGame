using Microsoft.EntityFrameworkCore;
using PenaltyGameAPI.Data;
using PenaltyGameAPI.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Configure SQLite
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=game.db";
builder.Services.AddDbContext<GameDbContext>(options =>
    options.UseSqlite(connectionString));

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Enable static files and default files
app.UseDefaultFiles();
app.UseStaticFiles();

// Enable CORS
app.UseCors("AllowAll");

// Map Endpoints
app.MapLeaderboardEndpoints();

app.Run();
