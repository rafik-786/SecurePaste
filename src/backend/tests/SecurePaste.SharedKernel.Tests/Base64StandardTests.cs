using System.Security.Cryptography;

namespace SecurePaste.SharedKernel.Tests;

public class Base64StandardTests
{
    [Fact]
    public void Round_trips_standard_base64()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        Base64Standard.TryDecode(Convert.ToBase64String(bytes), out var decoded).Should().BeTrue();
        decoded.Should().Equal(bytes);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("AQIDBA")]
    [InlineData("not base64!!")]
    [InlineData("AQID-A==")]
    public void Rejects_unpadded_malformed_or_url_safe_input(string? encoded)
    {
        Base64Standard.TryDecode(encoded, out _).Should().BeFalse();
    }
}
