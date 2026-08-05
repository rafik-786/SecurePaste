using Microsoft.EntityFrameworkCore;
using Npgsql;
using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.Modules.Pastes.Infrastructure;

namespace SecurePaste.IntegrationTests;

[Collection("postgres")]
public class PasteStoreTests(PostgresFixture fixture)
{
    private static Paste NewPaste(int? maxViews = null) =>
        Paste.Create(
            [1, 2, 3, 4],
            TimeSpan.FromHours(1),
            maxViews,
            DeleteTokenHash.FromToken(new byte[32]),
            TimeProvider.System).Value;

    [Fact]
    public async Task Concurrent_claims_on_the_last_view_have_exactly_one_winner()
    {
        var paste = NewPaste(maxViews: 1);
        await using (var setup = fixture.CreateContext())
        {
            await new PasteStore(setup).AddAsync(paste, CancellationToken.None);
        }

        await using var contextA = fixture.CreateContext();
        await using var contextB = fixture.CreateContext();
        var results = await Task.WhenAll(
            new PasteStore(contextA).ClaimViewAsync(paste.Id, CancellationToken.None),
            new PasteStore(contextB).ClaimViewAsync(paste.Id, CancellationToken.None));

        Assert.Single(results, r => r is not null);

        await using var check = fixture.CreateContext();
        Assert.True(await new PasteStore(check).ExistsAsync(paste.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Final_view_destroys_ciphertext_but_leaves_the_tombstone()
    {
        var paste = NewPaste(maxViews: 1);
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        var claimed = await store.ClaimViewAsync(paste.Id, CancellationToken.None);

        Assert.NotNull(claimed);
        Assert.Equal([1, 2, 3, 4], claimed.Ciphertext);
        Assert.Equal(0, claimed.RemainingViews);

        await using var verify = fixture.CreateContext();
        var stored = await new PasteStore(verify).GetAsync(paste.Id, CancellationToken.None);
        Assert.NotNull(stored);
        Assert.Null(stored.Ciphertext);
        Assert.NotNull(stored.DestroyedAt);
    }

    [Fact]
    public async Task Expired_paste_cannot_be_claimed_but_still_exists()
    {
        var expired = Paste.Rehydrate(
            PasteId.New(),
            [9, 9, 9],
            DateTimeOffset.UtcNow.AddHours(-2),
            DateTimeOffset.UtcNow.AddHours(-1),
            null,
            0,
            null,
            DeleteTokenHash.FromToken(new byte[32]));

        await using var context = fixture.CreateContext();
        context.Pastes.Add(expired);
        await context.SaveChangesAsync();

        var store = new PasteStore(context);
        Assert.Null(await store.ClaimViewAsync(expired.Id, CancellationToken.None));
        Assert.True(await store.ExistsAsync(expired.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Tombstoning_succeeds_once_then_reports_gone()
    {
        var paste = NewPaste();
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        Assert.True(await store.TombstoneAsync(paste.Id, CancellationToken.None));
        Assert.False(await store.TombstoneAsync(paste.Id, CancellationToken.None));
    }

    [Fact]
    public async Task Database_rejects_a_destroyed_ciphertext_without_a_tombstone_mark()
    {
        var paste = NewPaste();
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        var violation = await Assert.ThrowsAsync<PostgresException>(() =>
            context.Database.ExecuteSqlAsync(
                $"UPDATE pastes.pastes SET ciphertext = NULL WHERE id = {paste.Id.Value}"));

        Assert.Equal("23514", violation.SqlState);
    }
}
