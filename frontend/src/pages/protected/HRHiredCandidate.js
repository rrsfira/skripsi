import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import axios from "axios";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import { useNavigate } from "react-router-dom";

const HRHiredCandidate = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onboardingStatus, setOnboardingStatus] = useState({});

  useEffect(() => {
    dispatch(setPageTitle({ title: "Daftar Kandidat Yang Lolos" }));
    axios
      .get("/api/interviews?status=passed")
      .then(async (res) => {
        const candidatesData = res.data || [];
        setCandidates(candidatesData);
        // Ambil status onboarding untuk setiap kandidat
        const statusObj = {};
        await Promise.all(
          candidatesData.map(async (c) => {
            try {
              const candidateId = c.candidate_id || c.id || c._id;
              if (!candidateId) return;
              const resp = await axios.get(`/api/candidate-calls/${candidateId}`);
              statusObj[candidateId] = resp.data.status || "Belum dibuat";
            } catch (e) {
              const candidateId = c.candidate_id || c.id || c._id;
              statusObj[candidateId] = "Belum dibuat";
            }
          })
        );
        setOnboardingStatus(statusObj);
        setLoading(false);
      })
      .catch((err) => {
        setError("Gagal memuat data kandidat.");
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Memuat data kandidat...</div>;
  if (error) return <div>{error}</div>;

  return (
    <TitleCard title="Daftar Kandidat yang Lolos">
      <div className="p-4">
        <div className="mb-4 text-sm text-gray-600">
          Kandidat yang telah lolos seleksi dapat dipanggil untuk mengikuti
          proses onboarding. Klik <span className="font-semibold">Detail</span>{" "}
          untuk melihat informasi lengkap dan mengirim undangan.
        </div>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            placeholder="Cari kandidat..."
            className="input input-bordered input-sm w-64"
            onChange={(e) => {
              const keyword = e.target.value.toLowerCase();
              const filtered = (candidates || []).filter((c) =>
                (c.name || "").toLowerCase().includes(keyword),
              );
              setCandidates(filtered);
            }}
          />
        </div>

        {/* Empty State */}
        {candidates.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Tidak ada kandidat yang diterima.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-zebra w-full">
              {/* Head */}
              <thead className="text-center">
                <tr>
                  <th>No</th>
                  <th>Nama</th>
                  <th>Posisi</th>
                  <th>Tanggal Interview</th>
                  <th>Status Surat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              {/* Body */}
              <tbody>
                {candidates.map((c, idx) => (
                  <tr key={c._id || idx}>
                    <td className="text-center">{idx + 1}</td>
                    {/* Name + Photo */}
                    <td>
                      <div className="flex items-center gap-3">
                        <img
                          src={(() => {
                            const photo = c.photo_file || "";
                            if (
                              photo &&
                              photo !== "-" &&
                              photo !== "null" &&
                              photo !== null &&
                              photo !== undefined &&
                              photo !== ""
                            ) {
                              return photo.startsWith("http")
                                ? photo
                                : `http://localhost:5000/${photo.replace(/^\//, "")}`;
                            }
                            // Fallback ke nama
                            const name = c.name || "-";
                            return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                          })()}
                          alt={c.name}
                          className="w-10 h-10 rounded-md object-cover border"
                        />
                        <span className="font-bold text-blue-700 text-base cursor-pointer hover:underline">
                          {c.name || "-"}
                        </span>
                      </div>
                    </td>
                    {/* Position */}
                    <td>
                      {c.base_position && c.base_position.trim() !== ""
                        ? `${c.position_name || "-"} - ${c.base_position}`
                        : c.position_name || "-"}
                    </td>
                    {/* Interview Date */}
                    <td className="text-center">
                      {c.scheduled_date
                        ? new Date(c.scheduled_date).toLocaleDateString(
                            "id-ID",
                            { year: "numeric", month: "long", day: "numeric" },
                          )
                        : "-"}
                    </td>
                    <td className="text-center">
                      {(() => {
                        const candidateId = c.candidate_id || c.id || c._id;
                        const status = onboardingStatus[candidateId] || "Belum dibuat";
                        if (status === "Belum dibuat") {
                          return <span className="badge badge-secondary">Belum dibuat</span>;
                        }
                        // Bisa tambahkan badge warna lain sesuai status
                        if (status === "sent") {
                          return <span className="badge badge-info">Undangan Dikirim</span>;
                        }
                        if (status === "accepted") {
                          return <span className="badge badge-success">Diterima Onboarding</span>;
                        }
                        if (status === "rejected") {
                          return <span className="badge badge-error">Menolak Onboarding</span>;
                        }
                        return <span className="badge badge-outline">{status}</span>;
                      })()}
                    </td>

                    <td className="text-center">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() =>
                          navigate(`/app/Hire-candidates/${c.id || c._id}`)
                        }
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
      </div>
    </TitleCard>
  );
};

export default HRHiredCandidate;
