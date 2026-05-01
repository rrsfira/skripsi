import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'

const MANAGER_POSITION_NAMES = [
    'director',
    'operations manager',
    'marketing & sales manager',
    'finance, accounting & tax manager',
    'hr&ga manager',
    'hr & ga manager',
]

const normalizeText = (value = '') => String(value).toLowerCase().replace(/\s+/g, ' ').trim()

const formatRupiah = (value) => `Rp. ${Number(value || 0).toLocaleString('id-ID')}`

const API_ORIGIN = (process.env.REACT_APP_BASE_URL || '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')

const getEmployeePhotoUrl = (photoPath) => {
    if (!photoPath) return 'https://placeimg.com/120/120/people'
    if (/^https?:\/\//i.test(photoPath)) return photoPath

    const normalizedPath = String(photoPath).startsWith('/') ? String(photoPath) : `/${photoPath}`
    if (API_ORIGIN) return `${API_ORIGIN}${normalizedPath}`
    return `http://localhost:5000${normalizedPath}`
}

const getDocumentUrl = (documentPath) => {
    if (!documentPath) return ''
    if (/^https?:\/\//i.test(documentPath)) return documentPath

    const normalizedPath = String(documentPath).startsWith('/') ? String(documentPath) : `/${documentPath}`
    if (API_ORIGIN) return `${API_ORIGIN}${normalizedPath}`
    return `http://localhost:5000${normalizedPath}`
}

const isDirectorPosition = (position) => {
    const normalizedName = normalizeText(position?.name)
    const normalizedLevel = normalizeText(position?.level)
    return normalizedName === 'director' || normalizedLevel === 'director'
}

const getRawAutoRolesForCreateForm = (formState, allPositions) => {
    const autoRoles = new Set(['pegawai'])

    const normalizedDepartment = normalizeText(formState.department_name)

    if (normalizedDepartment.includes('management')) {
        autoRoles.add('admin')
    }

    if (normalizedDepartment.startsWith('hr')) {
        autoRoles.add('hr')
    }

    if (normalizedDepartment.includes('finance')) {
        autoRoles.add('finance')
    }

    const selectedPosition = allPositions.find((position) => String(position.id) === String(formState.position_id))
    const normalizedPosition = normalizeText(selectedPosition?.name)
    if (MANAGER_POSITION_NAMES.includes(normalizedPosition) || isDirectorPosition(selectedPosition)) {
        autoRoles.add('atasan')
    }

    if (normalizedPosition === 'hr&ga manager' || normalizedPosition === 'hr & ga manager') {
        autoRoles.add('hr')
    }

    return Array.from(autoRoles)
}

const INITIAL_FORM = {
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    photo: '',
    roles: ['pegawai'],
    excluded_auto_roles: [],
    gender: '',
    birth_place: '',
    date_of_birth: '',
    marital_status: '',
    nationality: 'Indonesian',
    address: '',
    nik: '',
    npwp: '',
    bank_account: '',
    account_holder_name: '',
    bank_name: '',
    bpjs_number: '',
    department_name: '',
    position_id: '',
    join_date: '',
    user_status: 'active',
    employment_status: 'permanent',
}

const INITIAL_DOCUMENTS = {
    ktp_document: null,
    diploma_document: null,
    employment_contract_document: null,
}

function AdminEmployees() {
    const dispatch = useDispatch()
    const [employees, setEmployees] = useState([])
    const [users, setUsers] = useState([])
    const [positions, setPositions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [editingEmployee, setEditingEmployee] = useState(null)
    const [editDocuments, setEditDocuments] = useState(INITIAL_DOCUMENTS)
    const [viewingEmployee, setViewingEmployee] = useState(null)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createForm, setCreateForm] = useState(INITIAL_FORM)
    const [createDocuments, setCreateDocuments] = useState(INITIAL_DOCUMENTS)

    const departments = useMemo(() => {
        const uniqueDepartments = Array.from(
            new Set(
                positions
                    .map((position) => position.department_name)
                    .filter(Boolean)
            )
        )

        return uniqueDepartments.sort((left, right) => left.localeCompare(right))
    }, [positions])

    const filteredPositions = useMemo(() => {
        if (!createForm.department_name) return []
        return positions.filter((position) => position.department_name === createForm.department_name)
    }, [positions, createForm.department_name])

    const editFilteredPositions = useMemo(() => {
        if (!editingEmployee?.department_name) return []
        return positions.filter((position) => position.department_name === editingEmployee.department_name)
    }, [positions, editingEmployee])

    const liveEditRoles = useMemo(() => {
        if (!editingEmployee) return []
        return getRawAutoRolesForCreateForm(
            {
                department_name: editingEmployee.department_name,
                position_id: editingEmployee.position_id,
            },
            positions,
        )
    }, [editingEmployee, positions])

    const getPositionBaseSalary = (positionId) => {
        const selectedPosition = positions.find((position) => String(position.id) === String(positionId))
        if (!selectedPosition) return ''
        return selectedPosition.base_salary ?? ''
    }

    const userRolesById = useMemo(() => {
        return users.reduce((accumulator, user) => {
            accumulator[String(user.id)] = Array.isArray(user.roles) ? user.roles : []
            return accumulator
        }, {})
    }, [users])

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')
            const [employeesData, metaData, usersData] = await Promise.all([
                adminApi.getEmployees(),
                adminApi.getMeta(),
                adminApi.getUsers(),
            ])
            setEmployees(employeesData)
            setPositions(metaData.positions || [])
            setUsers(usersData || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Manajemen Pegawai' }))
        loadData()
    }, [dispatch])

    const applyAutoRoles = (nextFormState) => {
        return {
            ...nextFormState,
            excluded_auto_roles: [],
            roles: getRawAutoRolesForCreateForm(nextFormState, positions),
        }
    }

    const hasSelectedDocuments = (documents) => {
        return Boolean(documents.ktp_document || documents.diploma_document || documents.employment_contract_document)
    }

    const getDisplayValue = (value) => {
        if (value === null || value === undefined || value === '') return '-'
        return value
    }

    const getDocumentFileName = (pathValue) => {
        if (!pathValue) return '-'
        return String(pathValue).split('/').pop()
    }

    const updateCreateForm = (field, value) => {
        setCreateForm((prev) => applyAutoRoles({ ...prev, [field]: value }))
    }

    useEffect(() => {
        setCreateForm((prev) => ({
            ...prev,
            excluded_auto_roles: [],
            roles: getRawAutoRolesForCreateForm(prev, positions),
        }))
    }, [positions])

    const handleCreateEmployee = async (event) => {
        event.preventDefault()

        if (!createForm.name || !createForm.email || !createForm.username || !createForm.password) {
            setError('Nama, email, username, dan password wajib diisi')
            return
        }

        if (!createForm.department_name || !createForm.position_id || !createForm.join_date) {
            setError('Departemen, posisi, dan tanggal bergabung wajib diisi')
            return
        }

        if (!createForm.roles.length) {
            setError('Minimal 1 role harus dipilih')
            return
        }

        try {
            setSubmitting(true)
            setError('')
            const createdStaff = await adminApi.createStaff({
                name: createForm.name,
                full_name: createForm.name,
                email: createForm.email,
                username: createForm.username,
                password: createForm.password,
                phone: createForm.phone,
                photo: createForm.photo || undefined,
                roles: createForm.roles,
                gender: createForm.gender || undefined,
                birth_place: createForm.birth_place || undefined,
                date_of_birth: createForm.date_of_birth || undefined,
                marital_status: createForm.marital_status || undefined,
                nationality: createForm.nationality || undefined,
                address: createForm.address || undefined,
                nik: createForm.nik || undefined,
                npwp: createForm.npwp || undefined,
                bank_account: createForm.bank_account || undefined,
                account_holder_name: createForm.account_holder_name || undefined,
                bank_name: createForm.bank_name || undefined,
                bpjs_number: createForm.bpjs_number || undefined,
                position_id: Number(createForm.position_id),
                join_date: createForm.join_date,
                employment_status: createForm.employment_status,
                status: createForm.user_status,
            })

            if (createdStaff?.employee_id && hasSelectedDocuments(createDocuments)) {
                const documentFormData = new FormData()

                if (createDocuments.ktp_document) {
                    documentFormData.append('ktp_document', createDocuments.ktp_document)
                }
                if (createDocuments.diploma_document) {
                    documentFormData.append('diploma_document', createDocuments.diploma_document)
                }
                if (createDocuments.employment_contract_document) {
                    documentFormData.append('employment_contract_document', createDocuments.employment_contract_document)
                }

                await adminApi.updateEmployee(createdStaff.employee_id, documentFormData)
            }

            setCreateForm(INITIAL_FORM)
            setCreateDocuments(INITIAL_DOCUMENTS)
            setShowCreateModal(false)
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const confirmDeleteEmployee = async () => {
        if (!deleteTarget?.id) return
        try {
            setDeleting(true)
            setError('')
            await adminApi.deleteEmployee(deleteTarget.id)
            setDeleteTarget(null)
            await loadData()
        } catch (err) {
            setError(err.message)
        } finally {
            setDeleting(false)
        }
    }

    const mapEmployeeToEditForm = (employee) => {
        const rolesFromEmployee = Array.isArray(employee.roles) ? employee.roles : []
        const rolesFromUser = userRolesById[String(employee.user_id)] || []

        return {
        ...employee,
        name: employee.full_name || employee.name || '',
        email: employee.email || '',
        username: employee.username || '',
        phone: employee.phone || '',
        gender: employee.gender || '',
        birth_place: employee.birth_place || '',
        date_of_birth: employee.date_of_birth ? String(employee.date_of_birth).slice(0, 10) : '',
        marital_status: employee.marital_status || '',
        nationality: employee.nationality || '',
        address: employee.address || '',
        nik: employee.nik || '',
        npwp: employee.npwp || '',
        bpjs_number: employee.bpjs_number || '',
        bank_account: employee.bank_account || '',
        account_holder_name: employee.account_holder_name || '',
        bank_name: employee.bank_name || '',
        department_name: employee.department_name || '',
        position_id: employee.position_id ? String(employee.position_id) : '',
        join_date: employee.join_date ? String(employee.join_date).slice(0, 10) : '',
        user_status: employee.status || 'active',
        employment_status: employee.employment_status || 'permanent',
        roles: rolesFromEmployee.length ? rolesFromEmployee : rolesFromUser,
        }
    }

    const openEditModal = async (employee) => {
        setEditDocuments(INITIAL_DOCUMENTS)
        setEditingEmployee(mapEmployeeToEditForm(employee))

        try {
            const detail = await adminApi.getEmployeeById(employee.id)
            if (detail) {
                setEditingEmployee((prev) => {
                    if (!prev || prev.id !== employee.id) return prev
                    return mapEmployeeToEditForm({ ...prev, ...detail })
                })
            }
        } catch (err) {
            setError(err.message)
        }
    }

    const openViewModal = async (employee) => {
        setViewingEmployee(mapEmployeeToEditForm(employee))

        try {
            const detail = await adminApi.getEmployeeById(employee.id)
            if (detail) {
                setViewingEmployee((prev) => {
                    if (!prev || prev.id !== employee.id) return prev
                    return mapEmployeeToEditForm({ ...prev, ...detail })
                })
            }
        } catch (err) {
            setError(err.message)
        }
    }

    const handleSaveEdit = async () => {
        if (!editingEmployee) return

        try {
            setSubmitting(true)
            setError('')
            const hasNewDocument = hasSelectedDocuments(editDocuments)

            if (hasNewDocument) {
                const formData = new FormData()
                formData.append('full_name', editingEmployee.name || editingEmployee.full_name || '')
                formData.append('gender', editingEmployee.gender || '')
                formData.append('birth_place', editingEmployee.birth_place || '')
                formData.append('date_of_birth', editingEmployee.date_of_birth || '')
                formData.append('marital_status', editingEmployee.marital_status || '')
                formData.append('nationality', editingEmployee.nationality || '')
                formData.append('address', editingEmployee.address || '')
                formData.append('position_id', editingEmployee.position_id ? String(editingEmployee.position_id) : '')
                formData.append('join_date', editingEmployee.join_date || '')
                formData.append('basic_salary', editingEmployee.basic_salary ? String(editingEmployee.basic_salary) : '')
                formData.append('employment_status', editingEmployee.employment_status || '')
                formData.append('phone', editingEmployee.phone || '')
                formData.append('email', editingEmployee.email || '')
                formData.append('nik', editingEmployee.nik || '')
                formData.append('npwp', editingEmployee.npwp || '')
                formData.append('bank_account', editingEmployee.bank_account || '')
                formData.append('account_holder_name', editingEmployee.account_holder_name || '')
                formData.append('bank_name', editingEmployee.bank_name || '')
                formData.append('bpjs_number', editingEmployee.bpjs_number || '')

                if (editDocuments.ktp_document) {
                    formData.append('ktp_document', editDocuments.ktp_document)
                }
                if (editDocuments.diploma_document) {
                    formData.append('diploma_document', editDocuments.diploma_document)
                }
                if (editDocuments.employment_contract_document) {
                    formData.append('employment_contract_document', editDocuments.employment_contract_document)
                }

                await adminApi.updateEmployee(editingEmployee.id, formData)
            } else {
                await adminApi.updateEmployee(editingEmployee.id, {
                    full_name: editingEmployee.name || editingEmployee.full_name,
                    gender: editingEmployee.gender,
                    birth_place: editingEmployee.birth_place,
                    date_of_birth: editingEmployee.date_of_birth,
                    marital_status: editingEmployee.marital_status,
                    nationality: editingEmployee.nationality,
                    address: editingEmployee.address,
                    position_id: editingEmployee.position_id ? Number(editingEmployee.position_id) : undefined,
                    join_date: editingEmployee.join_date,
                    basic_salary: editingEmployee.basic_salary ? Number(editingEmployee.basic_salary) : undefined,
                    employment_status: editingEmployee.employment_status,
                    phone: editingEmployee.phone,
                    email: editingEmployee.email,
                    nik: editingEmployee.nik,
                    npwp: editingEmployee.npwp,
                    bank_account: editingEmployee.bank_account,
                    account_holder_name: editingEmployee.account_holder_name,
                    bank_name: editingEmployee.bank_name,
                    bpjs_number: editingEmployee.bpjs_number,
                })
            }

            if (editingEmployee.user_id) {
                const syncedRoles = getRawAutoRolesForCreateForm(
                    {
                        department_name: editingEmployee.department_name,
                        position_id: editingEmployee.position_id,
                    },
                    positions,
                )

                await adminApi.updateUser(editingEmployee.user_id, {
                    name: editingEmployee.name || editingEmployee.full_name || undefined,
                    email: editingEmployee.email || undefined,
                    username: editingEmployee.username || undefined,
                    phone: editingEmployee.phone || undefined,
                    status: editingEmployee.user_status || 'active',
                    roles: syncedRoles,
                })
            }

            setEditingEmployee(null)
            setEditDocuments(INITIAL_DOCUMENTS)
            await loadData()
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

            <TitleCard
                title="Data Pegawai"
                topMargin="mt-0"
                TopSideButtons={<button className="btn btn-primary btn-sm" onClick={() => { setError(''); setShowCreateModal(true) }}>Tambah Pegawai</button>}
            >
                {loading ? (
                    <div>Memuat data pegawai...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead className="text-center">
                                <tr>
                                    <th>Kode</th>
                                    <th>Nama</th>
                                    <th>Posisi</th>
                                    <th>Status</th>
                                    <th className="text-right pr-6">Gaji Pokok</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td>{employee.employee_code}</td>
                                        <td>{employee.full_name || employee.name}</td>
                                        <td>{employee.position_name || '-'}</td>
                                        <td><span className="badge">{employee.employment_status}</span></td>
                                        <td className="text-right pr-6 tabular-nums whitespace-nowrap">{formatRupiah(employee.basic_salary)}</td>
                                        <td>
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <button className="btn btn-xs btn-outline btn-info min-w-[52px]" onClick={() => openViewModal(employee)}>View</button>
                                                <button className="btn btn-xs btn-outline min-w-[52px]" onClick={() => openEditModal(employee)}>Edit</button>
                                                <button className="btn btn-xs btn-outline btn-error min-w-[52px]" onClick={() => setDeleteTarget(employee)}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <input
                type="checkbox"
                id="create-employee-modal"
                className="modal-toggle"
                checked={showCreateModal}
                onChange={() => { setError(''); setShowCreateModal(false) }}
            />
            <div className="modal">
                <div className="modal-box max-w-6xl">
                    <h3 className="font-bold text-lg">Tambah Pegawai</h3>
                    {error ? (
                        <div className="alert alert-error mt-3">
                            <span>{error}</span>
                        </div>
                    ) : null}
                    <form className="space-y-4 mt-4" onSubmit={handleCreateEmployee}>
                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Akun Pengguna</p>
                            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
                                <input className="input input-bordered" placeholder="Nama" value={createForm.name} onChange={(e) => updateCreateForm('name', e.target.value)} />
                                <input className="input input-bordered" placeholder="Email" type="email" value={createForm.email} onChange={(e) => updateCreateForm('email', e.target.value)} />
                                <input className="input input-bordered" placeholder="Username" value={createForm.username} onChange={(e) => updateCreateForm('username', e.target.value)} />
                                <input className="input input-bordered" placeholder="Password" type="password" value={createForm.password} onChange={(e) => updateCreateForm('password', e.target.value)} />
                                <input className="input input-bordered" placeholder="Telepon" value={createForm.phone} onChange={(e) => updateCreateForm('phone', e.target.value)} />
                                <select className="select select-bordered" value={createForm.user_status} onChange={(e) => updateCreateForm('user_status', e.target.value)}>
                                    <option value="active">Pengguna Aktif</option>
                                    <option value="inactive">Pengguna Tidak Aktif</option>
                                </select>
                            </div>
                        </div>

                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Data Pribadi & Administrasi</p>
                            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
                                <select className="select select-bordered" value={createForm.gender} onChange={(e) => updateCreateForm('gender', e.target.value)}>
                                    <option value="">Pilih Jenis Kelamin</option>
                                    <option value="male">Laki-laki</option>
                                    <option value="female">Perempuan</option>
                                </select>
                                <input className="input input-bordered" placeholder="Tempat Lahir" value={createForm.birth_place} onChange={(e) => updateCreateForm('birth_place', e.target.value)} />
                                <div className="relative">
                                    <span className="absolute -top-2 left-3 bg-base-100 px-1 text-xs text-base-content/70">Tanggal Lahir</span>
                                    <input className="input input-bordered w-full" type="date" value={createForm.date_of_birth} onChange={(e) => updateCreateForm('date_of_birth', e.target.value)} />
                                </div>
                                <select className="select select-bordered" value={createForm.marital_status} onChange={(e) => updateCreateForm('marital_status', e.target.value)}>
                                    <option value="">Pilih Status Pernikahan</option>
                                    <option value="single">Belum Menikah</option>
                                    <option value="married">Menikah</option>
                                    <option value="divorced">Cerai</option>
                                    <option value="widowed">Janda/Duda</option>
                                </select>
                                <input className="input input-bordered" placeholder="Kewarganegaraan" value={createForm.nationality} onChange={(e) => updateCreateForm('nationality', e.target.value)} />
                                <input className="input input-bordered" placeholder="NIK" value={createForm.nik} onChange={(e) => updateCreateForm('nik', e.target.value)} />
                                <input className="input input-bordered" placeholder="NPWP" value={createForm.npwp} onChange={(e) => updateCreateForm('npwp', e.target.value)} />
                                <input className="input input-bordered" placeholder="Nomor BPJS" value={createForm.bpjs_number} onChange={(e) => updateCreateForm('bpjs_number', e.target.value)} />
                                <input className="input input-bordered" placeholder="Nomor Rekening" value={createForm.bank_account} onChange={(e) => updateCreateForm('bank_account', e.target.value)} />
                                <input className="input input-bordered" placeholder="Nama Pemilik Rekening" value={createForm.account_holder_name} onChange={(e) => updateCreateForm('account_holder_name', e.target.value)} />
                                <input className="input input-bordered" placeholder="Nama Bank" value={createForm.bank_name} onChange={(e) => updateCreateForm('bank_name', e.target.value)} />
                                <input className="input input-bordered lg:col-span-2 md:col-span-2" placeholder="Alamat" value={createForm.address} onChange={(e) => updateCreateForm('address', e.target.value)} />
                            </div>
                        </div>

                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Data Kepegawaian</p>
                            <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-4">
                                <select
                                    className="select select-bordered"
                                    value={createForm.department_name}
                                    onChange={(e) => {
                                        setCreateForm((prev) => applyAutoRoles({
                                            ...prev,
                                            department_name: e.target.value,
                                            position_id: '',
                                        }))
                                    }}
                                >
                                    <option value="">Pilih Departemen</option>
                                    {departments.map((department) => (
                                        <option key={department} value={department}>
                                            {department}
                                        </option>
                                    ))}
                                </select>
                                <select className="select select-bordered" value={createForm.position_id} onChange={(e) => updateCreateForm('position_id', e.target.value)}>
                                    <option value="">Pilih Posisi</option>
                                    {filteredPositions.map((position) => (
                                        <option key={position.id} value={position.id}>
                                            {position.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="relative">
                                    <span className="absolute -top-2 left-3 bg-base-100 px-1 text-xs text-base-content/70">Tanggal Bergabung</span>
                                    <input className="input input-bordered w-full" type="date" value={createForm.join_date} onChange={(e) => updateCreateForm('join_date', e.target.value)} />
                                </div>
                                <select className="select select-bordered" value={createForm.employment_status} onChange={(e) => updateCreateForm('employment_status', e.target.value)}>
                                    <option value="permanent">Pegawai Tetap</option>
                                    <option value="contract">Pegawai Kontrak</option>
                                    <option value="intern">Pegawai Magang</option>
                                </select>
                            </div>
                        </div>

                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Role & Hak Akses</p>
                            <p className="text-xs text-base-content/70 mb-2">Role ditentukan otomatis berdasarkan departemen dan posisi. Perubahan role dilakukan oleh Admin pada halaman manajemen pengguna.</p>
                            <div className="flex flex-wrap gap-2">
                                {createForm.roles.map((roleName) => (
                                    <span key={roleName} className="badge badge-outline capitalize">
                                        {roleName}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Dokumen Pegawai</p>
                            <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
                                <div>
                                    <label className="label p-0 pb-1"><span className="label-text">Dokumen KTP (PDF/JPG/PNG)</span></label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setCreateDocuments((prev) => ({ ...prev, ktp_document: e.target.files?.[0] || null }))} />
                                </div>
                                <div>
                                    <label className="label p-0 pb-1"><span className="label-text">Dokumen Ijazah (PDF/JPG/PNG)</span></label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setCreateDocuments((prev) => ({ ...prev, diploma_document: e.target.files?.[0] || null }))} />
                                </div>
                                <div>
                                    <label className="label p-0 pb-1"><span className="label-text">Dokumen Kontrak (PDF/JPG/PNG)</span></label>
                                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setCreateDocuments((prev) => ({ ...prev, employment_contract_document: e.target.files?.[0] || null }))} />
                                </div>
                            </div>
                        </div>

                        <div className="modal-action mt-0">
                            <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} type="submit" disabled={submitting}>
                                Simpan Pegawai
                            </button>
                            <button type="button" className="btn" onClick={() => { setError(''); setShowCreateModal(false) }}>Batal</button>
                        </div>
                    </form>
                </div>
            </div>

            <input type="checkbox" id="view-employee-modal" className="modal-toggle" checked={!!viewingEmployee} onChange={() => setViewingEmployee(null)} />
            <div className="modal">
                <div className="modal-box max-w-3xl">
                    <h3 className="font-bold text-lg">Detail Data Pegawai</h3>
                    {viewingEmployee ? (
                        <div className="space-y-4 mt-4">
                            <div className="flex flex-col items-center justify-center">
                                <div className="avatar">
                                    <div className="w-24 rounded-xl ring ring-base-300 ring-offset-base-100 ring-offset-2">
                                        <img src={getEmployeePhotoUrl(viewingEmployee.photo)} alt="Foto Pegawai" />
                                    </div>
                                </div>
                                <p className="mt-2 font-semibold">{getDisplayValue(viewingEmployee.name || viewingEmployee.full_name)}</p>
                                <p className="text-xs text-base-content/70">{getDisplayValue(viewingEmployee.employee_code)}</p>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Akun Pengguna</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2 w-full">
                                    <div><span className="font-semibold">Kode:</span> {getDisplayValue(viewingEmployee.employee_code)}</div>
                                    <div><span className="font-semibold">Nama:</span> {getDisplayValue(viewingEmployee.name || viewingEmployee.full_name)}</div>
                                    <div><span className="font-semibold">Email:</span> {getDisplayValue(viewingEmployee.email)}</div>
                                    <div><span className="font-semibold">Username:</span> {getDisplayValue(viewingEmployee.username)}</div>
                                    <div><span className="font-semibold">Telepon:</span> {getDisplayValue(viewingEmployee.phone)}</div>
                                    <div><span className="font-semibold">Status Pengguna:</span> {getDisplayValue(viewingEmployee.user_status)}</div>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Data Pribadi & Administrasi</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div><span className="font-semibold">Jenis Kelamin:</span> {getDisplayValue(viewingEmployee.gender)}</div>
                                    <div><span className="font-semibold">Tempat Lahir:</span> {getDisplayValue(viewingEmployee.birth_place)}</div>
                                    <div><span className="font-semibold">Tanggal Lahir:</span> {getDisplayValue(viewingEmployee.date_of_birth ? String(viewingEmployee.date_of_birth).slice(0, 10) : '')}</div>
                                    <div><span className="font-semibold">Status Pernikahan:</span> {getDisplayValue(viewingEmployee.marital_status)}</div>
                                    <div><span className="font-semibold">Kewarganegaraan:</span> {getDisplayValue(viewingEmployee.nationality)}</div>
                                    <div><span className="font-semibold">NIK:</span> {getDisplayValue(viewingEmployee.nik)}</div>
                                    <div><span className="font-semibold">NPWP:</span> {getDisplayValue(viewingEmployee.npwp)}</div>
                                    <div><span className="font-semibold">Nomor BPJS:</span> {getDisplayValue(viewingEmployee.bpjs_number)}</div>
                                    <div><span className="font-semibold">Nomor Rekening:</span> {getDisplayValue(viewingEmployee.bank_account)}</div>
                                    <div><span className="font-semibold">Nama Pemilik Rekening:</span> {getDisplayValue(viewingEmployee.account_holder_name)}</div>
                                    <div><span className="font-semibold">Nama Bank:</span> {getDisplayValue(viewingEmployee.bank_name)}</div>
                                    <div className="md:col-span-2"><span className="font-semibold">Alamat:</span> {getDisplayValue(viewingEmployee.address)}</div>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Data Kepegawaian</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div><span className="font-semibold">Departemen:</span> {getDisplayValue(viewingEmployee.department_name)}</div>
                                    <div><span className="font-semibold">Posisi:</span> {getDisplayValue(viewingEmployee.position_name)}</div>
                                    <div><span className="font-semibold">Tanggal Bergabung:</span> {getDisplayValue(viewingEmployee.join_date ? String(viewingEmployee.join_date).slice(0, 10) : '')}</div>
                                    <div><span className="font-semibold">Status Kepegawaian:</span> {getDisplayValue(viewingEmployee.employment_status)}</div>
                                    <div><span className="font-semibold">Gaji Pokok:</span> {formatRupiah(viewingEmployee.basic_salary)}</div>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Role & Hak Akses</p>
                                <div className="flex flex-wrap gap-2">
                                    {(viewingEmployee.roles || []).length ? (viewingEmployee.roles || []).map((roleName) => (
                                        <span key={roleName} className="badge badge-outline capitalize">{roleName}</span>
                                    )) : <span className="text-xs text-base-content/70">Role tidak tersedia pada data ini</span>}
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Dokumen Pegawai</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div>
                                        <span className="font-semibold">Dokumen KTP:</span>{' '}
                                        {viewingEmployee.ktp_document ? (
                                            <a
                                                href={getDocumentUrl(viewingEmployee.ktp_document)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="link link-primary"
                                            >
                                                {getDocumentFileName(viewingEmployee.ktp_document)}
                                            </a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Ijazah:</span>{' '}
                                        {viewingEmployee.diploma_document ? (
                                            <a
                                                href={getDocumentUrl(viewingEmployee.diploma_document)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="link link-primary"
                                            >
                                                {getDocumentFileName(viewingEmployee.diploma_document)}
                                            </a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Kontrak:</span>{' '}
                                        {viewingEmployee.employment_contract_document ? (
                                            <a
                                                href={getDocumentUrl(viewingEmployee.employment_contract_document)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="link link-primary"
                                            >
                                                {getDocumentFileName(viewingEmployee.employment_contract_document)}
                                            </a>
                                        ) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setViewingEmployee(null)}>Tutup</button>
                    </div>
                </div>
            </div>

            <input type="checkbox" id="delete-employee-modal" className="modal-toggle" checked={!!deleteTarget} onChange={() => setDeleteTarget(null)} />
            <div className="modal">
                <div className="modal-box max-w-md">
                    <h3 className="font-bold text-lg text-error">Konfirmasi Hapus Pegawai</h3>
                    {deleteTarget ? (
                        <div className="mt-3 space-y-2">
                            <p>Data pegawai berikut akan dihapus permanen:</p>
                            <div className="rounded-lg border border-base-300 p-3 bg-base-200/40">
                                <p><span className="font-semibold">Kode:</span> {getDisplayValue(deleteTarget.employee_code)}</p>
                                <p><span className="font-semibold">Nama:</span> {getDisplayValue(deleteTarget.full_name || deleteTarget.name)}</p>
                                <p><span className="font-semibold">Posisi:</span> {getDisplayValue(deleteTarget.position_name)}</p>
                            </div>
                            <p className="text-sm text-error">Tindakan ini tidak dapat dibatalkan.</p>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setDeleteTarget(null)} disabled={deleting}>Batal</button>
                        <button className={`btn btn-error ${deleting ? 'loading' : ''}`} onClick={confirmDeleteEmployee} disabled={deleting}>Hapus</button>
                    </div>
                </div>
            </div>

            <input type="checkbox" id="edit-employee-modal" className="modal-toggle" checked={!!editingEmployee} onChange={() => setEditingEmployee(null)} />
            <div className="modal">
                <div className="modal-box max-w-3xl">
                    <h3 className="font-bold text-lg">Ubah Data Pegawai</h3>
                    {editingEmployee ? (
                        <div className="space-y-4 mt-4">
                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Akun Pengguna</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                                    <input className="input input-bordered" placeholder="Nama" value={editingEmployee.name || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Email" type="email" value={editingEmployee.email || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Username" value={editingEmployee.username || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, username: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Telepon" value={editingEmployee.phone || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })} />
                                    <select className="select select-bordered" value={editingEmployee.user_status || 'active'} onChange={(e) => setEditingEmployee({ ...editingEmployee, user_status: e.target.value })}>
                                        <option value="active">Pengguna Aktif</option>
                                        <option value="inactive">Pengguna Tidak Aktif</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Data Pribadi & Administrasi</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                                    <select className="select select-bordered" value={editingEmployee.gender || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, gender: e.target.value })}>
                                        <option value="">Pilih Jenis Kelamin</option>
                                        <option value="male">Laki-laki</option>
                                        <option value="female">Perempuan</option>
                                    </select>
                                    <input className="input input-bordered" placeholder="Tempat Lahir" value={editingEmployee.birth_place || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, birth_place: e.target.value })} />
                                    <div className="relative">
                                        <span className="absolute -top-2 left-3 bg-base-100 px-1 text-xs text-base-content/70">Tanggal Lahir</span>
                                        <input className="input input-bordered w-full" type="date" value={editingEmployee.date_of_birth || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, date_of_birth: e.target.value })} />
                                    </div>
                                    <select className="select select-bordered" value={editingEmployee.marital_status || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, marital_status: e.target.value })}>
                                        <option value="">Pilih Status Pernikahan</option>
                                        <option value="single">Belum Menikah</option>
                                        <option value="married">Menikah</option>
                                        <option value="divorced">Cerai</option>
                                        <option value="widowed">Janda/Duda</option>
                                    </select>
                                    <input className="input input-bordered" placeholder="Kewarganegaraan" value={editingEmployee.nationality || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, nationality: e.target.value })} />
                                    <input className="input input-bordered" placeholder="NIK" value={editingEmployee.nik || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, nik: e.target.value })} />
                                    <input className="input input-bordered" placeholder="NPWP" value={editingEmployee.npwp || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, npwp: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Nomor BPJS" value={editingEmployee.bpjs_number || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, bpjs_number: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Nomor Rekening" value={editingEmployee.bank_account || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_account: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Nama Pemilik Rekening" value={editingEmployee.account_holder_name || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, account_holder_name: e.target.value })} />
                                    <input className="input input-bordered" placeholder="Nama Bank" value={editingEmployee.bank_name || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, bank_name: e.target.value })} />
                                    <input className="input input-bordered md:col-span-2" placeholder="Alamat" value={editingEmployee.address || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, address: e.target.value })} />
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Data Kepegawaian</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                                    <select className="select select-bordered" value={editingEmployee.department_name || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, department_name: e.target.value, position_id: '', basic_salary: '' })}>
                                        <option value="">Pilih Departemen</option>
                                        {departments.map((department) => (
                                            <option key={department} value={department}>{department}</option>
                                        ))}
                                    </select>
                                    <select
                                        className="select select-bordered"
                                        value={editingEmployee.position_id || ''}
                                        onChange={(e) => {
                                            const nextPositionId = e.target.value
                                            setEditingEmployee({
                                                ...editingEmployee,
                                                position_id: nextPositionId,
                                                basic_salary: getPositionBaseSalary(nextPositionId),
                                            })
                                        }}
                                    >
                                        <option value="">Pilih Posisi</option>
                                        {editFilteredPositions.map((position) => (
                                            <option key={position.id} value={position.id}>{position.name}</option>
                                        ))}
                                    </select>
                                    <div className="relative">
                                        <span className="absolute -top-2 left-3 bg-base-100 px-1 text-xs text-base-content/70">Tanggal Bergabung</span>
                                        <input className="input input-bordered w-full" type="date" value={editingEmployee.join_date || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, join_date: e.target.value })} />
                                    </div>
                                    <select className="select select-bordered" value={editingEmployee.employment_status || 'permanent'} onChange={(e) => setEditingEmployee({ ...editingEmployee, employment_status: e.target.value })}>
                                        <option value="permanent">Tetap</option>
                                        <option value="contract">Kontrak</option>
                                        <option value="intern">Magang</option>
                                    </select>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-base-content/70">Rp.</span>
                                        <input
                                            className="input input-bordered w-full pl-12"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="Gaji Pokok"
                                            value={editingEmployee.basic_salary || ''}
                                            disabled
                                            readOnly
                                        />
                                    </div>
                                    <p className="text-xs text-base-content/70 md:col-span-2">Gaji pokok ditentukan otomatis berdasarkan posisi dan tidak dapat diubah manual.</p>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Role & Hak Akses</p>
                                <p className="text-xs text-base-content/70 mb-2">Role otomatis berubah sesuai departemen dan posisi yang dipilih (preview langsung).</p>
                                <div className="flex flex-wrap gap-2">
                                    {(liveEditRoles || []).length ? (liveEditRoles || []).map((roleName) => (
                                        <span key={roleName} className="badge badge-outline capitalize">{roleName}</span>
                                    )) : <span className="text-xs text-base-content/70">Role belum terdeteksi</span>}
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Dokumen Pegawai</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-3 mb-3">
                                    <div className="text-xs text-base-content/70">KTP saat ini: {getDocumentFileName(editingEmployee.ktp_document)}</div>
                                    <div className="text-xs text-base-content/70">Ijazah saat ini: {getDocumentFileName(editingEmployee.diploma_document)}</div>
                                    <div className="text-xs text-base-content/70">Kontrak saat ini: {getDocumentFileName(editingEmployee.employment_contract_document)}</div>
                                </div>
                                <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
                                    <div>
                                        <label className="label p-0 pb-1"><span className="label-text">Ganti Dokumen KTP</span></label>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setEditDocuments((prev) => ({ ...prev, ktp_document: e.target.files?.[0] || null }))} />
                                    </div>
                                    <div>
                                        <label className="label p-0 pb-1"><span className="label-text">Ganti Dokumen Ijazah</span></label>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setEditDocuments((prev) => ({ ...prev, diploma_document: e.target.files?.[0] || null }))} />
                                    </div>
                                    <div>
                                        <label className="label p-0 pb-1"><span className="label-text">Ganti Dokumen Kontrak</span></label>
                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="file-input file-input-bordered w-full" onChange={(e) => setEditDocuments((prev) => ({ ...prev, employment_contract_document: e.target.files?.[0] || null }))} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setEditingEmployee(null)}>Batal</button>
                        <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} onClick={handleSaveEdit} disabled={submitting}>Simpan</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default AdminEmployees
