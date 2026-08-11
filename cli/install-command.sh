#!/usr/bin/env bash
# Registers the "kidslearn" command on macOS / Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/deanavraham-bit/kidslearn/main/cli/install-command.sh | bash
#
# Then open a new terminal and type:  kidslearn

set -euo pipefail

REPO="deanavraham-bit/kidslearn"
RAW="https://raw.githubusercontent.com/${REPO}/main/cli/kidslearn.sh"

echo ""
echo "  ========================================"
echo "   מתקין את הפקודה 'kidslearn'"
echo "  ========================================"
echo ""

# Prefer a system-wide bin if we can write to it, else the per-user one.
if [ -w "/usr/local/bin" ]; then
  BIN="/usr/local/bin"
else
  BIN="$HOME/.local/bin"
  mkdir -p "$BIN"
fi
TARGET="$BIN/kidslearn"

# Copy from the repo if this script sits next to kidslearn.sh; otherwise download.
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
if [ -n "$here" ] && [ -f "$here/kidslearn.sh" ]; then
  cp "$here/kidslearn.sh" "$TARGET"
else
  curl -fsSL "$RAW" -o "$TARGET"
fi
chmod +x "$TARGET"
echo "[+] הותקן: $TARGET"

# Make sure that folder is on PATH for future shells.
case ":$PATH:" in
  *":$BIN:"*) echo "[=] כבר ב-PATH: $BIN" ;;
  *)
    for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
      [ -f "$rc" ] || continue
      grep -qF "$BIN" "$rc" || printf '\nexport PATH="%s:$PATH"\n' "$BIN" >> "$rc"
      echo "[+] נוסף ל-PATH דרך $rc"
    done ;;
esac

echo ""
echo "  ========================================"
echo "   מוכן! פתחו טרמינל חדש והקלידו:"
echo "     kidslearn"
echo "  ========================================"
echo ""
