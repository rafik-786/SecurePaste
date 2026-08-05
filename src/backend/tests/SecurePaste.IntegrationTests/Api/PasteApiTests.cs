using System.Net;
using System.Net.Http.Json;
using SecurePaste.Modules.Pastes.Application;

namespace SecurePaste.IntegrationTests.Api;

[Collection("postgres")]
public class PasteApiTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _factory = null!;
    private HttpClient _client = null!;

    public Task InitializeAsync()
    {
        _factory = new ApiFactory(fixture.ConnectionString);
        _client = _factory.CreateClient();
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _factory.DisposeAsync();

    private sealed record ProblemBody(string? Type, string? Title, int? Status, string? Detail, string? Instance);

    private static object CreateBody(byte[] plaintextBytes, int expiresInSeconds = 3600, int? maxViews = null) =>
        new
        {
            ciphertext = Convert.ToBase64String(plaintextBytes),
            expiresInSeconds,
            maxViews,
        };

    [Fact]
    public async Task Full_lifecycle_create_peek_claim_twice_then_gone()
    {
        var bytes = new byte[] { 10, 20, 30, 40, 50 };

        var createResponse = await _client.PostAsJsonAsync("/api/v1/pastes", CreateBody(bytes, maxViews: 2));
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<CreatePasteResponse>();
        created!.Id.Should().HaveLength(12);
        created.DeleteToken.Should().NotBeNullOrEmpty();
        createResponse.Headers.Location!.ToString().Should().Be($"/api/v1/pastes/{created.Id}");

        var peek = await _client.GetFromJsonAsync<PeekPasteResponse>($"/api/v1/pastes/{created.Id}");
        peek!.RemainingViews.Should().Be(2);
        peek.SizeBytes.Should().Be(bytes.Length);

        var firstClaim = await _client.PostAsync($"/api/v1/pastes/{created.Id}/views", null);
        firstClaim.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstView = await firstClaim.Content.ReadFromJsonAsync<ClaimViewResponse>();
        firstView!.Ciphertext.Should().Equal(bytes);
        firstView.RemainingViews.Should().Be(1);

        var secondClaim = await _client.PostAsync($"/api/v1/pastes/{created.Id}/views", null);
        var secondView = await secondClaim.Content.ReadFromJsonAsync<ClaimViewResponse>();
        secondView!.RemainingViews.Should().Be(0);

        var peekAfterBurn = await _client.GetAsync($"/api/v1/pastes/{created.Id}");
        peekAfterBurn.StatusCode.Should().Be(HttpStatusCode.Gone);
        peekAfterBurn.Content.Headers.ContentType!.MediaType.Should().Be("application/problem+json");
        var problem = await peekAfterBurn.Content.ReadFromJsonAsync<ProblemBody>();
        problem!.Type.Should().EndWith("paste-gone");

        var claimAfterBurn = await _client.PostAsync($"/api/v1/pastes/{created.Id}/views", null);
        claimAfterBurn.StatusCode.Should().Be(HttpStatusCode.Gone);
    }

    [Theory]
    [InlineData("not base64!!!", 3600, null)]
    [InlineData("AQIDBA==", 30, null)]
    [InlineData("AQIDBA==", 3600, 0)]
    public async Task Invalid_create_requests_return_400_validation_problems(
        string ciphertext, int expiresInSeconds, int? maxViews)
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/pastes",
            new { ciphertext, expiresInSeconds, maxViews });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        problem!.Type.Should().EndWith("validation");
    }

    [Fact]
    public async Task Oversized_ciphertext_returns_413()
    {
        var response = await _client.PostAsJsonAsync(
            "/api/v1/pastes",
            CreateBody(new byte[262_145]));

        response.StatusCode.Should().Be(HttpStatusCode.RequestEntityTooLarge);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>();
        problem!.Type.Should().EndWith("payload-too-large");
    }

    [Fact]
    public async Task Delete_requires_the_right_token_and_reports_gone_afterwards()
    {
        var createResponse = await _client.PostAsJsonAsync("/api/v1/pastes", CreateBody([1, 2, 3]));
        var created = await createResponse.Content.ReadFromJsonAsync<CreatePasteResponse>();
        var url = $"/api/v1/pastes/{created!.Id}";

        var noToken = await _client.DeleteAsync(url);
        noToken.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        using var wrongTokenRequest = new HttpRequestMessage(HttpMethod.Delete, url);
        wrongTokenRequest.Headers.Add("X-Delete-Token", SharedKernel.Base64Url.Encode(new byte[32]));
        var wrongToken = await _client.SendAsync(wrongTokenRequest);
        wrongToken.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        using var rightTokenRequest = new HttpRequestMessage(HttpMethod.Delete, url);
        rightTokenRequest.Headers.Add("X-Delete-Token", created.DeleteToken);
        var rightToken = await _client.SendAsync(rightTokenRequest);
        rightToken.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var peek = await _client.GetAsync(url);
        peek.StatusCode.Should().Be(HttpStatusCode.Gone);

        using var repeatRequest = new HttpRequestMessage(HttpMethod.Delete, url);
        repeatRequest.Headers.Add("X-Delete-Token", created.DeleteToken);
        var repeat = await _client.SendAsync(repeatRequest);
        repeat.StatusCode.Should().Be(HttpStatusCode.Gone);
    }

    [Theory]
    [InlineData("abcdefgh2345")]
    [InlineData("not-a-valid-id")]
    public async Task Unknown_or_malformed_ids_return_404(string id)
    {
        var peek = await _client.GetAsync($"/api/v1/pastes/{id}");
        var claim = await _client.PostAsync($"/api/v1/pastes/{id}/views", null);

        peek.StatusCode.Should().Be(HttpStatusCode.NotFound);
        claim.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await peek.Content.ReadFromJsonAsync<ProblemBody>();
        problem!.Type.Should().EndWith("paste-not-found");
    }
}
