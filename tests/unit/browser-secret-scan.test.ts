import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const scannerPath = join(process.cwd(), "scripts/check-browser-secrets.mjs");

function runScanner(
  contents: string,
  secretValue?: string,
  logSource?: string,
) {
  const root = mkdtempSync(join(tmpdir(), "supaboard-secret-scan-"));
  const chunks = join(root, "chunks");
  mkdirSync(chunks);
  writeFileSync(join(chunks, "app.js"), contents);
  const args = [scannerPath, root];

  if (logSource) {
    const logs = join(root, "logs");
    mkdirSync(logs);
    writeFileSync(join(logs, "actions.js"), logSource);
    args.push(logs);
  }

  return spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_SECRET_KEY: secretValue,
    },
  });
}

describe("browser bundle secret scan", () => {
  it("passes a bundle containing only public configuration", () => {
    const result = runScanner(
      'const url="http://127.0.0.1:54321"; const key="sb_publishable_example";',
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("浏览器构建产物与应用日志调用 secret 扫描通过");
  });

  it("rejects secret-like variable names without printing secret values", () => {
    const secret = "sb_secret_do-not-print";
    const result = runScanner(
      `const SUPABASE_SECRET_KEY="${secret}";`,
      secret,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("app.js");
    expect(result.stderr).toContain("SUPABASE_SECRET_KEY");
    expect(result.stderr).not.toContain(secret);
  });

  it("rejects sensitive fields in application log calls", () => {
    const result = runScanner(
      "const safe = true;",
      undefined,
      'console.error("request failed", { email });',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("actions.js");
    expect(result.stderr).toContain("email");
  });

  it("rejects raw database messages in application log calls", () => {
    const result = runScanner(
      "const safe = true;",
      undefined,
      'console.error("database failed", { code: error.code, message: error.message });',
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("message");
  });
});
