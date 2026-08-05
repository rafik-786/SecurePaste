using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Application;

public sealed class DeletePasteHandler(IPasteStore store, TimeProvider clock)
{
    public async Task<Result> HandleAsync(string id, string? deleteToken, CancellationToken cancellationToken)
    {
        if (!PasteId.TryParse(id, out var pasteId))
        {
            return Result.Failure(PasteErrors.NotFound);
        }

        if (!Base64Url.TryDecode(deleteToken, out var token))
        {
            return Result.Failure(PasteErrors.WrongDeleteToken);
        }

        var metadata = await store.GetMetadataAsync(pasteId, cancellationToken);
        if (metadata is null)
        {
            return Result.Failure(PasteErrors.NotFound);
        }

        if (metadata.IsGone(clock.GetUtcNow()))
        {
            return Result.Failure(PasteErrors.Gone);
        }

        if (!metadata.DeleteTokenHash.Matches(token))
        {
            return Result.Failure(PasteErrors.WrongDeleteToken);
        }

        return await store.TombstoneAsync(pasteId, cancellationToken)
            ? Result.Success()
            : Result.Failure(PasteErrors.Gone);
    }
}
