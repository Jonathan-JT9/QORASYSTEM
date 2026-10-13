export default function Footer() {
  return (
    <footer className="mt-20 border-t border-neutral-900 bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          
          {/* Brand & Mission */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center">
              <img
                src="/logo-transparent.png"
                alt="QORA Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            <p className="max-w-md text-xs leading-relaxed text-neutral-400">
              <strong>Quantum-Optimized Radiograph Analysis</strong> — Sistem penapisan citra Chest X-Ray (CXR) berbasis arsitektur hibrida kuantum-klasik (HQCNN) dengan sirkuit kuantum PennyLane 6-qubit, pemetaan Explainable AI Grad-CAM, dan interpretasi klinis Google Gemini.
            </p>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-neutral-300">
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono">PennyLane VQC</span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono">PyTorch HQCNN</span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono">Gemini 2.5 Flash</span>
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono">Grad-CAM XAI</span>
            </div>
          </div>

          {/* Quick Nav */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">Navigasi Modul</h4>
            <ul className="mt-3 space-y-2 text-xs text-neutral-400">
              <li>
                <a href="#beranda" className="transition-colors hover:text-white">
                  Beranda
                </a>
              </li>
              <li>
                <a href="#analisis" className="transition-colors hover:text-white">
                  Analisis Rontgen CXR
                </a>
              </li>
              <li>
                <a href="#hasil" className="transition-colors hover:text-white">
                  Hasil Prediksi & Grad-CAM
                </a>
              </li>
              <li>
                <a href="#riwayat" className="transition-colors hover:text-white">
                  Riwayat Pemeriksaan
                </a>
              </li>
            </ul>
          </div>

          {/* Clinical Disclaimer */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Catatan Etik & Medis</h4>
            <p className="mt-3 text-xs leading-relaxed text-neutral-400">
              QORA dirancang khusus sebagai sistem pendukung keputusan klinis (<em>Clinical Decision Support System</em>). Hasil prediksi model bukan merupakan diagnosis definitif mandiri dan wajib divalidasi oleh dokter spesialis radiologi berwenang.
            </p>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-neutral-800 pt-6 text-[11px] text-neutral-500 sm:flex-row">
          <p>© {new Date().getFullYear()} QORA Radiograph Analysis · RJ EST. 2026. All rights reserved.</p>
          <p>Quantum-Classical Hybrid Machine Learning for Thoracic Healthcare</p>
        </div>
      </div>
    </footer>
  );
}
