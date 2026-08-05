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

        hash.Matches(token).Should().BeTrue();
    }

    [Fact]
    public void Wrong_token_is_rejected()
    {
        var hash = DeleteTokenHash.FromToken(RandomNumberGenerator.GetBytes(32));

        hash.Matches(RandomNumberGenerator.GetBytes(32)).Should().BeFalse();
    }

    [Fact]
    public void Hash_round_trips_through_its_byte_form()
    {
        var token = RandomNumberGenerator.GetBytes(32);
        var original = DeleteTokenHash.FromToken(token);

        var restored = DeleteTokenHash.FromHash(original.ToByteArray());

        restored.Matches(token).Should().BeTrue();
    }

    [Fact]
    public void A_hash_must_be_exactly_32_bytes()
    {
        var act = () => DeleteTokenHash.FromHash(new byte[16]);

        act.Should().Throw<ArgumentException>();
    }
}
