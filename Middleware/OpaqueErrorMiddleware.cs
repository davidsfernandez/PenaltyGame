using System.Text.Json;

namespace PenaltyGameAPI.Middleware;

/**
 * Domain 19: Opaque Error Handling & Diagnostic Silence
 * Catches unhandled exceptions and returns a generic 401/500 to prevent information leakage.
 */
public class OpaqueErrorMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<OpaqueErrorMiddleware> _logger;

    public OpaqueErrorMiddleware(RequestDelegate next, ILogger<OpaqueErrorMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Internal Logging (High Fidelity)
            _logger.LogError(ex, "An unhandled exception occurred during request processing.");

            // External Response (Zero Fidelity)
            await HandleExceptionAsync(context);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        
        // We use 401 to be deceptive, or 500 if we want to indicate a temporary fault, 
        // but the message is always generic.
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;

        var response = new
        {
            success = false,
            code = "AUTH_ERROR",
            message = "Access could not be established."
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
