import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../../../features/common/headerSlice";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import TitleCard from "../../../components/Cards/TitleCard";
import logo1 from "../../../assets/logo1.svg";
import html2pdf from "html2pdf.js";
import { formatDateOnly } from "../../../utils/dateUtils";

// Ambil nama user dari localStorage (atau ganti sesuai sumber user login di app Anda)
const getUserName = () => {
  // Cek localStorage, session, atau global state sesuai implementasi Anda
  // Contoh: localStorage.getItem('userName')
  // Fallback ke "HRD" jika tidak ada
  return localStorage.getItem("userName") || "HRD";
};

const HRHiredCandidateDetailModal = () => {
  const userName = getUserName();
  const dispatch = useDispatch();
  const { id } = useParams();
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState({});
  const [invitationExists, setInvitationExists] = useState(false);
  const [checkingInvitation, setCheckingInvitation] = useState(true);
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState(null);
  const [form, setForm] = useState({
    date: "",
    time: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    dispatch(setPageTitle({ title: "Buatkan Undangan Calon Pegawai" }));
    axios
      .get(`/api/interviews/${id}`)
      .then(async (res) => {
        const interviewData = res.data || {};
        setCandidate(interviewData);

        if (interviewData.candidate_id) {
          try {
            await axios.get(
              `/api/candidate-calls/last/${interviewData.candidate_id}`,
            );
            setInvitationExists(true);
          } catch {
            setInvitationExists(false);
          }
        }
      })
      .catch((err) => {
        console.error("Gagal mengambil data kandidat:", err);
        setCandidate({});
      })
      .finally(() => {
        setCheckingInvitation(false);
      });
  }, [dispatch, id]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };
  const formatTanggalIndo = (dateString) => {
    return formatDateOnly(dateString);
  };
  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
  };
  const getTodayIndo = () => {
    const bulanIndo = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    const today = new Date();
    const hari = today.getDate();
    const bulan = bulanIndo[today.getMonth()];
    const tahun = today.getFullYear();

    return `${hari} ${bulan} ${tahun}`;
  };
  const handleSendInvitation = async () => {
    if (invitationExists || sending) return;
    setNotification(null);

    if (!form.date || !form.time || !form.location) {
      setNotification({
        type: "error",
        message: "Tanggal, jam, dan lokasi wajib diisi.",
      });
      return;
    }

    const candidateId = candidate.candidate_id;
    if (!candidateId) {
      setNotification({
        type: "error",
        message:
          "ID kandidat tidak ditemukan. Silakan kembali dan buka ulang detail kandidat.",
      });
      return;
    }

    try {
      setSending(true);
      // Inject global style override agar html2canvas tidak mengambil oklch dari Tailwind
      const styleId = "pdf-global-style-override";
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = styleId;
        styleTag.innerHTML = `
    html, body, #pdf-area, #pdf-area * {
      color: #222 !important;
      background: #fff !important;
      background-color: #fff !important;
      border-color: #222 !important;
      box-shadow: none !important;
    }
  `;
        document.head.appendChild(styleTag);
      }

      const element = document.getElementById("pdf-area");

      const opt = {
        margin: 0,
        filename: `undangan_${candidateId}.pdf`,
        image: { type: "jpeg", quality: 1 },
        html2canvas: {
          scale: 3, // 🔥 biar tajam
          useCORS: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        },
      };

      // 1. Generate PDF dari HTML
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf("blob");

      // 2. Upload
      const formData = new FormData();
      formData.append("file", pdfBlob, `undangan_${candidateId}.pdf`);

      const uploadRes = await axios.post("/api/upload-invitation", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const pdfPath = uploadRes.data.path || uploadRes.data.url;

      // 3. Simpan ke DB
      await axios.post("/api/candidate-calls", {
        candidate_id: candidateId,
        call_date: form.date,
        call_time: form.time,
        call_location: form.location,
        call_notes: form.notes,
        status: "sent",
        invitation_letter_file: pdfPath,
      });

      setInvitationExists(true);
      setNotification({
        type: "success",
        message: "Undangan berhasil dikirim.",
      });
      setTimeout(() => navigate(-1), 900);
    } catch (err) {
      console.error(err);
      setNotification({
        type: "error",
        message: err.response?.data?.message || "Gagal mengirim undangan.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <TitleCard
      title={
        <span className="text-2xl font-bold">Kirim Undangan Calon Pegawai</span>
      }
      TopSideButtons={
        <button
          className="btn text-white"
          style={{
            backgroundColor: "#f97316",
            borderColor: "#ea580c",
            color: "#ffffff",
          }}
          onClick={() => navigate(-1)}
        >
          Kembali
        </button>
      }
    >
      <div className="p-6 space-y-6">
        {notification && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              notification.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {notification.message}
          </div>
        )}
        {/* INFO */}
        <div className="alert alert-info">
          Silakan isi jadwal kehadiran kandidat untuk proses onboarding.
        </div>
        {/* DATA KANDIDAT */}
        <div className="bg-base-200 p-4 rounded-xl flex items-center gap-4">
          <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border border-gray-300 bg-white">
            <img
              src={
                candidate.photo_file
                  ? candidate.photo_file.startsWith("http")
                    ? candidate.photo_file
                    : `http://localhost:5000/${candidate.photo_file.replace(/^\//, "")}`
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(candidate.name || "-")}`
              }
              alt={candidate.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="font-bold text-lg mb-1">{candidate.name || "-"}</p>
            <p className="text-gray-500 text-sm">
              {candidate.base_position && candidate.base_position.trim() !== ""
                ? `${candidate.position_name || "-"} - ${candidate.base_position}`
                : candidate.position_name || "-"}
            </p>
          </div>
        </div>
        {/* FORM */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Tanggal */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Tanggal</span>
            </label>
            <input
              type="date"
              name="date"
              className="input input-bordered"
              value={form.date}
              onChange={handleChange}
            />
          </div>

          {/* Jam */}
          <div className="form-control">
            <label className="label">
              <span className="label-text">Jam</span>
            </label>
            <input
              type="time"
              name="time"
              className="input input-bordered"
              value={form.time}
              onChange={handleChange}
            />
          </div>

          {/* Lokasi */}
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text">Lokasi</span>
            </label>
            <input
              type="text"
              name="location"
              placeholder="Contoh: Graha Pena PT Otak Kanan"
              className="input input-bordered"
              value={form.location}
              onChange={handleChange}
            />
          </div>

          {/* Catatan */}
          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text">Catatan (Opsional)</span>
            </label>
            <textarea
              name="notes"
              className="textarea textarea-bordered"
              placeholder="Contoh: Membawa dokumen asli"
              value={form.notes}
              onChange={handleChange}
            />
          </div>
        </div>
        <p style={{ fontWeight: "bold", marginBottom: 10 }}>Preview Pesan</p>
        {/* PREVIEW */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 16,
            background: "#f3f4f6",
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* A4 AREA (INI YANG DIAMBIL PDF) */}
          <div
            id="pdf-area"
            style={{
              width: "210mm",
              padding: "25mm",
              background: "#fff",
              fontFamily: "Times New Roman, serif",
              fontSize: "12pt",
              lineHeight: 1.6,
              color: "#222",
              boxSizing: "border-box",
            }}
          >
            {/* ================= KOP ================= */}
            <div
              style={{
                borderBottom: "3px solid #222",
                paddingBottom: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {/* LOGO */}
                <div
                  style={{
                    width: 190,
                    minWidth: 200,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <img src={logo1} style={{ width: 190, height: "auto" }} />
                </div>

                {/* INFO PERUSAHAAN */}
                <div style={{ flex: 1, textAlign: "left", marginLeft: 90 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      letterSpacing: 1,
                      color: "#222",
                      marginBottom: 2,
                    }}
                  >
                    PT OTAK KANAN
                  </div>
                  <div style={{ fontSize: 13, color: "#222", marginBottom: 2 }}>
                    Graha Pena Building, Lt. 15 Suite 1503
                  </div>
                  <div style={{ fontSize: 13, color: "#222", marginBottom: 2 }}>
                    Jl. Ahmad Yani No. 88, Surabaya 60234
                  </div>
                  <div style={{ fontSize: 13, color: "#222" }}>
                    Telp: (031) 8286155 | Email: info@otakkanan.co.id
                  </div>
                </div>
              </div>
            </div>

            {/* ================= TANGGAL ================= */}
            <div style={{ textAlign: "right", marginTop: 10 }}>
              <p>Surabaya, {getTodayIndo()}</p>
            </div>

            {/* ================= PEMBUKA ================= */}
            <div style={{ marginTop: 25 }}>
              <p style={{ marginBottom: 12 }}>
                {getGreeting()} {candidate.name || "-"},
              </p>

              <p style={{ textAlign: "justify", marginBottom: 12 }}>
                Selamat! Anda dinyatakan lolos seleksi. Kami mengundang{" "}
                {candidate.name || "Anda"} untuk hadir ke kantor untuk proses
                administrasi.
              </p>

              <p style={{ marginBottom: 12 }}>Berikut detail undangan Anda:</p>
            </div>

            {/* ================= DETAIL ================= */}
            <table style={{ marginBottom: 20 }}>
              <tbody>
                <tr>
                  <td style={{ width: 130 }}>Tanggal</td>
                  <td>: {formatTanggalIndo(form.date)}</td>
                </tr>
                <tr>
                  <td>Waktu</td>
                  <td>: {form.time || "-"}</td>
                </tr>
                <tr>
                  <td>Lokasi</td>
                  <td>: {form.location || "-"}</td>
                </tr>
              </tbody>
            </table>

            {/* ================= PENUTUP ================= */}
            <div>
              <p style={{ textAlign: "justify", marginBottom: 12 }}>
                Mohon untuk membawa dokumen fisik yang sebelumnya telah Anda
                unggah melalui sistem sebagai bahan verifikasi.
                {form.notes ? ` ${form.notes}` : ""}
              </p>

              <p style={{ textAlign: "justify", marginBottom: 12 }}>
                Demikian undangan ini kami sampaikan. Mohon konfirmasi kehadiran
                Anda.
              </p>

              <p>Terima kasih.</p>
            </div>

            {/* ================= TTD ================= */}
            <div style={{ marginTop: 30, textAlign: "left" }}>
              <div
                style={{
                  display: "block",
                  width: "220px",
                  marginLeft: "auto",
                  marginRight: 0,
                  textAlign: "center",
                }}
              >
                <p style={{ marginBottom: 30 }}>Hormat kami,</p>
                <p style={{ fontWeight: "bold", marginBottom: 0 }}>
                  {userName || ""}
                </p>
                <p style={{ marginTop: 0 }}>HRD PT OTAK KANAN</p>
              </div>
            </div>
          </div>
        </div>{" "}
      </div>

      {/* ACTION */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 24,
        }}
      >
        <button
          style={{
            border: "1px solid #bbb",
            background: "white",
            padding: "8px 24px",
            borderRadius: 8,
            cursor: "pointer",
          }}
          onClick={() => navigate(-1)}
        >
          Batal
        </button>

        <button
          style={{
            background: "#22c55e",
            color: "white",
            padding: "8px 24px",
            borderRadius: 8,
            cursor:
              checkingInvitation || invitationExists || sending
                ? "not-allowed"
                : "pointer",
            opacity:
              checkingInvitation || invitationExists || sending ? 0.6 : 1,
            border: "none",
          }}
          disabled={checkingInvitation || invitationExists || sending}
          onClick={handleSendInvitation}
        >
          {invitationExists
            ? "Undangan Sudah Dibuat"
            : sending
              ? "Mengirim..."
              : "Kirim"}
        </button>
      </div>
    </TitleCard>
  );
};

export default HRHiredCandidateDetailModal;
