using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Tests.Application;

public class CreatePasteHandlerTests
{
    private readonly HandlerTestBed _bed = new();

    [Fact]
    public async Task Valid_command_stores_the_paste_and_returns_id_and_token()
    {
        var response = await _bed.CreatePasteAsync(maxViews: 3);

        response.Id.Should().HaveLength(PasteId.Length);
        response.ExpiresAt.Should().Be(_bed.Clock.GetUtcNow().AddHours(1));

        var peek = await _bed.Peek.HandleAsync(response.Id, CancellationToken.None);
        peek.IsSuccess.Should().BeTrue();
        peek.Value.RemainingViews.Should().Be(3);
    }

    [Fact]
    public async Task Returned_token_matches_the_stored_hash()
    {
        var response = await _bed.CreatePasteAsync();

        Base64Url.TryDecode(response.DeleteToken, out var token).Should().BeTrue();
        token.Should().HaveCount(PasteLimits.DeleteTokenBytes);

        var stored = _bed.Store.Inspect(response.Id);
        stored!.DeleteTokenHash.Matches(token).Should().BeTrue();
    }

    [Fact]
    public async Task Invalid_command_stores_nothing()
    {
        var command = new CreatePasteCommand([], TimeSpan.FromHours(1), null);

        var result = await _bed.Create.HandleAsync(command, CancellationToken.None);

        result.IsFailure.Should().BeTrue();
        result.Error.Type.Should().Be(ErrorType.Validation);
    }
}
