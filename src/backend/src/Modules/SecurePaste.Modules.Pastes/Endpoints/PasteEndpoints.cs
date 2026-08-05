using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Endpoints;

public static class PasteEndpoints
{
    public const string GroupPrefix = "/api/v1/pastes";
    public const string CreateRateLimitPolicy = "paste-create";
    public const string ClaimRateLimitPolicy = "paste-claim";
    public const string DeleteTokenHeader = "X-Delete-Token";

    public static IEndpointRouteBuilder MapPastesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(GroupPrefix);

        group.MapPost("/", CreateAsync).RequireRateLimiting(CreateRateLimitPolicy);
        group.MapGet("/{id}", PeekAsync);
        group.MapPost("/{id}/views", ClaimAsync).RequireRateLimiting(ClaimRateLimitPolicy);
        group.MapDelete("/{id}", DeleteAsync);

        return app;
    }

    private static async Task<IResult> CreateAsync(
        CreatePasteRequest request,
        CreatePasteHandler handler,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        if (!TryDecodeBase64(request.Ciphertext, out var ciphertext))
        {
            return ProblemResults.From(
                PasteErrors.Validation("Ciphertext must be valid base64."), context);
        }

        var command = new CreatePasteCommand(
            ciphertext,
            TimeSpan.FromSeconds(request.ExpiresInSeconds),
            request.MaxViews);
        var result = await handler.HandleAsync(command, cancellationToken);

        return result.IsSuccess
            ? Results.Created($"{GroupPrefix}/{result.Value.Id}", result.Value)
            : ProblemResults.From(result.Error!, context);
    }

    private static async Task<IResult> PeekAsync(
        string id,
        PeekPasteHandler handler,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(id, cancellationToken);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : ProblemResults.From(result.Error!, context);
    }

    private static async Task<IResult> ClaimAsync(
        string id,
        ClaimViewHandler handler,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(id, cancellationToken);
        return result.IsSuccess
            ? Results.Ok(result.Value)
            : ProblemResults.From(result.Error!, context);
    }

    private static async Task<IResult> DeleteAsync(
        string id,
        [FromHeader(Name = DeleteTokenHeader)] string? deleteToken,
        DeletePasteHandler handler,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(id, deleteToken, cancellationToken);
        return result.IsSuccess
            ? Results.NoContent()
            : ProblemResults.From(result.Error!, context);
    }

    private static bool TryDecodeBase64(string? encoded, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(encoded) || encoded.Length % 4 != 0)
        {
            return false;
        }

        var buffer = new byte[encoded.Length / 4 * 3];
        if (!Convert.TryFromBase64String(encoded, buffer, out var written))
        {
            return false;
        }

        bytes = buffer[..written];
        return true;
    }
}
