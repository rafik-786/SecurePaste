using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SecurePaste.Modules.Pastes.Infrastructure;

internal sealed class PastesDbContextFactory : IDesignTimeDbContextFactory<PastesDbContext>
{
    public PastesDbContext CreateDbContext(string[] args) =>
        new(new DbContextOptionsBuilder<PastesDbContext>()
            .UseNpgsql("Host=localhost;Database=securepaste;Username=securepaste")
            .Options);
}
