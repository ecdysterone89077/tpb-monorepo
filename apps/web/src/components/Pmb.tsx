import { useState } from "react";
import { api } from "../lib/api";

// Program studi diisi dari pilihan pengguna; daftar program tidak di-hardcode di sini —
// mengambil dari konten situs (content.programs.cards) oleh pemanggil.

export function Pmb({ onClose, programs }: { onClose: () => void; programs: string[] }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", school: "", program: "", message: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const idempotencyKey = () => {
    const K = "tpb-pmb-idem";
    let key = sessionStorage.getItem(K);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(K, key);
    }
    return key;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      await api.registerPmb({ ...form, idempotencyKey: idempotencyKey() });
      sessionStorage.removeItem("tpb-pmb-idem");
      setState("done");
    } catch (err: any) {
      setError(err?.message ?? "Gagal mengirim pendaftaran.");
      setState("error");
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {state === "done" ? (
          <div className="text-center py-8">
            <p className="text-lg font-semibold text-slate-900 mb-2">Pendaftaran terkirim</p>
            <p className="text-slate-500 text-sm mb-6">Tim PMB akan menghubungi Anda.</p>
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm">Tutup</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-xl font-bold">Pendaftaran PMB</h2>
            <input required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama lengkap" value={form.name} onChange={set("name")} />
            <input required type="email" className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={set("email")} />
            <input required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nomor WhatsApp / telepon" value={form.phone} onChange={set("phone")} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Asal sekolah" value={form.school} onChange={set("school")} />
            {programs.length > 0 && (
              <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.program} onChange={set("program")}>
                <option value="">Pilih program</option>
                {programs.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Pesan" value={form.message} onChange={set("message")} />
            {state === "error" && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border text-sm">Batal</button>
              <button type="submit" disabled={state === "sending"} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50">
                {state === "sending" ? "Mengirim…" : "Kirim"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
