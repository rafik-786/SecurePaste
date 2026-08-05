using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Tests.Domain;

public class PasteIdTests
{
    [Fact]
    public void New_ids_are_twelve_chars_from_the_alphabet()
    {
        for (var i = 0; i < 100; i++)
        {
            var id = PasteId.New();

            id.Value.Should().HaveLength(PasteId.Length);
            id.Value.ToCharArray().Should().OnlyContain(c => PasteId.Alphabet.Contains(c));
        }
    }

    [Fact]
    public void New_ids_do_not_collide_in_practice()
    {
        var ids = Enumerable.Range(0, 1000).Select(_ => PasteId.New().Value).ToHashSet();

        ids.Should().HaveCount(1000);
    }

    [Fact]
    public void TryParse_accepts_a_valid_id()
    {
        PasteId.TryParse("abcdefgh2345", out var id).Should().BeTrue();
        id.Value.Should().Be("abcdefgh2345");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("waytoolongtobevalid")]
    [InlineData("abcdefgh234O")]
    [InlineData("abcdefgh2340")]
    [InlineData("abcdefgh234l")]
    [InlineData("abcdefgh2341")]
    [InlineData("ABCDEFGH2345")]
    public void TryParse_rejects_invalid_input(string? candidate)
    {
        PasteId.TryParse(candidate, out _).Should().BeFalse();
    }
}
