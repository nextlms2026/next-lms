import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark: a small teal tile with a saffron dot, plus the product name. */
export function Logo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden
        className="relative grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground"
      >
        n
        <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-highlight ring-2 ring-background" />
      </span>
      <span>next-lms</span>
    </Link>
  );
}
