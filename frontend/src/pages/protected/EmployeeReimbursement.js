import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { pegawaiApi } from '../../features/pegawai/api'

const INITIAL_FORM = {
    reimbursement_type: '',
    amount: '',
    description: '',
    attachment: null,
}

const REIMBURSEMENT_TYPE_OPTIONS = [
    { value: 'transport', label: 'Transportasi' },
    { value: 'makan', label: 'Konsumsi' },
    { value: 'kesehatan', label: 'Kesehatan' },
    { value: 'operasional', label: 'Operasional Kantor' },
    { value: 'lainnya', label: 'Lainnya' },
]

const REIMBURSEMENT_TYPE_LABELS = REIMBURSEMENT_TYPE_OPTIONS.reduce((accumulator, option) => {
    accumulator[option.value] = option.label
    return accumulator
}, {})

const getStatusLabel = (status) => {
    const labels = {
        pending: 'Menunggu Persetujuan',
        approved: 'Disetujui Atasan (Menunggu Validasi HR)',
        included_in_payroll: 'Masuk Payroll',
        rejected: 'Ditolak',
    }
    return labels[status] || status
}

const getTypeLabel = (item) => {
    const rawType = item?.reimbursement_type || item?.type || ''
    if (!rawType) return '-'
    return REIMBURSEMENT_TYPE_LABELS[rawType] || rawType
}

function EmployeeReimbursement() {
    const dispatch = useDispatch()
    const [form, setForm] = useState(INITIAL_FORM)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [items, setItems] = useState([])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const result = await pegawaiApi.getMyReimbursements()
            setItems(result?.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [dispatch])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Reimbursement Pegawai' }))
        loadData()
    }, [dispatch, loadData])

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }))
    }

    const submitForm = async (event) => {
        event.preventDefault()

        const dbType = (form.reimbursement_type || '').trim()

        if (!dbType) {
            dispatch(showNotification({ message: 'Jenis reimbursement wajib diisi', status: 0 }))
            return
        }

        if (!form.amount || Number(form.amount) <= 0) {
            dispatch(showNotification({ message: 'Nominal wajib diisi dan harus lebih dari 0', status: 0 }))
            return
        }

        if (!(form.description || '').trim()) {
            dispatch(showNotification({ message: 'Deskripsi wajib diisi', status: 0 }))
            return
        }

        if (!form.attachment) {
            dispatch(showNotification({ message: 'Lampiran bukti wajib diunggah', status: 0 }))
            return
        }

        try {
            setSubmitting(true)
            await pegawaiApi.submitReimbursement({
                ...form,
                amount: Number(form.amount),
                description: form.description.trim(),
                reimbursement_type: dbType,
            })
            setForm(INITIAL_FORM)
            dispatch(showNotification({
                message: 'Reimbursement berhasil diajukan dan menunggu persetujuan atasan',
                status: 1,
            }))
            await loadData()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <TitleCard title="Ajukan Reimbursement" topMargin="mt-0">
                <form className="grid md:grid-cols-2 grid-cols-1 gap-4" onSubmit={submitForm}>
                    <select
                        className="select select-bordered"
                        value={form.reimbursement_type}
                        onChange={(e) => {
                            const selectedValue = e.target.value
                            updateForm('reimbursement_type', selectedValue)
                        }}
                    >
                        <option value="">Pilih jenis reimbursement</option>
                        {REIMBURSEMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    <label className="input input-bordered border-base-300 bg-base-100 focus-within:border-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/20 flex items-center gap-2">
                        <span className="text-primary font-semibold">Rp</span>
                        <input
                            className="grow bg-transparent"
                            type="number"
                            min="0"
                            placeholder="Nominal"
                            value={form.amount}
                            onChange={(e) => updateForm('amount', e.target.value)}
                        />
                    </label>

                    <textarea className="textarea textarea-bordered md:col-span-2" placeholder="Deskripsi" value={form.description} onChange={(e) => updateForm('description', e.target.value)} />
                    <input className="file-input file-input-bordered md:col-span-2" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => updateForm('attachment', e.target.files?.[0] || null)} />
                    <div className="md:col-span-2 flex justify-end">
                        <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} type="submit" disabled={submitting}>Kirim Reimbursement</button>
                    </div>
                </form>
            </TitleCard>

            <TitleCard title="Riwayat Reimbursement" topMargin="mt-6">
                {loading ? (
                    <div>Memuat data reimbursement...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Tanggal</th>
                                    <th>Jenis</th>
                                    <th>Nominal</th>
                                    <th>Status</th>
                                    <th>Lampiran</th>
                                    <th>Deskripsi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                                        <td>{getTypeLabel(item)}</td>
                                        <td>Rp {Number(item.amount || 0).toLocaleString('id-ID')}</td>
                                        <td>{getStatusLabel(item.status)}</td>
                                        <td>
                                            {item.attachment ? (
                                                <a
                                                    href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/${item.attachment}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="link link-primary"
                                                >
                                                    Lihat
                                                </a>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td>{item.description}</td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center opacity-70">Belum ada reimbursement</td>
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

export default EmployeeReimbursement
