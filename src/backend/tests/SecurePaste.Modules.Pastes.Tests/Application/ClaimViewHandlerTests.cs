using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Tests.Application;

public class ClaimViewHandlerTests
{
    private readonly HandlerTestBed _bed = new();

    [Fact]
    public async Task Unlimited_paste_can_be_claimed_repeatedly()
    {
        var created = await _bed.CreatePasteAsync();

        var first = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);
        var second = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.Equal([1, 2, 3, 4], first.Value.Ciphertext);
        Assert.Null(first.Value.RemainingViews);
        Assert.True(second.IsSuccess);
    }

    [Fact]
    public async Task View_limited_paste_counts_down_then_goes_gone()
    {
        var created = await _bed.CreatePasteAsync(maxViews: 2);

        var first = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);
        var second = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);
        var third = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);

        Assert.Equal(1, first.Value.RemainingViews);
        Assert.Equal(0, second.Value.RemainingViews);
        Assert.Equal(ErrorType.Gone, third.Error!.Type);
    }

    [Fact]
    public async Task Final_view_destroys_the_ciphertext_but_keeps_the_tombstone()
    {
        var created = await _bed.CreatePasteAsync(maxViews: 1);

        await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);

        Assert.True(SecurePaste.Modules.Pastes.Domain.PasteId.TryParse(created.Id, out var id));
        var stored = await _bed.Store.GetAsync(id, CancellationToken.None);
        Assert.NotNull(stored);
        Assert.Null(stored.Ciphertext);
        Assert.NotNull(stored.DestroyedAt);
    }

    [Fact]
    public async Task Expired_paste_is_gone_not_missing()
    {
        var created = await _bed.CreatePasteAsync(expiresIn: TimeSpan.FromMinutes(5));
        _bed.Clock.Advance(TimeSpan.FromMinutes(5));

        var result = await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);

        Assert.Equal(ErrorType.Gone, result.Error!.Type);
    }

    [Fact]
    public async Task Unknown_and_malformed_ids_are_not_found()
    {
        var unknown = await _bed.Claim.HandleAsync("abcdefgh2345", CancellationToken.None);
        var malformed = await _bed.Claim.HandleAsync("!!!", CancellationToken.None);

        Assert.Equal(ErrorType.NotFound, unknown.Error!.Type);
        Assert.Equal(ErrorType.NotFound, malformed.Error!.Type);
    }
}
