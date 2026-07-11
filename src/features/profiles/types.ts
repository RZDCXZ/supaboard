export type ProfileActionState = {
  status: "idle" | "success" | "error";
  code?:
    | "VALIDATION_ERROR"
    | "NOT_AUTHENTICATED"
    | "FORBIDDEN"
    | "INTERNAL_ERROR";
  message: string;
  fieldErrors?: {
    displayName?: string;
  };
};

export const initialProfileActionState: ProfileActionState = {
  status: "idle",
  message: "",
};
