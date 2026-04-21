import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../features/common/headerSlice'
import TitleCard from '../components/Cards/TitleCard'
import { NotificationManager } from 'react-notifications'
import axios from 'axios'

export default function CandidateProfilePage() {

  const dispatch = useDispatch()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: '',
    birth_place: '',
    date_of_birth: '',
    marital_status: '',
    nationality: 'Indonesian',
    address: '',
    nik: '',
    npwp: '',
    education_level: '',
    university: '',
    major: '',
    graduation_year: '',
    linkedin: '',
    portfolio: '',
    expected_salary: '',
  })

  useEffect(() => {
    dispatch(setPageTitle({ title: 'Profil Saya' }))
    fetchCandidateProfile()
  }, [dispatch])

  const fetchCandidateProfile = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/candidates/profile')
      if (response.data.candidate) {
        const candidate = response.data.candidate
        setForm({
          name: candidate.name || '',
          email: candidate.email || '',
          phone: candidate.phone || '',
          gender: candidate.gender || '',
          birth_place: candidate.birth_place || '',
          date_of_birth: candidate.date_of_birth
            ? candidate.date_of_birth.split('T')[0]
            : '',
          marital_status: candidate.marital_status || '',
          nationality: candidate.nationality || 'Indonesian',
          address: candidate.address || '',
          nik: candidate.nik || '',
          npwp: candidate.npwp || '',
          education_level: candidate.education_level || '',
          university: candidate.university || '',
          major: candidate.major || '',
          graduation_year: candidate.graduation_year || '',
          linkedin: candidate.linkedin || '',
          portfolio: candidate.portfolio || '',
          expected_salary: candidate.expected_salary || '',
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      NotificationManager.error('Gagal memuat profil', 'Gagal', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name || !form.email || !form.phone) {
      NotificationManager.error('Mohon isi semua field wajib', 'Validasi Gagal', 3000)
      return
    }

    try {
      setSubmitting(true)

      await axios.put('/api/candidates/profile', form)

      NotificationManager.success('Profil Anda berhasil disimpan', 'Sukses', 3000)
      fetchCandidateProfile()
      
    } catch (error) {
      console.error('Failed to update profile:', error)
      NotificationManager.error(
        error.response?.data?.message || 'Gagal menyimpan profil',
        'Gagal',
        3000
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>

      {/* DATA PRIBADI */}
      <TitleCard title="Data Pribadi" subtitle="Informasi dasar dan identitas diri Anda">

        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Nama Lengkap *</span>
            </label>
            <input
              type="text"
              name="name"
              className="input input-bordered"
              placeholder="Masukkan nama lengkap"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Email *</span>
            </label>
            <input
              type="email"
              name="email"
              className="input input-bordered"
              placeholder="Masukkan email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Nomor HP *</span>
            </label>
            <input
              type="text"
              name="phone"
              className="input input-bordered"
              placeholder="Masukkan nomor HP"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Jenis Kelamin</span>
            </label>
            <select
              name="gender"
              className="select select-bordered"
              value={form.gender}
              onChange={handleChange}
            >
              <option value="">Pilih Jenis Kelamin</option>
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
              <option value="other">Lainnya</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Tempat Lahir</span>
            </label>
            <input
              type="text"
              name="birth_place"
              className="input input-bordered"
              placeholder="Masukkan tempat lahir"
              value={form.birth_place}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Tanggal Lahir</span>
            </label>
            <input
              type="date"
              name="date_of_birth"
              className="input input-bordered"
              value={form.date_of_birth}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Status Pernikahan</span>
            </label>
            <select
              name="marital_status"
              className="select select-bordered"
              value={form.marital_status}
              onChange={handleChange}
            >
              <option value="">Pilih Status Pernikahan</option>
              <option value="single">Belum Menikah</option>
              <option value="married">Menikah</option>
              <option value="divorced">Cerai</option>
              <option value="widowed">Janda/Duda</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Kebangsaan</span>
            </label>
            <input
              type="text"
              name="nationality"
              className="input input-bordered"
              placeholder="Masukkan kebangsaan"
              value={form.nationality}
              onChange={handleChange}
            />
          </div>

        </div>

      </TitleCard>

      {/* ALAMAT */}
      <TitleCard title="Alamat" topMargin="mt-6">

        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">

          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text font-semibold">Alamat Lengkap</span>
            </label>
            <textarea
              name="address"
              className="textarea textarea-bordered"
              placeholder="Masukkan alamat lengkap"
              value={form.address}
              onChange={handleChange}
              rows="3"
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">NIK (Nomor Induk Kependudukan)</span>
            </label>
            <input
              type="text"
              name="nik"
              className="input input-bordered"
              placeholder="Masukkan NIK (16 digit)"
              value={form.nik}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">NPWP (Opsional)</span>
            </label>
            <input
              type="text"
              name="npwp"
              className="input input-bordered"
              placeholder="Masukkan NPWP"
              value={form.npwp}
              onChange={handleChange}
            />
          </div>

        </div>

      </TitleCard>

      {/* PENDIDIKAN */}
      <TitleCard title="Pendidikan" topMargin="mt-6">

        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Tingkat Pendidikan</span>
            </label>
            <select
              name="education_level"
              className="select select-bordered"
              value={form.education_level}
              onChange={handleChange}
            >
              <option value="">Pilih Tingkat Pendidikan</option>
              <option value="SMA">SMA/SMK</option>
              <option value="D3">D3 (Diploma)</option>
              <option value="S1">S1 (Sarjana)</option>
              <option value="S2">S2 (Master)</option>
              <option value="S3">S3 (Doktor)</option>
            </select>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Universitas</span>
            </label>
            <input
              type="text"
              name="university"
              className="input input-bordered"
              placeholder="Masukkan nama universitas"
              value={form.university}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Jurusan/Program Studi</span>
            </label>
            <input
              type="text"
              name="major"
              className="input input-bordered"
              placeholder="Masukkan jurusan"
              value={form.major}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Tahun Lulus</span>
            </label>
            <input
              type="number"
              name="graduation_year"
              className="input input-bordered"
              placeholder="YYYY"
              value={form.graduation_year}
              onChange={handleChange}
              min="1990"
              max={new Date().getFullYear()}
            />
          </div>

        </div>

      </TitleCard>

      {/* ONLINE PRESENCE & EKSPEKTASI */}
      <TitleCard title="Online Presence & Ekspektasi Gaji" topMargin="mt-6">

        <div className="grid md:grid-cols-2 grid-cols-1 gap-4">

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">LinkedIn Profile</span>
            </label>
            <input
              type="url"
              name="linkedin"
              className="input input-bordered"
              placeholder="https://linkedin.com/in/..."
              value={form.linkedin}
              onChange={handleChange}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-semibold">Portfolio Website</span>
            </label>
            <input
              type="url"
              name="portfolio"
              className="input input-bordered"
              placeholder="https://portfolio.com"
              value={form.portfolio}
              onChange={handleChange}
            />
          </div>

          <div className="form-control md:col-span-2">
            <label className="label">
              <span className="label-text font-semibold">Ekspektasi Gaji Tahunan (Rp)</span>
            </label>
            <input
              type="number"
              name="expected_salary"
              className="input input-bordered"
              placeholder="Masukkan ekspektasi gaji tahunan"
              value={form.expected_salary}
              onChange={handleChange}
            />
          </div>

        </div>

      </TitleCard>

      {/* Submit Button */}
      <div className="flex justify-end gap-3 mt-8">
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => fetchCandidateProfile()}
          disabled={submitting}
        >
          Batal
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
        >
          {submitting ? <span className="loading loading-spinner loading-sm"></span> : null}
          Simpan Perubahan
        </button>
      </div>

    </form>
  )
}
