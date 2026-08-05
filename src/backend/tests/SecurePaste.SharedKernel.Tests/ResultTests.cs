namespace SecurePaste.SharedKernel.Tests;

public class ResultTests
{
    [Fact]
    public void Success_result_has_no_error()
    {
        var result = Result.Success();

        result.IsSuccess.Should().BeTrue();
        result.IsFailure.Should().BeFalse();
        result.Error.Should().BeNull();
    }

    [Fact]
    public void Failure_result_carries_its_error()
    {
        var error = Error.NotFound("Paste.NotFound", "No such paste.");

        var result = Result.Failure(error);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Be(error);
    }

    [Fact]
    public void Value_of_successful_result_is_accessible()
    {
        var result = Result.Success(42);

        result.Value.Should().Be(42);
    }

    [Fact]
    public void Reading_value_of_failed_result_throws()
    {
        var result = Result.Failure<int>(Error.Validation("Paste.Validation", "Bad input."));

        result.Invoking(r => r.Value).Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Value_converts_implicitly_to_successful_result()
    {
        Result<string> result = "hello";

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("hello");
    }

    [Fact]
    public void Error_converts_implicitly_to_failed_result()
    {
        Result<string> result = Error.Gone("Paste.Gone", "Expired.");

        result.IsFailure.Should().BeTrue();
        result.Error!.Type.Should().Be(ErrorType.Gone);
    }
}
