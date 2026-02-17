import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface BrutalCardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

const BrutalCard = forwardRef<HTMLDivElement, BrutalCardProps>(
  ({ className, hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "border-3 border-ink bg-paper shadow-brutal",
          hover &&
            "transition-shadow hover:shadow-brutal-hover active:shadow-brutal-active cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

BrutalCard.displayName = "BrutalCard";

const BrutalCardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("border-b-3 border-ink px-4 py-3", className)}
    {...props}
  />
));

BrutalCardHeader.displayName = "BrutalCardHeader";

const BrutalCardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 py-4", className)} {...props} />
));

BrutalCardContent.displayName = "BrutalCardContent";

export { BrutalCard, BrutalCardHeader, BrutalCardContent };
