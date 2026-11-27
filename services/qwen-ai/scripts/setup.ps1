$ErrorActionPreference = 'Stop'
$serviceRoot = Split-Path $PSScriptRoot -Parent
Push-Location $serviceRoot
try {
    if (-not (Test-Path '.venv/Scripts/python.exe')) {
        & py -3.11 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 venv creation failed.' }
    }
    & ./.venv/Scripts/python.exe -m pip install --no-cache-dir torch==2.8.0 torchvision==0.23.0 'pillow>=12.1.1,<13' --index-url https://download.pytorch.org/whl/cu126
    if ($LASTEXITCODE -ne 0) { throw 'CUDA PyTorch installation failed.' }
    & ./.venv/Scripts/python.exe -m pip install --no-cache-dir -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Service dependency installation failed.' }
    & ./.venv/Scripts/python.exe scripts/preflight.py
    if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; see CUDA diagnostics above.' }
    & ./.venv/Scripts/python.exe scripts/init_env.py
} finally { Pop-Location }
