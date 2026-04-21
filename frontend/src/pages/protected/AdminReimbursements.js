import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'

const getStatusBadge = (status) => {
    if (status === 'included_in_payroll') return 'badge-success'
    if (status === 'approved') return 'badge-info'
    if (status === 'rejected') return 'badge-error'
    return 'badge-warning'
}

const getStatusLabel = (status) => {
    if (status === 'approved') return 'Disetujui'
    if (status === 'included_in_payroll') return 'Masuk Payroll'
    if (status === 'rejected') return 'Ditolak'
    return 'Menunggu Persetujuan Direktur'
}

function AdminReimbursements() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)
    const [allItems, setAllItems] = useState([])
    const [pendingFilters, setPendingFilters] = useState({
        search: '',
        status: 'pending',
    })
    const [historyFilters, setHistoryFilters] = useState({
        search: '',
        historyStatus: '',
    })

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await adminApi.getReimbursements()
            setAllItems(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Approval Reimbursement' }))
        loadData()
    }, [dispatch, loadData])

    const handleReview = async (id, action) => {
        try {
            setProcessingId(id)
            await adminApi.reviewReimbursement(id, action)
            dispatch(showNotification({
                message: action === 'approve' ? 'Reimbursement berhasil disetujui' : 'Reimbursement berhasil ditolak',
                status: 1,
            }))
            loadData()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setProcessingId(null)
        }
    }

    const matchSearch = (item, queryText) => {
        const query = String(queryText || '').trim().toLowerCase()
        if (!query) return true
        return (item.employee_name || '').toLowerCase().includes(query)
            || (item.employee_code || '').toLowerCase().includes(query)
            || (item.reimbursement_type || '').toLowerCase().includes(query)
    }

    const approvalItems = allItems.filter((item) => {
        const matchesSearch = matchSearch(item, pendingFilters.search)
        const matchesStatus = pendingFilters.status ? item.status === pendingFilters.status : true
        return matchesSearch && matchesStatus
    })
    const historyItems = allItems.filter((item) => {
        if (item.status === 'pending') return false
        if (!matchSearch(item, historyFilters.search)) return false
        return historyFilters.historyStatus ? item.status === historyFilters.historyStatus : true
    })

    return (
        <>
            <TitleCard title="Approval Reimbursement " topMargin="mt-0">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <input
                        className="input input-bordered"
                        placeholder="Cari nama/kode/jenis reimbursement"
                        value={pendingFilters.search}
                        onChange={(e) => setPendingFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={pendingFilters.status}
                        onChange={(e) => setPendingFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Semua Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="included_in_payroll">Included in Payroll</option>
                    </select>
                    <button className="btn" onClick={loadData}>Refresh</button>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data reimbursement...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Jenis</th>
                                    <th>Nominal</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Lampiran</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvalItems.map((item) => {
                                    const attachmentUrl = item.attachment
                                        ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/${item.attachment}`
                                        : ''

                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs opacity-70">{item.employee_code}</div>
                                            </td>
                                            <td>{item.reimbursement_type || '-'}</td>
                                            <td className="font-semibold">Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}</td>
                                            <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                            <td>
                                                {getStatusLabel(item.status)}
                                            </td>
                                            <td>
                                                {item.attachment ? (
                                                    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="link link-primary text-sm">Lihat</a>
                                                ) : (
                                                    <span className="text-xs opacity-60">-</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
                                                    {item.status === 'pending' ? (
                                                        <>
                                                            <button
                                                                className={`btn btn-success btn-xs ${processingId === item.id ? 'loading' : ''}`}
                                                                onClick={() => handleReview(item.id, 'approve')}
                                                                disabled={processingId === item.id}
                                                            >
                                                                Setujui
                                                            </button>
                                                            <button
                                                                className={`btn btn-error btn-xs ${processingId === item.id ? 'loading' : ''}`}
                                                                onClick={() => handleReview(item.id, 'reject')}
                                                                disabled={processingId === item.id}
                                                            >
                                                                Tolak
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs opacity-60">-</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {approvalItems.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Tidak ada data reimbursement sesuai filter</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <TitleCard title="Riwayat Approval Reimbursement" topMargin="mt-6">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <input
                        className="input input-bordered"
                        placeholder="Filter nama/kode/jenis reimbursement"
                        value={historyFilters.search}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={historyFilters.historyStatus}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, historyStatus: e.target.value }))}
                    >
                        <option value="">Semua Status Riwayat</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="included_in_payroll">Included in Payroll</option>
                    </select>
                    <button className="btn" onClick={loadData}>Refresh</button>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data reimbursement...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Jenis</th>
                                    <th>Nominal</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Lampiran</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyItems.map((item) => {
                                    const attachmentUrl = item.attachment
                                        ? `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/${item.attachment}`
                                        : ''

                                    return (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs opacity-70">{item.employee_code}</div>
                                            </td>
                                            <td>{item.reimbursement_type || '-'}</td>
                                            <td className="font-semibold">Rp {(Number(item.amount) || 0).toLocaleString('id-ID')}</td>
                                            <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                            <td>
                                                <span className={`badge ${getStatusBadge(item.status)}`}>
                                                    {getStatusLabel(item.status)}
                                                </span>
                                            </td>
                                            <td>
                                                {item.attachment ? (
                                                    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="link link-primary text-sm">Lihat</a>
                                                ) : (
                                                    <span className="text-xs opacity-60">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {historyItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Belum ada riwayat approval reimbursement</td>
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

export default AdminReimbursements
