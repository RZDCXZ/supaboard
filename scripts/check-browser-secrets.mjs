import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const projectRoot = process.cwd();
const bundleRoot = resolve(process.argv[2] ?? ".next/static");
const logSourceRoots = (
  process.argv.length > 3
    ? process.argv.slice(3)
    : ["src", "supabase/functions"]
).map((path) => resolve(path));
const runtimeLogRoots =
  process.argv.length === 2 ? [resolve(".next/dev/logs")] : [];
const sensitiveNames = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "JWT_SECRET",
];

function readEnvSecrets(path) {
  if (!existsSync(path)) return [];

  const secrets = [];
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = rawLine.trim().match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !sensitiveNames.includes(match[1])) continue;

    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    if (value) secrets.push({ label: match[1], value });
  }

  return secrets;
}

function listFiles(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = resolve(root, entry);
    if (statSync(path).isDirectory()) files.push(...listFiles(path));
    else files.push(path);
  }
  return files;
}

if (!existsSync(bundleRoot)) {
  console.error(`浏览器构建目录不存在：${relative(projectRoot, bundleRoot)}`);
  console.error("请先运行 pnpm build，再执行 secret 扫描。");
  process.exit(1);
}

const configuredSecrets = [
  ...sensitiveNames.flatMap((name) =>
    process.env[name] ? [{ label: name, value: process.env[name] }] : [],
  ),
  ...readEnvSecrets(resolve(projectRoot, ".env.local")),
  ...readEnvSecrets(resolve(projectRoot, ".env.test.local")),
];
const markers = [
  ...sensitiveNames.map((name) => ({ label: name, value: name })),
  { label: "sb_secret_ prefix", value: "sb_secret_" },
  ...configuredSecrets,
];
const findings = [];
const bundleFiles = listFiles(bundleRoot);

function scanFilesForMarkers(files, markerPrefix = "") {
  for (const file of files) {
    const contents = readFileSync(file, "utf8");
    for (const marker of markers) {
      if (!contents.includes(marker.value)) continue;

      findings.push({
        file: relative(projectRoot, file),
        marker: `${markerPrefix}${marker.label}`,
      });
    }
  }
}

scanFilesForMarkers(bundleFiles);

for (const root of runtimeLogRoots) {
  if (!existsSync(root)) continue;

  scanFilesForMarkers(listFiles(root), "运行日志 ");
}

const logFieldPattern =
  /\b(email|password|authorization|apikey|accessToken|refreshToken|access_token|refresh_token|secretKey|serviceRoleKey|message)\b\s*[:,})]/i;
const consoleCallPattern =
  /console\.(?:debug|error|info|log|warn)\s*\(([\s\S]*?)\);/g;

for (const root of logSourceRoots) {
  if (!existsSync(root)) continue;

  for (const file of listFiles(root)) {
    const contents = readFileSync(file, "utf8");
    for (const call of contents.matchAll(consoleCallPattern)) {
      const sensitiveField = call[1].match(logFieldPattern)?.[1];
      if (!sensitiveField) continue;

      findings.push({
        file: relative(projectRoot, file),
        marker: `日志字段 ${sensitiveField}`,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("发现禁止的 secret 或日志字段：");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.marker}`);
  }
  process.exit(1);
}

console.log(
  `浏览器构建产物与应用日志调用 secret 扫描通过（${bundleFiles.length} 个构建文件）`,
);
