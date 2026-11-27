param([ValidateRange(1024,65535)][int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $serviceRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/setup.ps1 first.' }
if (-not (Test-Path -LiteralPath (Join-Path $serviceRoot '.env'))) { throw 'Create .env with a strong AI_API_KEY first.' }
Push-Location $serviceRoot
try {
    # Never add multiple workers: each would attempt to load another model.
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $Port --workers 1 --limit-concurrency 8 --no-access-log
    if ($LASTEXITCODE -ne 0) { throw 'Qwen service exited with an error.' }
} finally { Pop-Location }
