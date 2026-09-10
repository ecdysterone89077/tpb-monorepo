/**
 * Export Supabase KV store to JSON files + manifest with SHA-256 checksums.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (never committed), optional SUPABASE_KV_TABLE.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi (env).");
  process.exit(1);
}

const TABLE = process.env.SUPABASE_KV_TABLE || "kv_store_1860c1e8";
const OUT = path.resolve("out");
mkdirSync(OUT, { recursive: true });

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const KEYS = ["posts", "stats", "subscribers", "pmb", "gallery", "content"] as const;
type Key = (typeof KEYS)[number];

async function fetchKey(key: Key): Promise<unknown> {
  const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(`Gagal membaca "${key}": ${error.message}`);
  return data?.value ?? null;
}

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

async function main() {
  const manifest: Record<string, { present: boolean; sha256: string | null; rows: number | null }> = {};
  for (const key of KEYS) {
    const value = await fetchKey(key);
    const present = value != null;
    const file = path.join(OUT, `${key}.json`);
    writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
    manifest[key] = { present, sha256: present ? sha(value) : null, rows: Array.isArray(value) ? value.length : present ? 1 : 0 };
    console.log(`${key}: ${present ? `${manifest[key].rows} rows` : "absent"}`);
  }
  writeFileSync(path.join(OUT, "export-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log("export-manifest.json written to", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
