import axios from 'axios'

const parseApiError = (error, fallbackMessage) => {
    return error?.response?.data?.message || fallbackMessage
}

export const pegawaiApi = {
    async getProfile() {
        try {
            const response = await axios.get('/api/profile')
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat profil'))
        }
    },

    async updateProfile(payload) {
        try {
            const formData = new FormData()

            const editableFields = [
                'name',
                'email',
                'phone',
                'username',
                'gender',
                'birth_place',
                'date_of_birth',
                'marital_status',
                'nationality',
                'address',
                'nik',
                'bank_account',
                'account_holder_name',
                'bank_name',
            ]

            editableFields.forEach((field) => {
                const value = payload[field]
                if (value !== undefined && value !== null) {
                    formData.append(field, value)
                }
            })

            if (payload.photoFile) {
                formData.append('photo', payload.photoFile)
            }

            if (payload.ktpDocumentFile) {
                formData.append('ktp_document', payload.ktpDocumentFile)
            }

            if (payload.diplomaDocumentFile) {
                formData.append('diploma_document', payload.diplomaDocumentFile)
            }

            const response = await axios.put('/api/profile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengubah profil'))
        }
    },

    async changePassword(payload) {
        try {
            const response = await axios.put('/api/profile/password', payload)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengubah password'))
        }
    },

    async getDashboard() {
        try {
            const response = await axios.get('/api/profile/dashboard')
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat dashboard pegawai'))
        }
    },

    async getAttendanceToday() {
        try {
            const response = await axios.get('/api/attendance/today')
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat absensi hari ini'))
        }
    },

    async checkIn() {
        try {
            const response = await axios.post('/api/attendance/checkin')
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Check-in gagal'))
        }
    },

    async checkOut() {
        try {
            const response = await axios.post('/api/attendance/checkout')
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Check-out gagal'))
        }
    },

    async getAttendanceHistory(params = {}) {
        try {
            const response = await axios.get('/api/attendance/my-history', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat riwayat absensi'))
        }
    },

    async getAttendanceSummary(params = {}) {
        try {
            const response = await axios.get('/api/attendance/my-summary', { params })
            return response.data || { data: {} }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat ringkasan absensi'))
        }
    },

    async getMyWarningLetters() {
        try {
            const response = await axios.get('/api/warning-letters/my')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat surat peringatan'))
        }
    },

    async submitLeaveRequest(payload) {
        try {
            const formData = new FormData()
            Object.keys(payload).forEach((key) => {
                if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    formData.append(key, payload[key])
                }
            })

            const response = await axios.post('/api/attendance/leave-request', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengajukan cuti/izin'))
        }
    },

    async getMyLeaveRequests(params = {}) {
        try {
            const response = await axios.get('/api/attendance/my-leave-requests', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data cuti/izin'))
        }
    },

    async getPayrollByEmployee(employeeId, params = {}) {
        try {
            const response = await axios.get(`/api/payroll/employee/${employeeId}`, { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat slip gaji'))
        }
    },

    async claimPayroll(payrollId) {
        try {
            const response = await axios.put(`/api/payroll/${payrollId}/claim`)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal klaim gaji'))
        }
    },

    async getPayrollPdfBlob(payrollId) {
        try {
            const response = await axios.get(`/api/payroll/${payrollId}/pdf`, {
                responseType: 'blob',
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat PDF slip gaji'))
        }
    },

    async getMyReimbursements() {
        try {
            const response = await axios.get('/api/reimbursements/my')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat reimbursement'))
        }
    },

    async submitReimbursement(payload) {
        try {
            const formData = new FormData()

            if (payload.reimbursement_type !== undefined && payload.reimbursement_type !== null) {
                formData.append('reimbursement_type', String(payload.reimbursement_type).trim())
            }

            if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
                formData.append('amount', payload.amount)
            }

            if (payload.description !== undefined && payload.description !== null) {
                formData.append('description', String(payload.description).trim())
            }

            if (payload.attachment) {
                formData.append('attachment', payload.attachment)
            }

            const response = await axios.post('/api/reimbursements', formData)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengajukan reimbursement'))
        }
    },

    async getMySalaryAppeals() {
        try {
            const response = await axios.get('/api/salary-appeals/my')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat banding gaji'))
        }
    },

    async submitSalaryAppeal(payload) {
        try {
            const formData = new FormData()
            Object.keys(payload).forEach((key) => {
                if (key === 'appeal_items' && Array.isArray(payload[key])) {
                    formData.append(key, JSON.stringify(payload[key]))
                    return
                }
                if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    formData.append(key, payload[key])
                }
            })

            const response = await axios.post('/api/salary-appeals', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengajukan banding gaji'))
        }
    },

    async updateSalaryAppeal(id, payload) {
        try {
            const formData = new FormData()
            Object.keys(payload).forEach((key) => {
                if (key === 'appeal_items' && Array.isArray(payload[key])) {
                    formData.append(key, JSON.stringify(payload[key]))
                    return
                }
                if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') {
                    formData.append(key, payload[key])
                }
            })

            const response = await axios.put(`/api/salary-appeals/${id}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengubah banding gaji'))
        }
    },

    async deleteSalaryAppeal(id) {
        try {
            const response = await axios.delete(`/api/salary-appeals/${id}`)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menghapus banding gaji'))
        }
    },
}
