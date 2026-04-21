import React, { useEffect, useState } from "react";
import axios from "axios";

export default function ApplicationDetailModal({
  isOpen,
  onClose,
  app,
}) {
  const [jobDetail, setJobDetail] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const jobOpeningId =
    app?.job_opening_id || app?.job_openingId || app?.job_id || app?.jobId;

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

  // Progress bar: jika withdrawn, hanya tampil satu step "Dibatalkan"
  let steps, currentStep;
  if (app.status === 'withdrawn') {
    steps = ['withdrawn'];
    currentStep = 0;
  } else {
    // Samakan urutan dan value steps progress dengan status lamaran utama
    let statusForStep = app.status;
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
    { key: "ijazah_file", label: "Ijazah" },
    { key: "transcript_file", label: "Transkrip Nilai" },
    { key: "certificate_file", label: "Sertifikat" },
    { key: "ktp_file", label: "KTP" },
    { key: "photo_file", label: "Foto Diri" },
  ];

  function getDocumentUrl(path) {
    if (!path) return "#";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/uploads")) return `http://localhost:5000${path}`;
    if (path.startsWith("uploads/")) return `http://localhost:5000/${path}`;
    return path;
  }

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
          <button className="btn btn-sm btn-ghost text-base-content hover:bg-base-200" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* PROGRESS */}
        <div className="px-6 pt-4">
          <div className="flex items-center w-full">
            {steps[0] === 'withdrawn' ? (
              <div className="flex flex-col items-center w-full">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 bg-red-500 text-white border-red-500">
                  1
                </div>
                <p className="text-xs mt-2 capitalize opacity-90 text-red-600 font-medium text-center" style={{ minWidth: 70 }}>
                  Dibatalkan
                </p>
              </div>
            ) : (
              steps.map((step, i) => {
                // Warna step: sudah lewat = oranye, aktif = biru, belum = abu
                let circleClass = '';
                if (i < currentStep) {
                  circleClass = 'bg-orange-500 text-white border-orange-500';
                } else if (i === currentStep) {
                  circleClass = 'bg-blue-500 text-white border-blue-500';
                } else {
                  circleClass = 'bg-gray-100 text-gray-400 border-gray-300';
                }
                return (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center relative" style={{ minWidth: 80 }}>
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all duration-200 ${circleClass}`}
                      >
                        {i + 1}
                      </div>
                      <p className="text-xs mt-2 capitalize opacity-90 text-base-content font-medium text-center" style={{ minWidth: 70 }}>
                        {(() => {
                          const map = {
                            submitted: "Terkirim",
                            screening: "Review",
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
                              ? '#f97316'
                              : i === currentStep - 1
                              ? '#3b82f6'
                              : '#e5e7eb',
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
              <h3 className="card-title text-lg text-base-content">Data Diri Lengkap</h3>
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
              <h3 className="card-title text-lg text-base-content">Lowongan yang Dilamar</h3>
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
                        {jobDetail?.deadline
                          ? new Date(jobDetail.deadline).toLocaleDateString(
                              "id-ID",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )
                          : app.deadline
                            ? new Date(app.deadline).toLocaleDateString(
                                "id-ID",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )
                            : "-"}
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
          <div className="card bg-base-200 text-base-content border border-base-300">
            <div className="card-body">
              <h3 className="card-title text-lg text-base-content">📄 Dokumen</h3>

              <div className="divide-y divide-base-300 border border-base-300 rounded-lg overflow-hidden">
                {dokumenFields.map((doc, idx) => {
                  const val = app[doc.key];
                  if (!val) return null;

                  return (
                    <div
                      key={doc.key}
                      className={`flex justify-between items-center px-4 py-3 ${
                        idx % 2 === 0 ? "bg-base-100" : ""
                      }`}
                    >
                      <div>
                        <p className="text-xs text-base-content/70 font-semibold">
                          {doc.label}
                        </p>
                        <p className="font-semibold break-all text-base-content">{val}</p>
                      </div>

                      <a
                        href={getDocumentUrl(val)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-xs btn-outline border-base-300 text-base-content hover:bg-base-300"
                      >
                        Lihat
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COVER LETTER */}
          {app.cover_letter && (
            <div className="card bg-base-200 text-base-content border border-base-300">
              <div className="card-body">
                <h3 className="card-title text-lg text-base-content">💌 Surat Lamaran</h3>
                <div className="bg-base-100 p-4 rounded border border-base-300 text-sm whitespace-pre-line text-base-content">
                  {app.cover_letter}
                </div>
              </div>
            </div>
          )}

          {/* STATUS */}
          <div className="card bg-base-200 text-base-content border border-base-300">
            <div className="card-body text-sm">
              <h3 className="card-title text-lg text-base-content">Status Lamaran</h3>
              <p>📌 {app.status === 'withdrawn' ? 'Dibatalkan' : app.status}</p>
              <p>📅 Apply: {formatDate(app.submitted_at)}</p>
              {app.reviewed_at && (
                <p>✔ Review: {formatDate(app.reviewed_at)}</p>
              )}
              {app.scheduled_date && (
                <p>📆 Interview: {formatDate(app.scheduled_date)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
