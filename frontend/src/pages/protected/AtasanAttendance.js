import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { atasanApi } from '../../features/atasan/api'

function AtasanAttendance() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState(null)
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        employeeId: 'all',
        status: 'all'
    })
    const [records, setRecords] = useState([])
    const [allRecords, setAllRecords] = useState([])
    const [teamMembers, setTeamMembers] = useState([])

    const formatLateDuration = (lateMinutes) => {
        const minutes = Number(lateMinutes)
        if (!Number.isFinite(minutes) || minutes <= 0) {
            return '00 jam 00 menit 00 detik'
        }

        const totalSeconds = Math.round(minutes * 60)
        const hours = Math.floor(totalSeconds / 3600)
        const remainingSeconds = totalSeconds % 3600
        const mins = Math.floor(remainingSeconds / 60)
        const secs = remainingSeconds % 60

        const [hh, mm, ss] = [hours, mins, secs].map((value) => String(value).padStart(2, '0'))
        return `${hh} jam ${mm} menit ${ss} detik`
    }

    const loadTeamMembers = useCallback(async () => {
        try {
            const result = await atasanApi.getTeamMembers()
            setTeamMembers(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        }
    }, [dispatch])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await atasanApi.getAttendanceRecords({ month: filters.month, year: filters.year })
            const source = result?.data || []
            setAllRecords(source)
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [filters.month, filters.year, dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Kehadiran Tim' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        loadTeamMembers()
    }, [loadTeamMembers])

    useEffect(() => {
        let filteredRecords = allRecords

        if (filters.employeeId !== 'all') {
            filteredRecords = filteredRecords.filter((item) => String(item.employee_id) === String(filters.employeeId))
        }

        if (filters.status !== 'all') {
            if (filters.status === 'terlambat') {
                filteredRecords = filteredRecords.filter((item) => Boolean(item.is_late))
            } else {
                filteredRecords = filteredRecords.filter((item) => String(item.status) === filters.status)
            }
        }

        setRecords(filteredRecords)
    }, [allRecords, filters.employeeId, filters.status])

    const updateStatus = async (id, status) => {
        try {
            setUpdatingId(id)
            await atasanApi.updateAttendanceStatus(id, status)
            dispatch(showNotification({ message: 'Status kehadiran berhasil diperbarui', status: 1 }))
            loadData()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setUpdatingId(null)
        }
    }

    const summary = records.reduce((acc, item) => {
        const key = item.status || 'unknown'
        acc[key] = (acc[key] || 0) + 1
        if (item.is_late) {
            acc.late = (acc.late || 0) + 1
            acc.late_minutes = (acc.late_minutes || 0) + (Number(item.late_minutes) || 0)
        }
        return acc
    }, {})

    return (
        <>
            <TitleCard title="Laporan Kehadiran Tim" topMargin="mt-0">
                <div className="grid md:grid-cols-4 grid-cols-1 gap-4 mb-6">
                    <select
                        className="select select-bordered"
                        value={filters.month}
                        onChange={(e) => setFilters((prev) => ({ ...prev, month: e.target.value }))}
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
                    >
                        {Array.from({ length: 5 }, (_, idx) => {
                            const year = new Date().getFullYear() - idx
                            return <option key={year} value={year}>{year}</option>
                        })}
                    </select>
                    <select
                        className="select select-bordered"
                        value={filters.employeeId}
                        onChange={(e) => setFilters((prev) => ({ ...prev, employeeId: e.target.value }))}
                    >
                        <option value="all">Semua Anggota Tim</option>
                        {teamMembers.map((member) => (
                            <option key={member.employee_id} value={member.employee_id}>
                                {member.employee_name} {member.employee_code ? `(${member.employee_code})` : ''}
                            </option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={filters.status}
                        onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="all">Semua Status</option>
                        <option value="hadir">Hadir</option>
                        <option value="izin">Izin</option>
                        <option value="sakit">Sakit</option>
                        <option value="alpha">Alpha</option>
                        <option value="libur">Libur</option>
                        <option value="terlambat">Terlambat</option>
                    </select>
                </div>

                <div className="grid md:grid-cols-6 grid-cols-2 gap-4 mb-6">
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
                        <div className="stat-value text-xl">{summary.libur || 0}</div>
                    </div>
                    <div className="stat rounded-lg bg-base-200">
                        <div className="stat-title">Terlambat</div>
                        <div className="stat-value text-xl">{summary.late || 0}</div>
                        <div className="stat-desc">{formatLateDuration(summary.late_minutes || 0)}</div>
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
                                    <th>Ubah Status</th>
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
                                        <td><span className="badge badge-outline">{item.status}</span></td>
                                        <td>{['izin', 'sakit', 'libur', 'alpha'].includes(String(item.status || '').toLowerCase()) ? '-' : (item.is_late ? formatLateDuration(item.late_minutes || 0) : 'Tidak')}</td>
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
                                    </tr>
                                ))}
                                {records.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Tidak ada data kehadiran</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>
        </>
    )
}

export default AtasanAttendance
