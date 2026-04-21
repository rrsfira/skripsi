import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { atasanApi } from '../../features/atasan/api'

const getStatusBadge = (status) => {
    if (status === 'included_in_payroll') return 'badge-success'
    if (status === 'approved') return 'badge-info'
    if (status === 'rejected') return 'badge-error'
    return 'badge-warning'
}

const getStatusLabel = (status) => {
    if (status === 'approved') return 'Disetujui Atasan (Menunggu Validasi HR)'
    if (status === 'included_in_payroll') return 'Masuk Payroll'
    if (status === 'rejected') return 'Ditolak'
    return 'Menunggu Persetujuan Atasan'
}

function AtasanReimbursements() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)
    const [filters, setFilters] = useState({
        search: '',
        historyStatus: ''
    })
    const [allItems, setAllItems] = useState([])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await atasanApi.getReimbursements()
            setAllItems(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Persetujuan Reimbursement' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleReview = async (id, action) => {
        try {
            setProcessingId(id)
            await atasanApi.reviewReimbursement(id, action)
            dispatch(showNotification({
                message: action === 'approve' ? 'Reimbursement berhasil disetujui' : 'Reimbursement berhasil ditolak',
                status: 1
            }))
            loadData()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setProcessingId(null)
        }
    }

    const query = filters.search.trim().toLowerCase()
    const matchSearch = (item) => {
        if (!query) return true
        return (item.employee_name || '').toLowerCase().includes(query)
            || (item.employee_code || '').toLowerCase().includes(query)
            || (item.reimbursement_type || '').toLowerCase().includes(query)
    }

    const pendingItems = allItems.filter((item) => item.status === 'pending' && matchSearch(item))
    const historyItems = allItems.filter((item) => {
        if (item.status === 'pending') return false
        if (!matchSearch(item)) return false
        return filters.historyStatus ? item.status === filters.historyStatus : true
    })

    return (
        <>
            <TitleCard title="Persetujuan Reimbursement Bawahan" topMargin="mt-0">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <input
                        className="input input-bordered"
                        placeholder="Cari nama/kode/jenis reimbursement"
                        value={filters.search}
                        onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={filters.historyStatus}
                        onChange={(e) => setFilters((prev) => ({ ...prev, historyStatus: e.target.value }))}
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
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingItems.map((item) => {
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
                                            <td>{getStatusLabel(item.status)}</td>
                                            <td>
                                                {item.attachment ? (
                                                    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="link link-primary text-sm">Lihat</a>
                                                ) : (
                                                    <span className="text-xs opacity-60">-</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex gap-2">
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
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {pendingItems.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Tidak ada reimbursement pending</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <TitleCard title="Riwayat Reimbursement Tim" topMargin="mt-6">
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
                                        <td colSpan={6} className="text-center opacity-70">Belum ada riwayat reimbursement</td>
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

export default AtasanReimbursements
