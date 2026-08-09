// The dashboard's shared time range, ported from the web app's
// interval-context.tsx. Calendar boundaries are cut in the browser's zone and
// the same zone is sent as the `timezone` parameter, so "Today" always means
// the user's today.
//
// "All time" is withheld: its anchor needs a site read the public read
// surface does not expose here.

export const INTERVALS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "24h", label: "Last 24 hours" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "6mo", label: "Last 6 months" },
  { key: "12mo", label: "Last 12 months" },
] as const;

export type IntervalKey = (typeof INTERVALS)[number]["key"];

export type AnalyticsRange = { from: string; to: string; timezone: string };

export const intervalLabel = (key: IntervalKey): string =>
  (INTERVALS.find((interval) => interval.key === key) ?? INTERVALS[0]).label;

export const resolveTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** The zone's UTC offset at `at`, in milliseconds. */
function tzOffsetMs(timezone: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - at.getTime();
}

/**
 * The UTC instant at which the calendar day containing `base`, shifted by
 * whole years/months/days on that zone's calendar, starts in `timezone`.
 * Two offset passes converge across DST transitions.
 */
function zonedDayStart(
  base: Date,
  timezone: string,
  shift: { years?: number; months?: number; days?: number } = {}
): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(base)
    .split("-")
    .map(Number);
  const target = Date.UTC(
    y + (shift.years ?? 0),
    m - 1 + (shift.months ?? 0),
    d + (shift.days ?? 0)
  );
  let instant = target - tzOffsetMs(timezone, new Date(target));
  instant = target - tzOffsetMs(timezone, new Date(instant));
  return new Date(instant);
}

/** Half-open `[from, to)`, cut at the zone's calendar boundaries. */
export function rangeForInterval(
  key: IntervalKey,
  timezone: string = resolveTimezone(),
  now: Date = new Date()
): AnalyticsRange {
  const day = (shift: Parameters<typeof zonedDayStart>[2]) =>
    zonedDayStart(now, timezone, shift);
  const tomorrow = day({ days: 1 });

  const bounds: Record<IntervalKey, [Date, Date]> = {
    today: [day({}), tomorrow],
    yesterday: [day({ days: -1 }), day({})],
    "24h": [new Date(now.getTime() - 86_400_000), now],
    "7d": [day({ days: -6 }), tomorrow],
    "30d": [day({ days: -29 }), tomorrow],
    "90d": [day({ days: -89 }), tomorrow],
    "6mo": [day({ months: -6, days: 1 }), tomorrow],
    "12mo": [day({ years: -1, days: 1 }), tomorrow],
  };

  const [from, to] = bounds[key];
  return { from: from.toISOString(), to: to.toISOString(), timezone };
}

/**
 * The picker remembers its last selection across launches, with a shelf
 * life: coming back after a long absence starts at Today. The timestamp is
 * re-stamped while the screen is in use, so "stale" measures absence.
 */
const INTERVAL_KEY = "oa:menubar-interval:v1";
const INTERVAL_STALE_AFTER_MS = 8 * 3_600_000;
const RETURNING_INTERVAL: IntervalKey = "today";

const isIntervalKey = (value: unknown): value is IntervalKey =>
  INTERVALS.some((interval) => interval.key === value);

export function readStoredInterval(): IntervalKey {
  try {
    const raw = localStorage.getItem(INTERVAL_KEY);
    if (raw === null) return RETURNING_INTERVAL;
    const parsed = JSON.parse(raw) as { key?: unknown; atMs?: unknown };
    if (!isIntervalKey(parsed.key)) return RETURNING_INTERVAL;
    if (typeof parsed.atMs !== "number") return RETURNING_INTERVAL;
    if (Date.now() - parsed.atMs > INTERVAL_STALE_AFTER_MS)
      return RETURNING_INTERVAL;
    return parsed.key;
  } catch {
    return RETURNING_INTERVAL;
  }
}

export function storeInterval(key: IntervalKey): void {
  try {
    localStorage.setItem(
      INTERVAL_KEY,
      JSON.stringify({ key, atMs: Date.now() })
    );
  } catch {
    // Blocked storage: the selection still holds for this run via state.
  }
}
