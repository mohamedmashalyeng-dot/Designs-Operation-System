import type { Metadata } from "next";
import { Send } from "lucide-react";
import { ComingSoonPage } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Published" };

export default function PublishedPage() {
  return (
    <ComingSoonPage
      icon={Send}
      title="Published"
      description="A record of everything published to connected channels."
      detail="This will list every post published through Creative Ops, with links back to the live post and basic performance metrics. Connect a channel under Connections to get started once publishing ships."
    />
  );
}
