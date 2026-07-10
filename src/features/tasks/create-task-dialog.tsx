"use client";

import { PlusIcon } from "lucide-react";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { createTask } from "./actions";
import type { TaskItem, TaskMemberOption, TaskPriority, TaskStatus } from "./types";

export function CreateTaskDialog({
  workspaceId,
  members,
  onCreated,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  workspaceId: string;
  members: readonly TaskMemberOption[];
  onCreated: (task: TaskItem) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("unassigned");
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  function resetForm() {
    setStatus("todo");
    setPriority("medium");
    setAssigneeId("unassigned");
    setError(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      const result = await createTask({
        workspaceId,
        title: form.get("title"),
        description: form.get("description"),
        status,
        priority,
        assigneeId: assigneeId === "unassigned" ? null : assigneeId,
      });

      if (!result.ok) {
        setError(result.error);
        if (result.error.fields?.title) titleRef.current?.focus();
        return;
      }

      resetForm();
      setOpen(false);
      onCreated(result.data);
      toast.success("任务已创建");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          if (!nextOpen) resetForm();
          setOpen(nextOpen);
        }
      }}
    >
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button>
            <PlusIcon data-icon="inline-start" />
            新建任务
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent
        className="sm:max-w-[560px]"
        showCloseButton={!isPending}
        onEscapeKeyDown={(event) => isPending && event.preventDefault()}
        onPointerDownOutside={(event) => isPending && event.preventDefault()}
      >
        <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={isPending}>
          <DialogHeader>
            <DialogTitle>新建任务</DialogTitle>
            <DialogDescription>填写任务信息，只有标题为必填项。</DialogDescription>
          </DialogHeader>
          <FieldSet disabled={isPending}>
            <FieldGroup>
              <Field data-invalid={Boolean(error?.fields?.title)}>
                <FieldLabel htmlFor="task-create-title">标题</FieldLabel>
                <Input
                  ref={titleRef}
                  id="task-create-title"
                  name="title"
                  maxLength={200}
                  required
                  disabled={isPending}
                  aria-invalid={Boolean(error?.fields?.title) || undefined}
                />
                <FieldError>{error?.fields?.title}</FieldError>
              </Field>
              <Field data-invalid={Boolean(error?.fields?.description)}>
                <FieldLabel htmlFor="task-create-description">描述</FieldLabel>
                <Textarea
                  id="task-create-description"
                  name="description"
                  maxLength={5000}
                  disabled={isPending}
                  aria-invalid={Boolean(error?.fields?.description) || undefined}
                  className="min-h-24"
                />
                <FieldError>{error?.fields?.description}</FieldError>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel>状态</FieldLabel>
                  <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)} disabled={isPending}>
                    <SelectTrigger aria-label="状态" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="todo">待办</SelectItem>
                      <SelectItem value="in_progress">进行中</SelectItem>
                      <SelectItem value="done">已完成</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>优先级</FieldLabel>
                  <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)} disabled={isPending}>
                    <SelectTrigger aria-label="优先级" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="low">低</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                    </SelectGroup></SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={Boolean(error?.fields?.assigneeId)}>
                  <FieldLabel>负责人</FieldLabel>
                  <Select value={assigneeId} onValueChange={setAssigneeId} disabled={isPending}>
                    <SelectTrigger aria-label="负责人" className="w-full" aria-invalid={Boolean(error?.fields?.assigneeId) || undefined}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem value="unassigned">未分配</SelectItem>
                      {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.displayName}</SelectItem>)}
                    </SelectGroup></SelectContent>
                  </Select>
                  <FieldError>{error?.fields?.assigneeId}</FieldError>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
          {error ? <InlineAlert variant="error">{error.message}</InlineAlert> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>取消</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Spinner data-icon="inline-start" />创建中…</> : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
