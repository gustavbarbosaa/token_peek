use super::app_server::{with_server, AuthState};
use super::models::{AccountStatus, LoginPrompt};
use serde_json::{json, Value};
use std::process::Command;
use tauri::State;

#[tauri::command]
pub fn auth_account_status(state: State<'_, AuthState>) -> Result<AccountStatus, String> {
    with_server(&state, |server| server.account_status())
}

#[tauri::command]
pub fn auth_start(state: State<'_, AuthState>) -> Result<LoginPrompt, String> {
    with_server(&state, |server| {
        let response = server.request(
            "account/login/start",
            json!({ "type": "chatgptDeviceCode" }),
        )?;
        let login_id = response
            .get("loginId")
            .and_then(Value::as_str)
            .ok_or_else(|| "O Codex não iniciou o login.".to_string())?;
        let verification_url = response
            .get("verificationUrl")
            .and_then(Value::as_str)
            .filter(|url| *url == "https://auth.openai.com/codex/device")
            .ok_or_else(|| "O Codex retornou um endereço de login inesperado.".to_string())?;
        let user_code = response
            .get("userCode")
            .and_then(Value::as_str)
            .ok_or_else(|| "O Codex não retornou o código de verificação.".to_string())?;

        Ok(LoginPrompt {
            login_id: login_id.to_owned(),
            verification_url: verification_url.to_owned(),
            user_code: user_code.to_owned(),
        })
    })
}

#[tauri::command]
pub fn auth_logout(state: State<'_, AuthState>) -> Result<AccountStatus, String> {
    with_server(&state, |server| {
        server.request("account/logout", json!({}))?;
        server.account_status()
    })
}

#[tauri::command]
pub fn auth_cancel(login_id: String, state: State<'_, AuthState>) -> Result<(), String> {
    with_server(&state, |server| {
        server.request("account/login/cancel", json!({ "loginId": login_id }))?;
        Ok(())
    })
}

#[tauri::command]
pub fn auth_open_verification_page() -> Result<(), String> {
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg("https://auth.openai.com/codex/device")
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("https://auth.openai.com/codex/device")
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32")
            .args([
                "url.dll,FileProtocolHandler",
                "https://auth.openai.com/codex/device",
            ])
            .spawn()
            .map(|_| ())
            .map_err(|_| "Não foi possível abrir o navegador do sistema.".to_string())
    }
}
