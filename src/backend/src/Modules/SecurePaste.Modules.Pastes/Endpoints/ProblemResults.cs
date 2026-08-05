using Microsoft.AspNetCore.Http;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Endpoints;

public static class ProblemResults
{
    public const string TypeBase = "https://securepaste.app/problems/";

    public static IResult From(Error error, HttpContext context) =>
        Results.Problem(
            type: TypeBase + TypeSuffix(error.Type),
            title: Title(error.Type),
            detail: error.Message,
            statusCode: StatusCode(error.Type),
            instance: context.Request.Path);

    private static int StatusCode(ErrorType type) => type switch
    {
        ErrorType.Validation => StatusCodes.Status400BadRequest,
        ErrorType.NotFound => StatusCodes.Status404NotFound,
        ErrorType.Gone => StatusCodes.Status410Gone,
        ErrorType.Forbidden => StatusCodes.Status403Forbidden,
        ErrorType.TooLarge => StatusCodes.Status413PayloadTooLarge,
        _ => StatusCodes.Status500InternalServerError,
    };

    private static string TypeSuffix(ErrorType type) => type switch
    {
        ErrorType.Validation => "validation",
        ErrorType.NotFound => "paste-not-found",
        ErrorType.Gone => "paste-gone",
        ErrorType.Forbidden => "invalid-delete-token",
        ErrorType.TooLarge => "payload-too-large",
        _ => "internal",
    };

    private static string Title(ErrorType type) => type switch
    {
        ErrorType.Validation => "The request is invalid",
        ErrorType.NotFound => "No such paste",
        ErrorType.Gone => "Paste is no longer available",
        ErrorType.Forbidden => "The delete token does not match",
        ErrorType.TooLarge => "The paste is too large",
        _ => "Something went wrong",
    };
}
