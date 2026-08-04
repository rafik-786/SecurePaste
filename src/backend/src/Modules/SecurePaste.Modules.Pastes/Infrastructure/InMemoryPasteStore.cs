using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Infrastructure;

internal sealed class InMemoryPasteStore(TimeProvider clock) : IPasteStore
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Paste> _pastes = [];

    public Task AddAsync(Paste paste, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            _pastes[paste.Id.Value] = paste;
        }

        return Task.CompletedTask;
    }

    public Task<Paste?> GetAsync(PasteId id, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            return Task.FromResult(_pastes.TryGetValue(id.Value, out var paste) ? paste : null);
        }
    }

    public Task<bool> ExistsAsync(PasteId id, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            return Task.FromResult(_pastes.ContainsKey(id.Value));
        }
    }

    public Task<ClaimViewResponse?> ClaimViewAsync(PasteId id, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            if (!_pastes.TryGetValue(id.Value, out var paste) || paste.IsGone(now))
            {
                return Task.FromResult<ClaimViewResponse?>(null);
            }

            var ciphertext = paste.Ciphertext!;
            var viewsUsed = paste.ViewsUsed + 1;
            var isFinalView = paste.MaxViews is int max && viewsUsed >= max;

            _pastes[id.Value] = Paste.Rehydrate(
                paste.Id,
                isFinalView ? null : ciphertext,
                paste.CreatedAt,
                paste.ExpiresAt,
                paste.MaxViews,
                viewsUsed,
                isFinalView ? now : null,
                paste.DeleteTokenHash);

            var remaining = paste.MaxViews is int m ? m - viewsUsed : (int?)null;
            return Task.FromResult<ClaimViewResponse?>(
                new ClaimViewResponse(ciphertext, remaining, paste.ExpiresAt));
        }
    }

    public Task<bool> TombstoneAsync(PasteId id, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            var now = clock.GetUtcNow();
            if (!_pastes.TryGetValue(id.Value, out var paste) || paste.IsGone(now))
            {
                return Task.FromResult(false);
            }

            _pastes[id.Value] = Paste.Rehydrate(
                paste.Id,
                null,
                paste.CreatedAt,
                paste.ExpiresAt,
                paste.MaxViews,
                paste.ViewsUsed,
                now,
                paste.DeleteTokenHash);

            return Task.FromResult(true);
        }
    }
}
