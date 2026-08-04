using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Application;

public sealed record ClaimViewResponse(byte[] Ciphertext, int? RemainingViews, DateTimeOffset ExpiresAt);

public sealed class ClaimViewHandler(IPasteStore store)
{
    public async Task<Result<ClaimViewResponse>> HandleAsync(string id, CancellationToken cancellationToken)
    {
        if (!PasteId.TryParse(id, out var pasteId))
        {
            return PasteErrors.NotFound;
        }

        var claimed = await store.ClaimViewAsync(pasteId, cancellationToken);
        if (claimed is not null)
        {
            return claimed;
        }

        return await store.ExistsAsync(pasteId, cancellationToken)
            ? PasteErrors.Gone
            : PasteErrors.NotFound;
    }
}
