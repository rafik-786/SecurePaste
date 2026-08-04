using Microsoft.Extensions.Time.Testing;
using SecurePaste.Modules.Pastes.Domain;
using SecurePaste.SharedKernel;

namespace SecurePaste.Modules.Pastes.Tests.Domain;

public class PasteTests
{
    private static readonly DateTimeOffset Start = new(2026, 8, 4, 12, 0, 0, TimeSpan.Zero);

    private static readonly byte[] SomeToken = new byte[32];

    private static FakeTimeProvider Clock() => new(Start);

    private static Result<Paste> Create(
        FakeTimeProvider clock,
        byte[]? ciphertext = null,
        TimeSpan? expiresIn = null,
        int? maxViews = null) =>
        Paste.Create(
            ciphertext ?? new byte[16],
            expiresIn ?? TimeSpan.FromHours(1),
            maxViews,
            DeleteTokenHash.FromToken(SomeToken),
            clock);

    [Fact]
    public void Valid_input_creates_a_live_paste()
    {
        var clock = Clock();

        var result = Create(clock, maxViews: 3);

        Assert.True(result.IsSuccess);
        var paste = result.Value;
        Assert.Equal(PasteId.Length, paste.Id.Value.Length);
        Assert.Equal(Start, paste.CreatedAt);
        Assert.Equal(Start.AddHours(1), paste.ExpiresAt);
        Assert.Equal(0, paste.ViewsUsed);
        Assert.Equal(3, paste.RemainingViews);
        Assert.Null(paste.DestroyedAt);
        Assert.False(paste.IsGone(clock.GetUtcNow()));
    }

    [Fact]
    public void Unlimited_views_means_no_remaining_count()
    {
        var paste = Create(Clock()).Value;

        Assert.Null(paste.MaxViews);
        Assert.Null(paste.RemainingViews);
    }

    [Fact]
    public void Empty_ciphertext_is_rejected()
    {
        var result = Create(Clock(), ciphertext: []);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error!.Type);
    }

    [Fact]
    public void Oversized_ciphertext_is_rejected()
    {
        var result = Create(Clock(), ciphertext: new byte[PasteLimits.MaxCiphertextBytes + 1]);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.TooLarge, result.Error!.Type);
    }

    [Fact]
    public void Ciphertext_at_the_limit_is_accepted()
    {
        var result = Create(Clock(), ciphertext: new byte[PasteLimits.MaxCiphertextBytes]);

        Assert.True(result.IsSuccess);
    }

    [Theory]
    [InlineData(59)]
    [InlineData(604801)]
    public void Expiry_outside_bounds_is_rejected(int seconds)
    {
        var result = Create(Clock(), expiresIn: TimeSpan.FromSeconds(seconds));

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error!.Type);
    }

    [Theory]
    [InlineData(60)]
    [InlineData(604800)]
    public void Expiry_at_the_bounds_is_accepted(int seconds)
    {
        var result = Create(Clock(), expiresIn: TimeSpan.FromSeconds(seconds));

        Assert.True(result.IsSuccess);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(101)]
    public void Max_views_outside_bounds_is_rejected(int maxViews)
    {
        var result = Create(Clock(), maxViews: maxViews);

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Validation, result.Error!.Type);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    public void Max_views_at_the_bounds_is_accepted(int maxViews)
    {
        var result = Create(Clock(), maxViews: maxViews);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void Paste_is_gone_once_time_passes_its_expiry()
    {
        var clock = Clock();
        var paste = Create(clock, expiresIn: TimeSpan.FromHours(1)).Value;

        clock.Advance(TimeSpan.FromHours(1));

        Assert.True(paste.IsGone(clock.GetUtcNow()));
    }

    [Fact]
    public void Paste_with_exhausted_views_is_gone()
    {
        var paste = Rehydrated(viewsUsed: 1, maxViews: 1);

        Assert.True(paste.IsGone(Start));
        Assert.Equal(0, paste.RemainingViews);
    }

    [Fact]
    public void Destroyed_paste_is_gone_even_before_expiry()
    {
        var paste = Rehydrated(destroyedAt: Start, ciphertext: null);

        Assert.True(paste.IsGone(Start));
        Assert.Null(paste.Ciphertext);
    }

    private static Paste Rehydrated(
        byte[]? ciphertext = null,
        int? maxViews = null,
        int viewsUsed = 0,
        DateTimeOffset? destroyedAt = null)
    {
        if (!PasteId.TryParse("abcdefgh2345", out var id))
        {
            throw new InvalidOperationException("Test id is invalid.");
        }

        return Paste.Rehydrate(
            id,
            ciphertext,
            Start,
            Start.AddDays(1),
            maxViews,
            viewsUsed,
            destroyedAt,
            DeleteTokenHash.FromToken(SomeToken));
    }
}
