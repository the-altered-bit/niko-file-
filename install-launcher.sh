#!/usr/bin/env bash
# Installs a .desktop launcher for Niko Files so it shows up in your
# applications list (GNOME Activities, KDE app menu, etc.) with its icon.
# Safe to re-run any time you move the project folder.
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$DIR/niko-files.sh"

APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"

DESKTOP_FILE="$APPS_DIR/niko-files.desktop"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=Niko Files
Comment=A fast, beautiful file explorer with a built-in terminal
Exec=$DIR/niko-files.sh %U
Icon=$DIR/src/assets/icon.png
Path=$DIR
Terminal=false
Categories=Utility;FileTools;FileManager;
StartupWMClass=niko-files
EOF

chmod +x "$DESKTOP_FILE"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

echo "Installed launcher: $DESKTOP_FILE"
echo "Niko Files should now appear in your applications list."
echo "If it doesn't show up immediately, log out/in once, or run:"
echo "  update-desktop-database ~/.local/share/applications"
