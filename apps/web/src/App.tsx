import { useEffect, useState } from "react";
import { AdminPage } from "./components/AdminPage";
import { Pmb } from "./components/Pmb";
import { About, Community, Programs, Research, Stats, StudentLife } from "./components/public/Sections";
import { BackToTop, CTA, DetailSections, Footer, News } from "./components/public/ContentSections";
import { Header, Hero, Marquee } from "./components/public/Hero";
import { useReveal } from "./components/public/ui";
import { useContent } from "./lib/content";
import type { SiteContent } from "@tpb/contracts";

export default function App() {
  const content = useContent();
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  useEffect(() => { const apply = () => setIsAdminRoute(window.location.hash === "#admin"); apply(); window.addEventListener("hashchange", apply); return () => window.removeEventListener("hashchange", apply); }, []);
  if (isAdminRoute) return <AdminPage />;
  if (content.status === "loading") return <div className="min-h-screen grid place-items-center bg-cream text-midnight/60"><p className="animate-pulse">Memuat konten…</p></div>;
  if (content.status === "error") return <div className="min-h-screen grid place-items-center bg-cream p-6"><div className="max-w-md text-center"><p className="font-semibold text-red-600">Gagal memuat konten</p><p className="mt-2 text-sm text-midnight/60">{content.message}</p><button onClick={() => content.reload()} className="mt-5 rounded-full bg-midnight px-6 py-3 text-sm font-bold text-white">Coba lagi</button></div></div>;
  if (content.status === "empty") return <div className="min-h-screen grid place-items-center bg-cream p-6"><div className="max-w-md text-center"><p className="font-display text-3xl font-bold text-midnight">Konten belum dikonfigurasi</p><p className="mt-3 text-sm text-midnight/60">Atur seluruh konten situs melalui Panel Admin.</p><a href="#admin" className="mt-5 inline-block rounded-full bg-midnight px-6 py-3 text-sm font-bold text-white">Buka Panel Admin</a></div></div>;
  return <PublicSite content={content.content} />;
}

function PublicSite({ content }: { content: SiteContent }) {
  useReveal();
  const [pmb, setPmb] = useState(false);
  const onDaftar = () => { const url = content.pmbLink.trim(); if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener"); else setPmb(true); };
  return <div className="min-h-full bg-cream font-sans text-midnight"><Header brand={content.brand} navigation={content.navigation} onAdmin={() => { window.location.hash = "admin"; }} /><main><Hero hero={content.hero} onDaftar={onDaftar} /><Marquee items={content.marquee} /><Stats items={content.stats} /><About about={content.about} /><DetailSections content={content} /><Programs programs={content.programs} onDaftar={onDaftar} /><Research research={content.research} /><Community community={content.community} /><StudentLife studentLife={content.studentLife} onDaftar={onDaftar} /><News news={content.news} /><CTA cta={content.cta} onDaftar={onDaftar} /></main><Footer footer={content.footer} onDaftar={onDaftar} /><BackToTop />{pmb && <Pmb onClose={() => setPmb(false)} programs={content.programs.cards.map((card) => card.title)} />}</div>;
}
