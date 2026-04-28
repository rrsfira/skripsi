import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { financeApi } from '../../features/finance/api'

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const toSafeArray = (value) => {
    if (Array.isArray(value)) {
        return value.filter((item) => item !== null && item !== undefined)
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value)
            return Array.isArray(parsed)
                ? parsed.filter((item) => item !== null && item !== undefined)
                : []
        } catch (error) {
            return []
        }
    }
    return []
}

const safeText = (value, fallback = '-') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        const text = String(value)
        return text.trim() ? text : fallback
    }

    try {
        const serialized = JSON.stringify(value)
        return serialized && serialized !== '{}' ? serialized : fallback
    } catch (error) {
        return fallback
    }
}

const normalizeReasonItem = (item) => {
    if (item && typeof item === 'object') {
        return {
            appeal_reason_item: item.appeal_reason_item || '',
            appeal_reason_label: item.appeal_reason_label || '',
            reason: item.reason || '',
        }
    }

    return {
        appeal_reason_item: '',
        appeal_reason_label: '',
        reason: String(item || ''),
    }
}

const normalizeReviewItem = (item) => {
    if (item && typeof item === 'object') {
        return {
            label: item.label || '',
            decision: item.decision || '',
            adjustment_amount: item.adjustment_amount,
            rejection_note: item.rejection_note || '',
        }
    }

    return {
        label: '',
        decision: '',
        adjustment_amount: null,
        rejection_note: String(item || ''),
    }
}

const getApprovedReviewItems = (appeal) => {
    const approvedFromItems = toSafeArray(appeal?.review_result_items)
        .map((item) => normalizeReviewItem(item))
        .filter((item) => item.decision === 'approve')

    if (approvedFromItems.length > 0) {
        return approvedFromItems
    }

    const lines = String(appeal?.review_notes || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && /disetujui/i.test(line))

    return lines.map((line) => {
        const labelMatch = line.match(/^\[(.*?)\]/)
        const amountMatch = line.match(/(?:nominal\s*perbaikan\s*:?\s*)(\d+[\d.,]*)/i)

        const normalizedAmount = amountMatch
            ? Number(String(amountMatch[1]).replace(/\./g, '').replace(/,/g, '.')) || 0
            : 0

        return {
            label: labelMatch?.[1] || '-',
            decision: 'approve',
            adjustment_amount: normalizedAmount,
            rejection_note: '',
        }
    })
}

function FinanceSalaryAppeals() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [approvedAppeals, setApprovedAppeals] = useState([])
    const [selectedAppeal, setSelectedAppeal] = useState(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [filters, setFilters] = useState({
        search: '',
        month: '',
        year: '',
    })

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const result = await financeApi.getSalaryAppeals({ status: 'approved' })
            setApprovedAppeals(result?.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Banding Gaji Finance' }))
        loadData()
    }, [dispatch, loadData])

    const activeApprovedAppeals = useMemo(() => {
        return approvedAppeals.filter((item) => {
            const payrollStatus = String(item.payroll_status || '').toLowerCase()
            const hasRevisedAmount = item.final_amount !== null && item.final_amount !== undefined

            if (hasRevisedAmount && ['published', 'claimed'].includes(payrollStatus)) {
                return false
            }

            return true
        })
    }, [approvedAppeals])

    const yearOptions = useMemo(() => {
        const years = new Set(
            activeApprovedAppeals
                .map((item) => Number(item.period_year))
                .filter((year) => Number.isFinite(year) && year > 0)
        )

        return Array.from(years).sort((a, b) => b - a)
    }, [activeApprovedAppeals])

    const filteredAppeals = useMemo(() => {
        return activeApprovedAppeals.filter((item) => {
            const keyword = filters.search.trim().toLowerCase()
            const matchesSearch = !keyword || [
                item.full_name,
                item.employee_name,
                item.employee_code,
                item.department_name,
                item.position_name,
            ]
                .map((value) => String(value || '').toLowerCase())
                .some((value) => value.includes(keyword))

            const matchesMonth = !filters.month || String(item.period_month) === String(filters.month)
            const matchesYear = !filters.year || String(item.period_year) === String(filters.year)

            return matchesSearch && matchesMonth && matchesYear
        })
    }, [activeApprovedAppeals, filters])

    const historyAppeals = useMemo(() => {
        return approvedAppeals.filter((item) => {
            const payrollStatus = String(item.payroll_status || '').toLowerCase()
            const hasRevisedAmount = item.final_amount !== null && item.final_amount !== undefined

            return hasRevisedAmount || ['published', 'claimed'].includes(payrollStatus)
        })
    }, [approvedAppeals])

    const totalAdjustmentAmount = useMemo(() => {
        return filteredAppeals.reduce((total, item) => total + Number(item.expected_amount || 0), 0)
    }, [filteredAppeals])

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const openDetailModal = (appeal) => {
        setSelectedAppeal(appeal)
        setShowDetailModal(true)
    }

    if (loading) {
        return <div className="text-center py-10">Memuat data banding gaji...</div>
    }

    return (
        <>
            {error && <div className="alert alert-error mb-4"><span>{error}</span></div>}

            <TitleCard title="Daftar Banding Gaji Disetujui HR / Direktur" topMargin="mt-0">
                <div className="grid md:grid-cols-3 grid-cols-1 gap-3 mb-4">
                    <div className="rounded-lg p-4 bg-base-200">
                        <p className="text-sm opacity-70">Total Disetujui HR / Direktur</p>
                        <p className="text-2xl font-semibold">{activeApprovedAppeals.length}</p>
                    </div>
                    <div className="rounded-lg p-4 bg-base-200">
                        <p className="text-sm opacity-70">Data Ditampilkan</p>
                        <p className="text-2xl font-semibold">{filteredAppeals.length}</p>
                    </div>
                    <div className="rounded-lg p-4 bg-base-200">
                        <p className="text-sm opacity-70">Total Nominal Perbaikan</p>
                        <p className="text-xl font-semibold">{formatCurrency(totalAdjustmentAmount)}</p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    <input
                        className="input input-bordered w-full"
                        placeholder="Cari nama/kode/departemen/posisi"
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                    <select
                        className="select select-bordered w-full"
                        value={filters.month}
                        onChange={(e) => handleFilterChange('month', e.target.value)}
                    >
                        <option value="">Semua Bulan</option>
                        {Array.from({ length: 12 }, (_, index) => (
                            <option key={index + 1} value={index + 1}>
                                {new Date(2000, index, 1).toLocaleString('id-ID', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered w-full"
                        value={filters.year}
                        onChange={(e) => handleFilterChange('year', e.target.value)}
                    >
                        <option value="">Semua Tahun</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Pegawai</th>
                                <th>Kode</th>
                                <th>Departement</th>
                                <th>Posisi</th>
                                <th>Periode</th>
                                <th>Tanggal Review</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppeals.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.full_name || item.employee_name || '-'}</td>
                                    <td>{item.employee_code || '-'}</td>
                                    <td>{item.department_name || '-'}</td>
                                    <td>{item.position_name || '-'}</td>
                                    <td>{item.period_month}/{item.period_year}</td>
                                    <td>{item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('id-ID') : '-'}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className="link link-neutral text-xs"
                                            onClick={() => openDetailModal(item)}
                                        >
                                            Lihat
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredAppeals.length === 0 && (
                                <tr><td colSpan={7} className="text-center opacity-70">Belum ada banding gaji yang disetujui HR / Direktur</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </TitleCard>

            <TitleCard title="Riwayat Banding Gaji" topMargin="mt-6">
                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Pegawai</th>
                                <th>Kode</th>
                                <th>Periode</th>
                                <th>Nominal Banding</th>
                                <th>Nominal Final</th>
                                <th>Status Payroll</th>
                                <th>Tanggal Review</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyAppeals.map((item) => (
                                <tr key={`history-${item.id}`}>
                                    <td>{item.full_name || item.employee_name || '-'}</td>
                                    <td>{item.employee_code || '-'}</td>
                                    <td>{item.period_month}/{item.period_year}</td>
                                    <td>{formatCurrency(item.expected_amount || 0)}</td>
                                    <td>{formatCurrency(item.final_amount || 0)}</td>
                                    <td>{safeText(item.payroll_status)}</td>
                                    <td>{item.reviewed_at ? new Date(item.reviewed_at).toLocaleString('id-ID') : '-'}</td>
                                </tr>
                            ))}
                            {historyAppeals.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center opacity-70">Belum ada riwayat banding gaji</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </TitleCard>

            {showDetailModal && selectedAppeal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-4xl">
                        <h3 className="font-bold text-lg mb-4">Detail Banding Gaji untuk Revisi</h3>

                        <div className="space-y-4 text-sm">
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="bg-base-200 rounded-lg p-3">
                                    <p><span className="font-semibold">Pegawai:</span> {safeText(selectedAppeal.full_name || selectedAppeal.employee_name)}</p>
                                    <p><span className="font-semibold">Kode:</span> {safeText(selectedAppeal.employee_code)}</p>
                                    <p><span className="font-semibold">Departement:</span> {safeText(selectedAppeal.department_name)}</p>
                                    <p><span className="font-semibold">Posisi:</span> {safeText(selectedAppeal.position_name)}</p>
                                </div>
                                <div className="bg-base-200 rounded-lg p-3">
                                    <p><span className="font-semibold">Periode:</span> {safeText(selectedAppeal.period_month)}/{safeText(selectedAppeal.period_year)}</p>
                                    <p><span className="font-semibold">Direview oleh:</span> {safeText(selectedAppeal.reviewer_name)}</p>
                                    <p><span className="font-semibold">Tanggal Review:</span> {selectedAppeal.reviewed_at ? new Date(selectedAppeal.reviewed_at).toLocaleString('id-ID') : '-'}</p>
                                    <p><span className="font-semibold">Total Nominal Perbaikan:</span> {formatCurrency(selectedAppeal.expected_amount || 0)}</p>
                                </div>
                            </div>

                            <div className="bg-base-200 rounded-lg p-3">
                                <p className="font-semibold mb-2">Alasan Banding Pegawai</p>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra table-sm">
                                        <thead>
                                            <tr>
                                                <th>Komponen</th>
                                                <th>Alasan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {toSafeArray(selectedAppeal.appeal_reason_items).map((rawItem, index) => {
                                                const reasonItem = normalizeReasonItem(rawItem)
                                                return (
                                                <tr key={`${reasonItem.appeal_reason_item || 'reason'}-${index}`}>
                                                    <td>{safeText(reasonItem.appeal_reason_label || reasonItem.appeal_reason_item)}</td>
                                                    <td>{safeText(reasonItem.reason)}</td>
                                                </tr>
                                                )
                                            })}
                                            {toSafeArray(selectedAppeal.appeal_reason_items).length === 0 && (
                                                <tr>
                                                    <td colSpan={2} className="text-center opacity-70">Tidak ada detail alasan</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-base-200 rounded-lg p-3">
                                <p className="font-semibold mb-2">Hasil Review (Disetujui)</p>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra table-sm">
                                        <thead>
                                            <tr>
                                                <th>Komponen</th>
                                                <th>Keputusan</th>
                                                <th>Nominal</th>
                                                <th>Catatan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getApprovedReviewItems(selectedAppeal).map((reviewItem, index) => {
                                                return (
                                                <tr key={`${reviewItem.label || 'review'}-${index}`}>
                                                    <td>{safeText(reviewItem.label)}</td>
                                                    <td>Disetujui</td>
                                                    <td>{formatCurrency(reviewItem.adjustment_amount || 0)}</td>
                                                    <td>-</td>
                                                </tr>
                                                )
                                            })}
                                            {getApprovedReviewItems(selectedAppeal).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="text-center opacity-70">Belum ada item yang disetujui</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="modal-action">
                            <button type="button" className="btn btn-ghost" onClick={() => setShowDetailModal(false)}>
                                Tutup
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => {
                                    navigate(
                                        `/app/payroll/revision?employee_id=${selectedAppeal.employee_id}&month=${selectedAppeal.period_month}&year=${selectedAppeal.period_year}&source=salary-appeal&appeal_id=${selectedAppeal.id}`,
                                        { state: { appeal: selectedAppeal } }
                                    )
                                }}
                            >
                                Lanjut Revisi Payroll
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default FinanceSalaryAppeals
