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
import type { OverviewTotals, SiteSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";

export type LiveStatus = "connecting" | "live" | "offline";

/** Metrics are totals, a quiet dash on failure, skeletons while loading. */
export type TotalsState = OverviewTotals | "loading" | "error";

const fmt = (n: number | undefined) =>
  typeof n === "number" ? n.toLocaleString("en-US") : "0";

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

      <div className="flex flex-col items-center gap-0.5 pb-1 pt-3.5">
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
          {liveStatus}
        </p>
      </div>

      <Frame className="mt-2.5">
        <FrameStrip
          icon={<HugeiconsIcon icon={Analytics02Icon} strokeWidth={1.8} />}
          title={intervalLabel(interval)}
        />
        <Inset>
          <dl className="py-1">
            <Metric label="Visitors" value={totals} pick="visitors" />
            <Metric label="Pageviews" value={totals} pick="pageviews" />
            <Metric label="Events" value={totals} pick="events" />
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
  pick,
}: {
  label: string;
  value: TotalsState;
  pick: keyof OverviewTotals;
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
          <span className="skel-in inline-block">{fmt(value[pick])}</span>
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
        className="flex h-8 cursor-pointer items-center gap-1 rounded-full border border-border bg-card pl-3 pr-2 text-[13px] shadow-xs outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {intervalLabel(value)}
        <HugeiconsIcon
          icon={MoreVerticalCircle01Icon}
          strokeWidth={1.8}
          className="size-4 shrink-0 text-muted-foreground"
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
