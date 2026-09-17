import type { Metadata } from "next";
import { CalendarDays, AlertTriangle } from "lucide-react";
import { isToday, isTomorrow, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getUpcomingJobs, getFailedJobs, type PublicationJobSummary } from "@/lib/publishing/queries";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarJobRow } from "@/components/creative/calendar-job-row";

export const metadata: Metadata = { title: "Calendar" };

function groupByDay(jobs: PublicationJobSummary[]): { label: string; jobs: PublicationJobSummary[] }[] {
  const groups = new Map<string, PublicationJobSummary[]>();
  for (const job of jobs) {
    const key = job.scheduledFor ? format(new Date(job.scheduledFor), "yyyy-MM-dd") : "unscheduled";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(job);
  }

  return [...groups.entries()].map(([key, groupJobs]) => {
    if (key === "unscheduled") return { label: "Not yet scheduled", jobs: groupJobs };
    const date = new Date(groupJobs[0].scheduledFor!);
    const label = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : format(date, "EEEE, d MMMM");
    return { label, jobs: groupJobs };
  });
}

export default async function CalendarPage() {
  const supabase = await createClient();
  const [upcoming, failed] = await Promise.all([getUpcomingJobs(supabase), getFailedJobs(supabase)]);
  const groups = groupByDay(upcoming);

  return (
    <div className="space-y-10">
      <PageHeader title="Calendar" description="Scheduled and in-flight publishing jobs, soonest first." />

      <section className="space-y-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.75} />
          Upcoming
        </h2>
        {groups.length > 0 ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
                <div className="space-y-2">
                  {group.jobs.map((job) => (
                    <CalendarJobRow key={job.id} job={job} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Approve a creative and publish or schedule it from the review screen to see it here."
            className="py-16"
          />
        )}
      </section>

      {failed.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-destructive" strokeWidth={1.75} />
            Failed
          </h2>
          <div className="space-y-2">
            {failed.map((job) => (
              <CalendarJobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
