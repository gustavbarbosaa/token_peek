use serde_json::Value;

fn message(error: &Value) -> String {
    error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase()
}

pub(super) fn session_rejected(error: &Value) -> bool {
    let message = message(error);
    message.contains("401 unauthorized")
        || message.contains("status 401")
        || message.contains("token_expired")
        || message.contains("token_revoked")
}

pub(super) fn limits_message(error: &Value) -> String {
    if session_rejected(error) {
        return "O serviço do Codex recusou a sessão. Reconecte a conta nas preferências.".into();
    }

    let message = message(error);
    if message.contains("403 forbidden") || message.contains("status 403") {
        return "O serviço do Codex negou acesso aos limites dessa conta. Confira o espaço de trabalho conectado e suas permissões.".into();
    }
    if message.contains("error sending request")
        || message.contains("timed out")
        || message.contains("certificate")
        || message.contains("connection refused")
    {
        return "Não foi possível acessar o serviço de limites do Codex. Confira a conexão. O Token Peek tenta novamente ao voltar para a janela.".into();
    }
    if let Some(code) = error.get("code").and_then(Value::as_i64) {
        format!("A sessão foi reconhecida, mas o Codex não retornou os limites (código {code}). Tente novamente ao reabrir o painel.")
    } else {
        "O Codex não retornou os limites. Tente novamente ao reabrir o painel.".into()
    }
}
