namespace SecurePaste.Modules.Pastes.Infrastructure.Sweeping;

public sealed class SweeperOptions
{
    public const string SectionName = "Pastes:Sweeper";

    public TimeSpan Interval { get; set; } = TimeSpan.FromMinutes(5);

    public int BatchSize { get; set; } = 1000;
}
