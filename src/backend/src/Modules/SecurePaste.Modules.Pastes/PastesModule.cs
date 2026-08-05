using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Endpoints;
using SecurePaste.Modules.Pastes.Infrastructure.Persistence;
using SecurePaste.Modules.Pastes.Infrastructure.Sweeping;

namespace SecurePaste.Modules.Pastes;

public static class PastesModule
{
    public const string ConnectionStringName = "Database";

    private const int CreatesPerMinute = 20;
    private const int ClaimsPerMinute = 60;

    public static IServiceCollection AddPastesModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<PastesDbContext>(options => options.UseNpgsql(
            configuration.GetConnectionString(ConnectionStringName),
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", PastesDbContext.Schema)));

        services.TryAddSingleton(TimeProvider.System);
        services.AddScoped<IPasteStore, PasteStore>();
        services.AddOptions<SweeperOptions>()
            .BindConfiguration(SweeperOptions.SectionName)
            .Validate(
                options => options.BatchSize > 0 && options.Interval > TimeSpan.Zero,
                "The sweeper needs a positive interval and batch size.")
            .ValidateOnStart();
        services.AddHostedService<ExpiredPasteSweeper>();

        services.AddScoped<CreatePasteHandler>();
        services.AddScoped<PeekPasteHandler>();
        services.AddScoped<ClaimViewHandler>();
        services.AddScoped<DeletePasteHandler>();

        services.AddRateLimiter(limiter =>
        {
            limiter.AddPolicy(PasteEndpoints.CreateRateLimitPolicy, context =>
                FixedWindowByClientAddress(context, CreatesPerMinute));
            limiter.AddPolicy(PasteEndpoints.ClaimRateLimitPolicy, context =>
                FixedWindowByClientAddress(context, ClaimsPerMinute));
        });

        return services;
    }

    private static RateLimitPartition<string> FixedWindowByClientAddress(HttpContext context, int permitLimit) =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
            });
}
