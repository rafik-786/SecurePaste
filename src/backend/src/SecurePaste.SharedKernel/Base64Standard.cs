namespace SecurePaste.SharedKernel;

public static class Base64Standard
{
    private const int CharsPerBlock = 4;
    private const int BytesPerBlock = 3;

    public static bool TryDecode(string? encoded, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(encoded) || encoded.Length % CharsPerBlock != 0)
        {
            return false;
        }

        var buffer = new byte[encoded.Length / CharsPerBlock * BytesPerBlock];
        if (!Convert.TryFromBase64String(encoded, buffer, out var written))
        {
            return false;
        }

        bytes = buffer[..written];
        return true;
    }
}
