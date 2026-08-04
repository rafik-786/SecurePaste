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

        Assert.True(result.IsSuccess);
        var peek = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);
        Assert.Equal(ErrorType.Gone, peek.Error!.Type);
    }

    [Fact]
    public async Task Repeating_a_delete_reports_gone()
    {
        var created = await _bed.CreatePasteAsync();
        await _bed.Delete.HandleAsync(created.Id, created.DeleteToken, CancellationToken.None);

        var second = await _bed.Delete.HandleAsync(created.Id, created.DeleteToken, CancellationToken.None);

        Assert.Equal(ErrorType.Gone, second.Error!.Type);
    }

    [Fact]
    public async Task Wrong_token_is_forbidden_and_deletes_nothing()
    {
        var created = await _bed.CreatePasteAsync();
        var other = await _bed.CreatePasteAsync();

        var result = await _bed.Delete.HandleAsync(created.Id, other.DeleteToken, CancellationToken.None);

        Assert.Equal(ErrorType.Forbidden, result.Error!.Type);
        var peek = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);
        Assert.True(peek.IsSuccess);
    }

    [Fact]
    public async Task Malformed_token_is_forbidden()
    {
        var created = await _bed.CreatePasteAsync();

        var result = await _bed.Delete.HandleAsync(created.Id, "###not-base64url###", CancellationToken.None);

        Assert.Equal(ErrorType.Forbidden, result.Error!.Type);
    }

    [Fact]
    public async Task Unknown_id_is_not_found()
    {
        var result = await _bed.Delete.HandleAsync("abcdefgh2345", "any", CancellationToken.None);

        Assert.Equal(ErrorType.NotFound, result.Error!.Type);
    }
}
