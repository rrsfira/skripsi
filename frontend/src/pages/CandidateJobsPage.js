import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setPageTitle } from "../features/common/headerSlice";
import api from "../lib/api";
import { motion } from "framer-motion";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

// Fungsi untuk menampilkan waktu relatif (misal: '2 jam lalu')
function timeAgo(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} bulan lalu`;
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} tahun lalu`;
}

export default function CandidateJobsPage() {
  const dispatch = useDispatch();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    dispatch(setPageTitle({ title: 'Lowongan Pekerjaan' }));
  }, [dispatch]);

  useEffect(() => {
    setLoading(true);

    api
      .get("/job-openings")
      .then((res) => {
        setJobs(res.data.jobs || []);
      })
      .catch(() => {
        setError("Gagal mengambil data lowongan.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleApply = (jobId) => {
    const token = localStorage.getItem("token");

    if (!token) {
      navigate("/login");
    } else {
      navigate(`/candidate/apply/${jobId}`);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    const q = search.toLowerCase();

    return (
      (job.position_name || "").toLowerCase().includes(q) ||
      (job.department_name || "").toLowerCase().includes(q) ||
      (job.description || "").toLowerCase().includes(q)
    );
  });

  const cardVariant = {
    hidden: {
      opacity: 0,
      y: 50,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
      },
    },
  };

  return (
    <div className="bg-base-200 min-h-screen">
      {/* NAVBAR */}
      <div className="navbar bg-base-100 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo2.svg"
              alt="Otak Kanan Logo"
              className="h-12 w-auto object-contain"
            />

            <span className="font-bold text-xl text-primary leading-none">
              PT Otak Kanan Careers
            </span>
          </div>

          <div className="flex gap-3">
            <Link to="/login?role=kandidat" className="btn btn-primary btn-sm">
              Login
            </Link>

            <Link to="/register?role=kandidat" className="btn btn-outline btn-primary btn-sm">
              Daftar
            </Link>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section
        className="hero relative overflow-hidden text-white py-28
bg-gradient-to-r from-[#F58220] via-orange-500 to-yellow-400
animate-gradient"
      >
        {/* overlay glow */}
        <div className="absolute w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl -top-32 -left-32"></div>
        <div className="absolute w-[400px] h-[400px] bg-yellow-300/20 rounded-full blur-3xl top-20 right-[-120px]"></div>

        <div className="hero-content text-center flex-col relative z-10">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Temukan Karier Impianmu
          </h1>

          <p className="opacity-90 max-w-xl mb-10 text-lg">
            Bergabunglah dengan tim terbaik di PT Otak Kanan dan bangun masa
            depan kariermu bersama kami.
          </p>

          <input
            type="text"
            placeholder="Cari posisi, departemen..."
            className="input input-bordered w-full max-w-xl text-black shadow-2xl rounded-full px-6 h-14"
          />
        </div>
      </section>

      {/* WARNING FRAUD */}
      <section className="container mx-auto px-5 py-6">
        <div className="alert bg-yellow-50 border border-yellow-200 text-yellow-800 shadow">
          <div>
            <h3 className="font-bold">⚠ Peringatan Penipuan Rekrutmen</h3>

            <div className="text-sm">
              PT Otak Kanan tidak pernah meminta biaya apapun dalam proses
              rekrutmen. Semua informasi lowongan hanya tersedia melalui website
              resmi perusahaan.
            </div>
          </div>
        </div>
      </section>

      {/* JOB LIST   */}
      <section className="pt-6 pb-16 bg-[#F5F5F5]">
        <div className="container mx-auto px-4">
          {/* KOTAK BESAR */}
          <div className="bg-[#F58220] rounded-3xl p-10 lg:p-14 relative overflow-hidden">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* LEFT TEXT */}
              <div className="text-white max-w-lg">
                <h2 className="text-4xl font-bold mb-4">
                  Lowongan kerja yang tersedia
                </h2>

                <p className="opacity-90 mb-6">
                  Temukan lowongan pekerjaan teratas yang banyak dilamar oleh
                  para pencari kerja.
                </p>

                {/* ARROW */}
                <div className="flex gap-3 mt-8">
                  <button className="btn btn-circle bg-white text-[#F58220] border-none">
                    ❮
                  </button>

                  <button className="btn btn-circle bg-white text-[#F58220] border-none">
                    ❯
                  </button>
                </div>
              </div>

              {/* RIGHT CARD SLIDER */}
              <div className="flex gap-6 overflow-x-auto scroll-smooth pb-4">
                {jobs.slice(0, 6).map((job) => (
                  <div
                    key={job.id}
                    className="min-w-[260px] bg-white rounded-2xl shadow-lg p-5 hover:-translate-y-1 hover:shadow-2xl transition duration-300"
                  >
                    {/* Logo + time */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>

                      <span className="text-xs text-gray-400">{timeAgo(job.created_at)}</span>
                    </div>

                    {/* Job Title */}
                    <h3 className="font-bold text-[#333333] mb-1 line-clamp-2">
                      {job.title}
                    </h3>

                    {/* Company */}
                    <div className="text-sm text-gray-600 mb-2">
                      {job.position_name}
                    </div>

                    {/* Location */}
                    <div className="text-xs text-gray-500 mb-3">
                      📍 {job.location}
                    </div>

                    {/* Salary */}
                    <div className="text-sm font-semibold text-[#333333]">
                      Kisaran Gaji
                    </div>

                    <div className="text-sm text-gray-500 mb-3">
                      {job.salary_range_min && job.salary_range_max
                        ? `Rp ${parseInt(job.salary_range_min).toLocaleString('id-ID')} - Rp ${parseInt(job.salary_range_max).toLocaleString('id-ID')}`
                        : 'Dirahasiakan'}
                    </div>

                    {/* Deadline */}
                    <div className="text-xs text-gray-400 mb-4">
                      Lamar sebelum {job.deadline ? new Date(job.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                    </div>

                    <button
                      className="btn w-full text-white border-none"
                      style={{ background: "#F58220" }}
                      onClick={() => navigate(`/candidate/jobs/${job.id}`)}
                    >
                      Selengkapnya
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ABOUT COMPANY */}
      <section className="bg-base-100 py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <img src="/Desain tanpa judul (2).svg" />

          <div>
            <h2 className="text-3xl font-bold text-primary mb-4">
              Tentang PT Otak Kanan
            </h2>

            <p className="opacity-80 mb-4">
              PT Otak Kanan merupakan perusahaan yang berfokus pada pengembangan
              solusi teknologi dan inovasi digital untuk membantu bisnis
              berkembang lebih cepat.
            </p>

            <p className="opacity-80">
              Kami percaya bahwa talenta terbaik adalah kunci keberhasilan
              perusahaan. Bergabunglah bersama kami untuk membangun masa depan
              teknologi yang lebih baik.
            </p>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-base-200 py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          {/* LEFT CONTENT */}
          <div>
            <h2 className="text-4xl font-bold mb-4 text-[#333333]">
              Kenapa Bergabung Dengan Kami
            </h2>

            {/* ITEM 1 */}
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-primary/10 text-primary p-3 rounded-full text-xl">
                🤝
              </div>

              <div>
                <h3 className="font-semibold text-lg">
                  Lingkungan Kerja Kolaboratif
                </h3>

                <p className="text-gray-500 text-sm">
                  Kami membangun budaya kerja yang terbuka, saling mendukung,
                  dan mendorong inovasi bersama tim profesional.
                </p>
              </div>
            </div>

            {/* ITEM 2 */}
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-primary/10 text-primary p-3 rounded-full text-xl">
                🚀
              </div>

              <div>
                <h3 className="font-semibold text-lg">Pengembangan Karir</h3>

                <p className="text-gray-500 text-sm">
                  Kami menyediakan kesempatan belajar, pelatihan, dan pengalaman
                  proyek nyata untuk meningkatkan kemampuan Anda.
                </p>
              </div>
            </div>

            {/* ITEM 3 */}
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 text-primary p-3 rounded-full text-xl">
                💼
              </div>

              <div>
                <h3 className="font-semibold text-lg">Benefit Kompetitif</h3>

                <p className="text-gray-500 text-sm">
                  Kami menawarkan kompensasi dan fasilitas kerja yang kompetitif
                  untuk mendukung kesejahteraan tim.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT IMAGE */}
          <div className="relative flex justify-center items-center">
            {/* glow belakang */}
            <div className="absolute w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>

            {/* shape kecil */}
            <div className="absolute -top-8 right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>

            <div className="absolute bottom-0 -left-10 w-40 h-40 bg-orange-200/40 rounded-full blur-2xl"></div>

            {/* gambar */}
            <img
              src="/team.svg"
              alt="Team Otak Kanan"
              className="relative z-10 max-w-md w-full drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="bg-base-100 py-20">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm tracking-widest text-primary font-semibold mb-2">
            LAYANAN KAMI
          </p>

          <h2 className="text-3xl font-bold text-[#333333] mb-4">
            UNTUK MEMBANTU SOLUSI DIGITAL
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 1 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">💻</div>
                <h3 className="font-bold">Web Development</h3>
                <p className="text-sm opacity-80">
                  Pembuatan website profesional untuk company profile dan bisnis
                  Anda.
                </p>
              </div>
            </motion.div>

            {/* 2 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">📱</div>
                <h3 className="font-bold">Mobile Apps Development</h3>
                <p className="text-sm opacity-80">
                  Pengembangan aplikasi mobile Android dan iOS untuk kebutuhan
                  bisnis.
                </p>
              </div>
            </motion.div>

            {/* 3 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">🎨</div>
                <h3 className="font-bold">Design & Multimedia</h3>
                <p className="text-sm opacity-80">
                  Desain grafis, logo, company profile, dan pembuatan video
                  multimedia.
                </p>
              </div>
            </motion.div>

            {/* 4 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">📈</div>
                <h3 className="font-bold">Digital Marketing</h3>
                <p className="text-sm opacity-80">
                  Strategi pemasaran digital untuk meningkatkan penjualan bisnis
                  Anda.
                </p>
              </div>
            </motion.div>

            {/* 5 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">🏢</div>
                <h3 className="font-bold">Digital Agency</h3>
                <p className="text-sm opacity-80">
                  Konsultasi dan strategi digital untuk pengembangan bisnis
                  Anda.
                </p>
              </div>
            </motion.div>

            {/* 6 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">🎓</div>
                <h3 className="font-bold">Education & Training</h3>
                <p className="text-sm opacity-80">
                  Program pelatihan teknologi dan digital untuk pengembangan
                  SDM.
                </p>
              </div>
            </motion.div>

            {/* 7 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">📰</div>
                <h3 className="font-bold">Online Media</h3>
                <p className="text-sm opacity-80">
                  Membantu bisnis menyampaikan informasi melalui media digital.
                </p>
              </div>
            </motion.div>

            {/* 8 */}
            <motion.div
              variants={cardVariant}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="card bg-base-100 shadow hover:shadow-xl transition"
            >
              <div className="card-body text-center">
                <div className="text-4xl text-primary">⚙️</div>
                <h3 className="font-bold">Digital Product</h3>
                <p className="text-sm opacity-80">
                  Penyediaan berbagai produk digital untuk kebutuhan bisnis
                  modern.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
