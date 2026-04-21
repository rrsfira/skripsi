import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import TitleCard from '../../components/Cards/TitleCard'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import { atasanApi } from '../../features/atasan/api'

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

function AtasanPayrollAdjustments() {
    const dispatch = useDispatch()
    const initialPeriod = getCurrentPeriod()

    const [periodMonth, setPeriodMonth] = useState(initialPeriod.month)
    const [periodYear, setPeriodYear] = useState(initialPeriod.year)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    const [teamMembers, setTeamMembers] = useState([])
    const [adjustments, setAdjustments] = useState([])

    const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
    const [form, setForm] = useState({
        bonus: '',
        other_allowance: '',
        other_deduction: '',
        notes: '',
    })

    const selectedAdjustment = useMemo(() => {
        if (!selectedEmployeeId) return null
        return adjustments.find((item) => String(item.employee_id) === String(selectedEmployeeId)) || null
    }, [adjustments, selectedEmployeeId])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [dashboardResult, adjustmentResult] = await Promise.all([
                atasanApi.getDashboard({ month: periodMonth, year: periodYear }),
                atasanApi.getPayrollManagerAdjustments({ month: periodMonth, year: periodYear }),
            ])

            setTeamMembers(dashboardResult?.team_members || [])
            setAdjustments(adjustmentResult?.data || [])
        } catch (error) {
            dispatch(showNotification({ message: error.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch, periodMonth, periodYear])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Adjustment Payroll Tim' }))
    }, [dispatch])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!selectedAdjustment) {
            setForm({
                bonus: '',
                other_allowance: '',
                other_deduction: '',
                notes: '',
            })
            return
        }

        setForm({
            bonus: String(Number(selectedAdjustment.bonus || 0)),
            other_allowance: String(Number(selectedAdjustment.other_allowance || 0)),
            other_deduction: String(Number(selectedAdjustment.other_deduction || 0)),
            notes: selectedAdjustment.notes || '',
        })
    }, [selectedAdjustment])

    const handleSaveAdjustment = async () => {
        if (!selectedEmployeeId) {
            dispatch(showNotification({ message: 'Pilih pegawai tim terlebih dahulu', status: 0 }))
            return
        }

        try {
            setSaving(true)
            await atasanApi.upsertPayrollManagerAdjustment({
                employee_id: Number(selectedEmployeeId),
                period_month: Number(periodMonth),
                period_year: Number(periodYear),
                bonus: Number(form.bonus || 0),
                other_allowance: Number(form.other_allowance || 0),
                other_deduction: Number(form.other_deduction || 0),
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

    return (
        <>
            <TitleCard title="Input Adjustment Payroll Tim" topMargin="mt-0">
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
                        <option value="">Pilih anggota tim</option>
                        {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                                {member.employee_name} {member.employee_code ? `(${member.employee_code})` : ''}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid md:grid-cols-3 grid-cols-1 gap-4 mb-4">
                    <label className="form-control">
                        <span className="label-text">Bonus</span>
                        <input
                            type="number"
                            min="0"
                            className="input input-bordered"
                            value={form.bonus}
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
                            onChange={(e) => setForm((prev) => ({ ...prev, other_allowance: e.target.value }))}
                        />
                    </label>
                    <label className="form-control">
                        <span className="label-text">Potongan Lainnya</span>
                        <input
                            type="number"
                            min="0"
                            className="input input-bordered"
                            value={form.other_deduction}
                            onChange={(e) => setForm((prev) => ({ ...prev, other_deduction: e.target.value }))}
                        />
                    </label>
                </div>

                <label className="form-control mb-4">
                    <span className="label-text">Catatan Atasan</span>
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

            <TitleCard title="Riwayat Adjustment Payroll Tim" topMargin="mt-6">
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
                                {adjustments.map((item) => (
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
                                {adjustments.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="text-center opacity-70">Belum ada adjustment payroll untuk periode ini</td>
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

export default AtasanPayrollAdjustments
