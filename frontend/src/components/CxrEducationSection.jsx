import { useState } from "react";
import InteractiveCxrViewer from "./InteractiveCxrViewer.jsx";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Columns,
  Eye,
  ArrowRight,
  Layers
} from "lucide-react";

export default function CxrEducationSection() {
  const [activeTab, setActiveTab] = useState("normal"); // "normal" | "tb" | "both"

  return (
    <section
      id="edukasi"
      aria-label="Edukasi Radiologi Chest X-Ray"
      className="border-b border-neutral-200 bg-white py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">

            <h2 className="mt-4 text-3xl font-black tracking-tight text-black sm:text-4xl">
              Memahami Radiograf Toraks: <br className="hidden sm:inline" />
              <span className="text-neutral-700">Normal vs Tuberkulosis (TB)</span>
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-neutral-600 sm:text-base">
              Pelajari karakteristik radiologis citra Chest X-Ray (CXR) untuk membedakan
              kondisi paru normal dengan manifestasi infeksi Tuberkulosis. Gunakan viewer
              interaktif untuk memperbesar, memutar, dan meninjau detail anatomi toraks.
            </p>
          </div>

          {/* View Mode Switcher */}
          <div className="flex rounded-xl border border-neutral-300 bg-neutral-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("normal")}
              aria-pressed={activeTab === "normal"}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-all ${activeTab === "normal"
                ? "bg-black text-white shadow-sm"
                : "text-neutral-600 hover:text-black"
                }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>CXR Normal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tb")}
              aria-pressed={activeTab === "tb"}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition-all ${activeTab === "tb"
                ? "bg-black text-white shadow-sm"
                : "text-neutral-600 hover:text-black"
                }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>CXR Tuberkulosis</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("both")}
              aria-pressed={activeTab === "both"}
              className={`hidden items-center gap-1.5 rounded-lg px-3.5 py-2 transition-all lg:flex ${activeTab === "both"
                ? "bg-black text-white shadow-sm"
                : "text-neutral-600 hover:text-black"
                }`}
            >
              <Columns className="h-4 w-4" />
              <span>Bandingkan Berdampingan</span>
            </button>
          </div>
        </div>

        {/* Interactive Cards Display */}
        <div className="mt-10">
          {/* TAB 1: NORMAL VIEW */}
          {activeTab === "normal" && (
            <div className="grid items-start gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <InteractiveCxrViewer
                  src="/education-normal.png"
                  alt="Foto rontgen dada (Chest X-Ray) dengan gambaran paru normal"
                  label="Contoh Referensi: Chest X-Ray Normal"
                />
              </div>

              <div className="flex flex-col justify-between space-y-6 lg:col-span-6">
                <div className="rounded-2xl border border-neutral-300 bg-neutral-50/70 p-6 sm:p-8">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <h3 className="text-xl font-bold text-black">
                      Karakteristik Chest X-Ray Normal
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                    Pada radiograf toraks proyeksi Posteroanterior (PA) normal, kedua lapang paru
                    menunjukkan aerasi yang optimal dan simetri anatomis yang terjaga.
                  </p>

                  <div className="mt-6 space-y-3.5">
                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        1
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Lapang Paru Relatif Jernih & Simetris:</strong> Translusi
                        udara tampak merata pada hemitoraks kanan dan kiri tanpa konsolidasi patologis.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        2
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Tanpa Infiltrat / Opasitas Mencurigakan:</strong> Tidak tampak
                        bercak putih (infiltrat berawan) yang menandakan eksudat alveolar atau reaksi radang akut.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        3
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Sudut Kostofrenikus Tajam:</strong> Sinus kostofrenikus dan
                        kardiofrenikus kanan-kiri tampak lancip tanpa tanda efusi pleura atau cairan bebas.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        4
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Siluet Jantung Proporsional:</strong> Nilai Cardiothoracic
                        Ratio (CTR) normal (&le; 50%), mediastinum tidak melebar, dan posisi trakea di garis tengah.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        5
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Bebas Kavitas atau Lesi Fokal:</strong> Tidak terdapat dinding
                        kavitas hiperlusen, tuberkuloma, maupun jaringan parut retraksi.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-xs text-neutral-600 sm:text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-black" />
                    <p className="leading-relaxed">
                      <strong className="text-black">Catatan Klinis:</strong> Gambaran radiologis normal pada CXR
                      tidak selalu menyingkirkan kemungkinan infeksi tahap sangat awal, TB ekstraparu, atau infeksi
                      laten. Evaluasi anamnesis klinis dokter tetap menjadi rujukan utama.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TB VIEW */}
          {activeTab === "tb" && (
            <div className="grid items-start gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <InteractiveCxrViewer
                  src="/education-tb.png"
                  alt="Foto rontgen dada (Chest X-Ray) dengan gambaran dugaan Tuberkulosis pada lobus atas"
                  label="Contoh Kasus: Chest X-Ray Tuberkulosis (TB)"
                />
              </div>

              <div className="flex flex-col justify-between space-y-6 lg:col-span-6">
                <div className="rounded-2xl border border-neutral-300 bg-neutral-50/70 p-6 sm:p-8">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-white">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <h3 className="text-xl font-bold text-black">
                      Karakteristik Chest X-Ray Tuberkulosis (TB)
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-neutral-600 sm:text-sm">
                    Tuberkulosis paru menghasilkan spektrum spektrum kelainan radiologis yang
                    bervariasi tergantung fase aktifitas penyakit, durasi infeksi, dan imunitas pasien.
                  </p>

                  <div className="mt-6 space-y-3.5">
                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        1
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Infiltrat, Opasitas, & Konsolidasi:</strong> Timbul bayangan
                        berawan (opasitas) akibat eksudasi inflamasi parenkim paru terhadap kuman <em>M. tuberculosis</em>.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        2
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Predileksi Sering di Apeks / Lobus Atas:</strong> Kelainan
                        paling sering ditemukan di area apikal/subapikal (lobus atas paru) karena tekanan oksigen (pO2)
                        yang tinggi mendukung multiplikasi mikobakteri.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        3
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Kavitas & Fibrosis:</strong> Pada kasus lanjut atau reaktivasi,
                        nekrosis perkijuan dapat mencair dan keluar membentuk rongga berdinding (kavitas) atau garis retraksi fibrosis.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        4
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Variasi Gejala & Imun:</strong> Pada pasien dengan gangguan imun
                        (misal HIV/diabetes), gambaran dapat atipikal (infiltrat di lobus bawah, adenopati hilus tanpa kavitas).
                      </p>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3.5">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-black font-bold text-xs">
                        5
                      </div>
                      <p className="text-xs leading-relaxed text-neutral-700 sm:text-sm">
                        <strong className="text-black">Peran CXR sebagai Skrining Awal:</strong> CXR memberikan
                        panduan lokasi dan luas lesi, namun diagnosis TB wajib dikonfirmasi lewat pemeriksaan mikrobiologi.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-neutral-300 bg-neutral-100 p-4 text-xs text-neutral-600 sm:text-sm">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-black" />
                    <p className="leading-relaxed">
                      <strong className="text-black">Konfirmasi Laboratorium:</strong> Temuan dugaan radiologis TB
                      harus segera ditindaklanjuti dengan Tes Cepat Molekuler (TCM) GeneXpert MTB/RIF atau pemeriksaan BTA dahak.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BOTH SIDE-BY-SIDE (Desktop Only) */}
          {activeTab === "both" && (
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <InteractiveCxrViewer
                  src="/education-normal.png"
                  alt="Chest X-Ray Normal"
                  label="1. CXR Paru Normal (Referensi)"
                />
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs sm:text-sm">
                  <h4 className="font-bold text-black flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Paru Normal
                  </h4>
                  <p className="mt-1 text-neutral-600 leading-relaxed">
                    Lapang paru relatif jernih bilateral, sudut kostofrenikus tajam, kontur kardiovaskular
                    proporsional, dan tanpa infiltrat mencurigakan.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <InteractiveCxrViewer
                  src="/education-tb.png"
                  alt="Chest X-Ray Tuberkulosis"
                  label="2. CXR Tuberkulosis (Dugaan Lesi)"
                />
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-xs sm:text-sm">
                  <h4 className="font-bold text-black flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Dugaan Tuberkulosis (TB)
                  </h4>
                  <p className="mt-1 text-neutral-600 leading-relaxed">
                    Tampak bercak opasitas / konsolidasi infiltrat (terutama di lobus atas/apeks),
                    dapat disertai kavitas atau perubahan struktur parenkim.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
