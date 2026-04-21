import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { hrApi } from '../../features/hr/api'
import { 
    UserGroupIcon, 
    DocumentTextIcon, 
    WalletIcon, 
    CheckCircleIcon
} from '@heroicons/react/24/outline'

function HRDashboard() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dashboard, setDashboard] = useState(null)

    const loadDashboard = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const result = await hrApi.getDashboard()
            setDashboard(result)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Dashboard HR' }))
        loadDashboard()
    }, [dispatch, loadDashboard])

    if (loading) {
        return <div className="text-center py-10 text-lg">Memuat dashboard HR...</div>
    }

    if (error) {
        return (
            <TitleCard title="Dashboard HR" topMargin="mt-0">
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
                <button className="btn btn-primary" onClick={loadDashboard}>Muat Ulang</button>
            </TitleCard>
        )
    }

    const employeeOverview = dashboard?.employee_overview || {}
    const attendanceToday = dashboard?.attendance_today || {}
    const leaveManagement = dashboard?.leave_management || {}
    const reimbursementValidation = dashboard?.reimbursement_validation || {}
    const salaryAppeals = dashboard?.salary_appeals || {}
    const attendanceSummary = dashboard?.attendance_summary || {}
    const organization = dashboard?.organization || {}
    const todayDate = new Date().toISOString().split('T')[0]
    const leaveYearlyTotal = Number(leaveManagement.stats?.yearly_total || 0)
    const leaveMonthlyHistory = Number(leaveManagement.stats?.monthly_total || leaveManagement.stats?.total || 0)
    const reimbursementMonthlyHistory = Number(reimbursementValidation.stats?.total || 0) || (
        Number(reimbursementValidation.stats?.pending || 0) +
        Number(reimbursementValidation.stats?.approved_need_validation || 0) +
        Number(reimbursementValidation.stats?.validated || 0) +
        Number(reimbursementValidation.stats?.rejected || 0)
    )

    // Stats Cards Data
    const statCards = [
        {
            title: 'Total Pegawai',
            value: employeeOverview.total_employees || 0,
            icon: <UserGroupIcon className="w-8 h-8" />,
            color: 'text-info',
            bg: 'bg-info/10',
            detail: `Tetap: ${employeeOverview.permanent || 0} | Kontrak: ${employeeOverview.contract || 0} | Magang: ${employeeOverview.intern || 0}`,
            path: '/app/employees'
        },
        {
            title: 'Banding Gaji Pending',
            value: salaryAppeals.stats?.pending || 0,
            icon: <CheckCircleIcon className="w-8 h-8" />,
            color: 'text-success',
            bg: 'bg-success/10',
            detail: `Disetujui: ${salaryAppeals.stats?.approved || 0} | Ditolak: ${salaryAppeals.stats?.rejected || 0}`,
            path: '/app/salary-appeals'
        },
        {
            title: 'Permohonan Cuti/Izin',
            value: leaveYearlyTotal,
            icon: <DocumentTextIcon className="w-8 h-8" />,
            color: 'text-warning',
            bg: 'bg-warning/10',
            detail: `Riwayat Bulan Ini: ${leaveMonthlyHistory}`,
            path: '/app/leave-requests'
        },
        {
            title: 'Reimbursement Butuh Validasi',
            value: Number(reimbursementValidation.stats?.pending_validation_count || 0),
            icon: <WalletIcon className="w-8 h-8" />,
            color: 'text-primary',
            bg: 'bg-primary/10',
            detail: `Riwayat Bulan Ini: ${reimbursementMonthlyHistory}`,
            path: '/app/reimbursements'
        },
    ]

    return (
        <>
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
                {statCards.map((item, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="card w-full bg-base-100 border border-base-300 shadow-lg hover:shadow-xl hover:bg-base-200/40 transition text-left"
                    >
                        <div className="card-body p-2 sm:p-4 lg:p-6">
                            <div className="flex items-center justify-between">
                                <div className={`${item.bg} p-1.5 sm:p-2 lg:p-3 rounded-lg border border-base-300/60`}>
                                    <div className={`${item.color} [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-7 sm:[&>svg]:h-7 lg:[&>svg]:w-8 lg:[&>svg]:h-8`}>{item.icon}</div>
                                </div>
                            </div>
                            <div className="mt-2 sm:mt-4">
                                <p className="text-xs leading-tight text-base-content/70">{item.title}</p>
                                <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${item.color} mt-1`}>
                                    {item.value}
                                </p>
                                <p className="text-xs text-base-content/60 mt-1 hidden sm:block">{item.detail}</p>
                                <p className="text-xs text-base-content/60 mt-0.5">Klik &rarr;</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Attendance Today Detail */}
            <TitleCard title="Status Kehadiran Hari Ini" topMargin="mt-6">
                <div className="grid lg:grid-cols-5 md:grid-cols-3 grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => navigate(`/app/attendance?status=hadir&date=${todayDate}`)}
                        className="bg-success/10 p-4 rounded-lg text-center border border-success/30 hover:bg-success/20 transition"
                    >
                        <div className="text-success font-semibold">Hadir</div>
                        <div className="text-2xl font-bold text-success">
                            {attendanceToday.present || 0}
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/attendance?status=late&date=${todayDate}`)}
                        className="bg-warning/10 p-4 rounded-lg text-center border border-warning/30 hover:bg-warning/20 transition"
                    >
                        <div className="text-warning font-semibold">Terlambat</div>
                        <div className="text-2xl font-bold text-warning">
                            {attendanceToday.late || 0}
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/attendance?status=sakit&date=${todayDate}`)}
                        className="bg-info/10 p-4 rounded-lg text-center border border-info/30 hover:bg-info/20 transition"
                    >
                        <div className="text-info font-semibold">Sakit</div>
                        <div className="text-2xl font-bold text-info">
                            {attendanceToday.sakit || 0}
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/attendance?status=izin&date=${todayDate}`)}
                        className="bg-primary/10 p-4 rounded-lg text-center border border-primary/30 hover:bg-primary/20 transition"
                    >
                        <div className="text-primary font-semibold">Izin</div>
                        <div className="text-2xl font-bold text-primary">
                            {attendanceToday.izin || 0}
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/app/attendance?status=alpha&date=${todayDate}`)}
                        className="bg-error/10 p-4 rounded-lg text-center border border-error/30 hover:bg-error/20 transition"
                    >
                        <div className="text-error font-semibold">Alpha</div>
                        <div className="text-2xl font-bold text-error">
                            {attendanceToday.alpha || 0}
                        </div>
                    </button>
                </div>
            </TitleCard>

            {/* Second Row: Leave Requests & Reimbursements */}
            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                {/* Pending Leave Requests */}
                <TitleCard title="Permohonan Cuti/Izin Pending" topMargin="mt-0">
                    <div className="mb-4 flex gap-4 text-sm">
                        <span className="badge badge-warning">
                            Pending: {leaveManagement.stats?.pending || 0}
                        </span>
                        <span className="badge badge-success">
                            Disetujui: {leaveManagement.stats?.approved || 0}
                        </span>
                        <span className="badge badge-error">
                            Ditolak: {leaveManagement.stats?.rejected || 0}
                        </span>
                    </div>
                    {leaveManagement.pending_items?.length > 0 ? (
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
                                    {leaveManagement.pending_items.slice(0, 5).map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs text-base-content/60">{item.employee_code}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-sm">{item.leave_type}</span>
                                            </td>
                                            <td className="text-xs">
                                                {new Date(item.start_date).toLocaleDateString('id-ID')} - {new Date(item.end_date).toLocaleDateString('id-ID')}
                                            </td>
                                            <td>
                                                <span className="badge badge-warning badge-sm">{item.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-base-content/60 py-4">
                            Tidak ada permohonan cuti/izin pending
                        </div>
                    )}
                </TitleCard>

                {/* Reimbursements Need Validation */}
                <TitleCard title="Reimbursement Perlu Validasi" topMargin="mt-0">
                    <div className="mb-4 flex gap-4 text-sm">
                        <span className="badge badge-info">
                            Perlu Validasi: {Number(reimbursementValidation.stats?.pending_validation_count || 0)}
                        </span>
                        <span className="badge badge-success">
                            Tervalidasi: {reimbursementValidation.stats?.validated || 0}
                        </span>
                    </div>
                    {reimbursementValidation.need_validation?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>Pegawai</th>
                                        <th>Jumlah</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reimbursementValidation.need_validation.slice(0, 5).map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs text-base-content/60">{item.employee_code}</div>
                                            </td>
                                            <td className="font-semibold">
                                                Rp {(item.amount || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td>
                                                <span className="badge badge-info badge-sm">{item.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-base-content/60 py-4">
                            Tidak ada reimbursement yang perlu divalidasi
                        </div>
                    )}
                </TitleCard>
            </div>

            {/* Third Row: Salary Appeals & Attendance Summary */}
            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                {/* Salary Appeals */}
                <TitleCard title="Banding Gaji Pending Review" topMargin="mt-0">
                    <div className="mb-4 flex gap-4 text-sm">
                        <span className="badge badge-warning">
                            Pending: {salaryAppeals.stats?.pending || 0}
                        </span>
                        <span className="badge badge-success">
                            Disetujui: {salaryAppeals.stats?.approved || 0}
                        </span>
                        <span className="badge badge-error">
                            Ditolak: {salaryAppeals.stats?.rejected || 0}
                        </span>
                    </div>
                    {salaryAppeals.pending_reviews?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>Pegawai</th>
                                        <th>Periode</th>
                                        <th>Gaji</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salaryAppeals.pending_reviews.slice(0, 5).map((item, idx) => (
                                        <tr key={idx}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs text-base-content/60">{item.employee_code}</div>
                                            </td>
                                            <td className="text-sm">
                                                {item.period_month}/{item.period_year}
                                            </td>
                                            <td className="font-semibold">
                                                Rp {(item.net_salary || 0).toLocaleString('id-ID')}
                                            </td>
                                            <td>
                                                <span className="badge badge-warning badge-sm">{item.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-base-content/60 py-4">
                            Tidak ada banding gaji yang perlu direview
                        </div>
                    )}
                </TitleCard>

                {/* Monthly Attendance Summary */}
                <TitleCard title="Ringkasan Absensi Bulan Ini" topMargin="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="border-l-4 border-success pl-4">
                            <div className="text-base-content/70 text-sm">Total Hadir</div>
                            <div className="text-2xl font-bold text-success">
                                {attendanceSummary.hadir || 0}
                            </div>
                        </div>
                        <div className="border-l-4 border-warning pl-4">
                            <div className="text-base-content/70 text-sm">Total Terlambat</div>
                            <div className="text-2xl font-bold text-warning">
                                {attendanceSummary.total_late || 0}
                            </div>
                        </div>
                        <div className="border-l-4 border-info pl-4">
                            <div className="text-base-content/70 text-sm">Sakit</div>
                            <div className="text-2xl font-bold text-info">
                                {attendanceSummary.sakit || 0}
                            </div>
                        </div>
                        <div className="border-l-4 border-primary pl-4">
                            <div className="text-base-content/70 text-sm">Izin</div>
                            <div className="text-2xl font-bold text-primary">
                                {attendanceSummary.izin || 0}
                            </div>
                        </div>
                        <div className="border-l-4 border-error pl-4">
                            <div className="text-base-content/70 text-sm">Alpha</div>
                            <div className="text-2xl font-bold text-error">
                                {attendanceSummary.alpha || 0}
                            </div>
                        </div>
                        <div className="border-l-4 border-accent pl-4">
                            <div className="text-base-content/70 text-sm">Rata-rata Terlambat</div>
                            <div className="text-2xl font-bold text-accent">
                                {(parseFloat(attendanceSummary.avg_late_minutes) || 0).toFixed(0)} min
                            </div>
                        </div>
                    </div>
                </TitleCard>
            </div>

            {/* Fourth Row: Organization Overview */}
            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                {/* Department Distribution */}
                <TitleCard title="Distribusi Pegawai per Departemen" topMargin="mt-0">
                    {organization.departments?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>Departemen</th>
                                        <th>Kode</th>
                                        <th className="text-right">Jumlah Pegawai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {organization.departments.slice(0, 8).map((dept, idx) => (
                                        <tr key={idx}>
                                            <td className="font-semibold">{dept.name}</td>
                                            <td>
                                                <span className="badge badge-sm badge-ghost">{dept.code}</span>
                                            </td>
                                            <td className="text-right font-bold">
                                                {dept.employee_count || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-base-content/60 py-4">
                            Data departemen tidak tersedia
                        </div>
                    )}
                </TitleCard>

                {/* Position Distribution */}
                <TitleCard title="Distribusi Pegawai per Jabatan" topMargin="mt-0">
                    {organization.positions?.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>Jabatan</th>
                                        <th>Level</th>
                                        <th className="text-right">Jumlah Pegawai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {organization.positions.slice(0, 8).map((pos, idx) => (
                                        <tr key={idx}>
                                            <td className="font-semibold">{pos.name}</td>
                                            <td>
                                                <span className="badge badge-sm badge-primary">{pos.level}</span>
                                            </td>
                                            <td className="text-right font-bold">
                                                {pos.employee_count || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center text-base-content/60 py-4">
                            Data jabatan tidak tersedia
                        </div>
                    )}
                </TitleCard>
            </div>
        </>
    )
}

export default HRDashboard
