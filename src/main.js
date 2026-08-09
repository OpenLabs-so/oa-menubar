// The popover's whole brain. Rust owns the network and the secrets; this file
// only asks commands for data and renders what comes back.

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
const views = ["view-loading", "view-login", "view-code", "view-live"];

function show(view) {
  for (const id of views) $(id).hidden = id !== view;
}

function setLiveStatus(status) {
  $("live-status").textContent = status;
  $("live-dot").classList.toggle("live", status === "live");
}

// ---------------------------------------------------------------- sign in

async function beginLogin() {
  $("login-error").hidden = true;
  try {
    const authorization = await invoke("login_begin");
    $("user-code").textContent = authorization.user_code;
    show("view-code");
    await invoke("login_finish");
    await enterDashboard();
  } catch (error) {
    show("view-login");
    $("login-error").textContent = String(error);
    $("login-error").hidden = false;
  }
}

async function signOut() {
  await invoke("logout").catch(() => {});
  show("view-login");
}

// ------------------------------------------------------------- signed in

let unlistenSnapshot = null;

async function enterDashboard() {
  show("view-live");
  setLiveStatus("connecting");
  $("live-count").textContent = "0";

  let sites;
  try {
    sites = (await invoke("list_sites")).items ?? [];
  } catch (error) {
    // An expired session lands here; anything else briefly does too, and
    // signing in again is the honest recovery for both.
    await signOut();
    return;
  }

  const select = $("site-select");
  select.innerHTML = "";
  for (const site of sites) {
    const option = document.createElement("option");
    option.value = site.site_id;
    option.textContent = site.name || site.slug;
    select.append(option);
  }

  if (sites.length === 0) {
    setLiveStatus("no sites yet");
    return;
  }

  const remembered = localStorage.getItem("oa-site");
  const current = sites.some((s) => s.site_id === remembered)
    ? remembered
    : sites[0].site_id;
  select.value = current;
  await watchSite(current);
}

async function watchSite(siteId) {
  localStorage.setItem("oa-site", siteId);
  setLiveStatus("connecting");

  if (!unlistenSnapshot) {
    unlistenSnapshot = await listen("realtime-snapshot", (event) => {
      const count = event.payload?.active_visitors;
      if (typeof count === "number") {
        $("live-count").textContent = String(count);
        setLiveStatus("live");
      }
    });
  }
  await invoke("realtime_start", { siteId }).catch(() => {
    setLiveStatus("offline");
  });
  await refreshToday(siteId);
}

async function refreshToday(siteId) {
  // The read API takes full ISO-8601 UTC instants, never date-only strings:
  // today is local midnight to now, both said as instants, with the zone
  // sent alongside so the server buckets on the same calendar we live in.
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const body = await invoke("overview", {
      siteId,
      from: startOfDay.toISOString(),
      to: now.toISOString(),
      timezone,
    });
    const totals = body.totals ?? {};
    $("today-visitors").textContent = String(totals.visitors ?? 0);
    $("today-pageviews").textContent = String(totals.pageviews ?? 0);
  } catch {
    // The live count is the headline; a failed summary stays quiet rather
    // than replacing it with an error state.
  }
}

// ----------------------------------------------------------------- wiring

$("login-button").addEventListener("click", beginLogin);
$("logout-button").addEventListener("click", signOut);
$("dashboard-button").addEventListener("click", () => invoke("open_dashboard"));
$("site-select").addEventListener("change", (event) => {
  watchSite(event.target.value);
});

(async function init() {
  const status = await invoke("auth_status").catch(() => ({ logged_in: false }));
  if (status.logged_in) {
    await enterDashboard();
  } else {
    show("view-login");
  }
})();
