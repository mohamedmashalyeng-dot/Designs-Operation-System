import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CreativeCard } from "@/components/creative/creative-card";
import type { DesignSummary } from "@/lib/creative/queries";

export function ReviewGrid({
  title,
  description,
  designs,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  designs: DesignSummary[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      {designs.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {designs.map((design) => (
            <CreativeCard key={design.id} design={design} />
          ))}
        </div>
      ) : (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} className="py-24" />
      )}
    </div>
  );
}
