#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod tray;

use std::fs;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            auth::auth_account_status,
            auth::auth_start,
            auth::auth_cancel,
            auth::auth_logout,
            auth::auth_open_verification_page
        ])
        .setup(|app| {
            let auth_home = app.path().app_data_dir()?.join("codex");
            fs::create_dir_all(&auth_home)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&auth_home, fs::Permissions::from_mode(0o700))?;
            }
            app.manage(auth::AuthState::new(auth_home));
            tray::setup(app)?;
            Ok(())
        })
        .on_window_event(tray::handle_window_event)
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar Token Peek");
}
