# BITIRME — geliştirme sunucuları (2 ayrı pencere açar)
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "BITIRME — MongoDB (XAMPP) acik olmali: mongodb://localhost:27017" -ForegroundColor Cyan
Write-Host "API: http://127.0.0.1:8000  |  Frontend: http://localhost:5173" -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root'; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
)
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\frontend'; npm run dev"
)
Write-Host "Backend ve frontend pencereleri acildi." -ForegroundColor Green
