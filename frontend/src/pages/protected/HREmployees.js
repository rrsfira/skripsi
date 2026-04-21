import { useEffect, useMemo, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle, showNotification } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { hrApi } from '../../features/hr/api'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const MANAGER_POSITION_NAMES = [
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

const getRawAutoRolesForForm = (formState, allPositions) => {
    const autoRoles = new Set(['pegawai'])

    const normalizedDepartment = normalizeText(formState.department_name)
    if (normalizedDepartment.includes('management')) autoRoles.add('admin')
    if (normalizedDepartment.startsWith('hr')) autoRoles.add('hr')
    if (normalizedDepartment.includes('finance')) autoRoles.add('finance')

    const selectedPosition = allPositions.find((position) => String(position.id) === String(formState.position_id))
    const normalizedPosition = normalizeText(selectedPosition?.name)
    if (MANAGER_POSITION_NAMES.includes(normalizedPosition)) autoRoles.add('atasan')
    if (normalizedPosition === 'hr&ga manager' || normalizedPosition === 'hr & ga manager') autoRoles.add('hr')

    return Array.from(autoRoles)
}

const INITIAL_FORM = {
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    roles: ['pegawai'],
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

const getStatusBadge = (status) => {
    const statusConfig = {
        active: 'badge-success',
        inactive: 'badge-error',
        suspended: 'badge-warning',
    }
    return `badge ${statusConfig[status] || 'badge-ghost'}`
}

const getEmploymentStatusBadge = (status) => {
    const statusConfig = {
        permanent: 'badge-primary',
        contract: 'badge-info',
        intern: 'badge-secondary',
    }
    return `badge ${statusConfig[status] || 'badge-ghost'}`
}

const buildEmployeeSearchOptions = (items = []) => {
    const map = new Map()

    items.forEach((item) => {
        const employeeName = String(item?.full_name || item?.name || '').trim()
        const employeeCode = String(item?.employee_code || '').trim()
        if (!employeeName) return

        const key = employeeCode || employeeName
        if (!map.has(key)) {
            map.set(key, {
                code: employeeCode,
                label: employeeCode ? `${employeeName} (${employeeCode})` : employeeName,
            })
        }
    })

    return Array.from(map.values())
        .sort((a, b) => {
            const codeA = String(a.code || '').trim()
            const codeB = String(b.code || '').trim()

            if (codeA && codeB) {
                return codeA.localeCompare(codeB, 'id', { numeric: true, sensitivity: 'base' })
            }

            if (codeA && !codeB) return -1
            if (!codeA && codeB) return 1

            return a.label.localeCompare(b.label, 'id', { sensitivity: 'base' })
        })
        .map((entry) => entry.label)
}

function HREmployees() {
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [employees, setEmployees] = useState([])
    const [positions, setPositions] = useState([])
    const [employeeSearchOptions, setEmployeeSearchOptions] = useState([])
    const [employeeSearchInput, setEmployeeSearchInput] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const [showCreateModal, setShowCreateModal] = useState(false)
    const [createForm, setCreateForm] = useState(INITIAL_FORM)
    const [createDocuments, setCreateDocuments] = useState(INITIAL_DOCUMENTS)

    const [editingEmployee, setEditingEmployee] = useState(null)
    const [editDocuments, setEditDocuments] = useState(INITIAL_DOCUMENTS)

    const [viewingEmployee, setViewingEmployee] = useState(null)
    const [deleteTarget, setDeleteTarget] = useState(null)

    const [filters, setFilters] = useState({
        search: '',
        department: '',
        position: '',
        employment_status: '',
        status: 'active',
    })

    const buildReferencePositions = (sourceData = []) => {
        const uniquePositions = []
        const seen = new Set()

        sourceData.forEach((item) => {
            const key = String(item.position_id || '')
            if (!key || seen.has(key)) return
            seen.add(key)
            uniquePositions.push({
                id: key,
                name: item.position_name || '-',
                department_name: item.department_name || '',
                base_salary: item.base_salary || 0,
            })
        })

        uniquePositions.sort((a, b) => a.name.localeCompare(b.name))
        return uniquePositions
    }

    const loadEmployees = useCallback(async () => {
        try {
            setLoading(true)
            const result = await hrApi.getEmployees(filters)
            setEmployees(result.data || [])
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setLoading(false)
        }
    }, [filters, dispatch])

    const loadReferenceData = useCallback(async () => {
        try {
            const meta = await hrApi.getMeta()
            const metaPositions = (meta?.positions || []).map((position) => ({
                id: String(position.id),
                name: position.name || '-',
                department_name: position.department_name || '',
                base_salary: position.base_salary || 0,
            }))

            if (metaPositions.length > 0) {
                setPositions(metaPositions.sort((a, b) => a.name.localeCompare(b.name)))
                return
            }

            const result = await hrApi.getEmployees({
                search: '',
                department: '',
                position: '',
                employment_status: '',
                status: '',
            })
            setPositions(buildReferencePositions(result.data || []))
        } catch (err) {
            try {
                const result = await hrApi.getEmployees({
                    search: '',
                    department: '',
                    position: '',
                    employment_status: '',
                    status: '',
                })
                setPositions(buildReferencePositions(result.data || []))
            } catch (fallbackErr) {
                dispatch(showNotification({ message: fallbackErr.message, status: 0 }))
            }
        }
    }, [dispatch])

    const loadEmployeeSearchOptions = useCallback(async () => {
        try {
            const result = await hrApi.getEmployees({
                search: '',
                department: '',
                position: '',
                employment_status: '',
                status: '',
            })
            setEmployeeSearchOptions(buildEmployeeSearchOptions(result.data || []))
        } catch (err) {
            setEmployeeSearchOptions([])
        }
    }, [])

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Kelola Data Pegawai' }))
    }, [dispatch])

    useEffect(() => {
        loadEmployees()
    }, [loadEmployees])

    useEffect(() => {
        loadReferenceData()
    }, [loadReferenceData])

    useEffect(() => {
        loadEmployeeSearchOptions()
    }, [loadEmployeeSearchOptions])

    const departments = useMemo(() => {
        const unique = Array.from(new Set(positions.map((item) => item.department_name).filter(Boolean)))
        return unique.sort((a, b) => a.localeCompare(b))
    }, [positions])

    const filteredEmployees = useMemo(() => {
        const query = String(filters.search || '').trim().toLowerCase()

        return employees.filter((employee) => {
            const employeeName = String(employee.full_name || employee.name || '').toLowerCase()
            const employeeCode = String(employee.employee_code || '').toLowerCase()
            const employeeEmail = String(employee.email || '').toLowerCase()

            const searchMatch = !query
                || employeeName.includes(query)
                || employeeCode.includes(query)
                || employeeEmail.includes(query)

            const departmentMatch = !filters.department
                || String(employee.department_name || '') === String(filters.department)

            const positionMatch = !filters.position
                || String(employee.position_id || '') === String(filters.position)

            const employmentStatusMatch = !filters.employment_status
                || String(employee.employment_status || '') === String(filters.employment_status)

            const statusMatch = !filters.status
                || String(employee.status || '') === String(filters.status)

            return searchMatch && departmentMatch && positionMatch && employmentStatusMatch && statusMatch
        })
    }, [employees, filters])

    const filteredPositions = useMemo(() => {
        if (!createForm.department_name) return positions
        const normalizedDepartment = normalizeText(createForm.department_name)
        return positions.filter((position) => normalizeText(position.department_name) === normalizedDepartment)
    }, [positions, createForm.department_name])

    const editFilteredPositions = useMemo(() => {
        if (!editingEmployee?.department_name) return positions
        const normalizedDepartment = normalizeText(editingEmployee.department_name)
        return positions.filter((position) => normalizeText(position.department_name) === normalizedDepartment)
    }, [positions, editingEmployee])

    const liveEditRoles = useMemo(() => {
        if (!editingEmployee) return []
        return getRawAutoRolesForForm(
            {
                department_name: editingEmployee.department_name,
                position_id: editingEmployee.position_id,
            },
            positions,
        )
    }, [editingEmployee, positions])

    const getPositionBaseSalary = (positionId) => {
        const selectedPosition = positions.find((position) => String(position.id) === String(positionId))
        return selectedPosition?.base_salary || ''
    }

    const getDisplayValue = (value) => {
        if (value === null || value === undefined || value === '') return '-'
        return value
    }

    const getDocumentFileName = (pathValue) => {
        if (!pathValue) return '-'
        return String(pathValue).split('/').pop()
    }

    const hasSelectedDocuments = (documents) => {
        return Boolean(documents.ktp_document || documents.diploma_document || documents.employment_contract_document)
    }

    const updateCreateForm = (field, value) => {
        setCreateForm((prev) => {
            const next = { ...prev, [field]: value }
            return {
                ...next,
                roles: getRawAutoRolesForForm(next, positions),
            }
        })
    }

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }))
    }

    const handleEmployeeSearchChange = (value) => {
        const parsed = String(value || '').trim()
        const match = parsed.match(/^(.*)\(([^)]+)\)\s*$/)
        const normalizedSearch = match ? String(match[2] || '').trim() : parsed

        setEmployeeSearchInput(value)
        handleFilterChange('search', normalizedSearch)
    }

    const mapEmployeeToForm = (employee) => {
        const currentPositionId = employee.position_id ? String(employee.position_id) : ''
        const currentPosition = positions.find((position) => String(position.id) === currentPositionId)

        return {
        ...employee,
        name: employee.full_name || employee.name || '',
        email: employee.email || '',
        username: employee.username || '',
        phone: employee.phone || '',
        photo: employee.photo || '',
        gender: employee.gender || '',
        birth_place: employee.birth_place || '',
        date_of_birth: employee.date_of_birth ? String(employee.date_of_birth).slice(0, 10) : '',
        marital_status: employee.marital_status || '',
        nationality: employee.nationality || 'Indonesian',
        address: employee.address || '',
        nik: employee.nik || '',
        npwp: employee.npwp || '',
        bpjs_number: employee.bpjs_number || '',
        bank_account: employee.bank_account || '',
        account_holder_name: employee.account_holder_name || '',
        bank_name: employee.bank_name || '',
        department_name: employee.department_name || currentPosition?.department_name || '',
        position_id: currentPositionId,
        join_date: employee.join_date ? String(employee.join_date).slice(0, 10) : '',
        user_status: employee.status || 'active',
        employment_status: employee.employment_status || 'permanent',
        roles: getRawAutoRolesForForm({
            department_name: employee.department_name || currentPosition?.department_name || '',
            position_id: currentPositionId,
        }, positions),
        }
    }

    const openCreateModal = () => {
        setCreateForm({
            ...INITIAL_FORM,
            roles: getRawAutoRolesForForm(INITIAL_FORM, positions),
        })
        setCreateDocuments(INITIAL_DOCUMENTS)
        setShowCreateModal(true)
    }

    const openEditModal = async (employee) => {
        setEditDocuments(INITIAL_DOCUMENTS)
        const detail = await hrApi.getEmployeeDetails(employee.id)
        const mapped = mapEmployeeToForm(detail || employee)
        setEditingEmployee(mapped)
    }

    const openViewModal = async (employee) => {
        const detail = await hrApi.getEmployeeDetails(employee.id)
        setViewingEmployee(mapEmployeeToForm(detail || employee))
    }

    const handleCreateEmployee = async (event) => {
        event.preventDefault()

        if (!createForm.name || !createForm.email || !createForm.username || !createForm.password) {
            dispatch(showNotification({ message: 'Nama, email, username, dan password wajib diisi', status: 0 }))
            return
        }

        if (!createForm.position_id || !createForm.join_date) {
            dispatch(showNotification({ message: 'Posisi dan tanggal bergabung wajib diisi', status: 0 }))
            return
        }

        try {
            setSubmitting(true)
            const createdStaff = await hrApi.createEmployee({
                name: createForm.name,
                full_name: createForm.name,
                email: createForm.email,
                username: createForm.username,
                password: createForm.password,
                phone: createForm.phone || undefined,
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
                const formData = new FormData()
                if (createDocuments.ktp_document) formData.append('ktp_document', createDocuments.ktp_document)
                if (createDocuments.diploma_document) formData.append('diploma_document', createDocuments.diploma_document)
                if (createDocuments.employment_contract_document) formData.append('employment_contract_document', createDocuments.employment_contract_document)
                await hrApi.updateEmployee(createdStaff.employee_id, formData)
            }

            dispatch(showNotification({ message: 'Pegawai berhasil ditambahkan', status: 1 }))
            setShowCreateModal(false)
            setCreateForm(INITIAL_FORM)
            setCreateDocuments(INITIAL_DOCUMENTS)
            await loadEmployees()
            await loadEmployeeSearchOptions()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setSubmitting(false)
        }
    }

    const handleSaveEdit = async () => {
        if (!editingEmployee?.id) return

        try {
            setSubmitting(true)

            const hasNewDocument = hasSelectedDocuments(editDocuments)
            if (hasNewDocument) {
                const formData = new FormData()
                formData.append('full_name', editingEmployee.name || '')
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

                if (editDocuments.ktp_document) formData.append('ktp_document', editDocuments.ktp_document)
                if (editDocuments.diploma_document) formData.append('diploma_document', editDocuments.diploma_document)
                if (editDocuments.employment_contract_document) formData.append('employment_contract_document', editDocuments.employment_contract_document)

                await hrApi.updateEmployee(editingEmployee.id, formData)
            } else {
                await hrApi.updateEmployee(editingEmployee.id, {
                    full_name: editingEmployee.name,
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

            dispatch(showNotification({ message: 'Data pegawai berhasil diperbarui', status: 1 }))
            setEditingEmployee(null)
            setEditDocuments(INITIAL_DOCUMENTS)
            await loadEmployees()
            await loadEmployeeSearchOptions()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setSubmitting(false)
        }
    }

    const confirmDeleteEmployee = async () => {
        if (!deleteTarget?.id) return

        try {
            setSubmitting(true)
            await hrApi.deleteEmployee(deleteTarget.id)
            dispatch(showNotification({ message: 'Pegawai berhasil dihapus', status: 1 }))
            setDeleteTarget(null)
            await loadEmployees()
            await loadEmployeeSearchOptions()
        } catch (err) {
            dispatch(showNotification({ message: err.message, status: 0 }))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <TitleCard
                title="Kelola Data Pegawai"
                topMargin="mt-2"
                TopSideButtons={<button className="btn btn-primary btn-sm" onClick={openCreateModal}>Tambah Pegawai</button>}
            >
                <div className="grid lg:grid-cols-5 md:grid-cols-3 grid-cols-1 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label"><span className="label-text">Cari Pegawai</span></label>
                        <div className="relative">
                            <input
                                type="search"
                                list="hr-employees-search-options"
                                placeholder="Nama/NIP/Email..."
                                className="input input-bordered w-full pr-10"
                                value={employeeSearchInput}
                                onChange={(e) => handleEmployeeSearchChange(e.target.value)}
                            />
                            <datalist id="hr-employees-search-options">
                                {employeeSearchOptions.map((option) => (
                                    <option key={option} value={option} />
                                ))}
                            </datalist>
                            <MagnifyingGlassIcon className="w-5 h-5 absolute right-3 top-3 text-gray-400" />
                        </div>
                    </div>

                    <div className="form-control">
                        <label className="label"><span className="label-text">Departemen</span></label>
                        <select className="select select-bordered" value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)}>
                            <option value="">Semua Departemen</option>
                            {departments.map((department) => (
                                <option key={department} value={department}>{department}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label"><span className="label-text">Jabatan</span></label>
                        <select className="select select-bordered" value={filters.position} onChange={(e) => handleFilterChange('position', e.target.value)}>
                            <option value="">Semua Jabatan</option>
                            {positions.map((position) => (
                                <option key={position.id} value={position.id}>{position.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label"><span className="label-text">Status Kepegawaian</span></label>
                        <select className="select select-bordered" value={filters.employment_status} onChange={(e) => handleFilterChange('employment_status', e.target.value)}>
                            <option value="">Semua</option>
                            <option value="permanent">Tetap</option>
                            <option value="contract">Kontrak</option>
                            <option value="intern">Magang</option>
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label"><span className="label-text">Status Aktif</span></label>
                        <select className="select select-bordered" value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                            <option value="">Semua</option>
                            <option value="active">Aktif</option>
                            <option value="inactive">Tidak Aktif</option>
                            <option value="suspended">Ditangguhkan</option>
                        </select>
                    </div>
                </div>

                <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4 mb-6">
                    <div className="stat bg-primary text-primary-content rounded-lg">
                        <div className="stat-title text-primary-content">Pegawai Tetap</div>
                        <div className="stat-value text-2xl">{employees.filter((e) => e.employment_status === 'permanent').length}</div>
                    </div>
                    <div className="stat bg-info text-info-content rounded-lg">
                        <div className="stat-title text-info-content">Pegawai Kontrak</div>
                        <div className="stat-value text-2xl">{employees.filter((e) => e.employment_status === 'contract').length}</div>
                    </div>
                    <div className="stat bg-secondary text-secondary-content rounded-lg">
                        <div className="stat-title text-secondary-content">Magang</div>
                        <div className="stat-value text-2xl">{employees.filter((e) => e.employment_status === 'intern').length}</div>
                    </div>
                    <div className="stat bg-success text-success-content rounded-lg">
                        <div className="stat-title text-success-content">Total Aktif</div>
                        <div className="stat-value text-2xl">{employees.filter((e) => e.status === 'active').length}</div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10">Memuat data...</div>
                ) : filteredEmployees.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>NIP</th>
                                    <th>Nama</th>
                                    <th>Email</th>
                                    <th>Departemen</th>
                                    <th>Jabatan</th>
                                    <th>Status Kepegawaian</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((employee) => (
                                    <tr key={employee.id}>
                                        <td className="font-mono font-semibold">{employee.employee_code}</td>
                                        <td>
                                            <div className="font-bold">{employee.full_name || employee.name}</div>
                                            <div className="text-sm opacity-50">{employee.phone || '-'}</div>
                                        </td>
                                        <td className="text-sm">{employee.email}</td>
                                        <td>{employee.department_name || '-'}</td>
                                        <td>
                                            <div>{employee.position_name || '-'}</div>
                                            {employee.level ? <div className="text-xs text-gray-500">{employee.level}</div> : null}
                                        </td>
                                        <td><span className={getEmploymentStatusBadge(employee.employment_status)}>{employee.employment_status}</span></td>
                                        <td><span className={getStatusBadge(employee.status)}>{employee.status}</span></td>
                                        <td>
                                            <div className="flex items-center gap-3 whitespace-nowrap">
                                                <button className="link link-info text-xs" onClick={() => openViewModal(employee)}>Lihat</button>
                                                <button className="link link-primary text-xs" onClick={() => openEditModal(employee)}>Edit</button>
                                                <button className="link link-error text-xs" onClick={() => setDeleteTarget(employee)} disabled={submitting}>Hapus</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-gray-500">Tidak ada data pegawai</div>
                )}
            </TitleCard>

            <input
                type="checkbox"
                id="create-employee-modal-hr"
                className="modal-toggle"
                checked={showCreateModal}
                onChange={() => setShowCreateModal(false)}
            />
            <div className="modal">
                <div className="modal-box max-w-6xl">
                    <h3 className="font-bold text-lg">Tambah Pegawai</h3>
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
                                <input className="input input-bordered" type="date" value={createForm.date_of_birth} onChange={(e) => updateCreateForm('date_of_birth', e.target.value)} />
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
                                        setCreateForm((prev) => {
                                            const next = {
                                                ...prev,
                                                department_name: e.target.value,
                                                position_id: '',
                                            }
                                            return {
                                                ...next,
                                                roles: getRawAutoRolesForForm(next, positions),
                                            }
                                        })
                                    }}
                                >
                                    <option value="">Pilih Departemen</option>
                                    {departments.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                                <select className="select select-bordered" value={createForm.position_id} onChange={(e) => updateCreateForm('position_id', e.target.value)}>
                                    <option value="">Pilih Posisi</option>
                                    {filteredPositions.map((position) => (
                                        <option key={position.id} value={position.id}>{position.name}</option>
                                    ))}
                                </select>
                                <input className="input input-bordered" type="date" value={createForm.join_date} onChange={(e) => updateCreateForm('join_date', e.target.value)} />
                                <select className="select select-bordered" value={createForm.employment_status} onChange={(e) => updateCreateForm('employment_status', e.target.value)}>
                                    <option value="permanent">Pegawai Tetap</option>
                                    <option value="contract">Pegawai Kontrak</option>
                                    <option value="intern">Pegawai Magang</option>
                                </select>
                            </div>
                        </div>

                        <div className="border border-base-300 rounded-lg p-4">
                            <p className="font-semibold mb-3">Role & Hak Akses</p>
                            <p className="text-xs text-base-content/70 mb-2">Role ditentukan otomatis berdasarkan departemen dan posisi.</p>
                            <div className="flex flex-wrap gap-2">
                                {createForm.roles.map((roleName) => (
                                    <span key={roleName} className="badge badge-outline capitalize">{roleName}</span>
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
                            <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} type="submit" disabled={submitting}>Simpan Pegawai</button>
                            <button type="button" className="btn" onClick={() => setShowCreateModal(false)}>Batal</button>
                        </div>
                    </form>
                </div>
            </div>

            <input type="checkbox" id="view-employee-modal-hr" className="modal-toggle" checked={!!viewingEmployee} onChange={() => setViewingEmployee(null)} />
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
                                    <div><span className="font-semibold">Status Pengguna:</span> {getDisplayValue(viewingEmployee.user_status || viewingEmployee.status)}</div>
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
                                            <a href={getDocumentUrl(viewingEmployee.ktp_document)} target="_blank" rel="noreferrer" className="link link-primary">
                                                {getDocumentFileName(viewingEmployee.ktp_document)}
                                            </a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Ijazah:</span>{' '}
                                        {viewingEmployee.diploma_document ? (
                                            <a href={getDocumentUrl(viewingEmployee.diploma_document)} target="_blank" rel="noreferrer" className="link link-primary">
                                                {getDocumentFileName(viewingEmployee.diploma_document)}
                                            </a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Kontrak:</span>{' '}
                                        {viewingEmployee.employment_contract_document ? (
                                            <a href={getDocumentUrl(viewingEmployee.employment_contract_document)} target="_blank" rel="noreferrer" className="link link-primary">
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

            <input type="checkbox" id="delete-employee-modal-hr" className="modal-toggle" checked={!!deleteTarget} onChange={() => setDeleteTarget(null)} />
            <div className="modal">
                <div className="modal-box max-w-md">
                    <h3 className="font-bold text-lg text-error">Konfirmasi Hapus Pegawai</h3>
                    {deleteTarget ? (
                        <div className="mt-3 space-y-2">
                            <p>Data pegawai berikut akan dihapus permanen:</p>
                            <div className="rounded-lg border border-base-300 p-3 bg-base-200/40">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="avatar">
                                        <div className="w-14 rounded-lg">
                                            <img src={getEmployeePhotoUrl(deleteTarget.photo)} alt="Foto Pegawai" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold">{getDisplayValue(deleteTarget.full_name || deleteTarget.name)}</p>
                                        <p className="text-xs opacity-70">{getDisplayValue(deleteTarget.employee_code)}</p>
                                    </div>
                                </div>
                                <p><span className="font-semibold">Kode:</span> {getDisplayValue(deleteTarget.employee_code)}</p>
                                <p><span className="font-semibold">Nama:</span> {getDisplayValue(deleteTarget.full_name || deleteTarget.name)}</p>
                                <p><span className="font-semibold">Departemen:</span> {getDisplayValue(deleteTarget.department_name)}</p>
                                <p><span className="font-semibold">Posisi:</span> {getDisplayValue(deleteTarget.position_name)}</p>
                            </div>
                            <p className="text-sm text-error">Tindakan ini tidak dapat dibatalkan.</p>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setDeleteTarget(null)} disabled={submitting}>Batal</button>
                        <button className={`btn btn-error ${submitting ? 'loading' : ''}`} onClick={confirmDeleteEmployee} disabled={submitting}>Hapus</button>
                    </div>
                </div>
            </div>

            <input type="checkbox" id="edit-employee-modal-hr" className="modal-toggle" checked={!!editingEmployee} onChange={() => setEditingEmployee(null)} />
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
                                    <input className="input input-bordered" type="date" value={editingEmployee.date_of_birth || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, date_of_birth: e.target.value })} />
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
                                    <input className="input input-bordered" type="date" value={editingEmployee.join_date || ''} onChange={(e) => setEditingEmployee({ ...editingEmployee, join_date: e.target.value })} />
                                    <select className="select select-bordered" value={editingEmployee.employment_status || 'permanent'} onChange={(e) => setEditingEmployee({ ...editingEmployee, employment_status: e.target.value })}>
                                        <option value="permanent">Tetap</option>
                                        <option value="contract">Kontrak</option>
                                        <option value="intern">Magang</option>
                                    </select>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-base-content/70">Rp.</span>
                                        <input className="input input-bordered w-full pl-12" type="text" value={editingEmployee.basic_salary || ''} disabled readOnly />
                                    </div>
                                    <p className="text-xs text-base-content/70 md:col-span-2">Gaji pokok ditentukan otomatis berdasarkan posisi.</p>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Role & Hak Akses</p>
                                <p className="text-xs text-base-content/70 mb-2">Preview role otomatis dari departemen dan posisi.</p>
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

export default HREmployees
