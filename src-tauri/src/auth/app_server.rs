use super::models::{AccountStatus, UsageLimit, UsageSnapshot};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const RESPONSE_TIMEOUT: Duration = Duration::from_secs(20);

#[cfg(target_os = "linux")]
const AUTH_STORAGE: &str = "cli_auth_credentials_store=\"file\"";

#[cfg(not(target_os = "linux"))]
const AUTH_STORAGE: &str = "cli_auth_credentials_store=\"auto\"";

fn codex_executable() -> PathBuf {
    #[cfg(target_os = "linux")]
    if std::env::var("SNAP_NAME").as_deref() == Ok("token-peek") {
        if let Some(root) = std::env::var_os("SNAP") {
            return PathBuf::from(root).join("usr/bin/codex");
        }
    }
    if let Some(path) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path) {
            let candidate = directory.join("codex");
            if candidate.is_file() {
                return candidate;
            }
        }
    }

    #[cfg(target_os = "linux")]
    if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        let local_install = home.join(".local/bin/codex");
        if local_install.is_file() {
            return local_install;
        }

        let node_versions = home.join(".nvm/versions/node");
        if let Ok(versions) = std::fs::read_dir(node_versions) {
            let mut candidates: Vec<PathBuf> = versions
                .flatten()
                .map(|entry| entry.path().join("bin/codex"))
                .filter(|path| path.is_file())
                .collect();
            candidates.sort();
            if let Some(candidate) = candidates.pop() {
                return candidate;
            }
        }
    }

    Path::new("codex").to_path_buf()
}

pub(super) struct CodexAppServer {
    child: Child,
    stdin: ChildStdin,
    messages: Receiver<Value>,
    next_id: u64,
    connected: Option<bool>,
    pub(super) login_url: Option<String>,
}

impl CodexAppServer {
    pub(super) fn start(home: &Path, app: AppHandle) -> Result<Self, String> {
        let mut child = Command::new(codex_executable())
            .args(["app-server", "--listen", "stdio://", "-c", AUTH_STORAGE])
            .env("CODEX_HOME", home)
            .current_dir(home)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // App-server output can contain sensitive account information. Do not log it.
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| {
                "Não encontrei o Codex CLI. Instale-o e verifique se `codex` está no PATH."
                    .to_string()
            })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Não foi possível abrir a entrada do Codex app-server.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Não foi possível abrir a saída do Codex app-server.".to_string())?;
        let (sender, messages) = mpsc::channel();

        thread::spawn(move || {
            for line in BufReader::new(stdout).lines() {
                let Ok(line) = line else { break };
                if let Ok(message) = serde_json::from_str::<Value>(&line) {
                    let is_usage_update = message.get("method").and_then(Value::as_str)
                        == Some("account/rateLimits/updated");
                    let limit_id = message
                        .get("params")
                        .and_then(|params| params.get("rateLimits"))
                        .and_then(|limits| limits.get("limitId"))
                        .and_then(Value::as_str);
                    if is_usage_update && limit_id.is_none_or(|id| id == "codex") {
                        let _ = app.emit("usage-changed", ());
                    }
                    if message.get("method").is_none() && sender.send(message).is_err() {
                        break;
                    }
                }
            }
        });

        let mut server = Self {
            child,
            stdin,
            messages,
            next_id: 1,
            connected: None,
            login_url: None,
        };
        server.request(
            "initialize",
            json!({
                "clientInfo": {
                    "name": "token_peek",
                    "title": "Token Peek",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "capabilities": { "experimentalApi": true }
            }),
        )?;
        server.notify("initialized", json!({}))?;
        Ok(server)
    }

    fn send(&mut self, message: Value) -> Result<(), String> {
        serde_json::to_writer(&mut self.stdin, &message)
            .map_err(|_| "Não foi possível enviar uma solicitação ao Codex.".to_string())?;
        self.stdin
            .write_all(b"\n")
            .and_then(|_| self.stdin.flush())
            .map_err(|_| "A conexão com o Codex app-server foi encerrada.".to_string())
    }

    fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        self.send(json!({ "method": method, "params": params }))
    }

    pub(super) fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        Self::result(method, self.request_raw(method, params)?)
    }

    fn request_raw(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let deadline = Instant::now() + RESPONSE_TIMEOUT;
        self.send(json!({ "method": method, "id": id, "params": params }))?;

        while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
            match self.messages.recv_timeout(remaining) {
                Ok(message) if message.get("id").and_then(Value::as_u64) == Some(id) => {
                    return Ok(message);
                }
                Ok(_) => continue,
                Err(mpsc::RecvTimeoutError::Timeout) => break,
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("A conexão com o Codex app-server foi encerrada.".to_string());
                }
            }
        }
        Err("O Codex app-server não respondeu a tempo.".to_string())
    }

    pub(super) fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    fn result(method: &str, message: Value) -> Result<Value, String> {
        if let Some(error) = message.get("error") {
            let code = error.get("code").and_then(Value::as_i64);
            if method == "account/login/start" {
                return Err(super::login::request_error(
                    code,
                    error.get("message").and_then(Value::as_str),
                ));
            }
            if method == "account/rateLimits/read" {
                return Err(super::rpc_error::limits_message(error));
            }
            let action = match method {
                "initialize" => "iniciar a comunicação",
                "account/read" => "consultar a conta",
                "account/logout" => "desconectar a conta",
                "account/login/cancel" => "cancelar a conexão",
                _ => "processar a solicitação",
            };
            let detail = code
                .map(|code| format!(" (código {code})"))
                .unwrap_or_default();
            return Err(format!("O Codex não conseguiu {action}{detail}."));
        }
        message
            .get("result")
            .cloned()
            .ok_or_else(|| "O Codex retornou uma resposta inválida.".to_string())
    }

    fn read_account(&mut self, refresh_token: bool) -> Result<Value, String> {
        let response = self.request("account/read", json!({ "refreshToken": refresh_token }))?;
        self.connected =
            Some(response.pointer("/account/type").and_then(Value::as_str) == Some("chatgpt"));
        Ok(response)
    }

    pub(super) fn logout(&mut self) -> Result<(), String> {
        self.request("account/logout", json!({}))?;
        self.connected = Some(false);
        Ok(())
    }

    pub(super) fn account_status(&mut self) -> Result<AccountStatus, String> {
        let response = self.read_account(false)?;
        let account = response.get("account");
        let connected = self.connected == Some(true);
        if connected {
            self.login_url = None;
        }
        let workspace_name = connected
            .then(|| {
                account
                    .and_then(|value| value.get("workspaceName"))
                    .and_then(Value::as_str)
                    .map(str::trim)
                    .filter(|name| !name.is_empty())
                    .map(str::to_owned)
            })
            .flatten();
        let name = if connected {
            self.account_display_name().or(workspace_name)
        } else {
            None
        };

        Ok(AccountStatus {
            connected,
            name,
            email: connected
                .then(|| account?.get("email")?.as_str().map(str::to_owned))
                .flatten(),
            plan_type: connected
                .then(|| account?.get("planType")?.as_str().map(str::to_owned))
                .flatten(),
        })
    }

    fn account_display_name(&mut self) -> Option<String> {
        let response = self.request("accountSession/list", json!({})).ok()?;
        let sessions = response.get("sessions")?.as_array()?;
        let active_session_id = response.get("activeSessionId").and_then(Value::as_str);
        let active_session = sessions
            .iter()
            .find(|session| {
                active_session_id
                    .is_some_and(|id| session.get("sessionId").and_then(Value::as_str) == Some(id))
            })
            .or_else(|| {
                sessions
                    .iter()
                    .find(|session| session.get("isActive").and_then(Value::as_bool) == Some(true))
            })
            .or_else(|| sessions.first())?;

        active_session
            .get("displayName")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(str::to_owned)
    }

    pub(super) fn usage_snapshot(&mut self) -> Result<UsageSnapshot, String> {
        if self.connected.is_none() {
            self.read_account(false)?;
        }
        if self.connected != Some(true) {
            return Err("Conecte sua conta para consultar o consumo.".to_string());
        }
        const METHOD: &str = "account/rateLimits/read";
        let mut reply = self.request_raw(METHOD, json!({}))?;
        if reply
            .get("error")
            .is_some_and(super::rpc_error::session_rejected)
        {
            // Renove apenas quando a consulta for rejeitada por autenticação.
            self.read_account(true)?;
            if self.connected != Some(true) {
                return Err(
                    "A sessão do Codex expirou. Reconecte a conta nas preferências.".into(),
                );
            }
            reply = self.request_raw(METHOD, json!({}))?;
        }
        let response = Self::result(METHOD, reply)?;
        let snapshot = response
            .get("rateLimitsByLimitId")
            .and_then(|limits| limits.get("codex"))
            .or_else(|| response.get("rateLimits"))
            .ok_or_else(|| "O Codex não retornou os limites da conta.".to_string())?;

        let mut limits = Vec::new();
        for (window, key) in [("primary", "primary"), ("secondary", "secondary")] {
            if let Some(value) = snapshot.get(key) {
                let Some(used_percent) =
                    value
                        .get("usedPercent")
                        .and_then(Value::as_i64)
                        .or_else(|| {
                            value
                                .get("usedPercent")
                                .and_then(Value::as_f64)
                                .map(|percent| percent.round() as i64)
                        })
                else {
                    continue;
                };

                limits.push(UsageLimit {
                    window: window.to_string(),
                    used_percent: used_percent.clamp(0, 100) as i32,
                    window_duration_mins: value.get("windowDurationMins").and_then(Value::as_i64),
                    resets_at: value.get("resetsAt").and_then(Value::as_i64),
                });
            }
        }

        Ok(UsageSnapshot {
            limits,
            updated_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|duration| duration.as_secs() as i64)
                .unwrap_or_default(),
        })
    }
}

impl Drop for CodexAppServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
