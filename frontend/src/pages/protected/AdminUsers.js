import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../../features/common/headerSlice'
import TitleCard from '../../components/Cards/TitleCard'
import { adminApi } from '../../features/admin/api'

const MANAGER_POSITION_NAMES = [
    'operations manager',
    'marketing & sales manager',
    'finance, accounting & tax manager',
    'hr&ga manager',
    'hr & ga manager',
]

const API_ORIGIN = (process.env.REACT_APP_BASE_URL || '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')

const getDisplayValue = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    return value
}

const getDocumentFileName = (pathValue) => {
    if (!pathValue) return '-'
    return String(pathValue).split('/').pop()
}

const getAssetUrl = (pathValue) => {
    if (!pathValue) return ''
    if (/^https?:\/\//i.test(pathValue)) return pathValue
    const normalizedPath = String(pathValue).startsWith('/') ? String(pathValue) : `/${pathValue}`
    if (API_ORIGIN) return `${API_ORIGIN}${normalizedPath}`
    return `http://localhost:5000${normalizedPath}`
}

const formatRupiah = (value) => `Rp. ${Number(value || 0).toLocaleString('id-ID')}`

const normalizeText = (value = '') => String(value).toLowerCase().replace(/\s+/g, ' ').trim()

const getRawAutoRolesForEdit = (formState, allPositions) => {
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
    if (MANAGER_POSITION_NAMES.includes(normalizedPosition)) {
        autoRoles.add('atasan')
    }
    if (normalizedPosition === 'hr&ga manager' || normalizedPosition === 'hr & ga manager') {
        autoRoles.add('hr')
    }

    return Array.from(autoRoles)
}

const getEffectiveAutoRolesForEdit = (formState, allPositions) => {
    const rawAutoRoles = getRawAutoRolesForEdit(formState, allPositions)
    const excludedAutoRoles = formState.excluded_auto_roles || []
    return rawAutoRoles.filter((role) => !excludedAutoRoles.includes(role))
}

function AdminUsers() {
    const dispatch = useDispatch()
    const [users, setUsers] = useState([])
    const [employees, setEmployees] = useState([])
    const [positions, setPositions] = useState([])
    const [roles, setRoles] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [viewingUser, setViewingUser] = useState(null)

    const filteredRoles = useMemo(() => {
        const available = roles.map((item) => item.name)
        return available.filter((role) => role !== 'kandidat')
    }, [roles])

    const departments = useMemo(() => {
        const uniqueDepartments = Array.from(new Set(positions.map((position) => position.department_name).filter(Boolean)))
        return uniqueDepartments.sort((left, right) => left.localeCompare(right))
    }, [positions])

    const employeeByUserId = useMemo(() => {
        return employees.reduce((accumulator, employee) => {
            accumulator[String(employee.user_id)] = employee
            return accumulator
        }, {})
    }, [employees])

    const filteredPositionsForEdit = useMemo(() => {
        if (!editingUser?.department_name) return []
        return positions.filter((position) => position.department_name === editingUser.department_name)
    }, [positions, editingUser])

    const tableUsers = useMemo(() => {
        const activeRole = String(localStorage.getItem('activeRole') || '').toLowerCase().trim()
        const isDirector = activeRole === 'admin'

        if (!isDirector) return users

        return users.filter((user) => {
            const normalizedRoles = Array.isArray(user.roles)
                ? user.roles.map((role) => String(role).toLowerCase().trim())
                : []

            return !normalizedRoles.includes('kandidat')
        })
    }, [users])

    const loadData = async () => {
        try {
            setLoading(true)
            setError('')
            const [usersData, metaData, employeesData] = await Promise.all([
                adminApi.getUsers(),
                adminApi.getMeta(),
                adminApi.getEmployees(),
            ])
            setUsers(usersData)
            setRoles(metaData.roles || [])
            setPositions(metaData.positions || [])
            setEmployees(employeesData)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        dispatch(setPageTitle({ title: 'Manajemen Pengguna' }))
        loadData()
    }, [dispatch])

    const applyAutoRolesForEdit = (nextFormState, previousFormState) => {
        const prevState = previousFormState || nextFormState
        const prevAutoRoles = getEffectiveAutoRolesForEdit(prevState, positions)

        const rawNextAutoRoles = getRawAutoRolesForEdit(nextFormState, positions)
        const nextExcludedAutoRoles = (nextFormState.excluded_auto_roles || []).filter((role) => rawNextAutoRoles.includes(role))
        const nextAutoRoles = rawNextAutoRoles.filter((role) => !nextExcludedAutoRoles.includes(role))

        const existingRoles = nextFormState.roles || prevState.roles || []
        const manualRoles = existingRoles.filter((role) => !prevAutoRoles.includes(role))

        return {
            ...nextFormState,
            excluded_auto_roles: nextExcludedAutoRoles,
            roles: Array.from(new Set([...manualRoles, ...nextAutoRoles])),
        }
    }

    const toggleRole = (roleName) => {
        setEditingUser((prev) => {
            if (!prev) return prev

            const rawCurrentAutoRoles = getRawAutoRolesForEdit(prev, positions)
            const currentAutoRoles = getEffectiveAutoRolesForEdit(prev, positions)
            const manualRoles = (prev.roles || []).filter((role) => !currentAutoRoles.includes(role))

            const exists = manualRoles.includes(roleName)
            let updatedRoles = exists
                ? manualRoles.filter((role) => role !== roleName)
                : [...manualRoles, roleName]

            let nextExcludedAutoRoles = [...(prev.excluded_auto_roles || [])]
            if (rawCurrentAutoRoles.includes(roleName)) {
                const currentlyChecked = (prev.roles || []).includes(roleName)
                if (currentlyChecked) {
                    updatedRoles = updatedRoles.filter((role) => role !== roleName)
                    nextExcludedAutoRoles = Array.from(new Set([...nextExcludedAutoRoles, roleName]))
                } else {
                    nextExcludedAutoRoles = nextExcludedAutoRoles.filter((role) => role !== roleName)
                }
            }

            return applyAutoRolesForEdit({ ...prev, roles: updatedRoles, excluded_auto_roles: nextExcludedAutoRoles }, prev)
        })
    }

    const openEditUser = (user) => {
        const employee = employeeByUserId[String(user.id)]
        const initialEditState = {
            ...user,
            photo: user.photo || employee?.photo || '',
            roles: user.roles || [],
            excluded_auto_roles: [],
            employee_id: employee?.id || null,
            department_name: employee?.department_name || '',
            position_id: employee?.position_id ? String(employee.position_id) : '',
        }
        setEditingUser(applyAutoRolesForEdit(initialEditState, initialEditState))
    }

    const openViewUser = async (user) => {
        const employee = employeeByUserId[String(user.id)]

        const baseView = {
            ...user,
            employee,
            detail: employee || null,
            user_status: user.status,
        }
        setViewingUser(baseView)

        if (!employee?.id) return

        try {
            const detail = await adminApi.getEmployeeById(employee.id)
            setViewingUser((prev) => {
                if (!prev || prev.id !== user.id) return prev
                return {
                    ...prev,
                    detail: { ...prev.detail, ...detail },
                }
            })
        } catch (err) {
            setError(err.message)
        }
    }

    const handleSaveEdit = async () => {
        if (!editingUser) return

        try {
            setSubmitting(true)
            setError('')
            await adminApi.updateUser(editingUser.id, {
                status: editingUser.status,
                roles: editingUser.roles,
            })

            if (editingUser.employee_id && editingUser.position_id) {
                await adminApi.updateEmployee(editingUser.employee_id, {
                    position_id: Number(editingUser.position_id),
                })
            }

            setEditingUser(null)
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

            <TitleCard title="Data Pengguna" topMargin="mt-0">
                {loading ? (
                    <div>Memuat data pengguna...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra">
                            <thead className="text-center [&_th]:py-3">
                                <tr>
                                    <th>Nama</th>
                                    <th>Departemen</th>
                                    <th>Posisi</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableUsers.map((user) => {
                                    const linkedEmployee = employeeByUserId[String(user.id)]

                                    return (
                                        <tr key={user.id}>
                                            <td>{user.name}</td>
                                            <td>{linkedEmployee?.department_name || '-'}</td>
                                            <td>{linkedEmployee?.position_name || '-'}</td>
                                            <td>{(user.roles || []).join(', ')}</td>
                                            <td><span className="badge">{user.status}</span></td>
                                            <td>
                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                    <button className="btn btn-xs btn-outline btn-info" onClick={() => openViewUser(user)}>View</button>
                                                    <button className="btn btn-xs" onClick={() => openEditUser(user)}>Edit</button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </TitleCard>

            <input type="checkbox" id="edit-user-modal" className="modal-toggle" checked={!!editingUser} onChange={() => setEditingUser(null)} />
            <div className="modal">
                <div className="modal-box max-w-3xl">
                    <h3 className="font-bold text-lg">Ubah Role & Status Pengguna</h3>
                    {editingUser ? (
                        <div className="mt-4 space-y-4">
                            <div className="flex flex-col items-center justify-center">
                                <div className="avatar">
                                    <div className="w-24 rounded-xl ring ring-base-300 ring-offset-base-100 ring-offset-2">
                                        <img src={getAssetUrl(editingUser.photo) || 'https://placeimg.com/120/120/people'} alt="Foto Pengguna" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
                            <div><span className="font-semibold">Nama:</span> {editingUser.name}</div>
                            <div><span className="font-semibold">Username:</span> {editingUser.username}</div>
                            <div><span className="font-semibold">Email:</span> {editingUser.email}</div>
                            <div>
                                <label className="label p-0 pb-1"><span className="label-text font-semibold">Departemen</span></label>
                                <select
                                    className="select select-bordered w-full"
                                    value={editingUser.department_name || ''}
                                    onChange={(e) => {
                                        setEditingUser((prev) => {
                                            if (!prev) return prev
                                            return applyAutoRolesForEdit({ ...prev, department_name: e.target.value, position_id: '' }, prev)
                                        })
                                    }}
                                >
                                    <option value="">Pilih Departemen</option>
                                    {departments.map((department) => (
                                        <option key={department} value={department}>{department}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label p-0 pb-1"><span className="label-text font-semibold">Posisi</span></label>
                                <select
                                    className="select select-bordered w-full"
                                    value={editingUser.position_id || ''}
                                    onChange={(e) => {
                                        setEditingUser((prev) => {
                                            if (!prev) return prev
                                            return applyAutoRolesForEdit({ ...prev, position_id: e.target.value }, prev)
                                        })
                                    }}
                                >
                                    <option value="">Pilih Posisi</option>
                                    {filteredPositionsForEdit.map((position) => (
                                        <option key={position.id} value={position.id}>{position.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label p-0 pb-1"><span className="label-text font-semibold">Status</span></label>
                                <select className="select select-bordered w-full" value={editingUser.status || 'active'} onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}>
                                    <option value="active">Aktif</option>
                                    <option value="inactive">Tidak Aktif</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <p className="font-medium mb-2">Hak Akses Role</p>
                                <div className="flex flex-wrap gap-4">
                                    {filteredRoles.map((roleName) => (
                                        <label key={roleName} className="label cursor-pointer gap-2">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-primary checkbox-sm"
                                                checked={(editingUser.roles || []).includes(roleName)}
                                                onChange={() => toggleRole(roleName)}
                                            />
                                            <span className="label-text capitalize">{roleName}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setEditingUser(null)}>Batal</button>
                        <button className={`btn btn-primary ${submitting ? 'loading' : ''}`} onClick={handleSaveEdit} disabled={submitting}>Simpan</button>
                    </div>
                </div>
            </div>

            <input type="checkbox" id="view-user-modal" className="modal-toggle" checked={!!viewingUser} onChange={() => setViewingUser(null)} />
            <div className="modal">
                <div className="modal-box max-w-3xl">
                    <h3 className="font-bold text-lg">Detail Pengguna & Pegawai</h3>
                    {viewingUser ? (
                        <div className="space-y-4 mt-4">
                            <div className="flex flex-col items-center justify-center">
                                <div className="avatar">
                                    <div className="w-24 rounded-xl ring ring-base-300 ring-offset-base-100 ring-offset-2">
                                        <img src={getAssetUrl(viewingUser?.detail?.photo) || 'https://placeimg.com/120/120/people'} alt="Foto Pegawai" />
                                    </div>
                                </div>
                                <p className="mt-2 font-semibold">{getDisplayValue(viewingUser.name)}</p>
                                <p className="text-xs text-base-content/70">{getDisplayValue(viewingUser?.detail?.employee_code)}</p>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Akun Pengguna</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div><span className="font-semibold">Nama:</span> {getDisplayValue(viewingUser.name)}</div>
                                    <div><span className="font-semibold">Username:</span> {getDisplayValue(viewingUser.username)}</div>
                                    <div><span className="font-semibold">Email:</span> {getDisplayValue(viewingUser.email)}</div>
                                    <div><span className="font-semibold">Status:</span> {getDisplayValue(viewingUser.status)}</div>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Data Kepegawaian</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div><span className="font-semibold">Departemen:</span> {getDisplayValue(viewingUser?.detail?.department_name)}</div>
                                    <div><span className="font-semibold">Posisi:</span> {getDisplayValue(viewingUser?.detail?.position_name)}</div>
                                    <div><span className="font-semibold">Tanggal Bergabung:</span> {getDisplayValue(viewingUser?.detail?.join_date ? String(viewingUser.detail.join_date).slice(0, 10) : '')}</div>
                                    <div><span className="font-semibold">Status Kepegawaian:</span> {getDisplayValue(viewingUser?.detail?.employment_status)}</div>
                                    <div><span className="font-semibold">Gaji Pokok:</span> {formatRupiah(viewingUser?.detail?.basic_salary)}</div>
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Role & Hak Akses</p>
                                <div className="flex flex-wrap gap-2">
                                    {(viewingUser.roles || []).length ? (viewingUser.roles || []).map((roleName) => (
                                        <span key={roleName} className="badge badge-outline capitalize">{roleName}</span>
                                    )) : <span className="text-xs text-base-content/70">Role tidak tersedia</span>}
                                </div>
                            </div>

                            <div className="border border-base-300 rounded-lg p-4">
                                <p className="font-semibold mb-3">Dokumen Pegawai</p>
                                <div className="grid md:grid-cols-2 grid-cols-1 gap-2">
                                    <div>
                                        <span className="font-semibold">Dokumen KTP:</span>{' '}
                                        {viewingUser?.detail?.ktp_document ? (
                                            <a href={getAssetUrl(viewingUser.detail.ktp_document)} target="_blank" rel="noreferrer" className="link link-primary">{getDocumentFileName(viewingUser.detail.ktp_document)}</a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Ijazah:</span>{' '}
                                        {viewingUser?.detail?.diploma_document ? (
                                            <a href={getAssetUrl(viewingUser.detail.diploma_document)} target="_blank" rel="noreferrer" className="link link-primary">{getDocumentFileName(viewingUser.detail.diploma_document)}</a>
                                        ) : '-'}
                                    </div>
                                    <div>
                                        <span className="font-semibold">Dokumen Kontrak:</span>{' '}
                                        {viewingUser?.detail?.employment_contract_document ? (
                                            <a href={getAssetUrl(viewingUser.detail.employment_contract_document)} target="_blank" rel="noreferrer" className="link link-primary">{getDocumentFileName(viewingUser.detail.employment_contract_document)}</a>
                                        ) : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                    <div className="modal-action">
                        <button className="btn" onClick={() => setViewingUser(null)}>Tutup</button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default AdminUsers
