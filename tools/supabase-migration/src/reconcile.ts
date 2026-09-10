/**
 * Reconcile: re-read MySQL and compare counts + content checksums against the
 * export manifest AND the imported JSON payloads in out/.
 *
 * Exit 0 = consistent, exit 2 = mismatch. An empty MySQL table is NOT treated
 * as "not migrated" — the manifest is the source of truth, so absence in the
 * manifest must match absence in MySQL and vice versa.
 *
 * Env: DATABASE_URL (MySQL target).
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = path.resolve("out");

const readJson = (name: string) => JSON.parse(readFileSync(path.join(OUT, name), "utf8"));
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 220) || "post";
const importKey = (r: any) => { const value = String(r.id ?? r.idempotencyKey ?? hash(r)); return value.length <= 64 ? value : hash(value); };

async function main() {
  const manifest = readJson("export-manifest.json");
  const lines: string[] = [];
  let mismatches = 0;

  const check = (label: string, expected: unknown, actual: unknown) => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      lines.push(`${label}: manifest=${JSON.stringify(expected)} mysql=${JSON.stringify(actual)}`);
      mismatches++;
    }
  };

  const checkChecksum = (key: string, value: unknown) => {
    const expected = manifest[key]?.sha256 ?? null;
    const actual = value == null ? null : hash(value);
    if (expected !== actual) {
      lines.push(`${key}: checksum sumber tidak cocok (manifest=${expected ?? "null"} file=${actual ?? "null"})`);
      mismatches++;
    }
  };

  // ------------------------------------------------------------------ posts
  const posts = readJson("posts.json");
  checkChecksum("posts", posts);
  const postRows = asArray(posts).filter((p) => !!p?.title);
  const expectedPostSlugs = postRows.map((p) => slugify(p.slug || p.title)).sort();
  const dbPosts = expectedPostSlugs.length ? await prisma.post.findMany({ where: { deletedAt: null, slug: { in: expectedPostSlugs } }, select: { slug: true, title: true, category: true, status: true, excerpt: true, content: true, image: true, readTime: true } }) : [];
  check("posts", postRows.length, dbPosts.length);
  check("posts.slugs", expectedPostSlugs, dbPosts.map((p) => p.slug).sort());
  const expectedPostRecords = postRows.map((p) => ({
    slug: slugify(p.slug || p.title),
    title: String(p.title).slice(0, 220),
    category: String(p.category || "Umum").slice(0, 80),
    status: p.status === "published" ? "published" : "draft",
    excerpt: p.excerpt ?? null,
    content: p.content ?? null,
    image: p.image ?? null,
    readTime: p.readTime ?? null,
  })).sort((a, b) => a.slug.localeCompare(b.slug));
  const actualPostRecords = dbPosts.map((p) => ({ slug: p.slug, title: p.title, category: p.category, status: p.status, excerpt: p.excerpt, content: p.content, image: p.image, readTime: p.readTime })).sort((a, b) => a.slug.localeCompare(b.slug));
  check("posts.records", expectedPostRecords, actualPostRecords);

  // ------------------------------------------------------------ subscribers
  const subscribers = readJson("subscribers.json");
  checkChecksum("subscribers", subscribers);
  const subRows = asArray(subscribers).filter((s) => !!s?.email);
  const expectedEmails = subRows.map((s) => String(s.email).toLowerCase()).sort();
  const dbSubs = expectedEmails.length ? await prisma.subscriber.findMany({ where: { email: { in: expectedEmails } }, select: { email: true } }) : [];
  check("subscribers", subRows.length, dbSubs.length);
  check("subscribers.emails", subRows.map((s) => String(s.email).toLowerCase()).sort(), dbSubs.map((s) => s.email).sort());

  // -------------------------------------------------------------------- pmb
  const pmb = readJson("pmb.json");
  checkChecksum("pmb", pmb);
  const pmbRows = asArray(pmb).filter((r) => !!r?.name && !!r?.email);
  const expectedPmbKeys = pmbRows.map(importKey).sort();
  const dbPmb = expectedPmbKeys.length ? await prisma.pmbRegistration.findMany({ where: { deletedAt: null, idempotencyKey: { in: expectedPmbKeys } }, select: { idempotencyKey: true } }) : [];
  check("pmb", pmbRows.length, dbPmb.length);
  check("pmb.idempotencyKeys", pmbRows.map(importKey).sort(), dbPmb.map((r) => r.idempotencyKey).sort());

  // ---------------------------------------------------------------- gallery
  const gallery = readJson("gallery.json");
  checkChecksum("gallery", gallery);
  const galleryRows = asArray(gallery).filter((g) => !!g?.image);
  const expectedImageHashes = galleryRows.map((g) => hash(String(g.image)));
  const dbGallery = expectedImageHashes.length ? await prisma.galleryItem.findMany({ where: { imageHash: { in: expectedImageHashes } }, select: { image: true } }) : [];
  check("gallery", galleryRows.length, dbGallery.length);
  const expectedImages = galleryRows.map((g) => String(g.image)).sort((a, b) => a.localeCompare(b));
  const actualImages = dbGallery.map((g) => g.image).sort((a, b) => a.localeCompare(b));
  check("gallery.images", expectedImages, actualImages);

  // ---------------------------------------------------------------- content
  const content = readJson("content.json");
  checkChecksum("content", content);
  const contentRow = await prisma.siteContent.findUnique({ where: { key: "main" } });
  const contentPresent = content != null;
  const dbContentPresent = contentRow?.data != null;
  check("content.present", contentPresent, dbContentPresent);
  if (contentPresent && dbContentPresent) {
    check("content.checksum", hash(content), hash(contentRow?.data));
  }

  // ------------------------------------------------------------------ stats
  const stats = readJson("stats.json");
  checkChecksum("stats", stats);
  const statRows = asArray(stats);
  const dbStats = await prisma.siteStat.count();
  check("stats", statRows.length, dbStats);

  console.log(lines.length ? lines.join("\n") : "Reconcile OK — manifest, out/, dan MySQL konsisten.");
  if (mismatches > 0) process.exit(2);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
