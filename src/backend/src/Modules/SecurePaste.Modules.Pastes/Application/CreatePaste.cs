using System.Security.Cryptography;
using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Application;

public sealed record CreatePasteCommand(byte[] Ciphertext, TimeSpan ExpiresIn, int? MaxViews);

public sealed record CreatePasteResponse(string Id, string DeleteToken, DateTimeOffset ExpiresAt);

public sealed class CreatePasteHandler(IPasteStore store, TimeProvider clock)
{
    public async Task<Result<CreatePasteResponse>> HandleAsync(
        CreatePasteCommand command,
        CancellationToken cancellationToken)
    {
        var token = RandomNumberGenerator.GetBytes(PasteLimits.DeleteTokenBytes);
        var created = Paste.Create(
            command.Ciphertext,
            command.ExpiresIn,
            command.MaxViews,
            DeleteTokenHash.FromToken(token),
            clock);

        if (created.IsFailure)
        {
            return created.Error;
        }

        var paste = created.Value;
        await store.AddAsync(paste, cancellationToken);

        return new CreatePasteResponse(paste.Id.Value, Base64Url.Encode(token), paste.ExpiresAt);
    }
}
