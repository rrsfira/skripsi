import { Link } from "react-router-dom";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
  Users,
  WalletCards,
} from "lucide-react";

const roleCards = [
  {
    title: "Pegawai",
    text: "Presensi, cuti, reimbursement, slip gaji, dan profil pribadi.",
    icon: UserCheck,
  },
  {
    title: "Admin",
    text: "Kelola pengguna, pegawai, jabatan, departemen, dan log aktivitas.",
    icon: ShieldCheck,
  },
  {
    title: "HR",
    text: "Rekrutmen, data pegawai, presensi, izin, dan validasi operasional.",
    icon: Users,
  },
  {
    title: "Atasan",
    text: "Pantau tim, proses persetujuan, dan rekap kehadiran anggota.",
    icon: ClipboardCheck,
  },
  {
    title: "Finance",
    text: "Payroll, reimbursement, banding gaji, transfer, dan laporan.",
    icon: Banknote,
  },
];

const featureCards = [
  {
    title: "Dashboard Sesuai Role",
    text: "Setiap pengguna melihat menu dan ringkasan kerja sesuai hak aksesnya.",
    icon: LayoutDashboard,
  },
  {
    title: "Presensi & Izin",
    text: "Aktivitas kehadiran, cuti, izin terlambat, dan riwayat bisa dipantau rapi.",
    icon: CalendarCheck,
  },
  {
    title: "Payroll Terintegrasi",
    text: "Slip gaji, komponen, banding, dan proses pembayaran dikelola dalam satu portal.",
    icon: WalletCards,
  },
  {
    title: "Dokumen & Approval",
    text: "Pengajuan dan validasi berjalan lebih jelas dengan status yang mudah dicek.",
    icon: FileText,
  },
];

function InternalPortalLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link to="/portal" className="flex min-w-0 items-center gap-3">
            <img
              src={process.env.PUBLIC_URL + '/logo1.svg'}
              alt="PT Otak Kanan"
              className="h-10 w-auto object-contain"
            />
            <div className="hidden leading-tight sm:block">
              <p className="font-extrabold tracking-tight text-slate-900">
                Portal Internal
              </p>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-500">
                PT Otak Kanan
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              to="/candidate/jobs"
              className="btn btn-sm rounded-full border border-slate-200 bg-white px-5 text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
            >
              Karier
            </Link>

            <Link
              to="/login"
              className="btn btn-sm rounded-full border-none bg-orange-500 px-6 text-white shadow-md hover:bg-orange-600"
            >
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#F58220] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_28%),linear-gradient(120deg,rgba(245,130,32,0.98),rgba(234,88,12,0.95),rgba(20,184,166,0.78))]" />

          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-28 right-0 h-96 w-96 rounded-full bg-yellow-300/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />

          <div className="absolute right-16 top-20 hidden h-24 w-24 rounded-full border border-white/20 lg:block" />
          <div className="absolute bottom-20 left-16 hidden h-16 w-16 rounded-full border border-white/20 lg:block" />
          <div className="absolute right-10 top-1/2 hidden h-6 w-6 rounded-full bg-white/25 lg:block" />
          <div className="absolute bottom-10 left-[45%] hidden h-10 w-10 rounded-full bg-white/10 lg:block" />

          <div className="container relative mx-auto grid min-h-[calc(100vh-64px)] gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center">
            <div className="max-w-3xl">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold shadow-lg ring-1 ring-white/25 backdrop-blur">
                <LockKeyhole className="h-4 w-4" />
                Akses pegawai dan manajemen
              </span>

              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Portal kerja internal untuk seluruh role perusahaan
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-white/90 sm:text-lg">
                Masuk ke sistem untuk mengelola presensi, cuti, payroll,
                reimbursement, rekrutmen, data pegawai, dan laporan sesuai role
                Anda.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(110,231,183,0.18)]" />
                <span className="text-sm font-semibold text-white/90">
                  Sistem aktif dan siap digunakan
                </span>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="btn rounded-full border-none bg-white px-8 text-[#c2410c] shadow-xl hover:bg-orange-50"
                >
                  Login ke Sistem
                </Link>

                <Link
                  to="/candidate/jobs"
                  className="btn rounded-full border-white/30 bg-white/10 px-8 text-white shadow-md hover:bg-white/20"
                >
                  Lihat Lowongan
                </Link>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Role Sistem", value: "5+" },
                  { label: "Modul Aktif", value: "10+" },
                  { label: "Akses Sistem", value: "24/7" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-white/20 bg-white/15 px-5 py-5 shadow-xl backdrop-blur-md transition hover:-translate-y-1 hover:bg-white/20"
                  >
                    <p className="text-3xl font-black">{item.value}</p>
                    <p className="mt-1 text-sm font-semibold text-white/75">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-8 -top-8 hidden h-32 w-32 rounded-full bg-white/10 blur-2xl lg:block" />
              <div className="absolute -bottom-10 -left-8 hidden h-36 w-36 rounded-full bg-orange-300/20 blur-2xl lg:block" />

              <div className="relative overflow-hidden rounded-[2rem] border border-white/25 bg-white/14 p-6 shadow-2xl backdrop-blur-md">
                <div className="pointer-events-none absolute -bottom-14 -right-14 opacity-10">
                  <img
                    src={process.env.PUBLIC_URL + '/logo1.svg'}
                    alt="PT Otak Kanan"
                    className="h-56 w-auto"
                  />
                </div>

                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white/70">
                      Ringkasan akses
                    </p>
                    <h2 className="text-2xl font-extrabold">Role Internal</h2>
                  </div>

                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#F58220] shadow-lg">
                    <BriefcaseBusiness className="h-6 w-6" />
                  </span>
                </div>

                <div className="grid gap-3">
                  {roleCards.map((role) => {
                    const Icon = role.icon;

                    return (
                      <div
                        key={role.title}
                        className="group relative overflow-hidden rounded-3xl bg-white p-4 text-slate-900 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                      >
                        <div className="absolute left-0 top-0 h-full w-1 bg-orange-500" />

                        <div className="flex items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 text-[#F58220] transition group-hover:scale-110">
                            <Icon className="h-5 w-5" />
                          </span>

                          <div>
                            <h3 className="font-extrabold">{role.title}</h3>
                            <p className="mt-1 text-sm leading-5 text-slate-500">
                              {role.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-white py-16">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-orange-50 blur-3xl" />
          <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-emerald-50 blur-3xl" />

          <div className="container relative mx-auto px-4">
            <div className="mb-8 max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-500">
                Modul Portal
              </p>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
                Semua pekerjaan internal dimulai dari satu tempat
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Setiap modul dibuat agar proses kerja pegawai, HR, atasan,
                admin, dan finance lebih mudah dipantau.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {featureCards.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className="group rounded-3xl border border-orange-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-2 hover:border-orange-300 hover:shadow-xl"
                  >
                    <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-500 transition group-hover:scale-110 group-hover:bg-orange-500 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </span>

                    <h3 className="text-lg font-extrabold text-slate-900">
                      {feature.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {feature.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-orange-50/70 py-14">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-gradient-to-r from-white via-orange-50 to-white p-8 shadow-lg lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-100 blur-2xl" />
              <div className="absolute -bottom-12 left-20 h-28 w-28 rounded-full bg-emerald-100 blur-2xl" />

              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-500">
                    <Clock3 className="h-6 w-6" />
                  </span>

                  <h2 className="text-2xl font-extrabold text-slate-900">
                    Sudah memiliki akun internal?
                  </h2>
                </div>

                <p className="max-w-2xl text-sm leading-6 text-slate-500">
                  Gunakan akun yang diberikan perusahaan. Jika akun belum aktif
                  atau lupa akses, hubungi HR/Admin untuk bantuan.
                </p>
              </div>

              <Link
                to="/login"
                className="btn relative mt-6 rounded-full border-none bg-orange-500 px-8 text-white shadow-lg hover:bg-orange-600 lg:mt-0"
              >
                Login Sekarang
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white py-6">
        <div className="container mx-auto flex flex-col justify-between gap-3 px-4 text-sm text-slate-500 sm:flex-row">
          <span>PT Otak Kanan Internal Portal</span>

          <div className="flex gap-4">
            <Link to="/candidate/jobs" className="hover:text-orange-500">
              Karier
            </Link>
            <Link to="/login" className="hover:text-orange-500">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default InternalPortalLandingPage;