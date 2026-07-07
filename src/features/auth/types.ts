export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  emailHint?: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
