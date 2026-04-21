import axios from "axios";

export async function getCandidateDashboardStats() {
  // Ambil data statistik untuk dashboard kandidat
  const res = await axios.get("/api/candidates/applications");
  const apps = res.data.applications || [];

  // Total semua aplikasi
  const total = apps.length;
  // Sedang diproses: status submitted, screening, wawancara
  const inProgress = apps.filter(a => ["submitted", "screening", "wawancara"].includes(a.status)).length;
  // Diterima: status diterima
  const accepted = apps.filter(a => a.status === "diterima").length;
  // Ditolak: status ditolak
  const rejected = apps.filter(a => a.status === "ditolak").length;

  // Untuk tabel status terbaru, urutkan berdasarkan submitted_at desc
  const latest = apps.slice().sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, 5);

  return {
    total,
    inProgress,
    accepted,
    rejected,
    latest
  };
}
