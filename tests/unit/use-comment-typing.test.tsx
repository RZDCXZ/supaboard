import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCommentTyping } from "@/features/realtime/use-comment-typing";

const taskId = "11111111-1111-4111-8111-111111111111";
const nextTaskId = "22222222-2222-4222-8222-222222222222";
const aliceId = "33333333-3333-4333-8333-333333333333";
const bobId = "44444444-4444-4444-8444-444444444444";

describe("useCommentTyping", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throttles true broadcasts and sends false two seconds after input stops", () => {
    const sendTyping = vi.fn();
    const { result } = renderHook(() =>
      useCommentTyping({ taskId, currentUserId: aliceId, sendTyping }),
    );

    act(() => result.current.notifyTyping(true));
    expect(sendTyping).toHaveBeenLastCalledWith({
      taskId,
      userId: aliceId,
      isTyping: true,
    });

    act(() => {
      vi.advanceTimersByTime(100);
      result.current.notifyTyping(true);
      vi.advanceTimersByTime(100);
      result.current.notifyTyping(true);
    });
    expect(sendTyping).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(300));
    expect(sendTyping).toHaveBeenCalledTimes(2);
    expect(sendTyping).toHaveBeenLastCalledWith({
      taskId,
      userId: aliceId,
      isTyping: true,
    });

    act(() => vi.advanceTimersByTime(1_699));
    expect(sendTyping).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1));
    expect(sendTyping).toHaveBeenLastCalledWith({
      taskId,
      userId: aliceId,
      isTyping: false,
    });
  });

  it("expires remote typing and ignores unrelated or malformed payloads", () => {
    const { result } = renderHook(() =>
      useCommentTyping({ taskId, currentUserId: aliceId, sendTyping: vi.fn() }),
    );

    act(() => {
      result.current.handleTypingEvent({ taskId, userId: bobId, isTyping: true });
      result.current.handleTypingEvent({
        taskId: nextTaskId,
        userId: "55555555-5555-4555-8555-555555555555",
        isTyping: true,
      });
      result.current.handleTypingEvent({ taskId, userId: aliceId, isTyping: true });
      result.current.handleTypingEvent({ taskId, userId: "invalid", isTyping: true });
    });
    expect(result.current.typingUserIds).toEqual([bobId]);

    act(() => vi.advanceTimersByTime(1_999));
    expect(result.current.typingUserIds).toEqual([bobId]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.typingUserIds).toEqual([]);

    act(() => {
      result.current.handleTypingEvent({ taskId, userId: bobId, isTyping: true });
      result.current.handleTypingEvent({ taskId, userId: bobId, isTyping: false });
    });
    expect(result.current.typingUserIds).toEqual([]);
  });

  it("cleans local and remote state when switching tasks", () => {
    const sendTyping = vi.fn();
    const { result, rerender } = renderHook(
      ({ currentTaskId }) =>
        useCommentTyping({
          taskId: currentTaskId,
          currentUserId: aliceId,
          sendTyping,
        }),
      { initialProps: { currentTaskId: taskId as string | null } },
    );

    act(() => {
      result.current.notifyTyping(true);
      result.current.handleTypingEvent({ taskId, userId: bobId, isTyping: true });
    });
    expect(result.current.typingUserIds).toEqual([bobId]);

    rerender({ currentTaskId: nextTaskId });

    expect(sendTyping).toHaveBeenLastCalledWith({
      taskId,
      userId: aliceId,
      isTyping: false,
    });
    expect(result.current.typingUserIds).toEqual([]);
  });

  it("clears timers and sends false when the page leaves", () => {
    const sendTyping = vi.fn();
    const { result, unmount } = renderHook(() =>
      useCommentTyping({ taskId, currentUserId: aliceId, sendTyping }),
    );

    act(() => result.current.notifyTyping(true));
    unmount();
    act(() => vi.runAllTimers());

    expect(sendTyping).toHaveBeenCalledTimes(2);
    expect(sendTyping).toHaveBeenLastCalledWith({
      taskId,
      userId: aliceId,
      isTyping: false,
    });
  });
});
