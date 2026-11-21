#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod tray;

use std::fs;
use tauri::Manager;

#[tauri::command]
fn uses_system_shortcut() -> bool {
    cfg!(target_os = "linux")
        && (std::env::var("XDG_SESSION_TYPE")
            .is_ok_and(|value| value.eq_ignore_ascii_case("wayland"))
            || std::env::var_os("WAYLAND_DISPLAY").is_some_and(|value| !value.is_empty()))
}

fn main() {
    let autostart = tauri_plugin_autostart::Builder::new();
    #[cfg(target_os = "linux")]
    let autostart = if std::env::var("SNAP_NAME").as_deref() == Ok("token-peek") {
        autostart.app_name("token-peek")
    } else {
        autostart
    };
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let handle = app.clone();
            let _ = app.run_on_main_thread(move || tray::show_usage(&handle));
        }))
        .plugin(autostart.build());
    let builder = if uses_system_shortcut() {
        builder
    } else {
        builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let handle = app.clone();
                        let _ = app.run_on_main_thread(move || tray::show_usage(&handle));
                    }
                })
                .build(),
        )
    };
    builder
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            auth::commands::auth_account_status,
            auth::commands::auth_start,
            auth::commands::auth_cancel,
            auth::commands::auth_logout,
            auth::commands::auth_open_verification_page,
            auth::commands::usage_read,
            uses_system_shortcut
        ])
        .setup(|app| {
            let auth_home = app.path().app_data_dir()?.join("codex");
            fs::create_dir_all(&auth_home)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&auth_home, fs::Permissions::from_mode(0o700))?;
            }
            app.manage(auth::AuthState::new(auth_home, app.handle().clone())?);
            tray::setup(app)?;
            Ok(())
        })
        .on_window_event(tray::handle_window_event)
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar Token Peek");
}
