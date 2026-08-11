# KidsLearn - the "kidslearn" terminal command (Windows / PowerShell)
#
#   kidslearn            -> interactive menu: pick your operating system
#   kidslearn -Os win    -> skip the menu (win | mac-arm | mac-intel | linux | deb | android)
#
# Downloads the matching build from the latest GitHub release and runs it.

param(
    [ValidateSet('win', 'mac-arm', 'mac-intel', 'linux', 'deb', 'android')]
    [string]$Os,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
$repo = 'deanavraham-bit/kidslearn'
$releasesPage = "https://github.com/$repo/releases/latest"

if ($Help) {
    Write-Host ""
    Write-Host "  kidslearn            - תפריט: בחרו מערכת הפעלה"
    Write-Host "  kidslearn -Os win    - התקנה ישירה (win|mac-arm|mac-intel|linux|deb|android)"
    Write-Host ""
    return
}

function Write-Banner {
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Cyan
    Write-Host "   KidsLearn - התקנה" -ForegroundColor Cyan
    Write-Host "  ========================================" -ForegroundColor Cyan
    Write-Host ""
}

# ── The choices, in menu order ────────────────────────────────────────────────
# pattern = regex matched against the release asset name
$choices = @(
    @{ Key = 'win';       Label = 'Windows  (10 / 11)';                  Pattern = '\.exe$';            Ext = 'exe' }
    @{ Key = 'mac-arm';   Label = 'macOS - Apple Silicon (M1/M2/M3/M4)'; Pattern = 'arm64.*\.dmg$';     Ext = 'dmg' }
    @{ Key = 'mac-intel'; Label = 'macOS - Intel';                       Pattern = '^(?!.*arm64).*\.dmg$'; Ext = 'dmg' }
    @{ Key = 'linux';     Label = 'Linux  (AppImage - כל הפצה)';         Pattern = '\.AppImage$';       Ext = 'AppImage' }
    @{ Key = 'deb';       Label = 'Linux  (Debian / Ubuntu .deb)';       Pattern = '\.deb$';            Ext = 'deb' }
    @{ Key = 'android';   Label = 'Android  (APK - טלפון/טאבלט)';        Pattern = '\.apk$';            Ext = 'apk' }
)

$hostIsWindows = $true   # this script only runs on Windows

Write-Banner

# ── 1. Pick the operating system ──────────────────────────────────────────────
if (-not $Os) {
    Write-Host "  איזו מערכת הפעלה יש לך?" -ForegroundColor White
    Write-Host ""
    for ($i = 0; $i -lt $choices.Count; $i++) {
        $tag = if ($choices[$i].Key -eq 'win') { "  <- זוהתה במחשב הזה" } else { "" }
        Write-Host ("    [{0}] {1}{2}" -f ($i + 1), $choices[$i].Label, $tag) -ForegroundColor Gray
    }
    Write-Host "    [0] יציאה" -ForegroundColor DarkGray
    Write-Host ""

    while (-not $Os) {
        $answer = Read-Host "  בחירה [1]"
        if ([string]::IsNullOrWhiteSpace($answer)) { $answer = '1' }
        if ($answer -eq '0') { Write-Host "  בוטל." -ForegroundColor DarkGray; return }
        $n = 0
        if ([int]::TryParse($answer, [ref]$n) -and $n -ge 1 -and $n -le $choices.Count) {
            $Os = $choices[$n - 1].Key
        } else {
            Write-Host "  בחירה לא תקינה - הקלידו מספר בין 1 ל-$($choices.Count)." -ForegroundColor Red
        }
    }
    Write-Host ""
}

$choice = $choices | Where-Object { $_.Key -eq $Os } | Select-Object -First 1
Write-Host "[*] נבחר: $($choice.Label)" -ForegroundColor Yellow

# ── 2. Find the matching asset in the latest release ──────────────────────────
Write-Host "[1/3] מאתר את הגרסה האחרונה..." -ForegroundColor Yellow
try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -UseBasicParsing
} catch {
    Write-Host "[X] לא הצלחתי להתחבר ל-GitHub: $_" -ForegroundColor Red
    Write-Host "    בדקו את חיבור האינטרנט, או הורידו ידנית מ: $releasesPage" -ForegroundColor Red
    return
}

$asset = $rel.assets | Where-Object { $_.name -match $choice.Pattern } | Select-Object -First 1
if (-not $asset) {
    Write-Host "[X] אין קובץ $($choice.Ext) בגרסה $($rel.tag_name)." -ForegroundColor Red
    Write-Host "    ראו את כל הקבצים הזמינים ב: $releasesPage" -ForegroundColor Red
    return
}
Write-Host "      גרסה $($rel.tag_name) - $($asset.name)" -ForegroundColor Green

# ── 3. Download ───────────────────────────────────────────────────────────────
$downloads = Join-Path $env:USERPROFILE 'Downloads'
if (-not (Test-Path $downloads)) { $downloads = $env:TEMP }
$dest = Join-Path $downloads $asset.name

$sizeMB = [math]::Round($asset.size / 1MB, 1)
Write-Host "[2/3] מוריד ($sizeMB MB)..." -ForegroundColor Yellow
Write-Host "      $($asset.browser_download_url)" -ForegroundColor DarkGray
try {
    $ProgressPreference = 'Continue'
    Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -UseBasicParsing
} catch {
    Write-Host "[X] ההורדה נכשלה: $_" -ForegroundColor Red
    return
}
Write-Host "      נשמר ב: $dest" -ForegroundColor Green
Write-Host ""

# ── 4. Install (or explain how, if the file is for another machine) ───────────
Write-Host "[3/3] מפעיל..." -ForegroundColor Yellow
if ($Os -eq 'win') {
    Write-Host "      (אם Windows מציג אזהרת SmartScreen: 'More info' -> 'Run anyway')" -ForegroundColor DarkGray
    Start-Process -FilePath $dest
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "   ההתקנה התחילה - עקבו אחרי ההוראות על המסך." -ForegroundColor Green
    Write-Host "  ========================================" -ForegroundColor Green
} else {
    Write-Host "      הקובץ הזה מיועד ל-$($choice.Label), לא ל-Windows." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  ========================================" -ForegroundColor Green
    Write-Host "   הקובץ הורד. העבירו אותו למכשיר היעד (דיסק-און-קי / מייל):" -ForegroundColor Green
    Write-Host "     $dest" -ForegroundColor White
    switch ($Os) {
        'mac-arm'   { Write-Host "   ב-Mac: פתחו את ה-DMG וגררו את KidsLearn ל-Applications." -ForegroundColor Green
                      Write-Host "   בפתיחה הראשונה: קליק ימני -> Open -> Open." -ForegroundColor Green }
        'mac-intel' { Write-Host "   ב-Mac: פתחו את ה-DMG וגררו את KidsLearn ל-Applications." -ForegroundColor Green
                      Write-Host "   בפתיחה הראשונה: קליק ימני -> Open -> Open." -ForegroundColor Green }
        'linux'     { Write-Host "   בלינוקס: chmod +x $($asset.name)  ואז הריצו אותו." -ForegroundColor Green }
        'deb'       { Write-Host "   בלינוקס: sudo dpkg -i $($asset.name)" -ForegroundColor Green }
        'android'   { Write-Host "   באנדרואיד: פתחו את ה-APK ואשרו 'התקנה ממקור לא ידוע'." -ForegroundColor Green }
    }
    Write-Host "  ========================================" -ForegroundColor Green
}
Write-Host ""
