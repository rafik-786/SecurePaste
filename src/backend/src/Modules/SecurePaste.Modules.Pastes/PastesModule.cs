using Microsoft.Extensions.DependencyInjection;
using SecurePaste.Modules.Pastes.Application;
using SecurePaste.Modules.Pastes.Infrastructure;

namespace SecurePaste.Modules.Pastes;

public static class PastesModule
{
    public static IServiceCollection AddPastesModule(this IServiceCollection services)
    {
        services.AddSingleton<IPasteStore, InMemoryPasteStore>();
        services.AddScoped<CreatePasteHandler>();
        services.AddScoped<PeekPasteHandler>();
        services.AddScoped<ClaimViewHandler>();
        services.AddScoped<DeletePasteHandler>();
        return services;
    }
}
