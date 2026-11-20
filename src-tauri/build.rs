fn main() {
    let commands = tauri_build::AppManifest::new().commands(&[
        "auth_account_status",
        "auth_start",
        "auth_cancel",
        "auth_logout",
        "auth_open_verification_page",
        "usage_read",
        "uses_system_shortcut",
    ]);
    let attributes = tauri_build::Attributes::new().app_manifest(commands);
    tauri_build::try_build(attributes).expect("Não foi possível configurar as permissões do Tauri");
}
