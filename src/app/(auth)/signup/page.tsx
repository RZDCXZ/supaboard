import Link from "next/link";

import { SignupForm } from "@/features/auth/auth-forms";

export default function SignupPage() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">创建账号</h1><p className="mt-2 text-sm text-zinc-600">使用邮箱注册 SupaBoard。</p></div><SignupForm /><p className="text-center text-sm text-zinc-600">已有账号？<Link className="font-medium text-zinc-900 underline" href="/login">登录</Link></p></div>;
}
