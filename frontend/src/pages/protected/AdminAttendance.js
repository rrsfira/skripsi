import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'
import { getHolidaysInMonth } from '../../utils/attendanceUtils'

function AdminAttendance() {
    const dispatch = useDispatch()
    const location = useLocation()
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState({
        date: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        employeeSearch: '',
        status: 'all',
    })
    const [records, setRecords] = useState([])
    const [allRecords, setAllRecords] = useState([])
    const [employees, setEmployees] = useState([])
    const [updatingId, setUpdatingId] = useState(null)
    const updateStatus = async (id, status) => {
        try {
            setUpdatingId(id)
            await adminApi.updateAttendanceStatus(id, status)
            dispatch(showNotification({ message: 'Status kehadiran berhasil diperbarui', status: 1 }))
            await loadData()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setUpdatingId(null)
        }
    }

    const loadEmployees = useCallback(async () => {
        try {
            const result = await adminApi.getAttendanceMembers()
            setEmployees(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        }
    }, [dispatch])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const params = filters.date
                ? { date: filters.date }
                : { month: filters.month, year: filters.year }
            const result = await adminApi.getAttendanceRecords(params)
            setAllRecords(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [filters.date, filters.month, filters.year, dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Kehadiran Pegawai' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        loadEmployees()
    }, [loadEmployees])

    useEffect(() => {
        // Auto refresh saat halaman kehadiran dibuka/diakses kembali.
        if (location.pathname === '/app/attendance') {
            loadData()
            loadEmployees()
        }
    }, [location.key, location.pathname, loadData, loadEmployees])

    useEffect(() => {
        // Auto refresh berkala agar data terbaru tampil tanpa tombol refresh.
        const refreshInterval = setInterval(() => {
            loadData()
        }, 30000)

        return () => clearInterval(refreshInterval)
    }, [loadData])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const statusFromQuery = String(params.get('status') || '').toLowerCase()
        const dateFromQuery = String(params.get('date') || '')
        const allowedStatuses = new Set(['all', 'hadir', 'izin', 'sakit', 'alpha', 'libur', 'late', 'absent'])
        const nextStatus = allowedStatuses.has(statusFromQuery) ? statusFromQuery : 'all'

        setFilters((prev) => {
            const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFromQuery) ? dateFromQuery : prev.date
            if (prev.status === nextStatus && prev.date === nextDate) return prev
            return { ...prev, status: nextStatus, date: nextDate }
        })
    }, [location.search])

    useEffect(() => {
        let filtered = allRecords

        const employeeQuery = String(filters.employeeSearch || '').trim().toLowerCase()
        if (employeeQuery) {
            filtered = filtered.filter((item) => {
                const name = String(item.employee_name || '').toLowerCase()
                const code = String(item.employee_code || '').toLowerCase()
                const codeName = `${code} - ${name}`.trim()
                const nameCode = `${name} - ${code}`.trim()
                return (
                    name.includes(employeeQuery) ||
                    code.includes(employeeQuery) ||
                    codeName.includes(employeeQuery) ||
                    nameCode.includes(employeeQuery)
                )
            })
        }

        if (filters.status !== 'all') {
            if (filters.status === 'late') {
                filtered = filtered.filter((item) => {
                    const status = String(item.status || '').toLowerCase()
                    const isWorkdayStatus = !['izin', 'sakit', 'libur', 'alpha', 'absent'].includes(status)
                    return isWorkdayStatus && Boolean(item.is_late)
                })
            } else if (filters.status === 'absent') {
                filtered = filtered.filter((item) => {
                    const status = String(item.status || '').toLowerCase()
                    return status === 'alpha' || status === 'absent'
                })
            } else {
                filtered = filtered.filter((item) => String(item.status).toLowerCase() === filters.status)
            }
        }

        setRecords(filtered)
    }, [allRecords, filters.employeeSearch, filters.status])

    const sortedEmployees = useMemo(() => {
        return [...employees].sort((a, b) => {
            const codeA = String(a.employee_code || '')
            const codeB = String(b.employee_code || '')
            if (!codeA && !codeB) {
                return String(a.employee_name || '').localeCompare(String(b.employee_name || ''), 'id')
            }
            if (!codeA) return 1
            if (!codeB) return -1
            return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' })
        })
    }, [employees])

    const summary = records.reduce((acc, item) => {
        const key = item.status || 'unknown'
        acc[key] = (acc[key] || 0) + 1
        return acc
    }, {})

    const holidayDateCount = useMemo(() => {
        if (filters.date) {
            return getHolidaysInMonth(Number(filters.date.slice(5, 7)), Number(filters.date.slice(0, 4)))
                .some((holiday) => holiday.date === filters.date)
                ? 1
                : 0
        }
        return getHolidaysInMonth(Number(filters.month), Number(filters.year)).length
    }, [filters.date, filters.month, filters.year])

    return (
        <TitleCard title="Laporan Kehadiran Pegawai" topMargin="mt-0">
            <div className="grid md:grid-cols-5 grid-cols-1 gap-4 mb-6">
                <input
                    type="date"
                    className="input input-bordered"
                    value={filters.date}
                    onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
                />
                <select
                    className="select select-bordered"
                    value={filters.month}
                    onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
                    disabled={Boolean(filters.date)}
                >
                    {Array.from({ length: 12 }, (_, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                            {new Date(2000, idx).toLocaleString('id-ID', { month: 'long' })}
                        </option>
                    ))}
                </select>
                <select
                    className="select select-bordered"
                    value={filters.year}
                    onChange={(e) => setFilters((prev) => ({ ...prev, year: e.target.value }))}
                    disabled={Boolean(filters.date)}
                >
                    {Array.from({ length: 5 }, (_, idx) => {
                        const year = new Date().getFullYear() - idx
                        return <option key={year} value={year}>{year}</option>
                    })}
                </select>
                <input
                    className="input input-bordered"
                    list="attendance-employee-options"
                    placeholder="Filter pegawai (kode + nama)"
                    value={filters.employeeSearch}
                    onChange={(e) => setFilters((prev) => ({ ...prev, employeeSearch: e.target.value }))}
                />
                <datalist id="attendance-employee-options">
                    {sortedEmployees.map((member) => (
                        <option
                            key={member.employee_id}
                            value={member.employee_code ? `${member.employee_code} - ${member.employee_name}` : member.employee_name}
                        />
                    ))}
                </datalist>
                <select
                    className="select select-bordered"
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                >
                    <option value="all">Semua Status</option>
                    <option value="hadir">Hadir</option>
                    <option value="late">Terlambat</option>
                    <option value="izin">Izin</option>
                    <option value="sakit">Sakit</option>
                    <option value="alpha">Alpha</option>
                    <option value="absent">Tidak Hadir</option>
                    <option value="libur">Libur</option>
                </select>
            </div>

            <div className="grid md:grid-cols-5 grid-cols-2 gap-4 mb-6">
                <div className="stat rounded-lg bg-base-200">
                    <div className="stat-title">Hadir</div>
                    <div className="stat-value text-xl">{summary.hadir || 0}</div>
                </div>
                <div className="stat rounded-lg bg-base-200">
                    <div className="stat-title">Izin</div>
                    <div className="stat-value text-xl">{summary.izin || 0}</div>
                </div>
                <div className="stat rounded-lg bg-base-200">
                    <div className="stat-title">Sakit</div>
                    <div className="stat-value text-xl">{summary.sakit || 0}</div>
                </div>
                <div className="stat rounded-lg bg-base-200">
                    <div className="stat-title">Alpha</div>
                    <div className="stat-value text-xl">{summary.alpha || 0}</div>
                </div>
                <div className="stat rounded-lg bg-base-200">
                    <div className="stat-title">Libur</div>
                    <div className="stat-value text-xl">{holidayDateCount} hari </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10">Memuat data kehadiran...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Pegawai</th>
                                <th>Check In</th>
                                <th>Check Out</th>
                                <th>Status</th>
                                <th>Terlambat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((item) => (
                                <tr key={item.id}>
                                    <td>{new Date(item.date).toLocaleDateString('id-ID')}</td>
                                    <td>
                                        <div className="font-semibold">{item.employee_name}</div>
                                        <div className="text-xs opacity-70">{item.employee_code}</div>
                                    </td>
                                    <td>{item.check_in || '-'}</td>
                                    <td>{item.check_out || '-'}</td>
                                    <td>
                                        <select
                                            className={`select select-bordered select-xs ${updatingId === item.id ? 'loading' : ''}`}
                                            value={item.status}
                                            onChange={(e) => updateStatus(item.id, e.target.value)}
                                            disabled={updatingId === item.id}
                                        >
                                            <option value="hadir">hadir</option>
                                            <option value="izin">izin</option>
                                            <option value="sakit">sakit</option>
                                            <option value="alpha">alpha</option>
                                            <option value="libur">libur</option>
                                        </select>
                                    </td>
                                    <td>
                                        {(() => {
                                            const status = String(item.status || '').toLowerCase()
                                            if (status === 'alpha') return '-'
                                            if (['izin', 'sakit', 'libur'].includes(status)) return '-'
                                            return item.is_late ? `${item.late_minutes || 0} menit` : 'Tidak'
                                        })()}
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center opacity-70">Tidak ada data kehadiran</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </TitleCard>
    )
}

export default AdminAttendance
