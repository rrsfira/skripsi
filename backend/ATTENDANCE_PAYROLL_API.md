# Attendance & Payroll API Documentation

## Overview
Sistem absensi dengan deteksi keterlambatan otomatis dan integrasi dengan payroll untuk pengurangan gaji.

**Jam Kerja Standard**: 08:00 - 16:00 (8 jam)

---

## 📋 DATABASE SCHEMA CHANGES

### Tabel `working_hours` (BARU)
Menyimpan konfigurasi jam kerja
```sql
- id: INT (PRIMARY KEY)
- name: VARCHAR(100) - Nama konfigurasi (e.g., "Standard Working Hours")
- check_in_time: TIME - Jam masuk (08:00:00)
- check_out_time: TIME - Jam pulang (16:00:00)
- grace_period_minutes: INT - Grace period dalam menit (default: 0)
- is_default: TINYINT - Flag untuk default config
- created_at, updated_at: TIMESTAMP
```

**Default Data**:
```
id=1, name="Standard Working Hours", check_in_time=08:00:00, check_out_time=16:00:00, grace_period_minutes=0, is_default=1
```

### Tabel `attendance` (MODIFIED)
Ditambah field untuk tracking keterlambatan
```sql
TAMBAHAN FIELDS:
- is_late: TINYINT - Flag keterlambatan (0/1)
- late_minutes: INT - Jumlah menit terlambat
- working_hours: DECIMAL(5,2) - Total jam kerja hari ini
- overtime_hours: DECIMAL(5,2) - Jam lembur (default: 0)
- notes: TEXT - Catatan
- updated_at: TIMESTAMP (BARU)
```

### Tabel `payrolls` (MODIFIED)
Ditambah field untuk tracking deduction
```sql
TAMBAHAN FIELDS:
- late_deduction: DECIMAL(12,2) - Pengurangan gaji karena keterlambatan
- absent_deduction: DECIMAL(12,2) - Pengurangan gaji karena tidak hadir
- total_late_days: INT - Total hari terlambat dalam periode
- total_absent_days: INT - Total hari tidak hadir dalam periode
```

---

## 🕐 ATTENDANCE ENDPOINTS

### 1. CHECK IN
**Endpoint**: `POST /api/attendance/checkin`

**Headers**:
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response**:
```json
{
  "message": "Check-in successful but LATE",
  "employee_id": 1,
  "date": "2026-01-12",
  "check_in": "08:15:30",
  "is_late": true,
  "late_minutes": 15,
  "standard_check_in": "08:00:00"
}
```

**Logic**:
- Otomatis membaca jam check-in
- Membandingkan dengan standard check-in time (08:00)
- Jika terlambat, set `is_late = 1` dan hitung `late_minutes`
- Jika sudah check-in hari ini, reject dengan error

---

### 2. CHECK OUT
**Endpoint**: `POST /api/attendance/checkout`

**Headers**:
```json
{
  "Authorization": "Bearer <token>"
}
```

**Response**:
```json
{
  "message": "Check-out successful",
  "employee_id": 1,
  "date": "2026-01-12",
  "check_in": "08:15:30",
  "check_out": "16:00:00",
  "is_late": true,
  "late_minutes": 15,
  "working_hours": 7.75
}
```

**Logic**:
- Otomatis hitung `working_hours` = check_out_time - check_in_time
- Hanya bisa checkout jika sudah check-in
- Jika sudah checkout, reject dengan error

---

### 3. GET TODAY'S ATTENDANCE STATUS
**Endpoint**: `GET /api/attendance/today`

**Response**:
```json
{
  "message": "Attendance status for today",
  "date": "2026-01-12",
  "check_in": "08:15:30",
  "check_out": "16:00:00",
  "status": "hadir",
  "is_late": true,
  "late_minutes": 15,
  "working_hours": 7.75
}
```

---

### 4. GET MY ATTENDANCE HISTORY
**Endpoint**: `GET /api/attendance/my-history?month=1&year=2026&limit=30`

**Query Parameters**:
- `month`: INT (optional) - Bulan (1-12)
- `year`: INT (optional) - Tahun
- `limit`: INT (default: 30) - Jumlah record

**Response**:
```json
{
  "message": "Attendance history retrieved successfully",
  "total": 5,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "date": "2026-01-12",
      "check_in": "08:15:30",
      "check_out": "16:00:00",
      "status": "hadir",
      "is_late": true,
      "late_minutes": 15,
      "working_hours": 7.75
    },
    // ... more records
  ]
}
```

---

### 5. GET ATTENDANCE SUMMARY (PEGAWAI)
**Endpoint**: `GET /api/attendance/my-summary?month=1&year=2026`

**Query Parameters**:
- `month`: INT (optional)
- `year`: INT (optional)

**Response**:
```json
{
  "message": "Attendance summary retrieved successfully",
  "period": "1/2026",
  "data": {
    "total_days": 20,
    "late_days": 5,
    "absent_days": 2,
    "present_days": 13,
    "permission_days": 3,
    "sick_days": 2,
    "total_late_minutes": 75,
    "avg_working_hours": 7.45
  }
}
```

---

### 6. GET ALL EMPLOYEES ATTENDANCE (HR/Admin)
**Endpoint**: `GET /api/attendance/all?date=2026-01-12&month=1&year=2026&employee_id=1`

**Roles**: `hr`, `atasan`, `admin`, `finance`

**Query Parameters**:
- `date`: DATE (optional)
- `month`: INT (optional)
- `year`: INT (optional)
- `employee_id`: INT (optional)

**Response**:
```json
{
  "message": "Attendance data retrieved successfully",
  "total": 50,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "date": "2026-01-12",
      "check_in": "08:15:30",
      "check_out": "16:00:00",
      "status": "hadir",
      "is_late": true,
      "late_minutes": 15,
      "working_hours": 7.75
    },
    // ... more records
  ]
}
```

---

### 7. GET ATTENDANCE SUMMARY ALL EMPLOYEES (HR/Admin)
**Endpoint**: `GET /api/attendance/summary/all?month=1&year=2026`

**Roles**: `hr`, `admin`, `finance`

**Query Parameters**:
- `month`: INT (optional)
- `year`: INT (optional)

**Response**:
```json
{
  "message": "Attendance summary for all employees retrieved successfully",
  "period": "1/2026",
  "total_employees": 10,
  "data": [
    {
      "employee_id": 1,
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "total_days": 20,
      "late_days": 5,
      "absent_days": 2,
      "present_days": 13,
      "permission_days": 3,
      "sick_days": 2,
      "total_late_minutes": 75,
      "avg_working_hours": 7.45
    },
    // ... more employees
  ]
}
```

---

### 8. UPDATE ATTENDANCE STATUS (HR/Admin)
**Endpoint**: `PUT /api/attendance/:id/status`

**Roles**: `hr`, `atasan`, `admin`, `finance`

**Request Body**:
```json
{
  "status": "sakit"
}
```

**Valid Statuses**: `hadir`, `izin`, `sakit`, `alpha`

**Response**:
```json
{
  "message": "Attendance status updated successfully",
  "id": 1,
  "status": "sakit"
}
```

---

## 💰 PAYROLL ENDPOINTS

### LATE DEDUCTION CALCULATION

**Formula**:
```
Gaji Harian = Gaji Pokok / 30 hari
Gaji Per Jam = Gaji Harian / 8 jam
Late Deduction = (Total Late Minutes / 60) × Gaji Per Jam × 2%
```

**Contoh**:
- Gaji Pokok: Rp 10.000.000
- Gaji Harian: Rp 333.333
- Gaji Per Jam: Rp 41.667
- Total Terlambat: 75 menit = 1.25 jam
- Late Deduction: 1.25 × 41.667 × 0.02 = Rp 1.042

---

### 1. GENERATE PAYROLL
**Endpoint**: `POST /api/payroll/generate`

**Roles**: `hr`, `admin`, `finance`

**Request Body**:
```json
{
  "employee_id": 1,
  "period_month": 1,
  "period_year": 2026
}
```

**Response**:
```json
{
  "message": "Payroll generated successfully",
  "payroll_id": 1,
  "employee": {
    "id": 1,
    "name": "John Doe"
  },
  "period": "1/2026",
  "details": {
    "basic_salary": 10000000,
    "reimbursement_total": 500000,
    "late_deduction": 1042,
    "absent_deduction": 333333,
    "total_deduction": 334375,
    "net_salary": 10165625,
    "attendance_summary": {
      "total_late_minutes": 75,
      "total_absent_days": 1
    }
  }
}
```

**Logic**:
1. Ambil data gaji pokok dari employees
2. Hitung total late minutes dari tabel attendance (bulan tertentu)
3. Hitung total absent days dari tabel attendance
4. Kalkulasi late_deduction dan absent_deduction
5. Ambil total reimbursement yang sudah approved
6. Hitung net_salary = basic_salary + reimbursement - deduction
7. Simpan/update ke tabel payrolls dengan status='draft'

---

### 2. GET PAYROLL DETAIL
**Endpoint**: `GET /api/payroll/:id`

**Roles**: `hr`, `admin`, `finance`, `pegawai` (hanya milik sendiri)

**Response**:
```json
{
  "message": "Payroll data retrieved successfully",
  "data": {
    "id": 1,
    "employee_id": 1,
    "employee_code": "EMP001",
    "employee_name": "John Doe",
    "period_month": 1,
    "period_year": 2026,
    "basic_salary": 10000000,
    "allowance": 0,
    "reimbursement_total": 500000,
    "late_deduction": 1042,
    "absent_deduction": 333333,
    "deduction": 334375,
    "total_late_days": 5,
    "total_absent_days": 1,
    "net_salary": 10165625,
    "status": "draft",
    "published_at": null,
    "claimed_at": null
  }
}
```

---

### 3. GET PAYROLL BY EMPLOYEE
**Endpoint**: `GET /api/payroll/employee/:employee_id?month=1&year=2026`

**Roles**: `hr`, `admin`, `finance`, `pegawai`

**Query Parameters**:
- `month`: INT (optional)
- `year`: INT (optional)

**Response**:
```json
{
  "message": "Payroll data retrieved successfully",
  "total": 1,
  "data": [
    {
      "id": 1,
      "employee_id": 1,
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "period_month": 1,
      "period_year": 2026,
      "basic_salary": 10000000,
      "reimbursement_total": 500000,
      "late_deduction": 1042,
      "absent_deduction": 333333,
      "deduction": 334375,
      "net_salary": 10165625,
      "status": "draft"
    }
  ]
}
```

---

### 4. PUBLISH PAYROLL
**Endpoint**: `PUT /api/payroll/:id/publish`

**Roles**: `hr`, `admin`, `finance`

**Response**:
```json
{
  "message": "Payroll published successfully",
  "id": 1
}
```

**Flow**:
1. HR/Finance membuat payroll (status='draft')
2. Cek & validasi semua data
3. Publish payroll (status='published', set published_at)
4. Pegawai bisa lihat dan claim payroll

---

### 5. CLAIM PAYROLL
**Endpoint**: `PUT /api/payroll/:id/claim`

**Roles**: `pegawai`

**Response**:
```json
{
  "message": "Payroll claimed successfully",
  "id": 1
}
```

**Logic**:
- Hanya bisa claim payroll yang status='published'
- Hanya bisa claim payroll milik sendiri
- Set status='claimed', set claimed_at=NOW()

---

## 📊 WORKFLOW EXAMPLE

### Scenario: John Doe (EMP001) - Januari 2026

**Hari 1 (2026-01-12)**:
```
08:15 - Check In (LATE 15 menit)
16:00 - Check Out

Attendance Record:
- check_in: 08:15
- check_out: 16:00
- is_late: 1
- late_minutes: 15
- working_hours: 7.75
```

**Hari 2 (2026-01-13)**:
```
Tidak masuk (alpha)

Attendance Record:
- status: alpha
```

**Hari 3-20**:
```
Check in dan out normal
(plus 4 hari terlambat dengan late_minutes bervariasi)
```

**End of Month - Generate Payroll**:
```
Total Late Days: 5
Total Late Minutes: 75
Total Absent Days: 1
Reimbursement Approved: Rp 500.000

Deduction:
- Late Deduction: Rp 1.042 (dari 75 menit)
- Absent Deduction: Rp 333.333 (dari 1 hari)
- Total Deduction: Rp 334.375

Net Salary: Rp 10.165.625
```

---

## 🔧 CONFIGURATION

### Late Deduction Config (dalam payroll.js)
```javascript
const LATE_DEDUCTION_CONFIG = {
    per_minute: 5000, // Rp 5.000 per menit (bisa diaktifkan)
    per_hour_percentage: 0.02, // 2% dari hourly rate (aktif)
};
```

**Bisa diubah sesuai kebijakan perusahaan!**

---

## ✅ TODO CHECKLIST
- [x] Database schema update
- [x] Attendance check-in dengan late detection
- [x] Attendance check-out dengan working hours calculation
- [x] Attendance summary (pegawai & all)
- [x] Payroll generation dengan late deduction
- [x] Payroll publish & claim flow
- [ ] Notification untuk pegawai yang terlambat
- [ ] Export payroll to PDF/Excel
- [ ] Dashboard analytics
