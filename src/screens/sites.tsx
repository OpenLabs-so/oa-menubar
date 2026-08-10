import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Globe02Icon } from "@hugeicons/core-free-icons";
import { SiteTile } from "@/components/tile";
import { Button } from "@/components/ui/button";
import { Frame, FrameStrip, Inset } from "@/components/ui/squircle";
import type { SiteSummary } from "@/lib/tauri";

/** A word beats a colour for the two states that matter. */
const STATE_WORD: Partial<Record<SiteSummary["status"], string>> = {
  billing_blocked: "Paused",
  deleting: "Deleting",
  deleted: "Deleted",
};

export function SitesScreen({
  sites,
  loading,
  error,
  onRetry,
  onChoose,
  onSignOut,
}: {
  sites: SiteSummary[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChoose: (site: SiteSummary) => void;
  onSignOut: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center p-3">
      <Frame>
        <FrameStrip
          icon={<HugeiconsIcon icon={Globe02Icon} strokeWidth={1.8} />}
          title="Choose a site"
          action={
            <Button variant="ghost" size="xs" onClick={onSignOut}>
              Sign out
            </Button>
          }
        />
        {/* Four rows and half of a fifth: the cut row is the scroll
            affordance, so a long account never stretches the card. */}
        <Inset className="h-[198px] flex-none">
          <div className="h-full overflow-y-auto p-1">
            {loading ? (
              <SiteRowSkeletons />
            ) : error && sites.length === 0 ? (
              <div role="alert" className="px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                {error}
                <div className="mt-1">
                  <Button variant="ghost" size="xs" onClick={onRetry}>
                    Try again
                  </Button>
                </div>
              </div>
            ) : sites.length === 0 ? (
              <p className="px-2.5 py-2 text-xs leading-5 text-muted-foreground">
                No sites yet. Sites you own or are invited to appear here.
              </p>
            ) : (
              sites.map((site) => (
                <SiteRow key={site.site_id} site={site} onChoose={onChoose} />
              ))
            )}
          </div>
        </Inset>
      </Frame>
    </div>
  );
}

function SiteRow({
  site,
  onChoose,
}: {
  site: SiteSummary;
  onChoose: (site: SiteSummary) => void;
}) {
  const state = STATE_WORD[site.status];
  return (
    <button
      type="button"
      onClick={() => onChoose(site)}
      className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <SiteTile site={site} className="size-7 rounded-lg text-xs" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium">
          {site.name || site.slug}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {site.slug}
        </span>
      </span>
      {state ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {state}
        </span>
      ) : null}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={1.8}
        className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </button>
  );
}

function SiteRowSkeletons() {
  return (
    <div aria-busy="true" aria-label="Loading your sites">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
          <span className="size-7 animate-pulse rounded-lg bg-muted" />
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="h-3 w-28 animate-pulse rounded-md bg-muted" />
            <span className="h-2.5 w-18 animate-pulse rounded-md bg-muted" />
          </span>
        </div>
      ))}
    </div>
  );
}
