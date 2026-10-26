import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { sendChatMessage } from "../services/api";

export default function ClinicalChatbot({ result }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize or reset chat when a new prediction result arrives
  useEffect(() => {
    if (!result) {
      setMessages([]);
      return;
    }

    const label = result.label || "Klasifikasi";
    const confidence = result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : "";
    const filename = result.filename || "CXR";

    const welcomeText =
      `Halo Dokter. Saya asisten klinis AI QORA yang terhubung langsung dengan hasil klasifikasi **${label} (${confidence})** dan analisis atensi **Grad-CAM** untuk citra *${filename}*.\n\n` +
      `Anda dapat mendiskusikan temuan visual Grad-CAM, probabilitas model, pemeriksaan konfirmasi lanjutan untuk TBC/Normal, atau arsitektur kuantum QORA. Silakan pilih pertanyaan cepat di atas atau ajukan pertanyaan Anda.`;

    setMessages([
      {
        role: "model",
        text: welcomeText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    setError("");
    setInput("");
  }, [result?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isTB = result?.label?.toLowerCase().includes("tuberculosis") || result?.label === "TB";
  const confidencePercent = result?.confidence ? `${(result.confidence * 100).toFixed(1)}%` : "";

  const suggestedQuestions = isTB
    ? [
      `Mengapa model memprediksi TB (${confidencePercent})?`,
      "Jelaskan area fokus dan arti warna pada visualisasi Grad-CAM ini",
      "Apa pemeriksaan mikrobiologis konfirmasi yang dianjurkan?",
      "Bagaimana peran sirkuit kuantum 6-qubit QORA dalam klasifikasi?"
    ]
    : [
      `Apa dasar model mengklasifikasikan paru ini Normal (${confidencePercent})?`,
      "Jelaskan visualisasi atensi Grad-CAM pada paru normal ini",
      "Apakah tetap perlu evaluasi klinis lanjutan jika pasien bergejala?",
      "Bagaimana cara kerja arsitektur Hybrid QCNN QORA?"
    ];

  async function handleSend(textToSend) {
    const query = (typeof textToSend === "string" ? textToSend : input).trim();
    if (!query || loading) return;

    setError("");
    const userMsg = {
      role: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Format history for backend Gemini API
    const historyPayload = messages.map(m => ({
      role: m.role,
      text: m.text
    }));

    const contextPayload = {
      label: result?.label,
      confidence: result?.confidence,
      probabilities: result?.probabilities,
      filename: result?.filename,
      interpretation: result?.interpretation,
      gradcam_analysis: result?.gradcam_analysis,
      model: result?.model
    };

    try {
      const response = await sendChatMessage({
        prediction_id: result?.id,
        message: query,
        history: historyPayload,
        context: contextPayload
      });

      const replyText = response.reply || "Maaf, respon tidak dapat dihasilkan.";
      setMessages(prev => [
        ...prev,
        {
          role: "model",
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Gagal menghubungi asisten AI. Silakan coba kembali.";
      setError(errMsg);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleCopy(text, index) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function handleReset() {
    if (!result) return;
    const label = result.label || "Klasifikasi";
    const confidence = result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : "";
    setMessages([
      {
        role: "model",
        text: `Percakapan diatur ulang. Saya siap membantu diskusi klinis seputar citra **${result.filename}** (${label} - ${confidence}) dan peta Grad-CAM. Apa yang ingin Anda tanyakan?`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    setError("");
    setInput("");
  }

  return (
    <div className="flex flex-col rounded-2xl border border-neutral-300 bg-white shadow-sm transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shadow-sm">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-black">Tanya AI Klinis QORA</h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                <Sparkles className="h-3 w-3 text-black" />
                Gemini Connected
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Terhubung ke hasil klasifikasi, Grad-CAM, & panduan TB/Normal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              onClick={handleReset}
              title="Reset Percakapan"
              className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-black"
            title={isCollapsed ? "Buka Chatbot" : "Ciutkan Chatbot"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Context Badges Bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-5 py-2.5 text-xs">
            <span className="font-semibold text-neutral-500">Konteks Aktif:</span>
            <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-bold text-black">
              <span className={`h-1.5 w-1.5 rounded-full ${isTB ? "bg-red-500" : "bg-emerald-500"}`} />
              {result?.label || "N/A"} ({confidencePercent})
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] font-medium text-neutral-700">
              <Layers className="h-3 w-3 text-neutral-500" />
              Grad-CAM Active
            </span>
            {result?.gradcam_analysis?.primary_zone && (
              <span className="hidden truncate rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 md:inline-block max-w-[260px]">
                🎯 {result.gradcam_analysis.primary_zone}
              </span>
            )}
          </div>

          {/* Quick Suggested Prompt Chips */}
          <div className="border-b border-neutral-100 bg-white px-5 py-3">
            <p className="mb-2 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Rekomendasi Pertanyaan Klinis:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  disabled={loading}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-left text-xs font-medium text-neutral-700 transition-all hover:border-black hover:bg-neutral-100 active:scale-98 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex max-h-[420px] min-h-[220px] flex-col gap-4 overflow-y-auto p-5 text-sm leading-relaxed scroll-smooth">
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={index}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`group relative max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${isUser
                        ? "bg-black text-white rounded-br-none"
                        : "border border-neutral-200 bg-neutral-50/80 text-neutral-800 rounded-bl-none"
                      }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="text-[14px] leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-bold [&_strong]:text-black [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}

                    <div
                      className={`mt-1.5 flex items-center justify-between gap-2 text-[10px] ${isUser ? "text-neutral-300" : "text-neutral-400"
                        }`}
                    >
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.text, index)}
                          className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-black"
                          title="Salin jawaban"
                        >
                          {copiedIndex === index ? (
                            <Check className="h-3 w-3 text-black" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-100 text-neutral-800">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
                  </span>
                  <span className="font-medium text-neutral-600">Gemini sedang menganalisis data CXR & Grad-CAM...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold">{error}</p>
                  <button
                    onClick={() => handleSend(messages[messages.length - 1]?.text)}
                    className="mt-1 font-bold underline hover:text-red-900"
                  >
                    Coba kirim ulang
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className="border-t border-neutral-200 p-4">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tanyakan temuan CXR, Grad-CAM, atau penanganan TB..."
                disabled={loading}
                className="flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-1 focus:ring-black disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-10 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </form>

            {/* Scope / Guardrail Notice */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
                Jawaban dibatasi khusus sistem QORA, citra CXR, Grad-CAM, & kondisi TB/Normal.
              </span>
              <span className="hidden sm:inline text-neutral-400">Tekan Enter untuk mengirim</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
