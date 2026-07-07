"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  login,
  requestPasswordReset,
  signup,
  updatePassword,
} from "./actions";
import { initialAuthActionState } from "./types";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      className="h-11 w-full rounded-lg bg-zinc-900 px-4 font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="group-disabled:hidden">{label}</span>
      <span className="hidden group-disabled:inline">{pendingLabel}</span>
    </button>
  );
}

function Feedback({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) return null;

  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
      }`}
    >
      {message}
    </p>
  );
}

const inputClassName =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-200";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(login, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4" aria-busy={isPending}>
      <input type="hidden" name="next" value={next ?? "/app"} />
      <label className="block space-y-1.5 text-sm font-medium">
        <span>邮箱</span>
        <input className={inputClassName} name="email" type="email" autoComplete="email" required disabled={isPending} />
      </label>
      <div className="space-y-1.5 text-sm font-medium">
        <span className="flex items-center justify-between">
          <label htmlFor="login-password">密码</label>
          <Link className="font-normal text-zinc-600 underline" href="/forgot-password">忘记密码？</Link>
        </span>
        <input id="login-password" className={inputClassName} name="password" type="password" autoComplete="current-password" minLength={8} required disabled={isPending} />
      </div>
      <Feedback message={state.message} />
      <fieldset className="group" disabled={isPending}>
        <SubmitButton label="登录" pendingLabel="登录中…" />
      </fieldset>
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signup, initialAuthActionState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">请检查邮箱</h1>
        <p className="text-sm leading-6 text-zinc-600">确认邮件已发送。完成邮箱确认后即可进入 SupaBoard。</p>
        <Link className="inline-flex text-sm font-medium underline" href="/login">返回登录</Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4" aria-busy={isPending}>
      <label className="block space-y-1.5 text-sm font-medium"><span>邮箱</span><input className={inputClassName} name="email" type="email" autoComplete="email" required disabled={isPending} /></label>
      <label className="block space-y-1.5 text-sm font-medium"><span>密码</span><input className={inputClassName} name="password" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} /></label>
      <label className="block space-y-1.5 text-sm font-medium"><span>确认密码</span><input className={inputClassName} name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} /></label>
      <Feedback message={state.message} />
      <fieldset className="group" disabled={isPending}><SubmitButton label="注册" pendingLabel="注册中…" /></fieldset>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialAuthActionState);

  if (state.status === "success") {
    return <div className="space-y-4"><Feedback success message={`如果该邮箱已注册，重置邮件已发送至 ${state.emailHint}。`} /><Link className="inline-flex text-sm font-medium underline" href="/login">返回登录</Link></div>;
  }

  return (
    <form action={formAction} className="space-y-4" aria-busy={isPending}>
      <label className="block space-y-1.5 text-sm font-medium"><span>邮箱</span><input className={inputClassName} name="email" type="email" autoComplete="email" required disabled={isPending} /></label>
      <Feedback message={state.message} />
      <fieldset className="group" disabled={isPending}><SubmitButton label="发送重置邮件" pendingLabel="发送中…" /></fieldset>
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4" aria-busy={isPending}>
      <label className="block space-y-1.5 text-sm font-medium"><span>新密码</span><input className={inputClassName} name="password" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} /></label>
      <label className="block space-y-1.5 text-sm font-medium"><span>确认新密码</span><input className={inputClassName} name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={isPending} /></label>
      <Feedback message={state.message} />
      <fieldset className="group" disabled={isPending}><SubmitButton label="更新密码" pendingLabel="更新中…" /></fieldset>
    </form>
  );
}
