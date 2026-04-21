import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";

export default function CandidateJobDetailPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/job-openings/${jobId}`);
        setJob(res.data?.job || null);
      } catch (err) {
        setError("Gagal mengambil detail lowongan.");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);
  if (loading) return <div className="p-10 text-center">Memuat...</div>;
  if (error)
    return <div className="p-10 text-center text-red-600">{error}</div>;
  if (!job)
    return <div className="p-10 text-center">Lowongan tidak ditemukan.</div>;

  const salaryMin = job.salary_range_min
    ? parseInt(job.salary_range_min).toLocaleString("id-ID")
    : null;

  const salaryMax = job.salary_range_max
    ? parseInt(job.salary_range_max).toLocaleString("id-ID")
    : null;

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      {/* HERO HEADER */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 text-white py-12 shadow">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-3xl font-bold mb-2">
            {job.title || job.position_name}
          </h1>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-6 -mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* LEFT */}
          <div className="lg:col-span-2 space-y-6">

            {/* INFO */}
            <div className="card bg-white shadow-lg border">
              <div className="card-body">
                <h2 className="font-bold text-lg mb-4">Informasi Pekerjaan</h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">

                  <div>
                    <p className="text-gray-500">Lokasi</p>
                    <p className="font-semibold">{job.location || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Deadline</p>
                    <p className="font-semibold">
                      {job.deadline
                        ? new Date(job.deadline).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Kuota</p>
                    <p className="font-semibold">{job.quota || "-"}</p>
                  </div>

                  <div>
                    <p className="text-gray-500">Bidang</p>
                    <p className="font-semibold">
                      {job.department_name || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Jenis Pekerjaan</p>
                    <p className="font-semibold">
                      {job.employment_type || job.position_type || "-"}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500">Kisaran Gaji</p>
                    <p className="font-semibold">
                      {salaryMin && salaryMax
                        ? `Rp ${salaryMin} - Rp ${salaryMax}`
                        : "Dirahasiakan"}
                    </p>
                  </div>

                </div>
              </div>
            </div>

            {/* DESKRIPSI */}
            <div className="card bg-white shadow border">
              <div className="card-body">
                <h2 className="text-xl font-bold mb-3">Deskripsi Pekerjaan</h2>
                <p className="text-gray-700 whitespace-pre-line">
                  {job.description || "-"}
                </p>
              </div>
            </div>

            {/* REQUIREMENT */}
            <div className="card bg-white shadow border">
              <div className="card-body">
                <h2 className="text-xl font-bold mb-3">Persyaratan</h2>
                <p className="text-gray-700 whitespace-pre-line">
                  {job.requirements || "-"}
                </p>
              </div>
            </div>

            {/* RESPONSIBILITY */}
            <div className="card bg-white shadow border">
              <div className="card-body">
                <h2 className="text-xl font-bold mb-3">Tanggung Jawab</h2>
                <p className="text-gray-700 whitespace-pre-line">
                  {job.responsibilities || "-"}
                </p>
              </div>
            </div>

          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">

            <div className="card bg-white shadow-lg border sticky top-24">
              <div className="card-body">
                <h3 className="font-bold text-lg">Status Lowongan</h3>

                <p className="text-sm mt-2">
                  <span className="text-gray-500">Deadline</span>
                  <br />
                  {job.deadline
                    ? new Date(job.deadline).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </p>

                <p className="text-sm">
                  <span className="text-gray-500">Sisa Kuota</span>
                  <br />
                  {job.quota || "-"}
                </p>

                <button
                  className="btn w-full text-white border-none mt-4"
                  style={{ background: "#F58220" }}
                  onClick={() => {
                    if (!token) {
                      navigate("/login");
                    } else {
                      navigate(`/candidate/apply/${job.id}`);
                    }
                  }}
                >
                  Lamar Sekarang
                </button>
              </div>
            </div>

            <div className="card bg-white shadow border">
              <div className="card-body">
                <h3 className="font-bold">Informasi Rekrutmen</h3>
                <ul className="text-sm text-gray-600 list-disc ml-4 mt-2 space-y-1">
                  <li>Pastikan data profil sudah lengkap</li>
                  <li>Periksa kembali CV sebelum mengirim lamaran</li>
                  <li>Pelamar yang lolos akan dihubungi oleh HRD</li>
                </ul>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}