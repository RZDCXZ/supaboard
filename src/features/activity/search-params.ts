import type { WorkspaceView } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseActivityPage(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function parseWorkspaceViewSearchParams(
  searchParams: SearchParams,
): WorkspaceView {
  return {
    tab: first(searchParams.tab) === "activity" ? "activity" : "tasks",
    activityPage: parseActivityPage(first(searchParams.activityPage)),
  };
}
