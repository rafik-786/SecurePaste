using System.Reflection;
using NetArchTest.Rules;
using SecurePaste.Modules.Pastes;
using SecurePaste.SharedKernel;

namespace SecurePaste.ArchitectureTests;

public class LayerDependencyTests
{
    private const string PastesRoot = "SecurePaste.Modules.Pastes";

    private static readonly Assembly PastesAssembly = typeof(PastesModule).Assembly;

    [Fact]
    public void Domain_depends_only_inward()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Domain")
            .ShouldNot().HaveDependencyOnAny(
                $"{PastesRoot}.Application",
                $"{PastesRoot}.Infrastructure",
                $"{PastesRoot}.Endpoints",
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Application_depends_only_on_domain()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Application")
            .ShouldNot().HaveDependencyOnAny(
                $"{PastesRoot}.Infrastructure",
                $"{PastesRoot}.Endpoints",
                "Microsoft.EntityFrameworkCore",
                "Microsoft.AspNetCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Shared_kernel_depends_on_no_module_or_web_framework()
    {
        var result = Types.InAssembly(typeof(Result).Assembly)
            .ShouldNot().HaveDependencyOnAny(
                "SecurePaste.Modules",
                "Microsoft.AspNetCore",
                "Microsoft.EntityFrameworkCore")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    private static string FailingTypes(TestResult result) =>
        result.FailingTypeNames is null ? string.Empty : string.Join(", ", result.FailingTypeNames);
}
