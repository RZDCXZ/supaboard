import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createTaskInputSchema } from "@/features/tasks/validation";

const stableSuffixes = ["011", "012", "013", "101", "102"] as const;

describe("local Seed identifiers", () => {
  it("keeps deterministic actor and workspace IDs compatible with task input validation", () => {
    const seedSql = readFileSync("supabase/seed.sql", "utf8");
    const seedIds = [
      ...new Set(
        [...seedSql.matchAll(/'([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})'/gi)]
          .map((match) => match[1])
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const idBySuffix = Object.fromEntries(
      stableSuffixes.map((suffix) => [
        suffix,
        seedIds.find((id) => id.endsWith(suffix)),
      ]),
    );

    for (const suffix of stableSuffixes) {
      expect(idBySuffix[suffix], `missing Seed UUID suffix ${suffix}`).toBeDefined();
    }

    for (const workspaceSuffix of ["101", "102"] as const) {
      for (const actorSuffix of ["011", "012", "013"] as const) {
        const result = createTaskInputSchema.safeParse({
          workspaceId: idBySuffix[workspaceSuffix],
          title: "Seed task",
          assigneeId: idBySuffix[actorSuffix],
        });

        expect(
          result.success,
          `Seed UUIDs ${workspaceSuffix}/${actorSuffix} must pass task validation`,
        ).toBe(true);
      }
    }
  });
});
