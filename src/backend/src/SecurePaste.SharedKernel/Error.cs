namespace SecurePaste.SharedKernel;

public enum ErrorType
{
    Validation,
    NotFound,
    Gone,
    Forbidden,
    TooLarge
}

public sealed record Error(string Code, string Message, ErrorType Type)
{
    public static Error Validation(string code, string message) => new(code, message, ErrorType.Validation);

    public static Error NotFound(string code, string message) => new(code, message, ErrorType.NotFound);

    public static Error Gone(string code, string message) => new(code, message, ErrorType.Gone);

    public static Error Forbidden(string code, string message) => new(code, message, ErrorType.Forbidden);

    public static Error TooLarge(string code, string message) => new(code, message, ErrorType.TooLarge);
}
