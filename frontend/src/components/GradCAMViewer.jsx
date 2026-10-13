import { useState } from "react";
import { Eye, Layers, Sliders } from "lucide-react";

export default function GradCAMViewer({ originalUrl, overlayUrl }) {
  const [viewMode, setViewMode] = useState("side-by-side"); // "side-by-side" | "blend"
  const [opacity, setOpacity] = useState(65);

  if (!overlayUrl && !originalUrl) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/50 p-8 text-center text-sm text-neutral-500">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white text-black shadow-sm">
          <Layers className="h-6 w-6" />
        </div>
        <p className="font-semibold text-neutral-800">Peta Visualisasi Grad-CAM</p>
        <p className="mt-1 text-xs text-neutral-500">
          Peta atensi Grad-CAM akan otomatis dihasilkan setelah citra rontgen selesai diproses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-300 bg-white p-6 shadow-sm">
      {/* Visualizer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-black">Visualisasi Atensi Grad-CAM</h3>
            <span className="rounded border border-black bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider">
              Explainable AI (XAI)
            </span>
          </div>
          <p className="text-xs text-neutral-600">
            Menyoroti area anatomi toraks yang paling memengaruhi keputusan klasifikasi model HQCNN
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("side-by-side")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                viewMode === "side-by-side"
                  ? "bg-black text-white shadow-sm"
                  : "text-neutral-600 hover:text-black"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Berdampingan</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("blend")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${
                viewMode === "blend"
                  ? "bg-black text-white shadow-sm"
                  : "text-neutral-600 hover:text-black"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Overlay Interaktif</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Blend View */}
      {viewMode === "blend" && overlayUrl && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-800">
              <Sliders className="h-4 w-4 text-black" />
              <span className="font-medium">Transparansi Heatmap Grad-CAM:</span>
              <span className="font-mono font-bold text-black">{opacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="h-2 w-48 cursor-pointer appearance-none rounded-lg bg-neutral-300 accent-black"
            />
          </div>

          <div className="relative mx-auto aspect-square max-h-[460px] w-full overflow-hidden rounded-xl border border-neutral-300 bg-black">
            {originalUrl && (
              <img
                src={originalUrl}
                alt="CXR Dasar"
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
            <img
              src={overlayUrl}
              alt="Grad-CAM Heatmap"
              className="absolute inset-0 h-full w-full object-contain mix-blend-screen transition-opacity duration-150"
              style={{ opacity: opacity / 100 }}
            />
            <div className="absolute bottom-3 left-3 rounded-md bg-black/80 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm border border-neutral-700">
              Geser slider di atas untuk membandingkan posisi anatomi & aktivasi model
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side View */}
      {viewMode === "side-by-side" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {originalUrl && (
            <figure className="overflow-hidden rounded-xl border border-neutral-300 bg-black">
              <div className="relative flex aspect-square items-center justify-center p-2">
                <img
                  src={originalUrl}
                  alt="Citra CXR Asli"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <figcaption className="flex items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4 py-2.5 text-xs text-neutral-800">
                <span className="font-semibold">Citra CXR Pasien</span>
                <span className="text-[11px] text-neutral-500">Input Asli Radiograf</span>
              </figcaption>
            </figure>
          )}

          {overlayUrl && (
            <figure className="overflow-hidden rounded-xl border border-neutral-300 bg-black">
              <div className="relative flex aspect-square items-center justify-center p-2">
                <img
                  src={overlayUrl}
                  alt="Grad-CAM Overlay"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <figcaption className="flex items-center justify-between border-t border-neutral-200 bg-neutral-100 px-4 py-2.5 text-xs text-neutral-800">
                <span className="font-semibold text-black">Aktivasi Grad-CAM</span>
                <span className="text-[11px] text-neutral-600">Blok Konvolusi Akhir</span>
              </figcaption>
            </figure>
          )}
        </div>
      )}

      {/* Heatmap Spectrum Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
        <div className="flex items-center gap-2">
          <span className="font-medium">Gradien Signifikansi Atensi:</span>
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-neutral-500">Rendah</span>
            <div className="h-2.5 w-24 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 via-yellow-400 to-red-600 border border-neutral-300" />
            <span className="font-bold text-black">Tinggi (Fokus AI)</span>
          </div>
        </div>
        <span className="text-[11px] text-neutral-500">
          Area merah/hangat pada peta menandai wilayah anatomi paru dengan pengaruh terbesar pada klasifikasi.
        </span>
      </div>
    </div>
  );
}
