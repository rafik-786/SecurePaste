using System.Reflection;
using NetArchTest.Rules;
using SecurePaste.Modules.Pastes;
using SecurePaste.SharedKernel;

namespace SecurePaste.ArchitectureTests;

public class LayerDependencyTests
{
    private const string PastesRoot = "SecurePaste.Modules.Pastes";
    private const string SharedKernelRoot = "SecurePaste.SharedKernel";

    private static readonly Assembly PastesAssembly = typeof(PastesModule).Assembly;

    [Fact]
    public void Domain_depends_only_on_system_and_the_shared_kernel()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Domain")
            .Should().OnlyHaveDependenciesOn(
                "System",
                SharedKernelRoot,
                $"{PastesRoot}.Domain")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Application_depends_only_on_domain_and_the_shared_kernel()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Application")
            .Should().OnlyHaveDependenciesOn(
                "System",
                SharedKernelRoot,
                $"{PastesRoot}.Domain",
                $"{PastesRoot}.Application")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Endpoints_never_reach_sideways_into_infrastructure()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Endpoints")
            .ShouldNot().HaveDependencyOnAny($"{PastesRoot}.Infrastructure")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Infrastructure_never_reaches_sideways_into_endpoints()
    {
        var result = Types.InAssembly(PastesAssembly)
            .That().ResideInNamespace($"{PastesRoot}.Infrastructure")
            .ShouldNot().HaveDependencyOnAny($"{PastesRoot}.Endpoints")
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    [Fact]
    public void Shared_kernel_depends_only_on_system()
    {
        var result = Types.InAssembly(typeof(Result).Assembly)
            .Should().OnlyHaveDependenciesOn("System", SharedKernelRoot)
            .GetResult();

        result.IsSuccessful.Should().BeTrue(FailingTypes(result));
    }

    private static string FailingTypes(TestResult result) =>
        result.FailingTypeNames is null ? string.Empty : string.Join(", ", result.FailingTypeNames);
}
