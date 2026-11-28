param([ValidateRange(1024,65535)][int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $serviceRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Run scripts/setup.ps1 first.' }
if (-not (Test-Path -LiteralPath (Join-Path $serviceRoot '.env'))) { throw 'Create .env with a strong AI_API_KEY first.' }
$runningService = $null
try { $runningService = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3 } catch { }
if ($runningService -and $runningService.model -eq 'Qwen/Qwen3-VL-2B-Instruct' -and $runningService.status -eq 'ok') {
    Write-Host "Qwen is already running on port $Port (model: $($runningService.model_status))."
    Write-Host 'Use the existing service. Restart that process only when loading changed code.'
    return
}
Push-Location $serviceRoot
try {
    # Never add multiple workers: each would attempt to load another model.
    & $pythonExe -m uvicorn app.main:app --host 127.0.0.1 --port $Port --workers 1 --limit-concurrency 8 --no-access-log
    if ($LASTEXITCODE -ne 0) { throw 'Qwen service exited with an error.' }
} finally { Pop-Location }
