using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using SecurePaste.Modules.Pastes;

namespace SecurePaste.IntegrationTests;

internal sealed class ApiFactory(
    string connectionString,
    IPAddress? remoteAddress = null,
    string? trustedProxyNetwork = null) : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(
            $"ConnectionStrings:{PastesModule.ConnectionStringName}",
            connectionString);

        if (trustedProxyNetwork is not null)
        {
            builder.UseSetting("ForwardedHeaders:KnownNetworks:0", trustedProxyNetwork);
        }

        if (remoteAddress is not null)
        {
            builder.ConfigureServices(services =>
                services.AddSingleton<IStartupFilter>(new RemoteAddressStartupFilter(remoteAddress)));
        }
    }

    private sealed class RemoteAddressStartupFilter(IPAddress address) : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) =>
            app =>
            {
                app.Use((context, nextMiddleware) =>
                {
                    context.Connection.RemoteIpAddress = address;
                    return nextMiddleware(context);
                });
                next(app);
            };
    }
}
