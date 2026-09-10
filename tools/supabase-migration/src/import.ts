/**
 * Import exported KV JSON into MySQL via Prisma (idempotent upserts).
 * Env: DATABASE_URL (MySQL target), out/ from export step.
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const OUT = path.resolve("out");
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 220) || "post";

const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const sourceHash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const readJson = (name: string) => JSON.parse(readFileSync(path.join(OUT, name), "utf8"));
const assertSource = (manifest: any, key: string, value: unknown) => {
  const expected = manifest[key]?.sha256 ?? null;
  const actual = value == null ? null : sourceHash(value);
  if (expected !== actual) throw new Error(`${key}.json checksum tidak cocok dengan export-manifest.json`);
};
const exactResult = (expected: number, actual: number) => ({ expected, actual, status: expected === actual ? "ok" : "mismatch" });

async function main() {
  if (!existsSync(path.join(OUT, "export-manifest.json"))) {
    console.error("out/export-manifest.json tidak ditemukan — jalankan export dulu.");
    process.exit(1);
  }

  const manifest = readJson("export-manifest.json");
  const results: Record<string, { expected: number; actual: number; status: string }> = {};
  const posts = readJson("posts.json");
  assertSource(manifest, "posts", posts);
  const postRows = asArray(posts);
  const seenSlugs = new Map<string, string>();
  for (const p of postRows) {
    if (!p?.title) continue;
    const slug = slugify(p.slug || p.title);
    const sourceTitle = String(p.title);
    const priorTitle = seenSlugs.get(slug);
    if (priorTitle && priorTitle !== sourceTitle) throw new Error(`Slug post collision: "${priorTitle}" dan "${sourceTitle}" -> "${slug}"`);
    seenSlugs.set(slug, sourceTitle);
    const data = {
      title: String(p.title).slice(0, 220),
      category: String(p.category || "Umum").slice(0, 80),
      excerpt: p.excerpt ?? null,
      content: p.content ?? null,
      image: p.image ?? null,
      readTime: p.readTime ?? null,
      status: (p.status === "published" ? "published" : "draft") as "published" | "draft",
      date: p.date ? new Date(p.date) : new Date(),
    };
    await prisma.post.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  }
  const importedSlugs = [...seenSlugs.keys()];
  const importedPostCount = importedSlugs.length ? await prisma.post.count({ where: { deletedAt: null, slug: { in: importedSlugs } } }) : 0;
  results.posts = exactResult(importedSlugs.length, importedPostCount);

  const subscribers = readJson("subscribers.json");
  assertSource(manifest, "subscribers", subscribers);
  const subscriberRows = asArray(subscribers);
  for (const s of subscriberRows) {
    if (!s?.email) continue;
    const email = String(s.email).toLowerCase();
    await prisma.subscriber.upsert({ where: { email }, create: { email }, update: {} });
  }
  const importedEmails = subscriberRows.filter((s) => !!s?.email).map((s) => String(s.email).toLowerCase());
  const subCount = importedEmails.length ? await prisma.subscriber.count({ where: { email: { in: importedEmails } } }) : 0;
  results.subscribers = exactResult(importedEmails.length, subCount);

  const pmb = readJson("pmb.json");
  assertSource(manifest, "pmb", pmb);
  const pmbRows = asArray(pmb);
  for (const r of pmbRows) {
    if (!r?.name || !r?.email) continue;
    const key = (() => { const value = String(r.id ?? r.idempotencyKey ?? sourceHash(r)); return value.length <= 64 ? value : sourceHash(value); })();
    const data = {
      name: String(r.name).slice(0, 160),
      email: String(r.email).slice(0, 320),
      phone: String(r.phone ?? "").slice(0, 40),
      school: r.school ?? null,
      program: r.program ?? null,
      message: r.message ?? null,
      status: ["baru", "diproses", "diterima", "ditolak"].includes(r.status) ? r.status : "baru",
    };
    await prisma.pmbRegistration.upsert({ where: { idempotencyKey: key }, create: { idempotencyKey: key, ...data }, update: data });
  }
  const importedPmbKeys = pmbRows.filter((r) => !!r?.name && !!r?.email).map((r) => { const value = String(r.id ?? r.idempotencyKey ?? sourceHash(r)); return value.length <= 64 ? value : sourceHash(value); });
  const pmbCount = importedPmbKeys.length ? await prisma.pmbRegistration.count({ where: { deletedAt: null, idempotencyKey: { in: importedPmbKeys } } }) : 0;
  results.pmb = exactResult(importedPmbKeys.length, pmbCount);

  const gallery = readJson("gallery.json");
  assertSource(manifest, "gallery", gallery);
  const galleryRows = asArray(gallery);
  for (const g of galleryRows) {
    if (!g?.image) continue;
    const image = String(g.image);
    const imageHash = sourceHash(image);
    await prisma.galleryItem.upsert({ where: { imageHash }, create: { image, imageHash, caption: g.caption ?? null, link: g.link ?? null }, update: { image, caption: g.caption ?? null, link: g.link ?? null } });
  }
  const galleryExpected = galleryRows.filter((g) => g?.image).length;
  const importedImageHashes = galleryRows.filter((g) => g?.image).map((g) => sourceHash(String(g.image)));
  const galleryCount = importedImageHashes.length ? await prisma.galleryItem.count({ where: { imageHash: { in: importedImageHashes } } }) : 0;
  results.gallery = exactResult(galleryExpected, galleryCount);

  const content = readJson("content.json");
  assertSource(manifest, "content", content);
  const contentRow = await prisma.siteContent.upsert({ where: { key: "main" }, create: { key: "main", data: content }, update: { data: content } });
  const contentOk = (content == null) === (contentRow.data == null);
  results.content = { expected: content == null ? 0 : 1, actual: contentRow?.data != null ? 1 : 0, status: contentOk ? "ok" : "mismatch" };

  // stats: stored inside content JSON in the legacy system; also importable standalone
  const stats = readJson("stats.json");
  assertSource(manifest, "stats", stats);
  const statRows = asArray(stats);
  if (statRows.length > 100) throw new Error("stats.json melebihi batas 100 baris.");
  await prisma.$transaction([
    prisma.siteStat.deleteMany(),
    ...statRows.slice(0, 100).map((st: any, i: number) =>
      prisma.siteStat.create({ data: { value: Number(st.value) || 0, suffix: String(st.suffix ?? "").slice(0, 20), label: String(st.label ?? "").slice(0, 160), ord: i } }),
    ),
  ]);
  const statCount = await prisma.siteStat.count();
  results.stats = exactResult(statRows.length, statCount);

  writeFileSync(path.join(OUT, "import-manifest.json"), JSON.stringify({ results, at: new Date().toISOString() }, null, 2), "utf8");
  console.log(JSON.stringify(results, null, 2));
  const bad = Object.entries(results).filter(([, r]) => r.status !== "ok");
  if (bad.length) {
    console.error(`MISMATCH: ${bad.map(([k]) => k).join(", ")}`);
    process.exit(2);
  }
  console.log("Import selesai — semua cocok.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
