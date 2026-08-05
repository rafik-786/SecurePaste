using Microsoft.AspNetCore.Http;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Endpoints;

public static class ProblemResults
{
    public const string TypeBase = "https://securepaste.app/problems/";

    public static IResult From(Error error, HttpContext context)
    {
        var (status, suffix, title) = Map(error.Type);
        return Results.Problem(
            type: TypeBase + suffix,
            title: title,
            detail: error.Message,
            statusCode: status,
            instance: context.Request.Path);
    }

    private static (int Status, string Suffix, string Title) Map(ErrorType type) => type switch
    {
        ErrorType.Validation => (StatusCodes.Status400BadRequest, "validation", "The request is invalid"),
        ErrorType.NotFound => (StatusCodes.Status404NotFound, "paste-not-found", "No such paste"),
        ErrorType.Gone => (StatusCodes.Status410Gone, "paste-gone", "Paste is no longer available"),
        ErrorType.Forbidden => (StatusCodes.Status403Forbidden, "invalid-delete-token", "The delete token does not match"),
        ErrorType.TooLarge => (StatusCodes.Status413PayloadTooLarge, "payload-too-large", "The paste is too large"),
    };
}
