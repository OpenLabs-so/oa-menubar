import { cn } from "@/lib/utils";
import type { SiteSummary } from "@/lib/tauri";

/**
 * A site's monogram tile, after the web `SiteMark` fallback: the read list
 * carries no domains, so there is no favicon to ask for and the initial is
 * the resting state, not an error. `tone="dark"` is for rows on the dark
 * dropdown panel, where a light tile is what stays visible.
 */
export function SiteTile({
  site,
  tone = "light",
  className,
}: {
  site: Pick<SiteSummary, "name" | "slug">;
  tone?: "light" | "dark";
  className?: string;
}) {
  const initial =
    ((site.name || site.slug || "?").trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-md text-[10px] font-medium ring-1",
        tone === "dark"
          ? "bg-white/90 text-[#26262a]/60 ring-white/20"
          : "bg-black/4 text-muted-foreground ring-black/8 dark:bg-white/6 dark:ring-white/10",
        className
      )}
    >
      {initial}
    </span>
  );
}
