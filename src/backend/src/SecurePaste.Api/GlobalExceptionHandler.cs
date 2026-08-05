using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using SecurePaste.Modules.Pastes.Endpoints;

namespace SecurePaste.Api;

internal sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception for {Path}", httpContext.Request.Path);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Type = $"{ProblemResults.TypeBase}internal",
                Title = "Something went wrong",
                Status = StatusCodes.Status500InternalServerError,
                Instance = httpContext.Request.Path,
            },
            options: null,
            contentType: "application/problem+json",
            cancellationToken);

        return true;
    }
}
