using System.Security.Cryptography;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Tests.Domain;

public class DeleteTokenHashTests
{
    [Fact]
    public void Matching_token_is_recognized()
    {
        var token = RandomNumberGenerator.GetBytes(32);

        var hash = DeleteTokenHash.FromToken(token);

        Assert.True(hash.Matches(token));
    }

    [Fact]
    public void Wrong_token_is_rejected()
    {
        var hash = DeleteTokenHash.FromToken(RandomNumberGenerator.GetBytes(32));

        Assert.False(hash.Matches(RandomNumberGenerator.GetBytes(32)));
    }

    [Fact]
    public void Hash_round_trips_through_its_byte_form()
    {
        var token = RandomNumberGenerator.GetBytes(32);
        var original = DeleteTokenHash.FromToken(token);

        var restored = DeleteTokenHash.FromHash(original.ToByteArray());

        Assert.True(restored.Matches(token));
    }

    [Fact]
    public void A_hash_must_be_exactly_32_bytes()
    {
        Assert.Throws<ArgumentException>(() => DeleteTokenHash.FromHash(new byte[16]));
    }
}
