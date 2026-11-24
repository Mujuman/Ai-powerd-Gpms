$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $root 'backend\.env'
$aiServicePath = Join-Path $root 'ai-service'

if (-not (Test-Path $envFile)) {
  throw 'backend\.env is missing. Configure AI_SERVICE_TOKEN before starting the AI service.'
}

$token = $env:AI_SERVICE_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  $tokenLine = Get-Content $envFile |
    Where-Object { $_ -match '^\s*AI_SERVICE_TOKEN\s*=' } |
    Select-Object -Last 1
  if ($tokenLine -match '^\s*AI_SERVICE_TOKEN\s*=\s*(.*)$') {
    $token = $Matches[1].Trim()
    if (($token.StartsWith('"') -and $token.EndsWith('"')) -or
        ($token.StartsWith("'") -and $token.EndsWith("'"))) {
      $token = $token.Substring(1, $token.Length - 2)
    }
  }
}

if ([string]::IsNullOrWhiteSpace($token) -or
    $token -eq 'replace-with-a-separate-random-internal-token') {
  throw 'AI_SERVICE_TOKEN is missing or still has its placeholder value in backend\.env.'
}

$python = Join-Path $aiServicePath '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
  throw 'AI service virtual environment is missing. Run scripts\setup-windows.ps1 first.'
}

$env:AI_SERVICE_TOKEN = $token
Set-Location $aiServicePath
& $python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
exit $LASTEXITCODE
