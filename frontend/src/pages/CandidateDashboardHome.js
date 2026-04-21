import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../features/common/headerSlice";
import TitleCard from "../components/Cards/TitleCard";
import { getCandidateDashboardStats } from "../utils/candidateDashboard";
import { getCandidateProfile } from "../utils/candidateProfile";
import axios from "axios";

export default function CandidateDashboardHome() {
  const dispatch = useDispatch();
  const [profile, setProfile] = useState(null);
  const [candidateCall, setCandidateCall] = useState(null);

  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    accepted: 0,
    rejected: 0,
    latest: [],
  });

  useEffect(() => {
    dispatch(setPageTitle({ title: "Beranda" }));
    getCandidateDashboardStats().then(setStats);
    getCandidateProfile().then(setProfile);
    // Cek apakah ada undangan candidate_calls
    axios
      .get("/api/candidate-calls/me")
      .then((res) => {
        if (res.data && res.data.id) setCandidateCall(res.data);
      })
      .catch(() => {});
  }, [dispatch]);

  const invitationLetterUrl = candidateCall?.invitation_letter_file
    ? candidateCall.invitation_letter_file.startsWith("http")
      ? candidateCall.invitation_letter_file
      : `http://localhost:5000/${candidateCall.invitation_letter_file.replace(/^\//, "")}`
    : "";

  return (
    <div>
      {/* STATISTIK */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <TitleCard title="Total Permohonan" topMargin="mt-0">
          <div className="text-3xl font-bold">{stats.total}</div>
        </TitleCard>

        <TitleCard title="Sedang Diproses" topMargin="mt-0">
          <div className="text-3xl font-bold">{stats.inProgress} posisi</div>
        </TitleCard>

        <TitleCard title="Diterima" topMargin="mt-0">
          <div className="text-3xl font-bold text-success">
            {stats.accepted} posisi
          </div>
        </TitleCard>

        <TitleCard title="Ditolak" topMargin="mt-0">
          <div className="text-3xl font-bold text-error">
            {stats.rejected} posisi
          </div>
        </TitleCard>
      </div>

      {/* UNDIVAN ONBOARDING */}
      {candidateCall && (
        <TitleCard
          title="Selamat! Anda Mendapatkan Undangan Onboarding"
          topMargin="mt-4"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-success mb-2">
                Selamat, Anda diundang untuk proses onboarding!
              </div>
              <div className="text-sm text-gray-600 mb-2">
                Silakan unduh surat undangan onboarding Anda pada tombol di
                samping.
              </div>
            </div>
            <a
              href={invitationLetterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              Lihat Surat
            </a>
          </div>
        </TitleCard>
      )}

      {/* GRID UTAMA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-1">
        {/* STATUS PERMOHONAN */}
        <div className="lg:col-span-2">
          <TitleCard title="Status Permohonan Terbaru">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Posisi</th>
                    <th>Tipe Pegawai</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {stats.latest.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-gray-400">
                        Belum ada data aplikasi
                      </td>
                    </tr>
                  ) : (
                    stats.latest.map((app, idx) => (
                      <tr key={idx}>
                        <td>{app.position_name}</td>
                        <td>
                          {app.employment_type === "permanent" &&
                            "Pegawai Tetap"}
                          {app.employment_type === "contract" && "Kontrak"}
                          {app.employment_type === "internship" && "Magang"}
                          {app.employment_type === "freelance" && "Freelance"}
                          {![
                            "permanent",
                            "contract",
                            "internship",
                            "freelance",
                          ].includes(app.employment_type) &&
                            (app.employment_type || "-")}
                        </td>
                        <td>
                          {app.status === "diterima" && (
                            <span className="badge badge-success">
                              Diterima
                            </span>
                          )}
                          {app.status === "ditolak" && (
                            <span className="badge badge-error">Ditolak</span>
                          )}
                          {app.status === "withdrawn" && (
                            <span className="badge badge-neutral">
                              Dibatalkan
                            </span>
                          )}
                          {app.status === "wawancara" && (
                            <span className="badge badge-info">Wawancara</span>
                          )}
                          {app.status === "screening" && (
                            <span className="badge badge-accent">
                              Dalam Proses
                            </span>
                          )}
                          {app.status === "submitted" && (
                            <span className="badge badge-warning">
                              Data Dikirim
                            </span>
                          )}
                          {![
                            "diterima",
                            "ditolak",
                            "withdrawn",
                            "wawancara",
                            "screening",
                            "submitted",
                          ].includes(app.status) && (
                            <span className="badge">{app.status}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TitleCard>

          <TitleCard title="Cek Data Diri & Dokumen">
            {profile ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                {/* ITEM */}
                {[
                  { label: "Nama", value: profile.name },
                  { label: "Email", value: profile.email },
                  { label: "No. HP", value: profile.phone },
                  { label: "Jenis Kelamin", value: profile.gender },
                  { label: "Tempat Lahir", value: profile.birth_place },
                  { label: "Tanggal Lahir", value: profile.date_of_birth },
                  { label: "Status Pernikahan", value: profile.marital_status },
                  { label: "Kewarganegaraan", value: profile.nationality },
                  { label: "NIK", value: profile.nik },
                  { label: "NPWP", value: profile.npwp },
                  {
                    label: "Pendidikan",
                    value: `${profile.education_level || "-"} ${profile.university ? `- ${profile.university}` : ""}`,
                  },
                  { label: "Jurusan", value: profile.major },
                  { label: "Tahun Lulus", value: profile.graduation_year },
                  {
                    label: "Gaji Diharapkan",
                    value: profile.expected_salary
                      ? `Rp${Number(profile.expected_salary).toLocaleString("id-ID")}`
                      : "-",
                  },
                ].map((item, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="font-medium">{item.value || "-"}</span>
                  </div>
                ))}

                {/* FULL WIDTH */}
                <div className="md:col-span-2 flex flex-col">
                  <span className="text-xs text-gray-500">Alamat</span>
                  <span className="font-medium">{profile.address || "-"}</span>
                </div>

                {/* LINK */}
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">LinkedIn</span>
                  {profile.linkedin ? (
                    <a
                      href={profile.linkedin}
                      target="_blank"
                      className="link link-primary"
                    >
                      Lihat Profil
                    </a>
                  ) : (
                    "-"
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-xs text-gray-500">Portfolio</span>
                  {profile.portfolio ? (
                    <a
                      href={profile.portfolio}
                      target="_blank"
                      className="link link-primary"
                    >
                      Lihat Portfolio
                    </a>
                  ) : (
                    "-"
                  )}
                </div>
              </div>
            ) : (
              <p className="opacity-70 text-sm">Memuat data profil...</p>
            )}
          </TitleCard>
        </div>

        {/* GRAFIK */}
        <div>
          <TitleCard title="Grafik Progres Permohonan">
            <div className="flex justify-center gap-4 py-6">
              <div className="flex flex-col items-center">
                <div
                  className="radial-progress text-primary"
                  style={{
                    "--value": stats.total
                      ? Math.round((stats.inProgress / stats.total) * 100)
                      : 0,
                  }}
                >
                  {stats.total
                    ? Math.round((stats.inProgress / stats.total) * 100)
                    : 0}
                  %
                </div>
                <span className="text-xs mt-1">Diproses</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="radial-progress text-success"
                  style={{
                    "--value": stats.total
                      ? Math.round((stats.accepted / stats.total) * 100)
                      : 0,
                  }}
                >
                  {stats.total
                    ? Math.round((stats.accepted / stats.total) * 100)
                    : 0}
                  %
                </div>
                <span className="text-xs mt-1">Diterima</span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="radial-progress text-error"
                  style={{
                    "--value": stats.total
                      ? Math.round((stats.rejected / stats.total) * 100)
                      : 0,
                  }}
                >
                  {stats.total
                    ? Math.round((stats.rejected / stats.total) * 100)
                    : 0}
                  %
                </div>
                <span className="text-xs mt-1">Ditolak</span>
              </div>
            </div>
          </TitleCard>

          <TitleCard title="Timeline Proses Rekrutmen">
            {(() => {
              // Step mapping
              const steps = [
                { key: "submitted", label: "Kirim Lamaran" },
                { key: "screening", label: "Screening" },
                { key: "wawancara", label: "Interview" },
                { key: "diterima", label: "Diterima" },
                { key: "ditolak", label: "Ditolak" },
                { key: "withdrawn", label: "Dibatalkan" },
              ];
              // Hitung jumlah aplikasi di setiap step
              const stepCounts = steps.map(
                (step) =>
                  stats.latest.filter((app) => app.status === step.key).length,
              );
              // Tampilkan timeline, highlight step jika ada aplikasi di step tsb
              return (
                <ul className="timeline timeline-vertical">
                  {steps.map((step, idx) => (
                    <li key={step.key}>
                      <div
                        className={
                          "timeline-start " +
                          (stepCounts[idx] > 0 ? "font-bold text-primary" : "")
                        }
                      >
                        {step.label}
                        {stepCounts[idx] > 0 && (
                          <span className="badge badge-sm badge-primary ml-2 align-middle">
                            {stepCounts[idx]}
                          </span>
                        )}
                      </div>
                      <div
                        className={
                          "timeline-middle " +
                          (stepCounts[idx] > 0 ? "text-primary" : "")
                        }
                      >
                        ●
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </TitleCard>
        </div>
      </div>
    </div>
  );
}
