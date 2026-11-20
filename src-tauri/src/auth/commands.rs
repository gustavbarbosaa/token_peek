use super::login::{self, LoginMethod};
use super::models::{AccountStatus, LoginPrompt, UsageSnapshot};
use super::worker::AuthState;
use serde_json::json;
use std::process::{Command, Stdio};
use tauri::State;

#[tauri::command]
pub async fn auth_account_status(state: State<'_, AuthState>) -> Result<AccountStatus, String> {
    state
        .run(|server, app| {
            let status = server.account_status()?;
            if !status.connected {
                crate::tray::clear_usage(app);
            }
            Ok(status)
        })
        .await
}

#[tauri::command]
pub async fn usage_read(state: State<'_, AuthState>) -> Result<UsageSnapshot, String> {
    state
        .run(|server, app| {
            let snapshot = server.usage_snapshot()?;
            crate::tray::update_usage(app, &snapshot);
            Ok(snapshot)
        })
        .await
}

#[tauri::command]
pub async fn auth_start(
    method: LoginMethod,
    state: State<'_, AuthState>,
) -> Result<LoginPrompt, String> {
    state
        .run(move |server, _| login::start(server, method))
        .await
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AuthState>) -> Result<AccountStatus, String> {
    state
        .run(|server, app| {
            server.logout()?;
            crate::tray::clear_usage(app);
            Ok(AccountStatus {
                connected: false,
                name: None,
                email: None,
                plan_type: None,
            })
        })
        .await
}

#[tauri::command]
pub async fn auth_cancel(login_id: String, state: State<'_, AuthState>) -> Result<(), String> {
    state
        .run(move |server, _| {
            server.request("account/login/cancel", json!({ "loginId": login_id }))?;
            server.login_url = None;
            Ok(())
        })
        .await
}

#[tauri::command]
pub async fn auth_open_verification_page(state: State<'_, AuthState>) -> Result<(), String> {
    let url = state
        .run(|server, _| {
            server.login_url.clone().ok_or_else(|| {
                "Inicie a conexão novamente para abrir a página da OpenAI.".to_string()
            })
        })
        .await?;
    open_browser(&url)
}

fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(url)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }
}
