use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, WindowEvent, Wry,
};

use crate::auth::{UsageLimit, UsageSnapshot};

struct UsageMenuItems {
    primary: MenuItem<Wry>,
    secondary: MenuItem<Wry>,
}

impl UsageMenuItems {
    fn update(&self, limits: &[UsageLimit]) {
        let primary = limits.iter().find(|limit| limit.window == "primary");
        let secondary = limits.iter().find(|limit| limit.window == "secondary");

        let _ = self.primary.set_text(format_usage(primary, "Janela atual"));
        let _ = self
            .secondary
            .set_text(format_usage(secondary, "Janela secundária"));
    }
}

fn format_usage(limit: Option<&UsageLimit>, fallback: &str) -> String {
    let Some(limit) = limit else {
        return format!("{fallback} · sem dados");
    };

    let duration = match limit.window_duration_mins {
        Some(minutes) if minutes % (7 * 24 * 60) == 0 => {
            format!("{} d", minutes / (24 * 60))
        }
        Some(minutes) if minutes % (24 * 60) == 0 => format!("{} d", minutes / (24 * 60)),
        Some(minutes) if minutes % 60 == 0 => format!("{} h", minutes / 60),
        Some(minutes) => format!("{minutes} min"),
        None => fallback.to_string(),
    };
    let used = limit.used_percent.clamp(0, 100);
    let filled = ((used + 9) / 10) as usize;
    let bar = format!("{}{}", "█".repeat(filled), "░".repeat(10 - filled));

    format!("{duration} [{bar}] {used}% usado")
}

pub fn update_usage(app: &AppHandle, snapshot: &UsageSnapshot) {
    if let Some(items) = app.try_state::<UsageMenuItems>() {
        items.update(&snapshot.limits);
    }
}

pub fn clear_usage(app: &AppHandle) {
    if let Some(items) = app.try_state::<UsageMenuItems>() {
        items.update(&[]);
    }
}

pub fn show_usage(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
            eprintln!("Não foi possível exibir o painel: {error}");
            return;
        }
        let _ = window.unminimize();
        let _ = window.set_focus();
        let _ = app.emit_to("main", "show-usage-view", ());
    }
}

pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let primary = MenuItem::with_id(
        app,
        "usage-primary",
        "Janela atual · aguardando dados",
        false,
        None::<&str>,
    )?;
    let secondary = MenuItem::with_id(
        app,
        "usage-secondary",
        "Janela secundária · aguardando dados",
        false,
        None::<&str>,
    )?;
    let open = MenuItem::with_id(app, "open", "Abrir painel completo", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&primary, &secondary, &separator, &open, &quit])?;
    app.manage(UsageMenuItems { primary, secondary });

    let mut pixels = vec![0u8; 32 * 32 * 4];
    for y in 0..32usize {
        for x in 0..32usize {
            let dx = x as i32 - 16;
            let dy = y as i32 - 16;
            let distance = dx * dx + dy * dy;
            if (64..196).contains(&distance) {
                let index = (y * 32 + x) * 4;
                pixels[index..index + 4].copy_from_slice(&[162, 231, 196, 255]);
            }
        }
    }

    TrayIconBuilder::new()
        .icon(Image::new_owned(pixels, 32, 32))
        .tooltip("Token Peek · consumo do Codex")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_usage(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        // Só impede o fechamento quando esconder a janela deu certo.
        if window.hide().is_ok() {
            api.prevent_close();
        }
    }
}
