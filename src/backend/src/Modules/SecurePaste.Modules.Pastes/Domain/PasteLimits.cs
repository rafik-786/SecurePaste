namespace SecurePaste.Modules.Pastes.Domain;

public static class PasteLimits
{
    public const int MaxCiphertextBytes = 262_144;
    public const int MinMaxViews = 1;
    public const int MaxMaxViews = 100;

    public static readonly TimeSpan MinExpiry = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan MaxExpiry = TimeSpan.FromDays(7);
}
