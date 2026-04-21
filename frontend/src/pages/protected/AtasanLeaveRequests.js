import { useEffect, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { atasanApi } from '../../features/atasan/api'

function AtasanLeaveRequests() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState(null)
    const [approvalFilters, setApprovalFilters] = useState({
        status: 'pending',
        search: ''
    })
    const [historyFilters, setHistoryFilters] = useState({
        status: '',
        search: ''
    })
    const [items, setItems] = useState([])
    const [historyItems, setHistoryItems] = useState([])
    const [employeeOptions, setEmployeeOptions] = useState([])
    const [selectedItem, setSelectedItem] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(false)

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [filteredResult, historyResult] = await Promise.all([
                atasanApi.getLeaveRequests({ status: approvalFilters.status }),
                atasanApi.getLeaveRequests({ status: '' }),
            ])

            const source = filteredResult?.data || []
            const historySource = historyResult?.data || []

            const roles = JSON.parse(localStorage.getItem('roles') || '[]')

            if (Array.isArray(roles) && roles.includes('admin')) {
                try {
                    const employees = await atasanApi.getAllEmployees()
                    const options = Array.from(
                        new Map(
                            employees
                                .filter((employee) => employee?.full_name)
                                .map((employee) => [
                                    employee.employee_code || String(employee.full_name).toLowerCase(),
                                    {
                                        name: employee.full_name,
                                        code: employee.employee_code || ''
                                    }
                                ])
                        ).values()
                    ).sort((a, b) => {
                        if (!a.code && !b.code) return a.name.localeCompare(b.name, 'id')
                        if (!a.code) return 1
                        if (!b.code) return -1
                        return a.code.localeCompare(b.code, 'id', { numeric: true, sensitivity: 'base' })
                    })

                    setEmployeeOptions(options)
                } catch {
                    // Fallback ke data pengajuan jika endpoint pegawai gagal dipanggil.
                    const fallbackOptions = Array.from(
                        new Map(
                            historySource
                                .filter((item) => item.employee_name)
                                .map((item) => [
                                    item.employee_code || String(item.employee_name).toLowerCase(),
                                    {
                                        name: item.employee_name,
                                        code: item.employee_code || ''
                                    }
                                ])
                        ).values()
                    ).sort((a, b) => {
                        if (!a.code && !b.code) return a.name.localeCompare(b.name, 'id')
                        if (!a.code) return 1
                        if (!b.code) return -1
                        return a.code.localeCompare(b.code, 'id', { numeric: true, sensitivity: 'base' })
                    })
                    setEmployeeOptions(fallbackOptions)
                }
            } else {
                const options = Array.from(
                    new Map(
                        historySource
                            .filter((item) => item.employee_name)
                            .map((item) => [
                                item.employee_code || String(item.employee_name).toLowerCase(),
                                {
                                    name: item.employee_name,
                                    code: item.employee_code || ''
                                }
                            ])
                    ).values()
                ).sort((a, b) => {
                    if (!a.code && !b.code) return a.name.localeCompare(b.name, 'id')
                    if (!a.code) return 1
                    if (!b.code) return -1
                    return a.code.localeCompare(b.code, 'id', { numeric: true, sensitivity: 'base' })
                })
                setEmployeeOptions(options)
            }

            setHistoryItems(
                historySource
                    .filter((item) => item.status === 'approved' || item.status === 'rejected')
                    .sort((a, b) => new Date(b.approved_at || b.updated_at || b.created_at) - new Date(a.approved_at || a.updated_at || a.created_at))
            )
            setItems(source)
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [approvalFilters.status, dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Persetujuan Cuti & Izin' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    const isMatchEmployeeQuery = (item, query) => {
        if (!query) return true
        const normalized = query.toLowerCase()
        const name = (item.employee_name || '').toLowerCase()
        const code = (item.employee_code || '').toLowerCase()
        const codeName = `${code} ${name}`.trim()
        const nameCode = `${name} ${code}`.trim()
        return (
            name.includes(normalized) ||
            code.includes(normalized) ||
            codeName.includes(normalized) ||
            nameCode.includes(normalized)
        )
    }

    const filteredItems = items.filter((item) => isMatchEmployeeQuery(item, approvalFilters.search.trim()))
    const filteredHistoryItems = historyItems.filter((item) => {
        const matchesSearch = isMatchEmployeeQuery(item, historyFilters.search.trim())
        const matchesStatus = historyFilters.status ? item.status === historyFilters.status : true
        return matchesSearch && matchesStatus
    })

    const handleReview = async (id, action) => {
        try {
            setProcessingId(id)
            await atasanApi.reviewLeaveRequest(id, action)
            dispatch(showNotification({
                message: action === 'approve' ? 'Pengajuan berhasil disetujui' : 'Pengajuan berhasil ditolak',
                status: 1
            }))
            loadData()
            return true
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
            return false
        } finally {
            setProcessingId(null)
        }
    }

    const openDetailModal = (item) => {
        setSelectedItem(item)
        setShowDetailModal(true)
    }

    const closeDetailModal = () => {
        setSelectedItem(null)
        setShowDetailModal(false)
    }

    const getBuktiUrl = (path) => {
        if (!path) return ''
        const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000'
        return `${baseUrl}/${String(path).replace(/^\/+/, '')}`
    }

    return (
        <>
            <datalist id="employee-filter-options">
                {employeeOptions.map((option) => (
                    <option
                        key={`${option.name}-${option.code}`}
                        value={option.code ? `${option.code} - ${option.name}` : option.name}
                    />
                ))}
            </datalist>

            <TitleCard title="Persetujuan Cuti & Izin" topMargin="mt-0">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <input
                        className="input input-bordered"
                        list="employee-filter-options"
                        placeholder="Pilih / ketik pegawai (kode + nama)"
                        value={approvalFilters.search}
                        onChange={(e) => setApprovalFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={approvalFilters.status}
                        onChange={(e) => setApprovalFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Semua Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button className="btn" onClick={loadData}>Refresh</button>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data pengajuan...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Tipe</th>
                                    <th>Tanggal</th>
                                    <th>Total Hari</th>
                                    <th>Status</th>
                                    <th>Alasan</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className="font-semibold">{item.employee_name}</div>
                                            <div className="text-xs opacity-70">{item.employee_code}</div>
                                        </td>
                                        <td>{item.leave_type}</td>
                                        <td>{new Date(item.start_date).toLocaleDateString('id-ID')} - {new Date(item.end_date).toLocaleDateString('id-ID')}</td>
                                        <td>{item.total_days || item.duration || 0}</td>
                                        <td>
                                            <span className={`badge ${item.status === 'approved' ? 'badge-success' : item.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="max-w-xs truncate" title={item.reason}>{item.reason || '-'}</td>
                                        <td>
                                            {item.status === 'pending' ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        className="btn btn-neutral btn-xs"
                                                        onClick={() => openDetailModal(item)}
                                                    >
                                                        Detail
                                                    </button>
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
                                            ) : (
                                                <button
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => openDetailModal(item)}
                                                >
                                                    Lihat Detail
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Tidak ada data pengajuan</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <TitleCard title="Riwayat Persetujuan Cuti & Izin" topMargin="mt-6">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <input
                        className="input input-bordered"
                        list="employee-filter-options"
                        placeholder="Filter pegawai (kode + nama)"
                        value={historyFilters.search}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, search: e.target.value }))}
                    />
                    <select
                        className="select select-bordered"
                        value={historyFilters.status}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Semua Status Riwayat</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <button className="btn" onClick={loadData}>Refresh</button>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data riwayat...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Tipe</th>
                                    <th>Status</th>
                                    <th>Diproses Oleh</th>
                                    <th>Diproses Pada</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistoryItems.map((item) => (
                                    <tr key={`history-${item.id}`}>
                                        <td>
                                            <div className="font-semibold">{item.employee_name}</div>
                                            <div className="text-xs opacity-70">{item.employee_code}</div>
                                        </td>
                                        <td>{item.leave_type}</td>
                                        <td>
                                            <span className={`badge ${item.status === 'approved' ? 'badge-success' : 'badge-error'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td>{item.approved_by_name || '-'}</td>
                                        <td>{item.approved_at ? new Date(item.approved_at).toLocaleString('id-ID') : '-'}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-xs" onClick={() => openDetailModal(item)}>
                                                Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredHistoryItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Belum ada riwayat persetujuan</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            {showDetailModal && selectedItem && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-2xl">
                        <h3 className="font-bold text-lg mb-4">Detail Pengajuan Cuti/Izin</h3>

                        <div className="grid md:grid-cols-2 grid-cols-1 gap-4 text-sm">
                            <div>
                                <p className="opacity-60">Nama Pegawai</p>
                                <p className="font-semibold">{selectedItem.employee_name || '-'}</p>
                            </div>
                            <div>
                                <p className="opacity-60">Kode Pegawai</p>
                                <p className="font-semibold">{selectedItem.employee_code || '-'}</p>
                            </div>
                            <div>
                                <p className="opacity-60">Jenis Pengajuan</p>
                                <p className="font-semibold">{selectedItem.leave_type || '-'}</p>
                            </div>
                            <div>
                                <p className="opacity-60">Total Hari</p>
                                <p className="font-semibold">{selectedItem.total_days || selectedItem.duration || 0}</p>
                            </div>
                            <div>
                                <p className="opacity-60">Tanggal Mulai</p>
                                <p className="font-semibold">
                                    {selectedItem.start_date ? new Date(selectedItem.start_date).toLocaleDateString('id-ID') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="opacity-60">Tanggal Selesai</p>
                                <p className="font-semibold">
                                    {selectedItem.end_date ? new Date(selectedItem.end_date).toLocaleDateString('id-ID') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="opacity-60">Status</p>
                                <span className={`badge mt-1 ${selectedItem.status === 'approved' ? 'badge-success' : selectedItem.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                                    {selectedItem.status}
                                </span>
                            </div>
                            <div>
                                <p className="opacity-60">Diproses Oleh</p>
                                <p className="font-semibold">{selectedItem.approved_by_name || '-'}</p>
                            </div>
                            <div>
                                <p className="opacity-60">Diajukan Pada</p>
                                <p className="font-semibold">
                                    {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('id-ID') : '-'}
                                </p>
                            </div>
                            <div>
                                <p className="opacity-60">Diproses Pada</p>
                                <p className="font-semibold">
                                    {selectedItem.approved_at ? new Date(selectedItem.approved_at).toLocaleString('id-ID') : '-'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="opacity-60 text-sm">Alasan</p>
                            <div className="p-3 bg-base-200 rounded-lg mt-1 text-sm">
                                {selectedItem.reason || '-'}
                            </div>
                        </div>

                        <div className="mt-4">
                            <p className="opacity-60 text-sm">Bukti Lampiran</p>
                            {selectedItem.bukti ? (
                                <a
                                    href={getBuktiUrl(selectedItem.bukti)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="link link-primary text-sm"
                                >
                                    Lihat bukti ({selectedItem.bukti.split('/').pop()})
                                </a>
                            ) : (
                                <p className="text-sm opacity-70">Tidak ada bukti lampiran.</p>
                            )}
                        </div>

                        <div className="modal-action">
                            <button className="btn" onClick={closeDetailModal}>Tutup</button>
                            {selectedItem.status === 'pending' && (
                                <>
                                    <button
                                        className={`btn btn-success ${processingId === selectedItem.id ? 'loading' : ''}`}
                                        onClick={async () => {
                                            const success = await handleReview(selectedItem.id, 'approve')
                                            if (success) closeDetailModal()
                                        }}
                                        disabled={processingId === selectedItem.id}
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        className={`btn btn-error ${processingId === selectedItem.id ? 'loading' : ''}`}
                                        onClick={async () => {
                                            const success = await handleReview(selectedItem.id, 'reject')
                                            if (success) closeDetailModal()
                                        }}
                                        disabled={processingId === selectedItem.id}
                                    >
                                        Tolak
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </>
    )
}

export default AtasanLeaveRequests
