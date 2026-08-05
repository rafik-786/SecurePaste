using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Tests.Application;

public class PeekPasteHandlerTests
{
    private readonly HandlerTestBed _bed = new();

    [Fact]
    public async Task Live_paste_returns_metadata_without_consuming()
    {
        var created = await _bed.CreatePasteAsync(maxViews: 2);

        var first = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);
        var second = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);

        first.IsSuccess.Should().BeTrue();
        first.Value.RemainingViews.Should().Be(2);
        first.Value.SizeBytes.Should().Be(4);
        second.Value.RemainingViews.Should().Be(2);
    }

    [Fact]
    public async Task Unknown_id_is_not_found()
    {
        var result = await _bed.Peek.HandleAsync("abcdefgh2345", CancellationToken.None);

        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Malformed_id_is_not_found()
    {
        var result = await _bed.Peek.HandleAsync("not-a-valid-id!", CancellationToken.None);

        result.Error.Type.Should().Be(ErrorType.NotFound);
    }

    [Fact]
    public async Task Expired_paste_is_gone()
    {
        var created = await _bed.CreatePasteAsync(expiresIn: TimeSpan.FromMinutes(5));

        _bed.Clock.Advance(TimeSpan.FromMinutes(5));
        var result = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);

        result.Error.Type.Should().Be(ErrorType.Gone);
    }

    [Fact]
    public async Task Consumed_paste_is_gone()
    {
        var created = await _bed.CreatePasteAsync(maxViews: 1);
        await _bed.Claim.HandleAsync(created.Id, CancellationToken.None);

        var result = await _bed.Peek.HandleAsync(created.Id, CancellationToken.None);

        result.Error.Type.Should().Be(ErrorType.Gone);
    }
}
