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
  cta: { title: string; body: string; primary: string; secondary: string; secondaryHref: string };
  footer: {
    newsletterTitle: string;
    infoTitle: string;
    quickLinksTitle: string;
    galleryTitle: string;
    submitLabel: string;
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
  image: z.string().min(1).max(2000),
  caption: z.string().max(500).optional(),
  link: z.string().max(2000).nullable().optional().refine((v) => !v || /^https?:\/\//.test(v) || v.startsWith("/"), { message: "URL tautan tidak valid" }),
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

const UrlOrPath = z.string().trim().min(1).max(2000);
const NavChildSchema = z.object({ label: z.string().trim().min(1).max(160), href: z.string().trim().min(1).max(2000) });
const NavItemSchema = z.object({ label: z.string().trim().min(1).max(160), href: z.string().trim().min(1).max(2000), children: z.array(NavChildSchema).max(30).optional() });
const KickerTitleSchema = z.object({ kicker: z.string().max(300), title: z.string().max(500) });
const TextListSchema = z.array(z.string().max(500)).max(100);
const MetricSchema = z.object({ v: z.string().max(100), l: z.string().max(200) });

export const SiteContentSchema = z.object({
  navigation: z.array(NavItemSchema).max(30),
  brand: z.object({ kicker: z.string().max(160), name: z.string().max(220), org: z.string().max(220), logoUrl: UrlOrPath }),
  pmbLink: z.string().max(2000),
  hero: z.object({ badge: z.string().max(300), line1: z.string().max(300), highlight: z.string().max(300), line2: z.string().max(300), subtitle: z.string().max(2000), primaryLabel: z.string().max(160), primaryHref: z.string().max(2000), secondaryLabel: z.string().max(160), image: UrlOrPath }),
  marquee: TextListSchema,
  stats: z.array(z.object({ value: z.number().int().min(0).max(1000000000), suffix: z.string().max(20), label: z.string().max(160) })).max(100),
  about: z.object({ kicker: z.string().max(300), title: z.string().max(500), body: z.string().max(5000), sinceYear: z.string().max(20), sinceNote: z.string().max(500), image: UrlOrPath, points: TextListSchema }),
  programs: z.object({ kicker: z.string().max(300), title: z.string().max(500), cta: z.string().max(160), cards: z.array(z.object({ tag: z.string().max(160), title: z.string().max(300), body: z.string().max(2000), img: UrlOrPath, color: z.string().max(80) })).max(50) }),
  research: z.object({ kicker: z.string().max(300), title: z.string().max(500), body: z.string().max(5000), areas: z.array(z.object({ no: z.string().max(20), title: z.string().max(300), body: z.string().max(2000) })).max(50), metrics: z.array(MetricSchema).max(50) }),
  community: z.object({ kicker: z.string().max(300), title: z.string().max(500), body: z.string().max(5000), image: UrlOrPath, items: TextListSchema }),
  studentLife: z.object({ kicker: z.string().max(300), title: z.string().max(500), cta: z.string().max(160), cards: z.array(z.object({ tag: z.string().max(160), title: z.string().max(300), body: z.string().max(2000) })).max(50) }),
  profil: z.object({ sejarah: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), timeline: z.array(z.object({ year: z.string().max(40), text: z.string().max(2000) })).max(100) }), visiMisi: z.object({ kicker: z.string().max(300), title: z.string().max(500), visi: z.string().max(3000), misi: TextListSchema }), struktur: z.object({ kicker: z.string().max(300), title: z.string().max(500), people: z.array(z.object({ role: z.string().max(200), name: z.string().max(200) })).max(100) }), sambutan: z.object({ kicker: z.string().max(300), title: z.string().max(500), image: UrlOrPath, quote: z.string().max(5000), name: z.string().max(200), role: z.string().max(200) }) }),
  akademik: z.object({ kurikulum: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), sks: z.array(MetricSchema).max(50), clusters: TextListSchema }), kalender: z.object({ kicker: z.string().max(300), title: z.string().max(500), items: z.array(z.object({ d: z.string().max(100), e: z.string().max(2000) })).max(100) }), dosen: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), people: z.array(z.object({ name: z.string().max(200), field: z.string().max(300) })).max(100) }), laboratorium: z.object({ kicker: z.string().max(300), title: z.string().max(500), labs: z.array(z.object({ name: z.string().max(300), desc: z.string().max(2000) })).max(100) }) }),
  penelitian: z.object({ publikasi: z.object({ kicker: z.string().max(300), title: z.string().max(500), pubs: z.array(z.object({ title: z.string().max(500), venue: z.string().max(300), year: z.string().max(40) })).max(100) }), jurnal: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), cards: z.array(z.object({ title: z.string().max(500), body: z.string().max(3000), note: z.string().max(500) })).max(100) }), kolaborasi: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), partners: TextListSchema }) }),
  pengabdian: z.object({ programDesa: z.object({ kicker: z.string().max(300), title: z.string().max(500), desa: z.array(z.object({ name: z.string().max(300), body: z.string().max(3000) })).max(100) }), kemitraan: z.object({ kicker: z.string().max(300), title: z.string().max(500), mitra: TextListSchema }), kegiatan: z.object({ kicker: z.string().max(300), title: z.string().max(500), items: z.array(z.object({ t: z.string().max(100), d: z.string().max(3000) })).max(100) }) }),
  kemahasiswaan: z.object({ himpunan: z.object({ kicker: z.string().max(300), title: z.string().max(500), intro: z.string().max(5000), divisi: TextListSchema }), beasiswa: z.object({ kicker: z.string().max(300), title: z.string().max(500), items: z.array(z.object({ name: z.string().max(300), body: z.string().max(3000) })).max(100) }), prestasi: z.object({ kicker: z.string().max(300), title: z.string().max(500), items: TextListSchema }), alumni: z.object({ kicker: z.string().max(300), title: z.string().max(500), quote: z.string().max(5000), name: z.string().max(200), role: z.string().max(200), stats: z.array(MetricSchema).max(50) }) }),
  news: KickerTitleSchema,
  cta: z.object({ title: z.string().max(500), body: z.string().max(3000), primary: z.string().max(160), secondary: z.string().max(160), secondaryHref: z.string().max(2000) }),
  footer: z.object({ newsletterTitle: z.string().max(500), infoTitle: z.string().max(200), quickLinksTitle: z.string().max(200), galleryTitle: z.string().max(200), submitLabel: z.string().max(80), socials: z.object({ facebook: z.string().max(2000), twitter: z.string().max(2000), youtube: z.string().max(2000), linkedin: z.string().max(2000) }), contact: z.object({ phone: z.string().max(100), email: z.string().max(320), address: z.string().max(1000) }), quickLinks: z.array(z.object({ label: z.string().max(200), href: z.string().max(2000) })).max(100), copyright: z.string().max(500), tagline: z.string().max(500) }),
});
export type ValidatedSiteContent = z.infer<typeof SiteContentSchema>;

export const ContentSchema = z.object({ content: SiteContentSchema });

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type Pagination = z.infer<typeof PaginationSchema>;

/* -------------------------------------------------------------- envelopes */

export type Envelope<K extends string, V> = { [P in K]: V };