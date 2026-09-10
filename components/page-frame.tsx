import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cards stay a readable width; extra columns appear as the window grows. */
export const itemGridClass =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,21rem),1fr))] gap-3 sm:gap-4";

export function PageFrame({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "wide" | "article";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        width === "article" && "max-w-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ItemGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(itemGridClass, className)}>{children}</div>;
}
