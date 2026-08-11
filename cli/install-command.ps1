# Registers the "kidslearn" command on this Windows machine.
#
#   irm https://raw.githubusercontent.com/deanavraham-bit/kidslearn/main/cli/install-command.ps1 | iex
#
# After it finishes, open a new terminal and type:  kidslearn

$ErrorActionPreference = 'Stop'
$repo = 'deanavraham-bit/kidslearn'
$raw  = "https://raw.githubusercontent.com/$repo/main/cli"
$bin  = Join-Path $env:LOCALAPPDATA 'KidsLearn\bin'

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   מתקין את הפקודה 'kidslearn'" -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

New-Item -ItemType Directory -Path $bin -Force | Out-Null

# Copy from the repo if we're running inside it; otherwise download.
$local = Split-Path -Parent $PSCommandPath
foreach ($f in 'kidslearn.ps1', 'kidslearn.cmd') {
    $src = if ($local) { Join-Path $local $f } else { $null }
    if ($src -and (Test-Path $src)) {
        Copy-Item $src (Join-Path $bin $f) -Force
    } else {
        Invoke-WebRequest -Uri "$raw/$f" -OutFile (Join-Path $bin $f) -UseBasicParsing
    }
    Write-Host "[+] $f" -ForegroundColor Green
}

# Add the folder to the user's PATH (once).
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$bin*") {
    $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $bin } else { "$userPath;$bin" }
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "[+] נוסף ל-PATH: $bin" -ForegroundColor Green
} else {
    Write-Host "[=] כבר ב-PATH: $bin" -ForegroundColor DarkGray
}
$env:Path = "$env:Path;$bin"   # usable right away in this window too

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "   מוכן! פתחו טרמינל חדש והקלידו:" -ForegroundColor Green
Write-Host "     kidslearn" -ForegroundColor White
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
