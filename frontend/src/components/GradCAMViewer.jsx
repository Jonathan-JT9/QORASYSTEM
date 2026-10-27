import { useState } from "react";
import { Layers, Sliders } from "lucide-react";

export default function GradCAMViewer({ originalUrl, overlayUrl, error }) {
  const [viewMode, setViewMode] = useState("side-by-side");
  const [opacity, setOpacity] = useState(65);

  if (error || !originalUrl || !overlayUrl) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50 p-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white">
          <Layers className="h-6 w-6 text-black" />
        </div>

        <p className="text-sm font-semibold text-neutral-800">
          Peta Visualisasi Grad-CAM
        </p>

        <p className="mt-1 text-xs text-neutral-500">
          {error
            ? "Visualisasi Grad-CAM tidak ditampilkan karena analisis citra gagal."
            : "Visualisasi Grad-CAM akan ditampilkan setelah proses klasifikasi Chest X-Ray selesai."}
        </p>
      </div>
    );
  }

  const imageClass = "h-full w-full object-contain";

  return (
    <div className="space-y-5 rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-black">
              Visualisasi Grad-CAM
            </h3>

            <span className="rounded border border-black bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
              Explainable AI (XAI)
            </span>
          </div>

          <p className="mt-1 text-xs text-neutral-600">
            Memvisualisasikan area citra yang berkontribusi terhadap
            prediksi model Hybrid QCNN menggunakan metode Grad-CAM.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 text-xs">

          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${viewMode === "side-by-side"
              ? "bg-black text-white shadow-sm"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Berdampingan
          </button>

          <button
            type="button"
            onClick={() => setViewMode("blend")}
            disabled={!originalUrl || !overlayUrl}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${viewMode === "blend"
              ? "bg-black text-white shadow-sm"
              : "text-neutral-600 hover:text-black"
              }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Overlay Interaktif
          </button>

        </div>
      </div>

      {/* Side-by-Side */}
      {viewMode === "side-by-side" && (
        <div className="grid gap-4 sm:grid-cols-2">

          {originalUrl && (
            <figure className="overflow-hidden rounded-xl border border-neutral-300 bg-black">

              <div className="relative aspect-square w-full overflow-hidden bg-black">
                <img
                  src={originalUrl}
                  alt="Citra Chest X-Ray asli"
                  className={imageClass}
                />
              </div>

              <figcaption className="flex items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4 py-3 text-xs">
                <span className="font-semibold text-black">
                  Citra Chest X-Ray Asli
                </span>
              </figcaption>

            </figure>
          )}

          {overlayUrl && (
            <figure className="overflow-hidden rounded-xl border border-neutral-300 bg-black">

              <div className="relative aspect-square w-full overflow-hidden bg-black">
                <img
                  src={overlayUrl}
                  alt="Visualisasi Grad-CAM"
                  className={imageClass}
                />
              </div>

              <figcaption className="flex items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4 py-3 text-xs">
                <span className="font-semibold text-black">
                  Overlay Grad-CAM
                </span>
              </figcaption>

            </figure>
          )}

        </div>
      )}

      {/* Interactive Overlay */}
      {viewMode === "blend" && originalUrl && overlayUrl && (
        <div className="space-y-4">

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">

            <div className="flex items-center gap-2 text-xs text-neutral-800">
              <Sliders className="h-4 w-4" />

              <span className="font-medium">
                Intensitas Tampilan Overlay:
              </span>

              <span className="font-mono font-bold">
                {opacity}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-2 w-48 cursor-pointer accent-black"
            />

          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[500px] overflow-hidden rounded-xl border border-neutral-300 bg-black">

            {/* Original Image */}
            <img
              src={originalUrl}
              alt="Chest X-Ray asli"
              className="absolute inset-0 h-full w-full object-contain"
            />

            {/* Grad-CAM Overlay */}
            <img
              src={overlayUrl}
              alt="Grad-CAM overlay"
              className="absolute inset-0 h-full w-full object-contain transition-opacity duration-150"
              style={{
                opacity: opacity / 100,
              }}
            />

            <div className="absolute bottom-3 left-3 right-3 rounded-md bg-black/80 px-3 py-2 text-[11px] text-white">
              Geser slider untuk membandingkan citra asli dengan
              visualisasi Grad-CAM.
            </div>

          </div>

        </div>
      )}

      {/* Legend */}
      <div className="space-y-3 border-t border-neutral-200 pt-4">

        <div className="flex flex-wrap items-center gap-3 text-xs">

          <span className="font-medium text-neutral-700">
            Intensitas Grad-CAM:
          </span>

          <span className="text-neutral-500">
            Rendah
          </span>

          <div className="h-2.5 w-28 rounded-full border border-neutral-300 bg-gradient-to-r from-blue-500 via-cyan-400 via-yellow-400 to-red-600" />

          <span className="font-semibold text-black">
            Tinggi
          </span>

        </div>

        <p className="text-[11px] leading-relaxed text-neutral-500">
          Grad-CAM menunjukkan kontribusi relatif area citra terhadap
          keputusan klasifikasi model. Area dengan intensitas tinggi
          tidak secara langsung menunjukkan lokasi lesi atau memastikan
          keberadaan penyakit.
        </p>

      </div>

    </div>
  );
}