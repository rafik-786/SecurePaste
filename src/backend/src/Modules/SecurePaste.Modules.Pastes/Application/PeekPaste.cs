using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Application;

public sealed record PeekPasteResponse(DateTimeOffset ExpiresAt, int? RemainingViews, int SizeBytes);

public sealed class PeekPasteHandler(IPasteStore store, TimeProvider clock)
{
    public async Task<Result<PeekPasteResponse>> HandleAsync(string id, CancellationToken cancellationToken)
    {
        if (!PasteId.TryParse(id, out var pasteId))
        {
            return PasteErrors.NotFound;
        }

        var metadata = await store.GetMetadataAsync(pasteId, cancellationToken);
        if (metadata is null)
        {
            return PasteErrors.NotFound;
        }

        if (metadata.IsGone(clock.GetUtcNow()))
        {
            return PasteErrors.Gone;
        }

        return new PeekPasteResponse(metadata.ExpiresAt, metadata.RemainingViews, metadata.SizeBytes);
    }
}
