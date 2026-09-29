#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, OpenOptions},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};

use tauri::{
    utils::config::Color, webview::PageLoadEvent, AppHandle, Manager, RunEvent, WebviewUrl,
    WebviewWindowBuilder,
};
use url::Url;

const DEV_URL: &str = "http://127.0.0.1:3000";
const HOST: &str = "127.0.0.1";
const DESKTOP_PORT: u16 = 38489;

struct BackendProcess(Mutex<Option<Child>>);

#[cfg(windows)]
fn show_startup_error(message: &str) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let title: Vec<u16> = "Love Museum".encode_utf16().chain([0]).collect();
    let message: Vec<u16> = message.encode_utf16().chain([0]).collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONERROR,
        );
    }
}

#[cfg(not(windows))]
fn show_startup_error(message: &str) {
    eprintln!("{message}");
}

fn available_port() -> std::io::Result<u16> {
    let listener =
        TcpListener::bind((HOST, DESKTOP_PORT)).or_else(|_| TcpListener::bind((HOST, 0)))?;
    Ok(listener.local_addr()?.port())
}

fn wait_for_server(child: &mut Child, port: u16) -> Result<(), String> {
    for _ in 0..120 {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!("Local API exited before startup ({status})."));
        }

        if TcpStream::connect((HOST, port)).is_ok() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(100));
    }

    Err(format!(
        "Local API did not start on {HOST}:{port} within 12 seconds."
    ))
}

fn resource_path(app: &AppHandle, relative: &str) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map_err(|error| error.to_string())
        .map(|root| root.join("resources").join(relative))
}

fn runtime_path(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates = if cfg!(windows) {
        vec!["node-runtime.exe", "node-runtime"]
    } else {
        vec!["node-runtime", "node-runtime.exe"]
    };

    for candidate in candidates {
        let path = resource_path(app, candidate)?;
        if path.is_file() {
            return Ok(path);
        }
    }

    Err("Bundled Node runtime is missing from the application resources.".into())
}

fn select_data_directory(current: &Path, legacy: Option<&Path>) -> PathBuf {
    if current.join("love-museum.sqlite").is_file() {
        return current.to_path_buf();
    }

    legacy
        .filter(|path| path.join("love-museum.sqlite").is_file())
        .unwrap_or(current)
        .to_path_buf()
}

fn default_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let current = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;

    #[cfg(windows)]
    {
        let legacy = app
            .path()
            .data_dir()
            .map_err(|error| error.to_string())?
            .join("Love Museum");
        return Ok(select_data_directory(&current, Some(&legacy)));
    }

    #[cfg(not(windows))]
    Ok(current)
}

fn start_backend(app: &AppHandle) -> Result<(Child, Url), String> {
    let runtime = runtime_path(app)?;
    let backend_directory = resource_path(app, "backend")?;
    let backend_script = backend_directory.join("desktop-server.js");
    let frontend_directory = resource_path(app, "out")?;

    if !backend_script.is_file() || !frontend_directory.join("index.html").is_file() {
        return Err("Bundled backend or frontend resources are missing.".into());
    }

    let data_directory = match std::env::var_os("LOVE_MUSEUM_DATA_DIR") {
        Some(path) => PathBuf::from(path),
        None => default_data_directory(app)?,
    };
    fs::create_dir_all(&data_directory).map_err(|error| error.to_string())?;

    let port = available_port().map_err(|error| error.to_string())?;
    let log_path = data_directory.join("backend.log");
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|error| error.to_string())?;
    let error_log = log.try_clone().map_err(|error| error.to_string())?;
    let mut command = Command::new(runtime);
    command
        .current_dir(backend_directory)
        .arg("desktop-server.js")
        .env("LOVE_MUSEUM_DATA_DIR", &data_directory)
        .env("FRONTEND_DIR", &frontend_directory)
        .env("PORT", port.to_string())
        .env("HOST", HOST)
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(error_log));

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }

    let mut child = command.spawn().map_err(|error| error.to_string())?;
    if let Err(error) = wait_for_server(&mut child, port) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(format!("{error} See {} for details.", log_path.display()));
    }

    let url = Url::parse(&format!("http://{HOST}:{port}")).map_err(|error| error.to_string())?;
    Ok((child, url))
}

fn stop_backend(state: &BackendProcess) {
    if let Ok(mut process) = state.0.lock() {
        if let Some(mut child) = process.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn create_window(app: &AppHandle, url: Url) -> tauri::Result<()> {
    let allowed_origin = url.origin();

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .on_navigation(move |target| {
            target.scheme() == "about" || target.origin() == allowed_origin
        })
        .on_page_load(|window, payload| {
            if payload.event() == PageLoadEvent::Finished {
                let _ = window.show();
            }
        })
        .title("Love Museum")
        .inner_size(1440.0, 900.0)
        .min_inner_size(960.0, 640.0)
        .background_color(Color(255, 247, 251, 255))
        .resizable(true)
        .visible(false)
        .center()
        .build()?;
    Ok(())
}

fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let backend = BackendProcess(Mutex::new(None));
            app.manage(backend);

            if cfg!(debug_assertions) {
                create_window(app.handle(), Url::parse(DEV_URL).expect("valid dev URL"))?;
            } else {
                let (child, url) = start_backend(app.handle()).map_err(|error| {
                    show_startup_error(&format!("Love Museum could not start.\n\n{error}"));
                    tauri::Error::Anyhow(anyhow::anyhow!(error))
                })?;
                if let Some(state) = app.try_state::<BackendProcess>() {
                    if let Ok(mut process) = state.0.lock() {
                        *process = Some(child);
                    }
                }
                create_window(app.handle(), url)?;
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .map_err(|error| tauri::Error::Anyhow(anyhow::anyhow!(error)))
        .map(|app| {
            app.run(|handle, event| {
                if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                    if let Some(state) = handle.try_state::<BackendProcess>() {
                        stop_backend(&state);
                    }
                }
            });
        })
}

fn main() {
    if let Err(error) = run() {
        eprintln!("Failed to start Love Museum: {error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::select_data_directory;
    use std::{fs, path::PathBuf};

    fn test_directory(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("love-museum-{name}-{}", std::process::id()))
    }

    #[test]
    fn reuses_legacy_database_when_current_database_is_missing() {
        let root = test_directory("legacy-fallback");
        let current = root.join("current");
        let legacy = root.join("legacy");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("love-museum.sqlite"), []).unwrap();

        assert_eq!(select_data_directory(&current, Some(&legacy)), legacy);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn prefers_current_database_when_both_databases_exist() {
        let root = test_directory("current-precedence");
        let current = root.join("current");
        let legacy = root.join("legacy");
        fs::create_dir_all(&current).unwrap();
        fs::create_dir_all(&legacy).unwrap();
        fs::write(current.join("love-museum.sqlite"), []).unwrap();
        fs::write(legacy.join("love-museum.sqlite"), []).unwrap();

        assert_eq!(select_data_directory(&current, Some(&legacy)), current);
        fs::remove_dir_all(root).unwrap();
    }
}
