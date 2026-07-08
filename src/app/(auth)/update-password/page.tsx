import Link from "next/link";

import { UpdatePasswordForm } from "@/features/auth/auth-forms";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="flex flex-col gap-4"><h1 className="text-2xl leading-8 font-semibold">恢复链接无效或已过期</h1><p className="text-sm text-muted-foreground">请重新发送密码恢复邮件。</p><Link className="inline-flex text-sm font-medium underline underline-offset-4" href="/forgot-password">重新发送恢复邮件</Link></div>;
  }

  return <div className="flex flex-col gap-6"><div><h1 className="text-2xl leading-8 font-semibold">设置新密码</h1><p className="mt-2 text-sm text-muted-foreground">更新后请使用新密码登录。</p></div><UpdatePasswordForm /></div>;
}
