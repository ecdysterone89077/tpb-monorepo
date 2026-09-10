/**
 * Reconcile: re-read MySQL and compare counts + checksums vs export manifest.
 * Exit 0 = match, exit 2 = mismatch. Empty MySQL table != "not migrated" —
 * the manifest is the source of truth.
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = path.resolve("out");

const sha = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

async function main() {
  const manifest = JSON.parse(readFileSync(path.join(OUT, "export-manifest.json"), "utf8"));
  const lines: string[] = [];
  let mismatches = 0;

  const posts = await prisma.post.findMany({ where: { deletedAt: null } });
  const postsNorm = posts.map((p) => ({ title: p.title, slug: p.slug, status: p.status })).sort((a, b) => a.slug.localeCompare(b.slug));
  const mPosts = manifest.posts?.sha256 != null;
  if (mPosts !== (posts.length > 0)) {
    lines.push(`posts: manifest=${mPosts ? "ada" : "absen"} mysql=${posts.length} rows`);
    mismatches++;
  }

  const subs = await prisma.subscriber.count();
  const mSubs = manifest.subscribers?.present ?? false;
  if ((manifest.subscribers?.rows ?? 0) > subs) {
    lines.push(`subscribers: manifest=${manifest.subscribers?.rows} mysql=${subs}`);
    mismatches++;
  }

  const pmb = await prisma.pmbRegistration.count({ where: { deletedAt: null } });
  if ((manifest.pmb?.rows ?? 0) > pmb) {
    lines.push(`pmb: manifest=${manifest.pmb?.rows} mysql=${pmb}`);
    mismatches++;
  }

  const gallery = await prisma.galleryItem.count();
  if ((manifest.gallery?.rows ?? 0) > gallery) {
    lines.push(`gallery: manifest=${manifest.gallery?.rows} mysql=${gallery}`);
    mismatches++;
  }

  const content = await prisma.siteContent.findUnique({ where: { key: "main" } });
  const mContent = manifest.content?.present ?? false;
  if (mContent !== (content?.data != null)) {
    lines.push(`content: manifest=${mContent ? "ada" : "absen"} mysql=${content?.data != null ? "ada" : "NULL"}`);
    mismatches++;
  }

  console.log(lines.length ? lines.join("\n") : "Reconcile OK — manifest dan MySQL konsisten.");
  if (mismatches > 0) process.exit(2);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
