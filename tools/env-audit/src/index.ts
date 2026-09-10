/**
 * Credential & environment audit (run in CI and locally).
 * Exit 0 = clean, exit 2 = findings.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "out", "generated", "migrations"]);
const SOURCE_EXT = new Set([".ts", ".tsx", ".mjs", ".js", ".yml", ".yaml", ".example"]);
const ALLOWED = new Set(["NODE_ENV", "PORT"]);

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_EXT.has(path.extname(name)) || name.startsWith(".env.example")) out.push(full);
  }
  return out;
};

const problems: string[] = [];
const files = walk(ROOT);
const used = new Map<string, string[]>();
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\\\/g, "/");
  if (rel.startsWith("tools/env-audit/")) continue;
  for (const m of readFileSync(file, "utf8").matchAll(/(?:process\.env\.|process\.env\["|import\.meta\.env\.)([A-Z][A-Z0-9_]*)/g)) {
    const name = m[1];
    if (!ALLOWED.has(name)) used.set(name, [...(used.get(name) ?? []), rel]);
  }
}

const documented = new Set<string>();
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\\\/g, "/");
  const content = readFileSync(file, "utf8");
  if (rel.endsWith(".env.example")) {
    for (const m of content.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)) documented.add(m[1]);
  }
  if (rel.endsWith(".yml") || rel.endsWith(".yaml")) {
    for (const m of content.matchAll(/(?:secrets|vars)\.([A-Z][A-Z0-9_]*)/g)) documented.add(m[1]);
  }
  if (path.basename(rel) === "docker-compose.yml") {
    for (const m of content.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)) documented.add(m[1]);
  }
}
for (const [name, where] of used) {
  if (!documented.has(name)) problems.push(`env "${name}" tidak terdokumentasi: ${where.join(", ")}`);
}

try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  for (const file of tracked.filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example"))) problems.push(`file env terlacak git: ${file}`);
} catch {
  problems.push("gagal menjalankan git ls-files");
}

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "JWT-like literal"],
  [/postgres:\/\/[^\s"']*:[^\s"']+@(?!localhost)/i, "remote DB URL with password"],
  [/mysql:\/\/[^\s"']*:[^\s"']+@(?!localhost|db:)/i, "remote MySQL URL with password"],
];
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\\\/g, "/");
  if (rel.endsWith(".env.example")) continue;
  const content = readFileSync(file, "utf8");
  for (const [re, label] of SECRET_PATTERNS) if (re.test(content)) problems.push(`kemungkinan secret (${label}) di ${rel}`);
}

if (problems.length) {
  console.error("Audit kredensial gagal:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(2);
}
console.log(`Audit kredensial OK — ${used.size} env var terdokumentasi, tidak ada secret hardcode.`);
