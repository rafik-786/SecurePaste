FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY .config/ .config/
COPY global.json nuget.config Directory.Build.props Directory.Packages.props ./
COPY src/SecurePaste.Api/SecurePaste.Api.csproj src/SecurePaste.Api/
COPY src/SecurePaste.SharedKernel/SecurePaste.SharedKernel.csproj src/SecurePaste.SharedKernel/
COPY src/Modules/SecurePaste.Modules.Pastes/SecurePaste.Modules.Pastes.csproj src/Modules/SecurePaste.Modules.Pastes/
RUN dotnet tool restore && dotnet restore src/SecurePaste.Api/SecurePaste.Api.csproj

COPY src/ src/
RUN dotnet publish src/SecurePaste.Api/SecurePaste.Api.csproj -c Release -o /out/api --no-restore
RUN dotnet ef migrations bundle \
    --project src/Modules/SecurePaste.Modules.Pastes \
    --startup-project src/Modules/SecurePaste.Modules.Pastes \
    --configuration Release \
    --output /out/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS migrator
WORKDIR /app
COPY --from=build /out/efbundle .
USER $APP_UID
ENTRYPOINT ["./efbundle"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS api
WORKDIR /app
COPY --from=build /out/api .
USER $APP_UID
ENTRYPOINT ["dotnet", "SecurePaste.Api.dll"]
