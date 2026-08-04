namespace SecurePaste.SharedKernel;

public static class Base64Url
{
    public static string Encode(ReadOnlySpan<byte> bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static bool TryDecode(string? encoded, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(encoded))
        {
            return false;
        }

        var padding = (4 - (encoded.Length % 4)) % 4;
        if (padding == 3)
        {
            return false;
        }

        var padded = encoded.Replace('-', '+').Replace('_', '/') + new string('=', padding);
        var buffer = new byte[padded.Length / 4 * 3];
        if (!Convert.TryFromBase64String(padded, buffer, out var written))
        {
            return false;
        }

        bytes = buffer[..written];
        return true;
    }
}
