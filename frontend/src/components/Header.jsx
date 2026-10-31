import { Activity, ArrowRight, FileText, LogOut, ScanLine } from "lucide-react";

const links = [
  ["home", "Home", "#/home"],
  ["analysis", "Analysis", "#/analysis"],
  ["history", "History", "#/history"],
];

function getUserInitial(user) {
  const raw = (user?.name || user?.username || "Q").trim();
  // Strip common medical title prefixes like "dr.", "dr ", "drg.", "prof.", "ners." (case-insensitive)
  const cleaned = raw.replace(/^(drg?|prof|ners|ns)\.?\s+/i, "").trim();
  return (cleaned.charAt(0) || raw.charAt(0) || "Q").toUpperCase();
}

export default function Header({
  health,
  page,
  currentUser,
  onLogout,
  onOpenCredentials,
}) {
  const online = Boolean(health?.ok);
  const device = health?.device ? health.device.toUpperCase() : "CPU";

  return (
    <header className="qora-header">
      <div className="qora-header-inner">
        <a
          href="#/home"
          className="qora-brand"
          aria-label="QORA overview"
        >
          <img
            src="/tiny-logo.png"
            alt=""
            className="tiny-logo"
          />

          <span className="qora-brand-name">
            QORA
          </span>
        </a>

        <nav aria-label="Main navigation" className="qora-desktop-nav">
          {links.map(([id, label, href]) => (
            <a
              key={id}
              href={href}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "is-active" : ""}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="qora-header-actions">
          <div
            className={`qora-header-status ${online ? "is-online" : ""}`}
            title={online ? `Backend active on ${device}` : "Backend offline"}
          >
            <span className="qora-status-dot" />
            <span>{online ? `System online` : "System offline"}</span>
          </div>

          <a href="#/analysis" className="qora-header-cta">
            <ScanLine size={15} />
            <span>New analysis</span>
            <ArrowRight size={14} />
          </a>

          {currentUser && (
            <div className="qora-user-menu">
              <div className="qora-user-avatar">
                {getUserInitial(currentUser)}
              </div>

              <div className="qora-user-copy">
                <strong>
                  {currentUser.name || currentUser.username || "User"}
                </strong>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block">
                  {currentUser.role === "admin" ? "Admin" : "Dokter"}
                </span>
              </div>

              {currentUser.role === "doctor" && onOpenCredentials && (
                <button
                  type="button"
                  onClick={onOpenCredentials}
                  title="Dokumen Kredensial Medis"
                  aria-label="Dokumen Kredensial Medis"
                  className="qora-logout-button"
                >
                  <FileText size={15} />
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                title="Keluar dari sistem"
                aria-label="Keluar dari sistem"
                className="qora-logout-button"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="qora-mobile-nav">
        {links.map(([id, label, href]) => (
          <a
            key={id}
            href={href}
            aria-current={page === id ? "page" : undefined}
            className={page === id ? "is-active" : ""}
          >
            {label}
          </a>
        ))}
        <span className={`qora-mobile-status ${online ? "is-online" : ""}`}>
          <Activity size={12} />
          {online ? "Online" : "Offline"}
        </span>
      </nav>
    </header>
  );
}