export type AuthFieldName =
  | "email"
  | "password"
  | "confirmPassword";

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  emailHint?: string;
  fieldErrors?: AuthFieldErrors;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
