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

        result.IsSuccess.Should().BeTrue();
        var paste = result.Value;
        paste.Id.Value.Should().HaveLength(PasteId.Length);
        paste.CreatedAt.Should().Be(Start);
        paste.ExpiresAt.Should().Be(Start.AddHours(1));
        paste.ViewsUsed.Should().Be(0);
        paste.RemainingViews.Should().Be(3);
        paste.DestroyedAt.Should().BeNull();
        paste.IsGone(clock.GetUtcNow()).Should().BeFalse();
    }

    [Fact]
    public void Unlimited_views_means_no_remaining_count()
    {
        var paste = Create(Clock()).Value;

        paste.MaxViews.Should().BeNull();
        paste.RemainingViews.Should().BeNull();
    }

    [Fact]
    public void Empty_ciphertext_is_rejected()
    {
        var result = Create(Clock(), ciphertext: []);

        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.Validation);
    }

    [Fact]
    public void Oversized_ciphertext_is_rejected()
    {
        var result = Create(Clock(), ciphertext: new byte[PasteLimits.MaxCiphertextBytes + 1]);

        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.TooLarge);
    }

    [Fact]
    public void Ciphertext_at_the_limit_is_accepted()
    {
        var result = Create(Clock(), ciphertext: new byte[PasteLimits.MaxCiphertextBytes]);

        result.IsSuccess.Should().BeTrue();
    }

    [Theory]
    [InlineData(59)]
    [InlineData(604801)]
    public void Expiry_outside_bounds_is_rejected(int seconds)
    {
        var result = Create(Clock(), expiresIn: TimeSpan.FromSeconds(seconds));

        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.Validation);
    }

    [Theory]
    [InlineData(60)]
    [InlineData(604800)]
    public void Expiry_at_the_bounds_is_accepted(int seconds)
    {
        var result = Create(Clock(), expiresIn: TimeSpan.FromSeconds(seconds));

        result.IsSuccess.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(101)]
    public void Max_views_outside_bounds_is_rejected(int maxViews)
    {
        var result = Create(Clock(), maxViews: maxViews);

        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.Validation);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    public void Max_views_at_the_bounds_is_accepted(int maxViews)
    {
        var result = Create(Clock(), maxViews: maxViews);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void Paste_is_gone_once_time_passes_its_expiry()
    {
        var clock = Clock();
        var paste = Create(clock, expiresIn: TimeSpan.FromHours(1)).Value;

        clock.Advance(TimeSpan.FromHours(1));

        paste.IsGone(clock.GetUtcNow()).Should().BeTrue();
    }

    [Fact]
    public void Paste_with_exhausted_views_is_gone()
    {
        var paste = Rehydrated(viewsUsed: 1, maxViews: 1);

        paste.IsGone(Start).Should().BeTrue();
        paste.RemainingViews.Should().Be(0);
    }

    [Fact]
    public void Destroyed_paste_is_gone_even_before_expiry()
    {
        var paste = Rehydrated(destroyedAt: Start, ciphertext: null);

        paste.IsGone(Start).Should().BeTrue();
        paste.Ciphertext.Should().BeNull();
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
