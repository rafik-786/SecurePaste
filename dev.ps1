$RunBackend = $true
$RunFrontend = $true
$ApplyMigrations = $true

$DatabaseContainer = 'securepaste-pg'
$DatabaseImage = 'postgres:16-alpine'
# Name, user and password must match the connection string in appsettings.Development.json.
$DatabaseName = 'securepaste'
$DatabasePort = 5432
$AspNetEnvironment = 'Development'
$ApiProxyTarget = 'http://localhost:5000'

$ErrorActionPreference = 'Stop'

$backend = Join-Path $PSScriptRoot 'src\backend'
$frontend = Join-Path $PSScriptRoot 'src\frontend'

function Assert-ExitCode([string]$step) {
    if ($LASTEXITCODE -ne 0) {
        throw "$step failed with exit code $LASTEXITCODE."
    }
}

function Start-Database {
    docker info --format '{{.ServerVersion}}' | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker is not running. Start Docker Desktop and try again.'
    }

    $state = docker ps -a --filter "name=^$DatabaseContainer$" --format '{{.State}}'
    if (-not $state) {
        Write-Host "Creating PostgreSQL container $DatabaseContainer..."
        docker run -d --name $DatabaseContainer -e "POSTGRES_USER=$DatabaseName" -e "POSTGRES_PASSWORD=$DatabaseName" -e "POSTGRES_DB=$DatabaseName" -p "${DatabasePort}:5432" $DatabaseImage | Out-Null
        Assert-ExitCode 'docker run'
    } elseif ($state -ne 'running') {
        Write-Host "Starting PostgreSQL container $DatabaseContainer..."
        docker start $DatabaseContainer | Out-Null
        Assert-ExitCode 'docker start'
    }

    $deadline = (Get-Date).AddSeconds(30)
    do {
        docker exec $DatabaseContainer pg_isready -U $DatabaseName -q
        if ($LASTEXITCODE -eq 0) {
            return
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    throw "PostgreSQL in $DatabaseContainer did not become ready within 30 seconds."
}

function Update-Database {
    $connectionString = "Host=localhost;Port=$DatabasePort;Database=$DatabaseName;Username=$DatabaseName;Password=$DatabaseName"
    Push-Location $backend
    try {
        dotnet tool restore | Out-Null
        Assert-ExitCode 'dotnet tool restore'
        Write-Host 'Applying migrations...'
        dotnet ef database update --project src/Modules/SecurePaste.Modules.Pastes --startup-project src/Modules/SecurePaste.Modules.Pastes --connection $connectionString
        Assert-ExitCode 'dotnet ef database update'
    } finally {
        Pop-Location
    }
}

function Install-FrontendPackages {
    if (Test-Path (Join-Path $frontend 'node_modules')) {
        return
    }
    Push-Location $frontend
    try {
        npm ci
        Assert-ExitCode 'npm ci'
    } finally {
        Pop-Location
    }
}

function Open-Tab([string]$title, [string]$directory, [string]$command) {
    $script = "`$Host.UI.RawUI.WindowTitle = '$title'`n$command"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    if (Get-Command wt.exe -ErrorAction SilentlyContinue) {
        wt.exe -w 0 new-tab --title $title --suppressApplicationTitle -d $directory powershell.exe -NoExit -EncodedCommand $encoded
    } else {
        Start-Process powershell.exe -WorkingDirectory $directory -ArgumentList '-NoExit', '-EncodedCommand', $encoded
    }
}

if (-not $RunBackend -and -not $RunFrontend) {
    Write-Host 'Nothing to run: set $RunBackend or $RunFrontend to $true at the top of dev.ps1.'
    return
}

if ($RunBackend) {
    Start-Database
    if ($ApplyMigrations) {
        Update-Database
    }
    Open-Tab 'SecurePaste API' $backend "`$env:ASPNETCORE_ENVIRONMENT = '$AspNetEnvironment'`ndotnet run --project src/SecurePaste.Api --no-launch-profile"
}

if ($RunFrontend) {
    Install-FrontendPackages
    # Vite through node, not npm.cmd, so Ctrl+C stops it without cmd's "Terminate batch job (Y/N)?" prompt.
    Open-Tab 'SecurePaste frontend' $frontend "`$env:VITE_API_PROXY_TARGET = '$ApiProxyTarget'`nnode node_modules/vite/bin/vite.js"
}

if (-not (Get-Command wt.exe -ErrorAction SilentlyContinue)) {
    Write-Host 'Windows Terminal (wt.exe) was not found, so each process opened in its own window.'
}
Write-Host 'Started. Ctrl+C in a tab stops that process. PostgreSQL keeps running; stop it with: docker stop securepaste-pg'
