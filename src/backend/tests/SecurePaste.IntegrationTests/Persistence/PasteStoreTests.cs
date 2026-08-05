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
