using Microsoft.EntityFrameworkCore;

namespace SecurePaste.Modules.Pastes.Infrastructure;

internal static class PasteSweeper
{
    public static async Task<int> SweepAsync(
        PastesDbContext dbContext,
        int batchSize,
        CancellationToken cancellationToken)
    {
        var total = 0;
        while (true)
        {
            var affected = await dbContext.Database.ExecuteSqlAsync($@"
                DELETE FROM pastes.pastes
                WHERE id IN (
                    SELECT id FROM pastes.pastes
                    WHERE expires_at <= now()
                    LIMIT {batchSize})", cancellationToken);

            total += affected;
            if (affected < batchSize)
            {
                return total;
            }
        }
    }
}
