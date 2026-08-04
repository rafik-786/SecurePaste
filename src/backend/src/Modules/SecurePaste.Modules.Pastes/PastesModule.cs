using Microsoft.Extensions.DependencyInjection;

namespace SecurePaste.Modules.Pastes;

public static class PastesModule
{
    public static IServiceCollection AddPastesModule(this IServiceCollection services)
    {
        return services;
    }
}
