import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { ComingSoonPage } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <ComingSoonPage
      icon={BarChart3}
      title="Analytics"
      description="Performance across campaigns and creative concepts."
      detail="Once publishing is connected, this will surface which concepts, tones, and visual directions actually perform — feeding back into the AI Creative Director as a learning signal."
    />
  );
}
