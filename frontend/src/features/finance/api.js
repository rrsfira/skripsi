import axios from 'axios'

const parseApiError = (error, fallbackMessage) => {
    return error?.response?.data?.message || fallbackMessage
}

export const financeApi = {
    async getDashboard({ month, year } = {}) {
        try {
            const params = {}
            if (month) params.month = month
            if (year) params.year = year
            const response = await axios.get('/api/dashboard/finance', { params })
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat dashboard finance'))
        }
    },

    async generatePayroll(payload) {
        try {
            const response = await axios.post('/api/payroll/generate', payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menghitung payroll'))
        }
    },

    async publishPayroll(payrollId) {
        try {
            const response = await axios.put(`/api/payroll/${payrollId}/publish`)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mempublikasikan slip gaji'))
        }
    },

    async transferPayroll(payrollId) {
        try {
            const response = await axios.put(`/api/payroll/${payrollId}/transfer`)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengirim gaji ke rekening pegawai'))
        }
    },

    async deletePayroll(payrollId) {
        try {
            const response = await axios.delete(`/api/payroll/${payrollId}`)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menghapus slip gaji'))
        }
    },

    async getPayrollById(payrollId) {
        try {
            const response = await axios.get(`/api/payroll/${payrollId}`)
            return response.data?.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat detail payroll'))
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

    async getPayrollByEmployee(employeeId, params = {}) {
        try {
            const response = await axios.get(`/api/payroll/employee/${employeeId}`, { params })
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data payroll pegawai'))
        }
    },

    async getPayrollList(params = {}) {
        try {
            const response = await axios.get('/api/payroll', { params })
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat rekap payroll'))
        }
    },

    async downloadMonthlyPayrollPdf(params = {}) {
        try {
            const response = await axios.get('/api/payroll/reports/monthly/pdf', { params, responseType: 'blob' })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengunduh PDF laporan payroll'))
        }
    },

    async downloadMonthlyPayrollExcel(params = {}) {
        try {
            const response = await axios.get('/api/payroll/reports/monthly/excel', { params, responseType: 'blob' })
            return response.data
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal mengunduh Excel laporan payroll'))
        }
    },

    async getReimbursements() {
        try {
            const response = await axios.get('/api/reimbursements')
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data reimbursement'))
        }
    },

    async getAttendanceSummaryAll(params = {}) {
        try {
            const response = await axios.get('/api/attendance/summary/all', { params })
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat ringkasan absensi pegawai'))
        }
    },

    async getPayrollSettings() {
        try {
            const response = await axios.get('/api/payroll-settings')
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat pengaturan payroll'))
        }
    },

    async updatePayrollSettings(payload) {
        try {
            const response = await axios.put('/api/payroll-settings', payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menyimpan pengaturan payroll'))
        }
    },

    async getEmployeeReferences() {
        try {
            const response = await axios.get('/api/dashboard/finance/employees-reference')
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat referensi identitas pegawai'))
        }
    },

    async createRevisedPayroll(appealId, payload) {
        try {
            const response = await axios.post(`/api/salary-appeals/${appealId}/create-revised-payroll`, payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal membuat slip revisi banding gaji'))
        }
    },

    async getSalaryAppeals(params = {}) {
        try {
            const response = await axios.get('/api/salary-appeals', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data banding gaji'))
        }
    },

    async getPayrollManagerAdjustments(params = {}) {
        try {
            const response = await axios.get('/api/payroll/manager-adjustments', { params })
            return response.data || { data: [] }
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat adjustment payroll dari atasan'))
        }
    },

    async reviewPayrollManagerAdjustment(id, payload) {
        try {
            const response = await axios.put(`/api/payroll/manager-adjustments/${id}/review`, payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memproses review adjustment payroll'))
        }
    },

    async getPositions() {
        try {
            const response = await axios.get('/api/employees/positions/list/all')
            return response.data?.data || []
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal memuat data posisi'))
        }
    },

    async updatePositionSalary(positionId, payload) {
        try {
            const response = await axios.put(`/api/employees/positions/update/${positionId}`, payload)
            return response.data || {}
        } catch (error) {
            throw new Error(parseApiError(error, 'Gagal menyimpan gaji posisi'))
        }
    },
}
