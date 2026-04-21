import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  getRequiredDocuments,
  DOCUMENT_FIELD_METADATA,
} from "../../utils/documentRequirements";

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
  readOnly = false,
}) {
  const [detailCandidate, setDetailCandidate] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [evaluation, setEvaluation] = useState({
    rating: "",
    recommendation: "",
    interviewer_notes: "",
    result: "",
  });
  const [isEdit, setIsEdit] = useState(false);
  // Tambahan: state untuk job_opening
  const [jobOpeningStatus, setJobOpeningStatus] = useState({ status: null, hiring_status: null });
  // Ambil status & hiring_status dari job_openings
  useEffect(() => {
    // Cari job_opening_id dari detailCandidate atau selectedCandidate
    const jobOpeningId = detailCandidate?.job_opening_id || selectedCandidate?.job_opening_id;
    if (!jobOpeningId) return;
    // Cegah refetch jika sudah sama
    if (
      jobOpeningStatus.status &&
      jobOpeningStatus.hiring_status &&
      jobOpeningStatus._id === jobOpeningId
    ) {
      return;
    }
    // Fetch ke backend
    axios
      .get(`/api/job-openings/${jobOpeningId}`)
      .then((res) => {
        if (res.data && res.data.job) {
          setJobOpeningStatus({
            status: res.data.job.status,
            hiring_status: res.data.job.hiring_status,
            _id: jobOpeningId,
          });
        }
      })
      .catch(() => {
        setJobOpeningStatus({ status: null, hiring_status: null, _id: jobOpeningId });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailCandidate, selectedCandidate]);

  // Saat masuk mode edit, isi field dengan data terakhir
  useEffect(() => {
    if (isEdit) {
      // Ambil data dari detailCandidate, jika tidak ada fallback ke selectedCandidate, lalu ke evaluation
      setEvaluation({
        rating: (detailCandidate?.rating ?? selectedCandidate?.rating ?? evaluation.rating) || "",
        recommendation: (detailCandidate?.recommendation ?? selectedCandidate?.recommendation ?? evaluation.recommendation) || "",
        interviewer_notes: (detailCandidate?.interviewer_notes ?? selectedCandidate?.interviewer_notes ?? evaluation.interviewer_notes) || "",
        result: (detailCandidate?.result ?? selectedCandidate?.result ?? evaluation.result) || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  // Ambil detail kandidat/interview saat modal detail dibuka
  useEffect(() => {
    if (isDetailOpen && selectedCandidate?.id) {
      setDetailCandidate(null);
      setDetailError("");
      let url = "";
      if (selectedCandidate.application_id) {
        url = `/api/candidates/admin/applications/${selectedCandidate.application_id}`;
      } else {
        url = `/api/candidates/interviews/${selectedCandidate.id}`;
      }
      axios
        .get(url)
        .then((res) => {
          const data = res.data.application || res.data.interview || selectedCandidate;
          setDetailCandidate(data);
          // Set evaluation jika ada data interview
          setEvaluation({
            rating: data.rating || "",
            recommendation: data.recommendation || "",
            interviewer_notes: data.interviewer_notes || "",
            result: data.result || "",
          });
        })
        .catch((err) => {
          let msg = "Gagal mengambil detail pelamar/interview";
          if (err.response && err.response.data && err.response.data.message) {
            msg += ": " + err.response.data.message;
          } else if (err.message) {
            msg += ": " + err.message;
          }
          setDetailError(msg);
          setDetailCandidate(selectedCandidate);
        });
    } else if (!isDetailOpen) {
      setDetailCandidate(null);
      setDetailError("");
    }
  }, [isDetailOpen, selectedCandidate]);

  // ...existing logic, hooks, useEffect, etc (jika ada)...

  return (
    <>
      {isDetailOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-base-100 w-[95%] max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl">
            {/* HEADER */}
            <div className="sticky top-0 z-10 bg-base-100 border-b px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <h3 className="font-bold text-lg">Detail Pelamar</h3>
              <button className="btn btn-sm btn-outline" onClick={onCloseForm}>
                Tutup
              </button>
            </div>

            {/* CONTENT */}
            <div className="p-6 space-y-4">
              {detailCandidate === null && !detailError && (
                <div className="flex flex-col items-center justify-center min-h-[200px]">
                  <span className="loading loading-spinner loading-lg mb-4"></span>
                  <div>Memuat detail kandidat...</div>
                </div>
              )}

              {detailError && (
                <div className="text-error text-center py-8">{detailError}</div>
              )}

              {detailCandidate && !detailError && (
                <>
                  <div className="space-y-4">
                    {/* ================= DATA DIRI ================= */}
                    <div className="card bg-base-200 border">
                      <div className="card-body">
                        <div className="avatar mb-3 flex justify-center">
                          <div className="w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                            <img
                              src={
                                detailCandidate?.photo_file
                                  ? detailCandidate.photo_file.startsWith(
                                      "http",
                                    )
                                    ? detailCandidate.photo_file
                                    : `http://localhost:5000/${detailCandidate.photo_file.replace(/^\//, "")}`
                                  : "https://ui-avatars.com/api/?name=" +
                                    encodeURIComponent(
                                      detailCandidate?.candidate_name ||
                                        detailCandidate?.name ||
                                        "-",
                                    ) +
                                    "&background=random"
                              }
                              alt="Foto"
                              className="object-cover"
                            />
                          </div>
                        </div>

                        <h3 className="card-title text-lg">
                          Data Diri Lengkap
                        </h3>

                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                          {[
                            { key: "candidate_name", label: "Nama Lengkap" },
                            { key: "candidate_email", label: "Email" },
                            { key: "phone", label: "Nomor HP" },
                            { key: "gender", label: "Jenis Kelamin" },
                            { key: "birth_place", label: "Tempat Lahir" },
                            { key: "date_of_birth", label: "Tanggal Lahir" },
                            {
                              key: "marital_status",
                              label: "Status Pernikahan",
                            },
                            { key: "nationality", label: "Kebangsaan" },
                            { key: "address", label: "Alamat" },
                            { key: "nik", label: "NIK" },
                            { key: "npwp", label: "No. NPWP" },
                            {
                              key: "education_level",
                              label: "Tingkat Pendidikan",
                            },
                            { key: "university", label: "Sekolah/Universitas" },
                            { key: "major", label: "Jurusan" },
                            { key: "graduation_year", label: "Tahun Lulus" },
                            { key: "linkedin", label: "LinkedIn" },
                            { key: "portfolio", label: "Portfolio Website" },
                            {
                              key: "expected_salary",
                              label: "Ekspektasi Gaji",
                            },
                          ].map((f) => (
                            <div key={f.key}>
                              <p className="text-xs opacity-60">{f.label}</p>
                              <p className="font-semibold break-words">
                                {f.key === "date_of_birth"
                                  ? detailCandidate?.[f.key]
                                    ? new Date(
                                        detailCandidate[f.key],
                                      ).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })
                                    : "-"
                                  : f.key === "expected_salary"
                                    ? detailCandidate?.[f.key]
                                      ? new Intl.NumberFormat("id-ID", {
                                          style: "currency",
                                          currency: "IDR",
                                          minimumFractionDigits: 0,
                                        }).format(detailCandidate[f.key])
                                      : "-"
                                    : detailCandidate?.[f.key] ||
                                      detailCandidate?.[
                                        f.key.replace("candidate_", "")
                                      ] ||
                                      "-"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* ================= DOKUMEN (DINAMIS) ================= */}
                    <div className="card bg-base-200 border">
                      <div className="card-body">
                        <h3 className="card-title text-lg">📄 Dokumen</h3>
                        <div className="divide-y border rounded-lg overflow-hidden">
                          {(() => {
                            // Ambil kebutuhan dokumen sesuai posisi
                            const pos =
                              detailCandidate?.position_name ||
                              detailCandidate?.position ||
                              "";
                            const basePos =
                              detailCandidate?.base_position || "";
                            const req = getRequiredDocuments(pos, basePos);
                            const meta = DOCUMENT_FIELD_METADATA;
                            const shownFields = [
                              ...(req.required || []),
                              ...(req.optional || []),
                            ];
                            let idx = 0;
                            return shownFields.map((key) => {
                              const val = detailCandidate?.[key];
                              const label = meta[key]?.label || key;
                              let url = "";
                              if (val) {
                                if (val.startsWith("http")) url = val;
                                else
                                  url = `http://localhost:5000/${val.replace(/^\//, "")}`;
                              }
                              const isRequired = (req.required || []).includes(
                                key,
                              );
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
                          {detailCandidate?.cover_letter ? (
                            detailCandidate.cover_letter
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
                        <p>📌 {detailCandidate?.status || "submitted"}</p>
                        <p>
                          📅 Apply:{" "}
                          {detailCandidate?.submitted_at
                            ? new Date(
                                detailCandidate.submitted_at,
                              ).toLocaleDateString("id-ID")
                            : "-"}
                        </p>
                        {detailCandidate?.scheduled_date && (
                          <p>
                            📆 Interview:{" "}
                            {new Date(
                              detailCandidate.scheduled_date,
                            ).toLocaleDateString("id-ID")}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* ================= HASIL INTERVIEW ================= */}
                    <div className="card bg-base-200 border">
                      <div className="card-body text-sm">
                        <h3 className="card-title text-lg">📝 Hasil Wawancara</h3>
                        {(!readOnly) ? (
                          // Mode input langsung untuk menu list (review & nilai) -- tampilkan dua input terpisah seperti sebelumnya
                          <>
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* RATING */}
                              <div>
                                <label className="label">Penilaian (1-5)</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="5"
                                  className="input input-bordered w-full"
                                  value={evaluation.rating}
                                  onChange={(e) =>
                                    setEvaluation({
                                      ...evaluation,
                                      rating: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              {/* RECOMMENDATION */}
                              <div>
                                <label className="label">Rekomendasi</label>
                                <select
                                  className="select select-bordered w-full"
                                  value={evaluation.recommendation}
                                  onChange={(e) =>
                                    setEvaluation({
                                      ...evaluation,
                                      recommendation: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Pilih</option>
                                  <option value="hire">Diterima</option>
                                  <option value="consider">Dipertimbangkan</option>
                                  <option value="reject">Ditolak</option>
                                </select>
                              </div>
                              {/* RESULT */}
                              <div>
                                <label className="label">Hasil</label>
                                <select
                                  className="select select-bordered w-full"
                                  value={evaluation.result}
                                  onChange={(e) =>
                                    setEvaluation({
                                      ...evaluation,
                                      result: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Pilih</option>
                                  <option value="pending">Menunggu</option>
                                  <option value="passed">Lolos</option>
                                  <option value="failed">Tidak Lolos</option>
                                  <option value="no_show">Tidak Hadir</option>
                                </select>
                              </div>
                            </div>
                            {/* NOTES */}
                            <div className="mt-4">
                              <label className="label">Catatan Interviewer</label>
                              <textarea
                                className="textarea textarea-bordered w-full"
                                rows={4}
                                value={evaluation.interviewer_notes}
                                onChange={(e) =>
                                  setEvaluation({
                                    ...evaluation,
                                    interviewer_notes: e.target.value,
                                  })
                                }
                              />
                            </div>
                            {/* BUTTON */}
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                className="btn btn-outline"
                                type="button"
                                onClick={onCloseForm}
                              >
                                Batal
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={async () => {
                                  try {
                                    await axios.put(
                                      `/api/candidates/admin/interviews/${selectedCandidate.id}/result`,
                                      {
                                        rating: evaluation.rating,
                                        recommendation: evaluation.recommendation,
                                        interviewer_notes: evaluation.interviewer_notes,
                                        result: evaluation.result,
                                        status: "completed",
                                      },
                                    );
                                    alert("Berhasil menyimpan hasil wawancara");
                                    // Refresh data interview di halaman utama jika ada
                                    if (
                                      typeof window !== "undefined" &&
                                      window.dispatchEvent
                                    ) {
                                      window.dispatchEvent(
                                        new Event("refreshInterviewData"),
                                      );
                                    }
                                    if (typeof onCloseForm === "function")
                                      onCloseForm();
                                  } catch (err) {
                                    console.error(err);
                                    alert("Gagal menyimpan");
                                  }
                                }}
                              >
                                Simpan Hasil
                              </button>
                            </div>
                          </>
                        ) : isEdit ? (
                          <>
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* RATING */}
                              <div>
                                <label className="label">Penilaian (1-5)</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="5"
                                  className="input input-bordered w-full"
                                  value={evaluation.rating}
                                  onChange={(e) =>
                                    setEvaluation({
                                      ...evaluation,
                                      rating: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              {/* REKOMENDASI & HASIL (GABUNG) */}
                              <div className="md:col-span-2">
                                <label className="label">Keputusan Akhir</label>
                                <select
                                  className="select select-bordered w-full"
                                  value={
                                    evaluation.recommendation === "hire" && evaluation.result === "passed"
                                      ? "accepted"
                                      : evaluation.recommendation === "reject" && evaluation.result === "failed"
                                        ? "rejected"
                                        : ""
                                  }
                                  onChange={e => {
                                    if (e.target.value === "accepted") {
                                      setEvaluation({
                                        ...evaluation,
                                        recommendation: "hire",
                                        result: "passed",
                                      });
                                    } else if (e.target.value === "rejected") {
                                      setEvaluation({
                                        ...evaluation,
                                        recommendation: "reject",
                                        result: "failed",
                                      });
                                    } else {
                                      setEvaluation({
                                        ...evaluation,
                                        recommendation: "",
                                        result: "",
                                      });
                                    }
                                  }}
                                >
                                  <option value="">Pilih</option>
                                  <option value="accepted">Diterima</option>
                                  <option value="rejected">Ditolak</option>
                                </select>
                              </div>
                            </div>
                            {/* NOTES */}
                            <div className="mt-4">
                              <label className="label">Catatan Interviewer</label>
                              <textarea
                                className="textarea textarea-bordered w-full"
                                rows={4}
                                value={evaluation.interviewer_notes}
                                onChange={(e) =>
                                  setEvaluation({
                                    ...evaluation,
                                    interviewer_notes: e.target.value,
                                  })
                                }
                              />
                            </div>
                            {/* BUTTON */}
                            <div className="mt-4 flex justify-end gap-2">
                              <button
                                className="btn btn-outline"
                                type="button"
                                onClick={() => setIsEdit(false)}
                              >
                                Batal
                              </button>
                              <button
                                className="btn btn-primary"
                                onClick={async () => {
                                  try {
                                    // Update interview result
                                    await axios.put(
                                      `/api/candidates/admin/interviews/${selectedCandidate.id}/result`,
                                      {
                                        rating: evaluation.rating,
                                        recommendation: evaluation.recommendation,
                                        interviewer_notes: evaluation.interviewer_notes,
                                        result: evaluation.result,
                                        status: "completed",
                                      },
                                    );
                                    // Jika ada application_id, update juga status di applications
                                    if (selectedCandidate.application_id) {
                                      let appStatus = "";
                                      if (evaluation.recommendation === "hire" && evaluation.result === "passed") {
                                        appStatus = "diterima";
                                      } else if (evaluation.recommendation === "reject" && evaluation.result === "failed") {
                                        appStatus = "ditolak";
                                      }
                                      if (appStatus) {
                                        await axios.put(`/api/candidates/admin/applications/${selectedCandidate.application_id}/status`, {
                                          status: appStatus,
                                        });
                                      }
                                    }
                                    alert("Berhasil menyimpan hasil wawancara");
                                    // Refresh data interview di halaman utama jika ada
                                    if (
                                      typeof window !== "undefined" &&
                                      window.dispatchEvent
                                    ) {
                                      window.dispatchEvent(
                                        new Event("refreshInterviewData"),
                                      );
                                    }
                                    setIsEdit(false);
                                  } catch (err) {
                                    console.error(err);
                                    alert("Gagal menyimpan");
                                  }
                                }}
                              >
                                Simpan Hasil
                              </button>
                            </div>
                          </>
                        ) : (
                          (() => {
                            // Fallback: jika evaluation kosong, ambil dari selectedCandidate
                            const evalData = {
                              rating: evaluation.rating || selectedCandidate?.rating || '-',
                              recommendation: evaluation.recommendation || selectedCandidate?.recommendation || '-',
                              interviewer_notes: evaluation.interviewer_notes || selectedCandidate?.interviewer_notes || '-',
                              result: evaluation.result || selectedCandidate?.result || '-',
                            };
                            return (
                              <div className="space-y-2">
                                <div>
                                  <span className="opacity-60">Penilaian (1-5): </span>
                                  <span className="font-semibold">{evalData.rating || '-'}</span>
                                </div>
                                <div>
                                  <span className="opacity-60">Rekomendasi: </span>
                                  <span className="font-semibold">
                                    {evalData.recommendation === 'hire' && 'Diterima'}
                                    {evalData.recommendation === 'consider' && 'Dipertimbangkan'}
                                    {evalData.recommendation === 'reject' && 'Ditolak'}
                                    {!['hire','consider','reject'].includes(evalData.recommendation) && (evalData.recommendation || '-')}
                                  </span>
                                </div>
                                <div>
                                  <span className="opacity-60">Hasil: </span>
                                  <span className="font-semibold">
                                    {evalData.result === 'pending' && 'Menunggu'}
                                    {evalData.result === 'passed' && 'Lolos'}
                                    {evalData.result === 'failed' && 'Tidak Lolos'}
                                    {evalData.result === 'no_show' && 'Tidak Hadir'}
                                    {!['pending','passed','failed','no_show'].includes(evalData.result) && (evalData.result || '-')}
                                  </span>
                                </div>
                                <div>
                                  <span className="opacity-60">Catatan Interviewer: </span>
                                  <span className="font-semibold whitespace-pre-line">{evalData.interviewer_notes || '-'}</span>
                                </div>
                                {/* Tombol Edit hanya muncul jika lowongan BELUM closed/completed */}
                                {(() => {
                                  // Gunakan status & hiring_status dari job_openings
                                  const status = jobOpeningStatus.status;
                                  const hiringStatus = jobOpeningStatus.hiring_status;
                                  if (!status || !hiringStatus) return true;
                                  if (status.toLowerCase() === "closed" && ["completed","canceled"].includes(hiringStatus.toLowerCase())) {
                                    return false;
                                  }
                                  return true;
                                })() && (
                                  <div className="mt-4 flex justify-end">
                                    <button
                                      className="btn btn-warning"
                                      type="button"
                                      onClick={() => setIsEdit(true)}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
