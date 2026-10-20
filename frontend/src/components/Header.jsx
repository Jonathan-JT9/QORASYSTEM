import { Activity, Cpu, Sparkles } from "lucide-react";

export default function Header({ health }) {
  const online = health?.ok;
  const device = health?.device ? health.device.toUpperCase() : "CPU";

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">

        {/* Logo and Brand */}
        <a href="#beranda" className="group flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-black px-3.5 py-1.5 shadow-sm transition-all duration-200 group-hover:bg-neutral-900">
            <img
              src="/logo-transparent.png"
              alt="QORA Logo"
              className="h-7 w-auto object-contain"
            />
          </div>
          <div className="hidden border-l border-neutral-200 pl-3 sm:block">
            <div className="flex items-center gap-1.5">
              <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-black">
                6-QUBIT VQC
              </span>
              <span className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-600">
                GEMINI 2.5
              </span>
            </div>
          </div>
        </a>

        {/* Navigation links */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-neutral-600 md:flex">
          <a
            href="#beranda"
            className="transition-colors hover:text-black"
          >
            Beranda
          </a>
          <a
            href="#analisis"
            className="transition-colors hover:text-black"
          >
            Analisis CXR
          </a>
          <a
            href="#hasil"
            className="transition-colors hover:text-black"
          >
            Hasil & Grad-CAM
          </a>
          <a
            href="#riwayat"
            className="transition-colors hover:text-black"
          >
            Riwayat Sesi
          </a>
        </nav>

        {/* Right Status & Action */}
        <div className="flex items-center gap-3">
          {/* Health indicator badge */}
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-800">
            <span className="relative flex h-2 w-2">
              {online ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-40"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-black"></span>
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-neutral-400"></span>
              )}
            </span>
            <span className="text-[11px] font-semibold tracking-tight">
              {online ? `Sistem Online (${device})` : "Sistem Offline"}
            </span>
          </div>

          <a
            href="#analisis"
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2 text-xs font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Mulai Uji</span>
          </a>
        </div>
      </div>
    </header>
  );
}
