"use client";

import { MessageSquareIcon, Trash2Icon } from "lucide-react";
import { useEffect, useReducer, useState, useTransition } from "react";
import { toast } from "sonner";

import { InlineAlert } from "@/components/feedback/inline-alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { WorkspaceRole } from "@/features/workspaces/types";
import type { WorkspaceChange } from "@/features/realtime/reducer";
import { formatFullDateTime, formatRelativeDateTime } from "@/lib/date-time";

import { createComment, deleteComment } from "./actions";
import { commentReducer } from "./reducer";
import type { CommentItem } from "./types";

function avatarFallback(displayName: string) {
  return displayName.trim().slice(0, 1).toUpperCase() || "用";
}

const NOOP_TYPING_CHANGE = () => undefined;

export function CommentSection({
  workspaceId,
  taskId,
  comments,
  commentsError = false,
  realtimeChange = null,
  currentUserId,
  workspaceRole,
  typingMembers = [],
  onTypingChange = NOOP_TYPING_CHANGE,
}: {
  workspaceId: string;
  taskId: string;
  comments: readonly CommentItem[];
  commentsError?: boolean;
  realtimeChange?: WorkspaceChange | null;
  currentUserId: string;
  workspaceRole: WorkspaceRole;
  typingMembers?: readonly { id: string; displayName: string }[];
  onTypingChange?: (isTyping: boolean) => void;
}) {
  const [currentComments, dispatchComments] = useReducer(
    commentReducer,
    comments,
    (initialComments) =>
      commentReducer([], { type: "replace", comments: initialComments }),
  );
  const [body, setBody] = useState("");
  const [pendingOperation, setPendingOperation] = useState<
    "create" | string | null
  >(null);
  const [error, setError] = useState<{
    message: string;
    fields?: Record<string, string>;
  } | null>(null);
  const [, startTransition] = useTransition();
  const trimmedBody = body.trim();
  const canSubmit =
    pendingOperation === null &&
    trimmedBody.length >= 1 &&
    trimmedBody.length <= 2000;
  const typingMessage =
    typingMembers.length === 0
      ? null
      : `${typingMembers
          .slice(0, 2)
          .map(({ displayName }) => displayName)
          .join("、")}${
          typingMembers.length > 2 ? ` 等 ${typingMembers.length} 人` : ""
        } 正在输入…`;

  useEffect(() => {
    dispatchComments({ type: "replace", comments });
  }, [comments]);

  useEffect(() => {
    if (
      realtimeChange?.table === "comments" &&
      realtimeChange.eventType === "DELETE"
    ) {
      dispatchComments({
        type: "remove",
        commentId: realtimeChange.id,
      });
    }
  }, [realtimeChange]);

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setPendingOperation("create");
    onTypingChange(false);
    startTransition(async () => {
      const result = await createComment({ workspaceId, taskId, body });
      setPendingOperation(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      dispatchComments({ type: "upsert", comment: result.data });
      setBody("");
      toast.success("评论已发表");
    });
  }

  function removeComment(commentId: string) {
    setError(null);
    setPendingOperation(commentId);
    startTransition(async () => {
      const result = await deleteComment({ workspaceId, taskId, commentId });
      setPendingOperation(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      dispatchComments({ type: "remove", commentId: result.data });
      toast.success("评论已删除");
    });
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="task-comments-title">
      <div>
        <h3 id="task-comments-title" className="font-medium">
          评论
        </h3>
        <p className="text-sm text-muted-foreground">
          与工作区成员讨论当前任务。
        </p>
      </div>

      {commentsError ? (
        <InlineAlert variant="error" title="评论加载失败">
          暂时无法读取已有评论，仍可以尝试发表评论。
        </InlineAlert>
      ) : null}

      {typingMessage ? (
        <p
          role="status"
          aria-label="评论输入状态"
          aria-live="polite"
          className="text-sm text-muted-foreground"
        >
          {typingMessage}
        </p>
      ) : null}

      {currentComments.length === 0 && !commentsError ? (
        <Empty className="min-h-36 border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquareIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>还没有评论</EmptyTitle>
            <EmptyDescription>开始讨论吧。</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="评论列表">
          {currentComments.map((comment) => {
            const canDelete =
              workspaceRole === "owner" || comment.author.id === currentUserId;

            return (
              <li key={comment.id} className="flex gap-3">
                <Avatar size="sm">
                  {comment.author.avatarUrl ? (
                    <AvatarImage
                      src={comment.author.avatarUrl}
                      alt={`${comment.author.displayName}的头像`}
                    />
                  ) : null}
                  <AvatarFallback>
                    {avatarFallback(comment.author.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {comment.author.displayName}
                      </p>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={comment.createdAt}
                        title={formatFullDateTime(comment.createdAt)}
                        suppressHydrationWarning
                      >
                        {formatRelativeDateTime(comment.createdAt)}
                      </time>
                    </div>
                    {canDelete ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`删除 ${comment.author.displayName} 的评论`}
                        disabled={pendingOperation !== null}
                        onClick={() => removeComment(comment.id)}
                      >
                        {pendingOperation === comment.id ? (
                          <Spinner />
                        ) : (
                          <Trash2Icon aria-hidden="true" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm break-words">
                    {comment.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <InlineAlert variant="error">{error.message}</InlineAlert> : null}

      <form onSubmit={submitComment}>
        <FieldGroup>
          <Field data-invalid={Boolean(error?.fields?.body)}>
            <FieldLabel htmlFor="task-comment-body">评论</FieldLabel>
            <Textarea
              id="task-comment-body"
              value={body}
              maxLength={2000}
              disabled={pendingOperation !== null}
              aria-invalid={Boolean(error?.fields?.body) || undefined}
              aria-describedby="task-comment-count"
              className="min-h-24"
              onChange={(event) => {
                const nextBody = event.target.value;
                setBody(nextBody);
                onTypingChange(nextBody.trim().length > 0);
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <FieldError>{error?.fields?.body}</FieldError>
              <p
                id="task-comment-count"
                className="ml-auto text-xs text-muted-foreground"
                aria-live="polite"
              >
                {body.length} / 2000
              </p>
            </div>
            <Button type="submit" className="w-fit" disabled={!canSubmit}>
              {pendingOperation === "create" ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              发表评论
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </section>
  );
}
