import { Sparkles, LogOut, User } from "lucide-react";

export default function Header({ health, page, currentUser, onLogout }) {
  const online = health?.ok;
  const device = health?.device ? health.device.toUpperCase() : "CPU";

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">

        {/* Logo and Brand */}
        <a href="#/home" className="group flex items-center gap-3">
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
                GEMINI 3.5
              </span>
            </div>
          </div>
        </a>

        {/* Navigation links */}
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium text-neutral-600 md:flex">
          {[["home", "Home"], ["classification", "Classification"], ["history", "History"]].map(([id, label]) => (
            <a
              key={id}
              href={`#/${id}`}
              aria-current={page === id ? "page" : undefined}
              className={`transition-colors hover:text-black ${page === id ? "font-bold text-black" : ""}`}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right Status & Action */}
        <div className="flex items-center gap-3">
          {/* Health indicator badge */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-800">
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
            href="#/classification"
            className="inline-flex items-center gap-1.5 rounded-lg bg-black px-3.5 py-1.5 text-xs font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Mulai Uji</span>
          </a>

          {/* User Profile & Logout */}
          {currentUser && (
            <div className="flex items-center gap-2 border-l border-neutral-200 pl-3">
              <div className="hidden flex-col items-end sm:flex">
                <span className="text-xs font-bold text-neutral-900 leading-tight">
                  @{currentUser.username}
                </span>
                <span className="text-[10px] text-neutral-500 leading-tight">
                </span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari sistem"
                aria-label="Keluar dari sistem"
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 hover:text-black"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <nav aria-label="Mobile navigation" className="flex items-center justify-center gap-7 border-t border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 md:hidden">
        {[["home", "Home"], ["classification", "Classification"], ["history", "History"]].map(([id, label]) => (
          <a
            key={id}
            href={`#/${id}`}
            aria-current={page === id ? "page" : undefined}
            className={`transition-colors hover:text-black ${page === id ? "font-bold text-black" : ""}`}
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
