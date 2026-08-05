namespace SecurePaste.Modules.Pastes.Domain;

public static class PasteLimits
{
    public const int MaxCiphertextBytes = 262_144;
    public const int MinMaxViews = 1;
    public const int MaxMaxViews = 100;
    public const int DeleteTokenBytes = 32;

    // DB backstop above the domain cap so the application always rejects first.
    public const int DbCiphertextCeiling = 270_000;

    private const int Base64InflatedCap = (MaxCiphertextBytes + 2) / 3 * 4;
    private const int JsonEnvelopeAllowance = 50_000;

    // Transport cap: the domain cap after base64 inflation, plus JSON envelope room.
    public const long MaxHttpRequestBytes = Base64InflatedCap + JsonEnvelopeAllowance;

    public static readonly TimeSpan MinExpiry = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan MaxExpiry = TimeSpan.FromDays(7);
}
