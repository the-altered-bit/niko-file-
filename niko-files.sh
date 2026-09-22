#!/usr/bin/env bash
# Launches Niko Files regardless of what directory the launcher invokes this from.
# Resolves its own location so it keeps working if the folder is ever moved/renamed,
# as long as you re-run install-launcher.sh afterward.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

LOG="$DIR/niko-files.log"
: > "$LOG"  # truncate on each launch so it only ever shows the latest run

# Call Electron's actual compiled binary directly, not via `npx`/`node`.
# GUI launchers (double-clicking a .desktop icon) run with a stripped-down
# environment that often doesn't include the PATH entries your terminal has
# (nvm-managed node, etc.), so relying on `npx electron` can silently fail
# with no window and no visible error. The prebuilt binary bundles its own
# Node/V8 runtime and needs nothing from PATH.
ELECTRON_BIN="$DIR/node_modules/electron/dist/electron"

if [ -x "$ELECTRON_BIN" ]; then
  "$ELECTRON_BIN" "$DIR" "$@" >>"$LOG" 2>&1
  exit $?
fi

# Fallback for unusual installs where the binary isn't at the expected path.
if command -v npx >/dev/null 2>&1; then
  npx electron "$DIR" "$@" >>"$LOG" 2>&1
  exit $?
fi

echo "Could not find the Electron binary at $ELECTRON_BIN, and npx is not on PATH." >>"$LOG"
echo "Run 'npm install' inside $DIR, then try again." >>"$LOG"
exit 1
