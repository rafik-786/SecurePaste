using System.Security.Cryptography;

namespace SecurePaste.Modules.Pastes.Domain;

public readonly record struct PasteId
{
    public const int Length = 12;

    internal const string Alphabet = "abcdefghjkmnpqrstuvwxyz23456789";

    private PasteId(string value)
    {
        Value = value;
    }

    public string Value { get; }

    public static PasteId New()
    {
        Span<char> chars = stackalloc char[Length];
        for (var i = 0; i < Length; i++)
        {
            chars[i] = Alphabet[RandomNumberGenerator.GetInt32(Alphabet.Length)];
        }

        return new PasteId(new string(chars));
    }

    public static bool TryParse(string? candidate, out PasteId id)
    {
        id = default;
        if (candidate is null || candidate.Length != Length)
        {
            return false;
        }

        foreach (var c in candidate)
        {
            if (!Alphabet.Contains(c))
            {
                return false;
            }
        }

        id = new PasteId(candidate);
        return true;
    }

    internal static PasteId FromTrusted(string value) => new(value);

    public override string ToString() => Value;
}
