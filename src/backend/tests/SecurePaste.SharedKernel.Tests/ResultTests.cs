namespace SecurePaste.SharedKernel.Tests;

public class ResultTests
{
    [Fact]
    public void Success_result_has_no_error()
    {
        var result = Result.Success();

        Assert.True(result.IsSuccess);
        Assert.False(result.IsFailure);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Failure_result_carries_its_error()
    {
        var error = Error.NotFound("Paste.NotFound", "No such paste.");

        var result = Result.Failure(error);

        Assert.True(result.IsFailure);
        Assert.Equal(error, result.Error);
    }

    [Fact]
    public void Value_of_successful_result_is_accessible()
    {
        var result = Result.Success(42);

        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void Reading_value_of_failed_result_throws()
    {
        var result = Result.Failure<int>(Error.Validation("Paste.Validation", "Bad input."));

        Assert.Throws<InvalidOperationException>(() => result.Value);
    }

    [Fact]
    public void Value_converts_implicitly_to_successful_result()
    {
        Result<string> result = "hello";

        Assert.True(result.IsSuccess);
        Assert.Equal("hello", result.Value);
    }

    [Fact]
    public void Error_converts_implicitly_to_failed_result()
    {
        Result<string> result = Error.Gone("Paste.Gone", "Expired.");

        Assert.True(result.IsFailure);
        Assert.Equal(ErrorType.Gone, result.Error!.Type);
    }
}
