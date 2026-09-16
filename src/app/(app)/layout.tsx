import { redirect } from "next/navigation";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { isAuthBypassEnabled, DEV_USER } from "@/lib/dev/bypass-auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const realUser = await getCurrentUser();
  const user = realUser ?? (isAuthBypassEnabled() ? DEV_USER : null);
  if (!user) redirect("/login");

  let fullName: string | null = null;
  if (realUser) {
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", realUser.id).maybeSingle();
    fullName = profile?.full_name ?? null;
  }

  return (
    <AppShell email={user.email ?? ""} fullName={realUser ? fullName : "Dev User (BYPASS_AUTH)"}>
      {children}
    </AppShell>
  );
}
