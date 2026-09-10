import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AdminUser, DashboardSummary } from "@tpb/contracts";

type View = "dashboard" | "content" | "posts" | "pmb" | "gallery" | "subs" | "users" | "audit";

const NAV: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "content", label: "Konten Situs" },
  { id: "posts", label: "Berita" },
  { id: "pmb", label: "PMB" },
  { id: "gallery", label: "Galeri & Media" },
  { id: "subs", label: "Pelanggan" },
  { id: "users", label: "Pengguna" },
  { id: "audit", label: "Audit Log" },
];

export function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>("dashboard");

  const check = useCallback(async () => {
    const u = await api.currentUser();
    setUser(u);
    setChecking(false);
  }, []);

  useEffect(() => { check(); }, [check]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-slate-100">Memuat sesi…</div>;
  }

  if (!user) {
    return <LoginPanel onDone={check} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 text-slate-100 p-4 space-y-1 hidden md:block">
        <p className="font-bold text-lg mb-4 px-2">Panel Admin TPB</p>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setView(n.id)}
            className={`block w-full text-left px-3 py-2 rounded-lg text-sm ${view === n.id ? "bg-slate-100 text-slate-900 font-semibold" : "hover:bg-slate-800"}`}>
            {n.label}
          </button>
        ))}
        <div className="pt-4 mt-4 border-t border-slate-700 space-y-1">
          <p className="text-xs text-slate-400 px-3 truncate">{user.email}</p>
          <button onClick={async () => { await api.logout(); setUser(null); }} className="text-xs text-red-400 hover:text-red-300 px-3 py-1">Keluar</button>
          <a href="#/" className="block text-xs text-slate-400 hover:text-slate-200 px-3 py-1">← Kembali ke situs</a>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10 overflow-x-auto">
        {view === "dashboard" && <DashboardView />}
        {view === "content" && <div className="text-slate-500">Editor konten — modul konten.</div>}
        {view === "posts" && <div className="text-slate-500">Modul berita.</div>}
        {view === "pmb" && <div className="text-slate-500">Modul PMB.</div>}
        {view === "gallery" && <div className="text-slate-500">Modul galeri & media.</div>}
        {view === "subs" && <div className="text-slate-500">Modul pelanggan.</div>}
        {view === "users" && <div className="text-slate-500">Modul pengguna.</div>}
        {view === "audit" && <div className="text-slate-500">Modul audit log.</div>}
      </main>
    </div>
  );
}

function DashboardView() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  useEffect(() => { api.dashboardSummary().then(setSummary).catch(() => {}); }, []);
  if (!summary) return <p className="text-slate-500">Memuat dashboard…</p>;
  const cards: [string, number][] = [["Berita", summary.posts], ["Pendaftar Baru", summary.newPmb], ["Pelanggan", summary.subscribers], ["Media", summary.media]];
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-3xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="font-semibold mb-2 text-slate-900">Aktivitas Terakhir</h2>
        <ul className="text-sm text-slate-600 space-y-1">
          {summary.audit.map((a) => <li key={a.id}>{a.createdAt} — {a.action}</li>)}
        </ul>
      </div>
    </div>
  );
}

function LoginPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "bootstrap">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (mode === "bootstrap") await api.bootstrap(form.name, form.email, form.password);
      else await api.login(form.email, form.password);
      onDone();
    } catch (err: any) {
      setError(err?.message ?? "Gagal masuk.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow p-8 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-slate-900">Panel Admin TPB</h1>
        <p className="text-sm text-slate-500">
          {mode === "login" ? "Masuk dengan akun admin Anda." : "Buat akun admin pertama (hanya tersedia sekali, saat database masih kosong)."}
        </p>
        {mode === "bootstrap" && (
          <input required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        )}
        <input required type="email" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required type="password" minLength={10} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Kata sandi (min. 10 karakter)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm disabled:opacity-50">
          {busy ? "Memproses…" : mode === "login" ? "Masuk" : "Buat Akun Admin"}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "bootstrap" : "login")} className="w-full text-xs text-slate-500 hover:text-slate-800">
          {mode === "login" ? "Akun admin pertama? Buat di sini" : "Sudah punya akun? Masuk"}
        </button>
      </form>
    </div>
  );
}
