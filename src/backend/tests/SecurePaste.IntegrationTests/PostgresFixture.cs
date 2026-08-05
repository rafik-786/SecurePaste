using Microsoft.EntityFrameworkCore;
using SecurePaste.Modules.Pastes.Infrastructure;
using Testcontainers.PostgreSql;

namespace SecurePaste.IntegrationTests;

public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await using var dbContext = CreateContext();
        await dbContext.Database.MigrateAsync();
    }

    public Task DisposeAsync() => _container.DisposeAsync().AsTask();

    public PastesDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<PastesDbContext>()
            .UseNpgsql(ConnectionString)
            .Options);
}

[CollectionDefinition("postgres")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>;
