import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { ComingSoonPage } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Inspiration" };

export default function InspirationPage() {
  return (
    <ComingSoonPage
      icon={Lightbulb}
      title="Inspiration"
      description="Approved examples, reference creatives, and competitor inspiration."
      detail="A curated reference library the Creative Director can draw style cues from. Planned once the core Brand Brain (identity, audiences, rules, assets) is in active use."
    />
  );
}
