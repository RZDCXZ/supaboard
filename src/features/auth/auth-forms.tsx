"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import { InlineAlert } from "@/components/feedback/inline-alert";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import {
  login,
  requestPasswordReset,
  signup,
  updatePassword,
} from "./actions";
import { initialAuthActionState, type AuthActionState } from "./types";

function useErrorFocus(state: AuthActionState) {
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "error") return;

    const firstField = Object.keys(state.fieldErrors ?? {})[0];
    const field = firstField
      ? formRef.current?.elements.namedItem(firstField)
      : null;

    if (field instanceof HTMLElement) {
      field.focus();
    } else {
      summaryRef.current?.focus();
    }
  }, [state]);

  return { formRef, summaryRef };
}

function SubmitButton({
  label,
  pendingLabel,
  pending,
}: {
  label: string;
  pendingLabel: string;
  pending: boolean;
}) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Spinner aria-hidden="true" data-icon="inline-start" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

function Feedback({
  state,
  success = false,
  summaryRef,
}: {
  state: AuthActionState;
  success?: boolean;
  summaryRef?: React.RefObject<HTMLDivElement | null>;
}) {
  if (!state.message) return null;

  return (
    <div ref={summaryRef} tabIndex={-1}>
      <InlineAlert variant={success ? "success" : "error"}>
        {state.message}
      </InlineAlert>
    </div>
  );
}

function EmailField({
  id,
  error,
  disabled,
}: {
  id: string;
  error?: string;
  disabled: boolean;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>邮箱</FieldLabel>
      <Input
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        required
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={errorId}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState(
    login,
    initialAuthActionState,
  );
  const { formRef, summaryRef } = useErrorFocus(state);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      aria-busy={isPending}
    >
      <input type="hidden" name="next" value={next ?? "/app"} />
      <FieldSet disabled={isPending}>
        <FieldGroup>
          <EmailField
            id="login-email"
            error={state.fieldErrors?.email}
            disabled={isPending}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">密码</span>
              <Link
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                href="/forgot-password"
              >
                忘记密码？
              </Link>
            </div>
            <PasswordInput
              id="login-password"
              label="密码"
              labelHidden
              name="password"
              autoComplete="current-password"
              minLength={8}
              required
              disabled={isPending}
              error={state.fieldErrors?.password}
            />
          </div>
        </FieldGroup>
      </FieldSet>
      <Feedback state={state} summaryRef={summaryRef} />
      <SubmitButton
        label="登录"
        pendingLabel="登录中…"
        pending={isPending}
      />
    </form>
  );
}

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(
    signup,
    initialAuthActionState,
  );
  const { formRef, summaryRef } = useErrorFocus(state);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl leading-8 font-semibold">请检查邮箱</h1>
        <InlineAlert variant="success">
          确认邮件已发送。完成邮箱确认后即可进入 SupaBoard。
        </InlineAlert>
        <Link className="text-sm font-medium underline" href="/login">
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      aria-busy={isPending}
    >
      <FieldSet disabled={isPending}>
        <FieldGroup>
          <EmailField
            id="signup-email"
            error={state.fieldErrors?.email}
            disabled={isPending}
          />
          <PasswordInput
            id="signup-password"
            label="密码"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
            error={state.fieldErrors?.password}
          />
          <PasswordInput
            id="signup-confirm-password"
            label="确认密码"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
            error={state.fieldErrors?.confirmPassword}
          />
        </FieldGroup>
      </FieldSet>
      <Feedback state={state} summaryRef={summaryRef} />
      <SubmitButton
        label="注册"
        pendingLabel="注册中…"
        pending={isPending}
      />
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordReset,
    initialAuthActionState,
  );
  const { formRef, summaryRef } = useErrorFocus(state);

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <InlineAlert variant="success">
          如果该邮箱已注册，重置邮件已发送至 {state.emailHint}。
        </InlineAlert>
        <Link className="text-sm font-medium underline" href="/login">
          返回登录
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      aria-busy={isPending}
    >
      <EmailField
        id="forgot-email"
        error={state.fieldErrors?.email}
        disabled={isPending}
      />
      <Feedback state={state} summaryRef={summaryRef} />
      <SubmitButton
        label="发送重置邮件"
        pendingLabel="发送中…"
        pending={isPending}
      />
    </form>
  );
}

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updatePassword,
    initialAuthActionState,
  );
  const { formRef, summaryRef } = useErrorFocus(state);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      aria-busy={isPending}
    >
      <FieldSet disabled={isPending}>
        <FieldGroup>
          <PasswordInput
            id="update-password"
            label="新密码"
            name="password"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
            error={state.fieldErrors?.password}
          />
          <PasswordInput
            id="update-confirm-password"
            label="确认新密码"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
            error={state.fieldErrors?.confirmPassword}
          />
        </FieldGroup>
      </FieldSet>
      <Feedback state={state} summaryRef={summaryRef} />
      <SubmitButton
        label="更新密码"
        pendingLabel="更新中…"
        pending={isPending}
      />
    </form>
  );
}
