import { useCallback, useEffect, useState } from "react"
import { useDispatch } from "react-redux"
import axios from "axios"
import TitleCard from "../../../components/Cards/TitleCard"
import { showNotification } from '../../common/headerSlice'
import { pegawaiApi } from '../../pegawai/api'

const INITIAL_PROFILE_FORM = {
    user_id: '',
    name: '',
    email: '',
    phone: '',
    username: '',
    status: '',
    user_updated_at: '',
    employee_id: '',
    user_ref_id: '',
    gender: '',
    birth_place: '',
    date_of_birth: '',
    marital_status: '',
    nationality: '',
    address: '',
    nik: '',
    npwp: '',
    bank_account: '',
    account_holder_name: '',
    bank_name: '',
    bpjs_number: '',
    employee_code: '',
    ktp_document: '',
    diploma_document: '',
    employment_contract_document: '',
    position_id: '',
    position_name: '',
    department_name: '',
    level: '',
    join_date: '',
    basic_salary: '',
    employment_status: '',
    working_hours_id: '',
    annual_leave_quota: '',
    remaining_leave_quota: '',
    quota_reset_date: '',
    employee_created_at: '',
    employee_updated_at: '',
    user_created_at: '',
}

const INITIAL_PASSWORD_FORM = {
    oldPassword: '',
    newPassword: '',
}

function ProfileSettings(){
    const dispatch = useDispatch()
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [error, setError] = useState('')
    const [profileForm, setProfileForm] = useState(INITIAL_PROFILE_FORM)
    const [photoFile, setPhotoFile] = useState(null)
    const [ktpDocumentFile, setKtpDocumentFile] = useState(null)
    const [diplomaDocumentFile, setDiplomaDocumentFile] = useState(null)
    const [currentPhotoPath, setCurrentPhotoPath] = useState('')
    const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM)

    const formatDateForInput = (value) => (value ? String(value).slice(0, 10) : '')
    const getFileUrl = (filePath) => {
        if (!filePath) return ''
        if (/^https?:\/\//i.test(filePath)) return filePath
        const baseUrl = (process.env.REACT_APP_BASE_URL || 'http://localhost:5000').replace(/\/$/, '')
        const normalizedPath = String(filePath).replace(/^\/+/, '')
        return `${baseUrl}/${normalizedPath}`
    }
    const formatMataUangIDR = (value) => {
        const angka = Number(value || 0)
        if (Number.isNaN(angka)) return 'Rp 0'
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0,
        }).format(angka)
    }

    const formatStatusUser = (value) => {
        const mapping = {
            active: 'Aktif',
            inactive: 'Nonaktif',
            pending: 'Menunggu',
        }
        return mapping[value] || value || '-'
    }

    const formatStatusKepegawaian = (value) => {
        const mapping = {
            permanent: 'Tetap',
            contract: 'Kontrak',
            intern: 'Magang',
        }
        return mapping[value] || value || '-'
    }

    const loadProfile = useCallback(async () => {
        try {
            setLoading(true)
            setError('')
            const result = await pegawaiApi.getProfile()
            const user = result?.user || {}
            const employee = result?.employee || {}

            const previousUser = JSON.parse(localStorage.getItem('user') || '{}')
            localStorage.setItem('user', JSON.stringify({
                ...previousUser,
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                photo: user.photo || '',
            }))
            window.dispatchEvent(new Event('user-profile-updated'))

            setProfileForm({
                user_id: user.id || '',
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                username: user.username || '',
                status: user.status || '',
                user_updated_at: formatDateForInput(user.updated_at),
                employee_id: employee.id || '',
                user_ref_id: employee.user_id || '',
                gender: employee.gender || '',
                birth_place: employee.birth_place || '',
                date_of_birth: formatDateForInput(employee.date_of_birth),
                marital_status: employee.marital_status || '',
                nationality: employee.nationality || '',
                address: employee.address || '',
                nik: employee.nik || '',
                npwp: employee.npwp || '',
                bank_account: employee.bank_account || '',
                account_holder_name: employee.account_holder_name || '',
                bank_name: employee.bank_name || '',
                bpjs_number: employee.bpjs_number || '',
                employee_code: employee.employee_code || '',
                ktp_document: employee.ktp_document || '',
                diploma_document: employee.diploma_document || '',
                employment_contract_document: employee.employment_contract_document || '',
                position_id: employee.position_id || '',
                position_name: employee.position_name || '',
                department_name: employee.department_name || '',
                level: employee.level || '',
                join_date: formatDateForInput(employee.join_date),
                basic_salary: employee.basic_salary || '',
                employment_status: employee.employment_status || '',
                working_hours_id: employee.working_hours_id || '',
                annual_leave_quota: employee.annual_leave_quota || '',
                remaining_leave_quota: employee.remaining_leave_quota || '',
                quota_reset_date: formatDateForInput(employee.quota_reset_date),
                employee_created_at: formatDateForInput(employee.created_at),
                employee_updated_at: formatDateForInput(employee.updated_at),
                user_created_at: formatDateForInput(user.created_at),
            })
            setCurrentPhotoPath(user.photo || '')
            setPhotoFile(null)
            setKtpDocumentFile(null)
            setDiplomaDocumentFile(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadProfile()
    }, [loadProfile])

    const updateProfileField = (field, value) => {
        setProfileForm((prev) => ({ ...prev, [field]: value }))
    }

    const updatePasswordField = (field, value) => {
        setPasswordForm((prev) => ({ ...prev, [field]: value }))
    }

    const updateProfile = async (event) => {
        event.preventDefault()

        if (!profileForm.name || !profileForm.email) {
            setError('Nama dan email wajib diisi')
            return
        }

        try {
            setSavingProfile(true)
            setError('')
            await pegawaiApi.updateProfile({
                ...profileForm,
                photoFile,
                ktpDocumentFile,
                diplomaDocumentFile,
            })
            dispatch(showNotification({message : "Profil berhasil diperbarui", status : 1}))
            await loadProfile()
        } catch (err) {
            setError(err.message)
        } finally {
            setSavingProfile(false)
        }
    }

    const updatePassword = async (event) => {
        event.preventDefault()

        const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development'

        if (!passwordForm.newPassword) {
            setError('Password baru wajib diisi')
            return
        }

        if (!isDevelopment && !passwordForm.oldPassword) {
            setError('Password lama wajib diisi')
            return
        }

        try {
            setSavingPassword(true)
            setError('')
            await pegawaiApi.changePassword(passwordForm)
            setPasswordForm(INITIAL_PASSWORD_FORM)
            dispatch(showNotification({message : "Password berhasil diperbarui", status : 1}))
            localStorage.clear()
            delete axios.defaults.headers.common['Authorization']
            window.location.href = '/login'
        } catch (err) {
            setError(err.message)
        } finally {
            setSavingPassword(false)
        }
    }

    return(
        <>
            {error ? (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            ) : null}

            <TitleCard title="Data Pegawai" topMargin="mt-2">
                {loading ? (
                    <div>Memuat data profil...</div>
                ) : (
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={updateProfile}>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Nama</span></label>
                            <input className="input input-bordered" value={profileForm.name} onChange={(e) => updateProfileField('name', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Email</span></label>
                            <input className="input input-bordered" type="email" value={profileForm.email} onChange={(e) => updateProfileField('email', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Telepon</span></label>
                            <input className="input input-bordered" value={profileForm.phone} onChange={(e) => updateProfileField('phone', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Username</span></label>
                            <input className="input input-bordered" value={profileForm.username} onChange={(e) => updateProfileField('username', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Pengguna Aktif</span></label>
                            <input className="input input-bordered" value={formatStatusUser(profileForm.status)} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">User Dibuat</span></label>
                            <input className="input input-bordered" value={profileForm.user_created_at} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Foto Profil (opsional)</span></label>
                            <input className="file-input file-input-bordered w-full" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
                            {currentPhotoPath ? (
                                <label className="label"><span className="label-text-alt">Foto saat ini: {currentPhotoPath}</span></label>
                            ) : null}
                        </div>

                        <div className="md:col-span-2 mt-1"><h3 className="font-semibold">Data Pribadi Pegawai</h3></div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Jenis Kelamin</span></label>
                            <select className="select select-bordered" value={profileForm.gender} onChange={(e) => updateProfileField('gender', e.target.value)}>
                                <option value="">Pilih Jenis Kelamin</option>
                                <option value="male">Laki-laki</option>
                                <option value="female">Perempuan</option>
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Tempat Lahir</span></label>
                            <input className="input input-bordered" value={profileForm.birth_place} onChange={(e) => updateProfileField('birth_place', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Tanggal Lahir</span></label>
                            <input className="input input-bordered" type="date" value={profileForm.date_of_birth} onChange={(e) => updateProfileField('date_of_birth', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Status Pernikahan</span></label>
                            <select className="select select-bordered" value={profileForm.marital_status} onChange={(e) => updateProfileField('marital_status', e.target.value)}>
                                <option value="">Pilih Status Pernikahan</option>
                                <option value="single">Belum Menikah</option>
                                <option value="married">Sudah Menikah</option>
                                <option value="divorced">Cerai</option>
                                <option value="widowed">Janda/Duda</option>
                            </select>
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Kewarganegaraan</span></label>
                            <input className="input input-bordered" value={profileForm.nationality} onChange={(e) => updateProfileField('nationality', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">NIK</span></label>
                            <input className="input input-bordered" value={profileForm.nik} onChange={(e) => updateProfileField('nik', e.target.value)} />
                        </div>
                        <div className="form-control w-full md:col-span-2">
                            <label className="label"><span className="label-text">Alamat</span></label>
                            <textarea className="textarea textarea-bordered" value={profileForm.address} onChange={(e) => updateProfileField('address', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Nomor Rekening</span></label>
                            <input className="input input-bordered" value={profileForm.bank_account} onChange={(e) => updateProfileField('bank_account', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Nama Pemilik Rekening</span></label>
                            <input className="input input-bordered" value={profileForm.account_holder_name} onChange={(e) => updateProfileField('account_holder_name', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Nama Bank</span></label>
                            <input className="input input-bordered" value={profileForm.bank_name} onChange={(e) => updateProfileField('bank_name', e.target.value)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">NPWP</span></label>
                            <input className="input input-bordered" value={profileForm.npwp} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Nomor BPJS</span></label>
                            <input className="input input-bordered" value={profileForm.bpjs_number} readOnly disabled />
                        </div>

                        <div className="md:col-span-2 mt-1"><h3 className="font-semibold">Data Kepegawaian</h3></div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Kode Pegawai</span></label>
                            <input className="input input-bordered" value={profileForm.employee_code} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Departemen</span></label>
                            <input className="input input-bordered" value={profileForm.department_name} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Level</span></label>
                            <input className="input input-bordered" value={profileForm.level} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Jabatan</span></label>
                            <input className="input input-bordered" value={profileForm.position_name} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Tanggal Join</span></label>
                            <input className="input input-bordered" value={profileForm.join_date} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Basic Salary</span></label>
                            <input className="input input-bordered" value={formatMataUangIDR(profileForm.basic_salary)} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Status Kepegawaian</span></label>
                            <input className="input input-bordered" value={formatStatusKepegawaian(profileForm.employment_status)} readOnly disabled />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Kuota Cuti Tahunan</span></label>
                            <input className="input input-bordered" value={profileForm.annual_leave_quota} readOnly disabled />
                        </div>

                        <div className="md:col-span-2 mt-1"><h3 className="font-semibold">Dokumen Kontrak</h3></div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Dokumen KTP</span></label>
                            {profileForm.ktp_document ? (
                                <a className="btn btn-outline mb-2" href={getFileUrl(profileForm.ktp_document)} target="_blank" rel="noreferrer">Lihat Dokumen</a>
                            ) : (
                                <input className="input input-bordered mb-2" value="Belum ada dokumen" readOnly disabled />
                            )}
                            <input className="file-input file-input-bordered w-full" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setKtpDocumentFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Dokumen Ijazah</span></label>
                            {profileForm.diploma_document ? (
                                <a className="btn btn-outline mb-2" href={getFileUrl(profileForm.diploma_document)} target="_blank" rel="noreferrer">Lihat Dokumen</a>
                            ) : (
                                <input className="input input-bordered mb-2" value="Belum ada dokumen" readOnly disabled />
                            )}
                            <input className="file-input file-input-bordered w-full" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setDiplomaDocumentFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Dokumen Kontrak Kerja</span></label>
                            {profileForm.employment_contract_document ? (
                                <a className="btn btn-outline" href={getFileUrl(profileForm.employment_contract_document)} target="_blank" rel="noreferrer">Lihat Dokumen</a>
                            ) : (
                                <input className="input input-bordered" value="Belum ada dokumen" readOnly disabled />
                            )}
                        </div>
                        <div className="form-control w-full">
                            <label className="label"><span className="label-text">Pegawai Dibuat</span></label>
                            <input className="input input-bordered" value={profileForm.employee_created_at} readOnly disabled />
                        </div>
                        <div className="md:col-span-2">
                            <button className={`btn btn-primary ${savingProfile ? 'loading' : ''}`} type="submit" disabled={savingProfile}>Simpan Profil</button>
                        </div>
                    </form>
                )}
            </TitleCard>

            <TitleCard title="Ubah Password" topMargin="mt-6">
                <form className="grid grid-cols-1 md:grid-cols-2 gap-6" onSubmit={updatePassword}>
                    <div className="form-control w-full">
                        <label className="label"><span className="label-text">Password Lama</span></label>
                        <input className="input input-bordered" type="password" value={passwordForm.oldPassword} onChange={(e) => updatePasswordField('oldPassword', e.target.value)} />
                    </div>
                    <div className="form-control w-full">
                        <label className="label"><span className="label-text">Password Baru</span></label>
                        <input className="input input-bordered" type="password" value={passwordForm.newPassword} onChange={(e) => updatePasswordField('newPassword', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <button className={`btn btn-secondary ${savingPassword ? 'loading' : ''}`} type="submit" disabled={savingPassword}>Simpan Password</button>
                    </div>
                </form>
            </TitleCard>
        </>
    )
}


export default ProfileSettings