import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, Copy, Check, FileText, AlertCircle } from "lucide-react";

export default function InterpretationBox({ text, loading = false }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin interpretasi:", err);
    }
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-black">Interpretasi Klinis AI</h3>
          </div>
        </div>
        {text && (
          <button onClick={handleCopy} className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-semibold hover:bg-neutral-200">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Tersalin" : "Salin Teks"}
          </button>
        )}
      </div>

      <div className="flex-1 py-6">
        {loading ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 text-base font-semibold text-neutral-700">
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span>Gemini sedang menyusun interpretasi klinis...</span>
            </div>
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-neutral-200" />
          </div>
        ) : text ? (
          <div className="text-[15px] leading-7 text-neutral-700 [&_p]:mb-4 [&_strong]:font-bold [&_strong]:text-black [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-3">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex min-h-[230px] flex-col items-center justify-center text-center">
            <FileText className="mb-3 h-9 w-9 text-neutral-300" />
            <p className="font-medium text-neutral-600">Belum ada interpretasi</p>
            <p className="mt-1 text-sm text-neutral-400">Interpretasi Gemini akan muncul setelah proses klasifikasi selesai.</p>
          </div>
        )}
      </div>
    </div>
  );
}