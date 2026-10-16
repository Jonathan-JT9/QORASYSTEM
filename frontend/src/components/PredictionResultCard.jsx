import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  ShieldCheck,
  Activity,
} from "lucide-react";

export default function PredictionResultCard({ result }) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8 text-center text-sm text-neutral-500">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white text-black shadow-sm">
          <Activity className="h-6 w-6" />
        </div>
        <p className="font-semibold text-neutral-800">
          Menunggu Analisis Citra
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Hasil klasifikasi HQCNN dan probabilitas kuantum akan ditampilkan di
          sini.
        </p>
      </div>
    );
  }

  const isTb = result.label === "TB";
  const probs = result.probabilities || {};
  const confidencePct = (result.confidence * 100).toFixed(1);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 p-6 transition-all shadow-sm ${
        isTb ? "border-black bg-white" : "border-neutral-300 bg-white"
      }`}
    >
      {/* Header tag */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600">
          <Cpu className="h-3.5 w-3.5 text-black" />
          Klasifikasi Quantum HQCNN
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isTb
              ? "bg-black text-white"
              : "border-2 border-black bg-white text-black"
          }`}
        >
          {isTb ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {isTb ? "Indikasi Positif TB" : "Skrining Negatif (Normal)"}
        </span>
      </div>

      {/* Main classification result */}
      <div className="mt-5 flex items-baseline justify-between border-b border-neutral-200 pb-5">
        <div>
          <h3 className="text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
            {result.label === "TB" ? "Tuberkulosis (TB)" : "Normal / Bebas TB"}
          </h3>
          <p className="mt-1.5 text-xs text-neutral-600">
            {isTb
              ? "Model mendeteksi pola radiologis konsisten dengan infeksi TB."
              : "Citra radiograf tidak memperlihatkan infiltrat tipikal TB."}
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-black">
            {confidencePct}%
          </span>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            Keyakinan Argmax
          </p>
        </div>
      </div>

      {/* Probability bars */}
      <div className="mt-5 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-600">
          Distribusi Probabilitas Kelas Kuantum
        </p>
        {["TB", "Normal"].map((cls) => {
          const value = Number(probs[cls] ?? 0);
          const pct = (value * 100).toFixed(1);
          const isThisTb = cls === "TB";

          return (
            <div key={cls}>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-semibold text-neutral-800">
                  {cls === "TB" ? "Tuberkulosis (TB)" : "Normal"}
                </span>
                <span className="font-mono font-bold text-black">{pct}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full transition-all duration-700 ease-out rounded-full ${
                    isThisTb ? "bg-black" : "bg-neutral-600"
                  }`}
                  style={{ width: `${Math.min(100, value * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Circuit Metadata footnote */}
      <div className="mt-4 flex items-center justify-between pt-2 text-[11px] text-neutral-500">
        <span>Sirkuit: 6-Qubit VQC (PennyLane)</span>
        <span>Backbone: ResNet-50</span>
      </div>
    </div>
  );
}
