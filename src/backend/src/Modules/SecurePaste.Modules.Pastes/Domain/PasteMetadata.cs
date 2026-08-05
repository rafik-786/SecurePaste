namespace SecurePaste.Modules.Pastes.Domain;

public sealed record PasteMetadata(
    DateTimeOffset ExpiresAt,
    int? MaxViews,
    int ViewsUsed,
    DateTimeOffset? DestroyedAt,
    int SizeBytes,
    DeleteTokenHash DeleteTokenHash)
{
    public int? RemainingViews => MaxViews is int max ? max - ViewsUsed : null;

    public bool IsGone(DateTimeOffset now) =>
        DestroyedAt is not null
        || ExpiresAt <= now
        || (MaxViews is int max && ViewsUsed >= max);
}
