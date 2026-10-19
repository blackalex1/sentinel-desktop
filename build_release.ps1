# Build script for Sentinel Desktop (PC VPN Client)
param(
    [string]$Configuration = "Release",
    [string]$OutputDir = "$PSScriptRoot\publish_release"
)

$ErrorActionPreference = "Stop"

# Locate dotnet SDK
$dotnetCmd = "dotnet"
$localDotnet = "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"

if (Test-Path $localDotnet) {
    $sdkCheck = & $localDotnet --list-sdks 2>&1
    if ($LASTEXITCODE -eq 0 -and $sdkCheck) {
        $dotnetCmd = $localDotnet
        $env:DOTNET_ROOT = "$env:LOCALAPPDATA\Microsoft\dotnet"
        $env:PATH = "$env:DOTNET_ROOT;$env:PATH"
    }
}

Write-Host "==> Using .NET: $dotnetCmd" -ForegroundColor Cyan
& $dotnetCmd --version

Write-Host "`n==> Building and publishing SentinelDesktop to $OutputDir..." -ForegroundColor Cyan
& $dotnetCmd publish "$PSScriptRoot\SentinelDesktop.csproj" -c $Configuration -r win-x64 --self-contained true -o $OutputDir

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit $LASTEXITCODE
}

Write-Host "`n==> Build successful!" -ForegroundColor Green
Write-Host "Target executable: $OutputDir\SentinelDesktop.exe" -ForegroundColor Green
Write-Host "Binaries folder:   $OutputDir\binaries" -ForegroundColor Green
