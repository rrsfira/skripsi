import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { pegawaiApi } from '../../features/pegawai/api'
import { calculateWorkdaysInMonth } from '../../utils/attendanceUtils'

const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
    })
}

const formatDurationFromHours = (hoursValue) => {
    if (hoursValue === null || hoursValue === undefined || hoursValue === '') return '-'

    const totalSeconds = Math.max(0, Math.round(Number(hoursValue) * 3600))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    return `${hours} jam ${minutes} menit`
}

const parseTimeToSeconds = (timeValue) => {
    if (!timeValue || typeof timeValue !== 'string') return null
    const [hourPart = '0', minutePart = '0', secondPart = '0'] = timeValue.split(':')
    const hours = Number(hourPart)
    const minutes = Number(minutePart)
    const seconds = Number(secondPart)

    if ([hours, minutes, seconds].some((num) => Number.isNaN(num))) return null
    return hours * 3600 + minutes * 60 + seconds
}

const formatDurationFromCheckTimes = (checkIn, checkOut, fallbackHours) => {
    const startSeconds = parseTimeToSeconds(checkIn)
    const endSeconds = parseTimeToSeconds(checkOut)

    if (startSeconds === null || endSeconds === null) {
        return formatDurationFromHours(fallbackHours)
    }

    let durationSeconds = endSeconds - startSeconds
    if (durationSeconds < 0) {
        durationSeconds += 24 * 3600
    }

    const hours = Math.floor(durationSeconds / 3600)
    const minutes = Math.floor((durationSeconds % 3600) / 60)

    return `${hours} jam ${minutes} menit `
}

const formatDurationFromMinutes = (minutesValue) => {
    if (minutesValue === null || minutesValue === undefined || minutesValue === '') return '0 jam 0 menit '

    const totalSeconds = Math.max(0, Math.round(Number(minutesValue) * 60))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)

    return `${hours} jam ${minutes} menit `
}

const isLeaveOrPermissionStatus = (statusValue) => {
    const normalizedStatus = String(statusValue || '').toLowerCase()
    return normalizedStatus === 'izin' || normalizedStatus === 'sakit' || normalizedStatus === 'libur'
}

const formatOvertimeDisplay = ({ status, checkIn, checkOut, overtimeHours, workingHours }) => {
    if (isLeaveOrPermissionStatus(status)) return '-'
    if (!checkIn || !checkOut) return '-'

    const overtimeValue = Number(overtimeHours)
    if (Number.isFinite(overtimeValue) && overtimeValue > 0) {
        return formatDurationFromHours(overtimeValue)
    }

    const workingValue = Number(workingHours)
    if (Number.isFinite(workingValue) && workingValue > 8) {
        return formatDurationFromHours(workingValue - 8)
    }

    return '-'
}

const alphaSanctionLabelMap = {
    none: 'Belum Ada SP',
    sp1: 'SP1',
    sp2: 'SP2',
    sp3: 'SP3',
    evaluasi_hr: 'Evaluasi HR',
    nonaktif: 'Evaluasi HR',
}

const alphaSanctionBadgeMap = {
    none: 'badge-ghost',
    sp1: 'badge-info',
    sp2: 'badge-warning',
    sp3: 'badge-error',
    evaluasi_hr: 'badge-secondary',
    nonaktif: 'badge-secondary',
}

function EmployeeAttendance() {
    const dispatch = useDispatch()
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [today, setToday] = useState({})
    const [history, setHistory] = useState([])
    const [summary, setSummary] = useState({})
    const [warningLetters, setWarningLetters] = useState([])
    const [actionLoading, setActionLoading] = useState(false)
    const attendanceTodayCardRef = useRef(null)

    const openWarningLetterPdf = (letter) => {
        if (!letter?.letter_content) return
        const popup = window.open('', '_blank', 'width=900,height=700')
        if (!popup) return

        popup.document.write(`
            <html>
                <head>
                    <title>${letter.letter_number || 'Surat Peringatan'}</title>
                    <style>
                        body { font-family: 'Times New Roman', serif; margin: 32px; white-space: pre-wrap; line-height: 1.6; }
                    </style>
                </head>
                <body>${String(letter.letter_content).replace(/\n/g, '<br/>')}</body>
            </html>
        `)
        popup.document.close()
        popup.focus()
    }

    const now = new Date()
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(now.getFullYear())
    const [statusFilter, setStatusFilter] = useState('')
    const totalWorkdays = calculateWorkdaysInMonth(selectedMonth, selectedYear)

    const availableYears = Array.from({ length: 5 }, (_, index) => now.getFullYear() - index)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const [todayData, historyData, summaryData, warningLettersData] = await Promise.all([
                pegawaiApi.getAttendanceToday(),
                pegawaiApi.getAttendanceHistory({
                    month: selectedMonth,
                    year: selectedYear,
                    status: statusFilter || undefined,
                    limit: 200,
                }),
                pegawaiApi.getAttendanceSummary({
                    month: selectedMonth,
                    year: selectedYear,
                }),
                pegawaiApi.getMyWarningLetters(),
            ])
            setToday(todayData || {})
            setHistory(historyData?.data || [])
            setSummary(summaryData?.data || {})
            setWarningLetters(warningLettersData?.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [selectedMonth, selectedYear, statusFilter])

    const presentDays = Number(summary.present_days || 0)
    const alphaDays = Number(summary.alpha_days ?? summary.absent_days ?? 0)
    const latePenaltyDays = Number(summary.late_penalty_days || 0)
    const effectiveAbsentDays = Number(summary.effective_absent_days ?? (alphaDays + latePenaltyDays))
    const discipline = summary.alpha_discipline || {}
    const sanctionLevel = String(discipline.alpha_sanction_level || 'none').toLowerCase()
    const sanctionLabel = alphaSanctionLabelMap[sanctionLevel] || sanctionLevel
    const sanctionBadgeClass = alphaSanctionBadgeMap[sanctionLevel] || 'badge-ghost'
    const latestWarningLetter = warningLetters?.[0] || null
    const isLeaveIntegratedToday = ['izin', 'sakit', 'libur'].includes(String(today?.status || '').toLowerCase())
    const attendanceDate = today?.date ? new Date(today.date) : new Date()
    const isSundayToday = attendanceDate.getDay() === 0
    const nowTime = new Date()
    const currentSeconds = nowTime.getHours() * 3600 + nowTime.getMinutes() * 60 + nowTime.getSeconds()
    const checkInStartSeconds = 7 * 3600
    const checkInCutoffSeconds = 12 * 3600
    const checkOutStartSeconds = 12 * 3600 + 60
    const isCheckInTooEarly = currentSeconds < checkInStartSeconds && !today?.check_in
    const isCheckInCutoffPassed = currentSeconds > checkInCutoffSeconds && !today?.check_in
    const isCheckOutNotOpenYet = currentSeconds < checkOutStartSeconds && !!today?.check_in && !today?.check_out

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Absensi Pegawai' }))
        loadData()
    }, [dispatch, loadData])

    useEffect(() => {
        if (loading) return
        if (!location.state?.focusAttendanceToday) return

        attendanceTodayCardRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }, [loading, location.state])

    const runCheckin = async () => {
        try {
            setActionLoading(true)
            setError('')
            await pegawaiApi.checkIn()
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoading(false)
        }
    }

    const runCheckout = async () => {
        try {
            setActionLoading(true)
            setError('')
            await pegawaiApi.checkOut()
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-10">Memuat data absensi...</div>
    }

    return (
        <>
            {error ? (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-6">
                <div className="stat bg-base-100 rounded-box shadow">
                    <div className="stat-title">Hari Kerja Bulan Ini</div>
                    <div className="stat-value text-primary">{totalWorkdays}</div>
                </div>
                <div className="stat bg-base-100 rounded-box shadow">
                    <div className="stat-title">Hadir</div>
                    <div className="stat-value text-success">{presentDays}</div>
                </div>
                <div className="stat bg-base-100 rounded-box shadow">
                    <div className="stat-title">Terlambat</div>
                    <div className="stat-value text-warning">{summary.late_days || 0}</div>
                </div>
                <div className="stat bg-base-100 rounded-box shadow">
                    <div className="stat-title">Tidak Hadir</div>
                    <div className="stat-value text-error">{effectiveAbsentDays}</div>
                    <div className="stat-desc">alpha {alphaDays} + penalti telat {latePenaltyDays}</div>
                </div>
            </div>

            <TitleCard title="Status SP Alpha" topMargin="mt-6">
                <div className="grid md:grid-cols-4 grid-cols-1 gap-4">
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Sanksi Saat Ini</p>
                        <p className="text-lg font-semibold mt-1">
                            <span className={`badge ${sanctionBadgeClass}`}>{sanctionLabel}</span>
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Alpha Berturut-turut</p>
                        <p className="text-lg font-semibold">{Number(discipline.alpha_consecutive_days || 0)} hari</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Alpha Akumulasi</p>
                        <p className="text-lg font-semibold">{Number(discipline.alpha_accumulated_days || 0)} hari</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Dokumen</p>
                        <div className="mt-2 flex flex-col gap-2">
                            <p className="text-sm opacity-80">
                                {latestWarningLetter
                                    ? `SP terbaru: ${latestWarningLetter.letter_number || '-'} (${String(latestWarningLetter.sp_level || '').toUpperCase()})`
                                    : 'Belum ada dokumen SP'}
                            </p>
                            <button
                                className="btn btn-sm btn-outline w-fit"
                                disabled={!latestWarningLetter}
                                onClick={() => openWarningLetterPdf(latestWarningLetter)}
                            >
                                Lihat PDF
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-4 p-4 rounded-lg bg-base-200 border border-base-300">
                    <p className="text-sm opacity-70 mb-2">Aturan SP Alpha</p>
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
            </TitleCard>

            <div ref={attendanceTodayCardRef}>
                <TitleCard title="Absensi Hari Ini" topMargin="mt-6">
                {isSundayToday ? (
                    <div className="alert alert-info mb-4">
                        <span>Hari ini hari libur, anda tidak perlu absen!</span>
                    </div>
                ) : null}

                {isLeaveIntegratedToday ? (
                    <div className="alert alert-info mb-4">
                        <span>
                            Hari ini status kamu <b>{today.status}</b>. Anda tidak perlu absen.
                        </span>
                    </div>
                ) : null}

                {!isSundayToday && !isLeaveIntegratedToday && isCheckInTooEarly ? (
                    <div className="alert alert-warning mb-4">
                        <span>Absen masuk hanya bisa dilakukan pada pukul 07.00 hingga 12.00.</span>
                    </div>
                ) : null}

                {!isSundayToday && !isLeaveIntegratedToday && isCheckInCutoffPassed ? (
                    <div className="alert alert-warning mb-4">
                        <span>Sudah lewat pukul 12.00, anda tidak bisa absen!.</span>
                    </div>
                ) : null}

                {!isSundayToday && !isLeaveIntegratedToday && isCheckOutNotOpenYet ? (
                    <div className="alert alert-warning mb-4">
                        <span>Absen pulang hanya bisa dilakukan setelah pukul 12.01.</span>
                    </div>
                ) : null}

                <div className="grid md:grid-cols-3 grid-cols-1 gap-4">
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Tanggal</p>
                        <p className="text-lg font-semibold">{formatDate(today.date)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Status</p>
                        <p className="text-lg font-semibold">{today.status || '-'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Durasi Kerja</p>
                        <p className="text-lg font-semibold">{formatDurationFromHours(today.working_hours)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Check In</p>
                        <p className="text-lg font-semibold">{today.check_in || '-'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Check Out</p>
                        <p className="text-lg font-semibold">{today.check_out || '-'}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Lembur</p>
                        <p className="text-lg font-semibold">
                            {formatOvertimeDisplay({
                                status: today.status,
                                checkIn: today.check_in,
                                checkOut: today.check_out,
                                overtimeHours: today.overtime_hours,
                                workingHours: today.working_hours,
                            })}
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-base-200">
                        <p className="text-sm opacity-70">Terlambat</p>
                        <p className="text-lg font-semibold">{isLeaveOrPermissionStatus(today.status) ? '-' : formatDurationFromMinutes(today.late_minutes)}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                    <button className={`btn btn-primary ${actionLoading ? 'loading' : ''}`} onClick={runCheckin} disabled={actionLoading || !!today.check_in || isLeaveIntegratedToday || isSundayToday || isCheckInTooEarly || isCheckInCutoffPassed}>Check In</button>
                    <button className={`btn btn-secondary ${actionLoading ? 'loading' : ''}`} onClick={runCheckout} disabled={actionLoading || !today.check_in || !!today.check_out || isLeaveIntegratedToday || isSundayToday || isCheckOutNotOpenYet}>Check Out</button>
                </div>
                </TitleCard>
            </div>

            <TitleCard title="Riwayat Absensi" topMargin="mt-6">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-3 mb-4">
                    <select
                        className="select select-bordered"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="hadir">Hadir</option>
                        <option value="izin">Izin</option>
                        <option value="sakit">Sakit</option>
                        <option value="alpha">Alpha</option>
                        <option value="libur">Libur</option>
                    </select>

                    <select
                        className="select select-bordered"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                        {Array.from({ length: 12 }, (_, index) => {
                            const monthNumber = index + 1
                            return (
                                <option key={monthNumber} value={monthNumber}>
                                    {new Date(2000, index, 1).toLocaleString('id-ID', { month: 'long' })}
                                </option>
                            )
                        })}
                    </select>

                    <select
                        className="select select-bordered"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Status</th>
                                <th>Masuk</th>
                                <th>Pulang</th>
                                <th>Durasi Kerja</th>
                                <th>Lembur</th>
                                <th>Terlambat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center opacity-60">
                                        Tidak ada data absensi pada filter yang dipilih
                                    </td>
                                </tr>
                            ) : history.map((item) => (
                                <tr key={item.id}>
                                    <td>{formatDate(item.date)}</td>
                                    <td><span className="badge">{item.status || '-'}</span></td>
                                    <td>{item.check_in || '-'}</td>
                                    <td>{item.check_out || '-'}</td>
                                    <td>{formatDurationFromCheckTimes(item.check_in, item.check_out, item.working_hours)}</td>
                                    <td>{formatOvertimeDisplay({
                                        status: item.status,
                                        checkIn: item.check_in,
                                        checkOut: item.check_out,
                                        overtimeHours: item.overtime_hours,
                                        workingHours: item.working_hours,
                                    })}</td>
                                    <td>{isLeaveOrPermissionStatus(item.status) ? '-' : formatDurationFromMinutes(item.late_minutes)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </TitleCard>
        </>
    )
}

export default EmployeeAttendance
