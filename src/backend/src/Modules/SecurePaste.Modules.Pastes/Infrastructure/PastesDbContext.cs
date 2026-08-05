using Microsoft.EntityFrameworkCore;
using SecurePaste.Modules.Pastes.Domain;

namespace SecurePaste.Modules.Pastes.Infrastructure;

public sealed class PastesDbContext(DbContextOptions<PastesDbContext> options) : DbContext(options)
{
    internal const string Schema = "pastes";

    internal DbSet<Paste> Pastes => Set<Paste>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema(Schema);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PastesDbContext).Assembly);
    }
}
