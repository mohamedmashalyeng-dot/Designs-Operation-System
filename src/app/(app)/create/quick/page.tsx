import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { ComingSoonPage } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Quick Creative" };

export default function QuickCreativePage() {
  return (
    <ComingSoonPage
      icon={Zap}
      title="Quick Creative"
      description="A single-asset fast path, without the full campaign brief."
      detail="For a single one-off image or post, skip the full campaign flow. Use New Campaign for now — Quick Creative is planned for a later phase."
    />
  );
}
