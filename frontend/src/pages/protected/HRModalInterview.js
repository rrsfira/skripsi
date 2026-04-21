import React, { useEffect, useState } from "react";
import axios from "axios";

export default function InterviewModal({
  isFormOpen,
  isCancelOpen,
  isDetailOpen = false,
  onCloseForm,
  onCloseCancel,
  selectedCandidate,
  form,
  setForm,
  mode,
  cancelNotes,
  setCancelNotes,
  onSubmit,
  onCancelSubmit,
}) {
  const [interviewers, setInterviewers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  // Fetch detail kandidat/interview dari backend saat popup detail dibuka ATAU saat form atur ulang dibuka
  useEffect(() => {
    const shouldFetch = (isDetailOpen || (isFormOpen && mode === "update")) && selectedCandidate?.id;
    if (shouldFetch) {
      setDetailLoading(true);
      setDetailError("");
      let url = "";
      if (selectedCandidate.application_id) {
        url = `/api/candidates/admin/applications/${selectedCandidate.application_id}`;
      } else {
        url = `/api/candidates/interviews/${selectedCandidate.id}`;
      }
      axios.get(url)
        .then(res => {
          if (res.data && (res.data.application || res.data.interview)) {
            setDetailCandidate(res.data.application || res.data.interview);
          } else {
            setDetailCandidate(selectedCandidate);
          }
        })
        .catch(err => {
          let msg = "Gagal mengambil detail pelamar/interview";
          if (err.response && err.response.data && err.response.data.message) {
            msg += ": " + err.response.data.message;
          } else if (err.message) {
            msg += ": " + err.message;
          }
          setDetailError(msg);
          setDetailCandidate(selectedCandidate);
          // eslint-disable-next-line no-console
          console.error("[InterviewModal] Detail fetch error:", err);
        })
        .finally(() => setDetailLoading(false));
    } else if (!isDetailOpen && !(isFormOpen && mode === "update")) {
      setDetailCandidate(null);
      setDetailLoading(false);
      setDetailError("");
    }
  }, [isDetailOpen, isFormOpen, mode, selectedCandidate]);
  const formatDateOnly = (date) => {
    return date
      ? new Date(date).toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "-";
  };

  // Fetch hanya pegawai dengan role HR saat modal dibuka
  useEffect(() => {
    if (!isFormOpen) return;
    axios
      .get("/api/employees")
      .then((res) => {
        const employees = res.data.employees || [];
        setInterviewers(employees.filter((emp) => String(emp.position_id) === "12"));
      })
      .catch(() => {
        setInterviewers([]);
      });
    // eslint-disable-next-line
  }, [isFormOpen]);

  // Tidak perlu update interviewer berdasarkan interview_stage lagi

  // Helper untuk format ke YYYY-MM-DDTHH:mm agar input datetime-local bisa terisi
  function toDatetimeLocal(val) {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "";
    const pad = (n) => n.toString().padStart(2, "0");
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  // Prefill form saat mode update dan modal dibuka
  useEffect(() => {
    if (isFormOpen && mode === "update" && selectedCandidate) {
      // Ambil data employee interviewer jika ada interviewer_id
      const fetchInterviewer = async () => {
        let departmentName =
          selectedCandidate.interview_stage ||
          selectedCandidate.department_name ||
          "";
        let interviewerId = selectedCandidate.interviewer_id || "";
        if (interviewerId) {
          try {
            const res = await axios.get(`/api/employees/${interviewerId}`);
            if (res.data && res.data.employee) {
              departmentName =
                res.data.employee.department_name || departmentName;
            }
          } catch (e) {
            /* fallback ke data lama */
          }
        }
        setForm({
          scheduled_date: toDatetimeLocal(
            selectedCandidate.scheduled_date || selectedCandidate.date,
          ),
          interview_stage: departmentName,
          interviewer_id: interviewerId,
          duration_minutes: selectedCandidate.duration_minutes || "",
          interview_type: selectedCandidate.interview_type || "online",
          meeting_link: selectedCandidate.meeting_link || "",
          location: selectedCandidate.location || "",
        });
      };
      fetchInterviewer();
    }
    // eslint-disable-next-line
  }, [isFormOpen, mode, selectedCandidate]);

  return (
    <>
      {/* ================= MODAL FORM (ASLI) ================= */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
            <h3 className="font-bold text-lg mb-4">
              {mode === "create"
                ? "Buat Jadwal Wawancara"
                : "Atur Ulang Jadwal Wawancara"}
            </h3>

            {/* PROFILE KANDIDAT */}
            <div className="rounded-xl border border-base-300 p-4 mb-5">
              <div className="flex flex-col items-center mb-4">
                <div className="avatar mb-3">
                  <div className="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                    <img
                      src={
                        (() => {
                          // Prioritaskan photo_file dari detailCandidate jika ada, lalu selectedCandidate
                          const photo = (detailCandidate?.photo_file ?? selectedCandidate?.photo_file) || "";
                          if (photo && photo !== "-" && photo !== "null" && photo !== null && photo !== undefined && photo !== "") {
                            return photo.startsWith("http")
                              ? photo
                              : `http://localhost:5000/${photo.replace(/^\//, "")}`;
                          }
                          // Fallback ke nama
                          const name = detailCandidate?.name || detailCandidate?.candidate_name || selectedCandidate?.name || selectedCandidate?.candidate_name || "-";
                          return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                        })()
                      }
                      alt={detailCandidate?.name || detailCandidate?.candidate_name || selectedCandidate?.name || selectedCandidate?.candidate_name || ""}
                    />
                  </div>
                </div>

                <h2 className="font-bold text-md">
                  {detailCandidate?.name || detailCandidate?.candidate_name || selectedCandidate?.name || selectedCandidate?.candidate_name || "-"}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <p>
                  <span className="font-semibold">Jenis Kelamin:</span>{" "}
                  {detailCandidate?.gender || selectedCandidate?.gender || "-"}
                </p>
                <p>
                  <span className="font-semibold">Tanggal Lahir:</span>{" "}
                  {formatDateOnly(detailCandidate?.date_of_birth || selectedCandidate?.date_of_birth)}
                </p>
                <p>
                  <span className="font-semibold">Pendidikan:</span>{" "}
                  {detailCandidate?.education_level || selectedCandidate?.education_level || "-"}
                </p>
                <p>
                  <span className="font-semibold">Jurusan:</span>{" "}
                  {detailCandidate?.major || selectedCandidate?.major || "-"}
                </p>
                <p>
                  <span className="font-semibold">Tahun Lulus:</span>{" "}
                  {detailCandidate?.graduation_year || selectedCandidate?.graduation_year || "-"}
                </p>
                <p>
                  <span className="font-semibold">NPWP:</span>{" "}
                  {detailCandidate?.npwp || selectedCandidate?.npwp || "-"}
                </p>
              </div>
            </div>

            {/* FORM */}
            <div className="grid gap-3">
              <input
                type="datetime-local"
                className="input input-bordered"
                value={form.scheduled_date}
                onChange={(e) =>
                  setForm({ ...form, scheduled_date: e.target.value })
                }
              />

              <select
                className="select select-bordered"
                value={form.interviewer_id}
                onChange={(e) =>
                  setForm({ ...form, interviewer_id: e.target.value })
                }
              >
                <option value="">Pilih Interviewer</option>
                {interviewers.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position_name})
                  </option>
                ))}
              </select>

              <input
                type="number"
                className="input input-bordered"
                placeholder="Durasi (menit)"
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm({ ...form, duration_minutes: e.target.value })
                }
              />

              <select
                className="select select-bordered"
                value={form.interview_type}
                onChange={(e) =>
                  setForm({ ...form, interview_type: e.target.value })
                }
              >
                <option value="online">Pilih tipe</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>

              {form.interview_type === "online" && (
                <input
                  type="text"
                  placeholder="Meeting Link"
                  className="input input-bordered"
                  value={form.meeting_link}
                  onChange={(e) =>
                    setForm({ ...form, meeting_link: e.target.value })
                  }
                />
              )}

              {form.interview_type === "offline" && (
                <input
                  type="text"
                  placeholder="Lokasi Interview"
                  className="input input-bordered"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost" onClick={onCloseForm}>
                Batal
              </button>

              <button className="btn btn-primary" onClick={onSubmit}>
                {mode === "create" ? "Simpan Jadwal" : "Update Jadwal"}
              </button>
            </div>
          </div>
        </div>
      )}
    
    
      {/* ================= MODAL CANCEL (ASLI) ================= */}
        {isCancelOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-base-100 p-6 rounded-xl w-full max-w-md shadow-lg">
            <h3 className="font-bold text-lg mb-4">
              Batalkan Lamaran Kandidat ini
            </h3>

            <div className="flex items-center gap-3 mb-3">
              <div>
                <div className="font-semibold">{selectedCandidate?.name || selectedCandidate?.candidate_name || '-'}</div>
                <div className="text-xs text-gray-500">{selectedCandidate?.job_title || selectedCandidate?.position_name || selectedCandidate?.job_opening_title || '-'}</div>
              </div>
            </div>

            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Masukkan alasan pembatalan..."
              value={cancelNotes}
              onChange={(e) => setCancelNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost" onClick={onCloseCancel}>
                Batal
              </button>

              <button className="btn btn-error" onClick={onCancelSubmit}>
                Konfirmasi Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
