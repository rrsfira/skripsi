# API Testing Guide - Attendance & Payroll dengan Late Detection

## 🔧 SETUP

### 1. Database Migration
```bash
# Run migration SQL file
mysql -u root -p apk_pegawai < backend/database/migration_late_detection.sql
```

### 2. Start Server
```bash
cd backend
npm install
node server.js
# Server running on port 5000
```

---

## 📝 TEST CASES

### Prerequisites
- User dengan role `pegawai` yang sudah register & login
- User dengan role `hr` atau `admin` untuk testing payroll generation

---

## ✅ TEST 1: CHECK IN (Tepat Waktu)

**Test Case**: Pegawai check-in pada jam 07:50 (10 menit lebih awal)

**Command**:
```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected Response** (Status 200):
```json
{
  "message": "Check-in successful",
  "employee_id": 1,
  "date": "2026-01-12",
  "check_in": "07:50:00",
  "is_late": false,
  "late_minutes": 0,
  "standard_check_in": "08:00:00"
}
```

**Verify in Database**:
```sql
SELECT * FROM attendance 
WHERE employee_id = 1 AND date = '2026-01-12';

-- Expected: is_late = 0, late_minutes = 0
```

---

## ✅ TEST 2: CHECK IN (Terlambat)

**Test Case**: Pegawai check-in pada jam 08:15 (15 menit terlambat)

**Command**:
```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected Response** (Status 200):
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

**Verify in Database**:
```sql
SELECT * FROM attendance 
WHERE employee_id = 1 AND date = '2026-01-12';

-- Expected: is_late = 1, late_minutes = 15
```

---

## ✅ TEST 3: CHECK OUT

**Test Case**: Check out pada jam 16:00

**Prerequisites**:
- Sudah check-in
- Belum check-out

**Command**:
```bash
curl -X POST http://localhost:5000/api/attendance/checkout \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected Response** (Status 200):
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

**Verify in Database**:
```sql
SELECT * FROM attendance 
WHERE employee_id = 1 AND date = '2026-01-12';

-- Expected: working_hours = 7.75 (7 jam 45 menit)
```

---

## ✅ TEST 4: Get Today's Attendance Status

**Command**:
```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response**:
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

## ✅ TEST 5: Get My Attendance Summary (Pegawai)

**Setup**: Insert 10 days attendance dengan variasi:
- 2 hari terlambat (15 menit & 20 menit)
- 1 hari tidak hadir (alpha)
- 1 hari sakit
- 1 hari izin
- 4 hari normal (tepat waktu)

**SQL**:
```sql
-- Insert sample data
INSERT INTO attendance (employee_id, date, check_in, check_out, status, is_late, late_minutes, working_hours) VALUES
(1, '2026-01-01', '08:00:00', '16:00:00', 'hadir', 0, 0, 8.00),
(1, '2026-01-02', '08:00:00', '16:00:00', 'hadir', 0, 0, 8.00),
(1, '2026-01-03', '08:15:00', '16:00:00', 'hadir', 1, 15, 7.75),
(1, '2026-01-04', '08:00:00', '16:00:00', 'hadir', 0, 0, 8.00),
(1, '2026-01-05', '08:00:00', '16:00:00', 'sakit', 0, 0, 8.00),
(1, '2026-01-06', '08:20:00', '16:00:00', 'hadir', 1, 20, 7.67),
(1, '2026-01-07', '08:00:00', '16:00:00', 'izin', 0, 0, 8.00),
(1, '2026-01-08', '08:00:00', '16:00:00', 'hadir', 0, 0, 8.00),
(1, '2026-01-09', NULL, NULL, 'alpha', 0, 0, NULL),
(1, '2026-01-10', '08:00:00', '16:00:00', 'hadir', 0, 0, 8.00);
```

**Command**:
```bash
curl -X GET "http://localhost:5000/api/attendance/my-summary?month=1&year=2026" \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response**:
```json
{
  "message": "Attendance summary retrieved successfully",
  "period": "1/2026",
  "data": {
    "total_days": 10,
    "late_days": 2,
    "absent_days": 1,
    "present_days": 7,
    "permission_days": 1,
    "sick_days": 1,
    "total_late_minutes": 35,
    "avg_working_hours": 7.83
  }
}
```

---

## ✅ TEST 6: Get Attendance Summary - All Employees (HR)

**Command**:
```bash
curl -X GET "http://localhost:5000/api/attendance/summary/all?month=1&year=2026" \
  -H "Authorization: Bearer <HR_TOKEN>"
```

**Expected Response**:
```json
{
  "message": "Attendance summary for all employees retrieved successfully",
  "period": "1/2026",
  "total_employees": 2,
  "data": [
    {
      "employee_id": 1,
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "total_days": 10,
      "late_days": 2,
      "absent_days": 1,
      "present_days": 7,
      "permission_days": 1,
      "sick_days": 1,
      "total_late_minutes": 35,
      "avg_working_hours": 7.83
    },
    {
      "employee_id": 2,
      "employee_code": "EMP002",
      "employee_name": "Jane Smith",
      "total_days": 10,
      "late_days": 0,
      "absent_days": 0,
      "present_days": 10,
      "permission_days": 0,
      "sick_days": 0,
      "total_late_minutes": 0,
      "avg_working_hours": 8.00
    }
  ]
}
```

---

## 💰 TEST 7: Generate Payroll (dengan Late Deduction)

**Setup**:
- Employee: John Doe (EMP001)
- Basic Salary: Rp 10.000.000
- Period: January 2026
- Attendance Summary:
  - Total Late Minutes: 35
  - Total Absent Days: 1
  - Reimbursement Approved: Rp 500.000

**Command**:
```bash
curl -X POST http://localhost:5000/api/payroll/generate \
  -H "Authorization: Bearer <HR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": 1,
    "period_month": 1,
    "period_year": 2026
  }'
```

**Expected Response** (Status 200):
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
    "late_deduction": 1458,
    "absent_deduction": 333333,
    "total_deduction": 334791,
    "net_salary": 10165209,
    "attendance_summary": {
      "total_late_minutes": 35,
      "total_absent_days": 1
    }
  }
}
```

**Calculation Breakdown**:
```
Basic Salary: Rp 10.000.000
Daily Salary: Rp 10.000.000 / 30 = Rp 333.333
Hourly Rate: Rp 333.333 / 8 = Rp 41.667

Late Minutes: 35
Late Deduction: (35 / 60) × Rp 41.667 × 2% = Rp 1.458

Absent Days: 1
Absent Deduction: 1 × Rp 333.333 = Rp 333.333

Total Deduction: Rp 1.458 + Rp 333.333 = Rp 334.791

Net Salary: Rp 10.000.000 + Rp 500.000 - Rp 334.791 = Rp 10.165.209
```

**Verify in Database**:
```sql
SELECT * FROM payrolls 
WHERE employee_id = 1 AND period_month = 1 AND period_year = 2026;

-- Expected:
-- late_deduction = 1458
-- absent_deduction = 333333
-- deduction = 334791
-- net_salary = 10165209
-- status = 'draft'
```

---

## ✅ TEST 8: Get Payroll Detail

**Command**:
```bash
curl -X GET http://localhost:5000/api/payroll/1 \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response**:
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
    "late_deduction": 1458,
    "absent_deduction": 333333,
    "deduction": 334791,
    "total_late_days": 2,
    "total_absent_days": 1,
    "net_salary": 10165209,
    "status": "draft",
    "published_at": null,
    "claimed_at": null,
    "created_at": "2026-01-12 10:00:00",
    "updated_at": "2026-01-12 10:00:00"
  }
}
```

---

## ✅ TEST 9: Publish Payroll

**Command**:
```bash
curl -X PUT http://localhost:5000/api/payroll/1/publish \
  -H "Authorization: Bearer <HR_TOKEN>"
```

**Expected Response** (Status 200):
```json
{
  "message": "Payroll published successfully",
  "id": 1
}
```

**Verify**:
```sql
SELECT status, published_at FROM payrolls WHERE id = 1;
-- Expected: status = 'published', published_at = NOW()
```

---

## ✅ TEST 10: Claim Payroll (Pegawai)

**Command**:
```bash
curl -X PUT http://localhost:5000/api/payroll/1/claim \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response** (Status 200):
```json
{
  "message": "Payroll claimed successfully",
  "id": 1
}
```

**Verify**:
```sql
SELECT status, claimed_at FROM payrolls WHERE id = 1;
-- Expected: status = 'claimed', claimed_at = NOW()
```

---

## ❌ ERROR TEST CASES

### Test 11: Duplicate Check-in
**Command**: Check-in 2x dalam 1 hari
```bash
# First check-in
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"

# Second check-in (same day)
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response** (Status 400):
```json
{
  "message": "You have already checked in today",
  "check_in": "08:15:30",
  "is_late": true,
  "late_minutes": 15
}
```

---

### Test 12: Checkout Without Check-in
**Command**:
```bash
# Clear attendance untuk hari ini
DELETE FROM attendance WHERE employee_id = 1 AND date = CURDATE();

# Try to checkout
curl -X POST http://localhost:5000/api/attendance/checkout \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response** (Status 400):
```json
{
  "message": "No check-in record found for today. Please check in first."
}
```

---

### Test 13: Pegawai View Other's Payroll
**Command**:
```bash
# Logged in as Employee 1, try to view Employee 2's payroll
curl -X GET http://localhost:5000/api/payroll/999 \
  -H "Authorization: Bearer <PEGAWAI_1_TOKEN>"
```

**Expected Response** (Status 404):
```json
{
  "message": "Payroll not found or not yours"
}
```

---

### Test 14: Claim Unpublished Payroll
**Command**:
```bash
# Create but don't publish payroll, then try to claim
curl -X PUT http://localhost:5000/api/payroll/1/claim \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```

**Expected Response** (Status 400):
```json
{
  "message": "Payroll must be published before claiming"
}
```

---

## 📊 SUMMARY TEST MATRIX

| Test | Endpoint | Method | Role | Expected | Status |
|------|----------|--------|------|----------|--------|
| 1 | /checkin | POST | pegawai | is_late=false | ✅ |
| 2 | /checkin | POST | pegawai | is_late=true | ✅ |
| 3 | /checkout | POST | pegawai | working_hours calc | ✅ |
| 4 | /today | GET | pegawai | attendance status | ✅ |
| 5 | /my-summary | GET | pegawai | attendance summary | ✅ |
| 6 | /summary/all | GET | hr/admin | all employees summary | ✅ |
| 7 | /payroll/generate | POST | hr/admin | calculate deduction | ✅ |
| 8 | /payroll/:id | GET | pegawai | payroll detail | ✅ |
| 9 | /payroll/:id/publish | PUT | hr/admin | publish status | ✅ |
| 10 | /payroll/:id/claim | PUT | pegawai | claim status | ✅ |

---

## 🔍 IMPORTANT NOTES

1. **Attendance Data**: Semua waktu check-in/out perlu dalam format `HH:MM:SS`
2. **Late Calculation**: Dibandingkan dengan `08:00:00` (default working hours)
3. **Working Hours**: Otomatis dihitung dari check_out - check_in
4. **Late Deduction**: 2% dari hourly rate × total late hours
5. **Absent Deduction**: 1 absent day = 1 hari gaji
6. **Payroll Flow**: Draft → Publish → Claim
7. **Token**: Semua endpoint (kecuali login) memerlukan Authorization header dengan Bearer token

---

## 🚀 NEXT STEPS

- [ ] Implementasi notification untuk late attendance
- [ ] Export payroll to PDF
- [ ] Dashboard analytics attendance
- [ ] Configurable working hours per department
- [ ] Overtime calculation
