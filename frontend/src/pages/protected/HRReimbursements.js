import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { hrApi } from '../../features/hr/api'

const getStatusBadge = (status) => {
    if (status === 'included_in_payroll') return 'badge-success'
    if (status === 'approved') return 'badge-info'
    if (status === 'rejected') return 'badge-error'
    return 'badge-warning'
}

const isProcessedByHr = (status) => ['included_in_payroll', 'rejected'].includes(status)
const HR_REJECTION_MARKER = '[HR_REJECTION_REASON]'

const getRejectionReason = (item = {}) => {
    if (item.rejection_reason) return String(item.rejection_reason)
    if (item.hr_rejection_reason) return String(item.hr_rejection_reason)
    if (item.review_notes) return String(item.review_notes)
    if (item.notes) return String(item.notes)

    const description = String(item.description || '')
    const markerIndex = description.indexOf(HR_REJECTION_MARKER)
    if (markerIndex === -1) return ''
    return description.slice(markerIndex + HR_REJECTION_MARKER.length).trim()
}

const getEmployeeDescription = (item = {}) => {
    const description = String(item.description || item.note || '')
    const markerIndex = description.indexOf(HR_REJECTION_MARKER)
    if (markerIndex === -1) return description
    return description.slice(0, markerIndex).trim()
}

function HRReimbursements() {
    const dispatch = useDispatch()
    const currentUserId = (() => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
            return Number(storedUser?.id || storedUser?.user_id || 0)
        } catch (error) {
            return 0
        }
    })()
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)
    const [selectedItem, setSelectedItem] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [rejectTarget, setRejectTarget] = useState(null)
    const [rejectReason, setRejectReason] = useState('')
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [items, setItems] = useState([])
    const historyCardRef = useRef(null)
    const [pendingFilters, setPendingFilters] = useState({
        search: '',
        month: '',
        year: '',
    })
    const [historyFilters, setHistoryFilters] = useState({
        search: '',
        status: '',
        month: '',
        year: '',
    })

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await hrApi.getReimbursements()
            setItems(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Validasi Reimbursement' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    const scrollToHistoryCard = useCallback(() => {
        window.requestAnimationFrame(() => {
            historyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [])

    const handleAction = async (item, action) => {
        if (action === 'reject') {
            setRejectTarget(item)
            setRejectReason('')
            setShowRejectModal(true)
            return
        }

        const confirmed = window.confirm('Yakin ingin memvalidasi reimbursement ini?')
        if (!confirmed) return

        try {
            setProcessingId(item.id)
            await hrApi.validateReimbursement(item.id)
            dispatch(showNotification({ message: 'Reimbursement berhasil divalidasi', status: 1 }))

            await loadData()
            scrollToHistoryCard()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setProcessingId(null)
        }
    }

    const handleConfirmReject = async () => {
        if (!rejectTarget?.id) return

        const trimmedReason = rejectReason.trim()
        if (!trimmedReason) {
            dispatch(showNotification({ message: 'Alasan penolakan wajib diisi', status: 0 }))
            return
        }

        try {
            setProcessingId(rejectTarget.id)
            await hrApi.rejectReimbursement(rejectTarget.id, trimmedReason)
            dispatch(showNotification({ message: 'Reimbursement berhasil ditolak', status: 1 }))
            setShowRejectModal(false)
            setRejectTarget(null)
            setRejectReason('')
            await loadData()
            scrollToHistoryCard()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setProcessingId(null)
        }
    }

    const applyCommonFilters = useCallback((sourceItems, currentFilters) => {
        const query = String(currentFilters.search || '').trim().toLowerCase()

        return sourceItems.filter((item) => {
            const dateValue = item.created_at ? new Date(item.created_at) : null
            const monthMatch = !currentFilters.month || (dateValue ? String(dateValue.getMonth() + 1) === String(currentFilters.month) : false)
            const yearMatch = !currentFilters.year || (dateValue ? String(dateValue.getFullYear()) === String(currentFilters.year) : false)
            const searchMatch = !query
                ? true
                : String(item.employee_name || '').toLowerCase().includes(query)
                    || String(item.employee_code || '').toLowerCase().includes(query)
                    || String(item.reimbursement_type || '').toLowerCase().includes(query)

            return monthMatch && yearMatch && searchMatch
        })
    }, [])

    const openDetail = (item) => {
        setSelectedItem(item)
        setShowDetailModal(true)
    }

    const pendingItems = useMemo(() => {
        const pendingSource = items.filter(
            (item) => item.status === 'approved' && Number(item.submitter_user_id || 0) !== currentUserId,
        )
        return applyCommonFilters(pendingSource, pendingFilters)
    }, [items, pendingFilters, applyCommonFilters, currentUserId])

    const historyItems = useMemo(() => {
        let historySource = items.filter((item) => ['included_in_payroll', 'rejected'].includes(item.status))
        if (historyFilters.status) {
            historySource = historySource.filter((item) => item.status === historyFilters.status)
        }
        return applyCommonFilters(historySource, historyFilters)
            .slice()
            .sort((a, b) => {
                const processedA = new Date(a?.updated_at || a?.created_at || 0).getTime()
                const processedB = new Date(b?.updated_at || b?.created_at || 0).getTime()
                if (processedA !== processedB) return processedB - processedA
                return Number(b?.id || 0) - Number(a?.id || 0)
            })
    }, [items, historyFilters, applyCommonFilters])

    return (
        <>
            <TitleCard title="Data Belum di Validasi" topMargin="mt-0">
                <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4 mb-4">
                    <input
                        className="input input-bordered"
                        placeholder="Cari nama/kode/jenis reimbursement"
                        value={pendingFilters.search}
                        onChange={(e) => setPendingFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={pendingFilters.month}
                        onChange={(e) => setPendingFilters((prev) => ({ ...prev, month: e.target.value }))}
                    >
                        <option value="">Semua Bulan</option>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={`pending-month-${i + 1}`} value={String(i + 1)}>
                                {new Date(2000, i).toLocaleString('id-ID', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={pendingFilters.year}
                        onChange={(e) => setPendingFilters((prev) => ({ ...prev, year: e.target.value }))}
                    >
                        <option value="">Semua Tahun</option>
                        {Array.from({ length: 5 }, (_, i) => {
                            const year = String(new Date().getFullYear() - i)
                            return <option key={`pending-year-${year}`} value={year}>{year}</option>
                        })}
                    </select>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data reimbursement...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead className="text-center">
                                <tr>
                                    <th className="text-center">Pegawai</th>
                                    <th className="text-center">Jenis</th>
                                    <th className="text-center">Nominal</th>
                                    <th className="text-center">Tanggal</th>
                                    <th className="text-center">Status</th>
                                    <th className="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingItems.map((item) => {
                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name || '-'}</div>
                                                <div className="text-xs opacity-70">{item.employee_code || '-'}</div>
                                            </td>
                                            <td>{item.reimbursement_type || '-'}</td>
                                            <td className="font-semibold">Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}</td>
                                            <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                            <td>
                                                <span className={`badge ${getStatusBadge(item.status)}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn btn-ghost btn-xs"
                                                        onClick={() => openDetail(item)}
                                                    >
                                                        Detail
                                                    </button>
                                                    <button
                                                        className={`btn btn-success btn-xs ${processingId === item.id ? 'loading' : ''}`}
                                                        onClick={() => handleAction(item, 'approve')}
                                                        disabled={processingId === item.id}
                                                    >
                                                        Validasi
                                                    </button>
                                                    <button
                                                        className={`btn btn-error btn-xs ${processingId === item.id ? 'loading' : ''}`}
                                                        onClick={() => handleAction(item, 'reject')}
                                                        disabled={processingId === item.id}
                                                    >
                                                        Tolak
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {pendingItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Tidak ada data yang perlu divalidasi</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <div ref={historyCardRef}>
                <TitleCard title="Riwayat Validasi" topMargin="mt-6">
                <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4 mb-4">
                    <input
                        className="input input-bordered"
                        placeholder="Cari nama/kode/jenis reimbursement"
                        value={historyFilters.search}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={historyFilters.status}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Semua Status</option>
                        <option value="included_in_payroll">Sudah Masuk Payroll</option>
                        <option value="rejected">Ditolak</option>
                    </select>
                    <select
                        className="select select-bordered"
                        value={historyFilters.month}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, month: e.target.value }))}
                    >
                        <option value="">Semua Bulan</option>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={`history-month-${i + 1}`} value={String(i + 1)}>
                                {new Date(2000, i).toLocaleString('id-ID', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={historyFilters.year}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, year: e.target.value }))}
                    >
                        <option value="">Semua Tahun</option>
                        {Array.from({ length: 5 }, (_, i) => {
                            const year = String(new Date().getFullYear() - i)
                            return <option key={`history-year-${year}`} value={year}>{year}</option>
                        })}
                    </select>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data reimbursement...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead className="text-center">
                                <tr>
                                    <th className="text-center">Pegawai</th>
                                    <th className="text-center">Jenis</th>
                                    <th className="text-center">Nominal</th>
                                    <th className="text-center">Tanggal Pengajuan</th>
                                    <th className="text-center">Status Akhir</th>
                                    <th className="text-center">Tanggal Proses</th>
                                    <th className="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyItems.map((item) => (
                                    <tr key={`history-${item.id}`}>
                                        <td>
                                            <div className="font-semibold">{item.employee_name || '-'}</div>
                                            <div className="text-xs opacity-70">{item.employee_code || '-'}</div>
                                        </td>
                                        <td>{item.reimbursement_type || '-'}</td>
                                        <td className="font-semibold">Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}</td>
                                        <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{isProcessedByHr(item.status) && item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : '-'}</td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => openDetail(item)}
                                            >
                                                Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {historyItems.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Belum ada riwayat validasi</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                </TitleCard>
            </div>

            {showDetailModal && selectedItem && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h3 className="font-bold text-lg mb-4">Detail Reimbursement</h3>

                        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
                            <div>
                                <p className="text-xs opacity-70">Pegawai</p>
                                <p className="font-semibold">{selectedItem.employee_name || '-'}</p>
                                <p className="text-sm opacity-70">{selectedItem.employee_code || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs opacity-70">Status</p>
                                <span className={`badge ${getStatusBadge(selectedItem.status)}`}>
                                    {selectedItem.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs opacity-70">Jenis Reimbursement</p>
                                <p className="font-semibold">{selectedItem.reimbursement_type || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs opacity-70">Nominal</p>
                                <p className="font-semibold">Rp {(Number(selectedItem.amount) || 0).toLocaleString('id-ID')}</p>
                            </div>
                            <div>
                                <p className="text-xs opacity-70">Tanggal Pengajuan</p>
                                <p>{selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('id-ID') : '-'}</p>
                            </div>
                            {isProcessedByHr(selectedItem.status) && (
                                <div>
                                    <p className="text-xs opacity-70">Tanggal Diproses</p>
                                    <p>{selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString('id-ID') : '-'}</p>
                                </div>
                            )}
                            <div className="md:col-span-2">
                                <p className="text-xs opacity-70">Keterangan Pegawai</p>
                                <p className="bg-base-200 rounded p-3">{getEmployeeDescription(selectedItem) || '-'}</p>
                            </div>
                            {selectedItem.status === 'rejected' && (
                                <div className="md:col-span-2">
                                    <p className="text-xs opacity-70">Alasan Penolakan HR</p>
                                    <p className="bg-error/10 border border-error/30 rounded p-3 text-error-content">
                                        {getRejectionReason(selectedItem) || '-'}
                                    </p>
                                </div>
                            )}
                            <div className="md:col-span-2">
                                <p className="text-xs opacity-70">Lampiran</p>
                                {selectedItem.attachment ? (
                                    <a
                                        href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/${selectedItem.attachment}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="link link-primary"
                                    >
                                        Lihat lampiran reimbursement
                                    </a>
                                ) : (
                                    <p>-</p>
                                )}
                            </div>
                        </div>

                        <div className="modal-action">
                            <button className="btn" onClick={() => setShowDetailModal(false)}>
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && rejectTarget && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-lg">
                        <h3 className="font-bold text-lg">Alasan Penolakan Reimbursement</h3>
                        <div className="mt-3 space-y-3">
                            <div className="bg-base-200 rounded p-3 text-sm">
                                <p><span className="font-semibold">Pegawai:</span> {rejectTarget.employee_name || '-'}</p>
                                <p><span className="font-semibold">Jenis:</span> {rejectTarget.reimbursement_type || '-'}</p>
                                <p><span className="font-semibold">Nominal:</span> Rp {(Number(rejectTarget.amount) || 0).toLocaleString('id-ID')}</p>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text font-semibold">Alasan Penolakan</span>
                                </label>
                                <textarea
                                    className="textarea textarea-bordered min-h-[120px]"
                                    placeholder="Tulis alasan penolakan reimbursement..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <label className="label">
                                    <span className="label-text-alt text-base-content/70">Alasan ini wajib diisi sebelum menolak</span>
                                </label>
                            </div>
                        </div>

                        <div className="modal-action">
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowRejectModal(false)
                                    setRejectTarget(null)
                                    setRejectReason('')
                                }}
                                disabled={processingId === rejectTarget.id}
                            >
                                Batal
                            </button>
                            <button
                                className={`btn btn-error ${processingId === rejectTarget.id ? 'loading' : ''}`}
                                onClick={handleConfirmReject}
                                disabled={processingId === rejectTarget.id}
                            >
                                Tolak Reimbursement
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </>
    )
}

export default HRReimbursements
