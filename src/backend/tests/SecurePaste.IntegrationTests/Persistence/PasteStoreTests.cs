using Microsoft.EntityFrameworkCore;
using Npgsql;
using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;

namespace SecurePaste.IntegrationTests.Persistence;

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

        results.Should().ContainSingle(r => r != null);

        await using var check = fixture.CreateContext();
        var stillExists = await new PasteStore(check).ExistsAsync(paste.Id, CancellationToken.None);
        stillExists.Should().BeTrue();
    }

    [Fact]
    public async Task Final_view_destroys_ciphertext_but_leaves_the_tombstone()
    {
        var paste = NewPaste(maxViews: 1);
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        var claimed = await store.ClaimViewAsync(paste.Id, CancellationToken.None);

        claimed.Should().NotBeNull();
        claimed!.Ciphertext.Should().Equal(1, 2, 3, 4);
        claimed.RemainingViews.Should().Be(0);

        await using var verify = fixture.CreateContext();
        var stored = await new PasteStore(verify).GetAsync(paste.Id, CancellationToken.None);
        stored.Should().NotBeNull();
        stored!.Ciphertext.Should().BeNull();
        stored.DestroyedAt.Should().NotBeNull();
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
        var claimed = await store.ClaimViewAsync(expired.Id, CancellationToken.None);
        var exists = await store.ExistsAsync(expired.Id, CancellationToken.None);

        claimed.Should().BeNull();
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task Tombstoning_succeeds_once_then_reports_gone()
    {
        var paste = NewPaste();
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        var first = await store.TombstoneAsync(paste.Id, CancellationToken.None);
        var second = await store.TombstoneAsync(paste.Id, CancellationToken.None);

        first.Should().BeTrue();
        second.Should().BeFalse();
    }

    [Fact]
    public async Task Database_rejects_a_destroyed_ciphertext_without_a_tombstone_mark()
    {
        var paste = NewPaste();
        await using var context = fixture.CreateContext();
        var store = new PasteStore(context);
        await store.AddAsync(paste, CancellationToken.None);

        Func<Task> act = () => context.Database.ExecuteSqlAsync(
            $"UPDATE pastes.pastes SET ciphertext = NULL WHERE id = {paste.Id.Value}");

        (await act.Should().ThrowAsync<PostgresException>()).Which.SqlState.Should().Be("23514");
    }
}
