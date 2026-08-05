using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using SecurePaste.Modules.Pastes;

namespace SecurePaste.IntegrationTests;

[Collection("postgres")]
public class ReadinessTests(PostgresFixture fixture)
{
    [Fact]
    public async Task Readyz_returns_200_when_the_database_is_reachable()
    {
        await using var factory = new ApiFactory(fixture.ConnectionString);
        var client = factory.CreateClient();

        var response = await client.GetAsync("/readyz");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private sealed class ApiFactory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.UseSetting(
                $"ConnectionStrings:{PastesModule.ConnectionStringName}",
                connectionString);
    }
}
