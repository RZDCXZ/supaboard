"use client";

import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { InlineAlert } from "@/components/feedback/inline-alert";
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { createWorkspace } from "./actions";
import { initialWorkspaceActionState } from "./types";

export function CreateWorkspaceDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createWorkspace,
    initialWorkspaceActionState,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const nameError = state.fieldErrors?.name;
  const nameErrorId = nameError ? "workspace-name-error" : undefined;

  useEffect(() => {
    if (state.status !== "error") return;

    if (nameError) {
      inputRef.current?.focus();
    } else {
      summaryRef.current?.focus();
    }
  }, [nameError, state.status]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusIcon data-icon="inline-start" />
            创建工作区
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[440px]"
        showCloseButton={!isPending}
        onEscapeKeyDown={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isPending) {
            event.preventDefault();
          }
        }}
      >
        <form action={formAction} className="flex flex-col gap-4" aria-busy={isPending}>
          <DialogHeader>
            <DialogTitle>创建工作区</DialogTitle>
            <DialogDescription>创建后你会成为该工作区的 Owner。</DialogDescription>
          </DialogHeader>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              <Field data-invalid={Boolean(nameError)} data-disabled={isPending || undefined}>
                <FieldLabel htmlFor="workspace-name">名称</FieldLabel>
                <Input
                  ref={inputRef}
                  id="workspace-name"
                  name="name"
                  autoComplete="off"
                  maxLength={100}
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(nameError) || undefined}
                  aria-describedby={nameErrorId}
                />
                {nameError ? <FieldError id={nameErrorId}>{nameError}</FieldError> : null}
              </Field>
            </FieldGroup>
          </FieldSet>
          {state.message ? (
            <div ref={summaryRef} tabIndex={-1}>
              <InlineAlert variant="error">{state.message}</InlineAlert>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner aria-hidden="true" data-icon="inline-start" />
                  创建中…
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
