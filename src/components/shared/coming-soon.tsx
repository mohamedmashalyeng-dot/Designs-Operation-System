import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

/** Well-designed placeholder for sections planned in the architecture but
 * not built in this phase — see product spec §6. Never silently fakes
 * functionality; always names what's coming. */
export function ComingSoonPage({
  icon,
  title,
  description,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title="Coming in a later phase" description={detail} className="py-24" />
    </div>
  );
}
