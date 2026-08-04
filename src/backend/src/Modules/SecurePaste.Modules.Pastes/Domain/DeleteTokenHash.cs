using System.Security.Cryptography;

namespace SecurePaste.Modules.Pastes.Domain;

public sealed class DeleteTokenHash
{
    public const int HashLength = 32;

    private readonly byte[] _hash;

    private DeleteTokenHash(byte[] hash)
    {
        _hash = hash;
    }

    public static DeleteTokenHash FromToken(ReadOnlySpan<byte> token) =>
        new(SHA256.HashData(token));

    public static DeleteTokenHash FromHash(byte[] hash) =>
        hash.Length == HashLength
            ? new DeleteTokenHash(hash)
            : throw new ArgumentException($"A SHA-256 hash is {HashLength} bytes.", nameof(hash));

    public bool Matches(ReadOnlySpan<byte> token) =>
        CryptographicOperations.FixedTimeEquals(_hash, SHA256.HashData(token));

    public byte[] ToByteArray() => (byte[])_hash.Clone();
}
