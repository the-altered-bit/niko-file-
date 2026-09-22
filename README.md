# Niko Files

A fast, dark, keyboard-friendly file explorer for Linux with a real built-in terminal that stays synced to whatever folder you're browsing.

## Features in this build

- Sidebar with Home / Filesystem / Desktop / Documents / Downloads + pin any folder
- Breadcrumb path bar, back/forward/up navigation, browser-style history
- Grid and list views, toggleable hidden files, live filename filter
- Right-click menu: open, rename (inline, press F2), copy path, pin, move to Trash
- New folder, delete (moves to Trash, not permanent), multi-select (Ctrl/Cmd+click)
- Folder size on demand (`du -sh`)
- **Integrated terminal** (toggle with the terminal icon or `Ctrl+\``): a real shell (your `$SHELL`) running in a real PTY via `node-pty` + `xterm.js`, docked at the bottom. It opens in whatever folder you're currently browsing, and "Open terminal here" from the right-click menu jumps it straight to that folder.
- Dark theme, amber accent, monospace used for file metadata and the terminal only (not decoration)

## Requirements

- Linux
- Node.js 18+ and npm
- Build tools for native modules (`node-pty` compiles a small native addon):
  ```bash
  sudo apt install build-essential python3
  ```
  (Debian/Ubuntu — use your distro's equivalent otherwise.)

## Setup

```bash
cd niko-files
npm install
npm start
```

If `node-pty` fails to build, the app still runs — the terminal panel will show a message instead of a shell. Everything else (browsing, rename, trash, etc.) works regardless.

## Adding it to your applications list

To get Niko Files showing up in your app launcher (GNOME Activities, KDE menu, etc.) with its icon, without needing to package a full AppImage:

```bash
cd niko-files
npm install          # if you haven't already
./install-launcher.sh
```

This registers a `.desktop` entry at `~/.local/share/applications/niko-files.desktop` pointing at the included icon (`src/assets/icon.png`) and a small wrapper script (`niko-files.sh`) that launches the app via `npx electron .` from the right directory — so it works no matter what folder you click it from.

If it doesn't appear right away, log out and back in once, or run:
```bash
update-desktop-database ~/.local/share/applications
```

If you ever move or rename the project folder, just re-run `./install-launcher.sh` — it always points at wherever it currently lives.

**If clicking the icon does nothing:** the wrapper now logs to `niko-files.log` in the project folder every time it runs. Click the icon, then check:
```bash
cat niko-files.log
```
The most common cause is a GUI launcher having a different `PATH` than your terminal (e.g. it can't see an `nvm`-managed Node), which used to make the old `npx electron` wrapper fail silently. The wrapper now calls Electron's compiled binary directly instead, which avoids that — but if `node_modules/electron/dist/electron` isn't there (e.g. `npm install` didn't finish), the log will say so.

For a "real" installed app (rather than a launcher that runs from source), package it instead:
```bash
npx electron-builder
```
This produces an AppImage/.deb in `dist/` using the same icon, which integrates with your system without needing Node/npm installed at launch time.

## Packaging a real Linux app (AppImage / .deb)

```bash
npx electron-builder
```

Output lands in `dist/`. Edit `build.linux` in `package.json` if you want other targets (`pacman`, `rpm`, `snap`, etc. are supported by electron-builder — see their docs).

## Project structure

```
niko-files/
  package.json
  src/
    main.js            # Electron main process: filesystem + PTY IPC
    preload.js          # contextBridge: safe API exposed to the UI
    renderer/
      index.html
      style.css
      renderer.js        # all UI logic
```

## Changelog

**1.1.0 — debugging pass**
- Fixed: terminal resize wasn't reaching the actual shell, so full-screen programs (vim, htop, less) wrapped against stale dimensions
- Fixed: right-click "Move to Trash" only deleted the item you clicked, dropping the rest of a multi-selection
- Fixed: right-clicking empty space showed the same menu as right-clicking a file, including "Rename"/"Trash" on the folder you're currently browsing
- Fixed: pasting a copy over a same-named file silently overwrote it — now auto-renames to "name (copy)", "name (copy 2)", etc., like Nautilus/Files
- Fixed: a folder name containing `"` could break out of the terminal's `cd` command
- Fixed: permission-denied or missing folders failed silently with no feedback — now shows an error banner
- Added: real Copy / Cut / Paste (toolbar right-click menu + Ctrl+C / Ctrl+X / Ctrl+V), backed by a new move (cut) IPC handler
- Added: "New folder" and "Paste" in the background right-click menu
- Added: `.gitignore` for `node_modules/` and `dist/`

## Where to take it next

Ideas that fit naturally on top of this foundation:
- Dual-pane mode (second `renderer` pane + its own history stack)
- Full-text content search via `ripgrep`
- Archive browsing (shell out to `bsdtar`/`unzip -l`)
- Drag files from the file list straight into the terminal to insert their path
- Git status badges (shell out to `git status --porcelain` per directory)
- A proper icon set / thumbnail generation for images and PDFs

Have fun with it — it's yours to extend.


## Niko Files 2.1

### Appearance customization
- New geometric owl logo supplied for Niko Files branding.
- Material-inspired blue/purple visual refresh.
- **Text Size** setting: 11–20 px.
- **Icon Size** setting: 16–40 px.
- Preferences are persisted locally between launches.
- Open Appearance with the gear button or **Ctrl+,**.

The settings dialog includes a reset-to-default action and a live preview.
