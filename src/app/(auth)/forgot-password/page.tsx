import Link from "next/link";

import { ForgotPasswordForm } from "@/features/auth/auth-forms";

export default function ForgotPasswordPage() {
  return <div className="space-y-6"><div><h1 className="text-2xl font-semibold">重置密码</h1><p className="mt-2 text-sm text-zinc-600">我们会向你的邮箱发送密码恢复链接。</p></div><ForgotPasswordForm /><p className="text-center text-sm"><Link className="font-medium underline" href="/login">返回登录</Link></p></div>;
}
