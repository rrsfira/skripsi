import React, { useEffect, useState } from "react";
import axios from "axios";
import { formatDateOnly } from "../utils/dateUtils";
import { createPortal } from "react-dom";
import {
  formatAssessmentWeight,
  parseInterviewAssessmentNotes,
} from "../utils/interviewAssessmentNotes";

export default function ApplicationDetailModal({ isOpen, onClose, app }) {
  const [jobDetail, setJobDetail] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  // Preview modal state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewName, setPreviewName] = useState("");
  const [previewIsImage, setPreviewIsImage] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);

  const openPreviewUrl = (url, name) => {
    if (!url) return;
    setPreviewUrl(url);
    setPreviewName(name || url.split("/").pop() || "File");
    const lower = (url.split("?")[0] || "").toLowerCase();
    setPreviewIsImage(/\.(png|jpe?g|gif|webp|bmp)$/i.test(lower));
    setPreviewScale(1);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewName("");
    setPreviewIsImage(false);
    setPreviewScale(1);
  };

  const zoomIn = () =>
    setPreviewScale((s) => Math.min(3, +(s + 0.25).toFixed(2)));
  const zoomOut = () =>
    setPreviewScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)));
  const resetZoom = () => setPreviewScale(1);
  const jobOpeningId =
    app?.job_opening_id || app?.job_openingId || app?.job_id || app?.jobId;

  const getVisibleStatus = (value) => {
    const rawStatus = value?.status || "submitted";
    const isPublished =
      value?.is_published ||
      value?.hiring_status === "interview" ||
      value?.hiring_status === "completed";

    if (
      !isPublished &&
      [
        "ditolak",
        "diterima",
        "lolos_dokumen",
        "wawancara",
        "interview_rescheduled",
      ].includes(rawStatus)
    ) {
      return "screening";
    }

    return rawStatus;
  };

  useEffect(() => {
    if (isOpen && jobOpeningId) {
      setLoadingJob(true);
      axios
        .get(`/api/job-openings/${jobOpeningId}`)
        .then((res) => setJobDetail(res.data.job || res.data))
        .catch(() => setJobDetail(null))
        .finally(() => setLoadingJob(false));
    } else {
      setJobDetail(null);
    }
    // eslint-disable-next-line
  }, [isOpen, jobOpeningId]);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const getStatusBadgeClass = (status) => {
    const map = {
      submitted: "bg-blue-100 text-blue-700",
      screening: "bg-purple-100 text-purple-700",
      lolos_dokumen: "bg-indigo-100 text-indigo-700",
      wawancara: "bg-cyan-100 text-cyan-700",
      interview_rescheduled: "bg-orange-100 text-orange-700",
      interview_completed: "bg-green-100 text-green-700",
      interview_cancelled: "bg-red-100 text-red-700",
      diterima: "bg-green-100 text-green-700",
      ditolak: "bg-red-100 text-red-700",
      withdrawn: "bg-gray-100 text-gray-600",
    };
    return map[status] || "bg-gray-100 text-gray-600";
  };

  const getStatusLabel = (status) => {
    const map = {
      submitted: "Terkirim",
      screening: "Seleksi",
      lolos_dokumen: "Lolos Dokumen",
      wawancara: "Wawancara",
      interview_rescheduled: "Wawancara Dijadwalkan Ulang",
      interview_completed: "Wawancara Selesai",
      interview_cancelled: "Wawancara Dibatalkan",
      diterima: "Diterima",
      ditolak: "Ditolak",
      withdrawn: "Dibatalkan",
    };
    return map[status] || status;
  };

  const visibleStatus = getVisibleStatus(app);
  const isFinalStatus = ["diterima", "ditolak"].includes(visibleStatus);
  const latestInterview = Array.isArray(app?.interviews)
    ? app.interviews[0]
    : app?._interview || null;
  const pickFirstValue = (...values) =>
    values.find((value) => value !== null && value !== undefined && value !== "");
  const interviewerNotesSource = pickFirstValue(
    app?.interviewer_notes,
    app?.display_interviewer_notes,
    app?.interview_notes,
    app?.interviewer_feedback,
    latestInterview?.interviewer_notes,
    latestInterview?.display_interviewer_notes,
    latestInterview?.interview_notes,
    latestInterview?.interviewer_feedback,
    latestInterview?.notes,
  );
  const parsedInterviewNotes = parseInterviewAssessmentNotes(
    interviewerNotesSource,
  );
  const assessment = parsedInterviewNotes.assessment || {};
  const assessmentCriteria = Array.isArray(assessment.criteria)
    ? assessment.criteria
    : [];
  const finalScore = pickFirstValue(
    assessment.total_score,
    assessment.percentage,
    assessment.rating,
    app?.average_rating,
    app?.rating,
    latestInterview?.average_rating,
    latestInterview?.rating,
  );
  const finalResult = pickFirstValue(
    app?.interview_result,
    latestInterview?.result,
    visibleStatus === "diterima" ? "passed" : visibleStatus === "ditolak" ? "failed" : "",
  );
  const finalRecommendation = pickFirstValue(
    app?.recommendation,
    latestInterview?.recommendation,
  );
  const finalNotes = parsedInterviewNotes.notes;

  const formatFinalResult = (value) => {
    const map = {
      passed: "Lolos",
      failed: "Tidak Lolos",
      no_show: "Tidak Hadir",
      pending: "Menunggu",
      disqualified: "Digugurkan",
      diterima: "Diterima",
      ditolak: "Ditolak",
    };
    return map[value] || value || "-";
  };

  const formatRecommendation = (value) => {
    const map = {
      hire: "Direkomendasikan Diterima",
      consider: "Dipertimbangkan",
      reject: "Tidak Direkomendasikan",
    };
    return map[value] || value || "-";
  };

  const formatScore = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2).replace(/\.00$/, "")}/100` : value;
  };

  // Progress bar: jika withdrawn, hanya tampil satu step "Dibatalkan"
  let steps, currentStep;
  if (visibleStatus === "withdrawn") {
    steps = ["withdrawn"];
    currentStep = 0;
  } else {
    // Samakan urutan dan value steps progress dengan status lamaran utama
    let statusForStep = visibleStatus;
    if (statusForStep === "shortlisted") statusForStep = "screening";
    const hasInterview = !!app.has_interview;
    steps = ["submitted", "screening"];
    if (!hasInterview && statusForStep === "ditolak") {
      steps.push("ditolak");
      statusForStep = "ditolak";
    } else {
      steps.push("lolos_dokumen");
      if (hasInterview) steps.push("wawancara");
      if (statusForStep === "ditolak") {
        steps.push("ditolak");
        statusForStep = "ditolak";
      } else {
        steps.push("diterima");
      }
    }
    currentStep = steps.indexOf(statusForStep);
  }

  const biodataFields = [
    { key: "name", label: "Nama Lengkap" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Nomor HP" },
    { key: "gender", label: "Jenis Kelamin" },
    { key: "birth_place", label: "Tempat Lahir" },
    { key: "date_of_birth", label: "Tanggal Lahir" },
    { key: "marital_status", label: "Status Pernikahan" },
    { key: "nationality", label: "Kebangsaan" },
    { key: "address", label: "Alamat" },
    { key: "nik", label: "NIK" },
    { key: "npwp", label: "NPWP" },
    { key: "education_level", label: "Tingkat Pendidikan" },
    { key: "university", label: "Sekolah/Universitas" },
    { key: "major", label: "Jurusan" },
    { key: "graduation_year", label: "Tahun Lulus" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "portfolio", label: "Portfolio Website" },
    { key: "expected_salary", label: "Ekspektasi Gaji" },
  ];

  const dokumenFields = [
    { key: "cv_file", label: "CV / Resume" },
    { key: "portfolio_file", label: "Portfolio" },
    { key: "cover_letter_file", label: "Surat Lamaran" },
    { key: "ijazah_file", label: "Ijazah" },
    { key: "transcript_file", label: "Transkrip Nilai" },
    { key: "certificate_file", label: "Sertifikat" },
    { key: "ktp_file", label: "KTP" },
    { key: "photo_file", label: "Foto Diri" },
  ];

  function getDocumentUrl(path) {
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    if (!path) return "#";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/uploads")) return `${baseUrl}${path}`;
    if (path.startsWith("uploads/")) return `${baseUrl}/${path}`;
    return path;
  }

  function normalizeDocumentValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return normalizeDocumentValue(value[0]);
    if (typeof value === "object") {
      if (value.type === "Buffer" && Array.isArray(value.data)) {
        try {
          return new TextDecoder("utf-8")
            .decode(new Uint8Array(value.data))
            .trim();
        } catch (e) {
          return "";
        }
      }
      if (typeof value.data === "string") return value.data;
      if (Array.isArray(value.data)) {
        try {
          return new TextDecoder("utf-8")
            .decode(new Uint8Array(value.data))
            .trim();
        } catch (e) {
          return "";
        }
      }
      if (typeof value.path === "string") return value.path;
      if (typeof value.url === "string") return value.url;
      if (typeof value.file === "string") return value.file;
    }
    return "";
  }

  const coverLetterPath = normalizeDocumentValue(app?.cover_letter_file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-300/80 p-4">
      <div className="bg-base-100 text-base-content w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden max-h-screen overflow-y-auto border border-base-300">
        {/* HEADER */}
        <div className="flex justify-between items-start p-6 border-b border-base-300">
          <div>
            <h2 className="text-xl font-semibold text-base-content">
              {jobDetail?.job_title || app.job_title}
            </h2>
            <p className="text-sm opacity-70 text-base-content">
              {(jobDetail?.position_name || app.position_name) +
                " • " +
                (jobDetail?.location || app.location)}
            </p>
          </div>
          <button
            className="btn btn-sm btn-ghost text-base-content hover:bg-base-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* PROGRESS */}
        <div className="px-6 pt-4">
          <div className="flex items-center w-full">
            {steps[0] === "withdrawn" ? (
              <div className="flex flex-col items-center w-full">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 bg-red-500 text-white border-red-500">
                  1
                </div>
                <p
                  className="text-xs mt-2 capitalize opacity-90 text-red-600 font-medium text-center"
                  style={{ minWidth: 70 }}
                >
                  Dibatalkan
                </p>
              </div>
            ) : (
              steps.map((step, i) => {
                // Warna step: sudah lewat = oranye, aktif = biru, belum = abu
                let circleClass = "";
                if (i < currentStep) {
                  circleClass = "bg-orange-500 text-white border-orange-500";
                } else if (i === currentStep) {
                  circleClass = "bg-blue-500 text-white border-blue-500";
                } else {
                  circleClass = "bg-gray-100 text-gray-400 border-gray-300";
                }
                return (
                  <React.Fragment key={i}>
                    <div
                      className="flex flex-col items-center relative"
                      style={{ minWidth: 80 }}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all duration-200 ${circleClass}`}
                      >
                        {i + 1}
                      </div>
                      <p
                        className="text-xs mt-2 capitalize opacity-90 text-base-content font-medium text-center"
                        style={{ minWidth: 70 }}
                      >
                        {(() => {
                          const map = {
                            submitted: "Terkirim",
                            screening: "Seleksi",
                            lolos_dokumen: "Lolos Dokumen",
                            wawancara: "Wawancara",
                            diterima: "Diterima",
                            ditolak: "Ditolak",
                          };
                          // Jika step terakhir dan status rejected, tampilkan 'Ditolak'
                          if (
                            steps[steps.length - 1] === "ditolak" &&
                            i === steps.length - 1
                          ) {
                            return map["ditolak"];
                          }
                          return map[step] || step.replace("_", " ");
                        })()}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className="flex-1 h-1 mx-1"
                        style={{
                          background:
                            i < currentStep - 1
                              ? "#f97316"
                              : i === currentStep - 1
                                ? "#3b82f6"
                                : "#e5e7eb",
                          minWidth: 24,
                          borderRadius: 2,
                          marginTop: 16,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* DATA DIRI */}
          <div className="card bg-base-200 text-base-content border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-lg text-base-content">
                Data Diri
              </h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {biodataFields.map((f) => (
                  <div key={f.key}>
                    <p className="text-xs text-base-content/70 font-semibold">
                      {f.label}
                    </p>
                    <p className="font-semibold break-words text-base-content">
                      {f.key === "date_of_birth"
                        ? app[f.key]
                          ? new Date(app[f.key]).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              timeZone: "UTC",
                            })
                          : "-"
                        : f.key === "expected_salary"
                          ? app[f.key]
                            ? new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(app[f.key])
                            : "-"
                          : app[f.key] || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LOWONGAN */}
          <div className="card bg-base-200 text-base-content border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-lg text-base-content">
                Lowongan yang Dilamar
              </h3>
              {loadingJob ? (
                <div className="py-6 text-center text-sm text-base-content/60">
                  Memuat detail lowongan...
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Posisi
                      </p>
                      <p className="font-semibold text-lg text-base-content">
                        {jobDetail?.job_title ||
                          jobDetail?.position_name ||
                          app.job_title ||
                          app.position_name ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Lokasi
                      </p>
                      <p className="font-semibold">
                        {jobDetail?.location || app.location || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Jenis Pekerjaan
                      </p>
                      <p className="font-semibold capitalize">
                        {jobDetail?.employment_type ||
                          app.employment_type ||
                          "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Kuota
                      </p>
                      <p className="font-semibold">
                        {jobDetail?.quota || app.quota || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Gaji
                      </p>
                      <p className="font-semibold">
                        {jobDetail?.salary_range_min &&
                        jobDetail?.salary_range_max
                          ? `${new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              minimumFractionDigits: 0,
                            }).format(
                              jobDetail.salary_range_min,
                            )} - ${new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                              minimumFractionDigits: 0,
                            }).format(jobDetail.salary_range_max)}`
                          : app.salary_range_min && app.salary_range_max
                            ? `${new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(
                                app.salary_range_min,
                              )} - ${new Intl.NumberFormat("id-ID", {
                                style: "currency",
                                currency: "IDR",
                                minimumFractionDigits: 0,
                              }).format(app.salary_range_max)}`
                            : "Gaji dirahasiakan"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/70">
                        Deadline
                      </p>
                      <p className="font-semibold text-warning">
                        {formatDateOnly(jobDetail?.deadline || app.deadline)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-base-content/70">
                      Deskripsi
                    </p>
                    <p className="text-sm whitespace-pre-line">
                      {jobDetail?.description || app.description || "-"}
                    </p>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-base-content/70">
                      Persyaratan
                    </p>
                    <p className="text-sm whitespace-pre-line">
                      {jobDetail?.requirements || app.requirements || "-"}
                    </p>
                  </div>
                  {(jobDetail?.responsibilities || app.responsibilities) && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-base-content/70">
                        Tanggung Jawab
                      </p>
                      <p className="text-sm whitespace-pre-line">
                        {jobDetail?.responsibilities || app.responsibilities}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* DOKUMEN */}
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-base-content">
                    Dokumen
                  </h3>
                  <p className="text-xs text-base-content/60">
                    Berkas pendukung kandidat
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dokumenFields.map((doc) => {
                  const val = normalizeDocumentValue(app[doc.key]);
                  if (!val) return null;

                  return (
                    <div
                      key={doc.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200/40 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-base-content/60">
                          {doc.label}
                        </p>
                        <p className="max-w-[180px] truncate text-sm font-medium text-base-content">
                          {val}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openPreviewUrl(getDocumentUrl(val), val)}
                        className="btn btn-primary btn-xs rounded-lg shrink-0"
                      >
                        Lihat
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COVER LETTER */}
          {coverLetterPath && (
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-base-content">
                    Surat Lamaran
                  </h3>
                  <p className="text-xs text-base-content/60">
                    Dokumen surat lamaran kandidat
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-base-content/60">
                      File Surat Lamaran
                    </p>
                    <p className="max-w-[220px] truncate text-sm font-medium text-base-content">
                      {coverLetterPath}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openPreviewUrl(
                        getDocumentUrl(coverLetterPath),
                        coverLetterPath,
                      )
                    }
                    className="btn btn-primary btn-xs rounded-lg shrink-0"
                  >
                    Lihat
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* STATUS */}
          <div className="card bg-base-200 text-base-content border border-base-300">
            <div className="card-body text-sm">
              <h3 className="card-title text-lg text-base-content">
                Status Lamaran
              </h3>
              <div>
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(visibleStatus)}`}
                >
                  {getStatusLabel(visibleStatus)}
                </span>
              </div>
              {isFinalStatus && (
                <div className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold text-base-content/60">
                        Nilai Akhir
                      </p>
                      <p className="font-semibold text-base-content">
                        {formatScore(finalScore)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/60">
                        Hasil Wawancara
                      </p>
                      <p className="font-semibold text-base-content">
                        {formatFinalResult(finalResult)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-base-content/60">
                        Rekomendasi
                      </p>
                      <p className="font-semibold text-base-content">
                        {formatRecommendation(finalRecommendation)}
                      </p>
                    </div>
                  </div>

                  {assessmentCriteria.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase text-base-content/60">
                        Kriteria Penilaian
                      </p>
                      <div className="overflow-x-auto rounded-lg border border-base-300">
                        <table className="table table-zebra table-sm">
                          <thead>
                            <tr>
                              <th>Kriteria</th>
                              <th>Bobot</th>
                              <th>Nilai</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assessmentCriteria.map((item, index) => {
                              const criterion =
                                String(item?.criterion || "").trim() ||
                                `Kriteria ${index + 1}`;
                              const weight =
                                item?.weight_percentage ?? item?.score ?? "";
                              const achievedScore =
                                item?.achieved_score ?? item?.value ?? "-";
                              const maximumScore = item?.maximum_score || 100;

                              return (
                                <tr key={`${criterion}-${index}`}>
                                  <td className="font-medium">{criterion}</td>
                                  <td>{formatAssessmentWeight(weight)}</td>
                                  <td>
                                    {achievedScore === "-"
                                      ? "-"
                                      : `${achievedScore}/${maximumScore}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-base-content/60">
                      Catatan Interviewer
                    </p>
                    <p className="whitespace-pre-line rounded-lg bg-base-200/60 p-3 text-sm text-base-content">
                      {finalNotes || "-"}
                    </p>
                  </div>
                </div>
              )}
              <p>📅 Melamar: {formatDate(app.submitted_at)}</p>
              {app.reviewed_at && (
                <p>✔ Ditinjau: {formatDate(app.reviewed_at)}</p>
              )}
              {app.scheduled_date && (
                <p>📆 Wawancara: {formatDate(app.scheduled_date)}</p>
              )}
            </div>
          </div>
          {/* Preview Modal */}
          {previewUrl &&
            createPortal(
              <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm">
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full cursor-default"
                  onClick={closePreview}
                  aria-label="Tutup backdrop"
                />
                <div className="relative z-10 h-full overflow-y-auto p-4 md:p-8 flex items-start justify-center">
                  <div className="w-full max-w-5xl bg-base-100 rounded-2xl shadow-2xl overflow-hidden">
                    <div className="relative p-6 border-b border-base-300">
                      <button
                        type="button"
                        className="btn btn-sm btn-circle absolute right-4 top-4"
                        onClick={closePreview}
                        aria-label="Tutup preview"
                      >
                        ✕
                      </button>
                      <h3 className="font-semibold text-xl mb-1 pr-12">
                        Lampiran Lamaran
                      </h3>
                      <p className="text-sm opacity-70 truncate pr-12">
                        {previewName}
                      </p>
                    </div>

                    <div className="p-6">
                      <div className="w-full min-h-[420px] bg-base-200 rounded-lg overflow-auto flex items-center justify-center">
                        {previewIsImage ? (
                          <img
                            src={previewUrl}
                            alt={previewName}
                            style={{
                              transform: `scale(${previewScale})`,
                              transformOrigin: "center center",
                            }}
                            className="max-h-[70vh] max-w-full object-contain"
                          />
                        ) : (
                          <iframe
                            src={previewUrl}
                            title={previewName}
                            className="w-full h-[70vh] border-0"
                          />
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={zoomOut}
                          aria-label="Perkecil"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={zoomIn}
                          aria-label="Perbesar"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={resetZoom}
                          aria-label="Reset Zoom"
                        >
                          Reset
                        </button>
                        <a
                          href={previewUrl}
                          download={previewName}
                          className="btn btn-sm btn-outline"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )}
        </div>
      </div>
    </div>
  );
}
