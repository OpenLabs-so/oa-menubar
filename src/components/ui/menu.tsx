import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The shared dropdown language: dark panel in both themes, spring
 * scale/fade, a gliding hover highlight, tick on the active row. Ported
 * from the dashboard's site switcher / interval select.
 */

export const SPRING = { type: "spring", stiffness: 550, damping: 38 } as const;
/** Snappy glide for the hover highlight: near-instant, no lag. */
const HOVER_TRANSITION = { duration: 0.04, ease: "easeOut" } as const;

export const menuItemClass =
  "group relative flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm text-white/90 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-white/40";

/** Sliding hover highlight shared per panel via layoutId. */
export function Highlight({ layoutId }: { layoutId: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={HOVER_TRANSITION}
      aria-hidden="true"
      className="absolute inset-0 rounded-[10px] bg-white/10"
    />
  );
}

export function MenuTick() {
  return (
    <HugeiconsIcon
      icon={Tick02Icon}
      strokeWidth={1.8}
      className="relative size-4 text-white/70"
    />
  );
}

/**
 * Anchored panel with the shared open/close motion. The parent owns `open`
 * and closes on outside pointerdown / Escape via `useMenuDismiss`.
 */
export function MenuPanel({
  open,
  align,
  menuKey,
  className,
  children,
  onMouseLeave,
}: {
  open: boolean;
  align: "left" | "right";
  menuKey: string;
  className?: string;
  children: React.ReactNode;
  onMouseLeave?: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={menuKey}
          role="menu"
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.12 } }}
          transition={SPRING}
          onMouseLeave={onMouseLeave}
          className={cn(
            "absolute top-full z-40 mt-3 max-h-[300px] w-56 overflow-y-auto rounded-2xl bg-[#26262a] p-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.2),0_16px_40px_rgba(0,0,0,0.28)] ring-1 ring-white/8",
            align === "left" ? "left-0 origin-top-left" : "right-0 origin-top-right",
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-white/8" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
      {children}
    </p>
  );
}

/** Close on outside click or Escape while open. */
export function useMenuDismiss(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
  close: () => void
) {
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, close]);
}
