import { useState, useMemo } from "react";
import { History, Search, AlertTriangle, ShieldCheck, Clock, FileText } from "lucide-react";

export default function HistoryTable({ rows }) {
  const [filter, setFilter] = useState("all"); // "all" | "TB" | "Normal"
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!rows?.length) return [];
    return rows.filter((row) => {
      const label = row.label || row.predicted_label || "";
      if (filter !== "all" && label !== filter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const filename = (row.filename || "").toLowerCase();
        const code = (row.patient_code || "").toLowerCase();
        return filename.includes(query) || code.includes(query);
      }
      return true;
    });
  }, [rows, filter, search]);

  if (!rows?.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-50/50 p-10 text-center text-sm text-neutral-500">
        <Clock className="mb-2 h-7 w-7 text-neutral-400" />
        <p className="font-semibold text-neutral-800">Belum ada riwayat pemeriksaan</p>
        <p className="mt-1 text-xs text-neutral-500">
          Setiap citra yang dianalisis akan otomatis tercatat dalam sesi ini.
        </p>
      </div>
    );
  }

  const tbCount = rows.filter((r) => (r.label || r.predicted_label) === "TB").length;
  const normalCount = rows.filter((r) => (r.label || r.predicted_label) === "Normal").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-sm">
      {/* Controls: Filter tabs & Search */}
      <div className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3.5 py-1.5 font-bold transition-all ${filter === "all"
                ? "bg-black text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-600 hover:text-black"
              }`}
          >
            Semua ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("TB")}
            className={`flex items-center gap-1 rounded-lg px-3.5 py-1.5 font-bold transition-all ${filter === "TB"
                ? "bg-black text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-600 hover:text-black"
              }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            TB ({tbCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Normal")}
            className={`flex items-center gap-1 rounded-lg px-3.5 py-1.5 font-bold transition-all ${filter === "Normal"
                ? "bg-black text-white shadow-sm"
                : "border border-neutral-200 bg-white text-neutral-600 hover:text-black"
              }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Normal ({normalCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari berkas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white py-1.5 pl-8 pr-3 text-xs text-black placeholder-neutral-400 focus:border-black focus:outline-none sm:w-48"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-neutral-200 bg-neutral-100 font-bold uppercase tracking-wider text-neutral-700">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Berkas</th>
              <th className="px-4 py-3">Hasil Model</th>
              <th className="px-4 py-3">P(TB)</th>
              <th className="px-4 py-3">P(Normal)</th>
              <th className="px-4 py-3">Kepercayaan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredRows.map((row) => {
              const created = row.created_at
                ? new Date(row.created_at).toLocaleString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "short",
                })
                : "—";
              const label = row.label || row.predicted_label || "—";
              const isTb = label === "TB";
              const tb = row.probabilities?.TB ?? row.probability_tb;
              const normal = row.probabilities?.Normal ?? row.probability_normal;
              const confidence = row.confidence;

              return (
                <tr key={row.id} className="transition-colors hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{created}</td>
                  <td className="px-4 py-3 font-semibold text-black">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">
                        {row.filename || row.patient_code || "untitled_scan"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold uppercase text-[10px] ${isTb
                          ? "bg-black text-white"
                          : "border border-black bg-white text-black"
                        }`}
                    >
                      {isTb ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      {label}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-neutral-800">
                    {tb != null ? `${(Number(tb) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-neutral-800">
                    {normal != null ? `${(Number(normal) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {confidence != null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-black">{(Number(confidence) * 100).toFixed(1)}%</span>
                        <div className="h-2 w-12 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className="h-full bg-black"
                            style={{ width: `${Math.min(100, Number(confidence) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
