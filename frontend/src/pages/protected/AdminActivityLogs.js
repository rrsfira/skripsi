import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'

const INITIAL_FILTERS = {
    search: '',
    action: '',
    module: '',
    status: '',
    page: 1,
    limit: 20,
}

// 🎯 Badge helpers
const getActionBadge = (action) => {
    switch (action?.toUpperCase()) {
        case 'CREATE':
        case 'TAMBAH':
            return 'badge-success'
        case 'UPDATE':
        case 'EDIT':
            return 'badge-info'
        case 'DELETE':
        case 'HAPUS':
            return 'badge-error'
        default:
            return 'badge-ghost'
    }
}

const getModuleBadge = (module) => {
    switch (module?.toLowerCase()) {
        case 'attendance':
        case 'kehadiran':
            return 'badge-success'
        case 'leave':
        case 'cuti':
            return 'badge-secondary'
        case 'permit':
        case 'izin':
            return 'badge-warning'
        case 'reimbursement':
            return 'badge-accent'
        case 'payroll':
        case 'gaji':
            return 'badge-info'
        case 'salary_appeals':
        case 'banding gaji':
            return 'badge-error'
        default:
            return 'badge-ghost'
    }
}

function AdminActivityLogs() {
    const dispatch = useDispatch()
    const [filters, setFilters] = useState(INITIAL_FILTERS)
    const [logs, setLogs] = useState([])
    const [summary, setSummary] = useState({ byAction: [], byModule: [], byRole: [] })
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
    const [loading, setLoading] = useState(true)
    const [restoringLogId, setRestoringLogId] = useState(null)
    const [error, setError] = useState('')

    const restorableModules = new Set([
        'users',
        'employees',
        'job_openings',
        'payroll',
        'salary_appeals',
        'working_hours',
    ])

    const loadData = async (customFilters = filters) => {
        try {
            setLoading(true)
            setError('')
            const [logsData, summaryData] = await Promise.all([
                adminApi.getActivityLogs(customFilters),
                adminApi.getActivitySummary(7),
            ])

            setLogs(logsData.data || [])
            setPagination(logsData.pagination || { page: 1, totalPages: 1 })
            setSummary(summaryData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Log Aktivitas' }))
        loadData(INITIAL_FILTERS)
    }, [])

    const handleFilterChange = (field, value) => {
        setFilters((prev) => ({ ...prev, [field]: value }))
    }

    const handleApplyFilter = () => {
        const nextFilters = { ...filters, page: 1 }
        setFilters(nextFilters)
        loadData(nextFilters)
    }

    const changePage = (nextPage) => {
        const nextFilters = { ...filters, page: nextPage }
        setFilters(nextFilters)
        loadData(nextFilters)
    }

    const canRestoreLog = (log) => {
        const action = String(log?.action || '').toUpperCase()
        const status = String(log?.status || '').toLowerCase()
        const moduleName = String(log?.module || '').toLowerCase()
        const targetId =
            log?.new_values?.target_id ||
            log?.new_values?.targetId ||
            log?.new_values?.id

        return (
            action === 'DELETE' &&
            status === 'success' &&
            restorableModules.has(moduleName) &&
            targetId
        )
    }

    const getRelatedActivityLogId = (log) => {
        if (String(log?.action).toUpperCase() !== 'RESTORE') return null

        try {
            const parsed =
                typeof log.new_values === 'string'
                    ? JSON.parse(log.new_values)
                    : log.new_values

            return parsed?.activity_log_id || null
        } catch {
            return null
        }
    }

    const restoredLogIds = useMemo(() => {
        const ids = new Set()
        logs.forEach((log) => {
            const id = getRelatedActivityLogId(log)
            if (id) ids.add(Number(id))
        })
        return ids
    }, [logs])

    const handleRestore = async (log) => {
        if (!canRestoreLog(log)) return

        if (!window.confirm('Pulihkan data dari log ini?')) return

        try {
            setRestoringLogId(log.id)
            await adminApi.restoreByActivityLog(log.id)
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setRestoringLogId(null)
        }
    }

    return (
        <>
            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            {/* 📊 SUMMARY */}
            <TitleCard title="Ringkasan Aktivitas 7 Hari">
                <div className="grid md:grid-cols-3 gap-4">
                    {['byAction', 'byModule', 'byRole'].map((key, i) => (
                        <div key={i} className="bg-base-200 p-4 rounded-lg">
                            <h4 className="font-semibold mb-2 capitalize">
                                {key.replace('by', 'Per ')}
                            </h4>
                            {(summary[key] || []).slice(0, 5).map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span>{item.action || item.module || item.role}</span>
                                    <span className="font-medium">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </TitleCard>

            {/* 📋 LOG TABLE */}
            <TitleCard title="Log Aktivitas" topMargin="mt-6">
                <p className="text-sm opacity-70 mb-4">
                    Memantau aktivitas tambah, edit, hapus pada kehadiran, cuti,
                    izin, reimbursement, gaji, dan banding gaji
                </p>

                {/* 🔍 FILTER */}
                <div className="flex flex-wrap gap-3 mb-4">
                    <input
                        className="input input-bordered w-full md:w-64"
                        placeholder="Cari aktivitas..."
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />

                    <select
                        className="select select-bordered"
                        value={filters.module}
                        onChange={(e) => handleFilterChange('module', e.target.value)}
                    >
                        <option value="">Semua Modul</option>
                        <option value="attendance">Kehadiran</option>
                        <option value="leave">Cuti</option>
                        <option value="permit">Izin</option>
                        <option value="reimbursement">Reimbursement</option>
                        <option value="payroll">Gaji</option>
                        <option value="salary_appeals">Banding Gaji</option>
                    </select>

                    <select
                        className="select select-bordered"
                        value={filters.action}
                        onChange={(e) => handleFilterChange('action', e.target.value)}
                    >
                        <option value="">Semua Aksi</option>
                        <option value="CREATE">Tambah</option>
                        <option value="UPDATE">Edit</option>
                        <option value="DELETE">Hapus</option>
                    </select>

                    <select
                        className="select select-bordered"
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                    </select>

                    <button className="btn btn-primary" onClick={handleApplyFilter}>
                        Terapkan
                    </button>
                </div>

                {/* 📊 TABLE */}
                {loading ? (
                    <div>Memuat...</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>Pengguna</th>
                                        <th>Modul</th>
                                        <th>Aksi</th>
                                        <th>Status</th>
                                        <th>Deskripsi</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="text-sm">
                                                {new Date(log.created_at).toLocaleString('id-ID')}
                                            </td>

                                            <td>
                                                <div className="font-medium">{log.username}</div>
                                                <div className="text-xs opacity-60">{log.role}</div>
                                            </td>

                                            <td>
                                                <span className={`badge ${getModuleBadge(log.module)}`}>
                                                    {log.module}
                                                </span>
                                            </td>

                                            <td>
                                                <span className={`badge ${getActionBadge(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>

                                            <td>
                                                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                    {log.status}
                                                </span>
                                            </td>

                                            <td className="max-w-xs truncate text-sm">
                                                {log.description}
                                            </td>

                                            <td>
                                                {canRestoreLog(log) && !restoredLogIds.has(log.id) ? (
                                                    <button
                                                        className="btn btn-xs btn-warning btn-outline"
                                                        onClick={() => handleRestore(log)}
                                                        disabled={restoringLogId === log.id}
                                                    >
                                                        {restoringLogId === log.id ? 'Memulihkan...' : 'Pulihkan'}
                                                    </button>
                                                ) : restoredLogIds.has(log.id) ? (
                                                    <span className="text-xs text-success">
                                                        Sudah dipulihkan
                                                    </span>
                                                ) : (
                                                    <span className="text-xs opacity-50">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 🔄 PAGINATION */}
                        <div className="join mt-4">
                            <button
                                className="join-item btn"
                                disabled={pagination.page <= 1}
                                onClick={() => changePage(pagination.page - 1)}
                            >
                                Prev
                            </button>
                            <button className="join-item btn btn-disabled">
                                Page {pagination.page} / {pagination.totalPages}
                            </button>
                            <button
                                className="join-item btn"
                                disabled={pagination.page >= pagination.totalPages}
                                onClick={() => changePage(pagination.page + 1)}
                            >
                                Next
                            </button>
                        </div>
                    </>
                )}
            </TitleCard>
        </>
    )
}

export default AdminActivityLogs