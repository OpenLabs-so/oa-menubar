import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Brand mark: the striped "O", same geometry as the web app's
 * `components/landing/logo.tsx` (horizontal bands over a ring, a solid base
 * under them), filled with `currentColor`.
 */

export const BAND_TOPS = [4, 36, 68, 100, 132, 164, 196, 228, 260, 292];
export const BAND_HEIGHT = 20;
export const BASE_TOP = 324;

/** The ring: outer circle with the inner circle punched out (evenodd). */
export const RING_PATH =
  "M256 4a252 252 0 1 0 0 504 252 252 0 1 0 0-504Zm0 109a141 141 0 1 1 0 282 141 141 0 1 1 0-282Z";

function useClipId(): string {
  return `logo-ring-${React.useId().replace(/:/g, "")}`;
}

export function Logo({ className }: { className?: string }) {
  const clipId = useClipId();
  return (
    <svg
      viewBox="0 0 512 512"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <clipPath id={clipId}>
        <path clipRule="evenodd" d={RING_PATH} fillRule="evenodd" />
      </clipPath>
      <g clipPath={`url(#${clipId})`} fill="currentColor">
        {BAND_TOPS.map((top) => (
          <rect height={BAND_HEIGHT} key={top} width="512" x="0" y={top} />
        ))}
        <rect height={512 - BASE_TOP} width="512" x="0" y={BASE_TOP} />
      </g>
    </svg>
  );
}

/**
 * The mark as a loader: a crest travels up the bands, base first, 80ms of
 * stagger per band. Same rhythm as the web `brand-loader`.
 */
export function BrandLoader({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  const clipId = useClipId();
  // Bottom-to-top: the base leads, then each band above it.
  const bands = [...BAND_TOPS].reverse();
  return (
    <svg
      viewBox="0 0 512 512"
      role="img"
      aria-label={label}
      className={cn("shrink-0", className)}
    >
      <clipPath id={clipId}>
        <path clipRule="evenodd" d={RING_PATH} fillRule="evenodd" />
      </clipPath>
      <g clipPath={`url(#${clipId})`} fill="currentColor">
        <rect
          className="brand-band"
          height={512 - BASE_TOP}
          width="512"
          x="0"
          y={BASE_TOP}
        />
        {bands.map((top, index) => (
          <rect
            className="brand-band"
            style={{ animationDelay: `${(index + 1) * 80}ms` }}
            height={BAND_HEIGHT}
            key={top}
            width="512"
            x="0"
            y={top}
          />
        ))}
      </g>
    </svg>
  );
}
