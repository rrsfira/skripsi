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
        const targetIdFromValues =
            log?.new_values?.target_id ||
            log?.new_values?.targetId ||
            log?.new_values?.id
        const targetIdFromDescription = String(log?.description || '').match(/ID\s*:\s*(\d+)/i)?.[1]
        const hasTargetId = Boolean(targetIdFromValues || targetIdFromDescription)

        return (
            action === 'DELETE' &&
            status === 'success' &&
            restorableModules.has(moduleName) &&
            hasTargetId
        )
    }

    const getRelatedActivityLogId = (log) => {
        const action = String(log?.action || '').toUpperCase()
        if (action !== 'RESTORE') return null

        let activityLogIdFromValues = null
        if (log?.new_values && typeof log.new_values === 'object') {
            activityLogIdFromValues = log.new_values.activity_log_id || null
        } else if (typeof log?.new_values === 'string') {
            try {
                const parsed = JSON.parse(log.new_values)
                activityLogIdFromValues = parsed?.activity_log_id || null
            } catch {
                activityLogIdFromValues = null
            }
        }

        if (activityLogIdFromValues) {
            const asNumber = Number(activityLogIdFromValues)
            return Number.isFinite(asNumber) ? asNumber : null
        }

        const desc = String(log?.description || '')
        const match = desc.match(/activity\s*log\s*id\s*:\s*(\d+)/i)
        if (!match) return null

        const fromDesc = Number(match[1])
        return Number.isFinite(fromDesc) ? fromDesc : null
    }

    const restoredLogIds = useMemo(() => {
        const ids = new Set()
        logs.forEach((log) => {
            const restoredFromLogId = getRelatedActivityLogId(log)
            if (restoredFromLogId) {
                ids.add(restoredFromLogId)
            }
        })
        return ids
    }, [logs])

    const handleRestore = async (log) => {
        if (!canRestoreLog(log)) return

        const confirmed = window.confirm('Pulihkan data dari log ini?')
        if (!confirmed) return

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
            {error ? (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            ) : null}

            <TitleCard title="Ringkasan Aktivitas 7 Hari" topMargin="mt-0">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4">
                    <div className="bg-base-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Per Aksi</h4>
                        <div className="space-y-1">
                            {(summary.byAction || []).slice(0, 5).map((item, idx) => (
                                <div key={`${item.action}-${idx}`} className="flex justify-between text-sm">
                                    <span>{item.action} ({item.status})</span>
                                    <span className="font-medium">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-base-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Per Modul</h4>
                        <div className="space-y-1">
                            {(summary.byModule || []).slice(0, 5).map((item) => (
                                <div key={item.module} className="flex justify-between text-sm">
                                    <span>{item.module}</span>
                                    <span className="font-medium">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-base-200 rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Per Role</h4>
                        <div className="space-y-1">
                            {(summary.byRole || []).slice(0, 5).map((item) => (
                                <div key={item.role} className="flex justify-between text-sm">
                                    <span>{item.role}</span>
                                    <span className="font-medium">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </TitleCard>

            <TitleCard title="Filter & Daftar Log" topMargin="mt-6">
                <div className="grid md:grid-cols-5 grid-cols-1 gap-3 mb-4">
                    <input
                        className="input input-bordered"
                        placeholder="Cari username/deskripsi"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                    <input
                        className="input input-bordered"
                        placeholder="Aksi (LOGIN/UPDATE)"
                        value={filters.action}
                        onChange={(e) => handleFilterChange('action', e.target.value)}
                    />
                    <input
                        className="input input-bordered"
                        placeholder="Modul"
                        value={filters.module}
                        onChange={(e) => handleFilterChange('module', e.target.value)}
                    />
                    <select
                        className="select select-bordered"
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button className="btn btn-primary" onClick={handleApplyFilter}>Terapkan</button>
                </div>

                {loading ? (
                    <div>Memuat log aktivitas...</div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm">
                                <thead>
                                    <tr>
                                        <th>Waktu</th>
                                        <th>User</th>
                                        <th>Role</th>
                                        <th>Aksi</th>
                                        <th>Modul</th>
                                        <th>Status</th>
                                        <th>Deskripsi</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td>{new Date(log.created_at).toLocaleString('id-ID')}</td>
                                            <td>{log.username}</td>
                                            <td>{log.role}</td>
                                            <td>{log.action}</td>
                                            <td>{log.module}</td>
                                            <td>
                                                <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-error'}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td>{log.description}</td>
                                            <td>
                                                {canRestoreLog(log) && !restoredLogIds.has(log.id) ? (
                                                    <button
                                                        className="btn btn-xs btn-outline btn-warning"
                                                        onClick={() => handleRestore(log)}
                                                        disabled={restoringLogId === log.id}
                                                    >
                                                        {restoringLogId === log.id ? 'Memulihkan...' : 'Pulihkan'}
                                                    </button>
                                                ) : restoredLogIds.has(log.id) ? (
                                                    <span className="text-xs text-success font-medium">Sudah dipulihkan</span>
                                                ) : (
                                                    <span className="text-xs opacity-60">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="join mt-4">
                            <button
                                className="join-item btn"
                                disabled={(pagination.page || 1) <= 1}
                                onClick={() => changePage((pagination.page || 1) - 1)}
                            >
                                Prev
                            </button>
                            <button className="join-item btn btn-disabled">
                                Page {pagination.page || 1} / {pagination.totalPages || 1}
                            </button>
                            <button
                                className="join-item btn"
                                disabled={(pagination.page || 1) >= (pagination.totalPages || 1)}
                                onClick={() => changePage((pagination.page || 1) + 1)}
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
