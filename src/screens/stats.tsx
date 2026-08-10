import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics02Icon,
  ArrowRight01Icon,
  ArrowUpDownIcon,
  Logout01Icon,
  MoreVerticalCircle01Icon,
} from "@hugeicons/core-free-icons";
import * as React from "react";
import { SiteTile } from "@/components/tile";
import { Button } from "@/components/ui/button";
import {
  Highlight,
  MenuLabel,
  MenuPanel,
  MenuSeparator,
  MenuTick,
  menuItemClass,
  useMenuDismiss,
} from "@/components/ui/menu";
import { Frame, FrameStrip, Inset } from "@/components/ui/squircle";
import {
  INTERVALS,
  intervalLabel,
  type IntervalKey,
} from "@/lib/interval";
import type {
  OverviewTotals,
  SessionTotals,
  SiteSummary,
} from "@/lib/tauri";
import { cn } from "@/lib/utils";

export type LiveStatus = "connecting" | "live" | "offline";

/** Metrics are totals, a quiet dash on failure, skeletons while loading. */
export type TotalsState = OverviewTotals | "loading" | "error";
export type SessionsState = SessionTotals | "loading" | "error";

const fmt = (n: number | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "0";

/** 93s -> "1m 33s", 3670s -> "1h 1m"; sub-minute keeps seconds only. */
function fmtDuration(ms: number | undefined): string {
  const total = Math.round((ms ?? 0) / 1000);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const fmtPercent = (rate: number | undefined) =>
  `${Math.round((rate ?? 0) * 100)}%`;

/** A row's display value: pass loading/error through, format data. */
function metricValue<T extends object>(
  state: T | "loading" | "error",
  render: (data: T) => string
): string | "loading" | "error" {
  if (state === "loading" || state === "error") return state;
  return render(state);
}

const STATE_WORD: Partial<Record<SiteSummary["status"], string>> = {
  billing_blocked: "Paused",
  deleting: "Deleting",
  deleted: "Deleted",
};

export function StatsScreen({
  site,
  sites,
  interval,
  live,
  liveStatus,
  totals,
  sessions,
  onSelectSite,
  onAllSites,
  onSignOut,
  onSelectInterval,
  onOpenDashboard,
}: {
  site: SiteSummary;
  sites: SiteSummary[];
  interval: IntervalKey;
  live: number;
  liveStatus: LiveStatus;
  totals: TotalsState;
  sessions: SessionsState;
  onSelectSite: (site: SiteSummary) => void;
  onAllSites: () => void;
  onSignOut: () => void;
  onSelectInterval: (key: IntervalKey) => void;
  onOpenDashboard: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col p-3">
      <header className="flex items-center justify-between gap-2">
        <SiteSwitcher
          current={site}
          sites={sites}
          onSelect={onSelectSite}
          onAllSites={onAllSites}
          onSignOut={onSignOut}
        />
        <IntervalSelect value={interval} onSelect={onSelectInterval} />
      </header>

      <div className="flex flex-col items-center gap-0.5 pb-1 pt-6.5">
        <p className="text-[42px] font-medium leading-[1.1] tracking-tight tabular-nums">
          {fmt(live)}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(
              "size-2 rounded-full",
              liveStatus === "live" && "bg-success bp-pulse",
              liveStatus === "offline" && "bg-warning",
              liveStatus === "connecting" && "bg-muted-foreground/50"
            )}
          />
          {liveStatus === "live"
            ? "Live users right now"
            : liveStatus === "connecting"
              ? "Connecting"
              : "Offline"}
        </p>
      </div>

      <Frame className="mt-4">
        <FrameStrip
          icon={<HugeiconsIcon icon={Analytics02Icon} strokeWidth={1.8} />}
          title={intervalLabel(interval)}
        />
        <Inset>
          <dl className="py-1">
            <Metric
              label="Visitors"
              value={metricValue(totals, (t) => fmt(t.visitors))}
            />
            <Metric
              label="Pageviews"
              value={metricValue(totals, (t) => fmt(t.pageviews))}
            />
            <Metric
              label="Events"
              value={metricValue(totals, (t) => fmt(t.events))}
            />
            <Metric
              label="Avg duration"
              value={metricValue(sessions, (s) =>
                fmtDuration(s.avg_session_duration_ms)
              )}
            />
            <Metric
              label="Bounce rate"
              value={metricValue(sessions, (s) => fmtPercent(s.bounce_rate))}
            />
          </dl>
        </Inset>
      </Frame>

      <footer className="mt-2.5 flex justify-center">
        <Button variant="ghost" size="sm" className="group" onClick={onOpenDashboard}>
          Open dashboard
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={1.8}
            className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </Button>
      </footer>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | "loading" | "error";
}) {
  return (
    <div className="flex h-[34px] items-center justify-between px-3.5 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value === "loading" ? (
          <span className="inline-block h-3 w-10 animate-pulse rounded-md bg-muted align-middle" />
        ) : value === "error" ? (
          <span className="text-muted-foreground">–</span>
        ) : (
          <span className="skel-in inline-block">{value}</span>
        )}
      </dd>
    </div>
  );
}

/**
 * Site switcher in the shared dropdown language, plus the account actions
 * this popover has nowhere else to keep: All sites and Sign out.
 */
function SiteSwitcher({
  current,
  sites,
  onSelect,
  onAllSites,
  onSignOut,
}: {
  current: SiteSummary;
  sites: SiteSummary[];
  onSelect: (site: SiteSummary) => void;
  onAllSites: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setHovered(null);
  }, []);
  useMenuDismiss(open, rootRef, close);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SiteTile site={current} />
        <span className="truncate">{current.name || current.slug}</span>
        <HugeiconsIcon
          icon={MoreVerticalCircle01Icon}
          strokeWidth={1.8}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </button>

      <MenuPanel
        open={open}
        align="left"
        menuKey="site-switcher"
        onMouseLeave={() => setHovered(null)}
        className="w-60"
      >
        <MenuLabel>Sites</MenuLabel>
        {sites.map((site) => {
          const isCurrent = site.site_id === current.site_id;
          const state = STATE_WORD[site.status];
          return (
            <button
              key={site.site_id}
              type="button"
              role="menuitemradio"
              aria-checked={isCurrent}
              onClick={() => {
                close();
                if (!isCurrent) onSelect(site);
              }}
              onMouseEnter={() => setHovered(site.site_id)}
              className={menuItemClass}
            >
              {hovered === site.site_id && (
                <Highlight layoutId="site-switcher-hover" />
              )}
              <SiteTile site={site} tone="dark" className="relative" />
              <span className="relative flex-1 truncate font-medium">
                {site.name || site.slug}
              </span>
              {state ? (
                <span className="relative shrink-0 text-[11px] text-white/40">
                  {state}
                </span>
              ) : null}
              {isCurrent && <MenuTick />}
            </button>
          );
        })}

        <MenuSeparator />

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            onAllSites();
          }}
          onMouseEnter={() => setHovered("all-sites")}
          className={menuItemClass}
        >
          {hovered === "all-sites" && (
            <Highlight layoutId="site-switcher-hover" />
          )}
          <span className="relative flex-1 font-medium">All sites</span>
          <HugeiconsIcon
            icon={ArrowUpDownIcon}
            strokeWidth={1.8}
            className="relative size-4 text-white/50"
          />
        </button>

        <MenuSeparator />

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            close();
            onSignOut();
          }}
          onMouseEnter={() => setHovered("sign-out")}
          className={cn(menuItemClass, "text-red-400")}
        >
          {hovered === "sign-out" && (
            <Highlight layoutId="site-switcher-hover" />
          )}
          <span className="relative flex-1 font-medium">Sign out</span>
          <HugeiconsIcon
            icon={Logout01Icon}
            strokeWidth={1.8}
            className="relative size-4 text-red-400"
          />
        </button>
      </MenuPanel>
    </div>
  );
}

/** Interval picker: dark panel, gliding highlight, tick on the active row. */
function IntervalSelect({
  value,
  onSelect,
}: {
  value: IntervalKey;
  onSelect: (key: IntervalKey) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setHovered(null);
  }, []);
  useMenuDismiss(open, rootRef, close);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        {intervalLabel(value)}
        <HugeiconsIcon
          icon={MoreVerticalCircle01Icon}
          strokeWidth={1.8}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
      </button>

      <MenuPanel
        open={open}
        align="right"
        menuKey="interval-select"
        onMouseLeave={() => setHovered(null)}
        className="w-48"
      >
        {INTERVALS.map((interval) => {
          const isActive = interval.key === value;
          return (
            <button
              key={interval.key}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              onClick={() => {
                close();
                onSelect(interval.key);
              }}
              onMouseEnter={() => setHovered(interval.key)}
              className={menuItemClass}
            >
              {hovered === interval.key && (
                <Highlight layoutId="interval-select-hover" />
              )}
              <span className="relative flex-1 font-medium">
                {interval.label}
              </span>
              {isActive && <MenuTick />}
            </button>
          );
        })}
      </MenuPanel>
    </div>
  );
}
