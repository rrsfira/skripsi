import axios from 'axios'

const parseApiError = (error, fallbackMessage) => {
    return error?.response?.data?.message || fallbackMessage
}

export const atasanApi = {
    async getDashboard(params = {}) {
        try {
            const response = await axios.get('/api/dashboard/atasan', { params })
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat dashboard atasan'))
        }
    },

    async getLeaveRequests(params = {}) {
        try {
            const response = await axios.get('/api/attendance/leave-requests', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data cuti/izin'))
        }
    },

    async getAllEmployees() {
        try {
            const response = await axios.get('/api/employees')
            return response.data?.employees || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data seluruh pegawai'))
        }
    },

    async reviewLeaveRequest(id, action) {
        try {
            const status = action === 'approve' ? 'approved' : 'rejected'
            const response = await axios.put(`/api/attendance/leave-request/${id}`, { status })
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memproses pengajuan cuti/izin'))
        }
    },

    async getReimbursements(params = {}) {
        try {
            const response = await axios.get('/api/reimbursements', {
                params: {
                    ...params,
                    roleContext: 'atasan',
                },
            })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data reimbursement'))
        }
    },

    async reviewReimbursement(id, action) {
        try {
            const response = await axios.put(`/api/reimbursements/${id}/approve`, { action })
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memproses reimbursement'))
        }
    },

    async getAttendanceRecords(params = {}) {
        try {
            const response = await axios.get('/api/attendance/all', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data kehadiran tim'))
        }
    },

    async getTeamMembers() {
        try {
            const response = await axios.get('/api/attendance/team-members')
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat anggota tim'))
        }
    },

    async updateAttendanceStatus(id, status) {
        try {
            const response = await axios.put(`/api/attendance/${id}/status`, { status })
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memperbarui status kehadiran'))
        }
    },

    async getPayrollManagerAdjustments(params = {}) {
        try {
            const response = await axios.get('/api/payroll/manager-adjustments', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat adjustment payroll tim'))
        }
    },

    async upsertPayrollManagerAdjustment(payload) {
        try {
            const response = await axios.post('/api/payroll/manager-adjustments/upsert', payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menyimpan adjustment payroll tim'))
        }
    },

    async submitPayrollManagerAdjustment(id) {
        try {
            const response = await axios.put(`/api/payroll/manager-adjustments/${id}/submit`)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal submit adjustment payroll tim'))
        }
    },
}
