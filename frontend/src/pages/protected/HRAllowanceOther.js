import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import TitleCard from '../../components/Cards/TitleCard'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import { hrApi } from '../../features/hr/api'
import { financeApi } from '../../features/finance/api'
import { resolveFixedPositionAllowance } from '../../utils/fixedPositionAllowance'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useLocation, useNavigate } from 'react-router-dom'

const statusLabelMap = {
    draft: 'Draft',
    submitted: 'Siap Diproses',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    included_in_payroll: 'Masuk Payroll',
}

const getStatusBadgeColor = (status) => {
    switch (status) {
        case 'draft':
            return 'badge-info'
        case 'submitted':
            return 'badge-warning'
        case 'approved':
            return 'badge-success'
        case 'rejected':
            return 'badge-error'
        case 'included_in_payroll':
            return 'badge-success'
        default:
            return 'badge-neutral'
    }
}

const isIncludedInPayroll = (item = {}) => {
    const status = String(item?.status || '').toLowerCase().trim()

    return status === 'included_in_payroll' || Number(item?.payroll_id || 0) > 0
}

const isDoneAllowance = (item = {}) => {
    return String(item?.status || '').toLowerCase().trim() === 'done'
}

const isSubmittedAllowance = (item = {}) => {
    return String(item?.status || '').toLowerCase().trim() === 'submitted'
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
    const location = useLocation()
    const navigate = useNavigate()
    const initialPeriod = getCurrentPeriod()
    const isFinanceHistoryOnlyView = location.pathname.endsWith('/payroll/other-allowance')
    const backPath = isFinanceHistoryOnlyView ? '/app/payroll/component' : '/app/hr-allowance'

    const backButton = (
        <button
            className="btn btn-sm btn-ghost"
            title={isFinanceHistoryOnlyView ? 'Kembali ke Manajemen Payroll' : 'Kembali ke Manajemen Tunjangan'}
            onClick={() => navigate(backPath)}
        >
            Kembali
        </button>
    )

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

            if (isFinanceHistoryOnlyView) {
                const historyResult = await financeApi.getPayrollManagerAdjustments()
                const historyRows = historyResult?.data || []
                const derivedEmployees = [...new Map(
                    historyRows
                        .filter((item) => Number(item?.employee_id || 0) > 0)
                        .map((item) => [
                            String(item.employee_id),
                            {
                                id: String(item.employee_id),
                                name: String(item.employee_name || '').trim(),
                                employee_code: String(item.employee_code || '').trim(),
                            },
                        ])
                ).values()]

                setAvailableEmployees(derivedEmployees)
                setPeriodAdjustments([])
                setHistoryAdjustments(historyRows)
                setSelectedEmployeeId('')
                return
            }

            const [employeesResult, adjustmentResult, allAdjustmentsResult] = await Promise.all([
                hrApi.getEmployees(),
                hrApi.getPayrollManagerAdjustments({ month: periodMonth, year: periodYear }),
                hrApi.getPayrollManagerAdjustments(),
            ])

            const employeeRows = employeesResult?.data || []

            setAvailableEmployees(employeeRows)
            setPeriodAdjustments(adjustmentResult?.data || [])
            setHistoryAdjustments(allAdjustmentsResult?.data || [])
        } catch (error) {
            dispatch(showNotification({ message: error.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch, isFinanceHistoryOnlyView, periodMonth, periodYear])

    useEffect(() => {
        dispatch(setPageTitle({ title: isFinanceHistoryOnlyView ? 'Riwayat Tunjangan Lain' : 'Tunjangan Lain' }))
    }, [dispatch, isFinanceHistoryOnlyView])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!isFinanceHistoryOnlyView) return

        setHistoryFilters((prev) => ({
            ...prev,
            month: '',
            year: '',
        }))
    }, [isFinanceHistoryOnlyView])

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

            dispatch(showNotification({ message: 'Tunjangan tersimpan dan langsung aktif', status: 1 }))
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
            // If opened by finance, riwayat table should only show items with status 'done'
            if (isFinanceHistoryOnlyView) {
                return periodMatch && employeeMatch && isDoneAllowance(item)
            }

            const payrollMatch = !isFinanceHistoryOnlyView || isIncludedInPayroll(item)

            return periodMatch && employeeMatch && payrollMatch
        }).slice().sort((a, b) => {
            const updatedA = new Date(a?.updated_at || a?.created_at || 0).getTime()
            const updatedB = new Date(b?.updated_at || b?.created_at || 0).getTime()
            if (updatedA !== updatedB) return updatedB - updatedA

            const periodA = (Number(a?.period_year || 0) * 100) + Number(a?.period_month || 0)
            const periodB = (Number(b?.period_year || 0) * 100) + Number(b?.period_month || 0)
            if (periodA !== periodB) return periodB - periodA

            return Number(b?.id || 0) - Number(a?.id || 0)
        })
    }, [historyAdjustments, historyFilters.employee_id, historyFilters.month, historyFilters.year, isFinanceHistoryOnlyView])

    

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
            {!isFinanceHistoryOnlyView && (
                <TitleCard title="Input Tunjangan Lain" topMargin="mt-0" TopSideButtons={backButton}>
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

                    <div className="grid md:grid-cols-2 grid-cols-1 gap-4 mb-4">
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
                                placeholder="Rp"
                            />
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
                                  placeholder="Rp"
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
                            Simpan Tunjangan
                        </button>
                        <button className="btn btn-ghost" onClick={loadData} disabled={loading}>
                            Refresh
                        </button>
                    </div>
                </TitleCard>
            )}

            {isFinanceHistoryOnlyView && (
                <TitleCard
                    title="Tunjangan yang siap diproses payroll"
                    topMargin="mt-0"
                    TopSideButtons={backButton}
                >
                    <div className="mb-4 rounded-lg border border-base-300 bg-base-200/40 p-4">
                        <div className="grid lg:grid-cols-6 md:grid-cols-2 grid-cols-1 gap-4 items-end">
                            <div className="form-control lg:col-span-3">
                                <label className="label py-1">
                                    <span className="label-text text-xs font-medium uppercase tracking-wide opacity-70">Pegawai</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="search"
                                        list="hr-history-submitted-adjustment-employee-options"
                                        className="input input-bordered w-full pr-10"
                                        placeholder="Cari nama atau kode pegawai"
                                        value={historyEmployeeInput}
                                        onChange={(e) => handleHistoryEmployeeInputChange(e.target.value)}
                                    />
                                    <datalist id="hr-history-submitted-adjustment-employee-options">
                                        {employeeSelectionOptions.map((option) => (
                                            <option key={`history-submitted-${option.id}`} value={option.label} />
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
                                    <option value="">Semua Bulan</option>
                                    {Array.from({ length: 12 }, (_, idx) => (
                                        <option key={`history-submitted-period-month-${idx + 1}`} value={idx + 1}>
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
                                    <option value="">Semua Tahun</option>
                                        {Array.from({ length: 5 }, (_, idx) => {
                                        const year = new Date().getFullYear() - idx
                                        return <option key={`history-submitted-period-year-${year}`} value={year}>{year}</option>
                                    })}
                                </select>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-10">Memuat data tunjangan lain...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table table-zebra">
                                <thead>
                                    <tr>
                                        <th>Pegawai</th>
                                        <th>Periode</th>
                                        <th>Bonus</th>
                                        <th>Potongan Lain</th>
                                        <th>Status</th>
                                        <th>Catatan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    { /* finance payroll view should show submitted items */ }
                                    {historyAdjustments.filter(isSubmittedAllowance).map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div className="font-semibold">{item.employee_name}</div>
                                                <div className="text-xs opacity-70">{item.employee_code}</div>
                                            </td>
                                            <td>{item.period_month}/{item.period_year}</td>
                                            <td>Rp {(Number(item.bonus) || 0).toLocaleString('id-ID')}</td>
                                            <td>Rp {(Number(item.other_deduction) || 0).toLocaleString('id-ID')}</td>
                                            <td>
                                                <span className={`badge badge-lg ${getStatusBadgeColor(item.status)}`}>
                                                    {statusLabelMap[item.status] || item.status || '-'}
                                                </span>
                                            </td>
                                            <td className="max-w-xs whitespace-pre-wrap">{item.notes || '-'}</td>
                                        </tr>
                                    ))}
                                    {!historyAdjustments.filter(isSubmittedAllowance).length && (
                                        <tr>
                                            <td colSpan={8} className="text-center opacity-70">Belum ada data yang di input untuk periode ini</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TitleCard>
            )}

            <div ref={historyCardRef}>
                <TitleCard
                    title="Riwayat Tunjangan Lain"
                    topMargin="mt-6"
                
                >
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
                                <option value="">Semua Bulan</option>
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
                                <option value="">Semua Tahun</option>
                                {Array.from({ length: 5 }, (_, idx) => {
                                    const year = new Date().getFullYear() - idx
                                    return <option key={`history-period-year-${year}`} value={year}>{year}</option>
                                })}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data tunjangan lain...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Pegawai</th>
                                    <th>Periode</th>
                                    <th>Bonus</th>
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
                                        <td>Rp {(Number(item.other_deduction) || 0).toLocaleString('id-ID')}</td>
                                        <td>
                                            <span className={`badge badge-lg ${getStatusBadgeColor(item.status)}`}>
                                                {statusLabelMap[item.status] || item.status || '-'}
                                            </span>
                                        </td>
                                        <td className="max-w-xs whitespace-pre-wrap">{item.notes || '-'}</td>
                                    </tr>
                                ))}
                                {!filteredHistoryRows.length && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Belum ada data tunjangan lain untuk periode ini</td>
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
