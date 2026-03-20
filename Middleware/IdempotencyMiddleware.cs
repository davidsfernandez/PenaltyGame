using Microsoft.Extensions.Caching.Memory;
using System.Text;

namespace PenaltyGameAPI.Middleware;

/**
 * Domain 6: Idempotency & Transactional Integrity
 * Prevents double-submission of the same shot due to network instability.
 */
public class IdempotencyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;

    public IdempotencyMiddleware(RequestDelegate next, IMemoryCache cache)
    {
        _next = next;
        _cache = cache;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Method == HttpMethods.Post && context.Request.Path.StartsWithSegments("/api/game/shoot"))
        {
            if (context.Request.Headers.TryGetValue("X-Idempotency-Key", out var idempotencyKey))
            {
                var key = idempotencyKey.ToString();

                // If we've seen this key in the last 60 seconds, return the cached result
                if (_cache.TryGetValue(key, out string? cachedResponse))
                {
                    context.Response.StatusCode = 200;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsync(cachedResponse ?? "{\"status\":\"ok\",\"cached\":true}");
                    return;
                }

                // Capture the response to cache it
                var originalBodyStream = context.Response.Body;
                using var responseBody = new MemoryStream();
                context.Response.Body = responseBody;

                await _next(context);

                context.Response.Body.Seek(0, SeekOrigin.Begin);
                var responseText = await new StreamReader(context.Response.Body).ReadToEndAsync();
                context.Response.Body.Seek(0, SeekOrigin.Begin);

                // Cache the successful response for this idempotency key
                if (context.Response.StatusCode >= 200 && context.Response.StatusCode < 300)
                {
                    var cacheEntryOptions = new MemoryCacheEntryOptions()
                        .SetAbsoluteExpiration(TimeSpan.FromSeconds(60));
                    _cache.Set(key, responseText, cacheEntryOptions);
                }

                await responseBody.CopyToAsync(originalBodyStream);
                return;
            }
        }

        await _next(context);
    }
}
