import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setPageTitle } from "../../features/common/headerSlice";
import TitleCard from "../../components/Cards/TitleCard";
import MiniCalendar from "../../components/Calendar/MiniCalendar";
import { pegawaiApi } from "../../features/pegawai/api";
import {
  calculateAccuratePercentage,
  calculateWorkdaysInMonth,
} from "../../utils/attendanceUtils";

const SP_ALERT_STORAGE_KEY = "lastSeenWarningLetterId";

const formatTime = (value) => {
  if (!value) return "-";
  return String(value).slice(0, 5);
};

const formatDateKey = (dateValue) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const alphaSanctionLabelMap = {
  none: "Belum Ada SP",
  sp1: "SP1",
  sp2: "SP2",
  sp3: "SP3",
  evaluasi_hr: "Evaluasi HR",
  nonaktif: "Evaluasi HR",
};

const alphaSanctionBadgeMap = {
  none: "badge-ghost",
  sp1: "badge-info",
  sp2: "badge-warning",
  sp3: "badge-error",
  evaluasi_hr: "badge-secondary",
  nonaktif: "badge-secondary",
};

function EmployeeDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState({});
  const [dashboard, setDashboard] = useState({});
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState({});
  const [warningLetters, setWarningLetters] = useState([]);
  const [showWarningPopup, setShowWarningPopup] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const openWarningLetterPdf = (letter) => {
    if (!letter?.letter_content) return;
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>${letter.letter_number || "Surat Peringatan"}</title>
          <style>
            body { font-family: 'Times New Roman', serif; margin: 32px; white-space: pre-wrap; line-height: 1.6; }
          </style>
        </head>
        <body>${String(letter.letter_content).replace(/\n/g, "<br/>")}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const [profileResult, dashboardResult, summaryResult, historyResult, todayResult, warningLettersResult] =
      await Promise.allSettled([
        pegawaiApi.getProfile(),
        pegawaiApi.getDashboard(),
        pegawaiApi.getAttendanceSummary({
          month: currentMonth,
          year: currentYear,
        }),
        pegawaiApi.getAttendanceHistory({
          month: currentMonth,
          year: currentYear,
          limit: 200,
        }),
        pegawaiApi.getAttendanceToday(),
        pegawaiApi.getMyWarningLetters(),
      ]);

    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value || {});
    } else {
      setProfile({});
    }

    if (dashboardResult.status === "fulfilled") {
      setDashboard(dashboardResult.value || {});
    } else {
      setDashboard({
        summary: {},
        payrolls: [],
        reimbursements: [],
        salary_appeals: [],
        leave_requests: [],
      });
    }

    if (summaryResult.status === "fulfilled") {
      setAttendanceSummary(summaryResult.value?.data || {});
    } else {
      setAttendanceSummary({});
    }

    if (historyResult.status === "fulfilled") {
      setAttendanceHistory(historyResult.value?.data || []);
    } else {
      setAttendanceHistory([]);
    }

    if (todayResult.status === "fulfilled") {
      setTodayAttendance(todayResult.value || {});
    } else {
      setTodayAttendance({});
    }

    if (warningLettersResult.status === "fulfilled") {
      setWarningLetters(warningLettersResult.value?.data || []);
    } else {
      setWarningLetters([]);
    }

    const historyData =
      historyResult.status === "fulfilled" ? historyResult.value?.data || [] : [];
    const nowDate = new Date();
    const isCurrentPeriod =
      Number(currentMonth) === nowDate.getMonth() + 1 &&
      Number(currentYear) === nowDate.getFullYear();

    if (isCurrentPeriod && historyData.length === 0) {
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const [previousSummaryResult, previousHistoryResult] =
        await Promise.allSettled([
          pegawaiApi.getAttendanceSummary({
            month: previousMonth,
            year: previousYear,
          }),
          pegawaiApi.getAttendanceHistory({
            month: previousMonth,
            year: previousYear,
            limit: 200,
          }),
        ]);

      const previousHistoryData =
        previousHistoryResult.status === "fulfilled"
          ? previousHistoryResult.value?.data || []
          : [];

      if (previousHistoryData.length > 0) {
        setCurrentMonth(previousMonth);
        setCurrentYear(previousYear);
        setAttendanceHistory(previousHistoryData);
        setAttendanceSummary(
          previousSummaryResult.status === "fulfilled"
            ? previousSummaryResult.value?.data || {}
            : {},
        );
      }
    }

    if (
      profileResult.status === "rejected" &&
      dashboardResult.status === "rejected" &&
      summaryResult.status === "rejected" &&
      historyResult.status === "rejected" &&
      todayResult.status === "rejected"
    ) {
      setError("Semua data dashboard gagal dimuat");
    }

    setLoading(false);
  }, [currentMonth, currentYear]);

  const handleCheckIn = async () => {
    try {
      await pegawaiApi.checkIn();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCheckOut = async () => {
    try {
      await pegawaiApi.checkOut();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePreviousMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  useEffect(() => {
    dispatch(setPageTitle({ title: "Dashboard Pegawai" }));
    loadDashboard();
  }, [dispatch, loadDashboard]);

  useEffect(() => {
    const latestId = String(warningLetters?.[0]?.id || "");
    if (!latestId) return;

    const lastSeenId = localStorage.getItem(SP_ALERT_STORAGE_KEY);
    if (lastSeenId !== latestId) {
      setShowWarningPopup(true);
    }
  }, [warningLetters]);

  if (loading) {
    return (
      <div className="text-center py-10 text-lg">
        Memuat dashboard pegawai...
      </div>
    );
  }

  const summary = dashboard?.summary || {};
  const payrolls = dashboard?.payrolls || [];
  const leaveRequests = dashboard?.leave_requests || [];

  const hasSummaryFromApi =
    Number(attendanceSummary?.present_days || 0) > 0 ||
    Number(attendanceSummary?.late_days || 0) > 0 ||
    Number(attendanceSummary?.permission_days || 0) > 0 ||
    Number(attendanceSummary?.absent_days || 0) > 0;
  const fallbackSummaryFromHistory = attendanceHistory.reduce(
    (accumulator, item) => {
      const normalizedStatus = String(item?.status || "").toLowerCase();
      const lateMinutes = Number(item?.late_minutes || 0);

      if (normalizedStatus === "hadir") accumulator.present_days += 1;
      if (normalizedStatus === "izin" || normalizedStatus === "sakit") {
        accumulator.permission_days += 1;
      }
      if (normalizedStatus === "alpha") accumulator.absent_days += 1;
      if (lateMinutes > 60) {
        accumulator.late_days += 1;
      }

      return accumulator;
    },
    {
      present_days: 0,
      late_days: 0,
      permission_days: 0,
      absent_days: 0,
    },
  );

  const displayedSummary = hasSummaryFromApi
    ? attendanceSummary
    : fallbackSummaryFromHistory;

  const presentDays = Number(displayedSummary?.present_days || 0);
  const lateDays = Number(displayedSummary?.late_days || 0);
  const permissionDays = Number(displayedSummary?.permission_days || 0);
  const absentDays = Number(displayedSummary?.absent_days || 0);
  const discipline = displayedSummary?.alpha_discipline || {};
  const sanctionLevel = String(
    discipline?.alpha_sanction_level || "none",
  ).toLowerCase();
  const sanctionLabel = alphaSanctionLabelMap[sanctionLevel] || sanctionLevel;
  const sanctionBadgeClass =
    alphaSanctionBadgeMap[sanctionLevel] || "badge-ghost";
  const latestWarningLetter = warningLetters?.[0] || null;
  const totalWorkdays = calculateWorkdaysInMonth(currentMonth, currentYear);
  const performancePercent = calculateAccuratePercentage(
    presentDays,
    currentMonth,
    currentYear,
  );

  const hasCheckedIn = !!todayAttendance?.check_in;
  const hasCheckedOut = !!todayAttendance?.check_out;
  const isLeaveIntegratedToday = ["izin", "sakit", "libur"].includes(
    String(todayAttendance?.status || "").toLowerCase(),
  );
  const attendanceDate = todayAttendance?.date
    ? new Date(todayAttendance.date)
    : new Date();
  const isSundayToday = attendanceDate.getDay() === 0;
  const now = new Date();
  const currentSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const checkInStartSeconds = 7 * 3600;
  const checkInCutoffSeconds = 12 * 3600;
  const checkOutStartSeconds = 12 * 3600 + 60;
  const todayDateKey = formatDateKey(new Date());
  const activeApprovedLeaveToday = leaveRequests.find((item) => {
    if (String(item?.status || "").toLowerCase() !== "approved") return false;
    const startDate = formatDateKey(item?.start_date);
    const endDate = formatDateKey(item?.end_date);
    if (!startDate || !endDate) return false;
    return todayDateKey >= startDate && todayDateKey <= endDate;
  });
  const isApprovedLeaveToday = !!activeApprovedLeaveToday;
  const isCheckInTooEarly = currentSeconds < checkInStartSeconds && !hasCheckedIn;
  const isCheckInCutoffPassed = currentSeconds > checkInCutoffSeconds && !hasCheckedIn;
  const isCheckOutNotOpenYet =
    currentSeconds < checkOutStartSeconds && hasCheckedIn && !hasCheckedOut;

  const openAttendanceTodayCard = () => {
    navigate('/app/attendance', {
      state: { focusAttendanceToday: true },
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-xs" onClick={loadDashboard}>
            Muat Ulang
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TitleCard title={`Hai, ${profile?.user?.name || profile?.user?.username || "Pegawai"}!`} topMargin="mt-0">
            <p className="opacity-70">
              {isSundayToday
                ? "Hari ini hari libur, anda tidak perlu absen!"
                : isLeaveIntegratedToday || isApprovedLeaveToday
                ? `Hari ini status kamu ${todayAttendance?.status || activeApprovedLeaveToday?.leave_type || "izin/cuti"}. Anda tidak perlu absen.`
                : isCheckInTooEarly
                ? "Absen masuk hanya bisa dilakukan pada pukul 07.00 hingga 12.00."
                : isCheckInCutoffPassed
                ? "Sudah lewat pukul 12.00, anda tidak bisa absen!."
                : isCheckOutNotOpenYet
                ? "Absen pulang hanya bisa dilakukan setelah pukul 12.01."
                : !hasCheckedIn
                ? "Hari ini kamu belum absen masuk."
                : !hasCheckedOut
                ? "Hari ini kamu belum absen pulang."
                : "Hari ini kamu sudah absen pulang."}
            </p>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                className="btn btn-primary"
                disabled={hasCheckedIn || isLeaveIntegratedToday || isApprovedLeaveToday || isSundayToday || isCheckInTooEarly || isCheckInCutoffPassed}
                onClick={handleCheckIn}
              >
                Absen Masuk
              </button>
              <button
                className="btn btn-secondary"
                disabled={!hasCheckedIn || hasCheckedOut || isLeaveIntegratedToday || isApprovedLeaveToday || isSundayToday || isCheckOutNotOpenYet}
                onClick={handleCheckOut}
              >
                Absen Pulang
              </button>
            </div>
          </TitleCard>
          <div
            className="cursor-pointer"
            onClick={openAttendanceTodayCard}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAttendanceTodayCard();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Buka halaman Absensi Hari Ini"
          >
            <TitleCard title="Status Kehadiran Hari Ini" topMargin="mt-6">
              <div className="grid md:grid-cols-4 grid-cols-2 gap-4">
                <div className="text-center p-3 bg-info/10 border border-info/25 rounded-lg">
                  <p className="text-sm opacity-70">Absen Masuk</p>
                  <p className="font-semibold">
                    {formatTime(todayAttendance?.check_in)}
                  </p>
                </div>
                <div className="text-center p-3 bg-success/10 border border-success/25 rounded-lg">
                  <p className="text-sm opacity-70">Absen Pulang</p>
                  <p className="font-semibold">
                    {formatTime(todayAttendance?.check_out)}
                  </p>
                </div>
                <div className="text-center p-3 bg-warning/10 border border-warning/25 rounded-lg">
                  <p className="text-sm opacity-70">Status</p>
                  <p className="font-semibold capitalize">
                    {todayAttendance?.status || "Belum absen"}
                  </p>
                </div>
                <div className="text-center p-3 bg-primary/10 border border-primary/25 rounded-lg">
                  <p className="text-sm opacity-70">Durasi Kerja</p>
                  <p className="font-semibold">
                    {todayAttendance?.working_hours
                      ? `${todayAttendance.working_hours}j`
                      : "-"}
                  </p>
                </div>
              </div>
            </TitleCard>
          </div>
          <TitleCard title="Ringkasan Bulan Ini" topMargin="mt-0">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <button
                type="button"
                onClick={() => navigate('/app/attendance')}
                className="p-3 bg-success/10 border border-success/25 rounded-lg text-left hover:bg-success/20 transition"
              >
                <p className="text-xs opacity-70 mb-1">Hadir</p>
                <p className="text-lg font-bold text-success">{presentDays} hari</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/attendance')}
                className="p-3 bg-warning/10 border border-warning/25 rounded-lg text-left hover:bg-warning/20 transition"
              >
                <p className="text-xs opacity-70 mb-1">Terlambat</p>
                <p className="text-lg font-bold text-warning">{lateDays} hari</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/attendance')}
                className="p-3 bg-info/10 border border-info/25 rounded-lg text-left hover:bg-info/20 transition"
              >
                <p className="text-xs opacity-70 mb-1">Izin/Cuti</p>
                <p className="text-lg font-bold text-info">{permissionDays} hari</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/attendance')}
                className="p-3 bg-error/10 border border-error/25 rounded-lg text-left hover:bg-error/20 transition"
              >
                <p className="text-xs opacity-70 mb-1">Alpha</p>
                <p className="text-lg font-bold text-error">{absentDays} hari</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/attendance')}
                className="col-span-2 p-3 bg-primary/10 border border-primary/25 rounded-lg text-center hover:bg-primary/20 transition"
              >
                <p className="text-xs opacity-70 mb-1">Persentase Kehadiran</p>
                <p className="text-2xl font-bold text-primary">{performancePercent}%</p>
                <p className="text-xs opacity-70 mt-1">dari {totalWorkdays} hari kerja</p>
              </button>
              <div className="col-span-2 p-3 bg-base-200 rounded-lg border border-base-300">
                <p className="text-xs opacity-70 mb-1">Status SP Alpha</p>
                <div className="grid md:grid-cols-4 grid-cols-1 gap-2 text-xs mb-2">
                  <div className="bg-base-100 rounded px-2 py-2">
                    <p className="opacity-70">Sanksi Saat Ini</p>
                    <span className={`badge ${sanctionBadgeClass}`}>{sanctionLabel}</span>
                  </div>
                  <div className="bg-base-100 rounded px-2 py-2">
                    <p className="opacity-70">Alpha Berturut</p>
                    <p className="font-semibold">{Number(discipline?.alpha_consecutive_days || 0)} hari</p>
                  </div>
                  <div className="bg-base-100 rounded px-2 py-2">
                    <p className="opacity-70">Alpha Akumulasi</p>
                    <p className="font-semibold">{Number(discipline?.alpha_accumulated_days || 0)} hari</p>
                  </div>
                  <div className="bg-base-100 rounded px-2 py-2">
                    <p className="opacity-70">Dokumen</p>
                    <button
                      className="btn btn-xs btn-outline mt-1"
                      disabled={!latestWarningLetter}
                      onClick={() => openWarningLetterPdf(latestWarningLetter)}
                    >
                      Lihat PDF
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-base-300">
                  <p className="text-xs opacity-70 mb-2">
                    {latestWarningLetter
                      ? `SP terbaru: ${latestWarningLetter.letter_number || '-'} (${String(latestWarningLetter.sp_level || '').toUpperCase()})`
                      : 'Belum ada dokumen SP yang dapat dilihat'}
                  </p>
                  <p className="text-xs opacity-70 mb-1">Aturan SP Alpha</p>
                  <div className="overflow-x-auto">
                    <table className="table table-xs">
                      <thead>
                        <tr>
                          <th>Kondisi</th>
                          <th>Tindak Lanjut</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Alpha berturut-turut 3 hari</td>
                          <td>SP1</td>
                        </tr>
                        <tr>
                          <td>Alpha berturut-turut 5 hari</td>
                          <td>SP2</td>
                        </tr>
                        <tr>
                          <td>Alpha berturut-turut 6 hari</td>
                          <td>SP3</td>
                        </tr>
                        <tr>
                          <td>Alpha berturut-turut 7 hari</td>
                          <td>Evaluasi HR</td>
                        </tr>
                        <tr>
                          <td>Alpha akumulasi 7+ hari</td>
                          <td>Evaluasi HR</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </TitleCard>
        </div>

        <TitleCard title="Grafik Evaluasi Kinerja" topMargin="mt-0">
          <div className="mb-6 pb-6 border-b">
            <div className="flex items-center justify-center gap-2 mb-5">
              <button
                className="px-2 py-1 hover:bg-base-200 rounded transition text-sm"
                onClick={handlePreviousMonth}
                title="Bulan sebelumnya"
              >
                ←
              </button>
              <span className="text-sm font-bold">
                {new Date(currentYear, currentMonth - 1).toLocaleString(
                  "id-ID",
                  {
                    month: "long",
                  },
                )}
              </span>

              <span className="text-sm font-bold">{currentYear}</span>

              <button
                className="px-2 py-1 hover:bg-base-200 rounded transition text-sm"
                onClick={handleNextMonth}
                title="Bulan berikutnya"
              >
                →
              </button>
            </div>
            <MiniCalendar month={currentMonth} year={currentYear} />
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Hadir</span>
                <span>{presentDays}</span>
              </div>
              <progress
                className="progress progress-success w-full"
                value={presentDays}
                max={Math.max(totalWorkdays, 1)}
              ></progress>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Terlambat</span>
                <span>{lateDays}</span>
              </div>
              <progress
                className="progress progress-warning w-full"
                value={lateDays}
                max={Math.max(totalWorkdays, 1)}
              ></progress>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Izin/Cuti</span>
                <span>{permissionDays}</span>
              </div>
              <progress
                className="progress progress-info w-full"
                value={permissionDays}
                max={Math.max(totalWorkdays, 1)}
              ></progress>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Alpha</span>
                <span>{absentDays}</span>
              </div>
              <progress
                className="progress progress-error w-full"
                value={absentDays}
                max={Math.max(totalWorkdays, 1)}
              ></progress>
            </div>
          </div>
        </TitleCard>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-6">
        <TitleCard title="Pending Approval" topMargin="mt-0">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => navigate('/app/leave-requests')}
              className="w-full bg-info/10 border border-info/25 p-3 rounded-lg text-left hover:bg-info/20 transition"
            >
              <p className="text-xs opacity-70">Cuti/Izin</p>
              <p className="text-2xl font-bold text-info">
                {summary.pending_leave_requests || 0}
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/reimbursements')}
              className="w-full bg-success/10 border border-success/25 p-3 rounded-lg text-left hover:bg-success/20 transition"
            >
              <p className="text-xs opacity-70">Reimbursement</p>
              <p className="text-2xl font-bold text-success">
                {summary.pending_reimbursements || 0}
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/salary-appeals')}
              className="w-full bg-warning/10 border border-warning/25 p-3 rounded-lg text-left hover:bg-warning/20 transition"
            >
              <p className="text-xs opacity-70">Banding Gaji</p>
              <p className="text-2xl font-bold text-warning">
                {summary.pending_salary_appeals || 0}
              </p>
            </button>
          </div>
        </TitleCard>

        <TitleCard title="Slip Gaji Terbaru" topMargin="mt-0">
          <div className="space-y-2">
            {payrolls.length === 0 && (
              <p className="opacity-60 text-sm text-center py-4">
                Belum ada slip gaji
              </p>
            )}
            {payrolls.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate('/app/payroll')}
                className="w-full border border-base-300 rounded-lg p-3 hover:bg-base-200/50 transition text-left"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">
                      {item.period_month}/{item.period_year}
                    </p>
                    <p className="text-xs opacity-70">
                      Rp{" "}
                      {Number(
                        item.final_amount || item.net_salary || 0,
                      ).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <span className="badge badge-outline capitalize text-xs">
                    {item.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </TitleCard>
      </div>

      {showWarningPopup && latestWarningLetter ? (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Peringatan Disiplin</h3>
            <p className="py-2 text-sm opacity-80">
              Anda menerima {String(latestWarningLetter.sp_level || '').toUpperCase()}.
            </p>
            <p className="text-sm">
              No Surat: <b>{latestWarningLetter.letter_number || '-'}</b>
            </p>
            <p className="text-sm">
              Tanggal Terbit: <b>{latestWarningLetter.issued_date ? new Date(latestWarningLetter.issued_date).toLocaleDateString('id-ID') : '-'}</b>
            </p>
            <div className="modal-action">
              <button
                className="btn btn-outline"
                onClick={() => openWarningLetterPdf(latestWarningLetter)}
              >
                Lihat PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  localStorage.setItem(SP_ALERT_STORAGE_KEY, String(latestWarningLetter.id));
                  setShowWarningPopup(false);
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default EmployeeDashboard;
