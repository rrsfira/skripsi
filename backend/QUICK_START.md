# 🚀 QUICK START - Attendance & Payroll dengan Late Detection

## 📋 Apa yang telah diimplementasikan?

Sistem absensi lengkap dengan:
- ✅ Deteksi keterlambatan otomatis (jam 08:00 standard)
- ✅ Perhitungan jam kerja otomatis
- ✅ Deduction gaji otomatis untuk keterlambatan & tidak hadir
- ✅ Integrasi penuh dengan payroll
- ✅ Summary & analytics untuk HR

---

## 📦 File-file yang Diubah/Dibuat

### Database
- **apk_pegawai (4).sql** - Database schema dengan tabel baru & field baru
- **migration_late_detection.sql** - Script migration (jalankan ini)

### Backend
- **controllers/attendance.js** - Update dengan late detection
- **controllers/payroll.js** - BARU: Payroll dengan auto deduction
- **server.js** - Register payroll routes

### Dokumentasi
- **IMPLEMENTATION_SUMMARY.md** - Overview lengkap
- **ATTENDANCE_PAYROLL_API.md** - API documentation
- **ATTENDANCE_TESTING.md** - Testing guide (14 test cases)
- **QUICK_START.md** - Ini!

---

## 🔧 Setup (3 Steps)

### Step 1: Database Migration
```bash
cd backend
mysql -u root -p apk_pegawai < database/migration_late_detection.sql
```

### Step 2: Verify
```sql
-- Check working_hours table
SELECT * FROM working_hours;

-- Check attendance fields
DESCRIBE attendance;  
-- Harus ada: is_late, late_minutes, working_hours, overtime_hours, notes

-- Check payrolls fields
DESCRIBE payrolls;
-- Harus ada: late_deduction, absent_deduction, total_late_days, total_absent_days
```

### Step 3: Start Server
```bash
node server.js
# Server running on port 5000
```

---

## 🕐 Attendance Flow

### Pegawai Check-In (07:50 - Tepat Waktu)
```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <TOKEN>"
```
Response: `is_late: false, late_minutes: 0`

### Pegawai Check-In (08:15 - Terlambat 15 menit)
```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer <TOKEN>"
```
Response: `is_late: true, late_minutes: 15` ⚠️

### Pegawai Check-Out
```bash
curl -X POST http://localhost:5000/api/attendance/checkout \
  -H "Authorization: Bearer <TOKEN>"
```
Response: `working_hours: 7.75` ✅

### Lihat Status Hari Ini
```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer <TOKEN>"
```

### Lihat Summary Bulan Ini
```bash
curl -X GET "http://localhost:5000/api/attendance/my-summary?month=1&year=2026" \
  -H "Authorization: Bearer <TOKEN>"
```
Response: `late_days: 5, absent_days: 1, total_late_minutes: 75`

---

## 💰 Payroll Flow

### HR Buat Payroll (Otomatis Hitung Deduction)
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

Response:
```json
{
  "basic_salary": 10000000,
  "late_deduction": 1458,
  "absent_deduction": 333333,
  "net_salary": 10165625,
  "status": "draft"
}
```

### HR Publish Payroll
```bash
curl -X PUT http://localhost:5000/api/payroll/1/publish \
  -H "Authorization: Bearer <HR_TOKEN>"
```
Status berubah: `draft` → `published`

### Pegawai Claim Payroll
```bash
curl -X PUT http://localhost:5000/api/payroll/1/claim \
  -H "Authorization: Bearer <PEGAWAI_TOKEN>"
```
Status berubah: `published` → `claimed` ✅

---

## 🔢 Deduction Formula

### Late Deduction
```
Formula: (Total Late Minutes / 60) × Hourly Rate × 2%

Contoh:
- Basic Salary: Rp 10.000.000
- Daily Salary: Rp 10.000.000 / 30 = Rp 333.333
- Hourly Rate: Rp 333.333 / 8 = Rp 41.667
- Late Minutes: 75 (1,25 jam)
- Late Deduction: (75/60) × 41.667 × 2% = Rp 1.042
```

### Absent Deduction
```
Formula: Absent Days × Daily Salary

Contoh:
- Absent Days: 1
- Daily Salary: Rp 333.333
- Absent Deduction: Rp 333.333
```

### Net Salary
```
Net Salary = Basic Salary + Reimbursement - (Late Deduction + Absent Deduction)

Contoh:
Net = 10.000.000 + 500.000 - (1.042 + 333.333) = 10.165.625
```

---

## 📊 Key Features

### Untuk Pegawai
- ✅ Check-in/out tracking
- ✅ Lihat status hari ini
- ✅ Lihat summary attendance (berapa hari terlambat, dll)
- ✅ Lihat payroll & detail deduction
- ✅ Claim payroll yang sudah dipublish

### Untuk HR/Admin
- ✅ Lihat attendance semua pegawai
- ✅ Manual update status attendance (izin, sakit)
- ✅ Generate payroll otomatis dengan deduction
- ✅ Publish payroll
- ✅ Lihat summary attendance semua pegawai

---

## 📈 Database Changes

### Tabel `working_hours` (BARU)
```sql
- check_in_time: 08:00:00 (standard)
- check_out_time: 16:00:00 (standard)
- grace_period_minutes: 0
- is_default: 1 (active)
```

### Tabel `attendance` (ADD FIELDS)
```sql
- is_late: 1 atau 0
- late_minutes: jumlah menit
- working_hours: jam kerja hari itu
- overtime_hours: jam lembur
- notes: catatan
```

### Tabel `payrolls` (ADD FIELDS)
```sql
- late_deduction: Rp
- absent_deduction: Rp
- total_late_days: int
- total_absent_days: int
```

---

## 🧪 Test Cepat

### 1. Check-in (Terlambat)
```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer $(cat token.txt)" \
  -H "Content-Type: application/json"
```
Expected: `"is_late": true`

### 2. Check-out
```bash
curl -X POST http://localhost:5000/api/attendance/checkout \
  -H "Authorization: Bearer $(cat token.txt)"
```
Expected: `"working_hours": 7.75` (atau angka lain)

### 3. Generate Payroll
```bash
curl -X POST http://localhost:5000/api/payroll/generate \
  -H "Authorization: Bearer $(cat hr_token.txt)" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":1,"period_month":1,"period_year":2026}'
```
Expected: `"late_deduction": 1042` (atau angka sesuai hitungan)

---

## ⚙️ Configuration

### Ubah Jam Kerja Standard
```sql
UPDATE working_hours 
SET check_in_time = '08:30:00', check_out_time = '17:00:00'
WHERE is_default = 1;
```

### Ubah Percentage Deduction
Edit **controllers/payroll.js** line 10:
```javascript
const LATE_DEDUCTION_CONFIG = {
    per_hour_percentage: 0.02, // Ubah 2% jadi berapa %?
};
```

---

## 📚 Dokumentasi Lengkap

1. **IMPLEMENTATION_SUMMARY.md** - Overview & architecture
2. **ATTENDANCE_PAYROLL_API.md** - Semua endpoint (8 attendance + 5 payroll)
3. **ATTENDANCE_TESTING.md** - Testing guide (14 test cases dengan CURL)
4. **Ini file** - Quick start

---

## ❓ FAQ

**Q: Bagaimana jika pegawai tidak check-in?**
A: Status akan `alpha` (tidak hadir). Akan di-deduct gajinya.

**Q: Bisa ubah late detection jam berapa?**
A: Ya, ubah di `working_hours` table atau config parameter.

**Q: Berapa % deduction untuk keterlambatan?**
A: Default 2% dari hourly rate. Bisa ubah di `payroll.js` line 10.

**Q: Apakah cuti/izin dideduct?**
A: Tidak. Hanya `alpha` (tidak hadir) yang dideduct.

**Q: Bisa lihat breakdown deduction di payroll?**
A: Ya, bisa lihat `late_deduction` dan `absent_deduction` terpisah.

**Q: Test data sudah siap?**
A: Lihat ATTENDANCE_TESTING.md untuk SQL insert sample data.

---

## 🚀 Next Steps

- [ ] Run migration: `mysql < migration_late_detection.sql`
- [ ] Test 1 endpoint check-in
- [ ] Test generate payroll
- [ ] Test flow lengkap (check-in → check-out → payroll → claim)
- [ ] Insert sample attendance data & test summary
- [ ] Customize deduction rate sesuai kebijakan
- [ ] Implementasi fitur tambahan (notification, export, dll)

---

## 💡 Tips

1. **Simpan Token**: Save token untuk testing `echo $TOKEN > token.txt`
2. **Check Timestamp**: Attendance check-in/out perlu format waktu sama dengan server
3. **Monthly**: Payroll perlu di-generate 1x sebulan per employee
4. **Backup**: Jangan lupa backup database sebelum migration!
5. **Monitoring**: Monitor late attendance di endpoint `/api/attendance/summary/all`

---

## ✅ Status

- [x] Database schema updated
- [x] Attendance late detection implemented
- [x] Working hours calculation implemented
- [x] Payroll deduction calculation implemented
- [x] All endpoints working
- [x] Documentation complete
- [x] Testing guide provided

**Status: READY TO USE** ✨

---

**Questions?** Lihat file dokumentasi yang sesuai atau check test cases di ATTENDANCE_TESTING.md
