using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using SecurePaste.Modules.Pastes;
using SecurePaste.Modules.Pastes.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHealthChecks().AddDbContextCheck<PastesDbContext>("database");
builder.Services.AddPastesModule(builder.Configuration);

var app = builder.Build();

app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/readyz");

app.Run();

public partial class Program;
