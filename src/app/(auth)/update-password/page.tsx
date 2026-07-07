import Link from "next/link";

import { UpdatePasswordForm } from "@/features/auth/auth-forms";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="space-y-4"><h1 className="text-2xl font-semibold">恢复链接无效或已过期</h1><p className="text-sm text-zinc-600">请重新发送密码恢复邮件。</p><Link className="inline-flex text-sm font-medium underline" href="/forgot-password">重新发送恢复邮件</Link></div>;
  }

  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">设置新密码</h1><p className="mt-2 text-sm text-zinc-600">更新后请使用新密码登录。</p></div><UpdatePasswordForm /></div>;
}
