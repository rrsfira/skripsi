# Quick Start Guide - HR Frontend

## Cara Menjalankan Aplikasi

### 1. Start Backend Server
```bash
cd backend
node server.js
```
Backend akan berjalan di `http://localhost:5000`

### 2. Start Frontend Development Server
```bash
cd frontend
npm start
```
Frontend akan berjalan di `http://localhost:3000`

## Cara Login sebagai HR

### Option 1: Gunakan User yang Sudah Ada
Jika sudah ada user dengan role 'hr' di database, login menggunakan kredensial tersebut.

### Option 2: Buat User HR Baru (via SQL)
```sql
-- 1. Insert user baru
INSERT INTO users (username, email, password, role, name, is_active) 
VALUES ('hr001', 'hr@example.com', '$2b$10$hashedpassword', 'hr', 'HR Manager', 1);

-- 2. Dapatkan user_id yang baru dibuat
SELECT id FROM users WHERE username = 'hr001';

-- 3. Insert data employee untuk user HR (opsional tapi direkomendasikan)
INSERT INTO employees (user_id, employee_code, nik, phone, address, birth_date, gender, join_date, position_id, employment_status, status, created_at)
VALUES (
    [user_id_dari_step_2], 
    'EMP-HR001', 
    '1234567890123456',
    '08123456789',
    'Jakarta',
    '1990-01-01',
    'M',
    '2024-01-01',
    1, -- sesuaikan dengan position_id yang ada
    'permanent',
    'active',
    NOW()
);
```

### Option 3: Update User yang Sudah Ada
```sql
-- Update role user yang sudah ada menjadi 'hr'
UPDATE users SET role = 'hr' WHERE username = 'namauser';
```

## Generate Password Hash untuk User Baru

```bash
cd backend
node hash.js
# Masukkan password yang diinginkan
# Copy hasil hash ke SQL query di atas
```

## Fitur-Fitur HR yang Tersedia

### 1. Dashboard HR (`/app/dashboard`)
- Statistik pegawai (total, tetap, kontrak, magang)
- Status kehadiran hari ini
- Permohonan cuti/izin pending
- Reimbursement butuh validasi
- Banding gaji pending
- Ringkasan absensi bulanan
- Distribusi pegawai per departemen dan jabatan

### 2. Data Pegawai (`/app/employees`)
- Lihat semua data pegawai
- Filter berdasarkan departemen, jabatan, status
- View detail lengkap pegawai
- Edit data pegawai (dalam development)

### 3. Kelola Cuti & Izin (`/app/leave-requests`)
- Lihat semua permohonan cuti/izin
- Filter berdasarkan status, tipe cuti, periode
- Approve atau reject permohonan
- Tambah catatan untuk setiap keputusan

### 4. Validasi Reimbursement (`/app/reimbursements`)
- Lihat reimbursement yang perlu validasi
- View bukti pembayaran
- Validasi atau reject reimbursement
- Filter berdasarkan tipe dan status

### 5. Review Banding Gaji (`/app/salary-appeals`)
- Lihat banding gaji dari pegawai
- Review detail payroll
- Approve atau reject banding
- Tambah catatan review

## Menu Sidebar HR

1. **Dashboard HR** - Overview dan statistik
2. **Data Pegawai** - Manajemen data pegawai
3. **Kelola Cuti & Izin** - Approval cuti dan izin
4. **Validasi Reimbursement** - Validasi reimbursement
5. **Review Banding Gaji** - Review banding gaji pegawai

## Testing Checklist

- [ ] Login sebagai HR berhasil
- [ ] Dashboard menampilkan data statistik
- [ ] Data pegawai tampil di halaman employees
- [ ] Filter dan search berfungsi
- [ ] Modal detail terbuka dengan benar
- [ ] Approve leave request berhasil
- [ ] Reject leave request berhasil
- [ ] Validasi reimbursement berhasil
- [ ] View bukti reimbursement berhasil
- [ ] Review salary appeal berhasil
- [ ] Notifikasi muncul setelah aksi
- [ ] Data refresh setelah aksi

## Troubleshooting

### Backend Error
```
Error: connect ECONNREFUSED
```
**Solusi:** Pastikan backend server sudah berjalan di port 5000

### Frontend Error
```
Cannot GET /app/dashboard
```
**Solusi:** Pastikan sudah login dan memiliki role 'hr'

### Data Tidak Muncul
```
Dashboard kosong atau error
```
**Solusi:** 
1. Check console browser untuk error messages
2. Verify backend API endpoint `/api/dashboard/hr` berjalan
3. Check database connection
4. Pastikan ada data di database

### Token Expired
```
401 Unauthorized
```
**Solusi:** Logout dan login kembali

## API Endpoints yang Digunakan

- `GET /api/dashboard/hr` - Dashboard data
- `GET /api/attendance/leave-requests` - Leave requests
- `PUT /api/attendance/leave-requests/:id/approve` - Approve leave
- `PUT /api/attendance/leave-requests/:id/reject` - Reject leave
- `GET /api/reimbursements` - Reimbursements
- `PUT /api/reimbursements/:id/validate` - Validate reimbursement
- `PUT /api/reimbursements/:id/reject` - Reject reimbursement
- `GET /api/salary-appeals` - Salary appeals
- `PUT /api/salary-appeals/:id/review` - Review salary appeal
- `GET /api/employees/list` - Employee list
- `GET /api/employees/:id` - Employee details
- `GET /api/employees/departments` - Departments
- `GET /api/employees/positions` - Positions

## Browser Developer Tools

Untuk debugging, buka browser console (F12) dan check:
1. **Console Tab** - Lihat error messages
2. **Network Tab** - Monitor API calls
3. **Application Tab** - Check localStorage untuk token dan activeRole

## File Locations

```
frontend/src/
├── features/hr/api.js                     # HR API functions
├── pages/protected/
│   ├── HRDashboard.js                     # Dashboard HR
│   ├── HREmployees.js                     # Data Pegawai
│   ├── HRLeaveRequests.js                 # Kelola Cuti & Izin
│   ├── HRReimbursements.js                # Validasi Reimbursement
│   └── HRSalaryAppeals.js                 # Review Banding Gaji
└── routes/
    ├── index.js                           # Route configuration
    └── sidebar.js                         # Sidebar menu config
```

## Support

Jika ada masalah atau pertanyaan:
1. Check file `HR_FRONTEND_IMPLEMENTATION.md` untuk detail lengkap
2. Review backend logs di terminal backend
3. Check database untuk memastikan data tersedia
4. Verify user memiliki role 'hr' di tabel users

## Update & Maintenance

Untuk update di masa depan:
1. Backup database sebelum perubahan
2. Test di development environment dulu
3. Review API changes di backend
4. Update documentation

---

**Created:** February 2026
**Version:** 1.0.0
**Framework:** React.js + Tailwind CSS + DaisyUI
