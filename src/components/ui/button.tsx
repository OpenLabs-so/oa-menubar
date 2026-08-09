import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

/** The product's button, verbatim where it matters: pill silhouette, inset
 *  highlight shadows on the primary, press-down on :active. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer rounded-full! text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default:
          "border border-[color-mix(in_srgb,var(--primary)_80%,#3a3480)] bg-[color-mix(in_srgb,var(--primary)_90%,#3a3480)] text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(58,52,128,0.30)] transform-gpu hover:bg-primary hover:border-[color-mix(in_srgb,var(--primary)_70%,#3a3480)] active:translate-y-px active:scale-[0.98] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-1px_0_rgba(58,52,128,0.26)]",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground transform-gpu hover:bg-[color-mix(in_srgb,var(--secondary)_95%,var(--ink))] active:translate-y-px active:scale-[0.98]",
        ghost:
          "text-muted-foreground hover:text-accent-foreground hover:bg-accent/60",
      },
      size: {
        default: "h-9 px-4 py-1.5 text-sm",
        sm: "h-8 gap-1.5 px-3",
        xs: "h-7 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      data-slot="button"
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
