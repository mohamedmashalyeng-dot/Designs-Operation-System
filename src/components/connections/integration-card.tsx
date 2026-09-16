import type { LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/lib/constants/labels";

export function IntegrationCard({
  icon: Icon,
  name,
  description,
  statusLabel,
  statusTone,
  children,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  statusLabel: string;
  statusTone: StatusTone;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Icon className="size-4.5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <StatusBadge label={statusLabel} tone={statusTone} />
      </div>
      {children}
    </div>
  );
}
