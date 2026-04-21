import React, { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { setPageTitle } from '../features/common/headerSlice'
import TitleCard from '../components/Cards/TitleCard'
import { NotificationManager } from 'react-notifications'
import axios from 'axios'

const DEFAULT_PHOTO = 'https://placeimg.com/80/80/people'

export default function CandidateEditProfilePage() {
  const dispatch = useDispatch()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(DEFAULT_PHOTO)
  const [photoFile, setPhotoFile] = useState(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
  })

  const [formErrors, setFormErrors] = useState({})

  useEffect(() => {
    dispatch(setPageTitle({ title: 'Edit Data Akun' }))
    fetchUserProfile()
  }, [dispatch])

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const rawUser = localStorage.getItem('user')
      const user = rawUser ? JSON.parse(rawUser) : null

      if (user) {
        setForm({
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || '',
          username: user.username || '',
        })

        if (user.photo) {
          const photoUrl = user.photo.startsWith('http')
            ? user.photo
            : `${process.env.REACT_APP_BASE_URL || 'http://localhost:5000'}/${user.photo}`
          setPhotoPreview(photoUrl)
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      NotificationManager.error('Gagal memuat profil', 'Gagal', 3000)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setForm({
      ...form,
      [name]: value,
    })
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: '',
      })
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result || DEFAULT_PHOTO)
      }
      reader.readAsDataURL(file)
    }
  }

  const validateForm = () => {
    const errors = {}

    if (!form.name.trim()) {
      errors.name = 'Nama harus diisi'
    }

    if (!form.email.trim()) {
      errors.email = 'Email harus diisi'
    } else if (!form.email.includes('@')) {
      errors.email = 'Format email tidak valid'
    }

    if (!form.phone.trim()) {
      errors.phone = 'No. Telepon harus diisi'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      NotificationManager.error('Mohon lengkapi form dengan benar', 'Validasi Gagal', 3000)
      return
    }

    try {
      setSubmitting(true)

      const formData = new FormData()
      formData.append('name', form.name)
      formData.append('email', form.email)
      formData.append('phone', form.phone)
      if (form.username && form.username.trim() !== "") {
        formData.append('username', form.username)
      }
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      // Optimis update preview sebelum request selesai
      let optimisticPreview = null;
      if (photoFile) {
        const reader = new FileReader();
        reader.onload = (event) => {
          optimisticPreview = event.target?.result || DEFAULT_PHOTO;
          setPhotoPreview(optimisticPreview);
        };
        reader.readAsDataURL(photoFile);
      }

      // Update localStorage optimis
      const rawUser = localStorage.getItem('user')
      const user = rawUser ? JSON.parse(rawUser) : {}
      const updatedUserOptimistic = {
        ...user,
        name: form.name,
        email: form.email,
        phone: form.phone,
        username: form.username && form.username.trim() !== "" ? form.username : user.username,
        // photo: akan diupdate setelah response
      }
      localStorage.setItem('user', JSON.stringify(updatedUserOptimistic))

      const response = await axios.put('/api/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update localStorage dan preview dengan data backend
      let newPhoto = response.data.photo;
      let finalPhoto = newPhoto && typeof newPhoto === 'string' && newPhoto.trim() !== ''
        ? newPhoto
        : (user.photo || DEFAULT_PHOTO);

      let photoUrl = finalPhoto && !finalPhoto.startsWith('http')
        ? `${process.env.REACT_APP_BASE_URL || 'http://localhost:5000'}/${finalPhoto}`
        : finalPhoto;

      const updatedUser = {
        ...user,
        name: form.name,
        email: form.email,
        phone: form.phone,
        username: form.username && form.username.trim() !== "" ? form.username : user.username,
        photo: finalPhoto,
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // Jika backend mengembalikan path foto baru, pakai itu. Jika tidak, pakai preview optimis.
      if (newPhoto && typeof newPhoto === 'string' && newPhoto.trim() !== '') {
        setPhotoPreview(photoUrl);
      } else if (optimisticPreview) {
        setPhotoPreview(optimisticPreview);
      }

      // Trigger event for header to update
      window.dispatchEvent(new Event('user-profile-updated'));
      // Paksa update src img header jika ada
      setTimeout(() => {
        const headerImg = document.querySelector('.avatar img');
        if (headerImg && photoUrl) {
          headerImg.src = photoUrl;
        }
      }, 100);

      NotificationManager.success('Profil berhasil diperbarui', 'Sukses', 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
      const errorMsg = error.response?.data?.message || 'Gagal memperbarui profil'
      NotificationManager.error(errorMsg, 'Gagal', 3000)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <TitleCard title="Edit Data Akun" topMargin="mt-2">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </TitleCard>
    )
  }

  return (
    <TitleCard title="Edit Data Akun" topMargin="mt-2">
      <form onSubmit={handleSubmit}>
        {/* Photo Section */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-semibold">Foto Profil</span>
          </label>
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0">
              <img
                src={photoPreview}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-base-300"
                onError={() => setPhotoPreview(DEFAULT_PHOTO)}
              />
            </div>
            <div className="flex-grow">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="file-input file-input-bordered w-full"
              />
              <p className="text-xs text-gray-500 mt-2">Format: JPG, PNG, WEBP (Max 10MB)</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-semibold">Nama Lengkap *</span>
          </label>
          <input
            type="text"
            name="name"
            placeholder="Masukkan nama lengkap"
            className={`input input-bordered ${formErrors.name ? 'input-error' : ''}`}
            value={form.name}
            onChange={handleInputChange}
            disabled={submitting}
          />
          {formErrors.name && <span className="text-error text-sm mt-2">{formErrors.name}</span>}
        </div>

        {/* Email */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-semibold">Email *</span>
          </label>
          <input
            type="email"
            name="email"
            placeholder="Masukkan email"
            className={`input input-bordered ${formErrors.email ? 'input-error' : ''}`}
            value={form.email}
            onChange={handleInputChange}
            disabled={submitting}
          />
          {formErrors.email && <span className="text-error text-sm mt-2">{formErrors.email}</span>}
        </div>

        {/* Phone */}
        <div className="form-control mb-4">
          <label className="label">
            <span className="label-text font-semibold">No. Telepon *</span>
          </label>
          <input
            type="tel"
            name="phone"
            placeholder="Masukkan no. telepon"
            className={`input input-bordered ${formErrors.phone ? 'input-error' : ''}`}
            value={form.phone}
            onChange={handleInputChange}
            disabled={submitting}
          />
          {formErrors.phone && <span className="text-error text-sm mt-2">{formErrors.phone}</span>}
        </div>

        {/* Username */}
        <div className="form-control mb-6">
          <label className="label">
            <span className="label-text font-semibold">Username <span className="text-gray-500 text-xs">(Opsional)</span></span>
          </label>
          <input
            type="text"
            name="username"
            placeholder="Masukkan username"
            className="input input-bordered"
            value={form.username}
            onChange={handleInputChange}
            disabled={submitting}
          />
          <label className="label">
            <span className="label-text-alt">Biarkan kosong jika tidak ingin mengubah</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-2 mt-8">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fetchUserProfile()}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <span className="loading loading-spinner loading-sm"></span> : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </TitleCard>
  )
}
