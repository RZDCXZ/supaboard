import { redirect } from "next/navigation";

import { logout } from "@/features/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fapp");

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-5"><div><h1 className="text-2xl font-semibold">SupaBoard</h1><p className="mt-1 text-sm text-zinc-600">你好，{profile?.display_name ?? "用户"}</p></div><form action={logout}><button type="submit" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50">退出登录</button></form></div>
      <p className="py-12 text-zinc-600">Auth 与 SSR 会话已就绪，工作区功能将在下一阶段实现。</p>
    </main>
  );
}
