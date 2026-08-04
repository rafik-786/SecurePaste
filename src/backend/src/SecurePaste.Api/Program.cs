using SecurePaste.Modules.Pastes;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHealthChecks();
builder.Services.AddPastesModule();

var app = builder.Build();

app.MapHealthChecks("/healthz");

app.Run();

public partial class Program;
