import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/database";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export function BriefSummary({ brief }: { brief: Tables<"creative_briefs"> }) {
  return (
    <div className="space-y-5 rounded-lg border p-5">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Core message</p>
        <p className="text-lg font-medium leading-snug">{brief.core_message}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {brief.tone.map((t) => (
          <Badge key={t} variant="secondary">
            {t}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target audience" value={brief.target_audience} />
        <Field label="Value proposition" value={brief.value_proposition} />
        <Field label="Visual direction" value={brief.visual_direction} />
        <Field label="Photography direction" value={brief.photography_direction} />
        <Field label="Emotional direction" value={brief.emotional_direction} />
        <Field label="Call to action" value={brief.cta} />
      </div>

      {brief.platform_considerations && <Field label="Platform considerations" value={brief.platform_considerations} />}

      {brief.constraints.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Constraints</p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
            {brief.constraints.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
