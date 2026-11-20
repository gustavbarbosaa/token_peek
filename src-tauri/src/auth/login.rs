use super::{app_server::CodexAppServer, models::LoginPrompt};
use serde::Deserialize;
use serde_json::{json, Value};
use tauri::Url;

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoginMethod {
    Browser,
    Device,
}

pub(super) fn start(
    server: &mut CodexAppServer,
    method: LoginMethod,
) -> Result<LoginPrompt, String> {
    let (kind, url_field, expected_path) = match method {
        LoginMethod::Browser => ("chatgpt", "authUrl", "/oauth/authorize"),
        LoginMethod::Device => ("chatgptDeviceCode", "verificationUrl", "/codex/device"),
    };
    let response = server.request("account/login/start", json!({ "type": kind }))?;
    let login_id =
        field(&response, "loginId").ok_or_else(|| "O Codex não iniciou a conexão.".to_string())?;
    let result = (|| {
        let url = field(&response, url_field)
            .and_then(|value| Url::parse(value).ok())
            .filter(|url| {
                url.scheme() == "https"
                    && url.host_str() == Some("auth.openai.com")
                    && url.port().is_none()
                    && url.username().is_empty()
                    && url.password().is_none()
                    && url.path() == expected_path
                    && url.fragment().is_none()
            })
            .ok_or_else(|| "O Codex retornou um endereço de login inesperado.".to_string())?;
        let user_code = match method {
            LoginMethod::Browser => None,
            LoginMethod::Device => Some(
                field(&response, "userCode")
                    .ok_or_else(|| "O Codex não retornou o código de verificação.".to_string())?
                    .to_owned(),
            ),
        };
        server.login_url = Some(url.into());
        Ok(LoginPrompt {
            login_id: login_id.to_owned(),
            user_code,
        })
    })();
    if result.is_err() {
        let _ = server.request("account/login/cancel", json!({ "loginId": login_id }));
    }
    result
}

fn field<'a>(response: &'a Value, name: &str) -> Option<&'a str> {
    response
        .get(name)?
        .as_str()
        .filter(|value| !value.is_empty())
}

pub(super) fn request_error(code: Option<i64>, detail: Option<&str>) -> String {
    let detail = detail.unwrap_or_default().to_ascii_lowercase();
    if detail.contains("device code")
        && (detail.contains("not enabled") || detail.contains("disabled"))
    {
        return "O login por código está desabilitado. Tente entrar pelo navegador ou habilite o login por código nas configurações de segurança da conta ou do espaço de trabalho.".into();
    }
    if detail.contains("unknown variant") || code == Some(-32601) {
        return "O Codex CLI não reconhece esse modo de login. Atualize o Codex CLI e reabra o Token Peek.".into();
    }
    if detail.contains("error sending request")
        || detail.contains("timed out")
        || detail.contains("certificate")
    {
        return "O Codex não conseguiu acessar o serviço de login. Verifique sua conexão e tente novamente.".into();
    }
    if detail.contains("address already in use") {
        return "A porta local de login do Codex está ocupada. Encerre outra tentativa de login ou use o código de dispositivo.".into();
    }
    match code {
        Some(code) => format!(
            "O Codex recusou o início da conexão (código {code}). Tente outro modo de login."
        ),
        None => "O Codex recusou o início da conexão. Tente outro modo de login.".into(),
    }
}
