using System.Net;

namespace SecurePaste.IntegrationTests.Api;

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
}
