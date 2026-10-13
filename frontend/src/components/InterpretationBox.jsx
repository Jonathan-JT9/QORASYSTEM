import { useState } from "react";
import { Sparkles, FileText, Copy, Check, AlertCircle } from "lucide-react";

export default function InterpretationBox({ text, loading }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black">Interpretasi Klinis AI</h3>
              <p className="text-[11px] text-neutral-500">Disintesis oleh Google Gemini 2.5 Flash</p>
            </div>
          </div>

          {text && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-black hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Tersalin!" : "Salin Teks"}</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="mt-4">
          {loading ? (
            <div className="space-y-3 py-6">
              <div className="flex items-center gap-3 text-black">
                <Sparkles className="h-5 w-5 animate-spin" />
                <span className="text-sm font-semibold animate-pulse">Menghubungi Gemini 2.5 Flash untuk analisis klinis…</span>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
              </div>
            </div>
          ) : text ? (
            <div className="prose-clinical whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
              {text}
            </div>
          ) : (
            <div className="flex min-h-[140px] flex-col items-center justify-center text-center text-sm text-neutral-400">
              <FileText className="mb-2 h-7 w-7 text-neutral-300" />
              <p className="font-medium text-neutral-600">Belum ada interpretasi</p>
              <p className="text-xs text-neutral-400">Narasi klinis otomatis akan muncul setelah inferensi citra selesai.</p>
            </div>
          )}
        </div>
      </div>

      {/* Medical disclaimer note */}
      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-neutral-300 bg-neutral-100 p-3.5 text-[11px] text-neutral-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-black" />
        <span>
          <strong>Peringatan Klinis:</strong> Hasil interpretasi AI ini merupakan alat bantu keputusan dan tidak menggantikan pembacaan radiologi formal atau konfirmasi laboratorium.
        </span>
      </div>
    </div>
  );
}
