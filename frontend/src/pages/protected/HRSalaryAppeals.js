import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import { showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { hrApi } from '../../features/hr/api'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const formatCurrency = (value) => `Rp ${(parseFloat(value) || 0).toLocaleString('id-ID')}`

const resolvePhotoUrl = (photoPath) => {
    if (!photoPath) return null
    if (/^https?:\/\//i.test(photoPath)) return photoPath
    const baseUrl = (process.env.REACT_APP_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
    return `${baseUrl}/${String(photoPath).replace(/^\/+/, '')}`
}

const getAppealItems = (appeal) => {
    if (Array.isArray(appeal?.appeal_reason_items) && appeal.appeal_reason_items.length > 0) {
        return appeal.appeal_reason_items
    }

    if (appeal?.appeal_reason_item || appeal?.reason) {
        return [
            {
                appeal_reason_item: appeal.appeal_reason_item || '',
                appeal_reason_label: appeal.appeal_reason_label || '-',
                reason: appeal.reason || '',
            },
        ]
    }

    return []
}

const parseReviewNotes = (notesText) => {
    const text = String(notesText || '').trim()
    if (!text) return []

    const result = []
    const pattern = /\[([^\]]+)\]\s*(disetujui|ditolak),\s*(nominal perbaikan|alasan):\s*([^\[]+)/gi
    let match

    while ((match = pattern.exec(text)) !== null) {
        const component = String(match[1] || '').trim()
        const decision = String(match[2] || '').toLowerCase().trim()
        const detailType = String(match[3] || '').toLowerCase().trim()
        const detailValue = String(match[4] || '').trim().replace(/[,\s]+$/, '')

        result.push({
            component,
            decision,
            detailType,
            detailValue,
        })
    }

    return result
}

const AUTO_REIMBURSE_REASON_KEY = 'reimbursement_total'

const buildEmployeeSearchOptions = (items) => {
    const map = new Map()

    for (const item of items || []) {
        const employeeName = String(item?.employee_name || item?.full_name || item?.name || '').trim()
        const employeeCode = String(item?.employee_code || '').trim()
        if (!employeeName) continue

        const key = employeeCode || employeeName
        if (!map.has(key)) {
            map.set(key, {
                code: employeeCode,
                label: employeeCode ? `${employeeName} (${employeeCode})` : employeeName,
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

function HRSalaryAppeals() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [salaryAppeals, setSalaryAppeals] = useState([])
    const [salaryAppealHistory, setSalaryAppealHistory] = useState([])
    const [employeeSearchOptions, setEmployeeSearchOptions] = useState([])
    const [reviewSearchInput, setReviewSearchInput] = useState('')
    const [historySearchInput, setHistorySearchInput] = useState('')
    const [selectedItem, setSelectedItem] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [reviewItems, setReviewItems] = useState([])
    const [actionType, setActionType] = useState('') // 'approve' or 'reject'
    const [processing, setProcessing] = useState(false)
    const historyCardRef = useRef(null)
    
    // Filters
    const [filters, setFilters] = useState({
        status: 'pending',
        search: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
    })
    const [historyFilters, setHistoryFilters] = useState({
        status: '',
        search: '',
        month: '',
        year: ''
    })

    const loadSalaryAppeals = useCallback(async () => {
        try {
            setLoading(true)
            const historyQuery = {
                status: historyFilters.status,
                search: historyFilters.search,
                month: historyFilters.month || undefined,
                year: historyFilters.year || undefined,
            }

            const [result, historyResult] = await Promise.all([
                hrApi.getSalaryAppeals(filters),
                hrApi.getSalaryAppeals(historyQuery),
            ])

            setSalaryAppeals(result.data || [])
            setSalaryAppealHistory(
                (historyResult.data || [])
                    .filter((item) => item.status === 'approved' || item.status === 'rejected')
                    .slice()
                    .sort((a, b) => {
                        const reviewedA = new Date(a?.reviewed_at || a?.updated_at || a?.created_at || 0).getTime()
                        const reviewedB = new Date(b?.reviewed_at || b?.updated_at || b?.created_at || 0).getTime()
                        if (reviewedA !== reviewedB) return reviewedB - reviewedA
                        return Number(b?.id || 0) - Number(a?.id || 0)
                    })
            )
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [filters, historyFilters.status, historyFilters.search, historyFilters.month, historyFilters.year, dispatch])

    const filteredHistoryAppeals = useMemo(() => {
        const selectedMonth = Number(historyFilters.month || 0)
        const selectedYear = Number(historyFilters.year || 0)
        return salaryAppealHistory.filter((item) => {
            const periodMonth = Number(item?.period_month || 0)
            const periodYear = Number(item?.period_year || 0)
            const monthMatch = !selectedMonth || periodMonth === selectedMonth
            const yearMatch = !selectedYear || periodYear === selectedYear
            return monthMatch && yearMatch
        })
    }, [salaryAppealHistory, historyFilters.month, historyFilters.year])

    const loadEmployeeOptions = useCallback(async () => {
        try {
            const result = await hrApi.getEmployees({
                search: '',
                department: '',
                position: '',
                employment_status: '',
                status: '',
            })
            setEmployeeSearchOptions(buildEmployeeSearchOptions(result.data || []))
        } catch (err) {
            setEmployeeSearchOptions([])
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Review Banding Gaji' }))
        loadSalaryAppeals()
    }, [dispatch, loadSalaryAppeals])

    useEffect(() => {
        loadEmployeeOptions()
    }, [loadEmployeeOptions])

    const scrollToHistoryCard = useCallback(() => {
        window.requestAnimationFrame(() => {
            historyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [])

    const handleAction = (item, type) => {
        const mappedReviewItems = getAppealItems(item).map((appealItem) => ({
            appeal_reason_item: appealItem.appeal_reason_item,
            appeal_reason_label: appealItem.appeal_reason_label,
            reason: appealItem.reason,
            decision: type === 'reject' ? 'reject' : 'approve',
            adjustment_amount: '',
            rejection_note: '',
        }))

        setSelectedItem(item)
        setActionType(type)
        setReviewItems(mappedReviewItems)
        setShowModal(true)
    }

    const confirmAction = async () => {
        if (!selectedItem) return

        if (actionType !== 'view') {
            if (!reviewItems.length) {
                dispatch(showNotification({ message: 'Detail alasan banding tidak ditemukan', status: 0 }))
                return
            }

            for (const reviewItem of reviewItems) {
                if (reviewItem.decision === 'approve') {
                    const isAutoReimburseComponent = reviewItem.appeal_reason_item === AUTO_REIMBURSE_REASON_KEY
                    if (isAutoReimburseComponent) {
                        continue
                    }

                    const parsedAmount = Number(reviewItem.adjustment_amount)
                    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
                        dispatch(showNotification({ message: `Nominal perbaikan wajib diisi untuk komponen ${reviewItem.appeal_reason_label || reviewItem.appeal_reason_item}`, status: 0 }))
                        return
                    }
                }

                if (reviewItem.decision === 'reject' && !String(reviewItem.rejection_note || '').trim()) {
                    dispatch(showNotification({ message: `Catatan penolakan wajib diisi untuk komponen ${reviewItem.appeal_reason_label || reviewItem.appeal_reason_item}`, status: 0 }))
                    return
                }
            }
        }

        try {
            setProcessing(true)
            await hrApi.reviewSalaryAppeal(selectedItem.id, actionType, {
                review_items: reviewItems.map((item) => ({
                    appeal_reason_item: item.appeal_reason_item,
                    decision: item.decision,
                    adjustment_amount: item.decision === 'approve' ? Number(item.adjustment_amount) : undefined,
                    rejection_note: item.decision === 'reject' ? item.rejection_note : undefined,
                })),
            })
            dispatch(showNotification({ 
                message: `Banding gaji berhasil ${actionType === 'approve' ? 'disetujui' : 'ditolak'}`, 
                status: 1 
            }))
            setShowModal(false)
            await loadSalaryAppeals()
            scrollToHistoryCard()
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

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const handleHistoryFilterChange = (key, value) => {
        setHistoryFilters((prev) => ({ ...prev, [key]: value }))
    }

    const normalizeEmployeeSearchValue = (value) => {
        const parsed = String(value || '').trim()
        const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
        return match ? String(match[2] || '').trim() : parsed
    }

    const handleReviewSearchChange = (value) => {
        setReviewSearchInput(value)
        handleFilterChange('search', normalizeEmployeeSearchValue(value))
    }

    const handleHistorySearchChange = (value) => {
        setHistorySearchInput(value)
        handleHistoryFilterChange('search', normalizeEmployeeSearchValue(value))
    }

    const updateReviewItem = (index, key, value) => {
        setReviewItems((prev) => prev.map((item, itemIndex) => (
            itemIndex === index ? { ...item, [key]: value } : item
        )))
    }

    const openPayrollPdf = async (payrollId) => {
        const previewWindow = window.open('about:blank', '_blank')

        try {
            const blob = await hrApi.getPayrollPdfBlob(payrollId)
            const url = window.URL.createObjectURL(blob)
            if (previewWindow) {
                previewWindow.location.href = url
            } else {
                window.open(url, '_blank')
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
        } catch (err) {
            if (previewWindow && !previewWindow.closed) {
                previewWindow.close()
            }
            dispatch(showNotification({ message: err.message, status: 0 }))
        }
    }

    return (
        <>
            <TitleCard title="Review Banding Gaji" topMargin="mt-2">
                {/* Filters */}
                <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Cari Pegawai</span>
                        </label>
                        <div className="relative">
                            <input
                                type="search"
                                list="hr-salary-appeal-employee-options"
                                placeholder="Nama/Kode pegawai..."
                                className="input input-bordered w-full pr-10"
                                value={reviewSearchInput}
                                onChange={(e) => handleReviewSearchChange(e.target.value)}
                            />
                            <datalist id="hr-salary-appeal-employee-options">
                                {employeeSearchOptions.map((option) => (
                                    <option key={`review-${option}`} value={option} />
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

                {/* Summary Stats */}
                <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-4 mb-6">
                    <div className="stat bg-warning text-warning-content rounded-lg">
                        <div className="stat-title text-warning-content">Pending Review</div>
                        <div className="stat-value text-2xl">
                            {salaryAppeals.filter(a => a.status === 'pending').length}
                        </div>
                    </div>
                    <div className="stat bg-success text-success-content rounded-lg">
                        <div className="stat-title text-success-content">Disetujui</div>
                        <div className="stat-value text-2xl">
                            {salaryAppeals.filter(a => a.status === 'approved').length}
                        </div>
                    </div>
                    <div className="stat bg-error text-error-content rounded-lg">
                        <div className="stat-title text-error-content">Ditolak</div>
                        <div className="stat-value text-2xl">
                            {salaryAppeals.filter(a => a.status === 'rejected').length}
                        </div>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="text-center py-10">Memuat data...</div>
                ) : salaryAppeals.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Periode Gaji</th>
                                    <th>Total Gaji</th>
                                    <th>Tanggal Pengajuan</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salaryAppeals.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-bold">{item.employee_name || 'N/A'}</div>
                                            <div className="text-sm opacity-50">{item.employee_code || 'N/A'}</div>
                                        </td>
                                        <td className="font-semibold">
                                            {item.period_month}/{item.period_year}
                                        </td>
                                        <td className="font-bold text-primary">
                                            {formatCurrency(item.final_amount || item.net_salary)}
                                        </td>
                                        <td>
                                            {new Date(item.created_at).toLocaleDateString('id-ID')}
                                        </td>
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
                                                    Detail
                                                </button>
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button
                                                            className="btn btn-success btn-xs"
                                                            onClick={() => handleAction(item, 'approve')}
                                                        >
                                                            Setujui
                                                        </button>
                                                        <button
                                                            className="btn btn-error btn-xs"
                                                            onClick={() => handleAction(item, 'reject')}
                                                        >
                                                            Tolak
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
                        Tidak ada data banding gaji
                    </div>
                )}
            </TitleCard>

            <div ref={historyCardRef}>
                <TitleCard title="Riwayat Banding Gaji" topMargin="mt-6">
                <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Cari Pegawai</span>
                        </label>
                        <div className="relative">
                            <input
                                type="search"
                                list="hr-salary-appeal-employee-options"
                                placeholder="Nama/Kode pegawai..."
                                className="input input-bordered w-full pr-10"
                                value={historySearchInput}
                                onChange={(e) => handleHistorySearchChange(e.target.value)}
                            />
                            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                        </div>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Status</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={historyFilters.status}
                            onChange={(e) => handleHistoryFilterChange('status', e.target.value)}
                        >
                            <option value="">Semua Status</option>
                            <option value="approved">Disetujui</option>
                            <option value="rejected">Ditolak</option>
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Bulan</span>
                        </label>
                        <select
                            className="select select-bordered"
                            value={historyFilters.month}
                            onChange={(e) => handleHistoryFilterChange('month', e.target.value)}
                        >
                            <option value="">Semua Bulan</option>
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={`history-month-${i + 1}`} value={i + 1}>
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
                            value={historyFilters.year}
                            onChange={(e) => handleHistoryFilterChange('year', e.target.value)}
                        >
                            <option value="">Semua Tahun</option>
                            {Array.from({ length: 5 }, (_, i) => {
                                const year = new Date().getFullYear() - i
                                return <option key={`history-year-${year}`} value={year}>{year}</option>
                            })}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data riwayat...</div>
                ) : filteredHistoryAppeals.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Periode Gaji</th>
                                    <th>Total Gaji</th>
                                    <th>Tanggal Pengajuan</th>
                                    <th>Tanggal Review</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistoryAppeals.map((item) => (
                                    <tr key={`history-${item.id}`}>
                                        <td>
                                            <div className="font-bold">{item.employee_name || 'N/A'}</div>
                                            <div className="text-sm opacity-50">{item.employee_code || 'N/A'}</div>
                                        </td>
                                        <td className="font-semibold">
                                            {item.period_month}/{item.period_year}
                                        </td>
                                        <td className="font-bold text-primary">
                                            {formatCurrency(item.final_amount || item.net_salary)}
                                        </td>
                                        <td>
                                            {new Date(item.created_at).toLocaleDateString('id-ID')}
                                        </td>
                                        <td>
                                            {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString('id-ID') : '-'}
                                        </td>
                                        <td>
                                            <span className={getStatusBadge(item.status)}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => {
                                                    setSelectedItem(item)
                                                    setActionType('view')
                                                    setShowModal(true)
                                                }}
                                            >
                                                Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">
                        Tidak ada riwayat banding gaji
                    </div>
                )}
                </TitleCard>
            </div>

            {/* Modal */}
            {showModal && selectedItem && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-3xl">
                        <h3 className="font-bold text-lg mb-4">
                            {actionType === 'view' ? 'Detail Banding Gaji' : 
                             actionType === 'approve' ? 'Setujui Banding Gaji' : 'Tolak Banding Gaji'}
                        </h3>
                        
                        <div className="space-y-4">
                            {/* Employee Info */}
                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Informasi Pegawai</h4>
                                <div className="flex flex-col items-center text-center">
                                    <img
                                        src={resolvePhotoUrl(selectedItem.employee_photo) || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedItem.full_name || selectedItem.employee_name || 'Pegawai')}&background=random&color=fff`}
                                        alt={selectedItem.full_name || selectedItem.employee_name || 'pegawai'}
                                        className="w-20 h-20 rounded-full object-cover mb-3"
                                    />
                                    <p className="font-bold text-lg">{selectedItem.full_name || selectedItem.employee_name || '-'}</p>
                                    <p className="text-sm opacity-70">{selectedItem.department_name || '-'}</p>
                                    <p className="text-sm opacity-70">{selectedItem.position_name || '-'}</p>
                                    <p className="text-sm opacity-70">Kode Pegawai: {selectedItem.employee_code || '-'}</p>
                                </div>
                            </div>

                            {/* Payroll Info */}
                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Informasi Gaji</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-600">Periode:</label>
                                        <p className="font-semibold text-lg">
                                            {selectedItem.period_month}/{selectedItem.period_year}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Total Gaji:</label>
                                        <p className="font-bold text-lg text-primary">
                                            {formatCurrency(selectedItem.final_amount || selectedItem.net_salary)}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Gaji Pokok:</label>
                                        <p className="font-semibold">{formatCurrency(selectedItem.basic_salary)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Total Tunjangan:</label>
                                        <p className="font-semibold">{formatCurrency(selectedItem.total_allowances)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Total Potongan:</label>
                                        <p className="font-semibold text-error">{formatCurrency(selectedItem.total_deductions)}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Status:</label>
                                        <p>
                                            <span className={getStatusBadge(selectedItem.status)}>
                                                {selectedItem.status}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Appeal Details */}
                            <div className="bg-base-200 p-4 rounded-lg">
                                <h4 className="font-semibold mb-2">Detail Banding</h4>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-sm text-gray-600">Tanggal Pengajuan:</label>
                                        <p>{new Date(selectedItem.created_at).toLocaleString('id-ID')}</p>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-600">Alasan Banding:</label>
                                        <div className="mt-1 overflow-x-auto bg-base-100 rounded">
                                            <table className="table table-zebra table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Komponen Slip</th>
                                                        <th>Alasan</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {getAppealItems(selectedItem).length > 0 ? (
                                                        getAppealItems(selectedItem).map((appealItem, index) => (
                                                            <tr key={`${appealItem.appeal_reason_item || 'item'}-${index}`}>
                                                                <td>{appealItem.appeal_reason_label || appealItem.appeal_reason_item || '-'}</td>
                                                                <td>{appealItem.reason || '-'}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={2} className="text-center opacity-70">Tidak ada detail alasan</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedItem.supporting_documents_url ? (
                                            <a
                                                href={selectedItem.supporting_documents_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-sm btn-outline"
                                            >
                                                Lihat Bukti Pegawai
                                            </a>
                                        ) : (
                                            <button className="btn btn-sm btn-outline" type="button" disabled>
                                                Bukti Pegawai Tidak Ada
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-sm btn-outline"
                                            type="button"
                                            onClick={() => openPayrollPdf(selectedItem.payroll_id)}
                                        >
                                            Lihat PDF Slip Gaji
                                        </button>
                                    </div>
                                    {selectedItem.review_notes && (
                                        <div>
                                            <label className="text-sm text-gray-600">Catatan HR:</label>
                                            {parseReviewNotes(selectedItem.review_notes).length > 0 ? (
                                                <div className="mt-1 overflow-x-auto bg-base-100 rounded">
                                                    <table className="table table-zebra table-sm">
                                                        <thead>
                                                            <tr>
                                                                <th>Komponen</th>
                                                                <th>Keputusan</th>
                                                                <th>Jenis Catatan</th>
                                                                <th>Detail</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {parseReviewNotes(selectedItem.review_notes).map((note, index) => (
                                                                <tr key={`review-note-${index}`}>
                                                                    <td>{note.component || '-'}</td>
                                                                    <td>
                                                                        <span className={`badge ${note.decision === 'disetujui' ? 'badge-success' : 'badge-error'}`}>
                                                                            {note.decision}
                                                                        </span>
                                                                    </td>
                                                                    <td className="capitalize">{note.detailType || '-'}</td>
                                                                    <td>{note.detailValue || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="p-3 bg-base-100 rounded mt-1">{selectedItem.review_notes}</p>
                                            )}
                                        </div>
                                    )}
                                    {selectedItem.reviewed_at && (
                                        <div>
                                            <label className="text-sm text-gray-600">Tanggal Review:</label>
                                            <p>{new Date(selectedItem.reviewed_at).toLocaleString('id-ID')}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {actionType !== 'view' && (
                                <>
                                    <div className="overflow-x-auto rounded bg-base-100">
                                        <table className="table table-zebra table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Komponen</th>
                                                    <th>Alasan Pegawai</th>
                                                    <th>Keputusan HR</th>
                                                    <th>Nominal Perbaikan</th>
                                                    <th>Catatan Penolakan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reviewItems.map((item, index) => (
                                                    <tr key={`${item.appeal_reason_item || 'review'}-${index}`}>
                                                        <td>{item.appeal_reason_label || item.appeal_reason_item || '-'}</td>
                                                        <td>{item.reason || '-'}</td>
                                                        <td>
                                                            <select
                                                                className="select select-bordered select-xs"
                                                                value={item.decision}
                                                                onChange={(e) => updateReviewItem(index, 'decision', e.target.value)}
                                                            >
                                                                <option value="approve">Setujui</option>
                                                                <option value="reject">Tolak</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            {item.decision === 'approve' ? (
                                                                item.appeal_reason_item === AUTO_REIMBURSE_REASON_KEY ? (
                                                                    <input
                                                                        className="input input-bordered input-xs w-full"
                                                                        value="Otomatis dari reimbursement disetujui"
                                                                        disabled
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        className="input input-bordered input-xs w-full"
                                                                        placeholder="Nominal"
                                                                        value={item.adjustment_amount}
                                                                        onChange={(e) => updateReviewItem(index, 'adjustment_amount', e.target.value)}
                                                                    />
                                                                )
                                                            ) : (
                                                                <span className="opacity-70">-</span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {item.decision === 'reject' ? (
                                                                <textarea
                                                                    className="textarea textarea-bordered textarea-xs w-full"
                                                                    placeholder="Alasan penolakan"
                                                                    value={item.rejection_note}
                                                                    onChange={(e) => updateReviewItem(index, 'rejection_note', e.target.value)}
                                                                />
                                                            ) : (
                                                                <span className="opacity-70">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
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
                                    {processing ? 'Memproses...' : 'Setujui Banding'}
                                </button>
                            )}
                            {actionType === 'reject' && (
                                <button 
                                    className="btn btn-error"
                                    onClick={confirmAction}
                                    disabled={processing}
                                >
                                    {processing ? 'Memproses...' : 'Tolak Banding'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default HRSalaryAppeals
