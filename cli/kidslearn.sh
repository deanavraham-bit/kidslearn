#!/usr/bin/env bash
# KidsLearn - the "kidslearn" terminal command (macOS / Linux)
#
#   kidslearn            -> interactive menu: pick your operating system
#   kidslearn mac-arm    -> skip the menu (win|mac-arm|mac-intel|linux|deb|android)

set -euo pipefail

REPO="deanavraham-bit/kidslearn"
API="https://api.github.com/repos/${REPO}/releases/latest"
PAGE="https://github.com/${REPO}/releases/latest"

echo ""
echo "  ========================================"
echo "   KidsLearn - התקנה"
echo "  ========================================"
echo ""

# What is this machine, so we can mark it in the menu?
detected=""
case "$(uname -s)" in
  Darwin) if [ "$(uname -m)" = "arm64" ]; then detected="mac-arm"; else detected="mac-intel"; fi ;;
  Linux)  detected="linux" ;;
esac

KEYS=(win mac-arm mac-intel linux deb android)
LABELS=(
  "Windows  (10 / 11)"
  "macOS - Apple Silicon (M1/M2/M3/M4)"
  "macOS - Intel"
  "Linux  (AppImage - כל הפצה)"
  "Linux  (Debian / Ubuntu .deb)"
  "Android  (APK - טלפון/טאבלט)"
)

choice="${1:-}"

if [ -z "$choice" ]; then
  echo "  איזו מערכת הפעלה יש לך?"
  echo ""
  default_n=1
  for i in "${!KEYS[@]}"; do
    tag=""
    if [ "${KEYS[$i]}" = "$detected" ]; then tag="  <- זוהתה במחשב הזה"; default_n=$((i + 1)); fi
    echo "    [$((i + 1))] ${LABELS[$i]}${tag}"
  done
  echo "    [0] יציאה"
  echo ""
  while [ -z "$choice" ]; do
    read -r -p "  בחירה [${default_n}]: " answer </dev/tty
    answer="${answer:-$default_n}"
    if [ "$answer" = "0" ]; then echo "  בוטל."; exit 0; fi
    if [[ "$answer" =~ ^[0-9]+$ ]] && [ "$answer" -ge 1 ] && [ "$answer" -le "${#KEYS[@]}" ]; then
      choice="${KEYS[$((answer - 1))]}"
    else
      echo "  בחירה לא תקינה - הקלידו מספר בין 1 ל-${#KEYS[@]}."
    fi
  done
  echo ""
fi

label=""
for i in "${!KEYS[@]}"; do
  [ "${KEYS[$i]}" = "$choice" ] && label="${LABELS[$i]}"
done
if [ -z "$label" ]; then
  echo "[X] בחירה לא מוכרת: $choice"
  echo "    אפשרויות: ${KEYS[*]}"
  exit 1
fi
echo "[*] נבחר: $label"

case "$choice" in
  win)       pattern='\.exe$' ;;
  mac-arm)   pattern='arm64.*\.dmg$' ;;
  mac-intel) pattern='\.dmg$' ;;   # arm64 filtered out below
  linux)     pattern='\.AppImage$' ;;
  deb)       pattern='\.deb$' ;;
  android)   pattern='\.apk$' ;;
esac

echo "[1/3] מאתר את הגרסה האחרונה..."
json="$(curl -fsSL "$API")" || {
  echo "[X] לא הצלחתי להתחבר ל-GitHub. הורידו ידנית מ: $PAGE"; exit 1; }

urls="$(printf '%s' "$json" \
  | grep -o '"browser_download_url": *"[^"]*"' \
  | sed 's/.*"browser_download_url": *"//;s/"$//' \
  | grep -iE "$pattern" || true)"
if [ "$choice" = "mac-intel" ]; then
  urls="$(printf '%s\n' "$urls" | grep -v 'arm64' || true)"
fi
url="$(printf '%s\n' "$urls" | head -n 1)"

if [ -z "$url" ]; then
  echo "[X] אין קובץ מתאים בגרסה האחרונה. ראו: $PAGE"
  exit 1
fi
name="$(basename "$url")"
echo "      $name"

out_dir="$HOME/Downloads"
mkdir -p "$out_dir"
out="$out_dir/$name"
echo "[2/3] מוריד..."
curl -fSL "$url" -o "$out"
echo "      נשמר ב: $out"
echo ""

echo "[3/3] מסיים..."
echo ""
echo "  ========================================"
case "$choice" in
  mac-arm|mac-intel)
    if [ "$(uname -s)" = "Darwin" ]; then
      open "$out" 2>/dev/null || true
      echo "   פתחתי את ה-DMG - גררו את KidsLearn ל-Applications."
      echo "   בפתיחה הראשונה: קליק ימני -> Open -> Open."
    else
      echo "   הקובץ הורד. העבירו אותו ל-Mac והריצו אותו שם."
    fi ;;
  linux)
    chmod +x "$out"
    echo "   מוכן להרצה:"
    echo "     $out"
    echo "   (או כפול-קליק במנהל הקבצים)" ;;
  deb)
    echo "   להתקנה:"
    echo "     sudo dpkg -i \"$out\"" ;;
  win)
    echo "   הקובץ הורד. העבירו אותו למחשב Windows והריצו אותו שם:"
    echo "     $out" ;;
  android)
    echo "   העבירו את ה-APK לטלפון, פתחו אותו,"
    echo "   ואשרו 'התקנה ממקור לא ידוע'." ;;
esac
echo "  ========================================"
echo ""
