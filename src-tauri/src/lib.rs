//! Open Analytics in the macOS menu bar.
//!
//! The whole app is a tray icon, a borderless popover window, and a handful
//! of commands the popover invokes. All network and secret handling lives on
//! the Rust side; the webview only renders.

mod api;
mod auth;
mod realtime;

use tauri::menu::{MenuBuilder, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_positioner::{Position, WindowExt};

const TRAY_ID: &str = "main-tray";

pub struct AppState {
    pub http: reqwest::Client,
    pub api_base: String,
    pub realtime_base: String,
    pub auth: tokio::sync::Mutex<Option<auth::StoredAuth>>,
    pending_device: tokio::sync::Mutex<Option<auth::DeviceAuthorization>>,
    pending_client_id: tokio::sync::Mutex<Option<String>>,
    realtime_task: std::sync::Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl AppState {
    fn new() -> Self {
        let env_or = |name: &str, fallback: &str| {
            std::env::var(name)
                .ok()
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| fallback.to_string())
        };
        Self {
            http: reqwest::Client::new(),
            api_base: env_or("OA_API_URL", auth::DEFAULT_API_BASE),
            realtime_base: env_or("OA_REALTIME_URL", auth::DEFAULT_REALTIME_BASE),
            auth: tokio::sync::Mutex::new(auth::load_auth()),
            pending_device: tokio::sync::Mutex::new(None),
            pending_client_id: tokio::sync::Mutex::new(None),
            realtime_task: std::sync::Mutex::new(None),
        }
    }

    fn stop_realtime(&self) {
        if let Some(task) = self.realtime_task.lock().unwrap().take() {
            task.abort();
        }
    }
}

/// The number beside the tray icon. `None` clears it back to icon-only.
pub fn set_tray_count(app: &AppHandle, count: Option<u64>) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        // The leading space is the gap between the template icon and the
        // title: NSStatusBarButton butts them together otherwise.
        let _ = tray.set_title(count.map(|n| format!(" Live: {n}")));
    }
}

#[derive(serde::Serialize)]
struct AuthStatus {
    logged_in: bool,
}

#[tauri::command]
async fn auth_status(state: tauri::State<'_, AppState>) -> Result<AuthStatus, String> {
    Ok(AuthStatus {
        logged_in: state.auth.lock().await.is_some(),
    })
}

/// Starts a device authorization and opens the verification page in the
/// default browser. Returns the user code for the popover to display.
#[tauri::command]
async fn login_begin(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<auth::DeviceAuthorization, String> {
    let client_id = auth::client_id();
    let authorization =
        auth::start_device_authorization(&state.http, &state.api_base, &client_id).await?;

    let verification_url = authorization
        .verification_uri_complete
        .clone()
        .unwrap_or_else(|| authorization.verification_uri.clone());
    let _ = app.opener().open_url(verification_url, None::<&str>);

    *state.pending_client_id.lock().await = Some(client_id);
    *state.pending_device.lock().await = Some(authorization.clone());
    Ok(authorization)
}

/// Waits for the browser approval. Resolves `true` on success; any refusal or
/// expiry surfaces as the command's error string.
#[tauri::command]
async fn login_finish(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let authorization = state
        .pending_device
        .lock()
        .await
        .take()
        .ok_or("No sign-in is in progress")?;
    let client_id = state
        .pending_client_id
        .lock()
        .await
        .take()
        .ok_or("No sign-in is in progress")?;

    let tokens =
        auth::poll_for_tokens(&state.http, &state.api_base, &client_id, &authorization).await?;
    auth::save_auth(&tokens)?;
    *state.auth.lock().await = Some(tokens);
    Ok(true)
}

#[tauri::command]
async fn logout(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.stop_realtime();
    auth::clear_auth();
    *state.auth.lock().await = None;
    set_tray_count(&app, None);
    Ok(())
}

#[tauri::command]
async fn list_sites(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, String> {
    let token = auth::fresh_access_token(&state.http, &state.api_base, &state.auth).await?;
    api::read_get(
        &state.http,
        &state.api_base,
        &token,
        None,
        "/v1/read/sites",
        &[],
    )
    .await
}

#[tauri::command]
async fn overview(
    state: tauri::State<'_, AppState>,
    site_id: String,
    from: String,
    to: String,
    timezone: String,
) -> Result<serde_json::Value, String> {
    let token = auth::fresh_access_token(&state.http, &state.api_base, &state.auth).await?;
    api::read_get(
        &state.http,
        &state.api_base,
        &token,
        Some(&site_id),
        "/v1/read/analytics/overview",
        &[
            ("from", from.as_str()),
            ("to", to.as_str()),
            ("timezone", timezone.as_str()),
        ],
    )
    .await
}

#[tauri::command]
async fn sessions(
    state: tauri::State<'_, AppState>,
    site_id: String,
    from: String,
    to: String,
    timezone: String,
) -> Result<serde_json::Value, String> {
    let token = auth::fresh_access_token(&state.http, &state.api_base, &state.auth).await?;
    api::read_get(
        &state.http,
        &state.api_base,
        &token,
        Some(&site_id),
        "/v1/read/analytics/sessions",
        &[
            ("from", from.as_str()),
            ("to", to.as_str()),
            ("timezone", timezone.as_str()),
        ],
    )
    .await
}

#[tauri::command]
async fn realtime_start(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    site_id: String,
) -> Result<(), String> {
    state.stop_realtime();
    let task = realtime::spawn(app, site_id);
    *state.realtime_task.lock().unwrap() = Some(task);
    Ok(())
}

#[tauri::command]
async fn realtime_stop(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.stop_realtime();
    set_tray_count(&app, None);
    Ok(())
}

#[tauri::command]
async fn open_dashboard(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(auth::DASHBOARD_URL, None::<&str>)
        .map_err(|e| e.to_string())
}

fn toggle_popover(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.move_window(Position::TrayBottomCenter);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;

    // Quit lives in a right-click menu: an Accessory app has no Dock icon, so
    // without this the only way out would be Activity Monitor.
    let quit = MenuItem::with_id(app, "quit", "Quit Open Analytics", true, None::<&str>)?;
    let menu = MenuBuilder::new(app).item(&quit).build()?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "quit" {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_popover(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_positioner::init())
        .manage(AppState::new())
        .setup(|app| {
            // Menu bar app: no Dock icon, no app switcher entry.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
            build_tray(app.handle())?;
            // Native glass: an NSVisualEffectView popover material behind the
            // webview. The webview paints a translucent tint over it, so the
            // panel frosts whatever is behind the popover. The radius matches
            // the panel's 26px corners so the native layer never peeks out.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                use window_vibrancy::{
                    apply_vibrancy, NSVisualEffectMaterial, NSVisualEffectState,
                };
                let _ = apply_vibrancy(
                    &window,
                    NSVisualEffectMaterial::Popover,
                    Some(NSVisualEffectState::Active),
                    Some(26.0),
                );
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // A popover dismisses when it loses focus; that is its contract.
            if let WindowEvent::Focused(false) = event {
                if window.label() == "main" {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            auth_status,
            login_begin,
            login_finish,
            logout,
            list_sites,
            overview,
            sessions,
            realtime_start,
            realtime_stop,
            open_dashboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
