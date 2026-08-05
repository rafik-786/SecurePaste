using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.Modules.Pastes.Infrastructure;

namespace SecurePaste.IntegrationTests;

[Collection("postgres")]
public class SweeperTests(PostgresFixture fixture)
{
    [Fact]
    public async Task Sweep_removes_expired_rows_in_batches_and_spares_live_ones()
    {
        await using var context = fixture.CreateContext();
        for (var i = 0; i < 3; i++)
        {
            context.Pastes.Add(Paste.Rehydrate(
                PasteId.New(),
                [1],
                DateTimeOffset.UtcNow.AddHours(-2),
                DateTimeOffset.UtcNow.AddHours(-1),
                null,
                0,
                null,
                DeleteTokenHash.FromToken(new byte[32])));
        }

        var live = Paste.Create([1], TimeSpan.FromHours(1), null, DeleteTokenHash.FromToken(new byte[32]), TimeProvider.System).Value;
        context.Pastes.Add(live);
        await context.SaveChangesAsync();

        var swept = await PasteSweeper.SweepAsync(context, batchSize: 2, CancellationToken.None);

        Assert.True(swept >= 3);
        var store = new PasteStore(context);
        Assert.True(await store.ExistsAsync(live.Id, CancellationToken.None));
        Assert.Equal(0, await PasteSweeper.SweepAsync(context, batchSize: 2, CancellationToken.None));
    }
}
