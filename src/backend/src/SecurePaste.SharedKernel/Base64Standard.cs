namespace SecurePaste.SharedKernel;

public static class Base64Standard
{
    public static bool TryDecode(string? encoded, out byte[] bytes)
    {
        bytes = [];
        if (string.IsNullOrEmpty(encoded) || encoded.Length % 4 != 0)
        {
            return false;
        }

        var buffer = new byte[encoded.Length / 4 * 3];
        if (!Convert.TryFromBase64String(encoded, buffer, out var written))
        {
            return false;
        }

        bytes = buffer[..written];
        return true;
    }
}
