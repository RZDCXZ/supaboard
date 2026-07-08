import Link from "next/link";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { Button } from "@/components/ui/button";
import { signInWithGitHub } from "@/features/auth/actions";
import { LoginForm } from "@/features/auth/auth-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const errorMessage = error === "callback" ? "登录链接无效或已过期，请重新尝试" : error === "oauth" ? "GitHub 登录暂时不可用" : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl leading-8 font-semibold">登录 SupaBoard</h1><p className="mt-2 text-sm text-muted-foreground">继续管理你的工作区和任务。</p></div>
      {errorMessage ? <InlineAlert variant="error">{errorMessage}</InlineAlert> : null}
      <LoginForm next={next} />
      <div className="flex items-center gap-3 text-xs text-disabled"><span className="h-px flex-1 bg-border" /><span>或</span><span className="h-px flex-1 bg-border" /></div>
      <form action={signInWithGitHub}><Button type="submit" variant="outline" size="lg" className="w-full">使用 GitHub 登录</Button></form>
      <p className="text-center text-sm text-muted-foreground">还没有账号？<Link className="font-medium text-foreground underline underline-offset-4" href="/signup">注册</Link></p>
    </div>
  );
}
