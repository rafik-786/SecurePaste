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

            Assert.Equal(PasteId.Length, id.Value.Length);
            Assert.All(id.Value, c => Assert.Contains(c, PasteId.Alphabet));
        }
    }

    [Fact]
    public void New_ids_do_not_collide_in_practice()
    {
        var ids = Enumerable.Range(0, 1000).Select(_ => PasteId.New().Value).ToHashSet();

        Assert.Equal(1000, ids.Count);
    }

    [Fact]
    public void TryParse_accepts_a_valid_id()
    {
        Assert.True(PasteId.TryParse("abcdefgh2345", out var id));
        Assert.Equal("abcdefgh2345", id.Value);
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
        Assert.False(PasteId.TryParse(candidate, out _));
    }
}
