import { Activity, ArrowRight, LogOut, ScanLine } from "lucide-react";

const links = [
  ["home", "Overview", "#/home"],
  ["classification", "Analysis", "#/classification"],
  ["history", "History", "#/history"],
];

export default function Header({ health, page, currentUser, onLogout }) {
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
            <a key={id} href={href} aria-current={page === id ? "page" : undefined} className={page === id ? "is-active" : ""}>
              {label}
            </a>
          ))}
        </nav>

        <div className="qora-header-actions">
          <div className={`qora-header-status ${online ? "is-online" : ""}`} title={online ? `Backend active on ${device}` : "Backend offline"}>
            <span className="qora-status-dot" />
            <span>{online ? `System online` : "System offline"}</span>
          </div>
          <a href="#/classification" className="qora-header-cta"><ScanLine size={15} /><span>New analysis</span><ArrowRight size={14} /></a>
          {currentUser && (
            <div className="qora-user-menu">
              <div className="qora-user-avatar">
                {(currentUser.name || currentUser.username || "Q")
                  .trim()
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="qora-user-copy">
                <strong>
                  {currentUser.name || currentUser.username || "User"}
                </strong>
              </div>
              <button type="button" onClick={onLogout} title="Keluar dari sistem" aria-label="Keluar dari sistem" className="qora-logout-button"><LogOut size={15} /></button>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Mobile navigation" className="qora-mobile-nav">
        {links.map(([id, label, href]) => (
          <a key={id} href={href} aria-current={page === id ? "page" : undefined} className={page === id ? "is-active" : ""}>
            {label}
          </a>
        ))}
        <span className={`qora-mobile-status ${online ? "is-online" : ""}`}><Activity size={12} />{online ? "Online" : "Offline"}</span>
      </nav>
    </header>
  );
}