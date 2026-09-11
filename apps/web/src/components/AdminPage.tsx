import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { api, type PaginationMeta } from "../lib/api";
import type {
  AdminUser,
  AuditEntry,
  DashboardSummary,
  GalleryItem,
  MediaAsset,
  Post,
  Registration,
  Role,
  SiteContent,
  Subscriber,
} from "@tpb/contracts";

type View = "dashboard" | "content" | "posts" | "pmb" | "gallery" | "subs" | "users" | "audit";
type RoleAwareUser = AdminUser & { role: Role };

type PostForm = {
  title: string;
  category: string;
  excerpt: string;
  content: string;
  image: string;
  readTime: string;
  status: "published" | "draft";
  date: string;
};

const PAGE_SIZE = 50;

const NAV_ALL: { id: View; label: string; roles: Role[] }[] = [
  { id: "dashboard", label: "Dashboard", roles: ["ADMIN"] },
  { id: "content", label: "Konten Situs", roles: ["ADMIN", "EDITOR"] },
  { id: "posts", label: "Berita", roles: ["ADMIN", "EDITOR"] },
  { id: "pmb", label: "PMB", roles: ["ADMIN", "OPERATOR"] },
  { id: "gallery", label: "Galeri & Media", roles: ["ADMIN", "EDITOR", "OPERATOR"] },
  { id: "subs", label: "Pelanggan", roles: ["ADMIN", "OPERATOR"] },
  { id: "users", label: "Pengguna", roles: ["ADMIN"] },
  { id: "audit", label: "Audit Log", roles: ["ADMIN"] },
];

const roleCan = (user: RoleAwareUser, roles: Role[]) => roles.includes(user.role);
const formatDate = (value: string) => new Date(value).toLocaleString("id-ID");
const toDateInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const emptyPost = (): PostForm => ({ title: "", category: "", excerpt: "", content: "", image: "", readTime: "", status: "draft", date: "" });
const postToForm = (post: Post): PostForm => ({ title: post.title, category: post.category, excerpt: post.excerpt || "", content: post.content || "", image: post.image || "", readTime: post.readTime || "", status: post.status, date: toDateInput(post.date) });

export function AdminPage() {
  const [user, setUser] = useState<RoleAwareUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("dashboard");
  const check = useCallback(async () => { const current = await api.currentUser(); setUser(current as RoleAwareUser | null); setChecking(false); }, []);
  useEffect(() => { check(); }, [check]);

  const nav = user ? NAV_ALL.filter((item) => item.roles.includes(user.role)) : NAV_ALL;

  useEffect(() => {
    if (!user) return;
    const allowed = nav.find((n) => n.id === view);
    if (!allowed && nav.length > 0) setView(nav[0].id);
  }, [user, view, nav]);

  if (checking) return <PageMessage text="Memuat sesi..." />;
  if (!user) return <LoginPanel onDone={check} />;
  return <div className="min-h-screen bg-slate-100 flex">
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-100 p-4 space-y-1 hidden md:block">
      <p className="font-bold text-lg mb-4 px-2">Panel Admin TPB</p>
      {nav.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${view === item.id ? "bg-slate-100 text-slate-900 font-semibold" : "hover:bg-slate-800"}`}>{item.label}</button>)}
      <div className="pt-4 mt-4 border-t border-slate-700 space-y-1"><p className="text-xs text-slate-400 px-3 truncate">{user.email}</p><p className="text-xs text-slate-500 px-3">{user.role}</p><button onClick={async () => { await api.logout(); setUser(null); }} className="text-xs text-red-400 hover:text-red-300 px-3 py-1">Keluar</button><a href="#/" className="block text-xs text-slate-400 hover:text-slate-200 px-3 py-1">&larr; Kembali ke situs</a></div>
    </aside>
    <main className="flex-1 min-w-0 p-4 md:p-10 overflow-x-auto">
      <div className="md:hidden mb-5 flex gap-2 overflow-x-auto pb-1">{nav.map((item) => <button key={item.id} onClick={() => setView(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${view === item.id ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>{item.label}</button>)}</div>
      {view === "dashboard" && <DashboardView />}
      {view === "content" && <ContentView user={user} />}
      {view === "posts" && <PostsView user={user} />}
      {view === "pmb" && <PmbView user={user} />}
      {view === "gallery" && <GalleryMediaView user={user} />}
      {view === "subs" && <SubscribersView />}
      {view === "users" && <UsersView user={user} />}
      {view === "audit" && <AuditView />}
    </main>
  </div>;
}

function PageMessage({ text }: { text: string }) { return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-100">{text}</div>; }
function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) { return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold text-slate-900">{title}</h1>{action}</div>{children}</div>; }
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`bg-white rounded-xl shadow-sm p-5 ${className}`}>{children}</div>; }
function Notice({ error, success }: { error?: string; success?: string }) { if (!error && !success) return null; return <p className={`rounded-lg px-3 py-2 text-sm ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{error || success}</p>; }
function AsyncState({ loading, error, empty, children }: { loading: boolean; error: string; empty?: boolean; children: React.ReactNode }) { if (loading) return <p className="text-sm text-slate-500">Memuat data...</p>; if (error) return <Notice error={error} />; if (empty) return <p className="text-sm text-slate-500">Belum ada data.</p>; return <>{children}</>; }

function PaginationControls({ pagination, onPageChange }: { pagination: PaginationMeta; onPageChange: (offset: number) => void }) {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  if (totalPages <= 1) return null;
  return <div className="flex items-center justify-between gap-3 pt-3 text-sm text-slate-600">
    <span>{pagination.total} data - halaman {currentPage}/{totalPages}</span>
    <div className="flex gap-2">
      <button disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(0, (currentPage - 2) * pagination.limit))} className="button-secondary disabled:opacity-40">&larr; Sebelumnya</button>
      <button disabled={!pagination.hasMore} onClick={() => onPageChange(currentPage * pagination.limit)} className="button-secondary disabled:opacity-40">Berikutnya &rarr;</button>
    </div>
  </div>;
}

function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null); const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); try { setSummary(await api.dashboardSummary()); } catch (e: any) { setError(e?.message ?? "Gagal memuat dashboard."); } }, []);
  useEffect(() => { load(); }, [load]);
  const cards: [string, number][] = summary ? [["Berita", summary.posts], ["Pendaftar Baru", summary.newPmb], ["Pelanggan", summary.subscribers], ["Media", summary.media]] : [];
  return <Section title="Dashboard" action={<button onClick={load} className="button-secondary">Muat ulang</button>}><AsyncState loading={!summary && !error} error={error}>{summary && <><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{cards.map(([label, value]) => <Panel key={label}><p className="text-3xl font-bold text-slate-900">{value}</p><p className="text-sm text-slate-500">{label}</p></Panel>)}</div><Panel><h2 className="font-semibold mb-3 text-slate-900">Aktivitas Terakhir</h2><AuditList entries={summary.audit} /></Panel></>}</AsyncState></Section>;
}

function ContentView({ user }: { user: RoleAwareUser }) {
  const [content, setContent] = useState<SiteContent | null>(null); const [draft, setDraft] = useState(""); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); setNotice(""); try { const next = await api.getContent(); setContent(next); setDraft(next == null ? "" : JSON.stringify(next, null, 2)); } catch (e: any) { setError(e?.message ?? "Gagal memuat konten."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(""); setNotice(""); try { const parsed = JSON.parse(draft) as SiteContent; const saved = await api.saveContent(parsed); setContent(saved.content); setDraft(JSON.stringify(saved.content, null, 2)); setNotice("Konten tersimpan."); } catch (e: any) { setError(e instanceof SyntaxError ? "Format JSON tidak valid." : e?.message ?? "Gagal menyimpan konten."); } finally { setSaving(false); } };
  return <Section title="Konten Situs" action={<button onClick={load} className="button-secondary">Muat ulang</button>}><Notice error={error} success={notice} /><AsyncState loading={loading} error="" empty={!content}>{content && <form onSubmit={save} className="space-y-4"><Panel><p className="text-sm text-slate-500 mb-3">Editor JSON memakai data yang tersimpan di server. Tidak ada konten bawaan atau nilai pengganti lokal.</p><textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={30} className="admin-textarea font-mono text-xs" aria-label="JSON konten situs" /></Panel><div className="flex gap-2"><button disabled={saving || !roleCan(user, ["ADMIN"])} className="button-primary disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan konten"}</button><button type="button" onClick={() => setDraft(JSON.stringify(content, null, 2))} className="button-secondary">Buang perubahan</button></div></form>}</AsyncState>{!loading && !error && !content && <Panel><p className="text-sm text-slate-500">Konten belum dikonfigurasi. Buat data konten melalui editor API sebelum menyimpannya.</p></Panel>}</Section>;
}

function PostsView({ user }: { user: RoleAwareUser }) {
  const [posts, setPosts] = useState<Post[]>([]); const [form, setForm] = useState<PostForm>(emptyPost()); const [editing, setEditing] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null); const [offset, setOffset] = useState(0);
  const load = useCallback(async (off = 0) => { setLoading(true); setError(""); try { const r = await api.listAll({ limit: PAGE_SIZE, offset: off }); setPosts(r.posts); setPagination(r.pagination); setOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat berita."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const setField = (key: keyof PostForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { const input = { ...form, content: form.content || null, image: form.image || null, date: form.date ? new Date(form.date).toISOString() : undefined }; if (editing) await api.update(editing, input); else await api.create(input); setForm(emptyPost()); setEditing(null); setNotice("Berita tersimpan."); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal menyimpan berita."); } finally { setBusy(false); } };
  const remove = async (id: string) => { if (!window.confirm("Hapus berita ini?")) return; setError(""); try { await api.remove(id); if (editing === id) { setEditing(null); setForm(emptyPost()); } await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal menghapus berita."); } };
  return <Section title="Berita" action={<button onClick={() => load(offset)} className="button-secondary">Muat ulang</button>}><Notice error={error} success={notice} />{roleCan(user, ["ADMIN", "EDITOR"]) && <Panel><h2 className="font-semibold mb-4">{editing ? "Edit berita" : "Berita baru"}</h2><form onSubmit={submit} className="grid md:grid-cols-2 gap-3"><input required className="admin-input" placeholder="Judul" value={form.title} onChange={setField("title")} /><input required className="admin-input" placeholder="Kategori" value={form.category} onChange={setField("category")} /><input className="admin-input" placeholder="Waktu baca" value={form.readTime} onChange={setField("readTime")} /><input type="datetime-local" className="admin-input" value={form.date} onChange={setField("date")} /><input type="url" className="admin-input md:col-span-2" placeholder="URL gambar (opsional)" value={form.image} onChange={setField("image")} /><textarea className="admin-textarea md:col-span-2" placeholder="Ringkasan" rows={3} value={form.excerpt} onChange={setField("excerpt")} /><textarea className="admin-textarea md:col-span-2" placeholder="Isi berita" rows={8} value={form.content} onChange={setField("content")} /><select className="admin-input" value={form.status} onChange={setField("status")}><option value="draft">Draft</option><option value="published">Terbit</option></select><div className="flex gap-2 items-center"><button disabled={busy} className="button-primary disabled:opacity-50">{busy ? "Menyimpan..." : "Simpan"}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyPost()); }} className="button-secondary">Batal</button>}</div></form></Panel>}<Panel><AsyncState loading={loading} error={error} empty={!posts.length && !pagination}>{posts.length > 0 && <div className="divide-y divide-slate-100">{posts.map((post) => <div key={post.id} className="py-3 flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-slate-900">{post.title}</p><p className="text-xs text-slate-500">{post.category} - {post.status} - {formatDate(post.date)}</p></div><div className="flex gap-2"><button onClick={() => { setEditing(post.id); setForm(postToForm(post)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="button-secondary">Edit</button>{roleCan(user, ["ADMIN"]) && <button onClick={() => remove(post.id)} className="button-danger">Hapus</button>}</div></div>)}</div>}{pagination && <PaginationControls pagination={pagination} onPageChange={(off) => load(off)} />}</AsyncState></Panel></Section>;
}

function PmbView({ user }: { user: RoleAwareUser }) {
  const [rows, setRows] = useState<Registration[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null); const [offset, setOffset] = useState(0);
  const load = useCallback(async (off = 0) => { setLoading(true); setError(""); try { const r = await api.listPmb({ limit: PAGE_SIZE, offset: off }); setRows(r.registrations); setPagination(r.pagination); setOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat pendaftar."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const updateStatus = async (row: Registration, status: Registration["status"]) => { try { await api.setPmbStatus(row.id, status); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal mengubah status."); } };
  const remove = async (id: string) => { if (!window.confirm("Hapus pendaftar ini?")) return; try { await api.removePmb(id); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal menghapus pendaftar."); } };
  return <Section title="PMB" action={<button onClick={() => load(offset)} className="button-secondary">Muat ulang</button>}><Notice error={error} /><Panel><AsyncState loading={loading} error={error} empty={!rows.length && !pagination}>{rows.length > 0 && <div className="space-y-3">{rows.map((row) => <div key={row.id} className="border border-slate-200 rounded-lg p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold text-slate-900">{row.name}</p><p className="text-sm text-slate-600">{row.email} - {row.phone}</p><p className="text-xs text-slate-500">{row.school || "-"} - {row.program || "-"} - {formatDate(row.createdAt)}</p>{row.message && <p className="mt-2 text-sm text-slate-600">{row.message}</p>}</div><div className="flex items-start gap-2"><select value={row.status} onChange={(e) => updateStatus(row, e.target.value as Registration["status"])} className="admin-input"><option value="baru">Baru</option><option value="diproses">Diproses</option><option value="diterima">Diterima</option><option value="ditolak">Ditolak</option></select>{roleCan(user, ["ADMIN"]) && <button onClick={() => remove(row.id)} className="button-danger">Hapus</button>}</div></div></div>)}</div>}{pagination && <PaginationControls pagination={pagination} onPageChange={(off) => load(off)} />}</AsyncState></Panel></Section>;
}

function GalleryMediaView({ user }: { user: RoleAwareUser }) {
  const [gallery, setGallery] = useState<GalleryItem[]>([]); const [media, setMedia] = useState<MediaAsset[]>([]); const [galleryForm, setGalleryForm] = useState({ image: "", caption: "", link: "" }); const [file, setFile] = useState<File | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [galleryPage, setGalleryPage] = useState<PaginationMeta | null>(null); const [galleryOffset, setGalleryOffset] = useState(0);
  const [mediaPage, setMediaPage] = useState<PaginationMeta | null>(null); const [mediaOffset, setMediaOffset] = useState(0);
  const loadGallery = useCallback(async (off = 0) => { try { const r = await api.listGallery({ limit: PAGE_SIZE, offset: off }); setGallery(r.gallery); setGalleryPage(r.pagination); setGalleryOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat galeri."); } }, []);
  const loadMedia = useCallback(async (off = 0) => { try { const r = await api.listMedia({ limit: PAGE_SIZE, offset: off }); setMedia(r.media); setMediaPage(r.pagination); setMediaOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat media."); } }, []);
  const load = useCallback(async () => { setLoading(true); setError(""); try { await Promise.all([loadGallery(), loadMedia()]); } finally { setLoading(false); } }, [loadGallery, loadMedia]);
  useEffect(() => { load(); }, [load]);
  const addGallery = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { await api.addGallery({ image: galleryForm.image, caption: galleryForm.caption || undefined, link: galleryForm.link || null }); setGalleryForm({ image: "", caption: "", link: "" }); setNotice("Item galeri tersimpan."); await loadGallery(galleryOffset); } catch (e: any) { setError(e?.message ?? "Gagal menambah galeri."); } finally { setBusy(false); } };
  const upload = async (event: FormEvent) => { event.preventDefault(); if (!file) return; setBusy(true); setError(""); setNotice(""); try { const asset = await api.uploadMedia(file); setFile(null); setNotice("Media berhasil diunggah: " + asset.url); await loadMedia(mediaOffset); } catch (e: any) { setError(e?.message ?? "Gagal mengunggah media."); } finally { setBusy(false); } };
  const remove = async (id: string) => { if (!window.confirm("Hapus item galeri ini?")) return; try { await api.removeGallery(id); await loadGallery(galleryOffset); } catch (e: any) { setError(e?.message ?? "Gagal menghapus galeri."); } };
  const removeMedia = async (item: MediaAsset) => { if (!window.confirm("Hapus media ini?")) return; try { await api.removeMedia(item.id); await loadMedia(mediaOffset); } catch (e: any) { setError(e?.message ?? "Gagal menghapus media."); } };
  return <Section title="Galeri & Media" action={<button onClick={load} className="button-secondary">Muat ulang</button>}><Notice error={error} success={notice} /><div className="grid xl:grid-cols-2 gap-5"><Panel><h2 className="font-semibold mb-4">Tambah galeri melalui URL</h2><form onSubmit={addGallery} className="space-y-3"><input required className="admin-input w-full" placeholder="URL gambar (https://... atau /media/...)" value={galleryForm.image} onChange={(e) => setGalleryForm({ ...galleryForm, image: e.target.value })} /><input className="admin-input w-full" placeholder="Caption" value={galleryForm.caption} onChange={(e) => setGalleryForm({ ...galleryForm, caption: e.target.value })} /><input className="admin-input w-full" placeholder="URL tautan (opsional)" value={galleryForm.link} onChange={(e) => setGalleryForm({ ...galleryForm, link: e.target.value })} /><button disabled={busy} className="button-primary disabled:opacity-50">Simpan galeri</button></form><div className="mt-5 space-y-2"><AsyncState loading={loading} error={error} empty={!gallery.length && !galleryPage}>{gallery.map((item) => <div key={item.id} className="flex gap-3 items-center border-t pt-2"><img src={item.image} alt={item.caption || ""} className="w-14 h-14 object-cover rounded" /><div className="min-w-0 flex-1"><p className="text-sm truncate">{item.caption || item.image}</p><p className="text-xs text-slate-500">{formatDate(item.createdAt)}</p></div>{roleCan(user, ["ADMIN"]) && <button onClick={() => remove(item.id)} className="button-danger">Hapus</button>}</div>)}{galleryPage && <PaginationControls pagination={galleryPage} onPageChange={(off) => loadGallery(off)} />}</AsyncState></div></Panel><Panel><h2 className="font-semibold mb-4">Unggah media</h2><form onSubmit={upload} className="flex flex-wrap gap-3 items-center"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /><button disabled={!file || busy} className="button-primary disabled:opacity-50">Unggah</button></form><div className="mt-5 space-y-2"><AsyncState loading={loading} error={error} empty={!media.length && !mediaPage}>{media.map((item) => <div key={item.id} className="border-t pt-2"><a href={item.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline break-all">{item.filename}</a><p className="text-xs text-slate-500">{item.mimeType} - {item.size} bytes - {formatDate(item.createdAt)}</p><p className="text-xs text-slate-400 break-all">{item.url}</p>{roleCan(user, ["ADMIN"]) && <button onClick={() => removeMedia(item)} className="button-danger mt-2">Hapus</button>}</div>)}{mediaPage && <PaginationControls pagination={mediaPage} onPageChange={(off) => loadMedia(off)} />}</AsyncState></div></Panel></div></Section>;
}

function SubscribersView() {
  const [rows, setRows] = useState<Subscriber[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null); const [offset, setOffset] = useState(0);
  const load = useCallback(async (off = 0) => { setLoading(true); setError(""); try { const r = await api.listSubscribers({ limit: PAGE_SIZE, offset: off }); setRows(r.subscribers); setPagination(r.pagination); setOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat pelanggan."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <Section title="Pelanggan" action={<button onClick={() => load(offset)} className="button-secondary">Muat ulang</button>}><Panel><AsyncState loading={loading} error={error} empty={!rows.length && !pagination}>{rows.length > 0 && <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="py-3 flex justify-between gap-3 text-sm"><span>{row.email}</span><span className="text-slate-500">{formatDate(row.subscribedAt)}</span></div>)}</div>}{pagination && <PaginationControls pagination={pagination} onPageChange={(off) => load(off)} />}</AsyncState></Panel></Section>;
}

function UsersView({ user }: { user: RoleAwareUser }) {
  const [rows, setRows] = useState<AdminUser[]>([]); const [form, setForm] = useState({ name: "", email: "", password: "", role: "OPERATOR" as Role }); const [editing, setEditing] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null); const [offset, setOffset] = useState(0);
  const load = useCallback(async (off = 0) => { setLoading(true); setError(""); try { const r = await api.listUsers({ limit: PAGE_SIZE, offset: off }); setRows(r.users); setPagination(r.pagination); setOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat pengguna."); } finally { setLoading(false); } }, []);
  useEffect(() => { if (roleCan(user, ["ADMIN"])) load(); else setLoading(false); }, [load, user]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); setNotice(""); try { if (editing) await api.updateUser(editing, { name: form.name, role: form.role, ...(form.password ? { password: form.password } : {}) }); else await api.createUser(form); setForm({ name: "", email: "", password: "", role: "OPERATOR" }); setEditing(null); setNotice("Pengguna tersimpan."); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal menyimpan pengguna."); } finally { setBusy(false); } };
  const toggle = async (row: AdminUser) => { try { await api.updateUser(row.id, { isActive: !row.isActive }); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal mengubah status pengguna."); } };
  const remove = async (id: string) => { if (id === user.id || !window.confirm("Hapus pengguna ini?")) return; try { await api.deleteUser(id); await load(offset); } catch (e: any) { setError(e?.message ?? "Gagal menghapus pengguna."); } };
  if (!roleCan(user, ["ADMIN"])) return <Section title="Pengguna"><Panel><p className="text-sm text-slate-500">Hanya ADMIN yang dapat mengelola pengguna.</p></Panel></Section>;
  return <Section title="Pengguna" action={<button onClick={() => load(offset)} className="button-secondary">Muat ulang</button>}><Notice error={error} success={notice} /><Panel><h2 className="font-semibold mb-4">{editing ? "Edit pengguna" : "Pengguna baru"}</h2><form onSubmit={submit} className="grid md:grid-cols-2 gap-3"><input required className="admin-input" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />{!editing && <input required type="email" className="admin-input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}<input required={!editing} type="password" minLength={10} className="admin-input" placeholder={editing ? "Kata sandi baru (opsional)" : "Kata sandi"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><select className="admin-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="ADMIN">ADMIN</option><option value="EDITOR">EDITOR</option><option value="OPERATOR">OPERATOR</option></select><div className="flex gap-2"><button disabled={busy} className="button-primary disabled:opacity-50">Simpan</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: "", email: "", password: "", role: "OPERATOR" }); }} className="button-secondary">Batal</button>}</div></form></Panel><Panel><AsyncState loading={loading} error={error} empty={!rows.length && !pagination}>{rows.length > 0 && <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{row.name || row.email}</p><p className="text-xs text-slate-500">{row.email} - {row.role} - {row.isActive ? "Aktif" : "Nonaktif"}</p></div><div className="flex gap-2"><button onClick={() => { setEditing(row.id); setForm({ name: row.name || "", email: row.email, password: "", role: row.role }); }} className="button-secondary">Edit</button>{row.id !== user.id && <><button onClick={() => toggle(row)} className="button-secondary">{row.isActive ? "Nonaktifkan" : "Aktifkan"}</button><button onClick={() => remove(row.id)} className="button-danger">Hapus</button></>}</div></div>)}</div>}{pagination && <PaginationControls pagination={pagination} onPageChange={(off) => load(off)} />}</AsyncState></Panel></Section>;
}

function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null); const [offset, setOffset] = useState(0);
  const load = useCallback(async (off = 0) => { setLoading(true); setError(""); try { const r = await api.listAudit({ limit: PAGE_SIZE, offset: off }); setEntries(r.audit); setPagination(r.pagination); setOffset(off); } catch (e: any) { setError(e?.message ?? "Gagal memuat audit log."); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  return <Section title="Audit Log" action={<button onClick={() => load(offset)} className="button-secondary">Muat ulang</button>}><Panel><AsyncState loading={loading} error={error} empty={!entries.length && !pagination}><AuditList entries={entries} detailed />{pagination && <PaginationControls pagination={pagination} onPageChange={(off) => load(off)} />}</AsyncState></Panel></Section>;
}

function AuditList({ entries, detailed = false }: { entries: AuditEntry[]; detailed?: boolean }) { if (!entries.length) return <p className="text-sm text-slate-500">Belum ada aktivitas.</p>; return <div className="divide-y divide-slate-100">{entries.map((entry) => <div key={entry.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium text-slate-800">{entry.action} - {entry.entity}</span><span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span></div>{detailed && <p className="text-xs text-slate-500 mt-1">{entry.user?.email || "Sistem"} - {entry.entityId || "-"} - {entry.ip || "-"}</p>}{detailed && entry.metadata && <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600">{JSON.stringify(entry.metadata, null, 2)}</pre>}</div>)}</div>; }

function LoginPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login"); const [form, setForm] = useState({ name: "", email: "", password: "" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(""); try { if (mode === "bootstrap") await api.bootstrap(form.name, form.email, form.password); else await api.login(form.email, form.password); onDone(); } catch (e: any) { setError(e?.message ?? "Gagal masuk."); } finally { setBusy(false); } };
  return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4"><form onSubmit={submit} className="bg-white rounded-2xl shadow p-8 w-full max-w-sm space-y-4"><h1 className="text-xl font-bold text-slate-900">Panel Admin TPB</h1><p className="text-sm text-slate-500">{mode === "login" ? "Masuk dengan akun admin Anda." : "Buat akun admin pertama (hanya tersedia sekali, saat database masih kosong)."}</p>{mode === "bootstrap" && <input required className="admin-input w-full" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}<input required type="email" className="admin-input w-full" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><input required type="password" minLength={10} className="admin-input w-full" placeholder="Kata sandi (min. 10 karakter)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />{error && <Notice error={error} />}<button disabled={busy} className="button-primary w-full disabled:opacity-50">{busy ? "Memproses..." : mode === "login" ? "Masuk" : "Buat Akun Admin"}</button><button type="button" onClick={() => setMode(mode === "login" ? "bootstrap" : "login")} className="w-full text-xs text-slate-500 hover:text-slate-800">{mode === "login" ? "Akun admin pertama? Buat di sini" : "Sudah punya akun? Masuk"}</button></form></div>;
}
