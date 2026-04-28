import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { financeApi } from '../../features/finance/api'

const monthOptions = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
]

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const getEffectiveStatus = (item) => {
    return String(item?.payment_status || item?.status || '').toLowerCase()
}

const getSlipDateParts = (item) => {
    const pad = (value) => String(value).padStart(2, '0')
    const dateCandidates = [
        item?.created_at,
        item?.createdAt,
        item?.slip_created_at,
        item?.slipCreatedAt,
        item?.generated_at,
        item?.generatedAt,
    ]

    for (const candidate of dateCandidates) {
        if (!candidate) continue
        const date = new Date(candidate)
        if (!Number.isNaN(date.getTime())) {
            return {
                day: pad(date.getDate()),
                month: pad(date.getMonth() + 1),
                year: String(date.getFullYear()),
            }
        }
    }

    const periodMonth = Number(item?.period_month)
    const periodYear = Number(item?.period_year)
    if (Number.isFinite(periodMonth) && periodMonth >= 1 && periodMonth <= 12 && Number.isFinite(periodYear)) {
        return {
            day: '01',
            month: pad(periodMonth),
            year: String(periodYear),
        }
    }

    const now = new Date()
    return {
        day: pad(now.getDate()),
        month: pad(now.getMonth() + 1),
        year: String(now.getFullYear()),
    }
}

const toSafeFileNamePart = (value) => {
    const normalized = String(value || '')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

    return normalized || 'pegawai'
}

function FinancePayrollTransfers() {
    const dispatch = useDispatch()
    const [searchParams, setSearchParams] = useSearchParams()
    const initialMonth = searchParams.get('month') || ''
    const initialYear = searchParams.get('year') || ''
    const initialStatus = searchParams.get('status') === 'all'
        ? ''
        : (searchParams.get('status') || '')
    const initialEmployee = searchParams.get('employee') || ''
    const initialSort = searchParams.get('sort') || ''

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [rows, setRows] = useState([])
    const [employeeReferences, setEmployeeReferences] = useState([])
    const [actionLoadingId, setActionLoadingId] = useState(null)
    const [employeeFilter, setEmployeeFilter] = useState(initialEmployee)
    const [periodMonth, setPeriodMonth] = useState(initialMonth)
    const [periodYear, setPeriodYear] = useState(initialYear)
    const [search] = useState('')
    const [statusFilter, setStatusFilter] = useState(initialStatus)
    const [sortMode] = useState(initialSort)

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Riwayat Slip Gaji' }))
    }, [dispatch])

    useEffect(() => {
        const loadEmployeeReferences = async () => {
            try {
                const refs = await financeApi.getEmployeeReferences()
                setEmployeeReferences(refs || [])
            } catch (err) {
                setEmployeeReferences([])
            }
        }

        loadEmployeeReferences()
    }, [])

    useEffect(() => {
        const nextParams = new URLSearchParams()

        if (employeeFilter) nextParams.set('employee', employeeFilter)
        if (periodMonth) nextParams.set('month', periodMonth)
        if (periodYear) nextParams.set('year', periodYear)
        if (statusFilter) {
            nextParams.set('status', statusFilter)
        } else {
            nextParams.set('status', 'all')
        }
        if (sortMode) nextParams.set('sort', sortMode)

        setSearchParams(nextParams, { replace: true })
    }, [employeeFilter, periodMonth, periodYear, statusFilter, sortMode, setSearchParams])

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true)
                setError('')
                const result = await financeApi.getPayrollList({})
                setRows(result || [])
            } catch (err) {
                setRows([])
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [])

    const employeeOptions = useMemo(() => {
        const options = (employeeReferences || []).map((item) => ({
            value: String(item.employee_id),
            label: `${item.employee_code || '-'} - ${item.employee_name || '-'}`,
            code: String(item.employee_code || ''),
        }))

        return options.sort((a, b) =>
            a.code.localeCompare(b.code, 'id', {
                numeric: true,
                sensitivity: 'base',
            }),
        )
    }, [employeeReferences])

    const currentYear = new Date().getFullYear()
    const yearOptions = useMemo(() => {
        return Array.from({ length: 6 }, (_, index) => String(currentYear + index))
    }, [currentYear])

    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLowerCase()

        const nextRows = rows.filter((item) => {
            const effectiveStatus = getEffectiveStatus(item)
            const rowEmployeeId = String(item.employee_id || '')
            const rowMonth = String(item.period_month || '')
            const rowYear = String(item.period_year || '')
            const matchStatus = !statusFilter || effectiveStatus === String(statusFilter).toLowerCase()
            const matchEmployee =
                !employeeFilter ||
                rowEmployeeId === String(employeeFilter)
            const matchMonth = !periodMonth || rowMonth === String(periodMonth)
            const matchYear = !periodYear || rowYear === String(periodYear)
            const matchKeyword =
                !keyword ||
                [item.employee_name, item.employee_code, item.id]
                    .map((value) => String(value || '').toLowerCase())
                    .some((value) => value.includes(keyword))

            return matchStatus && matchEmployee && matchMonth && matchYear && matchKeyword
        })

        if (sortMode === 'top-pay') {
            nextRows.sort((left, right) => {
                const totalLeft = Number(left?.final_amount || left?.net_salary || 0)
                const totalRight = Number(right?.final_amount || right?.net_salary || 0)

                if (totalRight !== totalLeft) {
                    return totalRight - totalLeft
                }

                return String(left?.employee_name || '').localeCompare(String(right?.employee_name || ''))
            })
        }

        return nextRows
    }, [rows, search, employeeFilter, periodMonth, periodYear, statusFilter, sortMode])

    const handleTransferPayroll = async (payrollId) => {
        try {
            setActionLoadingId(payrollId)
            setError('')
            await financeApi.transferPayroll(payrollId)

            const refreshed = await financeApi.getPayrollList({})
            setRows(refreshed || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoadingId(null)
        }
    }

    const openPayrollPdf = async (payrollItem) => {
        const payrollId = payrollItem?.id
        const previewWindow = window.open('about:blank', '_blank')

        try {
            setError('')
            const blob = await financeApi.getPayrollPdfBlob(payrollId)
            const url = window.URL.createObjectURL(blob)
            const { day, month, year } = getSlipDateParts(payrollItem)
            const employeeName = toSafeFileNamePart(payrollItem?.employee_name)

            // Trigger direct download while keeping PDF preview behavior.
            const downloadLink = document.createElement('a')
            downloadLink.href = url
            downloadLink.download = `slip-gaji-${employeeName}-${payrollId}-${day}-${month}-${year}.pdf`
            document.body.appendChild(downloadLink)
            downloadLink.click()
            document.body.removeChild(downloadLink)

            if (previewWindow) {
                previewWindow.location.href = url
            } else {
                window.open(url, '_blank')
            }

            setTimeout(() => window.URL.revokeObjectURL(url), 60000)
        } catch (err) {
            if (previewWindow && !previewWindow.closed) {
                previewWindow.close()
            }
            setError(err.message)
        }
    }

    return (
        <>
            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            <div className="alert alert-info mb-4">
                <span>
                    Setelah transfer gaji berhasil, ubah status dengan klik tombol Kirim Gaji pada slip berstatus claimed.
                </span>
            </div>

            <TitleCard title="Riwayat Slip Gaji" topMargin="mt-0">
                <div className="grid md:grid-cols-4 grid-cols-1 gap-3 mb-4">
                    <select
                        className="select select-bordered w-full"
                        value={employeeFilter}
                        onChange={(event) => setEmployeeFilter(event.target.value)}
                    >
                        <option value="">Semua Pegawai</option>
                        {employeeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <select
                        className="select select-bordered w-full"
                        value={periodMonth}
                        onChange={(event) => setPeriodMonth(event.target.value)}
                    >
                        <option value="">Semua Bulan</option>
                        {monthOptions.map((month) => (
                            <option key={month.value} value={month.value}>
                                {month.label}
                            </option>
                        ))}
                    </select>

                    <select
                        className="select select-bordered w-full"
                        value={periodYear}
                        onChange={(event) => setPeriodYear(event.target.value)}
                    >
                        <option value="">Semua Tahun</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>
                                {year}
                            </option>
                        ))}
                    </select>

                    <select
                        className="select select-bordered w-full"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                    >
                        <option value="">Semua Status</option>
                        <option value="claimed">Claimed</option>
                        <option value="transferred">Transferred</option>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm">
                        <thead>
                            <tr>
                                <th>Payroll ID</th>
                                <th>Pegawai</th>
                                <th>Kode</th>
                                <th>Periode</th>
                                <th>Total Gaji</th>
                                <th>Status</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.employee_name || '-'}</td>
                                    <td>{item.employee_code || '-'}</td>
                                    <td>{item.period_month}/{item.period_year}</td>
                                    <td>{formatCurrency(item.final_amount || item.net_salary)}</td>
                                    <td>{getEffectiveStatus(item) || '-'}</td>
                                    <td>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-outline whitespace-nowrap"
                                                onClick={() => openPayrollPdf(item)}
                                            >
                                                Unduh slip gaji
                                            </button>
                                            <button
                                                type="button"
                                                className={`btn btn-xs btn-primary whitespace-nowrap ${actionLoadingId === item.id ? 'loading' : ''}`}
                                                onClick={() => handleTransferPayroll(item.id)}
                                                disabled={getEffectiveStatus(item) !== 'claimed' || actionLoadingId === item.id}
                                            >
                                                Kirim Gaji
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {!filteredRows.length && !loading && (
                                <tr>
                                    <td colSpan={7} className="text-center opacity-70">
                                        Tidak ada slip gaji pada filter ini
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td colSpan={7} className="text-center opacity-70">
                                        Memuat data slip gaji...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </TitleCard>
        </>
    )
}

export default FinancePayrollTransfers