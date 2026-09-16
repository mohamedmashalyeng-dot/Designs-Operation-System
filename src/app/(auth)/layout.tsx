import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { BrandMark } from "@/components/layout/brand-mark";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 px-4 py-16">
      <BrandMark href="/" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
