import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/constants/labels";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  progress: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  review: "bg-accent text-accent-foreground",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  danger: "bg-destructive/10 text-destructive",
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[tone],
        className
      )}
    >
      {tone === "progress" && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {label}
    </span>
  );
}
