import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../Cards/TitleCard'
import { showNotification } from '../../features/common/headerSlice'

const spLabelMap = {
    sp1: 'SP1',
    sp2: 'SP2',
    sp3: 'SP3',
    evaluasi_hr: 'Evaluasi HR',
}

const alphaSanctionLabelMap = {
    none: 'Belum Ada SP',
    sp1: 'SP1',
    sp2: 'SP2',
    sp3: 'SP3',
    evaluasi_hr: 'Evaluasi HR',
}

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

const toDateInputValue = (dateValue) => {
    if (!dateValue) return ''
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const formatDate = (dateValue) => {
    if (!dateValue) return '-'
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const formatDateForLetter = (dateValue) => {
    if (!dateValue) return '-'
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })
}

const getDateParts = (dateValue) => {
    if (!dateValue) return null
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return null

    return {
        month: String(date.getMonth() + 1),
        year: String(date.getFullYear()),
    }
}

const findEmployeeOption = (options, value) => {
    const parsed = String(value || '').trim()
    if (!parsed) return null

    const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
    const extractedCode = match ? String(match[2] || '').trim().toLowerCase() : ''
    const normalizedName = (match ? String(match[1] || '') : parsed).trim().toLowerCase()
    const normalizedValue = parsed.toLowerCase()

    return options.find((item) => {
        const optionCode = String(item.code || '').trim().toLowerCase()
        const optionName = String(item.name || '').trim().toLowerCase()
        const optionLabel = String(item.label || '').trim().toLowerCase()

        if (extractedCode) return optionCode === extractedCode
        return optionCode === normalizedValue || optionName === normalizedName || optionLabel === normalizedValue
    }) || null
}

const getSpTitle = (spLevel) => {
    const normalized = String(spLevel || 'sp1').toLowerCase()
    if (normalized === 'sp1') return 'SURAT PERINGATAN PERTAMA (SP1)'
    if (normalized === 'sp2') return 'SURAT PERINGATAN KEDUA (SP2)'
    return 'SURAT PERINGATAN KETIGA (SP3)'
}

function WarningLetterManager({
    pageTitle,
    subtitle,
    apiClient,
}) {
    const dispatch = useDispatch()
    const currentUserId = useMemo(() => {
        try {
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}')
            return Number(storedUser?.id || storedUser?.user_id || 0)
        } catch (error) {
            return 0
        }
    }, [])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [employees, setEmployees] = useState([])
    const [letters, setLetters] = useState([])
    const [isCreateCardOpen, setIsCreateCardOpen] = useState(false)
    const createCardRef = useRef(null)
    const historyCardRef = useRef(null)
    const [impactedFilter, setImpactedFilter] = useState({
        employee_id: '',
        month: '',
        year: '',
        sanctionLevel: '',
    })
    const [historyFilter, setHistoryFilter] = useState({
        employee_id: '',
        month: '',
        year: '',
        spLevel: '',
    })
    const [impactedEmployeeInput, setImpactedEmployeeInput] = useState('')
    const [historyEmployeeInput, setHistoryEmployeeInput] = useState('')

    const [form, setForm] = useState({
        employee_id: '',
        sp_level: 'sp1',
        violation_date: '',
        issued_date: toDateInputValue(new Date()),
        reason: '',
        evaluation_date: '',
        evaluation_time: '',
        evaluation_place: 'Ruang HR / Kantor HRD',
    })

    const selectedEmployee = useMemo(() => {
        return employees.find((item) => String(item.employee_id) === String(form.employee_id)) || null
    }, [employees, form.employee_id])

    const isEvaluasiHR = useMemo(() => {
        return selectedEmployee
            ? String(selectedEmployee.alpha_sanction_level || '').toLowerCase() === 'evaluasi_hr'
            : false
    }, [selectedEmployee])

    const impactedEmployees = useMemo(() => {
        const issuedEmployeeIds = new Set(
            letters
                .map((letter) => Number(letter.employee_id))
                .filter((id) => Number.isFinite(id) && id > 0)
        )

        return employees.filter((item) => {
            const sanctionLevel = String(item.alpha_sanction_level || '').toLowerCase()
            if (sanctionLevel === 'none') return false

            const employeeId = Number(item.employee_id)
            if (!Number.isFinite(employeeId) || employeeId <= 0) return false

            const targetUserId = Number(item.employee_user_id || 0)
            if (currentUserId > 0 && targetUserId > 0 && currentUserId === targetUserId) {
                return false
            }

            // Pegawai yang sudah memiliki surat masuk ke card riwayat, bukan kandidat pembuatan lagi.
            return !issuedEmployeeIds.has(employeeId)
        })
    }, [employees, letters, currentUserId])

    const impactedEmployeeOptions = useMemo(() => {
        return impactedEmployees
            .map((item) => ({
                id: String(item.employee_id),
                code: String(item.employee_code || '').trim(),
                name: String(item.employee_name || '').trim(),
                label: `${item.employee_name || '-'} (${item.employee_code || '-'})`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'id-ID'))
    }, [impactedEmployees])

    const historyEmployeeOptions = useMemo(() => {
        const seen = new Set()

        return letters
            .filter((item) => {
                const employeeId = String(item.employee_id || '')
                if (!employeeId || seen.has(employeeId)) return false
                seen.add(employeeId)
                return true
            })
            .map((item) => ({
                id: String(item.employee_id),
                code: String(item.employee_code || '').trim(),
                name: String(item.employee_name || '').trim(),
                label: `${item.employee_name || '-'} (${item.employee_code || '-'})`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'id-ID'))
    }, [letters])

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const years = new Set([String(currentYear)])

        impactedEmployees.forEach((item) => {
            const parts = getDateParts(item.latest_alpha_date || item.violation_date_start)
            if (parts?.year) years.add(parts.year)
        })

        letters.forEach((item) => {
            const parts = getDateParts(item.issued_date || item.created_at)
            if (parts?.year) years.add(parts.year)
        })

        return Array.from(years).sort((a, b) => Number(b) - Number(a))
    }, [impactedEmployees, letters])

    const filteredImpactedEmployees = useMemo(() => {
        const query = impactedEmployeeInput.trim().toLowerCase()
        return impactedEmployees.filter((item) => {
            const sanctionLevel = String(item.alpha_sanction_level || '').toLowerCase()
            const matchesLevel = impactedFilter.sanctionLevel ? sanctionLevel === impactedFilter.sanctionLevel : true
            if (!matchesLevel) return false

            const matchesEmployee = impactedFilter.employee_id
                ? String(item.employee_id) === String(impactedFilter.employee_id)
                : true
            if (!matchesEmployee) return false

            const dateParts = getDateParts(item.latest_alpha_date || item.violation_date_start)
            const matchesMonth = impactedFilter.month ? dateParts?.month === impactedFilter.month : true
            const matchesYear = impactedFilter.year ? dateParts?.year === impactedFilter.year : true
            if (!matchesMonth || !matchesYear) return false

            if (!query) return true
            const name = String(item.employee_name || '').toLowerCase()
            const department = String(item.department_name || '').toLowerCase()
            const position = String(item.position_name || '').toLowerCase()
            const code = String(item.employee_code || '').toLowerCase()

            return (
                name.includes(query) ||
                department.includes(query) ||
                position.includes(query) ||
                code.includes(query)
            )
        })
    }, [impactedEmployees, impactedEmployeeInput, impactedFilter])

    const filteredLetters = useMemo(() => {
        const query = historyEmployeeInput.trim().toLowerCase()
        return letters.filter((item) => {
            const level = String(item.sp_level || '').toLowerCase()
            const matchesLevel = historyFilter.spLevel ? level === historyFilter.spLevel : true
            if (!matchesLevel) return false

            const matchesEmployee = historyFilter.employee_id
                ? String(item.employee_id) === String(historyFilter.employee_id)
                : true
            if (!matchesEmployee) return false

            const dateParts = getDateParts(item.issued_date || item.created_at)
            const matchesMonth = historyFilter.month ? dateParts?.month === historyFilter.month : true
            const matchesYear = historyFilter.year ? dateParts?.year === historyFilter.year : true
            if (!matchesMonth || !matchesYear) return false

            if (!query) return true
            const employeeName = String(item.employee_name || '').toLowerCase()
            const employeeCode = String(item.employee_code || '').toLowerCase()

            return employeeName.includes(query) || employeeCode.includes(query)
        }).slice().sort((a, b) => {
            const issuedA = new Date(a?.issued_date || a?.created_at || 0).getTime()
            const issuedB = new Date(b?.issued_date || b?.created_at || 0).getTime()
            if (issuedA !== issuedB) return issuedB - issuedA
            return Number(b?.id || 0) - Number(a?.id || 0)
        })
    }, [letters, historyEmployeeInput, historyFilter])

    const letterPreviewText = useMemo(() => {
        if (!selectedEmployee) return ''

        const isEvaluasiHRPreview = String(selectedEmployee.alpha_sanction_level || '').toLowerCase() === 'evaluasi_hr'

        if (isEvaluasiHRPreview) {
            if (!form.evaluation_date || !form.evaluation_time || !form.evaluation_place) return ''
            const employeeName = selectedEmployee.employee_name || '-'
            const departmentName = selectedEmployee.department_name || '-'
            const positionName = selectedEmployee.position_name || '-'
            const issuedDateText = formatDateForLetter(form.issued_date)
            const evalDay = new Date(form.evaluation_date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long' })
            const evalDateText = `${evalDay}, ${formatDateForLetter(form.evaluation_date)}`
            return `PT OTAK KANAN\nGraha Pena, Ruang 1503, Jl. Ahmad Yani No.88, Ketintang, Kec. Gayungan, Surabaya, Jawa Timur 60234\n\nUNDANGAN EVALUASI HR\nNo: [Nomor akan digenerate otomatis saat disimpan]\n\nDiberikan kepada:\nNama       : ${employeeName}\nDepartemen : ${departmentName}\nPosisi     : ${positionName}\n\nDengan hormat,\n\nSehubungan dengan catatan pelanggaran kedisiplinan kehadiran yang telah\nmencapai tahap Surat Peringatan III (SP3), dengan ini Saudara diminta\nuntuk menghadiri sesi Evaluasi HR.\n\nEvaluasi ini bertujuan untuk melakukan peninjauan terhadap riwayat\nkehadiran serta memberikan kesempatan kepada Saudara untuk menyampaikan\nklarifikasi terkait pelanggaran yang terjadi.\n\nAdapun pelaksanaan evaluasi akan dilakukan pada:\n\nHari/Tanggal : ${evalDateText}\nWaktu        : ${form.evaluation_time}\nTempat       : ${form.evaluation_place}\n\nDiharapkan Saudara dapat hadir sesuai jadwal yang telah ditentukan.\n\nSurabaya, ${issuedDateText}\n\n[Posisi akun pembuat - otomatis]\n([Nama lengkap akun pembuat - otomatis])`
        }

        if (!form.violation_date) return ''

        const spTitle = getSpTitle(form.sp_level)
        const letterNumber = '[Nomor akan digenerate otomatis saat disimpan]'
        const employeeName = selectedEmployee.employee_name || '-'
        const departmentName = selectedEmployee.department_name || '-'
        const positionName = selectedEmployee.position_name || '-'
        const npwp = selectedEmployee.npwp || '-'
        const violationDateText = String(form.violation_date || '-')
        const issuedDateText = formatDateForLetter(form.issued_date)
        const violationReason = form.reason?.trim()
            ? form.reason.trim()
            : `Berdasarkan catatan kehadiran, Saudara tidak masuk kerja tanpa\nketerangan (alpha) pada tanggal ${violationDateText}.`
        const signedTitle = '[Posisi akun pembuat - otomatis]'
        const signedName = '[Nama lengkap akun pembuat - otomatis]'

        return `PT OTAK KANAN\nGraha Pena, Ruang 1503, Jl. Ahmad Yani No.88, Ketintang, Kec. Gayungan, Surabaya, Jawa Timur 60234\n\n${spTitle}\nNo: ${letterNumber}\n\nDiberikan kepada:\nNama       : ${employeeName}\nDepartemen : ${departmentName}\nPosisi     : ${positionName}\nNPWP       : ${npwp}\n\n${violationReason}\n\nSehubungan dengan hal tersebut, perusahaan memberikan ${spTitle}.\nDiharapkan Saudara tidak mengulangi pelanggaran tersebut dan meningkatkan\nkedisiplinan kerja.\n\nSurat peringatan ini berlaku selama 6 bulan sejak tanggal diterbitkan.\n\nSurabaya, ${issuedDateText}\n\n${signedTitle}\n(${signedName})`
    }, [selectedEmployee, form])

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            setError('')

            const [employeeResult, letterResult] = await Promise.all([
                apiClient.getWarningLetterEligibleEmployees(),
                apiClient.getWarningLetters(),
            ])

            const employeeRows = employeeResult?.data || []
            const letterRows = letterResult?.data || []

            setEmployees(employeeRows)
            setLetters(letterRows)

        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [apiClient])

    useEffect(() => {
        dispatch(setPageTitle({ title: pageTitle }))
    }, [dispatch, pageTitle])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        if (!selectedEmployee) return
        const suggestedLevel = String(selectedEmployee.alpha_sanction_level || '').toLowerCase()
        const nextLevel = (['sp1', 'sp2', 'sp3', 'evaluasi_hr'].includes(suggestedLevel))
            ? suggestedLevel
            : 'sp1'
        setForm((prev) => ({
            ...prev,
            sp_level: nextLevel,
            violation_date: selectedEmployee.violation_date_label || toDateInputValue(selectedEmployee.latest_alpha_date || ''),
        }))
    }, [selectedEmployee])

    useEffect(() => {
        if (!isCreateCardOpen) return
        // Scroll halus ke form pembuatan SP agar user langsung fokus ke card yang dibuka.
        createCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [isCreateCardOpen])

    const scrollToCreateCard = useCallback(() => {
        // Delay kecil agar elemen card sudah ter-render saat state dibuka.
        window.requestAnimationFrame(() => {
            createCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [])

    const scrollToHistoryCard = useCallback(() => {
        window.requestAnimationFrame(() => {
            historyCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
    }, [])

    const handleSelectEmployee = (employee) => {
        const suggestedLevel = String(employee?.alpha_sanction_level || '').toLowerCase()
        const mappedLevel = (['sp1', 'sp2', 'sp3', 'evaluasi_hr'].includes(suggestedLevel))
            ? suggestedLevel
            : 'sp1'

        setForm((prev) => ({
            ...prev,
            employee_id: String(employee.employee_id),
            sp_level: mappedLevel,
            violation_date: employee.violation_date_label || toDateInputValue(employee.latest_alpha_date || ''),
            issued_date: prev.issued_date || toDateInputValue(new Date()),
        }))
        setIsCreateCardOpen(true)
        scrollToCreateCard()
    }

    const handleInput = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const handleImpactedEmployeeInputChange = (value) => {
        setImpactedEmployeeInput(value)
        const found = findEmployeeOption(impactedEmployeeOptions, value)
        setImpactedFilter((prev) => ({
            ...prev,
            employee_id: found?.id || '',
        }))
    }

    const handleHistoryEmployeeInputChange = (value) => {
        setHistoryEmployeeInput(value)
        const found = findEmployeeOption(historyEmployeeOptions, value)
        setHistoryFilter((prev) => ({
            ...prev,
            employee_id: found?.id || '',
        }))
    }

    const handleCreate = async (event) => {
        event.preventDefault()
        try {
            setSaving(true)
            setError('')
            const { violation_date, ...restForm } = form
            const payload = {
                ...restForm,
                employee_id: Number(form.employee_id),
            }

            const result = await apiClient.createWarningLetter(payload)
            dispatch(showNotification({
                message: result?.message || 'Surat peringatan berhasil dibuat',
                status: 1,
            }))

            await loadData()
            setIsCreateCardOpen(false)
            setForm((prev) => ({
                ...prev,
                reason: '',
            }))
            scrollToHistoryCard()
        } catch (err) {
            setError(err.message)
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setSaving(false)
        }
    }

    const handlePrint = (letter) => {
        if (!letter?.letter_content) return

        const popup = window.open('', '_blank', 'width=900,height=700')
        if (!popup) return

        const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')

        const formattedContent = escapeHtml(letter.letter_content).replace(/\n/g, '<br/>')

        popup.document.write(`
            <html>
                <head>
                    <title>${letter.letter_number}</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 24mm 20mm 24mm 20mm;
                        }

                        * {
                            box-sizing: border-box;
                        }

                        body {
                            margin: 0;
                            font-family: 'Times New Roman', serif;
                            color: #111827;
                            line-height: 1.6;
                            background: #f3f4f6;
                        }

                        .sheet {
                            width: 210mm;
                            min-height: 297mm;
                            margin: 0 auto;
                            background: #ffffff;
                            padding: 24mm 20mm;
                            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
                        }

                        .letter-content {
                            font-size: 14pt;
                            white-space: normal;
                            word-break: break-word;
                        }

                        @media print {
                            body {
                                background: #ffffff;
                            }

                            .sheet {
                                width: auto;
                                min-height: auto;
                                margin: 0;
                                padding: 0;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        <div class="letter-content">${formattedContent}</div>
                    </div>
                </body>
            </html>
        `)
        popup.document.close()
        popup.focus()
        popup.print()
    }

    if (loading) {
        return <div className="py-10 text-center">Memuat data surat peringatan...</div>
    }

    return (
        <div className="space-y-6">
            {error ? (
                <div className="alert alert-error">
                    <span>{error}</span>
                    <button className="btn btn-xs" onClick={loadData}>Muat Ulang</button>
                </div>
            ) : null}

            <TitleCard title="Pegawai Terkena SP" topMargin="mt-0">
                <p className="text-sm opacity-75 mb-4">{subtitle}</p>
                <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    <input
                        type="search"
                        list="warning-letter-impacted-employee-options"
                        className="input input-bordered w-full"
                        placeholder="Cari pegawai"
                        value={impactedEmployeeInput}
                        onChange={(event) => handleImpactedEmployeeInputChange(event.target.value)}
                    />
                    <datalist id="warning-letter-impacted-employee-options">
                        {impactedEmployeeOptions.map((option) => (
                            <option key={`impacted-${option.id}`} value={option.label} />
                        ))}
                    </datalist>
                    <select
                        className="select select-bordered"
                        value={impactedFilter.month}
                        onChange={(event) => setImpactedFilter((prev) => ({ ...prev, month: event.target.value }))}
                    >
                        <option value="">Semua Bulan</option>
                        {monthOptions.map((month) => (
                            <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={impactedFilter.year}
                        onChange={(event) => setImpactedFilter((prev) => ({ ...prev, year: event.target.value }))}
                    >
                        <option value="">Semua Tahun</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={impactedFilter.sanctionLevel}
                        onChange={(event) => setImpactedFilter((prev) => ({ ...prev, sanctionLevel: event.target.value }))}
                    >
                        <option value="">Semua Status SP</option>
                        <option value="sp1">SP1</option>
                        <option value="sp2">SP2</option>
                        <option value="sp3">SP3</option>
                        <option value="evaluasi_hr">Evaluasi HR</option>
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>Nama</th>
                                <th>Departemen</th>
                                <th>Posisi</th>
                                <th>Status SP Alpha</th>
                                <th>Alpha Berturut</th>
                                <th>Alpha Akumulasi</th>
                                <th>Tgl Alpha Terakhir</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredImpactedEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center opacity-60">Belum ada pegawai yang terkena SP</td>
                                </tr>
                            ) : filteredImpactedEmployees.map((item) => (
                                <tr key={item.employee_id}>
                                    <td>{item.employee_name}</td>
                                    <td>{item.department_name || '-'}</td>
                                    <td>{item.position_name || '-'}</td>
                                    <td>{alphaSanctionLabelMap[String(item.alpha_sanction_level || 'none')] || '-'}</td>
                                    <td>{Number(item.alpha_consecutive_days || 0)} hari</td>
                                    <td>{Number(item.alpha_accumulated_days || 0)} hari</td>
                                    <td>{item.violation_date_label || formatDate(item.latest_alpha_date)}</td>
                                    <td>
                                        <button className="btn btn-xs btn-primary" onClick={() => handleSelectEmployee(item)}>
                                            {String(item.alpha_sanction_level || '').toLowerCase() === 'evaluasi_hr' ? 'Buat Undangan Evaluasi' : 'Buat SP'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </TitleCard>

            {isCreateCardOpen ? (
                <div ref={createCardRef}>
                    <TitleCard title={isEvaluasiHR ? 'Membuat Undangan Evaluasi HR' : 'Membuat Surat Peringatan'} topMargin="mt-0">
                    <form className="grid md:grid-cols-2 grid-cols-1 gap-4" onSubmit={handleCreate}>
                        <label className="form-control md:col-span-2">
                            <span className="label-text">Pegawai Tujuan</span>
                            <select
                                className="select select-bordered"
                                value={form.employee_id}
                                onChange={(event) => handleInput('employee_id', event.target.value)}
                                required
                            >
                                {impactedEmployees.map((item) => {
                                    const sanctionLabel = alphaSanctionLabelMap[String(item.alpha_sanction_level || 'none')] || '-'
                                    return (
                                        <option key={item.employee_id} value={item.employee_id}>
                                            {item.employee_name} | {item.department_name || '-'} | {item.position_name || '-'} | SP saat ini: {sanctionLabel}
                                        </option>
                                    )
                                })}
                            </select>
                        </label>

                        {!isEvaluasiHR && (
                        <label className="form-control">
                            <span className="label-text">Level SP</span>
                            <select
                                className="select select-bordered"
                                value={form.sp_level}
                                onChange={(event) => handleInput('sp_level', event.target.value)}
                                required
                            >
                                <option value="sp1">SP1</option>
                                <option value="sp2">SP2</option>
                                <option value="sp3">SP3</option>
                            </select>
                        </label>
                        )}

                        <label className="form-control">
                            <span className="label-text">Tanggal Terbit</span>
                            <input
                                type="date"
                                className="input input-bordered"
                                value={form.issued_date}
                                onChange={(event) => handleInput('issued_date', event.target.value)}
                                required
                            />
                        </label>

                        {isEvaluasiHR && (<>
                        <label className="form-control">
                            <span className="label-text">Hari/Tanggal Evaluasi</span>
                            <input
                                type="date"
                                className="input input-bordered"
                                value={form.evaluation_date}
                                onChange={(event) => handleInput('evaluation_date', event.target.value)}
                                required
                            />
                        </label>
                        <label className="form-control">
                            <span className="label-text">Waktu</span>
                            <input
                                type="time"
                                className="input input-bordered"
                                value={form.evaluation_time}
                                onChange={(event) => handleInput('evaluation_time', event.target.value)}
                                required
                            />
                        </label>
                        <label className="form-control md:col-span-2">
                            <span className="label-text">Tempat</span>
                            <input
                                type="text"
                                className="input input-bordered"
                                value={form.evaluation_place}
                                onChange={(event) => handleInput('evaluation_place', event.target.value)}
                                placeholder="Ruang HR / Kantor HRD"
                                required
                            />
                        </label>
                        </>)}

                        <div className="form-control md:col-span-2">
                            <span className="label-text">Penandatangan</span>
                            <div className="alert alert-info mt-1 text-sm">
                                Otomatis menggunakan posisi dan nama lengkap akun yang membuat surat.
                            </div>
                        </div>

                        {!isEvaluasiHR && (
                        <label className="form-control md:col-span-2">
                            <span className="label-text">Alasan/Penjelasan Pelanggaran (opsional)</span>
                            <textarea
                                className="textarea textarea-bordered min-h-[100px]"
                                value={form.reason}
                                onChange={(event) => handleInput('reason', event.target.value)}
                                placeholder="Jika kosong, sistem akan memakai narasi default alpha"
                            />
                        </label>
                        )}

                        {letterPreviewText ? (
                            <div className="md:col-span-2">
                                <p className="text-sm opacity-70 mb-2">Preview Surat</p>
                                <pre className="bg-base-200 p-4 rounded-lg overflow-auto text-sm leading-7 whitespace-pre-wrap border border-base-300">{letterPreviewText}</pre>
                            </div>
                        ) : null}

                        <div className="md:col-span-2 flex gap-2">
                            <button type="submit" className={`btn btn-primary ${saving ? 'loading' : ''}`} disabled={saving || !form.employee_id}>
                                {saving ? 'Menyimpan...' : isEvaluasiHR ? 'Buat Undangan Evaluasi HR' : 'Buat Surat Peringatan'}
                            </button>
                            <button type="button" className="btn btn-ghost" onClick={() => setIsCreateCardOpen(false)}>
                                Batal
                            </button>
                        </div>
                    </form>
                    </TitleCard>
                </div>
            ) : null}

            <div ref={historyCardRef}>
                <TitleCard title="Riwayat Surat Peringatan" topMargin="mt-0">
                <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-3 mb-4">
                    <input
                        type="search"
                        list="warning-letter-history-employee-options"
                        className="input input-bordered w-full"
                        placeholder="Cari pegawai"
                        value={historyEmployeeInput}
                        onChange={(event) => handleHistoryEmployeeInputChange(event.target.value)}
                    />
                    <datalist id="warning-letter-history-employee-options">
                        {historyEmployeeOptions.map((option) => (
                            <option key={`history-${option.id}`} value={option.label} />
                        ))}
                    </datalist>
                    <select
                        className="select select-bordered"
                        value={historyFilter.month}
                        onChange={(event) => setHistoryFilter((prev) => ({ ...prev, month: event.target.value }))}
                    >
                        <option value="">Semua Bulan</option>
                        {monthOptions.map((month) => (
                            <option key={month.value} value={month.value}>{month.label}</option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={historyFilter.year}
                        onChange={(event) => setHistoryFilter((prev) => ({ ...prev, year: event.target.value }))}
                    >
                        <option value="">Semua Tahun</option>
                        {yearOptions.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <select
                        className="select select-bordered"
                        value={historyFilter.spLevel}
                        onChange={(event) => setHistoryFilter((prev) => ({ ...prev, spLevel: event.target.value }))}
                    >
                        <option value="">Semua Level SP</option>
                        <option value="sp1">SP1</option>
                        <option value="sp2">SP2</option>
                        <option value="sp3">SP3</option>
                        <option value="evaluasi_hr">Evaluasi HR</option>
                    </select>
                </div>
                <div className="overflow-x-auto">
                    <table className="table table-zebra">
                        <thead>
                            <tr>
                                <th>No Surat</th>
                                <th>Pegawai</th>
                                <th>SP</th>
                                <th>Tgl Pelanggaran</th>
                                <th>Tgl Terbit</th>
                                <th>Berlaku Sampai</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLetters.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center opacity-60">Belum ada surat peringatan</td>
                                </tr>
                            ) : filteredLetters.map((item) => (
                                <tr key={item.id}>
                                    <td>{item.letter_number}</td>
                                    <td>{item.employee_name}</td>
                                    <td><span className="badge badge-outline">{spLabelMap[item.sp_level] || item.sp_level}</span></td>
                                    <td>{formatDate(item.violation_date)}</td>
                                    <td>{formatDate(item.issued_date)}</td>
                                    <td>{formatDate(item.valid_until)}</td>
                                    <td>
                                        <button className="btn btn-xs" onClick={() => handlePrint(item)}>
                                            Lihat/Cetak
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </TitleCard>
            </div>
        </div>
    )
}

export default WarningLetterManager
