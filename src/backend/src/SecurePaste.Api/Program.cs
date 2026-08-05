using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Mvc;
using SecurePaste.Api;
using SecurePaste.Modules.Pastes;
using SecurePaste.Modules.Pastes.Endpoints;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;

const long maxRequestBodyBytes = 400_000;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(kestrel => kestrel.Limits.MaxRequestBodySize = maxRequestBodyBytes);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHealthChecks().AddDbContextCheck<PastesDbContext>("database");
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddPastesModule(builder.Configuration);
builder.Services.AddRateLimiter(limiter =>
{
    limiter.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Type = $"{ProblemResults.TypeBase}rate-limited",
                Title = "Too many requests",
                Status = StatusCodes.Status429TooManyRequests,
                Instance = context.HttpContext.Request.Path,
            },
            options: null,
            contentType: "application/problem+json",
            cancellationToken);
    };
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseRateLimiter();

app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/readyz");
app.MapPastesEndpoints();

app.Run();

public partial class Program;
