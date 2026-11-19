param(
  [switch]$InstallAiDependencies
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

$nodeVersion = node -p "process.versions.node"
if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion -lt [version]'22.9') {
  throw 'Node.js 22.9 or newer is required.'
}

$pythonVersionOutput = python --version 2>&1
if ($LASTEXITCODE -ne 0 -or $pythonVersionOutput -notmatch 'Python (\d+)\.(\d+)') {
  throw 'Python 3.11 or newer is required. Install Python and ensure python.exe is on PATH.'
}
if ([int]$Matches[1] -lt 3 -or ([int]$Matches[1] -eq 3 -and [int]$Matches[2] -lt 11)) {
  throw 'Python 3.11 or newer is required.'
}

Invoke-CheckedCommand 'npm' @('install')
Invoke-CheckedCommand 'npm' @('--prefix', 'frontend', 'install')
Invoke-CheckedCommand 'npm' @('--prefix', 'backend', 'install')

if (-not (Test-Path 'backend\.env')) {
  Copy-Item '.env.example' 'backend\.env'
  Write-Host 'Created backend\.env from .env.example; edit its database credentials and secrets.'
} else {
  Write-Host 'Preserved existing backend\.env.'
}

if (-not (Test-Path 'ai-service\.venv')) {
  Invoke-CheckedCommand 'python' @('-m', 'venv', 'ai-service\.venv')
}

if ($InstallAiDependencies) {
  $python = Join-Path $root 'ai-service\.venv\Scripts\python.exe'
  Invoke-CheckedCommand $python @('-m', 'pip', 'install', '--upgrade', 'pip')
  Invoke-CheckedCommand $python @('-m', 'pip', 'install', '-r', 'ai-service\requirements.txt')
} else {
  Write-Host 'AI dependencies were not installed (they include large ML packages).'
  Write-Host 'Install them with: ai-service\.venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt'
}

Write-Host 'Setup complete. Start MySQL, configure backend\.env, then run scripts\start-development.ps1.'
Write-Host 'For Redis/Celery on Windows, use the WSL2 instructions in README.md.'
