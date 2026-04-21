import axios from 'axios'

const parseApiError = (error, fallbackMessage) => {
    return error?.response?.data?.message || fallbackMessage
}

const jobService = {
    // Job Openings Management
    async getJobOpenings(params = {}) {
        try {
            const response = await axios.get('/api/job-openings', { params });
            return response.data.jobs || [];
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data lowongan'));
        }
    },

    async createJobOpening(payload) {
        try {
            const response = await axios.post('/api/job-openings', payload);
            return response.data;
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menambah lowongan'));
        }
    },

    async updateJobOpening(id, payload) {
        try {
            const response = await axios.put(`/api/job-openings/${id}`, payload);
            return response.data;
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengupdate lowongan'));
        }
    }
}

export default jobService

export const hrApi = {
    async getMeta() {
        try {
            const response = await axios.get('/api/auth/admin/meta')
            return response.data || { roles: [], positions: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data referensi'))
        }
    },

    // HR Dashboard
    async getDashboard() {
        try {
            const response = await axios.get('/api/dashboard/hr')
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat dashboard HR'))
        }
    },

    // Leave Request Management
    async getLeaveRequests(params = {}) {
        try {
            const response = await axios.get('/api/attendance/leave-requests', {
                params: {
                    ...params,
                    scope: 'hr_all',
                },
            })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data cuti/izin'))
        }
    },

    async approveLeaveRequest(id, notes = '') {
        try {
            const response = await axios.put(`/api/attendance/leave-request/${id}`, {
                status: 'approved',
                notes,
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menyetujui permintaan cuti/izin'))
        }
    },

    async rejectLeaveRequest(id, notes = '') {
        try {
            const response = await axios.put(`/api/attendance/leave-request/${id}`, {
                status: 'rejected',
                notes,
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menolak permintaan cuti/izin'))
        }
    },

    // Reimbursement Validation
    async getReimbursements(params = {}) {
        try {
            const response = await axios.get('/api/reimbursements', {
                params: {
                    ...params,
                    roleContext: 'hr',
                },
            })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data reimbursement'))
        }
    },

    async validateReimbursement(id) {
        try {
            const response = await axios.put(`/api/reimbursements/${id}/validate`, { action: 'approve' })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memvalidasi reimbursement'))
        }
    },

    async rejectReimbursement(id, reason = '') {
        try {
            const response = await axios.put(`/api/reimbursements/${id}/validate`, {
                action: 'reject',
                reason,
                notes: reason,
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menolak reimbursement'))
        }
    },

    // Salary Appeal Management
    async getSalaryAppeals(params = {}) {
        try {
            const response = await axios.get('/api/salary-appeals', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data banding gaji'))
        }
    },

    async reviewSalaryAppeal(id, action, payload = {}) {
        try {
            const response = await axios.put(`/api/salary-appeals/${id}/review`, {
                action,
                review_notes: payload.review_notes || '',
                adjustment_amount: payload.adjustment_amount,
                review_items: payload.review_items,
            })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mereview banding gaji'))
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

    // Employee Management
    async getEmployees(params = {}) {
        try {
            const response = await axios.get('/api/employees', { params })
            return {
                data: response.data?.employees || [],
            }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data pegawai'))
        }
    },

    async getPayrollManagerAdjustments(params = {}) {
        try {
            const response = await axios.get('/api/payroll/manager-adjustments', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat adjustment payroll'))
        }
    },

    async upsertPayrollManagerAdjustment(payload) {
        try {
            const response = await axios.post('/api/payroll/manager-adjustments/upsert', payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menyimpan adjustment payroll'))
        }
    },

    async getEmployeeDetails(id) {
        try {
            const response = await axios.get(`/api/employees/${id}`)
            return response.data?.employee || null
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat detail pegawai'))
        }
    },

    async updateEmployee(id, payload) {
        try {
            const response = await axios.put(`/api/employees/${id}`, payload)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengupdate data pegawai'))
        }
    },

    async createEmployee(payload) {
        try {
            const response = await axios.post('/api/auth/register/staff', payload)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menambah pegawai'))
        }
    },

    async deleteEmployee(id) {
        try {
            const response = await axios.delete(`/api/employees/${id}`)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menghapus pegawai'))
        }
    },

    // Attendance Management
    async getAttendanceRecords(params = {}) {
        try {
            const response = await axios.get('/api/attendance/all', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat rekaman absensi'))
        }
    },

    async getAttendanceMembers() {
        try {
            const response = await axios.get('/api/attendance/team-members')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat daftar pegawai'))
        }
    },

    async updateAttendance(id, payload) {
        try {
            const response = await axios.put(`/api/attendance/${id}`, payload)
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengupdate absensi'))
        }
    },

    // Organization Data
    async getDepartments() {
        try {
            const response = await axios.get('/api/employees/departments')
            return response.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data departemen'))
        }
    },

    async getPositions() {
        try {
            const response = await axios.get('/api/employees/positions')
            return response.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data jabatan'))
        }
    },

    async getWarningLetterEligibleEmployees() {
        try {
            const response = await axios.get('/api/warning-letters/eligible-employees')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat kandidat surat peringatan'))
        }
    },

    async getWarningLetters(params = {}) {
        try {
            const response = await axios.get('/api/warning-letters', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data surat peringatan'))
        }
    },

    async createWarningLetter(payload) {
        try {
            const response = await axios.post('/api/warning-letters', payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal membuat surat peringatan'))
        }
    },
}
