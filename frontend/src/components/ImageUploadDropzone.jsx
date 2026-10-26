import { useCallback, useState } from "react";
import { UploadCloud, FileImage, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";

export default function ImageUploadDropzone({ onFile, disabled, onUseSample }) {
  const [drag, setDrag] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);

  const accept = useCallback(
    (file) => {
      if (!file) return;
      setFileInfo({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: file.type || "image/png",
      });
      onFile(file);
    },
    [onFile],
  );

  const handleSampleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch("/sample-cxr.png");
      const blob = await res.blob();
      const sampleFile = new File([blob], "sample_radiograph_cxr.png", { type: "image/png" });
      accept(sampleFile);
    } catch (err) {
      console.error("Failed to load sample CXR", err);
    }
  };

  return (
    <div className="space-y-3">
      <label
        className={`relative block cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300 ${drag
            ? "border-black bg-neutral-100 shadow-sm"
            : "border-neutral-300 bg-white hover:border-black hover:bg-neutral-50/50"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        {/* Animated scanning laser line when processing */}
        {disabled && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-black animate-scan" />
        )}

        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp,image/tiff"
          className="hidden"
          disabled={disabled}
          onChange={(e) => accept(e.target.files?.[0])}
        />

        <div className="flex flex-col items-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 text-black shadow-sm transition-transform duration-300 group-hover:scale-105">
            <UploadCloud className="h-8 w-8 text-black" />
          </div>

          <h3 className="text-lg font-semibold text-black">
            Unggah Citra Chest X-Ray (CXR)
          </h3>
          <p className="mt-1 max-w-md text-sm text-neutral-500">
            Tarik & lepaskan file citra toraks ke area ini, atau klik untuk memilih berkas dari komputer
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-400">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-800 border border-neutral-200">PNG</span>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-800 border border-neutral-200">JPEG</span>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-800 border border-neutral-200">TIFF/DICOM</span>
            <span>· Maksimal 16MB</span>
          </div>

          {fileInfo && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg border border-black bg-neutral-100 px-3.5 py-1.5 text-xs text-black">
              <CheckCircle2 className="h-4 w-4 text-black" />
              <span className="font-semibold">{fileInfo.name}</span>
              <span className="text-neutral-500">({fileInfo.size})</span>
            </div>
          )}
        </div>
      </label>

      {/* Quick sample button */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="text-neutral-500">Tidak memiliki berkas radiograf sekarang?</span>
        <button
          type="button"
          onClick={handleSampleClick}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 font-semibold text-black transition-colors hover:text-neutral-700 hover:underline disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Gunakan Contoh CXR Bawaan</span>
        </button>
      </div>
    </div>
  );
}
