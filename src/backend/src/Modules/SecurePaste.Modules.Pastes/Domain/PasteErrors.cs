using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Domain;

public static class PasteErrors
{
    public static readonly Error NotFound =
        Error.NotFound("Paste.NotFound", "No paste exists with this id.");

    public static readonly Error Gone =
        Error.Gone("Paste.Gone", "The paste expired, was consumed, or was deleted.");

    public static readonly Error WrongDeleteToken =
        Error.Forbidden("Paste.WrongDeleteToken", "The delete token does not match.");

    public static readonly Error TooLarge =
        Error.TooLarge("Paste.TooLarge", "Ciphertext exceeds the 256 KB limit.");

    public static Error Validation(string message) =>
        Error.Validation("Paste.Validation", message);
}
