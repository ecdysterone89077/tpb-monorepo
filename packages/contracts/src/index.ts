import { z } from "zod";

/* ------------------------------------------------------------------ enums */

export const Role = { ADMIN: "ADMIN", EDITOR: "EDITOR", OPERATOR: "OPERATOR" } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const PostStatus = { PUBLISHED: "published", DRAFT: "draft" } as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const PmbStatus = { BARU: "baru", DIPROSES: "diproses", DITERIMA: "diterima", DITOLAK: "ditolak" } as const;
export type PmbStatus = (typeof PmbStatus)[keyof typeof PmbStatus];

/* --------------------------------------------------------------- nav types */

export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href: string; children?: NavChild[] };

/* ------------------------------------------------------------ site content */

export type SiteContent = {
  navigation: NavItem[];
  brand: { kicker: string; name: string; org: string; logoUrl: string };
  pmbLink: string;
  hero: {
    badge: string;
    line1: string;
    highlight: string;
    line2: string;
    subtitle: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    image: string;
  };
  marquee: string[];
  stats: { value: number; suffix: string; label: string }[];
  about: {
    kicker: string;
    title: string;
    body: string;
    sinceYear: string;
    sinceNote: string;
    image: string;
    points: string[];
  };
  programs: {
    kicker: string;
    title: string;
    cta: string;
    cards: { tag: string; title: string; body: string; img: string; color: string }[];
  };
  research: {
    kicker: string;
    title: string;
    body: string;
    areas: { no: string; title: string; body: string }[];
    metrics: { v: string; l: string }[];
  };
  community: {
    kicker: string;
    title: string;
    body: string;
    image: string;
    items: string[];
  };
  studentLife: {
    kicker: string;
    title: string;
    cta: string;
    cards: { tag: string; title: string; body: string }[];
  };
  profil: {
    sejarah: { kicker: string; title: string; intro: string; timeline: { year: string; text: string }[] };
    visiMisi: { kicker: string; title: string; visi: string; misi: string[] };
    struktur: { kicker: string; title: string; people: { role: string; name: string }[] };
    sambutan: { kicker: string; title: string; image: string; quote: string; name: string; role: string };
  };
  akademik: {
    kurikulum: { kicker: string; title: string; intro: string; sks: { v: string; l: string }[]; clusters: string[] };
    kalender: { kicker: string; title: string; items: { d: string; e: string }[] };
    dosen: { kicker: string; title: string; intro: string; people: { name: string; field: string }[] };
    laboratorium: { kicker: string; title: string; labs: { name: string; desc: string }[] };
  };
  penelitian: {
    publikasi: { kicker: string; title: string; pubs: { title: string; venue: string; year: string }[] };
    jurnal: { kicker: string; title: string; intro: string; cards: { title: string; body: string; note: string }[] };
    kolaborasi: { kicker: string; title: string; intro: string; partners: string[] };
  };
  pengabdian: {
    programDesa: { kicker: string; title: string; desa: { name: string; body: string }[] };
    kemitraan: { kicker: string; title: string; mitra: string[] };
    kegiatan: { kicker: string; title: string; items: { t: string; d: string }[] };
  };
  kemahasiswaan: {
    himpunan: { kicker: string; title: string; intro: string; divisi: string[] };
    beasiswa: { kicker: string; title: string; items: { name: string; body: string }[] };
    prestasi: { kicker: string; title: string; items: string[] };
    alumni: { kicker: string; title: string; quote: string; name: string; role: string; stats: { v: string; l: string }[] };
  };
  news: { kicker: string; title: string };
  cta: { title: string; body: string; primary: string; secondary: string };
  footer: {
    newsletterTitle: string;
    socials: { facebook: string; twitter: string; youtube: string; linkedin: string };
    contact: { phone: string; email: string; address: string };
    quickLinks: { label: string; href: string }[];
    copyright: string;
    tagline: string;
  };
};

/* ------------------------------------------------------------ domain types */

export type Post = {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  content: string | null;
  image: string | null;
  readTime: string;
  status: PostStatus;
  date: string;
  author: string | null;
};

export type GalleryItem = { id: string; image: string; caption: string | null; link: string | null; createdAt: string };
export type Stat = { id?: string; value: number; suffix: string; label: string };
export type Subscriber = { id: string; email: string; subscribedAt: string };

export type PmbInput = {
  name: string;
  email: string;
  phone: string;
  school?: string;
  program?: string;
  message?: string;
  idempotencyKey?: string;
};

export type Registration = PmbInput & {
  id: string;
  status: PmbStatus;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuditEntry = {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user?: { email: string } | null;
};

export type MediaAsset = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: string;
};

export type DashboardSummary = {
  posts: number;
  newPmb: number;
  subscribers: number;
  media: number;
  audit: AuditEntry[];
};

/* ------------------------------------------------------------- zod schemas */

export const PostInputSchema = z.object({
  title: z.string().trim().min(1).max(220),
  category: z.string().trim().min(1).max(80),
  excerpt: z.string().max(2000).default(""),
  content: z.string().max(100000).nullable().optional(),
  image: z.string().url().nullable().optional(),
  readTime: z.string().max(40).default(""),
  status: z.enum(["published", "draft"]).default("draft"),
  date: z.string().datetime().optional(),
});
export type PostInput = z.infer<typeof PostInputSchema>;

export const BootstrapSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
});

export const LoginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

export const PmbInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email().max(320),
  phone: z.string().trim().min(6).max(40),
  school: z.string().max(160).optional(),
  program: z.string().max(120).optional(),
  message: z.string().max(5000).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const SubscriberInputSchema = z.object({
  email: z.string().email().max(320),
});

export const PmbStatusSchema = z.object({
  status: z.enum(["baru", "diproses", "diterima", "ditolak"]),
});

export const UserInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  role: z.enum(["ADMIN", "EDITOR", "OPERATOR"]),
});

export const UserUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  role: z.enum(["ADMIN", "EDITOR", "OPERATOR"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(10).max(200).optional(),
});

export const GalleryInputSchema = z.object({
  image: z.string().url().max(2000),
  caption: z.string().max(500).optional(),
  link: z.string().url().max(2000).nullable().optional(),
});

export const StatsSchema = z.object({
  stats: z
    .array(
      z.object({
        value: z.number().int().min(0).max(1000000000),
        suffix: z.string().max(20),
        label: z.string().max(160),
      }),
    )
    .max(100),
});

export const ContentSchema = z.object({
  content: z.unknown().nullable(),
});

/* -------------------------------------------------------------- envelopes */

export type Envelope<K extends string, V> = { [P in K]: V };