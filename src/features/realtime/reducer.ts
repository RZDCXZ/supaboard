export type WorkspaceChangeTable = "tasks" | "comments";

export type WorkspaceChangeEventType = "INSERT" | "UPDATE" | "DELETE";

export type WorkspaceChange = {
  table: WorkspaceChangeTable;
  eventType: WorkspaceChangeEventType;
  id: string;
  commitTimestamp: string | null;
};

export type WorkspaceChangeInput = {
  table: unknown;
  eventType: unknown;
  id: unknown;
  commitTimestamp: unknown;
};

type EntityVersion = Pick<WorkspaceChange, "eventType" | "commitTimestamp">;

export type WorkspaceChangeState = {
  revision: number;
  latestChange: WorkspaceChange | null;
  versions: Readonly<Record<string, EntityVersion>>;
};

export const initialWorkspaceChangeState: WorkspaceChangeState = {
  revision: 0,
  latestChange: null,
  versions: {},
};

function parseWorkspaceChange(input: WorkspaceChangeInput): WorkspaceChange | null {
  if (input.table !== "tasks" && input.table !== "comments") return null;
  if (
    input.eventType !== "INSERT" &&
    input.eventType !== "UPDATE" &&
    input.eventType !== "DELETE"
  ) {
    return null;
  }
  if (typeof input.id !== "string" || input.id.length === 0) return null;

  if (input.eventType === "DELETE") {
    return {
      table: input.table,
      eventType: input.eventType,
      id: input.id,
      commitTimestamp: null,
    };
  }

  if (
    typeof input.commitTimestamp !== "string" ||
    input.commitTimestamp.length === 0
  ) {
    return null;
  }

  return {
    table: input.table,
    eventType: input.eventType,
    id: input.id,
    commitTimestamp: input.commitTimestamp,
  };
}

export function workspaceChangeReducer(
  state: WorkspaceChangeState,
  input: WorkspaceChangeInput,
): WorkspaceChangeState {
  const change = parseWorkspaceChange(input);
  if (!change) return state;

  const key = `${change.table}:${change.id}`;
  const current = state.versions[key];

  if (current?.eventType === "DELETE") return state;
  if (
    change.eventType !== "DELETE" &&
    current?.commitTimestamp &&
    current.commitTimestamp >= change.commitTimestamp!
  ) {
    return state;
  }

  return {
    revision: state.revision + 1,
    latestChange: change,
    versions: {
      ...state.versions,
      [key]: {
        eventType: change.eventType,
        commitTimestamp: change.commitTimestamp,
      },
    },
  };
}
