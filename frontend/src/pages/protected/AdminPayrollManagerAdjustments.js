import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import TitleCard from '../../components/Cards/TitleCard'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import { adminApi } from '../../features/admin/api'
import { formatRupiah, resolveFixedPositionAllowance } from '../../utils/fixedPositionAllowance'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const statusLabelMap = {
    draft: 'Draft',
    submitted: 'Aktif untuk Payroll',
    approved: 'Aktif untuk Payroll',
    rejected: 'Nonaktif',
}

const statusBadgeMap = {
    draft: 'badge-ghost',
    submitted: 'badge-success',
    approved: 'badge-success',
    rejected: 'badge-error',
}

const getCurrentPeriod = () => {
    const now = new Date()
    return {
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
    }
}

const isManagerLevelEmployee = (employee) => {
    const level = String(employee?.level || '').toLowerCase().trim()
    // Strict filter by canonical position level to avoid false positives
    return level === 'manager' || level === 'atasan'
}

const isHrAtasanEmployee = (employee) => {
    if (!isManagerLevelEmployee(employee)) return false

    const departmentName = String(employee?.department_name || '').toLowerCase().trim()
    const positionName = String(employee?.position_name || '').toLowerCase().trim()
    const roleLabel = String(employee?.role || employee?.roles || '').toLowerCase().trim()

    return (
        departmentName.includes('hr') ||
        departmentName.includes('human resource') ||
        positionName.includes('hr') ||
        positionName.includes('human resource') ||
        roleLabel.includes('hr')
    )
}

const disableNumberWheelChange = (event) => {
    event.currentTarget.blur()
}

function AdminPayrollManagerAdjustments() {
    const dispatch = useDispatch()
    const initialPeriod = getCurrentPeriod()

    const [periodMonth, setPeriodMonth] = useState(initialPeriod.month)
    const [periodYear, setPeriodYear] = useState(initialPeriod.year)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [managerEmployees, setManagerEmployees] = useState([])
    const [periodAdjustments, setPeriodAdjustments] = useState([])
    const [historyAdjustments, setHistoryAdjustments] = useState([])
    const [historyFilters, setHistoryFilters] = useState({
        search: '',
        status: '',
    })

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [form, setForm] = useState({
        bonus: '',
        other_allowance: '',
        other_deduction: '',
        notes: '',
    })

    const selectedAdjustment = useMemo(() => {
        if (!selectedEmployeeId) return null
        return periodAdjustments.find((item) => String(item.employee_id) === String(selectedEmployeeId)) || null
    }, [periodAdjustments, selectedEmployeeId])

    const selectedEmployee = useMemo(() => {
        if (!selectedEmployeeId) return null
        return managerEmployees.find((item) => String(item.id) === String(selectedEmployeeId)) || null
    }, [managerEmployees, selectedEmployeeId])

    const selectedEmployeeFixedAllowance = useMemo(() => {
        return resolveFixedPositionAllowance(selectedEmployee)
    }, [selectedEmployee])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [employeesResult, periodAdjustmentResult, historyAdjustmentResult] = await Promise.all([
                adminApi.getEmployees(),
                adminApi.getPayrollManagerAdjustments({ month: periodMonth, year: periodYear }),
                adminApi.getPayrollManagerAdjustments(),
            ])

            const managerRows = (employeesResult || []).filter((item) => isHrAtasanEmployee(item))
            setManagerEmployees(managerRows)
            setPeriodAdjustments(periodAdjustmentResult?.data || [])
            setHistoryAdjustments(historyAdjustmentResult?.data || [])

            setSelectedEmployeeId((prev) => {
                if (!prev) return prev
                const existsInFiltered = managerRows.some((row) => String(row.id) === String(prev))
                return existsInFiltered ? prev : ''
            })
        } catch (error) {
            dispatch(showNotification({ message: error.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch, periodMonth, periodYear])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Adjustment Payroll' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!selectedAdjustment) {
            setForm({
                bonus: '',
                other_allowance: String(selectedEmployeeFixedAllowance || 0),
                other_deduction: '',
                notes: '',
            })
            return
        }

        setForm({
            bonus: String(Number(selectedAdjustment.bonus || 0)),
            other_allowance: String(selectedEmployeeFixedAllowance || 0),
            other_deduction: String(Number(selectedAdjustment.other_deduction || 0)),
            notes: selectedAdjustment.notes || '',
        })
    }, [selectedAdjustment, selectedEmployeeFixedAllowance])

    const handleSaveAdjustment = async () => {
        if (!selectedEmployeeId) {
            dispatch(showNotification({ message: 'Pilih pegawai terlebih dahulu', status: 0 }))
            return
        }

        try {
            setSaving(true)
            await adminApi.upsertPayrollManagerAdjustment({
                employee_id: Number(selectedEmployeeId),
                period_month: Number(periodMonth),
                period_year: Number(periodYear),
                bonus: Math.round(Number(form.bonus || 0)),
                other_allowance: Number(selectedEmployeeFixedAllowance || 0),
                other_deduction: Math.round(Number(form.other_deduction || 0)),
                notes: form.notes,
            })

            dispatch(showNotification({ message: 'Adjustment payroll tersimpan dan langsung aktif', status: 1 }))
            setSelectedEmployeeId('')
            setForm({
                bonus: '',
                other_allowance: '',
                other_deduction: '',
                notes: '',
            })
            await loadData()
        } catch (error) {
            dispatch(showNotification({ message: error.message, status: 0 }))
        } finally {
            setSaving(false)
        }
    }

    const filteredHistoryRows = useMemo(() => {
        const query = String(historyFilters.search || '').trim().toLowerCase()
        const allowedEmployeeIds = new Set(managerEmployees.map((row) => String(row.id)))

        return historyAdjustments.filter((item) => {
            const hrAtasanOnlyMatch = allowedEmployeeIds.has(String(item.employee_id))
            const statusMatch = !historyFilters.status || String(item.status || '') === String(historyFilters.status)
            const searchMatch = !query
                || String(item.employee_name || '').toLowerCase().includes(query)
                || String(item.employee_code || '').toLowerCase().includes(query)
                || String(item.notes || '').toLowerCase().includes(query)

            return hrAtasanOnlyMatch && statusMatch && searchMatch
        })
    }, [historyAdjustments, historyFilters, managerEmployees])

    return (
        <>
            <TitleCard title="Input Adjustment Payroll" topMargin="mt-0">
                <div className="grid md:grid-cols-4 grid-cols-1 gap-4 mb-4">
                    <select className="select select-bordered" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)}>
                        {Array.from({ length: 12 }, (_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                                {new Date(2000, idx).toLocaleString('id-ID', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select className="select select-bordered" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)}>
                        {Array.from({ length: 5 }, (_, idx) => {
                            const year = new Date().getFullYear() - idx
                            return <option key={year} value={year}>{year}</option>
                        })}
                    </select>
                    <select
                        className="select select-bordered md:col-span-2"
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    >
                        <option value="">Pilih pegawai HR level atasan/manager</option>
                        {managerEmployees.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.name} ({member.employee_code})
                            </option>
                        ))}
                    </select>
                </div>

                <p className="text-xs opacity-70 mb-4">
                    Dropdown hanya menampilkan pegawai HR yang menjabat level atasan/manager. Nilai Tunjangan Lainnya otomatis mengikuti jabatan dan tidak bisa diedit.
                </p>

                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-4">
                    <label className="form-control">
                        <span className="label-text">Bonus</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            className="input input-bordered"
                            value={form.bonus}
                            onWheel={disableNumberWheelChange}
                            onChange={(e) => setForm((prev) => ({ ...prev, bonus: e.target.value }))}
                        />
                    </label>
                    <label className="form-control">
                        <span className="label-text">Tunjangan Lainnya</span>
                        <input
                            type="number"
                            min="0"
                            className="input input-bordered"
                            value={form.other_allowance}
                            disabled
                        />
                        <span className="label-text-alt">Nominal tetap sesuai jabatan: {formatRupiah(selectedEmployeeFixedAllowance)}</span>
                    </label>
                    <label className="form-control">
                        <span className="label-text">Potongan Lainnya</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            className="input input-bordered"
                            value={form.other_deduction}
                            onWheel={disableNumberWheelChange}
                            onChange={(e) => setForm((prev) => ({ ...prev, other_deduction: e.target.value }))}
                        />
                    </label>
                </div>

                <label className="form-control mb-4">
                    <span className="label-text">Catatan</span>
                    <textarea
                        className="textarea textarea-bordered"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Tuliskan alasan penyesuaian komponen payroll"
                    />
                </label>

                <div className="flex flex-wrap gap-2">
                    <button className={`btn btn-primary ${saving ? 'loading' : ''}`} onClick={handleSaveAdjustment} disabled={saving}>
                        Simpan Adjustment
                    </button>
                    <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </TitleCard>

            <TitleCard title="Riwayat Adjustment Payroll yang di input" topMargin="mt-6">
                <div className="grid lg:grid-cols-2 md:grid-cols-2 grid-cols-1 gap-4 mb-4">
                    <div className="relative">
                        <input
                            type="search"
                            className="input input-bordered w-full pr-10"
                            placeholder="Cari nama/kode pegawai atau catatan"
                            value={historyFilters.search}
                            onChange={(e) => setHistoryFilters((prev) => ({ ...prev, search: e.target.value }))}
                        />
                        <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                    </div>

                    <select
                        className="select select-bordered"
                        value={historyFilters.status}
                        onChange={(e) => setHistoryFilters((prev) => ({ ...prev, status: e.target.value }))}
                    >
                        <option value="">Semua Status</option>
                        <option value="draft">Draft</option>
                        <option value="submitted">Aktif untuk Payroll</option>
                        <option value="approved">Aktif untuk Payroll</option>
                        <option value="rejected">Nonaktif</option>
                    </select>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data adjustment payroll...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Periode</th>
                                    <th>Bonus</th>
                                    <th>Tunjangan Lain</th>
                                    <th>Potongan Lain</th>
                                    <th>Status</th>
                                    <th>Catatan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredHistoryRows.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs opacity-70">{item.employee_code}</div>
                                            </td>
                                            <td>{item.period_month}/{item.period_year}</td>
                                            <td>Rp {(Number(item.bonus) || 0).toLocaleString('id-ID')}</td>
                                            <td>Rp {(Number(item.other_allowance) || 0).toLocaleString('id-ID')}</td>
                                            <td>Rp {(Number(item.other_deduction) || 0).toLocaleString('id-ID')}</td>
                                            <td>
                                                <span className={`badge ${statusBadgeMap[item.status] || 'badge-ghost'}`}>
                                                    {statusLabelMap[item.status] || item.status}
                                                </span>
                                            </td>
                                            <td className="max-w-xs whitespace-pre-wrap">{item.notes || '-'}</td>
                                        </tr>
                                    ))}
                                {!filteredHistoryRows.length && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Belum ada riwayat adjustment payroll untuk role HR level atasan/manager</td>
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

export default AdminPayrollManagerAdjustments
