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
        dispatch(setPageTitle({ title : 'Dashboard Admin'}))
        loadDashboard()
            }, [dispatch])

    if (loading) {
        return <div className="text-center py-10">Memuat dashboard admin...</div>
    }

    if (error) {
        return (
            <TitleCard title="Dashboard Admin" topMargin="mt-0">
                <div className="alert alert-error">
                    <span>{error}</span>
                </div>
                <button className="btn btn-primary mt-4" onClick={loadDashboard}>Muat Ulang</button>
            </TitleCard>
        )
    }

    const employees = dashboard?.overview?.employees || {}
    const users = dashboard?.overview?.users || {}
    const recentUsers = dashboard?.recent_activity?.new_users || []
    const recentEmployees = dashboard?.recent_activity?.new_employees || []
    const departmentStats = dashboard?.departments || []
    const shiftStats = dashboard?.shifts || []

    const adminQuickActions = [
        {
            key: 'users',
            title: 'Kelola Pengguna',
            desc: 'Tambah, ubah, atau nonaktifkan akun dan peran pengguna.',
            path: '/app/users',
            badge: users.total_users || 0,
        },
        {
            key: 'employees',
            title: 'Data Pegawai',
            desc: 'Pantau data pegawai, jabatan, dan kelengkapan informasi.',
            path: '/app/employees',
            badge: employees.total_employees || 0,
        },
        {
            key: 'activity-logs',
            title: 'Log Aktivitas',
            desc: 'Lihat aktivitas sistem, perubahan data, dan histori akses.',
            path: '/app/activity-logs',
            badge: recentUsers.length + recentEmployees.length,
        },
    ]

    const statCards = [
        { title: 'Total Pegawai', value: employees.total_employees || 0, path: '/app/employees' },
        { title: 'Total User', value: users.total_users || 0, path: '/app/users' },
        { title: 'User Aktif', value: users.active_users || 0, path: '/app/users' },
        { title: 'User Nonaktif', value: users.inactive_users || 0, path: '/app/users' },
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
                <TitleCard title="Distribusi Departemen" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Departemen</th>
                                    <th>Jumlah Pegawai</th>
                                    <th>Rata-rata Gaji</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departmentStats.slice(0, 5).map((department) => (
                                    <tr key={`${department.name}-${department.code}`}>
                                        <td>
                                            <div className="font-semibold">{department.name}</div>
                                            <div className="text-xs opacity-70">{department.code || '-'}</div>
                                        </td>
                                        <td>{department.employee_count || 0}</td>
                                        <td>Rp {(Number(department.avg_salary) || 0).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                                {departmentStats.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center opacity-70">Belum ada data departemen</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>

                <TitleCard title="Informasi Shift" topMargin="mt-0">
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Shift</th>
                                    <th>Jam Masuk</th>
                                    <th>Jam Pulang</th>
                                    <th>Pegawai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shiftStats.slice(0, 5).map((shift) => (
                                    <tr key={`${shift.shift_name}-${shift.check_in_time}-${shift.check_out_time}`}>
                                        <td className="font-semibold">{shift.shift_name}</td>
                                        <td>{shift.check_in_time || '-'}</td>
                                        <td>{shift.check_out_time || '-'}</td>
                                        <td>{shift.employee_count || 0}</td>
                                    </tr>
                                ))}
                                {shiftStats.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center opacity-70">Belum ada data shift</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                                {recentUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.name}</td>
                                        <td>{user.email}</td>
                                        <td><span className="badge">{user.status}</span></td>
                                    </tr>
                                ))}
                                {recentUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center opacity-70">Belum ada user terbaru</td>
                                    </tr>
                                )}
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
                                {recentEmployees.map((employee) => (
                                    <tr key={employee.employee_code}>
                                        <td>{employee.employee_code}</td>
                                        <td>{employee.name}</td>
                                        <td><span className="badge">{employee.employment_status}</span></td>
                                    </tr>
                                ))}
                                {recentEmployees.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="text-center opacity-70">Belum ada pegawai terbaru</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </TitleCard>
            </div>
        </>
    )
}

export default InternalPage
