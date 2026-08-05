namespace SecurePaste.SharedKernel;

public static class Base64Url
{
    private const int CharsPerBlock = 4;
    private const int BytesPerBlock = 3;

    public static string Encode(ReadOnlySpan<byte> bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static bool TryDecode(string? encoded, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(encoded))
        {
            return false;
        }

        var padding = (CharsPerBlock - (encoded.Length % CharsPerBlock)) % CharsPerBlock;
        if (padding == CharsPerBlock - 1)
        {
            return false;
        }

        var padded = encoded.Replace('-', '+').Replace('_', '/') + new string('=', padding);
        var buffer = new byte[padded.Length / CharsPerBlock * BytesPerBlock];
        if (!Convert.TryFromBase64String(padded, buffer, out var written))
        {
            return false;
        }

        bytes = buffer[..written];
        return true;
    }
}
