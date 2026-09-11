import type {
  AdminUser, AuditEntry, DashboardSummary, GalleryItem, MediaAsset, Post, Registration, SiteContent, Stat, Subscriber,
} from "@tpb/contracts";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3000/v1").replace(/\/$/, "");

let accessToken: string | null = null;

const authHeaders = (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {});

function errMsg(r: Response, body: any): string {
  if (typeof body === "string") return body;
  const m = body?.message ?? body?.error;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.map((x: any) => (typeof x === "string" ? x : x?.message)).filter(Boolean).join(", ");
  return `Permintaan gagal (HTTP ${r.status}).`;
}

async function parseResp<T>(r: Response): Promise<T> {
  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!r.ok) throw new Error(errMsg(r, body));
  return body as T;
}

async function refreshOnce(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!r.ok) return false;
    const data = await parseResp<{ token: string }>(r);
    accessToken = data.token;
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });
  if (r.status === 401 && retry && accessToken) {
    const ok = await refreshOnce();
    if (ok) return request<T>(path, init, false);
    accessToken = null;
  }
  return parseResp<T>(r);
}

const jsonInit = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

export type PaginationMeta = { limit: number; offset: number; total: number; hasMore: boolean };
export type PageParams = { limit?: number; offset?: number };

function pageQuery(params?: PageParams): string {
  if (!params) return "";
  const parts: string[] = [];
  if (params.limit != null) parts.push(`limit=${params.limit}`);
  if (params.offset != null) parts.push(`offset=${params.offset}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const api = {
  /* ------------------------------------------------------------ auth */

  async login(email: string, password: string) {
    const d = await request<{ token: string; user: AdminUser }>(`/auth/login`, jsonInit({ email, password }));
    accessToken = d.token;
    return d.user;
  },

  async bootstrap(name: string, email: string, password: string) {
    const d = await request<{ token: string; user: AdminUser }>(`/auth/bootstrap`, jsonInit({ name, email, password }));
    accessToken = d.token;
    return d.user;
  },

  async logout() {
    try { await request(`/auth/logout`, { method: "POST" }); } finally { accessToken = null; }
  },

  async logoutAll() {
    try { await request(`/auth/logout-all`, { method: "POST" }); } finally { accessToken = null; }
  },

  async currentUser(): Promise<AdminUser | null> {
    if (!accessToken) {
      const ok = await refreshOnce();
      if (!ok) return null;
    }
    try {
      const d = await request<{ user: AdminUser }>(`/auth/me`);
      return d.user;
    } catch {
      accessToken = null;
      return null;
    }
  },

  /* -------------------------------------------------------- content */

  async getContent(): Promise<SiteContent | null> {
    const d = await request<{ content: SiteContent | null }>(`/content`);
    return d.content;
  },

  async saveContent(content: SiteContent) {
    return request<{ content: SiteContent }>(`/content`, jsonInit({ content }, "PUT"));
  },

  /* ---------------------------------------------------------- posts */

  async listPublic(params?: PageParams): Promise<Post[]> {
    const d = await request<{ posts: Post[] }>(`/posts${pageQuery(params)}`);
    return d.posts;
  },

  async listAll(params?: PageParams): Promise<{ posts: Post[]; pagination: PaginationMeta }> {
    const q = pageQuery(params);
    const sep = q ? "&" : "?";
    return request<{ posts: Post[]; pagination: PaginationMeta }>(`/posts${q}${sep}all=1`);
  },

  async getPost(id: string): Promise<Post | null> {
    const d = await request<{ post: Post | null }>(`/posts/${encodeURIComponent(id)}`);
    return d.post;
  },

  async create(input: Partial<Post> & { title: string; category: string }): Promise<Post> {
    const d = await request<{ post: Post }>(`/posts`, jsonInit(input));
    return d.post;
  },

  async update(id: string, input: Partial<Post> & { title: string; category: string }): Promise<Post> {
    const d = await request<{ post: Post }>(`/posts/${encodeURIComponent(id)}`, jsonInit(input, "PUT"));
    return d.post;
  },

  async remove(id: string): Promise<void> {
    await request(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /* ------------------------------------------------------------ pmb */

  async registerPmb(input: {
    name: string; email: string; phone: string; school?: string; program?: string; message?: string; idempotencyKey?: string;
  }): Promise<Registration> {
    const d = await request<{ registration: Registration }>(`/pmb`, jsonInit(input));
    return d.registration;
  },

  async listPmb(params?: PageParams): Promise<{ registrations: Registration[]; pagination: PaginationMeta }> {
    return request<{ registrations: Registration[]; pagination: PaginationMeta }>(`/pmb${pageQuery(params)}`);
  },

  async setPmbStatus(id: string, status: Registration["status"]): Promise<Registration> {
    const d = await request<{ registration: Registration }>(`/pmb/${encodeURIComponent(id)}/status`, jsonInit({ status }, "PUT"));
    return d.registration;
  },

  async removePmb(id: string): Promise<void> {
    await request(`/pmb/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /* -------------------------------------------------- subscribers */

  async subscribe(email: string): Promise<Subscriber> {
    const d = await request<{ subscriber: Subscriber }>(`/subscribers`, jsonInit({ email }));
    return d.subscriber;
  },

  async listSubscribers(params?: PageParams): Promise<{ subscribers: Subscriber[]; pagination: PaginationMeta }> {
    return request<{ subscribers: Subscriber[]; pagination: PaginationMeta }>(`/subscribers${pageQuery(params)}`);
  },

  /* -------------------------------------------------- stats + gallery */

  async getStats(): Promise<Stat[]> {
    const d = await request<{ stats: Stat[] }>(`/stats`);
    return d.stats;
  },

  async saveStats(stats: Stat[]): Promise<Stat[]> {
    const d = await request<{ stats: Stat[] }>(`/stats`, jsonInit({ stats }, "PUT"));
    return d.stats;
  },

  async listGallery(params?: PageParams): Promise<{ gallery: GalleryItem[]; pagination: PaginationMeta }> {
    return request<{ gallery: GalleryItem[]; pagination: PaginationMeta }>(`/gallery${pageQuery(params)}`);
  },

  async addGallery(input: { image: string; caption?: string; link?: string | null }): Promise<GalleryItem> {
    const d = await request<{ item: GalleryItem }>(`/gallery`, jsonInit(input));
    return d.item;
  },

  async removeGallery(id: string): Promise<void> {
    await request(`/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /* -------------------------------------------------- audit + media */

  async listAudit(params?: PageParams): Promise<{ audit: AuditEntry[]; pagination: PaginationMeta }> {
    return request<{ audit: AuditEntry[]; pagination: PaginationMeta }>(`/audit${pageQuery(params)}`);
  },

  async uploadMedia(file: File): Promise<MediaAsset> {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${BASE}/media/upload`, { method: "POST", body: fd, credentials: "include", headers: authHeaders() });
    if (r.status === 401 && accessToken && await refreshOnce()) {
      const retry = await fetch(`${BASE}/media/upload`, { method: "POST", body: fd, credentials: "include", headers: authHeaders() });
      const d = await parseResp<{ item: MediaAsset }>(retry);
      return d.item;
    }
    const d = await parseResp<{ item: MediaAsset }>(r);
    return d.item;
  },

  async listMedia(params?: PageParams): Promise<{ media: MediaAsset[]; pagination: PaginationMeta }> {
    return request<{ media: MediaAsset[]; pagination: PaginationMeta }>(`/media${pageQuery(params)}`);
  },

  async removeMedia(id: string): Promise<void> {
    await request(`/media/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  /* ---------------------------------------------- users + dashboard */

  async listUsers(params?: PageParams): Promise<{ users: AdminUser[]; pagination: PaginationMeta }> {
    return request<{ users: AdminUser[]; pagination: PaginationMeta }>(`/users${pageQuery(params)}`);
  },

  async createUser(input: { name: string; email: string; password: string; role: AdminUser["role"] }): Promise<AdminUser> {
    const d = await request<{ user: AdminUser }>(`/users`, jsonInit(input));
    return d.user;
  },

  async updateUser(id: string, input: { name?: string; role?: AdminUser["role"]; isActive?: boolean; password?: string }): Promise<AdminUser> {
    const d = await request<{ user: AdminUser }>(`/users/${encodeURIComponent(id)}`, jsonInit(input, "PUT"));
    return d.user;
  },

  async deleteUser(id: string): Promise<void> {
    await request(`/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async dashboardSummary(): Promise<DashboardSummary> {
    const d = await request<DashboardSummary>(`/dashboard/summary`);
    return d;
  },
};

export type { AdminUser, AuditEntry, GalleryItem, Post, Registration, SiteContent, Stat, Subscriber, MediaAsset, DashboardSummary };
