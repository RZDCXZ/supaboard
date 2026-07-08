import Link from "next/link";

import { SignupForm } from "@/features/auth/auth-forms";

export default function SignupPage() {
  return <div className="flex flex-col gap-6"><div><h1 className="text-2xl leading-8 font-semibold">创建账号</h1><p className="mt-2 text-sm text-muted-foreground">使用邮箱注册 SupaBoard。</p></div><SignupForm /><p className="text-center text-sm text-muted-foreground">已有账号？<Link className="font-medium text-foreground underline underline-offset-4" href="/login">登录</Link></p></div>;
}
