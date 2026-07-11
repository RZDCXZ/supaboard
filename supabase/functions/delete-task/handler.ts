import { z } from "zod";

const deleteTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;

export type DeleteTaskServices = {
  userId: string | null;
  requestId: string;
  canDeleteTask: (input: DeleteTaskInput) => Promise<boolean>;
  listAttachmentPaths: (input: DeleteTaskInput) => Promise<string[] | null>;
  removeAttachmentObjects: (paths: readonly string[]) => Promise<boolean>;
  deleteTask: (input: DeleteTaskInput) => Promise<boolean>;
};

type DeleteTaskErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "VALIDATION_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "ATTACHMENT_CLEANUP_FAILED"
  | "TASK_DELETE_FAILED";

function errorResponse(
  status: number,
  code: DeleteTaskErrorCode,
  message: string,
  requestId: string,
) {
  return Response.json(
    { error: { code, message, requestId } },
    { status },
  );
}

export async function handleDeleteTaskRequest(
  request: Request,
  services: DeleteTaskServices,
) {
  if (request.method !== "POST") {
    return errorResponse(
      405,
      "METHOD_NOT_ALLOWED",
      "仅支持 POST 请求",
      services.requestId,
    );
  }

  if (!services.userId) {
    return errorResponse(
      401,
      "NOT_AUTHENTICATED",
      "请先登录后再删除任务",
      services.requestId,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "请求参数不正确",
      services.requestId,
    );
  }

  const parsed = deleteTaskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "请求参数不正确",
      services.requestId,
    );
  }

  if (!(await services.canDeleteTask(parsed.data))) {
    return errorResponse(
      403,
      "FORBIDDEN",
      "任务不存在或你没有权限删除",
      services.requestId,
    );
  }

  const paths = await services.listAttachmentPaths(parsed.data);
  if (paths === null || !(await services.removeAttachmentObjects(paths))) {
    console.error("delete-task attachment cleanup failed", {
      requestId: services.requestId,
    });
    return errorResponse(
      500,
      "ATTACHMENT_CLEANUP_FAILED",
      "附件清理失败，任务尚未删除，请稍后重试",
      services.requestId,
    );
  }

  if (!(await services.deleteTask(parsed.data))) {
    console.error("delete-task database delete failed", {
      requestId: services.requestId,
    });
    return errorResponse(
      500,
      "TASK_DELETE_FAILED",
      "附件已清理，但任务删除失败，请重试",
      services.requestId,
    );
  }

  return Response.json({ taskId: parsed.data.taskId });
}

