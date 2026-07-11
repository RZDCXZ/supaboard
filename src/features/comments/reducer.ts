import type { CommentItem } from "./types";

export type CommentReducerAction =
  | { type: "replace"; comments: readonly CommentItem[] }
  | { type: "upsert"; comment: CommentItem }
  | { type: "remove"; commentId: string };

function byCreatedAt(a: CommentItem, b: CommentItem) {
  const byDate = a.createdAt.localeCompare(b.createdAt);
  return byDate === 0 ? a.id.localeCompare(b.id) : byDate;
}

export function commentReducer(
  state: readonly CommentItem[],
  action: CommentReducerAction,
): CommentItem[] {
  if (action.type === "replace") {
    return [...action.comments].sort(byCreatedAt);
  }

  if (action.type === "remove") {
    return state.filter(({ id }) => id !== action.commentId);
  }

  const next = state.filter(({ id }) => id !== action.comment.id);
  next.push(action.comment);
  return next.sort(byCreatedAt);
}
