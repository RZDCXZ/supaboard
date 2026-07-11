"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CommentTypingPayload = {
  taskId: string;
  userId: string;
  isTyping: boolean;
};

type CommentTypingState = {
  taskId: string | null;
  userIds: string[];
};

const TYPING_THROTTLE_MS = 500;
const TYPING_TIMEOUT_MS = 2_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isCommentTypingPayload(payload: unknown): payload is CommentTypingPayload {
  if (!payload || typeof payload !== "object") return false;

  const value = payload as Record<string, unknown>;
  return (
    typeof value.taskId === "string" &&
    UUID_PATTERN.test(value.taskId) &&
    typeof value.userId === "string" &&
    UUID_PATTERN.test(value.userId) &&
    typeof value.isTyping === "boolean"
  );
}

export function useCommentTyping({
  taskId,
  currentUserId,
  sendTyping,
}: {
  taskId: string | null;
  currentUserId: string;
  sendTyping: (payload: CommentTypingPayload) => void;
}) {
  const [typingState, setTypingState] = useState<CommentTypingState>({
    taskId: null,
    userIds: [],
  });
  const typingUserIds =
    typingState.taskId === taskId ? typingState.userIds : [];
  const pendingTrueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const lastTrueSentAtRef = useRef<number | null>(null);
  const sentTypingRef = useRef(false);
  const sendTypingRef = useRef(sendTyping);

  useEffect(() => {
    sendTypingRef.current = sendTyping;
  }, [sendTyping]);

  const sendState = useCallback(
    (isTyping: boolean) => {
      if (!taskId) return;

      sendTypingRef.current({ taskId, userId: currentUserId, isTyping });
      sentTypingRef.current = isTyping;
      lastTrueSentAtRef.current = isTyping ? Date.now() : null;
    },
    [currentUserId, taskId],
  );

  const clearLocalTimers = useCallback(() => {
    if (pendingTrueTimerRef.current) {
      clearTimeout(pendingTrueTimerRef.current);
      pendingTrueTimerRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const clearRemoteTyping = useCallback(() => {
    for (const timer of remoteTimersRef.current.values()) clearTimeout(timer);
    remoteTimersRef.current.clear();
    setTypingState({ taskId: null, userIds: [] });
  }, []);

  const stopTyping = useCallback(() => {
    clearLocalTimers();
    if (sentTypingRef.current) sendState(false);
  }, [clearLocalTimers, sendState]);

  const notifyTyping = useCallback(
    (isTyping: boolean) => {
      if (!taskId) return;

      if (!isTyping) {
        stopTyping();
        return;
      }

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      stopTimerRef.current = setTimeout(stopTyping, TYPING_TIMEOUT_MS);

      const lastSentAt = lastTrueSentAtRef.current;
      const elapsed = lastSentAt === null ? TYPING_THROTTLE_MS : Date.now() - lastSentAt;
      if (elapsed >= TYPING_THROTTLE_MS) {
        if (pendingTrueTimerRef.current) {
          clearTimeout(pendingTrueTimerRef.current);
          pendingTrueTimerRef.current = null;
        }
        sendState(true);
        return;
      }

      if (!pendingTrueTimerRef.current) {
        pendingTrueTimerRef.current = setTimeout(() => {
          pendingTrueTimerRef.current = null;
          sendState(true);
        }, TYPING_THROTTLE_MS - elapsed);
      }
    },
    [sendState, stopTyping, taskId],
  );

  const handleTypingEvent = useCallback(
    (payload: unknown) => {
      if (
        !taskId ||
        !isCommentTypingPayload(payload) ||
        payload.taskId !== taskId ||
        payload.userId === currentUserId
      ) {
        return;
      }

      const currentTimer = remoteTimersRef.current.get(payload.userId);
      if (currentTimer) clearTimeout(currentTimer);

      if (!payload.isTyping) {
        remoteTimersRef.current.delete(payload.userId);
        setTypingState((current) => ({
          taskId,
          userIds: (current.taskId === taskId ? current.userIds : []).filter(
            (userId) => userId !== payload.userId,
          ),
        }));
        return;
      }

      setTypingState((current) => {
        const currentUserIds =
          current.taskId === taskId ? current.userIds : [];
        return {
          taskId,
          userIds: currentUserIds.includes(payload.userId)
            ? currentUserIds
            : [...currentUserIds, payload.userId].toSorted(),
        };
      });
      remoteTimersRef.current.set(
        payload.userId,
        setTimeout(() => {
          remoteTimersRef.current.delete(payload.userId);
          setTypingState((current) => ({
            taskId,
            userIds: (current.taskId === taskId ? current.userIds : []).filter(
              (userId) => userId !== payload.userId,
            ),
          }));
        }, TYPING_TIMEOUT_MS),
      );
    },
    [currentUserId, taskId],
  );

  const clearTyping = useCallback(() => {
    clearLocalTimers();
    clearRemoteTyping();
    lastTrueSentAtRef.current = null;
    sentTypingRef.current = false;
  }, [clearLocalTimers, clearRemoteTyping]);

  useEffect(() => {
    const remoteTimers = remoteTimersRef.current;

    return () => {
      clearLocalTimers();
      for (const timer of remoteTimers.values()) clearTimeout(timer);
      remoteTimers.clear();

      if (sentTypingRef.current && taskId) {
        sendTypingRef.current({
          taskId,
          userId: currentUserId,
          isTyping: false,
        });
      }
      lastTrueSentAtRef.current = null;
      sentTypingRef.current = false;
    };
  }, [clearLocalTimers, currentUserId, taskId]);

  return { typingUserIds, notifyTyping, handleTypingEvent, clearTyping };
}
