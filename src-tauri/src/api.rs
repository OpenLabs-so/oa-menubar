//! The `/v1/read/*` surface, which is the only API surface the app reads.
//!
//! Responses pass through as `serde_json::Value`: the popover renders what the
//! server said, and a schema copy here would only be a second place for the
//! contract to drift.

pub async fn read_get(
    http: &reqwest::Client,
    api_base: &str,
    access_token: &str,
    site_id: Option<&str>,
    path: &str,
    query: &[(&str, &str)],
) -> Result<serde_json::Value, String> {
    let mut request = http
        .get(format!("{api_base}{path}"))
        .bearer_auth(access_token)
        .header("accept", "application/json")
        .query(query);
    // Only when a site is selected: an empty header names a site and does
    // not, which the server refuses. Same rule the CLI keeps.
    if let Some(site) = site_id {
        request = request.header("x-oa-site", site);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Could not reach the API: {e}"))?;
    let status = response.status();
    if status.is_success() {
        return response
            .json()
            .await
            .map_err(|e| format!("The API answered something unreadable: {e}"));
    }

    let body: serde_json::Value = response.json().await.unwrap_or_default();
    Err(body["error"]["message"]
        .as_str()
        .map(str::to_string)
        .unwrap_or(format!("The request failed ({status})")))
}
