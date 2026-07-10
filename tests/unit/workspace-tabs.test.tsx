import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import { WorkspaceTabs } from "@/features/activity/workspace-tabs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const taskId = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => `/app/workspaces/${workspaceId}`,
  useRouter: () => mocks,
  useSearchParams: () =>
    new URLSearchParams(`status=done&task=${taskId}`),
}));

beforeEach(() => {
  mocks.replace.mockReset();
});

test("WorkspaceTabs switches URL state without exposing deferred tabs", () => {
  render(<WorkspaceTabs tab="tasks" />);

  expect(screen.getByRole("tab", { name: "任务" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "活动" })).toBeVisible();
  expect(screen.queryByRole("tab", { name: "成员" })).not.toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole("tab", { name: "活动" }), {
    button: 0,
    ctrlKey: false,
  });
  expect(mocks.replace).toHaveBeenCalledWith(
    `/app/workspaces/${workspaceId}?status=done&tab=activity`,
    { scroll: false },
  );
});
