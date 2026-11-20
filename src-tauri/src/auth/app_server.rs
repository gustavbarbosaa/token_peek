use super::models::AccountStatus;
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::mpsc::{self, Receiver};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::State;

const RESPONSE_TIMEOUT: Duration = Duration::from_secs(20);

pub struct AuthState {
    home: PathBuf,
    server: Mutex<Option<CodexAppServer>>,
}

impl AuthState {
    pub fn new(home: PathBuf) -> Self {
        Self {
            home,
            server: Mutex::new(None),
        }
    }
}

pub(super) struct CodexAppServer {
    child: Child,
    stdin: ChildStdin,
    messages: Receiver<Value>,
    pending: VecDeque<Value>,
    next_id: u64,
}

impl CodexAppServer {
    fn start(home: &PathBuf) -> Result<Self, String> {
        let mut child = Command::new("codex")
            .args([
                "app-server",
                "--listen",
                "stdio://",
                "-c",
                "cli_auth_credentials_store=\"auto\"",
            ])
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
                    if sender.send(message).is_err() {
                        break;
                    }
                }
            }
        });

        let mut server = Self {
            child,
            stdin,
            messages,
            pending: VecDeque::new(),
            next_id: 1,
        };
        server.request(
            "initialize",
            json!({
                "clientInfo": {
                    "name": "token_peek",
                    "title": "Token Peek",
                    "version": env!("CARGO_PKG_VERSION")
                }
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
        let id = self.next_id;
        self.next_id += 1;
        self.send(json!({ "method": method, "id": id, "params": params }))?;

        if let Some(message) = self.take_pending_response(id) {
            return Self::result(message);
        }

        loop {
            let message = self
                .messages
                .recv_timeout(RESPONSE_TIMEOUT)
                .map_err(|_| "O Codex app-server não respondeu a tempo.".to_string())?;
            if message.get("id").and_then(Value::as_u64) == Some(id) {
                return Self::result(message);
            }

            // Retain login completion and account notifications while other calls are in flight.
            if self.pending.len() == 64 {
                self.pending.pop_front();
            }
            self.pending.push_back(message);
        }
    }

    fn take_pending_response(&mut self, id: u64) -> Option<Value> {
        let position = self
            .pending
            .iter()
            .position(|message| message.get("id").and_then(Value::as_u64) == Some(id))?;
        self.pending.remove(position)
    }

    fn result(message: Value) -> Result<Value, String> {
        if message.get("error").is_some() {
            return Err("O Codex recusou a solicitação. Tente novamente ou reconecte a conta."
                .to_string());
        }
        message
            .get("result")
            .cloned()
            .ok_or_else(|| "O Codex retornou uma resposta inválida.".to_string())
    }

    pub(super) fn account_status(&mut self) -> Result<AccountStatus, String> {
        let response = self.request("account/read", json!({ "refreshToken": false }))?;
        let account = response.get("account");
        let connected = account
            .and_then(|value| value.get("type"))
            .and_then(Value::as_str)
            == Some("chatgpt");

        Ok(AccountStatus {
            connected,
            email: connected
                .then(|| account?.get("email")?.as_str().map(str::to_owned))
                .flatten(),
            plan_type: connected
                .then(|| account?.get("planType")?.as_str().map(str::to_owned))
                .flatten(),
        })
    }
}

impl Drop for CodexAppServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub(super) fn with_server<T>(
    state: &State<'_, AuthState>,
    operation: impl FnOnce(&mut CodexAppServer) -> Result<T, String>,
) -> Result<T, String> {
    let mut server = state
        .server
        .lock()
        .map_err(|_| "O estado de autenticação ficou indisponível.".to_string())?;
    if server
        .as_mut()
        .is_some_and(|process| process.child.try_wait().ok().flatten().is_some())
    {
        *server = None;
    }
    if server.is_none() {
        *server = Some(CodexAppServer::start(&state.home)?);
    }
    let server = server
        .as_mut()
        .ok_or_else(|| "Não foi possível iniciar o Codex app-server.".to_string())?;
    operation(server)
}
