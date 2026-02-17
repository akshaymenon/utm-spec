import { type HTMLAttributes, forwardRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { BrutalButton } from "./Button";

export interface BrutalDrawerProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  side?: "right" | "left";
  title?: string;
}

const BrutalDrawer = forwardRef<HTMLDivElement, BrutalDrawerProps>(
  ({ className, open, onClose, side = "right", title, children, ...props }, ref) => {
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      },
      [onClose]
    );

    useEffect(() => {
      if (open) {
        document.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [open, handleKeyDown]);

    if (!open) return null;

    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-ink/30"
          onClick={onClose}
          data-testid="drawer-overlay"
        />
        <div
          ref={ref}
          className={cn(
            "fixed top-0 z-50 h-full w-full max-w-md border-3 border-ink bg-paper shadow-brutal flex flex-col",
            side === "right" ? "right-0 border-l-3" : "left-0 border-r-3",
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between gap-4 border-b-3 border-ink px-4 py-3">
            {title && (
              <h2 className="text-lg font-bold" data-testid="drawer-title">
                {title}
              </h2>
            )}
            <BrutalButton
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-drawer-close"
            >
              <X className="h-5 w-5" />
            </BrutalButton>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </div>
      </>
    );
  }
);

BrutalDrawer.displayName = "BrutalDrawer";

export { BrutalDrawer };
