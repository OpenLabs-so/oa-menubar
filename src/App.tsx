import * as React from "react";
import { BrandLoader } from "@/components/brand";
import { CodeScreen } from "@/screens/code";
import { LoginScreen } from "@/screens/login";
import { SitesScreen } from "@/screens/sites";
import {
  StatsScreen,
  type LiveStatus,
  type TotalsState,
} from "@/screens/stats";
import {
  rangeForInterval,
  readStoredInterval,
  storeInterval,
  type IntervalKey,
} from "@/lib/interval";
import {
  api,
  onSnapshot,
  NOT_LOGGED_IN,
  type SiteSummary,
} from "@/lib/tauri";

/** Where the selected site is remembered across launches. */
const SITE_KEY = "oa-site";

type Screen =
  | { kind: "loading" }
  | { kind: "login"; error: string | null }
  | { kind: "code"; userCode: string }
  | { kind: "sites" }
  | { kind: "stats"; site: SiteSummary };

export default function App() {
  const [screen, setScreen] = React.useState<Screen>({ kind: "loading" });
  const [sites, setSites] = React.useState<SiteSummary[]>([]);
  const [sitesLoading, setSitesLoading] = React.useState(false);
  const [sitesError, setSitesError] = React.useState<string | null>(null);
  const [interval, setIntervalKey] = React.useState<IntervalKey>(() =>
    readStoredInterval()
  );
  const [live, setLive] = React.useState(0);
  const [liveStatus, setLiveStatus] = React.useState<LiveStatus>("connecting");
  const [totals, setTotals] = React.useState<TotalsState>("loading");

  // Drops overview answers that arrive for a stale site/interval pick, and
  // remembers when the metrics were last fresh (for the focus refresh).
  const overviewToken = React.useRef(0);
  const overviewStamp = React.useRef(0);

  const signOut = React.useCallback(async () => {
    await api.logout().catch(() => {});
    localStorage.removeItem(SITE_KEY);
    setSites([]);
    setScreen({ kind: "login", error: null });
  }, []);

  const enterStats = React.useCallback((site: SiteSummary) => {
    localStorage.setItem(SITE_KEY, site.site_id);
    setLive(0);
    setLiveStatus("connecting");
    setScreen({ kind: "stats", site });
    api.realtimeStart(site.site_id).catch(() => setLiveStatus("offline"));
  }, []);

  const hasSites = sites.length > 0;
  const showSites = React.useCallback(() => {
    setScreen({ kind: "sites" });
    setSitesError(null);
    // Skeletons only when there is nothing to show yet; a known list stays
    // put and swaps in place when the refresh lands.
    if (!hasSites) setSitesLoading(true);
    api
      .listSites()
      .then((response) => {
        setSites(response.items ?? []);
        setSitesLoading(false);
      })
      .catch((error) => {
        setSitesLoading(false);
        if (String(error) === NOT_LOGGED_IN) return signOut();
        setSitesError(String(error));
      });
  }, [hasSites, signOut]);

  const beginLogin = React.useCallback(async () => {
    try {
      const authorization = await api.loginBegin();
      setScreen({ kind: "code", userCode: authorization.user_code });
      await api.loginFinish();
      // A fresh sign-in always lands on the site picker.
      showSites();
    } catch (error) {
      setScreen({ kind: "login", error: String(error) });
    }
  }, [showSites]);

  const refreshOverview = React.useCallback(
    async (site: SiteSummary, key: IntervalKey) => {
      const token = ++overviewToken.current;
      setTotals("loading");
      const range = rangeForInterval(key);
      try {
        const body = await api.overview({
          siteId: site.site_id,
          from: range.from,
          to: range.to,
          timezone: range.timezone,
        });
        if (token !== overviewToken.current) return;
        setTotals(body.totals ?? {});
        overviewStamp.current = Date.now();
        storeInterval(key); // re-stamp while the screen is in use
      } catch (error) {
        if (token !== overviewToken.current) return;
        if (String(error) === NOT_LOGGED_IN) return signOut();
        // The live count is the headline; a failed summary shows quiet
        // dashes rather than replacing it with an error state.
        setTotals("error");
      }
    },
    [signOut]
  );

  // Boot: keychain check, then straight to a remembered site or the picker.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await api
        .authStatus()
        .catch(() => ({ logged_in: false }));
      if (cancelled) return;
      if (!status.logged_in) {
        setScreen({ kind: "login", error: null });
        return;
      }
      let items: SiteSummary[] = [];
      try {
        items = (await api.listSites()).items ?? [];
      } catch (error) {
        if (cancelled) return;
        if (String(error) === NOT_LOGGED_IN) {
          setScreen({ kind: "login", error: null });
        } else {
          setSitesError(String(error));
          setScreen({ kind: "sites" });
        }
        return;
      }
      if (cancelled) return;
      setSites(items);
      const remembered = localStorage.getItem(SITE_KEY);
      const site = items.find((s) => s.site_id === remembered);
      if (site) {
        enterStats(site);
      } else {
        setScreen({ kind: "sites" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enterStats]);

  // One snapshot subscription for the app's lifetime.
  React.useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;
    onSnapshot((snapshot) => {
      if (typeof snapshot.active_visitors === "number") {
        setLive(snapshot.active_visitors);
        setLiveStatus("live");
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // Metrics follow the site and the interval.
  const statsSite = screen.kind === "stats" ? screen.site : null;
  React.useEffect(() => {
    if (statsSite) void refreshOverview(statsSite, interval);
  }, [statsSite, interval, refreshOverview]);

  // The popover regains focus whenever it is reopened: freshen a stale
  // summary so "Today" still means today after midnight or a long sleep.
  React.useEffect(() => {
    const onFocus = () => {
      if (statsSite && Date.now() - overviewStamp.current > 60_000) {
        void refreshOverview(statsSite, interval);
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [statsSite, interval, refreshOverview]);

  return (
    <main className="squircle fixed inset-0 flex flex-col overflow-hidden rounded-[26px] border border-border bg-transparent">
      <div key={screen.kind} className="skel-in flex min-h-0 flex-1 flex-col">
        {screen.kind === "loading" && <LoadingScreen />}
        {screen.kind === "login" && (
          <LoginScreen error={screen.error} onSignIn={beginLogin} />
        )}
        {screen.kind === "code" && <CodeScreen userCode={screen.userCode} />}
        {screen.kind === "sites" && (
          <SitesScreen
            sites={sites}
            loading={sitesLoading}
            error={sitesError}
            onRetry={showSites}
            onChoose={enterStats}
            onSignOut={signOut}
          />
        )}
        {screen.kind === "stats" && (
          <StatsScreen
            site={screen.site}
            sites={sites}
            interval={interval}
            live={live}
            liveStatus={liveStatus}
            totals={totals}
            onSelectSite={enterStats}
            onAllSites={showSites}
            onSignOut={signOut}
            onSelectInterval={(key) => {
              setIntervalKey(key);
              storeInterval(key);
            }}
            onOpenDashboard={() => void api.openDashboard()}
          />
        )}
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <BrandLoader className="size-11 text-primary" label="Loading" />
    </div>
  );
}
