"use client";

import { MoreHorizontalIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AppDrawer } from "@/components/feedback/app-drawer";
import { InlineAlert } from "@/components/feedback/inline-alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { CommentSection } from "@/features/comments/comment-section";
import type { CommentItem } from "@/features/comments/types";
import type { WorkspaceChange } from "@/features/realtime/reducer";
import type { WorkspaceRole } from "@/features/workspaces/types";
import { AttachmentSection } from "@/features/storage/attachments/attachment-section";
import type { AttachmentItem } from "@/features/storage/attachments/types";

import { deleteTask, updateTask } from "./actions";
import type {
  TaskItem,
  TaskMemberOption,
  TaskPatch,
  TaskPriority,
  TaskStatus,
} from "./types";

type PendingField = TaskPatch["field"] | "delete" | null;

export function TaskDrawer({
  open,
  workspaceId,
  task,
  members,
  comments,
  realtimeChange = null,
  attachments = [],
  commentsError = false,
  currentUserId,
  workspaceRole,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  open: boolean;
  workspaceId: string;
  task: TaskItem;
  members: readonly TaskMemberOption[];
  comments: readonly CommentItem[];
  realtimeChange?: WorkspaceChange | null;
  attachments?: readonly AttachmentItem[];
  commentsError?: boolean;
  currentUserId: string;
  workspaceRole: WorkspaceRole;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: TaskItem) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [currentTask, setCurrentTask] = useState(task);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [pendingField, setPendingField] = useState<PendingField>(null);
  const [error, setError] = useState<{ message: string; fields?: Record<string, string> } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isDirty = title !== currentTask.title || description !== (currentTask.description ?? "");

  function requestClose(nextOpen: boolean) {
    if (!nextOpen && pendingField !== null) return;

    if (!nextOpen && isDirty) {
      setLeaveOpen(true);
      return;
    }

    onOpenChange(nextOpen);
  }

  function savePatch(patch: TaskPatch) {
    setError(null);
    setPendingField(patch.field);

    startTransition(async () => {
      const result = await updateTask({ workspaceId, taskId: currentTask.id, patch });
      setPendingField(null);

      if (!result.ok) {
        setTitle(currentTask.title);
        setDescription(currentTask.description ?? "");
        setError(result.error);
        return;
      }

      setCurrentTask(result.data);
      setTitle(result.data.title);
      setDescription(result.data.description ?? "");
      onUpdated(result.data);
      toast.success("任务已更新");
    });
  }

  function confirmDelete() {
    setError(null);
    setPendingField("delete");

    startTransition(async () => {
      const result = await deleteTask({ workspaceId, taskId: currentTask.id });
      setPendingField(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDeleteOpen(false);
      onDeleted(result.data);
      onOpenChange(false);
      toast.success("任务已删除");
    });
  }

  return (
    <>
      <AppDrawer
        title={currentTask.title}
        description="任务详情"
        open={open}
        closeDisabled={pendingField !== null}
        onOpenChange={requestClose}
      >
        <div className="flex flex-col gap-5">
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="更多操作">
                  <MoreHorizontalIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleteOpen(true)}
                  >
                    <Trash2Icon aria-hidden="true" />
                    删除任务
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {error ? <InlineAlert variant="error">{error.message}</InlineAlert> : null}

          <FieldGroup>
            <Field data-invalid={Boolean(error?.fields?.title)}>
              <FieldLabel htmlFor="task-drawer-title">标题</FieldLabel>
              <Input
                id="task-drawer-title"
                value={title}
                maxLength={200}
                disabled={pendingField !== null}
                aria-invalid={Boolean(error?.fields?.title) || undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
              <FieldError>{error?.fields?.title}</FieldError>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={pendingField !== null || title === currentTask.title}
                onClick={() => savePatch({ field: "title", value: title })}
              >
                {pendingField === "title" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                保存标题
              </Button>
            </Field>

            <Field data-invalid={Boolean(error?.fields?.description)}>
              <FieldLabel htmlFor="task-drawer-description">描述</FieldLabel>
              <Textarea
                id="task-drawer-description"
                value={description}
                maxLength={5000}
                disabled={pendingField !== null}
                aria-invalid={Boolean(error?.fields?.description) || undefined}
                className="min-h-28"
                onChange={(event) => setDescription(event.target.value)}
              />
              <FieldError>{error?.fields?.description}</FieldError>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={pendingField !== null || description === (currentTask.description ?? "")}
                onClick={() => savePatch({ field: "description", value: description })}
              >
                {pendingField === "description" ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                保存描述
              </Button>
            </Field>

            <Field>
              <FieldLabel>状态</FieldLabel>
              <Select
                value={currentTask.status}
                disabled={pendingField !== null}
                onValueChange={(value) =>
                  savePatch({ field: "status", value: value as TaskStatus })
                }
              >
                <SelectTrigger aria-label="状态" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="todo">待办</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="done">已完成</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>优先级</FieldLabel>
              <Select
                value={currentTask.priority}
                disabled={pendingField !== null}
                onValueChange={(value) =>
                  savePatch({ field: "priority", value: value as TaskPriority })
                }
              >
                <SelectTrigger aria-label="优先级" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field data-invalid={Boolean(error?.fields?.assigneeId)}>
              <FieldLabel>负责人</FieldLabel>
              <Select
                value={currentTask.assignee?.id ?? "unassigned"}
                disabled={pendingField !== null}
                onValueChange={(value) =>
                  savePatch({
                    field: "assigneeId",
                    value: value === "unassigned" ? null : value,
                  })
                }
              >
                <SelectTrigger
                  aria-label="负责人"
                  className="w-full"
                  aria-invalid={Boolean(error?.fields?.assigneeId) || undefined}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="unassigned">未分配</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.displayName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError>{error?.fields?.assigneeId}</FieldError>
            </Field>
          </FieldGroup>

          <Separator />

          <AttachmentSection
            workspaceId={workspaceId}
            taskId={currentTask.id}
            attachments={attachments}
            onCountChange={(attachmentCount) => {
              const nextTask = { ...currentTask, attachmentCount };
              setCurrentTask(nextTask);
              onUpdated(nextTask);
            }}
          />

          <Separator />

          <CommentSection
            workspaceId={workspaceId}
            taskId={currentTask.id}
            comments={comments}
            commentsError={commentsError}
            realtimeChange={realtimeChange}
            currentUserId={currentUserId}
            workspaceRole={workspaceRole}
          />
        </div>
      </AppDrawer>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{currentTask.title}”？</AlertDialogTitle>
            <AlertDialogDescription>
              任务、评论和附件会被永久删除，活动记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingField === "delete"}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pendingField === "delete"}
              onClick={confirmDelete}
            >
              {pendingField === "delete" ? <Spinner data-icon="inline-start" /> : null}
              删除任务
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的修改？</AlertDialogTitle>
            <AlertDialogDescription>
              标题或描述尚未保存，关闭后这些修改会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setTitle(currentTask.title);
                setDescription(currentTask.description ?? "");
                setLeaveOpen(false);
                onOpenChange(false);
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
