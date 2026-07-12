"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/feedback/inline-alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { addWorkspaceMember, removeWorkspaceMember } from "./actions";

export function AddMemberDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<{
    message: string;
    email?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  function clearError() {
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await addWorkspaceMember({
        workspaceId,
        email: form.get("email"),
      });
      if (!result.ok) {
        setError({
          message: result.error.message,
          email: result.error.fields?.email,
        });
        if (result.error.fields?.email) emailRef.current?.focus();
        return;
      }

      setOpen(false);
      clearError();
      router.refresh();
      toast.success("成员已添加");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        if (!nextOpen) clearError();
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon data-icon="inline-start" />
          添加成员
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[440px]"
        showCloseButton={!isPending}
        onEscapeKeyDown={(event) => isPending && event.preventDefault()}
        onPointerDownOutside={(event) => isPending && event.preventDefault()}
      >
        <form
          onSubmit={submit}
          className="flex flex-col gap-4"
          aria-busy={isPending}
        >
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
            <DialogDescription>仅可添加已经注册的用户。</DialogDescription>
          </DialogHeader>
          <FieldSet disabled={isPending}>
            <Field data-invalid={Boolean(error?.email)}>
              <FieldLabel htmlFor="add-member-email">邮箱</FieldLabel>
              <Input
                ref={emailRef}
                id="add-member-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={320}
                aria-invalid={Boolean(error?.email) || undefined}
              />
              <FieldError>{error?.email}</FieldError>
            </Field>
          </FieldSet>
          {error ? <InlineAlert variant="error">{error.message}</InlineAlert> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                clearError();
                setOpen(false);
              }}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />添加中…
                </>
              ) : (
                "添加"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveMemberButton({
  workspaceId,
  userId,
  displayName,
}: {
  workspaceId: string;
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeWorkspaceMember({ workspaceId, userId });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setOpen(false);
      router.refresh();
      toast.success("成员已移除");
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return;
        if (!nextOpen) setError(null);
        setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`移除 ${displayName}`}
        >
          <Trash2Icon data-icon="inline-start" />
          移除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>移除 {displayName}</AlertDialogTitle>
          <AlertDialogDescription>
            移除后，对方的后续请求和重新建立的实时连接将失去此工作区权限。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={remove}
          >
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />移除中…
              </>
            ) : (
              "移除成员"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
