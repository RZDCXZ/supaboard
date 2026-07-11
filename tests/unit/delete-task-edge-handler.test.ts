import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleDeleteTaskRequest,
  type DeleteTaskServices,
} from "../../supabase/functions/delete-task/handler";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown, method = "POST") {
  return new Request("http://localhost/functions/v1/delete-task", {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function services(
  overrides: Partial<DeleteTaskServices> = {},
): DeleteTaskServices {
  return {
    userId: "33333333-3333-4333-8333-333333333333",
    requestId: "request-123",
    canDeleteTask: vi.fn().mockResolvedValue(true),
    listAttachmentPaths: vi.fn().mockResolvedValue(["workspace/task/file.txt"]),
    removeAttachmentObjects: vi.fn().mockResolvedValue(true),
    deleteTask: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("delete-task Edge handler", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("rejects unsupported methods", async () => {
    const response = await handleDeleteTaskRequest(request(null, "GET"), services());
    expect(response.status).toBe(405);
  });

  it("rejects invalid identifiers", async () => {
    const response = await handleDeleteTaskRequest(
      request({ workspaceId: "bad", taskId }),
      services(),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR", requestId: "request-123" },
    });
  });

  it("rejects missing authenticated user context", async () => {
    const response = await handleDeleteTaskRequest(
      request({ workspaceId, taskId }),
      services({ userId: null }),
    );
    expect(response.status).toBe(401);
  });

  it("does not use privileged cleanup before user authorization", async () => {
    const removeAttachmentObjects = vi.fn();
    const response = await handleDeleteTaskRequest(
      request({ workspaceId, taskId }),
      services({
        canDeleteTask: vi.fn().mockResolvedValue(false),
        removeAttachmentObjects,
      }),
    );
    expect(response.status).toBe(403);
    expect(removeAttachmentObjects).not.toHaveBeenCalled();
  });

  it("keeps the task when attachment cleanup fails", async () => {
    const deleteTask = vi.fn();
    const response = await handleDeleteTaskRequest(
      request({ workspaceId, taskId }),
      services({
        removeAttachmentObjects: vi.fn().mockResolvedValue(false),
        deleteTask,
      }),
    );
    expect(response.status).toBe(500);
    expect(deleteTask).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "ATTACHMENT_CLEANUP_FAILED" },
    });
  });

  it("reports task deletion failure after successful cleanup", async () => {
    const response = await handleDeleteTaskRequest(
      request({ workspaceId, taskId }),
      services({ deleteTask: vi.fn().mockResolvedValue(false) }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TASK_DELETE_FAILED" },
    });
  });

  it("cleans objects before deleting the task and returns its id", async () => {
    const events: string[] = [];
    const removeAttachmentObjects = vi.fn(async () => {
      events.push("objects");
      return true;
    });
    const deleteTask = vi.fn(async () => {
      events.push("task");
      return true;
    });
    const response = await handleDeleteTaskRequest(
      request({ workspaceId, taskId }),
      services({ removeAttachmentObjects, deleteTask }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ taskId });
    expect(events).toEqual(["objects", "task"]);
  });
});
