using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;
using SecurePaste.Modules.Pastes.Infrastructure.Sweeping;

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

        swept.Should().BeGreaterThanOrEqualTo(3);
        var store = new PasteStore(context);
        var liveSurvives = await store.ExistsAsync(live.Id, CancellationToken.None);
        liveSurvives.Should().BeTrue();

        var secondSweep = await PasteSweeper.SweepAsync(context, batchSize: 2, CancellationToken.None);
        secondSweep.Should().Be(0);
    }
}
