import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The product's card anatomy at popover scale: a squircle frame on the card
 * colour with a recessed inset panel on the background colour. Continuous
 * corners come from the `.squircle` utility (clip-path `shape()`, rounded
 * fallback); radius per layer rides the `--clip-r` custom property.
 */

export function Frame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "squircle flex min-h-0 flex-col rounded-[24px] border border-border bg-card p-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] [--clip-r:13px]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function FrameStrip({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pb-1.5 pl-3.5 pr-2 pt-1">
      <h2 className="flex items-center gap-2 text-[13px] font-medium text-foreground/85 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Inset({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "squircle min-h-0 flex-1 overflow-hidden rounded-[20px] border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.06)] [--clip-r:11px]",
        className
      )}
    >
      {children}
    </div>
  );
}
