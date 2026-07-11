import { redirect } from "next/navigation";

import { PageHeader } from "@/components/app-shell/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logout } from "@/features/auth/actions";
import { LogoutButton } from "@/features/auth/logout-button";
import { ProfileSettingsForm } from "@/features/profiles/profile-settings-form";
import { getAvatarPublicUrl } from "@/features/storage/avatar";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fapp%2Fsettings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_path")
    .eq("id", user.id)
    .single();
  const displayName = profile?.display_name ?? "用户";
  const avatarPath = profile?.avatar_path ?? null;
  const avatarUrl = getAvatarPublicUrl(supabase, avatarPath);

  return (
    <main>
      <PageHeader title="设置" description="管理个人资料和账号会话" />
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-6">
        <Card>
          <CardHeader>
            <CardTitle>个人资料</CardTitle>
            <CardDescription>其他协作者将看到此昵称和头像。</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileSettingsForm
              userId={user.id}
              displayName={displayName}
              avatarPath={avatarPath}
              avatarUrl={avatarUrl}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>账号</CardTitle>
            <CardDescription>退出当前浏览器中的 SupaBoard 会话。</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={logout}>
              <LogoutButton />
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
