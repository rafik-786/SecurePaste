using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Tests.Application;

public abstract class PasteStoreContractTests
{
    protected abstract Task<IPasteStore> CreateStoreAsync();

    private static Paste NewPaste(int? maxViews = null) =>
        Paste.Create(
            [1, 2, 3, 4],
            TimeSpan.FromHours(1),
            maxViews,
            DeleteTokenHash.FromToken(new byte[32]),
            TimeProvider.System).Value;

    [Fact]
    public async Task Missing_paste_reports_absent_everywhere()
    {
        var store = await CreateStoreAsync();
        var id = PasteId.New();

        (await store.GetMetadataAsync(id, CancellationToken.None)).Should().BeNull();
        (await store.ExistsAsync(id, CancellationToken.None)).Should().BeFalse();
        (await store.ClaimViewAsync(id, CancellationToken.None)).Should().BeNull();
        (await store.TombstoneAsync(id, CancellationToken.None)).Should().BeFalse();
    }

    [Fact]
    public async Task Claim_counts_down_and_tombstones_the_final_view()
    {
        var store = await CreateStoreAsync();
        var paste = NewPaste(maxViews: 2);
        await store.AddAsync(paste, CancellationToken.None);

        var before = await store.GetMetadataAsync(paste.Id, CancellationToken.None);
        before!.SizeBytes.Should().Be(4);
        before.RemainingViews.Should().Be(2);

        var first = await store.ClaimViewAsync(paste.Id, CancellationToken.None);
        first!.Ciphertext.Should().Equal(1, 2, 3, 4);
        first.RemainingViews.Should().Be(1);

        var second = await store.ClaimViewAsync(paste.Id, CancellationToken.None);
        second!.RemainingViews.Should().Be(0);

        var after = await store.GetMetadataAsync(paste.Id, CancellationToken.None);
        after!.DestroyedAt.Should().NotBeNull();
        after.IsGone(TimeProvider.System.GetUtcNow()).Should().BeTrue();

        (await store.ClaimViewAsync(paste.Id, CancellationToken.None)).Should().BeNull();
        (await store.ExistsAsync(paste.Id, CancellationToken.None)).Should().BeTrue();
    }

    [Fact]
    public async Task Unlimited_paste_claims_repeatedly_without_tombstoning()
    {
        var store = await CreateStoreAsync();
        var paste = NewPaste();
        await store.AddAsync(paste, CancellationToken.None);

        for (var i = 0; i < 3; i++)
        {
            var claimed = await store.ClaimViewAsync(paste.Id, CancellationToken.None);
            claimed!.RemainingViews.Should().BeNull();
        }

        var metadata = await store.GetMetadataAsync(paste.Id, CancellationToken.None);
        metadata!.IsGone(TimeProvider.System.GetUtcNow()).Should().BeFalse();
    }

    [Fact]
    public async Task Expired_paste_cannot_be_claimed_but_still_exists()
    {
        var store = await CreateStoreAsync();
        var expired = Paste.Rehydrate(
            PasteId.New(),
            [9, 9, 9],
            DateTimeOffset.UtcNow.AddHours(-2),
            DateTimeOffset.UtcNow.AddHours(-1),
            null,
            0,
            null,
            DeleteTokenHash.FromToken(new byte[32]));
        await store.AddAsync(expired, CancellationToken.None);

        (await store.ClaimViewAsync(expired.Id, CancellationToken.None)).Should().BeNull();
        (await store.ExistsAsync(expired.Id, CancellationToken.None)).Should().BeTrue();
        var metadata = await store.GetMetadataAsync(expired.Id, CancellationToken.None);
        metadata!.IsGone(TimeProvider.System.GetUtcNow()).Should().BeTrue();
    }

    [Fact]
    public async Task Tombstone_succeeds_once_then_reports_false()
    {
        var store = await CreateStoreAsync();
        var paste = NewPaste();
        await store.AddAsync(paste, CancellationToken.None);

        (await store.TombstoneAsync(paste.Id, CancellationToken.None)).Should().BeTrue();

        var metadata = await store.GetMetadataAsync(paste.Id, CancellationToken.None);
        metadata!.DestroyedAt.Should().NotBeNull();
        metadata.SizeBytes.Should().Be(0);

        (await store.TombstoneAsync(paste.Id, CancellationToken.None)).Should().BeFalse();
    }
}

public sealed class FakePasteStoreContractTests : PasteStoreContractTests
{
    protected override Task<IPasteStore> CreateStoreAsync() =>
        Task.FromResult<IPasteStore>(new FakePasteStore(TimeProvider.System));
}
