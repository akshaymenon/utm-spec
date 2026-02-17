import { type HTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex items-center gap-1 border-3 border-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      severity: {
        error: "bg-brutal-alert text-white",
        warn: "bg-brutal-warn text-ink",
        ok: "bg-brutal-ok text-white",
        info: "bg-brutal-accent text-white",
      },
    },
    defaultVariants: {
      severity: "info",
    },
  }
);

export interface BrutalChipProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const BrutalChip = forwardRef<HTMLSpanElement, BrutalChipProps>(
  ({ className, severity, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(chipVariants({ severity, className }))}
        {...props}
      />
    );
  }
);

BrutalChip.displayName = "BrutalChip";

export { BrutalChip, chipVariants };
