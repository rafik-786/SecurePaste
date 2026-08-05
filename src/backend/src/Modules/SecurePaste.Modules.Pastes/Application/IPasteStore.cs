using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Application;

public interface IPasteStore
{
    Task AddAsync(Paste paste, CancellationToken cancellationToken);

    Task<PasteMetadata?> GetMetadataAsync(PasteId id, CancellationToken cancellationToken);

    Task<bool> ExistsAsync(PasteId id, CancellationToken cancellationToken);

    Task<ClaimViewResponse?> ClaimViewAsync(PasteId id, CancellationToken cancellationToken);

    Task<bool> TombstoneAsync(PasteId id, CancellationToken cancellationToken);
}
