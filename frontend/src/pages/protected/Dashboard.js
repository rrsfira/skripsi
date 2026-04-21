import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'

function InternalPage(){
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [dashboard, setDashboard] = useState(null)

    const loadDashboard = async () => {
        try {
            setLoading(true)
            setError('')
            const result = await adminApi.getDashboard()
            setDashboard(result)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title : 'Dashboard Direktur'}))
        loadDashboard()
            }, [dispatch])

    if (loading) {
        return <div className="text-center py-10">Memuat dashboard direktur...</div>
    }

    if (error) {
        return (
            <TitleCard title="Dashboard Direktur" topMargin="mt-0">
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
                <button className="btn btn-primary mt-4" onClick={loadDashboard}>Muat Ulang</button>
            </TitleCard>
        )
    }

    const employees = dashboard?.overview?.employees || {}
    const users = dashboard?.overview?.users || {}
    const attendanceToday = dashboard?.overview?.attendance_today || {}
    const pending = dashboard?.overview?.pending_approvals || {}
    const todayDate = new Date().toISOString().slice(0, 10)
    const attendanceSummaryCards = [
        { key: 'present', label: 'Hadir', value: attendanceToday.present || 0, path: `/app/attendance?status=hadir&date=${todayDate}` },
        { key: 'late', label: 'Terlambat', value: attendanceToday.late || 0, path: `/app/attendance?status=late&date=${todayDate}` },
        { key: 'alpha', label: 'Alpha', value: attendanceToday.alpha || 0, path: `/app/attendance?status=alpha&date=${todayDate}` },
        { key: 'absent', label: 'Tidak Hadir', value: attendanceToday.absent || 0, path: `/app/attendance?status=absent&date=${todayDate}` },
    ]

    const approvalQueueItems = [
        {
            key: 'leave',
            title: 'Cuti / Izin',
            count: pending.leave_requests || 0,
            badgeClass: 'badge-primary',
            path: '/app/leave-requests',
            desc: 'Menunggu review persetujuan',
        },
        {
            key: 'reimbursement',
            title: 'Reimbursement',
            count: pending.reimbursements || 0,
            badgeClass: 'badge-secondary',
            path: '/app/reimbursements',
            desc: 'Menunggu approval reimbursement',
        },
        {
            key: 'salary-appeal',
            title: 'Banding Gaji',
            count: pending.salary_appeals || 0,
            badgeClass: 'badge-accent',
            path: '/app/salary-appeals',
            desc: 'Pengajuan banding gaji aktif',
        },
    ]

    const statCards = [
        { title: 'Total Pegawai', value: employees.total_employees || 0, path: '/app/employees' },
        { title: 'Total User', value: users.total_users || 0, path: '/app/users' },
        { title: 'User Aktif', value: users.active_users || 0, path: '/app/users' },
        { title: 'Pending Approval', value: pending.total || 0, path: '/app/leave-requests' },
    ]

    return(
        <>
            <div className="grid grid-cols-4 gap-2 sm:gap-4 lg:gap-6">
                {statCards.map((item) => (
                    <button
                        key={item.title}
                        type="button"
                        onClick={() => navigate(item.path)}
                        className="stat bg-base-100 rounded-box shadow text-left hover:bg-base-200/60 transition cursor-pointer"
                    >
                        <div className="stat-title text-xs leading-tight">{item.title}</div>
                        <div className="stat-value text-primary text-lg sm:text-2xl lg:text-3xl">{item.value}</div>
                        <div className="stat-desc opacity-70 text-xs">Klik detail &rarr;</div>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                <TitleCard title="Ringkasan Kehadiran Hari Ini" topMargin="mt-0">
                    <div className="grid grid-cols-2 gap-4">
                        {attendanceSummaryCards.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className="p-4 rounded-lg bg-base-200 hover:bg-base-300/70 transition text-left"
                            >
                                <p className="text-sm opacity-70">{item.label}</p>
                                <p className="text-2xl font-bold">{item.value}</p>
                                <p className="text-xs opacity-60 mt-1">Klik detail &rarr;</p>
                            </button>
                        ))}
                    </div>
                </TitleCard>

                <TitleCard title="Antrian Persetujuan" topMargin="mt-0">
                    <div className="space-y-3">
                        {approvalQueueItems.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className="w-full p-4 rounded-xl border border-base-300 bg-base-100 hover:bg-base-200/60 transition text-left"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{item.title}</p>
                                        <p className="text-xs opacity-70 mt-0.5 truncate">{item.desc}</p>
                                    </div>
                                    <span className={`badge ${item.badgeClass} badge-lg shrink-0`}>{item.count}</span>
                                </div>
                            </button>
                        ))}
                        <div className="text-xs opacity-60 pt-1">Klik baris untuk membuka detail antrian.</div>
                    </div>
                </TitleCard>
            </div>

            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6 mt-6">
                <TitleCard title="User Terbaru" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dashboard?.recent_activity?.new_users || []).map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td><span className="badge">{user.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>

                <TitleCard title="Pegawai Terbaru" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Kode</th>
                                    <th>Nama</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dashboard?.recent_activity?.new_employees || []).map((employee) => (
                                    <tr key={employee.employee_code}>
                                        <td>{employee.employee_code}</td>
                                        <td>{employee.name}</td>
                                        <td><span className="badge">{employee.employment_status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>
            </div>
        </>
    )
}

export default InternalPage
