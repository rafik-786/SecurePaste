using Microsoft.Extensions.Time.Testing;
using SecurePaste.Modules.Pastes.Application;

namespace SecurePaste.Modules.Pastes.Tests.Application;

internal sealed class HandlerTestBed
{
    public HandlerTestBed()
    {
        Clock = new FakeTimeProvider(new DateTimeOffset(2026, 8, 4, 12, 0, 0, TimeSpan.Zero));
        Store = new FakePasteStore(Clock);
        Create = new CreatePasteHandler(Store, Clock);
        Peek = new PeekPasteHandler(Store, Clock);
        Claim = new ClaimViewHandler(Store);
        Delete = new DeletePasteHandler(Store, Clock);
    }

    public FakeTimeProvider Clock { get; }

    public FakePasteStore Store { get; }

    public CreatePasteHandler Create { get; }

    public PeekPasteHandler Peek { get; }

    public ClaimViewHandler Claim { get; }

    public DeletePasteHandler Delete { get; }

    public async Task<CreatePasteResponse> CreatePasteAsync(int? maxViews = null, TimeSpan? expiresIn = null)
    {
        var command = new CreatePasteCommand(
            [1, 2, 3, 4],
            expiresIn ?? TimeSpan.FromHours(1),
            maxViews);
        var result = await Create.HandleAsync(command, CancellationToken.None);
        return result.Value;
    }
}
