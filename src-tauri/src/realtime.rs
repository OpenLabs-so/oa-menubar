//! The live-visitors stream, from token mint to tray title.
//!
//! One background task per selected site. Each connection first asks the API
//! for a short-lived stream token (`POST /v1/read/realtime/token`, minted
//! under `realtime:read`), then holds an SSE stream open against the realtime
//! gateway. `EventSource` semantics are hand-rolled over a byte stream because
//! the gateway takes the token in the `Authorization` header and rejects
//! token-shaped query parameters outright.
//!
//! Every snapshot does two things: the tray title becomes the active-visitor
//! count, and the raw snapshot is forwarded to the popover as a
//! `realtime-snapshot` event for whatever it wants to render.

use futures_util::StreamExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::auth;
use crate::{set_tray_count, AppState};

pub fn spawn(app: AppHandle, site_id: String) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut attempt: u32 = 0;
        loop {
            match connect_once(&app, &site_id).await {
                // A clean disconnect (server rotated, token expired) restarts
                // promptly; only errors back off.
                Ok(()) => attempt = 0,
                Err(_) => attempt = attempt.saturating_add(1),
            }
            set_tray_count(&app, None);
            let delay = (3u64 << attempt.min(4)).min(30);
            tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
        }
    })
}

/// One mint, one stream, until the server ends it. `Ok` means the stream
/// closed after being live; `Err` means it never got that far.
async fn connect_once(app: &AppHandle, site_id: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let access_token =
        auth::fresh_access_token(&state.http, &state.api_base, &state.auth).await?;

    let minted = state
        .http
        .post(format!("{}/v1/read/realtime/token", state.api_base))
        .bearer_auth(&access_token)
        .header("x-oa-site", site_id)
        .send()
        .await
        .map_err(|e| format!("token mint failed: {e}"))?;
    if !minted.status().is_success() {
        return Err(format!("token mint answered {}", minted.status()));
    }
    let minted: serde_json::Value = minted.json().await.map_err(|e| e.to_string())?;
    let stream_token = minted["token"]
        .as_str()
        .ok_or("token mint answered without a token")?;

    let response = state
        .http
        .get(format!("{}/v1/realtime/stream", state.realtime_base))
        .header("accept", "text/event-stream")
        .bearer_auth(stream_token)
        .send()
        .await
        .map_err(|e| format!("stream connect failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("stream answered {}", response.status()));
    }

    let mut body = response.bytes_stream();
    let mut buffer = String::new();
    let mut was_live = false;

    while let Some(chunk) = body.next().await {
        let chunk = chunk.map_err(|e| format!("stream broke: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        while let Some(separator) = buffer.find("\n\n") {
            let block = buffer[..separator].to_string();
            buffer.drain(..separator + 2);
            if let Some(snapshot) = parse_snapshot(&block) {
                was_live = true;
                let count = snapshot["active_visitors"].as_u64();
                set_tray_count(app, count);
                let _ = app.emit_to("main", "realtime-snapshot", &snapshot);
            }
        }
    }

    if was_live {
        Ok(())
    } else {
        Err("stream ended before the first snapshot".into())
    }
}

/// Pulls the one frame the app cares about out of an SSE block. Control
/// frames and keepalive comments fall through as `None`.
fn parse_snapshot(block: &str) -> Option<serde_json::Value> {
    let mut data_lines: Vec<&str> = Vec::new();
    for line in block.split('\n') {
        if line.is_empty() || line.starts_with(':') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("data:") {
            data_lines.push(rest.strip_prefix(' ').unwrap_or(rest));
        }
    }
    if data_lines.is_empty() {
        return None;
    }
    let parsed: serde_json::Value = serde_json::from_str(&data_lines.join("\n")).ok()?;
    (parsed["type"].as_str() == Some("snapshot")).then_some(parsed)
}
