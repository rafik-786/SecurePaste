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

        Assert.Equal(PasteId.Length, response.Id.Length);
        Assert.Equal(_bed.Clock.GetUtcNow().AddHours(1), response.ExpiresAt);

        var peek = await _bed.Peek.HandleAsync(response.Id, CancellationToken.None);
        Assert.True(peek.IsSuccess);
        Assert.Equal(3, peek.Value.RemainingViews);
    }

    [Fact]
    public async Task Returned_token_matches_the_stored_hash()
    {
        var response = await _bed.CreatePasteAsync();

        Assert.True(Base64Url.TryDecode(response.DeleteToken, out var token));
        Assert.Equal(PasteLimits.DeleteTokenBytes, token.Length);

        Assert.True(PasteId.TryParse(response.Id, out var id));
        var stored = await _bed.Store.GetAsync(id, CancellationToken.None);
        Assert.True(stored!.DeleteTokenHash.Matches(token));
    }

    [Fact]
    public async Task Invalid_command_stores_nothing()
    {
        var command = new CreatePasteCommand([], TimeSpan.FromHours(1), null);

        var result = await _bed.Create.HandleAsync(command, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error!.Type);
    }
}
