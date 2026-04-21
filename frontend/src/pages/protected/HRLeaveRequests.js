import { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import { showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { hrApi } from '../../features/hr/api'
import { 
    MagnifyingGlassIcon, 
    CheckCircleIcon,
    XCircleIcon
} from '@heroicons/react/24/outline'

const buildEmployeeSearchOptions = (items) => {
    const map = new Map()

    for (const item of items || []) {
        const employeeName = String(item?.employee_name || item?.full_name || item?.name || '').trim()
        const employeeCode = String(item?.employee_code || '').trim()

        if (!employeeName) continue

        const key = employeeCode || employeeName
        const label = employeeCode ? `${employeeName} (${employeeCode})` : employeeName

        if (!map.has(key)) {
            map.set(key, {
                code: employeeCode,
                label,
            })
        }
    }

    return Array.from(map.values())
        .sort((a, b) => {
            const codeA = String(a.code || '').trim()
            const codeB = String(b.code || '').trim()

            if (codeA && codeB) {
                return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' })
            }

            if (codeA && !codeB) return -1
            if (!codeA && codeB) return 1

            return a.label.localeCompare(b.label, 'id', { sensitivity: 'base' })
        })
        .map((entry) => entry.label)
}

function HRLeaveRequests() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [leaveRequests, setLeaveRequests] = useState([])
    const [employeeSearchOptions, setEmployeeSearchOptions] = useState([])
    const [employeeSearchInput, setEmployeeSearchInput] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [actionNotes, setActionNotes] = useState('')
    const [actionType, setActionType] = useState('') // 'approve' or 'reject'
    const [processing, setProcessing] = useState(false)
    
    // Filters
    const [filters, setFilters] = useState({
        status: '',
        leave_type: '',
        search: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    })

    const filteredLeaveRequests = useMemo(() => {
        const keyword = String(filters.search || '').trim().toLowerCase()
        const selectedMonth = Number(filters.month || 0)
        const selectedYear = Number(filters.year || 0)

        return leaveRequests.filter((item) => {
            const startDate = item?.start_date ? new Date(item.start_date) : null
            const createdDate = item?.created_at ? new Date(item.created_at) : null
            const referenceDate = startDate && !Number.isNaN(startDate.getTime())
                ? startDate
                : createdDate

            const periodMatch = referenceDate
                ? (referenceDate.getMonth() + 1 === selectedMonth && referenceDate.getFullYear() === selectedYear)
                : true

            if (!periodMatch) return false
            if (!keyword) return true

            const employeeName = String(item?.employee_name || '').toLowerCase()
            const employeeCode = String(item?.employee_code || '').toLowerCase()
            return employeeName.includes(keyword) || employeeCode.includes(keyword)
        })
    }, [leaveRequests, filters.search, filters.month, filters.year])

    const loadLeaveRequests = useCallback(async () => {
        try {
            setLoading(true)
            const result = await hrApi.getLeaveRequests({
                status: filters.status,
                leave_type: filters.leave_type,
                scope: 'hr_all',
            })
            setLeaveRequests(result.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [filters.status, filters.leave_type, dispatch])

    const loadEmployeeOptions = useCallback(async () => {
        try {
            const result = await hrApi.getEmployees()
            setEmployeeSearchOptions(buildEmployeeSearchOptions(result.data || []))
        } catch (err) {
            // Keep leave list usable even if employee option source fails.
            setEmployeeSearchOptions([])
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Riwayat Izin/Cuti' }))
        loadLeaveRequests()
        loadEmployeeOptions()
    }, [dispatch, loadLeaveRequests, loadEmployeeOptions])

    const handleAction = (item, type) => {
        setSelectedItem(item)
        setActionType(type)
        setActionNotes('')
        setShowModal(true)
    }

    const confirmAction = async () => {
        if (!selectedItem) return

        try {
            setProcessing(true)
            if (actionType === 'approve') {
                await hrApi.approveLeaveRequest(selectedItem.id, actionNotes)
                dispatch(showNotification({ 
                    message: 'Permohonan cuti/izin berhasil disetujui', 
                    status: 1 
                }))
            } else if (actionType === 'reject') {
                await hrApi.rejectLeaveRequest(selectedItem.id, actionNotes)
                dispatch(showNotification({ 
                    message: 'Permohonan cuti/izin berhasil ditolak', 
                    status: 1 
                }))
            }
            setShowModal(false)
            loadLeaveRequests()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setProcessing(false)
        }
    }

    const getStatusBadge = (status) => {
        const statusConfig = {
            pending: 'badge-warning',
            approved: 'badge-success',
            rejected: 'badge-error'
        }
        return `badge ${statusConfig[status] || 'badge-ghost'}`
    }

    const getLeaveTypeBadge = (type) => {
        const typeConfig = {
            annual: 'badge-primary',
            sick: 'badge-info',
            permission: 'badge-secondary',
            unpaid: 'badge-ghost'
        }
        return `badge ${typeConfig[type] || 'badge-ghost'}`
    }

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const handleEmployeeSearchChange = (value) => {
        const parsed = String(value || '').trim()
        const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
        const normalizedSearch = match ? String(match[2] || '').trim() : parsed

        setEmployeeSearchInput(value)
        handleFilterChange('search', normalizedSearch)
    }

    const getDurationDays = (item) => {
        return Number(item?.total_days ?? item?.duration ?? 0)
    }

    const getBuktiUrl = (path) => {
        if (!path) return ''
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000'
        return `${baseUrl}/${String(path).replace(/^\/+/, '')}`
    }

    return (
        <>
            <TitleCard title="Riwayat Izin/Cuti" topMargin="mt-2">
                {/* Filters */}
                <div className="grid lg:grid-cols-5 md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Cari Pegawai</span>
                        </label>
                        <div className="relative">
                            <input
                                type="search"
                                list="hr-leave-employee-options"
                                placeholder="Nama/Kode pegawai..."
                                className="input input-bordered w-full pr-10"
                                value={employeeSearchInput}
                                onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                            />
                            <datalist id="hr-leave-employee-options">
                                {employeeSearchOptions.map((option) => (
                                    <option key={option} value={option} />
                                ))}
                            </datalist>
                            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                        </div>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Status</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">Semua Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Disetujui</option>
                            <option value="rejected">Ditolak</option>
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Tipe Cuti</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={filters.leave_type}
                            onChange={(e) => handleFilterChange('leave_type', e.target.value)}
                        >
                            <option value="">Semua Tipe</option>
                            <option value="cuti_tahunan">Cuti Tahunan</option>
                            <option value="cuti_sakit">Cuti Sakit</option>
                            <option value="cuti_melahirkan">Cuti Melahirkan</option>
                            <option value="izin">Izin</option>
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Bulan</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={filters.month}
                            onChange={(e) => handleFilterChange('month', e.target.value)}
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1}>
                                    {new Date(2000, i).toLocaleString('id-ID', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Tahun</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={filters.year}
                            onChange={(e) => handleFilterChange('year', e.target.value)}
                        >
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - i
                                return <option key={year} value={year}>{year}</option>
                            })}
                        </select>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="text-center py-10">Memuat data...</div>
                ) : filteredLeaveRequests.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Tipe Cuti</th>
                                    <th>Tanggal Mulai</th>
                                    <th>Tanggal Selesai</th>
                                    <th>Durasi</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeaveRequests.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-bold">{item.employee_name || 'N/A'}</div>
                                            <div className="text-sm opacity-50">{item.employee_code || 'N/A'}</div>
                                        </td>
                                        <td>
                                            <span className={getLeaveTypeBadge(item.leave_type)}>
                                                {item.leave_type}
                                            </span>
                                        </td>
                                        <td>{new Date(item.start_date).toLocaleDateString('id-ID')}</td>
                                        <td>{new Date(item.end_date).toLocaleDateString('id-ID')}</td>
                                        <td className="font-semibold">{getDurationDays(item)} hari</td>
                                        <td>
                                            <span className={getStatusBadge(item.status)}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => {
                                                        setSelectedItem(item)
                                                        setActionType('view')
                                                        setShowModal(true)
                                                    }}
                                                >
                                                    View
                                                </button>
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className="btn btn-success btn-xs"
                                                            onClick={() => handleAction(item, 'approve')}
                                                        >
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            className="btn btn-error btn-xs"
                                                            onClick={() => handleAction(item, 'reject')}
                                                        >
                                                            <XCircleIcon className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        Tidak ada data permohonan cuti/izin
                    </div>
                )}
            </TitleCard>

            {/* Modal */}
            {showModal && selectedItem && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h3 className="font-bold text-lg mb-4">
                            {actionType === 'view' ? 'Detail Permohonan Cuti/Izin' : 
                             actionType === 'approve' ? 'Setujui Permohonan' : 'Tolak Permohonan'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="font-semibold">Pegawai:</label>
                                    <p>{selectedItem.employee_name} ({selectedItem.employee_code})</p>
                                </div>
                                <div>
                                    <label className="font-semibold">Tipe Cuti:</label>
                                    <p>
                                        <span className={getLeaveTypeBadge(selectedItem.leave_type)}>
                                            {selectedItem.leave_type}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="font-semibold">Tanggal Mulai:</label>
                                    <p>{new Date(selectedItem.start_date).toLocaleDateString('id-ID')}</p>
                                </div>
                                <div>
                                    <label className="font-semibold">Tanggal Selesai:</label>
                                    <p>{new Date(selectedItem.end_date).toLocaleDateString('id-ID')}</p>
                                </div>
                                <div>
                                    <label className="font-semibold">Durasi:</label>
                                    <p>{getDurationDays(selectedItem)} hari</p>
                                </div>
                                <div>
                                    <label className="font-semibold">Status:</label>
                                    <p>
                                        <span className={getStatusBadge(selectedItem.status)}>
                                            {selectedItem.status}
                                        </span>
                                    </p>
                                </div>
                            </div>
                            
                            {selectedItem.reason && (
                                <div>
                                    <label className="font-semibold">Alasan:</label>
                                    <p className="p-2 bg-base-200 rounded">{selectedItem.reason}</p>
                                </div>
                            )}

                            {selectedItem.notes && (
                                <div>
                                    <label className="font-semibold">Catatan HR:</label>
                                    <p className="p-2 bg-base-200 rounded">{selectedItem.notes}</p>
                                </div>
                            )}

                            <div>
                                <label className="font-semibold">Bukti:</label>
                                {selectedItem.bukti ? (
                                    <p>
                                        <a
                                            href={getBuktiUrl(selectedItem.bukti)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="link link-primary"
                                        >
                                            Lihat bukti
                                        </a>
                                    </p>
                                ) : (
                                    <p className="opacity-70">Tidak ada bukti lampiran.</p>
                                )}
                            </div>

                            {actionType !== 'view' && (
                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text font-semibold">Catatan:</span>
                                    </label>
                                    <textarea
                                        className="textarea textarea-bordered h-24"
                                        placeholder="Masukkan catatan..."
                                        value={actionNotes}
                                        onChange={(e) => setActionNotes(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="modal-action">
                            <button 
                                className="btn btn-ghost" 
                                onClick={() => setShowModal(false)}
                                disabled={processing}
                            >
                                {actionType === 'view' ? 'Tutup' : 'Batal'}
                            </button>
                            {actionType === 'approve' && (
                                <button 
                                    className="btn btn-success"
                                    onClick={confirmAction}
                                    disabled={processing}
                                >
                                    {processing ? 'Memproses...' : 'Setujui'}
                                </button>
                            )}
                            {actionType === 'reject' && (
                                <button 
                                    className="btn btn-error"
                                    onClick={confirmAction}
                                    disabled={processing}
                                >
                                    {processing ? 'Memproses...' : 'Tolak'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default HRLeaveRequests
