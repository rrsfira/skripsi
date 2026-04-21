import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { pegawaiApi } from '../../features/pegawai/api'

const INITIAL_FORM = {
    payroll_id: '',
    appeal_items: [
        {
            appeal_reason_item: '',
            reason: '',
        },
    ],
    supporting_documents: null,
}

const INCOME_REASON_OPTIONS = [
    { key: 'basic_salary', label: 'Gaji Pokok', payrollField: 'basic_salary' },
    { key: 'allowance', label: 'Total Tunjangan', payrollField: 'allowance' },
    { key: 'transport_allowance', label: 'Tunjangan Transport', payrollField: 'transport_allowance' },
    { key: 'meal_allowance', label: 'Tunjangan Makan', payrollField: 'meal_allowance' },
    { key: 'health_allowance', label: 'Tunjangan Kesehatan', payrollField: 'health_allowance' },
    { key: 'bonus', label: 'Bonus', payrollField: 'bonus' },
    { key: 'other_allowance', label: 'Tunjangan Lainnya', payrollField: 'other_allowance' },
    { key: 'reimbursement_total', label: 'Reimbursement', payrollField: 'reimbursement_total' },
    { key: 'gross_salary', label: 'Gaji Kotor', payrollField: 'gross_salary' },
    { key: 'total_income', label: 'Total Pendapatan', payrollField: 'total_income' },
]

const DEDUCTION_REASON_OPTIONS = [
    { key: 'late_deduction', label: 'Potongan Keterlambatan', payrollField: 'late_deduction' },
    { key: 'absent_deduction', label: 'Potongan Alpha', payrollField: 'absent_deduction' },
    { key: 'bpjs_deduction', label: 'Potongan BPJS', payrollField: 'bpjs_deduction' },
    { key: 'tax_deduction', label: 'Potongan Pajak', payrollField: 'tax_deduction' },
    { key: 'other_deduction', label: 'Potongan Lainnya', payrollField: 'other_deduction' },
    { key: 'deduction', label: 'Total Potongan', payrollField: 'deduction' },
]

const formatCurrency = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`

const getAppealStatusLabel = (status) => {
    const normalizedStatus = String(status || '').toLowerCase()

    if (normalizedStatus === 'approved') {
        return 'diproses'
    }

    return normalizedStatus || '-'
}

const getAppealItems = (appeal) => {
    if (Array.isArray(appeal?.appeal_reason_items) && appeal.appeal_reason_items.length > 0) {
        return appeal.appeal_reason_items
    }

    if (appeal?.appeal_reason_item || appeal?.reason) {
        return [
            {
                appeal_reason_item: appeal.appeal_reason_item || '',
                appeal_reason_label: appeal.appeal_reason_label || '-',
                reason: appeal.reason || '',
            },
        ]
    }

    return []
}

function EmployeeSalaryAppeal() {
    const dispatch = useDispatch()
    const [employeeId, setEmployeeId] = useState(null)
    const [payrolls, setPayrolls] = useState([])
    const [appeals, setAppeals] = useState([])
    const [form, setForm] = useState(INITIAL_FORM)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [selectedAppeal, setSelectedAppeal] = useState(null)
    const [showViewModal, setShowViewModal] = useState(false)
    const [editingAppealId, setEditingAppealId] = useState(null)
    const formCardRef = useRef(null)

    const publishedPayrolls = useMemo(() => {
        return payrolls.filter((item) => item.status === 'published' || item.status === 'claimed')
    }, [payrolls])

    const selectedPayroll = useMemo(() => {
        if (!form.payroll_id) return null
        return publishedPayrolls.find((item) => String(item.id) === String(form.payroll_id)) || null
    }, [publishedPayrolls, form.payroll_id])

    const eligiblePayrolls = useMemo(() => {
        const appealedPayrollIds = new Set(
            appeals
                .map((item) => String(item.payroll_id || ''))
                .filter(Boolean),
        )

        return publishedPayrolls.filter(
            (item) => !appealedPayrollIds.has(String(item.id)),
        )
    }, [publishedPayrolls, appeals])

    const availableReasonOptions = useMemo(() => {
        if (!selectedPayroll) {
            return { income: [], deduction: [] }
        }

        const income = INCOME_REASON_OPTIONS.map((option) => ({
            ...option,
            value: Number(selectedPayroll[option.payrollField] || 0),
        }))

        const deduction = DEDUCTION_REASON_OPTIONS.map((option) => ({
            ...option,
            value: Number(selectedPayroll[option.payrollField] || 0),
        }))

        return { income, deduction }
    }, [selectedPayroll])

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

            const [payrollResult, appealResult] = await Promise.all([
                pegawaiApi.getPayrollByEmployee(currentEmployeeId),
                pegawaiApi.getMySalaryAppeals(),
            ])

            setPayrolls(payrollResult?.data || [])
            setAppeals(appealResult?.data || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Banding Gaji Pegawai' }))
        loadData()
    }, [dispatch])

    useEffect(() => {
        const allKeys = [
            ...availableReasonOptions.income,
            ...availableReasonOptions.deduction,
        ].map((item) => item.key)

        setForm((prev) => ({
            ...prev,
            appeal_items: (prev.appeal_items || []).map((item) => {
                if (!item.appeal_reason_item) return item
                if (allKeys.includes(item.appeal_reason_item)) return item
                return {
                    ...item,
                    appeal_reason_item: '',
                }
            }),
        }))
    }, [availableReasonOptions])

    useEffect(() => {
        if (editingAppealId) {
            return
        }

        setForm((prev) => {
            const currentPayrollId = String(prev.payroll_id || '')
            const stillEligible = eligiblePayrolls.some(
                (item) => String(item.id) === currentPayrollId,
            )

            if (stillEligible) {
                return prev
            }

            return {
                ...prev,
                payroll_id: eligiblePayrolls.length > 0
                    ? String(eligiblePayrolls[0].id)
                    : '',
            }
        })
    }, [editingAppealId, eligiblePayrolls])

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const updateAppealItem = (index, field, value) => {
        setForm((prev) => ({
            ...prev,
            appeal_items: prev.appeal_items.map((item, itemIndex) => (
                itemIndex === index ? { ...item, [field]: value } : item
            )),
        }))
    }

    const openViewModal = (appeal) => {
        setSelectedAppeal(appeal)
        setShowViewModal(true)
    }

    const startEditFromForm = (appeal) => {
        const parsedAppealItems = getAppealItems(appeal)
        setEditingAppealId(appeal.id)
        setForm({
            payroll_id: String(appeal.payroll_id || ''),
            appeal_items: parsedAppealItems.length
                ? parsedAppealItems.map((item) => ({
                    appeal_reason_item: item.appeal_reason_item || '',
                    reason: item.reason || '',
                }))
                : [
                    {
                        appeal_reason_item: '',
                        reason: '',
                    },
                ],
            supporting_documents: null,
        })
        setError('')

        if (formCardRef.current) {
            formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    const cancelEdit = () => {
        setEditingAppealId(null)
        setForm(INITIAL_FORM)
        setError('')
    }

    const deleteAppeal = async (appeal) => {
        const confirmed = window.confirm(
            `Yakin ingin menghapus riwayat banding gaji ini?\n\nPeriode: ${appeal.period_month}/${appeal.period_year}\nStatus: ${getAppealStatusLabel(appeal.status)}\n\nTindakan ini tidak bisa dibatalkan.`
        )
        if (!confirmed) return

        try {
            setSubmitting(true)
            setError('')
            await pegawaiApi.deleteSalaryAppeal(appeal.id)
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const openPayrollPdf = async (payrollId) => {
        if (!payrollId) return

        const previewWindow = window.open('about:blank', '_blank')

        try {
            const blob = await pegawaiApi.getPayrollPdfBlob(payrollId)
            const url = window.URL.createObjectURL(blob)
            if (previewWindow) {
                previewWindow.location.href = url
            } else {
                window.open(url, '_blank')
            }
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
        } catch (err) {
            if (previewWindow && !previewWindow.closed) {
                previewWindow.close()
            }
            setError(err.message)
        }
    }

    const addAppealItem = () => {
        setForm((prev) => ({
            ...prev,
            appeal_items: [
                ...prev.appeal_items,
                {
                    appeal_reason_item: '',
                    reason: '',
                },
            ],
        }))
    }

    const removeAppealItem = (index) => {
        setForm((prev) => {
            const filtered = prev.appeal_items.filter((_, itemIndex) => itemIndex !== index)
            return {
                ...prev,
                appeal_items: filtered.length
                    ? filtered
                    : [
                        {
                            appeal_reason_item: '',
                            reason: '',
                        },
                    ],
            }
        })
    }

    const submitForm = async (event) => {
        event.preventDefault()
        const normalizedAppealItems = (form.appeal_items || []).filter(
            (item) => item.appeal_reason_item || item.reason,
        )

        if (!form.payroll_id || normalizedAppealItems.length === 0) {
            setError('Periode slip gaji dan minimal 1 alasan komponen wajib diisi')
            return
        }

        if (!editingAppealId && !eligiblePayrolls.length) {
            setError('Banding hanya bisa diajukan 1 kali per slip gaji.')
            return
        }

        const hasEmptyRow = normalizedAppealItems.some(
            (item) => !item.appeal_reason_item || !String(item.reason || '').trim(),
        )

        if (hasEmptyRow) {
            setError('Setiap komponen banding wajib memiliki pilihan komponen dan alasan teks')
            return
        }

        const selectedKeys = normalizedAppealItems.map((item) => item.appeal_reason_item)
        const hasDuplicateKey = new Set(selectedKeys).size !== selectedKeys.length
        if (hasDuplicateKey) {
            setError('Komponen banding tidak boleh dipilih lebih dari satu kali dalam satu pengajuan')
            return
        }

        try {
            setSubmitting(true)
            setError('')

            if (editingAppealId) {
                await pegawaiApi.updateSalaryAppeal(editingAppealId, {
                    appeal_items: normalizedAppealItems.map((appealItem) => ({
                        appeal_reason_item: appealItem.appeal_reason_item,
                        reason: String(appealItem.reason || '').trim(),
                    })),
                    supporting_documents: form.supporting_documents,
                })
            } else {
                await pegawaiApi.submitSalaryAppeal({
                    payroll_id: form.payroll_id,
                    appeal_items: normalizedAppealItems.map((appealItem) => ({
                        appeal_reason_item: appealItem.appeal_reason_item,
                        reason: String(appealItem.reason || '').trim(),
                    })),
                    supporting_documents: form.supporting_documents,
                })
            }

            setEditingAppealId(null)
            setForm(INITIAL_FORM)
            if (employeeId) {
                const [payrollResult, appealResult] = await Promise.all([
                    pegawaiApi.getPayrollByEmployee(employeeId),
                    pegawaiApi.getMySalaryAppeals(),
                ])
                setPayrolls(payrollResult?.data || [])
                setAppeals(appealResult?.data || [])
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            {error ? (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            ) : null}

            <div ref={formCardRef}>
            <TitleCard title={editingAppealId ? 'Edit Banding Gaji' : 'Ajukan Banding Gaji'} topMargin="mt-0">
                <form className="grid md:grid-cols-2 grid-cols-1 gap-4" onSubmit={submitForm}>
                    {editingAppealId ? (
                        <div className="alert alert-info md:col-span-2">
                            <span>Mode edit aktif. Ubah data di form ini lalu klik Simpan Edit.</span>
                        </div>
                    ) : null}

                    {!editingAppealId ? (
                        <div className="md:col-span-2 alert alert-info">
                            <span>
                                Banding gaji hanya bisa diajukan 1 kali per slip gaji.
                                {selectedPayroll
                                    ? ` Slip dipilih otomatis: ${selectedPayroll.period_month}/${selectedPayroll.period_year} - ${formatCurrency(selectedPayroll.final_amount || selectedPayroll.net_salary || 0)}`
                                    : ' Saat ini tidak ada slip gaji yang tersedia untuk diajukan banding.'}
                            </span>
                        </div>
                    ) : null}
                    <div className="md:col-span-2 space-y-3">
                        <p className="font-semibold">Alasan Banding (Komponen Slip, tanpa Total Gaji)</p>
                        {(form.appeal_items || []).map((appealItem, index) => (
                            <div key={`appeal-item-${index}`} className="grid md:grid-cols-2 grid-cols-1 gap-3 rounded-lg border border-base-300 p-3">
                                <select
                                    className="select select-bordered"
                                    value={appealItem.appeal_reason_item}
                                    onChange={(e) => updateAppealItem(index, 'appeal_reason_item', e.target.value)}
                                    disabled={!form.payroll_id}
                                >
                                    <option value="">Pilih Komponen Slip</option>
                                    {availableReasonOptions.income.length > 0 ? (
                                        <optgroup label="Rincian Pendapatan">
                                            {availableReasonOptions.income.map((option) => (
                                                <option key={option.key} value={option.key}>
                                                    {option.label} - {formatCurrency(option.value)}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ) : null}
                                    {availableReasonOptions.deduction.length > 0 ? (
                                        <optgroup label="Rincian Potongan">
                                            {availableReasonOptions.deduction.map((option) => (
                                                <option key={option.key} value={option.key}>
                                                    {option.label} - {formatCurrency(option.value)}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ) : null}
                                </select>
                                <textarea
                                    className="textarea textarea-bordered"
                                    placeholder="Alasan banding (teks penjelasan)"
                                    value={appealItem.reason}
                                    onChange={(e) => updateAppealItem(index, 'reason', e.target.value)}
                                />
                                <div className="md:col-span-2 flex justify-end">
                                    {!editingAppealId ? (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => removeAppealItem(index)}
                                            disabled={submitting}
                                        >
                                            Hapus Baris
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {!editingAppealId ? (
                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={addAppealItem}
                                disabled={!form.payroll_id || submitting}
                            >
                                Tambah Alasan Komponen
                            </button>
                        ) : null}
                    </div>
                    <input className="file-input file-input-bordered md:col-span-2" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => updateForm('supporting_documents', e.target.files?.[0] || null)} />
                    <div className="md:col-span-2 flex gap-2">
                        <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} type="submit" disabled={submitting}>
                            {editingAppealId ? 'Simpan Edit' : 'Kirim Banding'}
                        </button>
                        {editingAppealId ? (
                            <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={submitting}>
                                Batal Edit
                            </button>
                        ) : null}
                    </div>
                </form>
            </TitleCard>
            </div>

            <TitleCard title="Riwayat Banding Gaji" topMargin="mt-6">
                {loading ? (
                    <div>Memuat data banding gaji...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Periode</th>
                                    <th>Alasan Komponen</th>
                                    <th>Alasan Teks</th>
                                    <th>Status</th>
                                    <th>Catatan Review</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appeals.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.period_month}/{item.period_year}</td>
                                        <td>{item.appeal_reason_label || '-'}</td>
                                        <td>
                                            {getAppealItems(item).map((appealReason) => appealReason.reason).filter(Boolean).join(', ') || '-'}
                                        </td>
                                        <td><span className="badge badge-outline">{getAppealStatusLabel(item.status)}</span></td>
                                        <td>{item.review_notes || '-'}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-ghost btn-xs"
                                                    onClick={() => openViewModal(item)}
                                                >
                                                    Lihat
                                                </button>
                                                {item.status === 'pending' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline btn-xs"
                                                            onClick={() => startEditFromForm(item)}
                                                            disabled={submitting}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-error btn-xs"
                                                            onClick={() => deleteAppeal(item)}
                                                            disabled={submitting}
                                                        >
                                                            Hapus
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            {showViewModal && selectedAppeal && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-4xl">
                        <h3 className="font-bold text-lg mb-4">Detail Banding Gaji</h3>
                        <div className="space-y-4 text-sm">
                            <div className="grid md:grid-cols-2 gap-3">
                                <div className="bg-base-200 rounded-lg p-3 space-y-1">
                                    <p><span className="font-semibold">ID Banding:</span> {selectedAppeal.id || '-'}</p>
                                    <p><span className="font-semibold">ID Payroll:</span> {selectedAppeal.payroll_id || '-'}</p>
                                    <p><span className="font-semibold">Periode:</span> {selectedAppeal.period_month}/{selectedAppeal.period_year}</p>
                                    <p><span className="font-semibold">Status:</span> {getAppealStatusLabel(selectedAppeal.status)}</p>
                                    <p><span className="font-semibold">Status Payroll:</span> {selectedAppeal.payroll_status || '-'}</p>
                                    <p><span className="font-semibold">Status Appeal Payroll:</span> {selectedAppeal.appeal_status || '-'}</p>
                                </div>
                                <div className="bg-base-200 rounded-lg p-3 space-y-1">
                                    <p><span className="font-semibold">Nominal Perbaikan (HR):</span> {formatCurrency(selectedAppeal.expected_amount)}</p>
                                    <p><span className="font-semibold">Catatan Review:</span> {selectedAppeal.review_notes || '-'}</p>
                                    <p><span className="font-semibold">Dibuat:</span> {selectedAppeal.created_at ? new Date(selectedAppeal.created_at).toLocaleString('id-ID') : '-'}</p>
                                    <p><span className="font-semibold">Diupdate:</span> {selectedAppeal.updated_at ? new Date(selectedAppeal.updated_at).toLocaleString('id-ID') : '-'}</p>
                                    <p><span className="font-semibold">Direview:</span> {selectedAppeal.reviewed_at ? new Date(selectedAppeal.reviewed_at).toLocaleString('id-ID') : '-'}</p>
                                </div>
                            </div>

                            <div className="bg-base-200 rounded-lg p-3">
                                <p className="font-semibold mb-2">Detail Alasan Banding</p>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra table-sm">
                                        <thead>
                                            <tr>
                                                <th>Komponen</th>
                                                <th>Alasan</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getAppealItems(selectedAppeal).map((appealItem, index) => (
                                                <tr key={`${appealItem.appeal_reason_item || 'item'}-${index}`}>
                                                    <td>{appealItem.appeal_reason_label || appealItem.appeal_reason_item || '-'}</td>
                                                    <td>{appealItem.reason || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-base-200 rounded-lg p-3">
                                <p className="font-semibold mb-2">Rincian Slip Gaji</p>
                                <div className="grid md:grid-cols-2 gap-x-6 gap-y-1">
                                    <p><span className="font-semibold">Gaji Pokok:</span> {formatCurrency(selectedAppeal.basic_salary)}</p>
                                    <p><span className="font-semibold">Transport:</span> {formatCurrency(selectedAppeal.transport_allowance)}</p>
                                    <p><span className="font-semibold">Makan:</span> {formatCurrency(selectedAppeal.meal_allowance)}</p>
                                    <p><span className="font-semibold">Tunjangan Kesehatan:</span> {formatCurrency(selectedAppeal.health_allowance)}</p>
                                    <p><span className="font-semibold">Bonus:</span> {formatCurrency(selectedAppeal.bonus)}</p>
                                    <p><span className="font-semibold">Tunjangan Lain:</span> {formatCurrency(selectedAppeal.other_allowance)}</p>
                                    <p><span className="font-semibold">Total Tunjangan:</span> {formatCurrency(selectedAppeal.allowance)}</p>
                                    <p><span className="font-semibold">Gaji Kotor:</span> {formatCurrency(selectedAppeal.gross_salary)}</p>
                                    <p><span className="font-semibold">Reimbursement:</span> {formatCurrency(selectedAppeal.reimbursement_total)}</p>
                                    <p><span className="font-semibold">Total Income:</span> {formatCurrency(selectedAppeal.total_income)}</p>
                                    <p><span className="font-semibold">Potongan Telat:</span> {formatCurrency(selectedAppeal.late_deduction)}</p>
                                    <p><span className="font-semibold">Potongan Alpha:</span> {formatCurrency(selectedAppeal.absent_deduction)}</p>
                                    <p><span className="font-semibold">Potongan BPJS:</span> {formatCurrency(selectedAppeal.bpjs_deduction)}</p>
                                    <p><span className="font-semibold">Potongan Pajak:</span> {formatCurrency(selectedAppeal.tax_deduction)}</p>
                                    <p><span className="font-semibold">Potongan Lain:</span> {formatCurrency(selectedAppeal.other_deduction)}</p>
                                    <p><span className="font-semibold">Total Potongan:</span> {formatCurrency(selectedAppeal.deduction)}</p>
                                    <p><span className="font-semibold">Net Salary:</span> {formatCurrency(selectedAppeal.net_salary)}</p>
                                    <p><span className="font-semibold">Total Gaji Final:</span> {formatCurrency(selectedAppeal.final_amount || selectedAppeal.net_salary)}</p>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                {selectedAppeal.supporting_documents_url ? (
                                    <a
                                        href={selectedAppeal.supporting_documents_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-outline btn-sm"
                                    >
                                        Lihat Bukti
                                    </a>
                                ) : null}
                                {selectedAppeal.payroll_id ? (
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => openPayrollPdf(selectedAppeal.payroll_id)}
                                    >
                                        Lihat PDF Slip
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="modal-action">
                            <button type="button" className="btn" onClick={() => setShowViewModal(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

export default EmployeeSalaryAppeal
