import { useEffect, type ReactNode } from "react";

/**
 * Shared presentation primitives for the public site.
 * Policy: these hold generic UI structure only — no institution copy, no image
 * URLs, no fallback data. Every visible value comes from the API via props.
 */

export function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    const observe = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => io.observe(el));
    };
    observe();
    const mo = new MutationObserver(() => observe());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
    };
  }, []);
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function Band({ id, tone = "cream", kicker, title, intro, children }: { id: string; tone?: "cream" | "white"; kicker: string; title: string; intro?: string; children?: ReactNode }) {
  return <section id={id} className={`scroll-mt-24 ${tone === "cream" ? "bg-cream" : "bg-white"} py-16`}><div className="mx-auto max-w-[1360px] px-5 lg:px-10"><div className="reveal max-w-2xl"><span className="font-mono text-[11px] uppercase tracking-[0.3em] text-leaf-600">{kicker}</span><h2 className="mt-3 font-display text-3xl font-extrabold leading-tight text-midnight lg:text-4xl">{title}</h2>{intro && <p className="mt-4 text-[15px] leading-relaxed text-midnight/70">{intro}</p>}</div>{children && <div className="mt-10">{children}</div>}</div></section>;
}

/** Decorative shield marked with rising growth lines — not an institution logo. */
export function Crest({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false"><defs><linearGradient id="tpbCrestGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#43c07d" /><stop offset="1" stopColor="#2b8a56" /></linearGradient></defs><path d="M32 3 8 12v20c0 15 10 24 24 29 14-5 24-14 24-29V12L32 3Z" fill="url(#tpbCrestGradient)" stroke="#f5a623" strokeWidth="2" /><path d="M32 20c-6 4-9 9-9 15 0 5 4 9 9 9s9-4 9-9c0-6-3-11-9-15Z" fill="#fff" opacity="0.9" /><path d="M32 44V26M27 31l5-3 5 3" stroke="#2b8a56" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CollectionState({ loading, error, empty, children }: { loading: boolean; error?: string; empty: boolean; children: ReactNode }) {
  if (loading) return <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="animate-pulse rounded-3xl border border-midnight/8 bg-white"><div className="h-48 rounded-t-3xl bg-midnight/10" /><div className="space-y-3 p-6"><div className="h-3 w-24 rounded bg-midnight/10" /><div className="h-5 w-full rounded bg-midnight/10" /></div></div>)}</div>;
  if (error) return <p className="mt-10 text-center text-midnight/60">Gagal memuat data. Coba muat ulang halaman.</p>;
  if (empty) return <p className="mt-10 text-center text-midnight/50">Belum ada data untuk ditampilkan.</p>;
  return <>{children}</>;
}
