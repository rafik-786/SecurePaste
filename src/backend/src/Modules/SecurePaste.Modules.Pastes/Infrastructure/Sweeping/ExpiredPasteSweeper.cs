using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;

namespace SecurePaste.Modules.Pastes.Infrastructure.Sweeping;

internal sealed class ExpiredPasteSweeper(
    IServiceScopeFactory scopeFactory,
    IOptions<SweeperOptions> options,
    TimeProvider clock,
    ILogger<ExpiredPasteSweeper> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.Interval, clock);
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<PastesDbContext>();
                    var swept = await PasteSweeper.SweepAsync(dbContext, options.Value.BatchSize, stoppingToken);
                    if (swept > 0)
                    {
                        logger.LogInformation("Removed {Count} expired pastes.", swept);
                    }
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    logger.LogError(ex, "Sweep failed; retrying at the next interval.");
                }
            }
        }
        catch (OperationCanceledException)
        {
        }
    }
}
