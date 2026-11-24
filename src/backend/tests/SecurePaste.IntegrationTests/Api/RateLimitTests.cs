using System.Net;
using System.Net.Http.Json;

namespace SecurePaste.IntegrationTests.Api;

[Collection("postgres")]
public class RateLimitTests(PostgresFixture fixture)
{
    private const string CreatePath = "/api/v1/pastes";
    private const string ForwardedFor = "X-Forwarded-For";
    private const string TrustedProxyNetwork = "10.9.0.0/24";
    private const int CreatesPerMinute = 20;
    private const string FirstClient = "203.0.113.10";

    private static readonly IPAddress ProxyAddress = IPAddress.Parse("10.9.0.2");
    private static readonly IPAddress UntrustedSender = IPAddress.Parse("198.51.100.7");
    private static readonly object Body =
        new { ciphertext = Convert.ToBase64String(new byte[] { 1 }), expiresInSeconds = 3600 };

    [Fact]
    public async Task Create_endpoint_rejects_the_21st_request_in_a_minute()
    {
        await using var factory = new ApiFactory(fixture.ConnectionString);
        var client = factory.CreateClient();

        for (var i = 0; i < CreatesPerMinute; i++)
        {
            var accepted = await client.PostAsJsonAsync(CreatePath, Body);
            accepted.StatusCode.Should().Be(HttpStatusCode.Created, $"request {i + 1} is within the limit");
        }

        var rejected = await client.PostAsJsonAsync(CreatePath, Body);

        rejected.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        rejected.Headers.Contains("Retry-After").Should().BeTrue();
        rejected.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task Behind_a_trusted_proxy_each_forwarded_client_gets_its_own_limit()
    {
        await using var factory = new ApiFactory(fixture.ConnectionString, ProxyAddress, TrustedProxyNetwork);
        var client = factory.CreateClient();

        for (var i = 0; i < CreatesPerMinute; i++)
        {
            var accepted = await CreateFrom(client, FirstClient);
            accepted.StatusCode.Should().Be(HttpStatusCode.Created, $"request {i + 1} is within the limit");
        }

        (await CreateFrom(client, FirstClient)).StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        (await CreateFrom(client, "203.0.113.11")).StatusCode.Should().Be(
            HttpStatusCode.Created,
            "another client behind the same proxy has its own limit");
    }

    [Fact]
    public async Task Forwarded_addresses_from_an_untrusted_sender_are_ignored()
    {
        await using var factory = new ApiFactory(fixture.ConnectionString, UntrustedSender, TrustedProxyNetwork);
        var client = factory.CreateClient();

        for (var i = 0; i < CreatesPerMinute; i++)
        {
            var accepted = await CreateFrom(client, $"203.0.113.{i + 20}");
            accepted.StatusCode.Should().Be(HttpStatusCode.Created, $"request {i + 1} is within the limit");
        }

        (await CreateFrom(client, "203.0.113.99")).StatusCode.Should().Be(
            HttpStatusCode.TooManyRequests,
            "a made-up forwarded address must not buy a fresh limit");
    }

    private static async Task<HttpResponseMessage> CreateFrom(HttpClient client, string clientAddress)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, CreatePath) { Content = JsonContent.Create(Body) };
        request.Headers.Add(ForwardedFor, clientAddress);
        return await client.SendAsync(request);
    }
}
