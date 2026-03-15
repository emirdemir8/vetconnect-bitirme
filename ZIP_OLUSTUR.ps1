# Projeyi paylasim icin ZIP'ler (buyuk/ gereksiz klasorler haric)
# Kullanim: PowerShell'de bu dosyanin oldugu klasorde: .\ZIP_OLUSTUR.ps1

$root = $PSScriptRoot
$dest = Join-Path (Split-Path $root -Parent) "BITIRME_paylasim"
$zipPath = Join-Path (Split-Path $root -Parent) "BITIRME_paylasim.zip"

# Atlanacak klasorler (ZIP'e eklenmeyecek)
$excludeDirs = @(
    "node_modules",
    "__pycache__",
    ".venv",
    "venv",
    "env",
    "dist",
    ".git",
    ".cursor",
    ".idea",
    ".vscode"
)

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

New-Item -ItemType Directory -Path $dest | Out-Null

function Copy-Excluding {
    param($src, $dst)
    Get-ChildItem $src -Force | ForEach-Object {
        $target = Join-Path $dst $_.Name
        if ($_.PSIsContainer) {
            if ($_.Name -in $excludeDirs) { return }
            New-Item -ItemType Directory -Path $target -Force | Out-Null
            Copy-Excluding $_.FullName $target
        } else {
            Copy-Item $_.FullName $target -Force
        }
    }
}

Copy-Excluding $root $dest
Compress-Archive -Path $dest -DestinationPath $zipPath -Force
Remove-Item $dest -Recurse -Force

Write-Host "ZIP olusturuldu: $zipPath" -ForegroundColor Green
