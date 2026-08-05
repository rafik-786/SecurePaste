using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;
using SecurePaste.Modules.Pastes.Tests.Application;

namespace SecurePaste.IntegrationTests.Persistence;

[Collection("postgres")]
public sealed class PostgresPasteStoreContractTests(PostgresFixture fixture)
    : PasteStoreContractTests, IAsyncLifetime
{
    private readonly List<PastesDbContext> _contexts = [];

    protected override Task<IPasteStore> CreateStoreAsync()
    {
        var context = fixture.CreateContext();
        _contexts.Add(context);
        return Task.FromResult<IPasteStore>(new PasteStore(context));
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        foreach (var context in _contexts)
        {
            await context.DisposeAsync();
        }
    }
}
