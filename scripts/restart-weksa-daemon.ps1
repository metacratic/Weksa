param(
  [int] $Port = 8813,
  [string] $HostName = "127.0.0.1",
  [string] $StateRoot = "E:\Projects\weksa\.weksa"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$pidPath = Join-Path $StateRoot "weksa-daemon.pid"

if (Test-Path -LiteralPath $pidPath) {
  $pidText = (Get-Content -LiteralPath $pidPath -Raw).Trim()
  if ($pidText -match "^\d+$") {
    Stop-Process -Id ([int] $pidText) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\start-weksa-daemon.ps1") -Port $Port -HostName $HostName -StateRoot $StateRoot
exit $LASTEXITCODE
