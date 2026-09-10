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
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 190) || "post";

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

async function main() {
  if (!existsSync(path.join(OUT, "export-manifest.json"))) {
    console.error("out/export-manifest.json tidak ditemukan — jalankan export dulu.");
    process.exit(1);
  }

  const results: Record<string, { expected: number; actual: number; status: string }> = {};
  const posts = asArray(JSON.parse(readFileSync(path.join(OUT, "posts.json"), "utf8")));
  let postsOk = 0;
  for (const p of posts) {
    if (!p?.title) continue;
    let slug = slugify(p.slug || p.title);
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
    postsOk++;
  }
  results.posts = { expected: posts.length, actual: postsOk, status: postsOk >= posts.length ? "ok" : "mismatch" };

  const subscribers = asArray(JSON.parse(readFileSync(path.join(OUT, "subscribers.json"), "utf8")));
  for (const s of subscribers) {
    if (!s?.email) continue;
    const email = String(s.email).toLowerCase();
    await prisma.subscriber.upsert({ where: { email }, create: { email }, update: {} });
  }
  const subCount = await prisma.subscriber.count();
  results.subscribers = { expected: subscribers.length, actual: subCount, status: subCount >= subscribers.length ? "ok" : "mismatch" };

  const pmb = asArray(JSON.parse(readFileSync(path.join(OUT, "pmb.json"), "utf8")));
  for (const r of pmb) {
    if (!r?.name || !r?.email) continue;
    const key = String(r.id ?? r.idempotencyKey ?? crypto.randomUUID()).slice(0, 64);
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
  const pmbCount = await prisma.pmbRegistration.count({ where: { deletedAt: null } });
  results.pmb = { expected: pmb.length, actual: pmbCount, status: pmbCount >= pmb.length ? "ok" : "mismatch" };

  const gallery = asArray(JSON.parse(readFileSync(path.join(OUT, "gallery.json"), "utf8")));
  const galleryCountBefore = await prisma.galleryItem.count();
  for (const g of gallery) {
    if (!g?.image) continue;
    await prisma.galleryItem.create({ data: { image: String(g.image), caption: g.caption ?? null, link: g.link ?? null } });
  }
  const galleryExpected = gallery.filter((g) => g?.image).length;
  const galleryCount = await prisma.galleryItem.count();
  results.gallery = { expected: galleryExpected, actual: galleryCount, status: galleryCount >= galleryExpected ? "ok" : "mismatch" };

  const content = JSON.parse(readFileSync(path.join(OUT, "content.json"), "utf8"));
  if (content != null) {
    await prisma.siteContent.upsert({ where: { key: "main" }, create: { key: "main", data: content }, update: { data: content } });
  }
  const contentRow = await prisma.siteContent.findUnique({ where: { key: "main" } });
  const contentOk = (content == null) === (contentRow?.data == null);
  results.content = { expected: content == null ? 0 : 1, actual: contentRow?.data != null ? 1 : 0, status: contentOk ? "ok" : "mismatch" };

  // stats: stored inside content JSON in the legacy system; also importable standalone
  const stats = asArray(JSON.parse(readFileSync(path.join(OUT, "stats.json"), "utf8")));
  if (stats.length > 0) {
    await prisma.$transaction([
      prisma.siteStat.deleteMany(),
      ...stats.slice(0, 100).map((st: any, i: number) =>
        prisma.siteStat.create({ data: { value: Number(st.value) || 0, suffix: String(st.suffix ?? "").slice(0, 20), label: String(st.label ?? "").slice(0, 160), ord: i } }),
      ),
    ]);
  }
  const statCount = await prisma.siteStat.count();
  results.stats = { expected: stats.length, actual: statCount, status: statCount >= stats.length ? "ok" : "mismatch" };

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
