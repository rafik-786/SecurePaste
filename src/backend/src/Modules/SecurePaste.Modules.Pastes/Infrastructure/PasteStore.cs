using Microsoft.EntityFrameworkCore;
using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Infrastructure;

internal sealed class PasteStore(PastesDbContext dbContext) : IPasteStore
{
    public async Task AddAsync(Paste paste, CancellationToken cancellationToken)
    {
        dbContext.Pastes.Add(paste);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<Paste?> GetAsync(PasteId id, CancellationToken cancellationToken) =>
        await dbContext.Pastes.FindAsync([id], cancellationToken);

    public Task<bool> ExistsAsync(PasteId id, CancellationToken cancellationToken) =>
        dbContext.Pastes.AnyAsync(p => p.Id == id, cancellationToken);

    public async Task<ClaimViewResponse?> ClaimViewAsync(PasteId id, CancellationToken cancellationToken)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        var rows = await dbContext.Database
            .SqlQuery<ClaimRow>($@"
                UPDATE pastes.pastes
                SET    views_used = views_used + 1
                WHERE  id = {id.Value}
                  AND  destroyed_at IS NULL
                  AND  expires_at > now()
                  AND  (max_views IS NULL OR views_used < max_views)
                RETURNING ciphertext, max_views AS maxviews, views_used AS viewsused, expires_at AS expiresat")
            .ToListAsync(cancellationToken);

        if (rows.Count == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return null;
        }

        var row = rows[0];
        if (row.MaxViews is int max && row.ViewsUsed >= max)
        {
            await dbContext.Database.ExecuteSqlAsync($@"
                UPDATE pastes.pastes
                SET    ciphertext = NULL, destroyed_at = now()
                WHERE  id = {id.Value}", cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        var remaining = row.MaxViews is int m ? m - row.ViewsUsed : (int?)null;
        return new ClaimViewResponse(row.Ciphertext!, remaining, row.ExpiresAt);
    }

    public async Task<bool> TombstoneAsync(PasteId id, CancellationToken cancellationToken)
    {
        var affected = await dbContext.Database.ExecuteSqlAsync($@"
            UPDATE pastes.pastes
            SET    ciphertext = NULL, destroyed_at = now()
            WHERE  id = {id.Value}
              AND  destroyed_at IS NULL
              AND  expires_at > now()", cancellationToken);

        return affected > 0;
    }

    private sealed class ClaimRow
    {
        public byte[]? Ciphertext { get; init; }

        public int? MaxViews { get; init; }

        public int ViewsUsed { get; init; }

        public DateTimeOffset ExpiresAt { get; init; }
    }
}
