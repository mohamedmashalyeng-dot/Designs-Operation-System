import type { Metadata } from "next";
import { Bot, CheckCircle2, CircleDashed } from "lucide-react";
import { createClient, requireUser } from "@/lib/supabase/server";
import { isUsingRealAIProvider } from "@/lib/ai";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm, OrganisationForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("organisation_members").select("organisation_id, role").eq("user_id", user.id).limit(1).maybeSingle(),
  ]);

  const { data: organisation } = membership
    ? await supabase.from("organisations").select("id, name").eq("id", membership.organisation_id).maybeSingle()
    : { data: null };

  const aiConfigured = isUsingRealAIProvider();

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Your profile, workspace, and AI configuration." />

      <ProfileForm email={user.email ?? ""} fullName={profile?.full_name ?? null} />

      {organisation && membership && (
        <OrganisationForm organisationId={organisation.id} name={organisation.name} role={membership.role} />
      )}

      <div className="space-y-3 rounded-lg border p-5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bot className="size-4" />
          AI provider
        </p>
        <div className="flex items-center gap-2 text-sm">
          {aiConfigured ? (
            <>
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>OpenAI connected — generations use the real Creative Director and image models.</span>
            </>
          ) : (
            <>
              <CircleDashed className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                No OPENAI_API_KEY set — the app is running on the mock provider (clearly labeled placeholder output) so the
                workflow can be tested end to end without live credentials.
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
