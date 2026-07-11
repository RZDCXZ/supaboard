import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getAvatarPublicUrl } from "@/features/storage/avatar";
import { getCurrentUserWorkspaces } from "@/features/workspaces/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fapp");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", user.id)
    .single();
  const workspaces = await getCurrentUserWorkspaces(supabase).catch(() => []);

  return (
    <AppShell
      user={{
        displayName: profile?.display_name ?? "用户",
        avatarUrl: getAvatarPublicUrl(supabase, profile?.avatar_path ?? null),
      }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  );
}
