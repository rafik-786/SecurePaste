using System.Security.Cryptography;

namespace SecurePaste.SharedKernel.Tests;

public class Base64UrlTests
{
    [Fact]
    public void Round_trips_arbitrary_bytes()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        var encoded = Base64Url.Encode(bytes);

        Base64Url.TryDecode(encoded, out var decoded).Should().BeTrue();
        decoded.Should().Equal(bytes);
    }

    [Fact]
    public void Output_is_url_safe()
    {
        for (var i = 0; i < 50; i++)
        {
            var encoded = Base64Url.Encode(RandomNumberGenerator.GetBytes(33));

            encoded.Should().NotContain("+");
            encoded.Should().NotContain("/");
            encoded.Should().NotContain("=");
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64url!")]
    [InlineData("abcde")]
    public void Invalid_input_is_rejected(string? encoded)
    {
        Base64Url.TryDecode(encoded, out _).Should().BeFalse();
    }
}
