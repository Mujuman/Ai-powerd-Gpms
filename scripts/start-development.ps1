$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

if (-not (Test-Path 'backend\.env')) {
  throw 'backend\.env is missing. Run scripts\setup-windows.ps1 and configure the database settings first.'
}

npm run dev
exit $LASTEXITCODE
