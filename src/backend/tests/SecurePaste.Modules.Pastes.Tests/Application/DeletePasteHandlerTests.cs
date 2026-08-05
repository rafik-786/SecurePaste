using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Tests.Application;

public class DeletePasteHandlerTests
{
    private readonly HandlerTestBed _bed = new();

    [Fact]
    public async Task Correct_token_tombstones_the_paste()
    {
        var created = await _bed.CreatePasteAsync();

        var result = await _bed.Delete.HandleAsync(created.Id, created.DeleteToken, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        var peek = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);
        peek.Error!.Type.Should().Be(ErrorType.Gone);
    }

    [Fact]
    public async Task Repeating_a_delete_reports_gone()
    {
        var created = await _bed.CreatePasteAsync();
        await _bed.Delete.HandleAsync(created.Id, created.DeleteToken, CancellationToken.None);

        var second = await _bed.Delete.HandleAsync(created.Id, created.DeleteToken, CancellationToken.None);

        second.Error!.Type.Should().Be(ErrorType.Gone);
    }

    [Fact]
    public async Task Wrong_token_is_forbidden_and_deletes_nothing()
    {
        var created = await _bed.CreatePasteAsync();
        var other = await _bed.CreatePasteAsync();

        var result = await _bed.Delete.HandleAsync(created.Id, other.DeleteToken, CancellationToken.None);

        result.Error!.Type.Should().Be(ErrorType.Forbidden);
        var peek = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);
        peek.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task Malformed_token_is_forbidden()
    {
        var created = await _bed.CreatePasteAsync();

        var result = await _bed.Delete.HandleAsync(created.Id, "###not-base64url###", CancellationToken.None);

        result.Error!.Type.Should().Be(ErrorType.Forbidden);
    }

    [Fact]
    public async Task Unknown_id_is_not_found()
    {
        var result = await _bed.Delete.HandleAsync("abcdefgh2345", "any", CancellationToken.None);

        result.Error!.Type.Should().Be(ErrorType.NotFound);
    }
}
