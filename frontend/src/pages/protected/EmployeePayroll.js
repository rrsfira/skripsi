import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { pegawaiApi } from '../../features/pegawai/api'

const getPayrollStatusLabel = (status) => {
    const normalizedStatus = String(status || '').toLowerCase()

    if (normalizedStatus === 'transferred') {
        return 'telah dikirim ke rekening'
    }

    return normalizedStatus || '-'
}

const getPayrollStatusValue = (item) => String(item?.payment_status || item?.status || '').toLowerCase()

function EmployeePayroll() {
    const dispatch = useDispatch()
    const [employeeId, setEmployeeId] = useState(null)
    const [payrolls, setPayrolls] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [actionLoadingId, setActionLoadingId] = useState(null)

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')
            const profile = await pegawaiApi.getProfile()
            const currentEmployeeId = profile?.employee?.id
            if (!currentEmployeeId) {
                throw new Error('Data pegawai tidak ditemukan')
            }

            setEmployeeId(currentEmployeeId)
            const result = await pegawaiApi.getPayrollByEmployee(currentEmployeeId)
            setPayrolls(result?.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Slip Gaji Pegawai' }))
        loadData()
    }, [])

    const claimPayroll = async (payrollId) => {
        try {
            setActionLoadingId(payrollId)
            setError('')
            await pegawaiApi.claimPayroll(payrollId)
            if (employeeId) {
                const result = await pegawaiApi.getPayrollByEmployee(employeeId)
                setPayrolls(result?.data || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setActionLoadingId(null)
        }
    }

    const openPayrollPdf = async (payrollId) => {
        const previewWindow = window.open('about:blank', '_blank')

        try {
            setError('')
            const blob = await pegawaiApi.getPayrollPdfBlob(payrollId)
            const url = window.URL.createObjectURL(blob)
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
            {error ? (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            ) : null}

            <TitleCard title="Daftar Slip Gaji" topMargin="mt-0">
                {loading ? (
                    <div>Memuat slip gaji...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Periode</th>
                                    <th>Total Gaji</th>
                                    <th>Final Amount</th>
                                    <th>Status</th>
                                    <th>Status Banding</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payrolls.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.period_month}/{item.period_year}</td>
                                        <td>
                                            {item.is_revised_appeal && ['published', 'claimed', 'transferred'].includes(getPayrollStatusValue(item)) ? (
                                                <div className="space-y-1">
                                                    <p>Rp {Number(item.comparison_old_amount ?? item.take_home_pay ?? 0).toLocaleString('id-ID')}</p>
                                                    <p className="text-xs opacity-70">
                                                        Hasil banding: {Number((Number(item.comparison_new_amount ?? item.final_amount ?? item.net_salary ?? 0) - Number(item.comparison_old_amount ?? item.take_home_pay ?? 0)).toFixed(2)) >= 0 ? '+' : '-'}Rp {Math.abs(Number((Number(item.comparison_new_amount ?? item.final_amount ?? item.net_salary ?? 0) - Number(item.comparison_old_amount ?? item.take_home_pay ?? 0)).toFixed(2))).toLocaleString('id-ID')}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span>Rp {Number(item.take_home_pay ?? item.final_amount ?? item.net_salary ?? 0).toLocaleString('id-ID')}</span>
                                            )}
                                        </td>
                                        <td>{item.final_amount !== null && item.final_amount !== undefined
                                            ? `Rp ${Number(item.final_amount).toLocaleString('id-ID')}`
                                            : '-'}</td>
                                        <td><span className="badge">{getPayrollStatusLabel(item.payment_status || item.status)}</span></td>
                                        <td><span className="badge badge-outline">{item.appeal_status || '-'}</span></td>
                                        <td>
                                            <button
                                                className="btn btn-xs btn-outline"
                                                onClick={() => openPayrollPdf(item.id)}
                                            >
                                                PDF
                                            </button>
                                            <button
                                                className={`btn btn-xs btn-primary ${actionLoadingId === item.id ? 'loading' : ''}`}
                                                disabled={item.status !== 'published' || actionLoadingId === item.id || item.appeal_status === 'pending'}
                                                onClick={() => claimPayroll(item.id)}
                                            >
                                                Klaim
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {payrolls.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Belum ada slip gaji</td>
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

export default EmployeePayroll
