import { AlertTriangle, CheckCircle2, HelpCircle, Sparkles } from "lucide-react";
import type { ImageReview } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

const RECOMMENDATION_META = {
  approve: { label: "AI recommends approval", icon: CheckCircle2, className: "text-emerald-700 dark:text-emerald-400" },
  needs_human_review: { label: "AI flagged for human review", icon: HelpCircle, className: "text-amber-700 dark:text-amber-400" },
  regenerate: { label: "AI suggests regenerating", icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
} as const;

export function AIReviewSummary({ review }: { review: ImageReview | null }) {
  if (!review) return null;

  const meta = RECOMMENDATION_META[review.recommendation];
  const Icon = meta.icon;

  return (
    <div className="space-y-2.5 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="size-3.5" />
          AI Quality Review
        </p>
        <span className="text-xs font-medium text-muted-foreground">{review.overallScore}/100</span>
      </div>
      <p className={cn("flex items-center gap-1.5 text-sm font-medium", meta.className)}>
        <Icon className="size-4" />
        {meta.label}
      </p>
      {review.issues.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {review.issues.map((issue, i) => (
            <li key={i}>
              <span className="font-medium capitalize">{issue.severity}</span> · {issue.category}: {issue.description}
            </li>
          ))}
        </ul>
      )}
      {review.suggestions.length > 0 && (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          {review.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
