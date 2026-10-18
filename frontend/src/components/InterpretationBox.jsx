import { useState } from "react";
import { Sparkles, FileText, Copy, Check, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function InterpretationBox({ text, loading }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Gagal menyalin interpretasi:", error);
    }
  };

  return (
    <div className="relative flex h-full flex-col justify-between rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">

      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 pb-4">

          <div className="flex items-center gap-2.5">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <Sparkles className="h-4 w-4" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-black">
                Interpretasi Klinis AI
              </h3>

              <p className="text-[11px] text-neutral-500">
                Disintesis oleh Google Gemini 3.8 Flash
              </p>
            </div>

          </div>

          {/* Copy Button */}
          {text && !loading && (
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-black hover:text-white"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}

              <span>
                {copied ? "Tersalin!" : "Salin Teks"}
              </span>
            </button>
          )}

        </div>

        {/* Content Body */}
        <div className="mt-5">

          {loading ? (

            /* Loading State */
            <div className="space-y-3 py-6">

              <div className="flex items-center gap-3 text-black">
                <Sparkles className="h-5 w-5 animate-spin" />

                <span className="animate-pulse text-sm font-semibold">
                  Menghubungi Gemini 3.8 Flash untuk menyusun interpretasi…
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-neutral-200" />
              </div>

            </div>

          ) : text ? (

            /* Gemini Markdown Interpretation */
            <div className="text-sm leading-relaxed text-neutral-800">

              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{

                  /* Paragraph */
                  p: ({ children }) => (
                    <p className="mb-3 leading-relaxed text-neutral-700">
                      {children}
                    </p>
                  ),

                  /* Bold */
                  strong: ({ children }) => (
                    <strong className="font-bold text-black">
                      {children}
                    </strong>
                  ),

                  /* Italic */
                  em: ({ children }) => (
                    <em className="italic text-neutral-700">
                      {children}
                    </em>
                  ),

                  /* Heading 1 */
                  h1: ({ children }) => (
                    <h1 className="mb-3 mt-5 text-lg font-bold text-black">
                      {children}
                    </h1>
                  ),

                  /* Heading 2 */
                  h2: ({ children }) => (
                    <h2 className="mb-3 mt-5 text-base font-bold text-black">
                      {children}
                    </h2>
                  ),

                  /* Heading 3 */
                  h3: ({ children }) => (
                    <h3 className="mb-2 mt-4 text-sm font-bold text-black">
                      {children}
                    </h3>
                  ),

                  /* Unordered List */
                  ul: ({ children }) => (
                    <ul className="mb-4 list-disc space-y-2 pl-5 text-neutral-700">
                      {children}
                    </ul>
                  ),

                  /* Ordered List */
                  ol: ({ children }) => (
                    <ol className="mb-4 list-decimal space-y-2 pl-5 text-neutral-700">
                      {children}
                    </ol>
                  ),

                  /* List Item */
                  li: ({ children }) => (
                    <li className="pl-1 leading-relaxed">
                      {children}
                    </li>
                  ),

                  /* Blockquote */
                  blockquote: ({ children }) => (
                    <blockquote className="my-3 border-l-2 border-black bg-neutral-50 py-2 pl-4 italic text-neutral-600">
                      {children}
                    </blockquote>
                  ),

                  /* Horizontal Rule */
                  hr: () => (
                    <hr className="my-5 border-neutral-200" />
                  ),

                }}
              >
                {text}
              </ReactMarkdown>

            </div>

          ) : (

            /* Empty State */
            <div className="flex min-h-[140px] flex-col items-center justify-center text-center text-sm text-neutral-400">

              <FileText className="mb-2 h-7 w-7 text-neutral-300" />

              <p className="font-medium text-neutral-600">
                Belum ada interpretasi
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Narasi interpretasi otomatis akan muncul setelah
                proses klasifikasi citra selesai.
              </p>

            </div>

          )}

        </div>
      </div>

      {/* Medical Disclaimer */}
      <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-neutral-300 bg-neutral-100 p-3.5 text-[11px] text-neutral-700">

        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-black" />

        <span className="leading-relaxed">
          <strong className="font-bold text-black">
            Peringatan Klinis:
          </strong>{" "}
          Hasil interpretasi AI ini merupakan alat bantu keputusan
          klinis dan tidak menggantikan pembacaan radiologi formal,
          pemeriksaan klinis, atau konfirmasi laboratorium.
        </span>

      </div>

    </div>
  );
}