import { z } from "zod";

export const addMemberByEmailSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(320),
});

export type AddMemberByEmailInput = z.infer<typeof addMemberByEmailSchema>;
