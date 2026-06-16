param(
  [int] $Port = 8813,
  [string] $HostName = "127.0.0.1",
  [string] $StateRoot = "E:\Projects\weksa\.weksa",
  [string] $MiMoApiKeyPath = "E:\Projects\gamecult-ops\mimo-api-Weksa.txt",
  [string] $IdunnRudpHealth = "127.0.0.1:17870",
  [string] $IdunnDaemon = "weksa",
  [string] $IdunnHealthContract = "weksa.cultnet-rudp-provider-health"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $StateRoot "weksa-daemon.pid"
$outLog = Join-Path $StateRoot "weksa-daemon.out.log"
$errLog = Join-Path $StateRoot "weksa-daemon.err.log"

New-Item -ItemType Directory -Force -Path $StateRoot | Out-Null
$cultLibPackages = Resolve-Path -LiteralPath (Join-Path $repoRoot "..\CultLib\packages")
$env:NODE_PATH = (@($cultLibPackages.Path, $env:NODE_PATH) | Where-Object { $_ }) -join [IO.Path]::PathSeparator

if (Test-Path -LiteralPath $pidPath) {
  $pidText = (Get-Content -LiteralPath $pidPath -Raw).Trim()
  if ($pidText -match "^\d+$") {
    $existing = Get-Process -Id ([int] $pidText) -ErrorAction SilentlyContinue
    if ($null -ne $existing) {
      try {
        & node (Join-Path $repoRoot "scripts\weksa-daemon.mjs") --health --host $HostName --port $Port --state-root $StateRoot | Out-Null
        if ($LASTEXITCODE -eq 0) {
          Write-Host "Weksa daemon already healthy as PID $pidText."
          return
        }
      } catch {
        Stop-Process -Id $existing.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

$arguments = @(
  (Join-Path $repoRoot "scripts\weksa-daemon.mjs"),
  "--host", $HostName,
  "--port", [string] $Port,
  "--state-root", $StateRoot,
  "--mimo-api-key-path", $MiMoApiKeyPath,
  "--idunn-rudp-health", $IdunnRudpHealth,
  "--idunn-daemon", $IdunnDaemon,
  "--idunn-health-contract", $IdunnHealthContract
)

$process = Start-Process -FilePath "node" `
  -ArgumentList $arguments `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

$process.Id | Set-Content -Encoding ASCII -LiteralPath $pidPath

Start-Sleep -Seconds 2
if ($process.HasExited) {
  $detail = ""
  if (Test-Path -LiteralPath $outLog) { $detail += Get-Content -Raw -LiteralPath $outLog }
  if (Test-Path -LiteralPath $errLog) { $detail += Get-Content -Raw -LiteralPath $errLog }
  throw "Weksa daemon exited immediately with code $($process.ExitCode).`n$detail"
}

& node (Join-Path $repoRoot "scripts\weksa-daemon.mjs") --health --host $HostName --port $Port --state-root $StateRoot | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Weksa daemon started but health check failed."
}

Write-Host "Started Weksa daemon as PID $($process.Id)."
Write-Host "  health: http://$HostName`:$Port/health"
Write-Host "  state: $StateRoot"
