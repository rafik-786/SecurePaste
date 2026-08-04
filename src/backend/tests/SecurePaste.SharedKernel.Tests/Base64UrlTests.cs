using System.Security.Cryptography;

namespace SecurePaste.SharedKernel.Tests;

public class Base64UrlTests
{
    [Fact]
    public void Round_trips_arbitrary_bytes()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        var encoded = Base64Url.Encode(bytes);

        Assert.True(Base64Url.TryDecode(encoded, out var decoded));
        Assert.Equal(bytes, decoded);
    }

    [Fact]
    public void Output_is_url_safe()
    {
        for (var i = 0; i < 50; i++)
        {
            var encoded = Base64Url.Encode(RandomNumberGenerator.GetBytes(33));

            Assert.DoesNotContain('+', encoded);
            Assert.DoesNotContain('/', encoded);
            Assert.DoesNotContain('=', encoded);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64url!")]
    [InlineData("abcde")]
    public void Invalid_input_is_rejected(string? encoded)
    {
        Assert.False(Base64Url.TryDecode(encoded, out _));
    }
}
