using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Domain;

public sealed class Paste
{
    private Paste(
        PasteId id,
        byte[]? ciphertext,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        int? maxViews,
        int viewsUsed,
        DateTimeOffset? destroyedAt,
        DeleteTokenHash deleteTokenHash)
    {
        Id = id;
        Ciphertext = ciphertext;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        MaxViews = maxViews;
        ViewsUsed = viewsUsed;
        DestroyedAt = destroyedAt;
        DeleteTokenHash = deleteTokenHash;
    }

    public PasteId Id { get; }

    public byte[]? Ciphertext { get; }

    public DateTimeOffset CreatedAt { get; }

    public DateTimeOffset ExpiresAt { get; }

    public int? MaxViews { get; }

    public int ViewsUsed { get; }

    public DateTimeOffset? DestroyedAt { get; }

    public DeleteTokenHash DeleteTokenHash { get; }

    public int? RemainingViews => MaxViews is int max ? max - ViewsUsed : null;

    public bool IsGone(DateTimeOffset now) =>
        DestroyedAt is not null
        || ExpiresAt <= now
        || (MaxViews is int max && ViewsUsed >= max);

    public static Result<Paste> Create(
        byte[] ciphertext,
        TimeSpan expiresIn,
        int? maxViews,
        DeleteTokenHash deleteTokenHash,
        TimeProvider clock)
    {
        if (ciphertext is null || ciphertext.Length == 0)
        {
            return PasteErrors.Validation("Ciphertext is required.");
        }

        if (ciphertext.Length > PasteLimits.MaxCiphertextBytes)
        {
            return PasteErrors.TooLarge;
        }

        if (expiresIn < PasteLimits.MinExpiry || expiresIn > PasteLimits.MaxExpiry)
        {
            return PasteErrors.Validation("Expiry must be between 60 seconds and 7 days.");
        }

        if (maxViews is < PasteLimits.MinMaxViews or > PasteLimits.MaxMaxViews)
        {
            return PasteErrors.Validation("Max views must be between 1 and 100.");
        }

        var now = clock.GetUtcNow();
        return new Paste(PasteId.New(), ciphertext, now, now + expiresIn, maxViews, 0, null, deleteTokenHash);
    }

    internal static Paste Rehydrate(
        PasteId id,
        byte[]? ciphertext,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        int? maxViews,
        int viewsUsed,
        DateTimeOffset? destroyedAt,
        DeleteTokenHash deleteTokenHash) =>
        new(id, ciphertext, createdAt, expiresAt, maxViews, viewsUsed, destroyedAt, deleteTokenHash);
}
