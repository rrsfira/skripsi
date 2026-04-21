import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import TitleCard from '../../components/Cards/TitleCard'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import { hrApi } from '../../features/hr/api'
import { formatRupiah, resolveFixedPositionAllowance } from '../../utils/fixedPositionAllowance'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const statusLabelMap = {
    draft: 'Draft',
    submitted: 'Aktif untuk Payroll',
    approved: 'Aktif untuk Payroll',
    rejected: 'Nonaktif',
}

const getCurrentPeriod = () => {
    const now = new Date()
    return {
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
    }
}

const disableNumberWheelChange = (event) => {
    event.currentTarget.blur()
}

const buildEmployeeSelectionOptions = (items = []) => {
    return [...items]
        .sort((a, b) => {
            const codeA = String(a?.employee_code || '').trim()
            const codeB = String(b?.employee_code || '').trim()

            if (codeA && codeB) {
                return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' })
            }

            if (codeA && !codeB) return -1
            if (!codeA && codeB) return 1

            const nameA = String(a?.name || '').trim()
            const nameB = String(b?.name || '').trim()
            return nameA.localeCompare(nameB, 'id', { sensitivity: 'base' })
        })
        .map((item) => ({
            id: String(item.id),
            name: String(item.name || '').trim(),
            code: String(item.employee_code || '').trim(),
            label: String(item.employee_code || '').trim()
                ? `${String(item.name || '').trim()} (${String(item.employee_code || '').trim()})`
                : String(item.name || '').trim(),
        }))
}

function HRPayrollDirectorAdjustments() {
    const dispatch = useDispatch()
    const initialPeriod = getCurrentPeriod()

    const [periodMonth, setPeriodMonth] = useState(initialPeriod.month)
    const [periodYear, setPeriodYear] = useState(initialPeriod.year)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [availableEmployees, setAvailableEmployees] = useState([])
    const [periodAdjustments, setPeriodAdjustments] = useState([])
    const [historyAdjustments, setHistoryAdjustments] = useState([])

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [selectedEmployeeInput, setSelectedEmployeeInput] = useState('')
    const [historyEmployeeInput, setHistoryEmployeeInput] = useState('')
    const [historyFilters, setHistoryFilters] = useState({
        employee_id: '',
        month: initialPeriod.month,
        year: initialPeriod.year,
    })
    const historyCardRef = useRef(null)
    const [form, setForm] = useState({
        bonus: '',
        other_allowance: '',
        other_deduction: '',
        notes: '',
    })

    const employeeSelectionOptions = useMemo(() => buildEmployeeSelectionOptions(availableEmployees), [availableEmployees])

    const selectedAdjustment = useMemo(() => {
        if (!selectedEmployeeId) return null
        return periodAdjustments.find((item) => String(item.employee_id) === String(selectedEmployeeId)) || null
    }, [periodAdjustments, selectedEmployeeId])

    const selectedEmployee = useMemo(() => {
        if (!selectedEmployeeId) return null
        return availableEmployees.find((item) => String(item.id) === String(selectedEmployeeId)) || null
    }, [availableEmployees, selectedEmployeeId])

    useEffect(() => {
        if (!selectedEmployeeId) {
            setSelectedEmployeeInput('')
            return
        }

        const selectedOption = employeeSelectionOptions.find((item) => item.id === String(selectedEmployeeId))
        setSelectedEmployeeInput(selectedOption?.label || '')
    }, [selectedEmployeeId, employeeSelectionOptions])

    const selectedEmployeeFixedAllowance = useMemo(() => {
        return resolveFixedPositionAllowance(selectedEmployee)
    }, [selectedEmployee])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [employeesResult, adjustmentResult, allAdjustmentsResult] = await Promise.all([
                hrApi.getEmployees(),
                hrApi.getPayrollManagerAdjustments({ month: periodMonth, year: periodYear }),
                hrApi.getPayrollManagerAdjustments(),
            ])

            const employeeRows = employeesResult?.data || []
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
            const currentUserId = Number(currentUser?.user_id || currentUser?.id || 0)
            const currentUserEmail = String(currentUser?.email || '').toLowerCase().trim()
            const currentUsername = String(currentUser?.username || '').toLowerCase().trim()

            const filteredRows = employeeRows.filter((item) => {
                const employeeUserId = Number(item?.user_id || 0)
                const employeeEmail = String(item?.email || '').toLowerCase().trim()
                const employeeName = String(item?.name || '').toLowerCase().trim()

                if (currentUserId && employeeUserId && employeeUserId === currentUserId) {
                    return false
                }

                if (currentUserEmail && employeeEmail && employeeEmail === currentUserEmail) {
                    return false
                }

                if (currentUsername && employeeName && employeeName === currentUsername) {
                    return false
                }

                return true
            })

            setAvailableEmployees(filteredRows)
            setPeriodAdjustments(adjustmentResult?.data || [])
            setHistoryAdjustments(allAdjustmentsResult?.data || [])

            setSelectedEmployeeId((prev) => {
                if (!prev) return prev
                const existsInFiltered = filteredRows.some((row) => String(row.id) === String(prev))
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

    const scrollToHistoryCard = useCallback(() => {
        window.requestAnimationFrame(() => {
            historyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [])

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
            await hrApi.upsertPayrollManagerAdjustment({
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
            scrollToHistoryCard()
        } catch (error) {
            dispatch(showNotification({ message: error.message, status: 0 }))
        } finally {
            setSaving(false)
        }
    }

    const filteredHistoryRows = useMemo(() => {
        const selectedMonth = Number(historyFilters.month || 0)
        const selectedYear = Number(historyFilters.year || 0)
        const selectedHistoryEmployeeId = String(historyFilters.employee_id || '')

        return historyAdjustments.filter((item) => {
            const periodMatch = (!selectedMonth || Number(item.period_month) === selectedMonth)
                && (!selectedYear || Number(item.period_year) === selectedYear)
            const employeeMatch = !selectedHistoryEmployeeId
                || String(item.employee_id || '') === selectedHistoryEmployeeId

            return periodMatch && employeeMatch
        }).slice().sort((a, b) => {
            const updatedA = new Date(a?.updated_at || a?.created_at || 0).getTime()
            const updatedB = new Date(b?.updated_at || b?.created_at || 0).getTime()
            if (updatedA !== updatedB) return updatedB - updatedA

            const periodA = (Number(a?.period_year || 0) * 100) + Number(a?.period_month || 0)
            const periodB = (Number(b?.period_year || 0) * 100) + Number(b?.period_month || 0)
            if (periodA !== periodB) return periodB - periodA

            return Number(b?.id || 0) - Number(a?.id || 0)
        })
    }, [historyAdjustments, historyFilters.employee_id, historyFilters.month, historyFilters.year])

    const handleEmployeeInputChange = (value) => {
        setSelectedEmployeeInput(value)
        const parsed = String(value || '').trim()
        const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
        const extractedCode = match ? String(match[2] || '').trim().toLowerCase() : ''
        const normalizedName = (match ? String(match[1] || '') : parsed).trim().toLowerCase()
        const normalizedValue = parsed.toLowerCase()

        const found = employeeSelectionOptions.find((item) => {
            const optionCode = String(item.code || '').trim().toLowerCase()
            const optionName = String(item.name || '').trim().toLowerCase()
            const optionLabel = String(item.label || '').trim().toLowerCase()

            if (extractedCode) return optionCode === extractedCode
            return optionCode === normalizedValue || optionName === normalizedName || optionLabel === normalizedValue
        })

        setSelectedEmployeeId(found?.id || '')
    }

    const handleHistoryEmployeeInputChange = (value) => {
        setHistoryEmployeeInput(value)
        const parsed = String(value || '').trim()
        const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
        const extractedCode = match ? String(match[2] || '').trim().toLowerCase() : ''
        const normalizedName = (match ? String(match[1] || '') : parsed).trim().toLowerCase()
        const normalizedValue = parsed.toLowerCase()

        const found = employeeSelectionOptions.find((item) => {
            const optionCode = String(item.code || '').trim().toLowerCase()
            const optionName = String(item.name || '').trim().toLowerCase()
            const optionLabel = String(item.label || '').trim().toLowerCase()

            if (extractedCode) return optionCode === extractedCode
            return optionCode === normalizedValue || optionName === normalizedName || optionLabel === normalizedValue
        })

        setHistoryFilters((prev) => ({ ...prev, employee_id: found?.id || '' }))
    }

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
                    <div className="form-control md:col-span-2">
                        <div className="relative">
                            <input
                                type="search"
                                list="hr-adjustment-employee-options"
                                className="input input-bordered w-full pr-10"
                                placeholder="Pilih pegawai..."
                                value={selectedEmployeeInput}
                                onChange={(e) => handleEmployeeInputChange(e.target.value)}
                            />
                            <datalist id="hr-adjustment-employee-options">
                                {employeeSelectionOptions.map((option) => (
                                    <option key={option.id} value={option.label} />
                                ))}
                            </datalist>
                            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                        </div>
                    </div>
                </div>

                <p className="text-xs opacity-70 mb-4">
                    Dropdown menampilkan semua pegawai. Nilai Tunjangan Lainnya otomatis mengikuti jabatan dan tidak bisa diedit.
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
                    <span className="label-text">Catatan HR</span>
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

            <div ref={historyCardRef}>
                <TitleCard title="Riwayat Adjustment Payroll" topMargin="mt-6">
                <div className="mb-4 rounded-lg border border-base-300 bg-base-200/40 p-4">
                    <div className="grid lg:grid-cols-6 md:grid-cols-2 grid-cols-1 gap-4 items-end">
                        <div className="form-control lg:col-span-3">
                            <label className="label py-1">
                                <span className="label-text text-xs font-medium uppercase tracking-wide opacity-70">Pegawai</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="search"
                                    list="hr-history-adjustment-employee-options"
                                    className="input input-bordered w-full pr-10"
                                    placeholder="Cari nama atau kode pegawai"
                                    value={historyEmployeeInput}
                                    onChange={(e) => handleHistoryEmployeeInputChange(e.target.value)}
                                />
                                <datalist id="hr-history-adjustment-employee-options">
                                    {employeeSelectionOptions.map((option) => (
                                        <option key={`history-${option.id}`} value={option.label} />
                                    ))}
                                </datalist>
                                <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                            </div>
                        </div>

                        <div className="form-control lg:col-span-2">
                            <label className="label py-1">
                                <span className="label-text text-xs font-medium uppercase tracking-wide opacity-70">Bulan Periode</span>
                            </label>
                            <select
                                className="select select-bordered"
                                value={historyFilters.month}
                                onChange={(e) => setHistoryFilters((prev) => ({ ...prev, month: e.target.value }))}
                            >
                                {Array.from({ length: 12 }, (_, idx) => (
                                    <option key={`history-period-month-${idx + 1}`} value={idx + 1}>
                                        {new Date(2000, idx).toLocaleString('id-ID', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-control lg:col-span-1">
                            <label className="label py-1">
                                <span className="label-text text-xs font-medium uppercase tracking-wide opacity-70">Tahun</span>
                            </label>
                            <select
                                className="select select-bordered"
                                value={historyFilters.year}
                                onChange={(e) => setHistoryFilters((prev) => ({ ...prev, year: e.target.value }))}
                            >
                                {Array.from({ length: 5 }, (_, idx) => {
                                    const year = new Date().getFullYear() - idx
                                    return <option key={`history-period-year-${year}`} value={year}>{year}</option>
                                })}
                            </select>
                        </div>
                    </div>
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
                                        <td>{statusLabelMap[item.status] || item.status || '-'}</td>
                                        <td className="max-w-xs whitespace-pre-wrap">{item.notes || '-'}</td>
                                    </tr>
                                ))}
                                {!filteredHistoryRows.length && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Belum ada adjustment payroll untuk periode ini</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                </TitleCard>
            </div>
        </>
    )
}

export default HRPayrollDirectorAdjustments
