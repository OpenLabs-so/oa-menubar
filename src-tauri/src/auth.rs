//! OAuth against the Open Analytics API: the device flow (RFC 8628) and
//! refresh, exactly the way the `oa` CLI signs in: a user code, a browser
//! approval, a token pair. Tokens live in the macOS keychain, never in a
//! file.

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const DEFAULT_API_BASE: &str = "https://api.getopen.so";
pub const DEFAULT_REALTIME_BASE: &str = "https://rt.getopen.so";
pub const DASHBOARD_URL: &str = "https://app.getopen.so";

/// The read surface's full scope set. `realtime:read` is what lets the app
/// mint stream tokens; the rest feed the popover's summary.
pub const SCOPES: &str = "site:read analytics:read realtime:read revenue:read";

/// The server gates the device flow to first-party clients, and dynamically
/// registered clients are not in that list: the app borrows the CLI's
/// registration until `oa-menubar` ships as its own first-party client.
/// `OA_CLIENT_ID` overrides for testing against another deployment.
pub fn client_id() -> String {
    std::env::var("OA_CLIENT_ID")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "oa-cli".to_string())
}

const KEYCHAIN_SERVICE: &str = "so.getopen.menubar";
const DEVICE_GRANT: &str = "urn:ietf:params:oauth:grant-type:device_code";

pub fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account).map_err(|e| e.to_string())
}

fn net_err(error: reqwest::Error) -> String {
    format!("Could not reach the API: {error}")
}

#[derive(Clone, Serialize, Deserialize)]
pub struct StoredAuth {
    pub access_token: String,
    pub refresh_token: String,
    /// Unix seconds. Refreshed a minute early rather than on failure.
    pub expires_at: u64,
    pub scope: String,
    pub client_id: String,
}

pub fn load_auth() -> Option<StoredAuth> {
    let raw = entry("oauth").ok()?.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save_auth(auth: &StoredAuth) -> Result<(), String> {
    let raw = serde_json::to_string(auth).map_err(|e| e.to_string())?;
    entry("oauth")?.set_password(&raw).map_err(|e| e.to_string())
}

/// Forgets the tokens and only the tokens; there is nothing else to revoke.
pub fn clear_auth() {
    if let Ok(e) = entry("oauth") {
        let _ = e.delete_credential();
    }
}

/// What `login_begin` hands the popover. The `device_code` stays in Rust.
#[derive(Clone, Serialize)]
pub struct DeviceAuthorization {
    #[serde(skip)]
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub verification_uri_complete: Option<String>,
    #[serde(skip)]
    pub interval_seconds: u64,
    #[serde(skip)]
    pub expires_in_seconds: u64,
}

pub async fn start_device_authorization(
    http: &reqwest::Client,
    api_base: &str,
    client_id: &str,
) -> Result<DeviceAuthorization, String> {
    let response = http
        .post(format!("{api_base}/api/auth/device/code"))
        .json(&serde_json::json!({ "client_id": client_id, "scope": SCOPES }))
        .send()
        .await
        .map_err(net_err)?;
    if !response.status().is_success() {
        return Err(format!(
            "The server refused to start a device authorization ({})",
            response.status()
        ));
    }
    let body: serde_json::Value = response.json().await.map_err(net_err)?;
    Ok(DeviceAuthorization {
        device_code: body["device_code"].as_str().unwrap_or_default().to_string(),
        user_code: body["user_code"].as_str().unwrap_or_default().to_string(),
        verification_uri: body["verification_uri"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        verification_uri_complete: body["verification_uri_complete"]
            .as_str()
            .map(str::to_string),
        interval_seconds: body["interval"].as_u64().unwrap_or(5),
        expires_in_seconds: body["expires_in"].as_u64().unwrap_or(600),
    })
}

/// RFC 8628 §3.4-3.5, the same three rules the CLI keeps: `slow_down` widens
/// the interval permanently, only the two pending errors continue, and the
/// deadline is the server's `expires_in` rather than one of our own.
pub async fn poll_for_tokens(
    http: &reqwest::Client,
    api_base: &str,
    client_id: &str,
    authorization: &DeviceAuthorization,
) -> Result<StoredAuth, String> {
    let mut interval = authorization.interval_seconds.max(1);
    let deadline = now_secs() + authorization.expires_in_seconds;

    loop {
        if now_secs() >= deadline {
            return Err("The code expired before it was approved. Try again.".into());
        }
        tokio::time::sleep(std::time::Duration::from_secs(interval)).await;

        let response = http
            .post(format!("{api_base}/v1/oauth/device/token"))
            .form(&[
                ("grant_type", DEVICE_GRANT),
                ("device_code", authorization.device_code.as_str()),
                ("client_id", client_id),
            ])
            .send()
            .await
            .map_err(net_err)?;

        if response.status().is_success() {
            let body: serde_json::Value = response.json().await.map_err(net_err)?;
            return Ok(token_response_to_auth(&body, client_id)?);
        }

        let body: serde_json::Value = response.json().await.unwrap_or_default();
        match body["error"].as_str().unwrap_or("invalid_request") {
            "authorization_pending" => {}
            "slow_down" => interval += 5,
            "access_denied" => return Err("The request was denied in the browser.".into()),
            other => {
                return Err(body["error_description"]
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or(format!("Authorization failed ({other})")))
            }
        }
    }
}

pub async fn refresh_tokens(
    http: &reqwest::Client,
    api_base: &str,
    client_id: &str,
    refresh_token: &str,
) -> Result<StoredAuth, String> {
    let response = http
        .post(format!("{api_base}/api/auth/oauth2/token"))
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", client_id),
        ])
        .send()
        .await
        .map_err(net_err)?;
    if !response.status().is_success() {
        return Err("The session could not be renewed. Sign in again.".into());
    }
    let body: serde_json::Value = response.json().await.map_err(net_err)?;
    token_response_to_auth(&body, client_id)
}

fn token_response_to_auth(
    body: &serde_json::Value,
    client_id: &str,
) -> Result<StoredAuth, String> {
    let access_token = body["access_token"]
        .as_str()
        .ok_or("The token answer carried no access_token")?
        .to_string();
    let refresh_token = body["refresh_token"]
        .as_str()
        .ok_or("The token answer carried no refresh_token")?
        .to_string();
    Ok(StoredAuth {
        access_token,
        refresh_token,
        expires_at: now_secs() + body["expires_in"].as_u64().unwrap_or(3600),
        scope: body["scope"].as_str().unwrap_or_default().to_string(),
        client_id: client_id.to_string(),
    })
}

/// A live access token: the stored one when it still has a minute, a
/// refreshed one otherwise. A failed refresh signs the app out, because a
/// refresh token the server refuses is a session that no longer exists.
pub async fn fresh_access_token(
    http: &reqwest::Client,
    api_base: &str,
    slot: &tokio::sync::Mutex<Option<StoredAuth>>,
) -> Result<String, String> {
    let mut guard = slot.lock().await;
    let current = guard.clone().ok_or("not_logged_in")?;
    if current.expires_at > now_secs() + 60 {
        return Ok(current.access_token);
    }
    match refresh_tokens(http, api_base, &current.client_id, &current.refresh_token).await {
        Ok(renewed) => {
            save_auth(&renewed)?;
            let token = renewed.access_token.clone();
            *guard = Some(renewed);
            Ok(token)
        }
        Err(_) => {
            clear_auth();
            *guard = None;
            Err("not_logged_in".into())
        }
    }
}
