import {
  AlertTriangle,
  ShieldCheck,
  Cpu,
  Activity,
} from "lucide-react";

export default function PredictionResultCard({ result }) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">

        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white">
          <Activity className="h-6 w-6 text-black" />
        </div>

        <p className="text-sm font-semibold text-neutral-800">
          Menunggu Analisis Citra
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          Hasil klasifikasi HQCNN dan probabilitas prediksi akan
          ditampilkan setelah citra dianalisis.
        </p>

      </div>
    );
  }

  const isTb = result.label === "TB";
  const probs = result.probabilities || {};

  const confidencePct = (
    Number(result.confidence || 0) * 100
  ).toFixed(1);

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-neutral-300 bg-white p-6 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">

        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600">
          <Cpu className="h-3.5 w-3.5" />
          Klasifikasi Hybrid QCNN
        </span>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isTb
            ? "bg-black text-white"
            : "border border-black bg-white text-black"
            }`}
        >
          {isTb ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}

          {isTb ? "Prediksi TB" : "Prediksi Normal"}
        </span>

      </div>

      {/* Main Result */}
      <div className="mt-5 flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-5">

        <div>

          <h3 className="text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            {isTb ? "Tuberkulosis (TB)" : "Normal"}
          </h3>

          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            {isTb
              ? "Model mengklasifikasikan citra Chest X-Ray ke dalam kategori Tuberkulosis (TB). Hasil ini memerlukan evaluasi klinis lebih lanjut."
              : "Model mengklasifikasikan citra Chest X-Ray ke dalam kategori Normal. Hasil ini tidak menyingkirkan kemungkinan penyakit secara definitif."}
          </p>

        </div>

        <div className="shrink-0 text-right">

          <span className="text-3xl font-black text-black">
            {confidencePct}%
          </span>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Confidence Model
          </p>

        </div>

      </div>

      {/* Probabilities */}
      <div className="mt-5 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">

        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
          Probabilitas Prediksi Model
        </p>

        {["TB", "Normal"].map((cls) => {
          const value = Number(probs[cls] ?? 0);
          const pct = (value * 100).toFixed(1);

          return (
            <div key={cls}>

              <div className="mb-1.5 flex justify-between text-xs">

                <span className="font-semibold text-neutral-800">
                  {cls === "TB" ? "Tuberkulosis (TB)" : "Normal"}
                </span>

                <span className="font-mono font-bold text-black">
                  {pct}%
                </span>

              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">

                <div
                  className={`h-full rounded-full transition-all duration-700 ${cls === "TB" ? "bg-black" : "bg-neutral-600"
                    }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, value * 100))}%`,
                  }}
                />

              </div>

            </div>
          );
        })}

      </div>

      {/* Metadata */}
      <div className="mt-4 flex items-center justify-between pt-2 text-[11px] text-neutral-500">

        <span>
          Sirkuit: {result.model?.n_qubits ?? 6}-Qubit VQC
        </span>

        <span>
          Backbone: {result.model?.backbone ?? "ResNet-50"}
        </span>

      </div>

      {/* Validation Verification Badge */}
      {result.validation && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
          <span className="flex items-center gap-1.5 font-semibold text-black">
            <ShieldCheck className="h-3.5 w-3.5 text-black" />
            Tervalidasi Gemini Vision & CLIP
          </span>
          <span className="font-mono text-[10px] text-neutral-500">
            {result.validation.gemini?.projection || "PA/AP"} · Grayscale
          </span>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Confidence merupakan skor prediksi model dan bukan ukuran
        kepastian diagnosis klinis.
      </p>

    </div>
  );
}