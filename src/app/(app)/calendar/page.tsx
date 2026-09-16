import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { ComingSoonPage } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <ComingSoonPage
      icon={CalendarDays}
      title="Calendar"
      description="A calendar view of scheduled and published creative."
      detail="Once publishing is connected, scheduled posts will appear here on a timeline. Planned for the publishing phase, after the core review workflow ships."
    />
  );
}
