// The only bridge to Rust. Rust owns the network and the secrets; the UI
// invokes commands and renders what comes back.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type SiteStatus = "active" | "billing_blocked" | "deleting" | "deleted";
export type SiteRole = "owner" | "admin" | "viewer";

export type SiteSummary = {
  site_id: string;
  slug: string;
  name: string;
  status: SiteStatus;
  role: SiteRole;
};

export type OverviewTotals = {
  events?: number;
  pageviews?: number;
  visitors?: number;
  billable_events?: number;
};

export type DeviceAuthorization = {
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string | null;
};

/** Rust's fresh_access_token surfaces a dead session as this exact string. */
export const NOT_LOGGED_IN = "not_logged_in";

export const api = {
  authStatus: () => invoke<{ logged_in: boolean }>("auth_status"),
  loginBegin: () => invoke<DeviceAuthorization>("login_begin"),
  loginFinish: () => invoke<boolean>("login_finish"),
  logout: () => invoke<void>("logout"),
  listSites: () => invoke<{ items: SiteSummary[] }>("list_sites"),
  overview: (args: {
    siteId: string;
    from: string;
    to: string;
    timezone: string;
  }) => invoke<{ totals?: OverviewTotals }>("overview", args),
  realtimeStart: (siteId: string) =>
    invoke<void>("realtime_start", { siteId }),
  realtimeStop: () => invoke<void>("realtime_stop"),
  openDashboard: () => invoke<void>("open_dashboard"),
};

export type Snapshot = { active_visitors?: number };

export function onSnapshot(
  callback: (snapshot: Snapshot) => void
): Promise<UnlistenFn> {
  return listen<Snapshot>("realtime-snapshot", (event) =>
    callback(event.payload)
  );
}
