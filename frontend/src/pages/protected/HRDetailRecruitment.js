import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import documentRequirements from "../../utils/documentRequirements";
import { useDispatch } from "react-redux";
import TitleCard from "../../components/Cards/TitleCard";
import { setPageTitle } from "../../features/common/headerSlice";
import api from "../../lib/api";
// Komponen Modal sederhana
function Modal({ open, onClose, onSubmit, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn btn-sm btn-outline" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-sm btn-error" onClick={onSubmit}>
            Tolak
          </button>
        </div>
      </div>
    </div>
  );
}

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function HRCandidate() {
  const navigate = useNavigate();
  // Untuk popup Tolak
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const dispatch = useDispatch();
  const location = useLocation();

  const job = location.state?.job;
  // Ambil jobId dari query string
  const params = new URLSearchParams(location.search);
  const jobId = params.get("job_id");

  // Ambil applicationId dari path jika ada /candidate/:id
  const urlApplicationId = location.pathname.includes("/candidate/")
    ? parseInt(location.pathname.split("/candidate/").pop(), 10)
    : null;

  const [view, setView] = useState("list"); // list | detail
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  // ================= INIT =================
  useEffect(() => {
    dispatch(
      setPageTitle({
        title: job
          ? `Pelamar: ${job.position_name || job.title || "-"}`
          : "Data Pelamar",
      }),
    );
    fetchApplications();
    // eslint-disable-next-line
  }, [jobId]);

  // Jika ada id aplikasi di URL, set selected otomatis jika ada di hasil fetch
  useEffect(() => {
    if (applications.length === 0 || selected) return;

    // Hanya auto-buka detail jika ada id aplikasi di path
    if (urlApplicationId) {
      const found = applications.find(
        (app) => Number(app.application_id) === Number(urlApplicationId),
      );
      if (found) {
        setSelected(found);
        setView("detail");
      }
    }
    // Jika tidak ada id aplikasi di path, tetap di list
  }, [urlApplicationId, applications]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      let res;
      // Jika ada jobId, filter aplikasi berdasarkan jobId
      if (jobId) {
        res = await api.get(
          `/candidates/admin/applications?job_opening_id=${jobId}`,
          { headers: getAuthHeaders() },
        );
      } else {
        // Jika tidak ada jobId, ambil semua aplikasi
        res = await api.get(`/candidates/admin/applications`, {
          headers: getAuthHeaders(),
        });
      }
      // Debug: pastikan id aplikasi benar
      if (res.data.applications && Array.isArray(res.data.applications)) {
        console.log(
          "[DEBUG] Applications fetched:",
          res.data.applications.map((a) => ({
            id: a.application_id,
            candidate_id: a.candidate_id,
          })),
        );
      }
      setApplications(res.data.applications || []);
    } catch (err) {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!selected) return;
    const appId = selected?.application_id || selected?.id;

    try {
      await api.put(
        `/candidates/admin/applications/${appId}/status`,
        {
          status: "screening",
        },
        { headers: getAuthHeaders() },
      );

      // ✅ update langsung di applications (source utama)
      setApplications((prev) =>
        prev.map((app) =>
          (app.application_id || app.id) === appId
            ? { ...app, status: "screening" }
            : app,
        ),
      );

      setView("list");
    } catch (err) {
      alert("Gagal menyimpan perubahan status pelamar");
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectNotes.trim() || !selected) return;

    try {
      const appId = selected?.application_id || selected?.id;

      await api.put(
        `/candidates/admin/applications/${appId}/status`,
        {
          status: "ditolak",
          admin_notes: rejectNotes,
        },
        { headers: getAuthHeaders() },
      );

      setApplications((prev) =>
        prev.map((app) =>
          (app.application_id || app.id) === appId
            ? { ...app, status: "ditolak", admin_notes: rejectNotes }
            : app,
        ),
      );

      setShowRejectPopup(false);
      setRejectNotes("");
      setView("list");
    } catch (err) {
      alert("Gagal menyimpan penolakan");
    }
  };

  const passedApplicants = useMemo(() => {
    return applications.filter((app) => app.status === "screening");
  }, [applications]);

  // Untuk tabel riwayat, jika lowongan sudah closed & completed, tampilkan SEMUA aplikasi kecuali yang diterima
  // Jika belum completed, hanya tampilkan yang ditolak saja
  const historyApplications = useMemo(() => {
    const isClosedCompleted = job && job.status === "closed" && job.hiring_status === "completed";
    if (isClosedCompleted) {
      // Tampilkan semua aplikasi kecuali yang statusnya 'diterima'
      return applications.filter(
        (app) => app.status !== "diterima"
      );
    } else {
      // Default: hanya yang ditolak
      return applications.filter((app) => app.status === "ditolak");
    }
  }, [applications, job]);

  // ================= FILTER =================
  const filteredApplications = useMemo(() => {
    return applications
      .filter((app) => app.status === "submitted")
      .filter(
        (app) =>
          (app.candidate_name || app.name || "")
            .toLowerCase()
            .includes(search.toLowerCase()) ||
          (app.candidate_email || app.email || "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      );
  }, [search, applications]);

  // Sudah digabung di atas

  return (
    <>
      {/* ===================== LIST ===================== */}
      {view === "list" && (
        (() => {
          const isClosedCompleted = job && job.status === "closed" && job.hiring_status === "completed";
          if (isClosedCompleted) {
            // Hanya tampilkan riwayat pelamar
            return (
              <TitleCard
                title={
                  <div className="flex justify-between items-center">
                    <span>Riwayat Pelamar</span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => window.history.back()}
                    >
                      Kembali
                    </button>
                  </div>
                }
              >
                {historyApplications.length === 0 ? (
                  <div className="text-center opacity-70 py-6">
                    Belum ada riwayat
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table table-zebra">
                      <thead className="text-center">
                        <tr>
                          <th>Nama</th>
                          <th>Pendidikan</th>
                          <th>Tahun Lulus</th>
                          <th>NPWP</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyApplications.map((item) => (
                          <tr key={item.application_id}>
                            <td>{item.candidate_name || item.name || "-"}</td>
                            <td className="text-center">
                              {item.education_level
                                ? `${item.education_level} - ${item.major || "-"}`
                                : "-"}
                            </td>
                            <td className="text-center">
                              {item.graduation_year || "-"}
                            </td>
                            <td className="text-center">{item.npwp || "-"}</td>
                            <td className="text-center">
                              <span
                                className={`badge 
            ${item.status === "ditolak" ? "badge-error" : ""}
            ${item.status === "lolos_dokumen" ? "badge-success" : ""}
          `}
                              >
                                {item.status === "lolos_dokumen"
                                  ? "Lolos Dokumen"
                                  : item.status || "-"}
                              </span>
                            </td>
                            <td className="text-center">
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                  setSelected({ ...item, isHistory: true });
                                  setView("detail");
                                }}
                              >
                                Detail
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TitleCard>
            );
          } else {
            // Tampilkan semua section seperti biasa
            return (
              <>
                <TitleCard
                  title={
                    <div className="flex justify-between items-center">
                      <span>
                        {job
                          ? `Data Pelamar - ${job.position_name || job.title}`
                          : "Data Pelamar"}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => window.history.back()}
                      >
                        Kembali
                      </button>
                    </div>
                  }
                >
                  <div className="mb-4">
                    <input
                      className="input input-bordered w-full"
                      placeholder="Cari nama atau email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {loading ? (
                    <div className="text-center py-10">Loading...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="table table-zebra">
                        <thead className="text-center">
                          <tr>
                            <th>Nama</th>
                            <th>Email</th>
                            <th>Pendidikan</th>
                            <th>Tahun Lulus</th>
                            <th>NPWP</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredApplications.map((item) => (
                            <tr key={item?.application_id}>
                              <td>{item.candidate_name || item.name}</td>
                              <td>{item.candidate_email || item.email}</td>
                              <td className="text-center">
                                {item.education_level} - {item.major}
                              </td>
                              <td className="text-center">
                                {item.graduation_year || "-"}
                              </td>
                              <td className="text-center">{item.npwp || "-"}</td>
                              <td className="text-center">
                                <button
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => {
                                    setSelected({ ...item, isHistory: false });
                                    setView("detail");
                                  }}
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}

                          {filteredApplications.length === 0 && (
                            <tr>
                              <td colSpan={6} className="text-center opacity-70">
                                Tidak ada data
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TitleCard>

                {passedApplicants.length > 0 && (
                  <TitleCard
                    topMargin="mt-6"
                    title={
                      <div className="flex justify-between items-center w-full">
                        <span>Shortlisted Kandidat</span>
                        <button
                          className="btn btn-success btn-outline"
                          onClick={async () => {
                            const screeningIds = passedApplicants.map(
                              (app) => app.application_id || app.id,
                            );
                            if (screeningIds.length === 0) return;
                            try {
                              await Promise.all(
                                screeningIds.map((id) =>
                                  api.put(
                                    `/candidates/admin/applications/${id}/status`,
                                    {
                                      status: "lolos_dokumen",
                                    },
                                    { headers: getAuthHeaders() },
                                  ),
                                ),
                              );
                              await fetchApplications();
                            } catch (err) {
                              alert("Gagal update status massal");
                            }
                          }}
                        >
                          Update semua Kandidat ke Lolos Dokumen
                        </button>
                      </div>
                    }
                  >
                    {passedApplicants.length === 0 ? (
                      <div className="text-center opacity-70 py-6">
                        Belum ada daftar pelamar
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="table table-zebra">
                          <thead className="text-center">
                            <tr>
                              <th>Nama</th>
                              <th>Email</th>
                              <th>Pendidikan</th>
                              <th>Tahun Lulus</th>
                              <th>NPWP</th>
                              <th>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {passedApplicants.map((item) => (
                              <tr key={item?.application_id}>
                                <td>{item.candidate_name || item.name}</td>
                                <td>{item.candidate_email || item.email}</td>
                                <td className="text-center">
                                  {item.education_level} - {item.major}
                                </td>
                                <td className="text-center">
                                  {item.graduation_year || "-"}
                                </td>
                                <td className="text-center">{item.npwp || "-"}</td>
                                <td className="text-center">
                                  <button
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => {
                                      setSelected({ ...item, isHistory: false });
                                      setView("detail");
                                    }}
                                  >
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TitleCard>
                )}
                {historyApplications.length > 0 && (
                  <TitleCard title="Riwayat Pelamar" topMargin="mt-6">
                    {historyApplications.length === 0 ? (
                      <div className="text-center opacity-70 py-6">
                        Belum ada riwayat
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="table table-zebra">
                          <thead className="text-center">
                            <tr>
                              <th>Nama</th>
                              <th>Pendidikan</th>
                              <th>Tahun Lulus</th>
                              <th>NPWP</th>
                              <th>Status</th>
                              <th>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyApplications.map((item) => (
                              <tr key={item.application_id}>
                                <td>{item.candidate_name || item.name || "-"}</td>
                                <td className="text-center">
                                  {item.education_level
                                    ? `${item.education_level} - ${item.major || "-"}`
                                    : "-"}
                                </td>
                                <td className="text-center">
                                  {item.graduation_year || "-"}
                                </td>
                                <td className="text-center">{item.npwp || "-"}</td>
                                <td className="text-center">
                                  <span
                                    className={`badge 
            ${item.status === "ditolak" ? "badge-error" : ""}
            ${item.status === "lolos_dokumen" ? "badge-success" : ""}
          `}
                                  >
                                    {item.status === "lolos_dokumen"
                                      ? "Lolos Dokumen"
                                      : item.status || "-"}
                                  </span>
                                </td>
                                <td className="text-center">
                                  <button
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => {
                                      setSelected({ ...item, isHistory: true });
                                      setView("detail");
                                    }}
                                  >
                                    Detail
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TitleCard>
                )}
              </>
            );
          }
        })()
      )}

      {/* ===================== DETAIL ===================== */}
      {view === "detail" && selected && (
        <>
          <TitleCard
            title={
              <div className="flex justify-between items-center">
                <span>Detail Pelamar</span>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setView("list")}
                >
                  Kembali
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* ================= DATA DIRI ================= */}
              <div className="card bg-base-200 border">
                <div className="card-body">
                  <div className="avatar mb-3 flex justify-center">
                    <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                      <img
                        src={
                          selected.photo_file
                            ? selected.photo_file.startsWith("http")
                              ? selected.photo_file
                              : `http://localhost:5000/${selected.photo_file.replace(/^\//, "")}`
                            : "https://ui-avatars.com/api/?name=" + encodeURIComponent(selected.candidate_name || selected.name || "-") + "&background=random"
                        }
                        alt="Foto Kandidat"
                        className="object-cover"
                      />
                    </div>
                  </div>
                  <h3 className="card-title text-lg">Data Diri Lengkap</h3>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    {[
                      { key: "candidate_name", label: "Nama Lengkap" },
                      { key: "candidate_email", label: "Email" },
                      { key: "phone", label: "Nomor HP" },
                      { key: "gender", label: "Jenis Kelamin" },
                      { key: "birth_place", label: "Tempat Lahir" },
                      { key: "date_of_birth", label: "Tanggal Lahir" },
                      { key: "marital_status", label: "Status Pernikahan" },
                      { key: "nationality", label: "Kebangsaan" },
                      { key: "address", label: "Alamat" },
                      { key: "nik", label: "NIK" },
                      { key: "npwp", label: "No. NPWP" },
                      { key: "education_level", label: "Tingkat Pendidikan" },
                      { key: "university", label: "Sekolah/Universitas" },
                      { key: "major", label: "Jurusan" },
                      { key: "graduation_year", label: "Tahun Lulus" },
                      { key: "linkedin", label: "LinkedIn" },
                      { key: "portfolio", label: "Portfolio Website" },
                      { key: "expected_salary", label: "Ekspektasi Gaji" },
                    ].map((f) => (
                      <div key={f.key}>
                        <p className="text-xs opacity-60">{f.label}</p>
                        <p className="font-semibold break-words">
                          {f.key === "date_of_birth"
                            ? selected[f.key]
                              ? new Date(selected[f.key]).toLocaleDateString(
                                  "id-ID",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  },
                                )
                              : "-"
                            : f.key === "expected_salary"
                              ? selected[f.key]
                                ? new Intl.NumberFormat("id-ID", {
                                    style: "currency",
                                    currency: "IDR",
                                    minimumFractionDigits: 0,
                                  }).format(selected[f.key])
                                : "-"
                              : selected[f.key] ||
                                selected[f.key.replace("candidate_", "")] ||
                                "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ================= DOKUMEN ================= */}
              <div className="card bg-base-200 border">
                <div className="card-body">
                  <h3 className="card-title text-lg">📄 Dokumen</h3>
                  <div className="divide-y border rounded-lg overflow-hidden">
                    {(() => {
                      // Ambil dokumen requirements sesuai posisi dan base_position LANGSUNG
                      const pos = selected.position_name || selected.position || "";
                      const basePos = selected.base_position || "";
                      const req = documentRequirements.getRequiredDocuments(pos, basePos);
                      const meta = documentRequirements.DOCUMENT_FIELD_METADATA;
                      const shownFields = [
                        ...(req.required || []),
                        ...(req.optional || []),
                      ];
                      let idx = 0;
                      return shownFields.map((key) => {
                        const val = selected[key];
                        const label = meta[key]?.label || key;
                        let url = "";
                        if (val) {
                          if (val.startsWith("http")) {
                            url = val;
                          } else if (
                            val.startsWith("/uploads") ||
                            val.startsWith("uploads/")
                          ) {
                            url = `http://localhost:5000/${val.replace(/^\//, "")}`;
                          } else {
                            url = `http://localhost:5000/uploads/candidate_documents/${val}`;
                          }
                        }
                        const isRequired = (req.required || []).includes(key);
                        const bg = idx % 2 === 0 ? "bg-base-100" : "";
                        idx++;
                        return (
                          <div
                            key={key}
                            className={`flex justify-between items-center px-4 py-3 ${bg}`}
                          >
                            <div>
                              <p className="text-xs opacity-60">
                                {label}
                                {!isRequired && (
                                  <span className="ml-1 text-xs text-warning">
                                    (Opsional)
                                  </span>
                                )}
                              </p>
                              <p
                                className={`font-semibold break-all ${!val ? "text-error opacity-60" : ""}`}
                              >
                                {val || "Tidak diupload"}
                              </p>
                            </div>
                            {val ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-xs btn-outline"
                              >
                                Lihat
                              </a>
                            ) : (
                              <span className="btn btn-xs btn-disabled opacity-60">
                                Tidak ada file
                              </span>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* ================= COVER LETTER ================= */}
              <div className="card bg-base-200 border">
                <div className="card-body text-sm">
                  <h3 className="card-title text-lg">Cover Letter</h3>
                  <div className="whitespace-pre-line break-words p-2 border rounded bg-base-100 min-h-[48px]">
                    {selected.cover_letter ? (
                      selected.cover_letter
                    ) : (
                      <span className="opacity-60 italic">
                        Tidak ada cover letter
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ================= STATUS ================= */}
              <div className="card bg-base-200 border">
                <div className="card-body text-sm">
                  <h3 className="card-title text-lg">Status Pelamar</h3>
                  <p>📌 {selected.status || "submitted"}</p>
                  <p>
                    📅 Apply:{" "}
                    {selected.submitted_at
                      ? new Date(selected.submitted_at).toLocaleDateString(
                          "id-ID",
                        )
                      : "-"}
                  </p>
                  {selected.reviewed_at && (
                    <p>
                      ✔ Review:{" "}
                      {new Date(selected.reviewed_at).toLocaleDateString(
                        "id-ID",
                      )}
                    </p>
                  )}
                  {selected.scheduled_date && (
                    <p>
                      📆 Interview:{" "}
                      {new Date(selected.scheduled_date).toLocaleDateString(
                        "id-ID",
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {/*================= ACTIONS =================*/}
            <div className="mt-6 border-t pt-6">
              {!selected?.isHistory && ( // ⬅️ TAMBAH INI
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    className="btn btn-outline btn-error w-full py-3"
                    onClick={() => {
                      console.log("[DEBUG] Klik Tolak, selected:", selected);
                      setShowRejectPopup(true);
                    }}
                    disabled={selected?.status === "ditolak"}
                  >
                    Tolak
                  </button>
                  <button
                    className="btn btn-success w-full py-3"
                    onClick={handleAccept}
                    disabled={
                      passedApplicants.some(
                        (p) => p.application_id === selected?.application_id,
                      ) || selected.status === "ditolak"
                    }
                  >
                    Shortlist Kandidat
                  </button>{" "}
                </div>
              )}
            </div>
            {/* Modal Tolak */}
            <Modal
              open={showRejectPopup}
              onClose={() => {
                setShowRejectPopup(false);
                setRejectNotes("");
              }}
              onSubmit={handleRejectSubmit}
              title="Tolak Pelamar"
            >
              <label className="block mb-2 font-medium">
                Catatan Penolakan
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Masukkan alasan penolakan..."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
              />
            </Modal>
          </TitleCard>
        </>
      )}
    </>
  );
}
