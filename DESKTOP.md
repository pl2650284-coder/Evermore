# Tauri desktop build

The desktop shell is Tauri 2. The Next.js UI is exported to static files, while
the existing Express/SQLite API runs as a bundled Node sidecar. Tauri uses the
system WebView2 runtime instead of shipping Chromium, so users do not need to
install Node.js or npm.

## Requirements

- Node.js 22 or newer (development/build only)
- Rust with the `x86_64-pc-windows-msvc` target
- WebView2 Runtime on Windows (Windows 10 and newer normally include it)

Install JavaScript dependencies, then start the desktop app in development:

```powershell
npm install
npm run desktop
```

The Tauri build command creates an NSIS Windows installer in
`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`:

```powershell
npm run dist:win
```

`npm run build:desktop` only creates the static Next.js export. The Tauri build
hook stages that export, the API, its production dependencies, and the current
Node runtime under `src-tauri/resources/` before packaging them.

The local API stores `love-museum.sqlite`, `secret.key`, and `uploads/` in
Tauri's per-user application data directory. Back up the whole directory,
including SQLite `-wal` and `-shm` files, while the app is closed. On Windows,
the app automatically keeps using `%APPDATA%\Love Museum` when it contains an
Electron database and the new Tauri data directory has no database yet. Data
from the old portable app's adjacent `LoveMuseumData/` directory must still be
copied manually after making a backup.

The API test does not open a window and is useful for validating the local data
layer independently:

```powershell
npm run test:desktop-api
```
