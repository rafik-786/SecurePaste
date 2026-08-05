using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Infrastructure;

namespace SecurePaste.Modules.Pastes;

public static class PastesModule
{
    public static IServiceCollection AddPastesModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<PastesDbContext>(options => options.UseNpgsql(
            configuration.GetConnectionString("Database"),
            npgsql => npgsql.MigrationsHistoryTable("__ef_migrations_history", "pastes")));

        services.AddScoped<IPasteStore, PasteStore>();
        services.AddOptions<SweeperOptions>().BindConfiguration(SweeperOptions.SectionName);
        services.AddHostedService<ExpiredPasteSweeper>();

        services.AddScoped<CreatePasteHandler>();
        services.AddScoped<PeekPasteHandler>();
        services.AddScoped<ClaimViewHandler>();
        services.AddScoped<DeletePasteHandler>();
        return services;
    }
}
