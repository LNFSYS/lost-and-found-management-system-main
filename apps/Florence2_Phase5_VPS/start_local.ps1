$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    throw 'Missing .venv. Create it with: py -3.11 -m venv .venv'
}
if (-not (Test-Path -LiteralPath '.env')) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $key = [Convert]::ToBase64String($bytes)
    @(
        "API_KEY=$key"
        'TORCH_THREADS=2'
        'PRELOAD_MODEL=1'
        'REQUIRE_LORA=1'
        'MAX_UPLOAD_MB=8'
        'MAX_IMAGE_PIXELS=10000000'
        'FLORENCE_ADAPTER_DIR=./adapter'
    ) | Set-Content -LiteralPath '.env' -Encoding ascii
}

& .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1 --env-file .env
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
