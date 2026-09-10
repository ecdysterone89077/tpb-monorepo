import { useEffect, useState } from "react";
import { useContent } from "./lib/content";
import { AdminPage } from "./components/AdminPage";
import { Pmb } from "./components/Pmb";

export default function App() {
  const content = useContent();
  const [pmbOpen, setPmbOpen] = useState(false);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    const apply = () => setIsAdminRoute(window.location.hash === "#admin");
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  if (isAdminRoute) return <AdminPage />;

  if (content.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-white">
        <p className="animate-pulse">Memuat konten…</p>
      </div>
    );
  }

  if (content.status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <p className="text-red-600 font-semibold mb-2">Gagal memuat konten</p>
          <p className="text-slate-500 text-sm mb-4">{content.message}</p>
          <button onClick={() => content.reload()} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">Coba lagi</button>
        </div>
      </div>
    );
  }

  if (content.status === "empty") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-6">
          <p className="text-slate-800 font-semibold mb-2">Konten belum dikonfigurasi</p>
          <p className="text-slate-500 text-sm mb-4">Atur konten situs melalui Panel Admin.</p>
          <a href="#admin" className="inline-block px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">Buka Panel Admin</a>
        </div>
      </div>
    );
  }

  const c = content.content;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Hero + navigasi dirender oleh komponen section di bawah */}
      {pmbOpen && <Pmb onClose={() => setPmbOpen(false)} programs={c.programs.cards.map((x) => x.title)} />}
      <button onClick={() => setPmbOpen(true)} className="hidden">{c.hero.primaryLabel}</button>
    </div>
  );
}
