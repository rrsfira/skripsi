import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { atasanApi } from '../../features/atasan/api'
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { getChartColors, getCurrentTheme, UI_PALETTE, toRgba } from '../../utils/themePalette'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function AtasanDashboard() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dashboard, setDashboard] = useState(null)
    const currentDate = new Date()
    const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1))
    const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()))

    const monthOptions = [
        { value: '1', label: 'Januari' },
        { value: '2', label: 'Februari' },
        { value: '3', label: 'Maret' },
        { value: '4', label: 'April' },
        { value: '5', label: 'Mei' },
        { value: '6', label: 'Juni' },
        { value: '7', label: 'Juli' },
        { value: '8', label: 'Agustus' },
        { value: '9', label: 'September' },
        { value: '10', label: 'Oktober' },
        { value: '11', label: 'November' },
        { value: '12', label: 'Desember' },
    ]

    const yearOptions = Array.from({ length: 7 }, (_, index) => String(currentDate.getFullYear() - 3 + index))

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const result = await atasanApi.getDashboard({
                month: Number(selectedMonth),
                year: Number(selectedYear),
            })
            setDashboard(result)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [selectedMonth, selectedYear])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Dashboard Atasan' }))
        loadDashboard()
    }, [dispatch, loadDashboard])

    if (loading) {
        return <div className="text-center py-10 text-lg">Memuat dashboard atasan...</div>
    }

    if (error) {
        return (
            <TitleCard title="Dashboard Atasan" topMargin="mt-0">
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
                <button className="btn btn-primary" onClick={loadDashboard}>Muat Ulang</button>
            </TitleCard>
        )
    }

    const team = dashboard?.team_overview || {}
    const scopeInfo = dashboard?.scope_info || {}
    const today = dashboard?.attendance_today || {}
    const approvals = dashboard?.pending_approvals || {}
    const summary = dashboard?.attendance_summary || {}
    const pendingLeaves = dashboard?.pending_items?.leaves || []
    const pendingReimbursements = dashboard?.pending_items?.reimbursements || []
    const teamMembers = dashboard?.team_members || []
    const topLateEmployees = dashboard?.performance_alerts?.top_late_employees || []
    const recentActions = dashboard?.recent_actions || []

    const chartColors = getChartColors()
    const activeTheme = getCurrentTheme()
    const activePalette = UI_PALETTE[activeTheme] || UI_PALETTE.light
    const isDarkMode = activeTheme === 'dark'

    // Explicit request: light mode black text, dark mode white text for chart descriptions.
    const descriptionTextColor = isDarkMode ? '#FFFFFF' : '#000000'

    const statCards = [
        {
            title: 'Total Anggota Tim',
            value: team.total_members || 0,
            detail: `Tetap: ${team.permanent || 0} | Kontrak: ${team.contract || 0}`,
            path: '/app/team-attendance',
        },
        {
            title: 'Hadir Hari Ini',
            value: today.present || 0,
            detail: `Terlambat: ${today.late || 0} | Tidak Hadir: ${today.absent || 0}`,
            path: '/app/team-attendance',
        },
        {
            title: 'Approval Pending',
            value: approvals.total || 0,
            detail: `Cuti/Izin: ${approvals.leave_requests || 0} | Reimbursement: ${approvals.reimbursements || 0}`,
            path: '/app/leave-requests',
        },
        {
            title: 'Total Terlambat Bulan Ini',
            value: summary.total_late || 0,
            detail: `Rekap ${summary.total_records || 0} catatan kehadiran`,
            path: '/app/team-attendance',
        },
    ]

    const attendanceCompositionChart = {
        labels: ['Hadir', 'Izin', 'Sakit', 'Alpha'],
        datasets: [
            {
                label: 'Komposisi Kehadiran',
                data: [
                    Number(summary.hadir || 0),
                    Number(summary.izin || 0),
                    Number(summary.sakit || 0),
                    Number(summary.alpha || 0),
                ],
                backgroundColor: [
                    toRgba(chartColors[5], 0.8),
                    toRgba(chartColors[4], 0.8),
                    toRgba(chartColors[1], 0.8),
                    toRgba(chartColors[3], 0.8),
                ],
                borderWidth: 1,
            },
        ],
    }

    const lateEmployeesChart = {
        labels: topLateEmployees.slice(0, 8).map((item) => item.name),
        datasets: [
            {
                label: 'Jumlah Terlambat',
                data: topLateEmployees.slice(0, 8).map((item) => Number(item.late_count || 0)),
                backgroundColor: toRgba(chartColors[4], 0.85),
                borderColor: chartColors[4],
                borderWidth: 1,
            },
            {
                label: 'Total Menit Terlambat',
                data: topLateEmployees.slice(0, 8).map((item) => Number(item.total_late_minutes || 0)),
                backgroundColor: toRgba(chartColors[0], 0.75),
                borderColor: chartColors[0],
                borderWidth: 1,
            },
        ],
    }

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: descriptionTextColor,
                    boxWidth: 14,
                    boxHeight: 14,
                    padding: 16,
                    font: {
                        size: 12,
                        weight: '600',
                    },
                },
            },
            tooltip: {
                titleColor: descriptionTextColor,
                bodyColor: descriptionTextColor,
                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.96)' : 'rgba(255, 255, 255, 0.96)',
                borderColor: activePalette.border,
                borderWidth: 1,
            },
        },
    }

    const barChartOptions = {
        ...chartOptions,
        scales: {
            x: {
                ticks: {
                    color: descriptionTextColor,
                    font: {
                        size: 11,
                        weight: '500',
                    },
                },
                grid: {
                    color: isDarkMode ? 'rgba(224, 224, 224, 0.2)' : 'rgba(79, 79, 79, 0.2)',
                },
            },
            y: {
                ticks: {
                    color: descriptionTextColor,
                    font: {
                        size: 11,
                        weight: '500',
                    },
                },
                grid: {
                    color: isDarkMode ? 'rgba(224, 224, 224, 0.2)' : 'rgba(79, 79, 79, 0.2)',
                },
            },
        },
    }

    return (
        <>
            <div className="alert bg-base-100 border border-base-300 mb-4">
                <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold">Scope Tim:</span>
                        <span className="badge badge-primary badge-outline">
                            {scopeInfo.department_name || 'Departemen belum terdefinisi'}
                        </span>
                        <span className="opacity-70">•</span>
                        <span className="opacity-80">
                            {scopeInfo.manager_position || 'Posisi manager'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            className="select select-bordered select-sm"
                            value={selectedMonth}
                            onChange={(event) => setSelectedMonth(event.target.value)}
                        >
                            {monthOptions.map((month) => (
                                <option key={month.value} value={month.value}>{month.label}</option>
                            ))}
                        </select>
                        <select
                            className="select select-bordered select-sm"
                            value={selectedYear}
                            onChange={(event) => setSelectedYear(event.target.value)}
                        >
                            {yearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
                {statCards.map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="card w-full bg-base-100 shadow-lg text-left hover:bg-base-200/60 transition"
                    >
                        <div className="card-body p-2 sm:p-4 lg:p-6">
                            <p className="text-xs leading-tight opacity-70">{item.title}</p>
                            <p className="text-xl sm:text-2xl font-bold text-primary mt-1">{item.value}</p>
                            <p className="text-xs opacity-70 mt-1 hidden sm:block">{item.detail}</p>
                            <p className="text-xs opacity-60 mt-0.5">Klik &rarr;</p>
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 grid-cols-1 gap-6 mt-6">
                <TitleCard title="Grafik Komposisi Kehadiran" topMargin="mt-0">
                    <Doughnut data={attendanceCompositionChart} options={chartOptions} />
                </TitleCard>

                <TitleCard title="Daftar Nama Tim" topMargin="mt-0">
                    <div className="overflow-y-auto max-h-[320px]">
                        <table className="table table-zebra table-sm">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Kode Pegawai</th>
                                    <th>Jabatan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {teamMembers.map((member) => (
                                    <tr key={member.id}>
                                        <td className="font-semibold">{member.employee_name}</td>
                                        <td>{member.employee_code || '-'}</td>
                                        <td>{member.position_name || '-'}</td>
                                    </tr>
                                ))}
                                {teamMembers.length === 0 && (
                                    <tr>
                                        <td colSpan={2} className="text-center opacity-70">Belum ada anggota tim</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>

                <TitleCard title="Pegawai yang Terlambat Hari Ini" topMargin="mt-0">
                    {topLateEmployees.length > 0 && Array.isArray(topLateEmployees[0]?.late_per_day) && topLateEmployees[0].late_per_day.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>No</th>
                                        <th>Nama</th>
                                        <th>Kode</th>
                                        <th>Tanggal</th>
                                        <th>Menit Terlambat</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topLateEmployees.slice(0, 8).flatMap((item, idx) =>
                                        item.late_per_day.map((late, lateIdx) => (
                                            <tr key={`${item.id || item.name}-${late.date}`}>
                                                <td>{idx + 1}</td>
                                                <td className="font-semibold">{item.name}</td>
                                                <td>{item.employee_code || '-'}</td>
                                                <td>{late.date ? new Date(late.date).toLocaleDateString('id-ID') : '-'}</td>
                                                <td>{late.minutes || 0}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center opacity-70 py-10">Belum ada yang terlambat hari ini</div>
                    )}
                </TitleCard>
            </div>

            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                <TitleCard title="Permohonan Cuti/Izin Pending" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra table-sm">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Tipe</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingLeaves.slice(0, 6).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-semibold">{item.employee_name}</div>
                                            <div className="text-xs opacity-70">{item.employee_code}</div>
                                        </td>
                                        <td>{item.leave_type}</td>
                                        <td>{new Date(item.start_date).toLocaleDateString('id-ID')} - {new Date(item.end_date).toLocaleDateString('id-ID')}</td>
                                        <td><span className="badge badge-warning badge-sm">{item.status}</span></td>
                                    </tr>
                                ))}
                                {pendingLeaves.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center opacity-70">Tidak ada pengajuan cuti/izin pending</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>

                <TitleCard title="Reimbursement Pending" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra table-sm">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Jenis</th>
                                    <th>Jumlah</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingReimbursements.slice(0, 6).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-semibold">{item.employee_name}</div>
                                            <div className="text-xs opacity-70">{item.employee_code}</div>
                                        </td>
                                        <td>{item.reimbursement_type || '-'}</td>
                                        <td className="font-semibold">Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}</td>
                                        <td><span className="badge badge-warning badge-sm">{item.status}</span></td>
                                    </tr>
                                ))}
                                {pendingReimbursements.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center opacity-70">Tidak ada reimbursement pending</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>
            </div>

            <TitleCard title="Riwayat Aksi Persetujuan Terbaru" topMargin="mt-6">
                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Tipe</th>
                                <th>Pegawai</th>
                                <th>Detail</th>
                                <th>Status</th>
                                <th>Tanggal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentActions.map((item) => (
                                <tr key={`${item.type}-${item.id}`}>
                                    <td><span className="badge badge-ghost badge-sm">{item.type}</span></td>
                                    <td>
                                        <div className="font-semibold">{item.employee_name}</div>
                                        <div className="text-xs opacity-70">{item.employee_code}</div>
                                    </td>
                                    <td>{item.detail || '-'}</td>
                                    <td>
                                        <span className={`badge badge-sm ${item.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td>{item.action_date ? new Date(item.action_date).toLocaleString('id-ID') : '-'}</td>
                                </tr>
                            ))}
                            {recentActions.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center opacity-70">Belum ada riwayat persetujuan</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </TitleCard>
        </>
    )
}

export default AtasanDashboard
