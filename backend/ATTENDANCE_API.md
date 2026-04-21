# Attendance API Testing Guide

Server: `http://localhost:5000`

---

## 📌 Attendance Endpoints

### 1. Check In

**POST** `/api/attendance/checkin`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {PEGAWAI_TOKEN}
```

**Response Success (200):**

```json
{
    "message": "Check-in successful",
    "employee_id": 1,
    "date": "2026-01-11",
    "check_in": "08:30:15"
}
```

**Response Error (400):**

```json
{
    "message": "You have already checked in today",
    "check_in": "08:30:15"
}
```

---

### 2. Check Out

**POST** `/api/attendance/checkout`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {PEGAWAI_TOKEN}
```

**Response Success (200):**

```json
{
    "message": "Check-out successful",
    "employee_id": 1,
    "date": "2026-01-11",
    "check_in": "08:30:15",
    "check_out": "17:15:30"
}
```

**Response Error (400):**

```json
{
    "message": "No check-in record found for today. Please check in first."
}
```

---

### 3. Get Today's Attendance Status

**GET** `/api/attendance/today`

**Headers:**

```
Authorization: Bearer {PEGAWAI_TOKEN}
```

**Response Success (200):**

```json
{
    "message": "Attendance status for today",
    "date": "2026-01-11",
    "check_in": "08:30:15",
    "check_out": "17:15:30",
    "status": "hadir"
}
```

---

### 4. Get My Attendance History

**GET** `/api/attendance/my-history?month=1&year=2026&limit=30`

**Headers:**

```
Authorization: Bearer {PEGAWAI_TOKEN}
```

**Query Parameters (optional):**

-   `month` - Filter by month (1-12)
-   `year` - Filter by year (e.g., 2026)
-   `limit` - Limit results (default: 30)

**Response Success (200):**

```json
{
    "message": "Attendance history retrieved successfully",
    "total": 10,
    "data": [
        {
            "id": 1,
            "employee_id": 1,
            "date": "2026-01-11",
            "check_in": "08:30:15",
            "check_out": "17:15:30",
            "status": "hadir",
            "created_at": "2026-01-11T08:30:15.000Z"
        }
    ]
}
```

---

### 5. Get All Employees Attendance (HR/Atasan/Admin)

**GET** `/api/attendance/all?date=2026-01-11`

**Headers:**

```
Authorization: Bearer {HR_OR_ATASAN_TOKEN}
```

**Query Parameters (optional):**

-   `date` - Filter by specific date (YYYY-MM-DD)
-   `month` - Filter by month (1-12)
-   `year` - Filter by year (e.g., 2026)
-   `employee_id` - Filter by specific employee

**Response Success (200):**

```json
{
    "message": "Attendance data retrieved successfully",
    "total": 5,
    "data": [
        {
            "id": 1,
            "employee_id": 1,
            "date": "2026-01-11",
            "check_in": "08:30:15",
            "check_out": "17:15:30",
            "status": "hadir",
            "created_at": "2026-01-11T08:30:15.000Z",
            "employee_code": "EMP001",
            "employee_name": "John Doe",
            "department": "IT",
            "position": "Software Engineer"
        }
    ]
}
```

---

### 6. Update Attendance Status (HR/Atasan/Admin)

**PUT** `/api/attendance/:id/status`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {HR_OR_ATASAN_TOKEN}
```

**URL Example:**

```
http://localhost:5000/api/attendance/1/status
```

**Body (raw JSON):**

```json
{
    "status": "izin"
}
```

**Valid status values:**

-   `hadir` - Present
-   `izin` - Permission/Leave
-   `sakit` - Sick
-   `alpha` - Absent

**Response Success (200):**

```json
{
    "message": "Attendance status updated successfully",
    "id": 1,
    "status": "izin"
}
```

---

## 📝 Postman Testing Flow for Attendance

### Prerequisites

1. User must have **pegawai** role (or admin/hr/atasan/finance which include pegawai)
2. User must have a record in **employees** table with valid `user_id`
3. Get authentication token from login endpoint

### Step 1: Check In (Morning)

1. Login as pegawai and copy token
2. Create POST request to `/api/attendance/checkin`
3. Add Authorization header: `Bearer {TOKEN}`
4. Click Send
5. Verify response contains check_in time

### Step 2: Check Today's Status

1. Create GET request to `/api/attendance/today`
2. Add Authorization header: `Bearer {TOKEN}`
3. Click Send
4. Verify check_in is recorded, check_out is null

### Step 3: Check Out (Evening)

1. Create POST request to `/api/attendance/checkout`
2. Add Authorization header: `Bearer {TOKEN}`
3. Click Send
4. Verify response contains both check_in and check_out times

### Step 4: View My Attendance History

1. Create GET request to `/api/attendance/my-history`
2. Add Authorization header: `Bearer {TOKEN}`
3. Optional: Add query params `?month=1&year=2026`
4. Click Send
5. See all your attendance records

### Step 5: HR Views All Attendance (HR/Atasan Only)

1. Login as HR/Atasan and copy token
2. Create GET request to `/api/attendance/all?date=2026-01-11`
3. Add Authorization header: `Bearer {HR_TOKEN}`
4. Click Send
5. See all employees' attendance for that date

### Step 6: HR Updates Attendance Status (HR/Atasan Only)

1. Create PUT request to `/api/attendance/1/status` (replace 1 with actual attendance id)
2. Add Authorization header: `Bearer {HR_TOKEN}`
3. Add body: `{"status": "izin"}`
4. Click Send
5. Verify status updated successfully

---

## ⚠️ Attendance Specific Errors

### 404 Employee Not Found

```json
{
    "message": "Employee record not found. Please contact HR."
}
```

**Solution:**

-   User doesn't have employee record in `employees` table
-   HR must create employee record first with correct `user_id`

### 400 Already Checked In

```json
{
    "message": "You have already checked in today",
    "check_in": "08:30:15"
}
```

**Solution:**

-   Cannot check in twice on the same day
-   Check today's status first

### 400 No Check-in Record

```json
{
    "message": "No check-in record found for today. Please check in first."
}
```

**Solution:**

-   Must check in before checking out
-   Call check-in endpoint first

### 403 Access Denied

```json
{
    "message": "Access denied"
}
```

**Solution:**

-   User doesn't have required role
-   Check-in/out requires `pegawai` role
-   Viewing all attendance requires `hr`, `atasan`, or `admin` role

---

## 🧪 Sample cURL Commands

### Check In

```bash
curl -X POST http://localhost:5000/api/attendance/checkin \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Check Out

```bash
curl -X POST http://localhost:5000/api/attendance/checkout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Get Today's Status

```bash
curl -X GET http://localhost:5000/api/attendance/today \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get My History

```bash
curl -X GET "http://localhost:5000/api/attendance/my-history?month=1&year=2026" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get All Attendance (HR)

```bash
curl -X GET "http://localhost:5000/api/attendance/all?date=2026-01-11" \
  -H "Authorization: Bearer HR_TOKEN"
```

### Update Status (HR)

```bash
curl -X PUT http://localhost:5000/api/attendance/1/status \
  -H "Authorization: Bearer HR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "izin"}'
```

---

## 💡 Tips

1. **Before testing attendance**: Make sure you have an employee record

    ```sql
    SELECT * FROM employees WHERE user_id = YOUR_USER_ID;
    ```

2. **Check current date format**: The system uses server's current date

    ```javascript
    new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    ```

3. **Time format**: Times are stored in HH:MM:SS format (24-hour)

4. **Multiple check-ins**: Not allowed on the same day - system prevents duplicate check-ins

5. **Role hierarchy**: Remember that admin/hr/atasan/finance roles automatically include pegawai role, so they can also check in/out

6. **Query filters**: When using `/all` endpoint, combine filters:
    - By date: `?date=2026-01-11`
    - By month/year: `?month=1&year=2026`
    - By employee: `?employee_id=1`
    - Combined: `?month=1&year=2026&employee_id=1`
