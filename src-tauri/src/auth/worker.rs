use super::app_server::CodexAppServer;
use std::{path::PathBuf, thread};
use tauri::{
    async_runtime::{channel, Sender},
    AppHandle,
};

type Job = Box<dyn FnOnce(&mut Option<CodexAppServer>, &PathBuf, &AppHandle) + Send>;

pub struct AuthState {
    jobs: Sender<Job>,
}

impl AuthState {
    pub fn new(home: PathBuf, app: AppHandle) -> std::io::Result<Self> {
        let (jobs, mut queue) = channel::<Job>(8);
        thread::Builder::new()
            .name("codex-worker".into())
            .spawn(move || {
                let mut server = None;
                while let Some(job) = queue.blocking_recv() {
                    job(&mut server, &home, &app);
                }
            })?;
        Ok(Self { jobs })
    }

    pub(super) async fn run<T: Send + 'static>(
        &self,
        operation: impl FnOnce(&mut CodexAppServer, &AppHandle) -> Result<T, String> + Send + 'static,
    ) -> Result<T, String> {
        let (response, mut result) = channel(1);
        self.jobs
            .try_send(Box::new(move |server, home, app| {
                if response.is_closed() {
                    return;
                }
                let value = (|| {
                    if server.as_mut().is_some_and(|server| !server.is_running()) {
                        *server = None;
                    }
                    if server.is_none() {
                        *server = Some(CodexAppServer::start(home, app.clone())?);
                    }
                    let server = server.as_mut().ok_or("O Codex não foi iniciado.")?;
                    operation(server, app)
                })();
                let _ = response.try_send(value);
            }))
            .map_err(|_| "A comunicação com o Codex está ocupada ou indisponível.".to_string())?;
        result
            .recv()
            .await
            .ok_or_else(|| "A comunicação com o Codex foi encerrada.".to_string())?
    }
}
