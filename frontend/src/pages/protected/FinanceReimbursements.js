import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { financeApi } from '../../features/finance/api'

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`
const isIncludedInPayroll = (item) => item.status === 'included_in_payroll' && Number(item.payroll_id || 0) > 0
const isReadyForPayroll = (item) => item.status === 'approved' || (item.status === 'included_in_payroll' && !isIncludedInPayroll(item))

const getFinanceStatusLabel = (item) => {
    if (isIncludedInPayroll(item)) return 'Included in Payroll'
    if (isReadyForPayroll(item)) return 'Siap Masuk Payroll'
    return item.status || '-'
}

function FinanceReimbursements() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [employeeFilter, setEmployeeFilter] = useState('')
    const [items, setItems] = useState([])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const result = await financeApi.getReimbursements()
            setItems(result)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Reimbursement Finance' }))
        loadData()
    }, [dispatch, loadData])

    if (loading) {
        return <div className="text-center py-10">Memuat data reimbursement...</div>
    }

    const typeOptions = Array.from(new Set(items.map((item) => item.reimbursement_type).filter(Boolean)))
    const employeeOptions = Array.from(
        new Set(items.map((item) => `${item.employee_code || '-'}|${item.employee_name || '-'}`))
    )

    const filteredItems = items.filter((item) => {
        const statusMatch = statusFilter === 'ready_for_payroll'
            ? isReadyForPayroll(item)
            : statusFilter === 'included_in_payroll'
                ? isIncludedInPayroll(item)
                : statusFilter
                    ? item.status === statusFilter
                    : true

        const typeMatch = typeFilter ? item.reimbursement_type === typeFilter : true
        const employeeKey = `${item.employee_code || '-'}|${item.employee_name || '-'}`
        const employeeMatch = employeeFilter ? employeeKey === employeeFilter : true

        return statusMatch && typeMatch && employeeMatch
    })

    const readyCount = items.filter((item) => isReadyForPayroll(item)).length
    const includedCount = items.filter((item) => isIncludedInPayroll(item)).length
    const totalCount = readyCount + includedCount

    return (
        <TitleCard title="Data Reimbursement" topMargin="mt-0">
            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-4">
                <div className="stat bg-base-200 rounded-lg">
                    <div className="stat-title">Siap Masuk Payroll</div>
                    <div className="stat-value text-2xl">{readyCount}</div>
                </div>
                <div className="stat bg-success text-success-content rounded-lg">
                    <div className="stat-title text-success-content">Included in Payroll</div>
                    <div className="stat-value text-2xl">{includedCount}</div>
                </div>
                <div className="stat bg-info text-info-content rounded-lg">
                    <div className="stat-title text-info-content">Total Data Reimbursement</div>
                    <div className="stat-value text-2xl">{totalCount}</div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-3 mb-4">
                <select
                    className="select select-bordered select-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">Semua Status</option>
                    <option value="ready_for_payroll">Siap Masuk Payroll</option>
                    <option value="included_in_payroll">Included in Payroll</option>
                </select>

                <select
                    className="select select-bordered select-sm"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    <option value="">Semua Jenis</option>
                    {typeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>

                <select
                    className="select select-bordered select-sm"
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                >
                    <option value="">Semua Pegawai</option>
                    {employeeOptions.map((employee) => {
                        const [code, name] = employee.split('|')
                        return (
                            <option key={employee} value={employee}>{code} - {name}</option>
                        )
                    })}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                    <thead>
                        <tr>
                            <th>Pegawai</th>
                            <th>Kode</th>
                            <th>Jenis</th>
                            <th>Nominal</th>
                            <th>Status</th>
                            <th>Tanggal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredItems.map((item) => (
                            <tr key={item.id}>
                                <td>{item.employee_name}</td>
                                <td>{item.employee_code}</td>
                                <td>{item.reimbursement_type}</td>
                                <td className="font-semibold">{formatCurrency(item.amount)}</td>
                                <td>{getFinanceStatusLabel(item)}</td>
                                <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                            </tr>
                        ))}
                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center opacity-70">Belum ada data reimbursement</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </TitleCard>
    )
}

export default FinanceReimbursements
