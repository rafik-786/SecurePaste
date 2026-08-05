using System.Net;
using System.Net.Http.Json;

namespace SecurePaste.IntegrationTests.Api;

[Collection("postgres")]
public class RateLimitTests(PostgresFixture fixture)
{
    [Fact]
    public async Task Create_endpoint_rejects_the_21st_request_in_a_minute()
    {
        await using var factory = new ApiFactory(fixture.ConnectionString);
        var client = factory.CreateClient();
        var body = new { ciphertext = Convert.ToBase64String(new byte[] { 1 }), expiresInSeconds = 3600 };

        for (var i = 0; i < 20; i++)
        {
            var accepted = await client.PostAsJsonAsync("/api/v1/pastes", body);
            accepted.StatusCode.Should().Be(HttpStatusCode.Created, $"request {i + 1} is within the limit");
        }

        var rejected = await client.PostAsJsonAsync("/api/v1/pastes", body);

        rejected.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        rejected.Headers.Contains("Retry-After").Should().BeTrue();
        rejected.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }
}
