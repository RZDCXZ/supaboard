import Link from "next/link";

import { signInWithGitHub } from "@/features/auth/actions";
import { LoginForm } from "@/features/auth/auth-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const errorMessage = error === "callback" ? "登录链接无效或已过期，请重新尝试" : error === "oauth" ? "GitHub 登录暂时不可用" : undefined;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">登录 SupaBoard</h1><p className="mt-2 text-sm text-zinc-600">继续管理你的工作区和任务。</p></div>
      {errorMessage ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p> : null}
      <LoginForm next={next} />
      <div className="flex items-center gap-3 text-xs text-zinc-400"><span className="h-px flex-1 bg-zinc-200" /><span>或</span><span className="h-px flex-1 bg-zinc-200" /></div>
      <form action={signInWithGitHub}><button type="submit" className="h-11 w-full rounded-lg border border-zinc-300 font-medium hover:bg-zinc-50">使用 GitHub 登录</button></form>
      <p className="text-center text-sm text-zinc-600">还没有账号？<Link className="font-medium text-zinc-900 underline" href="/signup">注册</Link></p>
    </div>
  );
}
