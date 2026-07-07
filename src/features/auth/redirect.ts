const DEFAULT_AUTH_REDIRECT = "/app";

export function getSafeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_AUTH_REDIRECT;
  }

  return next;
}
