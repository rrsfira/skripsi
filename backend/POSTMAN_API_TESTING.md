# API Testing Guide - Postman Collection

Base URL: `http://localhost:5000`

---

## 🔐 Authentication Flow

### 1. Register Staff (Admin Only)

**Endpoint:** `POST /api/auth/register/staff`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "name": "John Doe",
    "email": "john.doe@company.com",
    "username": "johndoe",
    "password": "password123",
    "roles": ["pegawai"],
    "phone": "081234567890",
    "photo": "john.jpg",
    "full_name": "John Doe",
    "position_id": 6,
    "join_date": "2026-01-15",
    "basic_salary": 5000000,
    "employment_status": "permanent"
}
```

**Response:**

```json
{
    "message": "Staff registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": 1,
    "employee_id": 1,
    "employee_code": "EMP001"
}
```

---

### 2. Register Staff with Multiple Roles (Admin Only)

**Endpoint:** `POST /api/auth/register/staff`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "name": "Jane Smith",
    "email": "jane.smith@company.com",
    "username": "janesmith",
    "password": "password123",
    "roles": ["hr"],
    "phone": "081234567891",
    "full_name": "Jane Smith",
    "position_id": 12,
    "join_date": "2026-01-10",
    "employment_status": "permanent"
}
```

**Note:** Role "hr" akan otomatis mendapat role "pegawai" juga

---

### 3. Register Candidate (Public)

**Endpoint:** `POST /api/auth/register/candidate`  
**Headers:**

```json
{
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "name": "Mike Johnson",
    "email": "mike.johnson@email.com",
    "username": "mikejohnson",
    "password": "password123",
    "phone": "081234567892",
    "photo": "mike.jpg"
}
```

**Response:**

```json
{
    "message": "Candidate registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": 3
}
```

---

### 4. Login

**Endpoint:** `POST /api/auth/login`  
**Headers:**

```json
{
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "email": "john.doe@company.com",
    "password": "password123"
}
```

**Response:**

```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "roles": ["pegawai"],
    "name": "John Doe",
    "email": "john.doe@company.com",
    "username": "johndoe",
    "user_id": 1,
    "phone": "081234567890",
    "photo": "john.jpg",
    "status": "active"
}
```

---

### 5. Logout

**Endpoint:** `POST /api/auth/logout`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Response:**

```json
{
    "message": "Logged out successfully"
}
```

---

### 6. Admin Reset Password

**Endpoint:** `PUT /api/auth/reset-password/:userId`  
**Example:** `PUT /api/auth/reset-password/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "newPassword": "newpassword123"
}
```

**Response:**

```json
{
    "message": "Password reset successfully",
    "user": "John Doe"
}
```

---

## 👤 Profile Management

### 7. Get My Profile

**Endpoint:** `GET /api/profile`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john.doe@company.com",
        "username": "johndoe",
        "phone": "081234567890",
        "photo": "john.jpg",
        "status": "active",
        "created_at": "2026-01-12T10:00:00.000Z"
    },
    "employee": {
        "id": 1,
        "user_id": 1,
        "employee_code": "EMP001",
        "full_name": "John Doe",
        "position_id": 6,
        "join_date": "2026-01-15",
        "basic_salary": "5000000.00",
        "employment_status": "permanent",
        "position_name": "Mentor",
        "level": "staff",
        "department_name": "Operations"
    },
    "roles": ["pegawai"]
}
```

---

### 8. Update My Profile

**Endpoint:** `PUT /api/profile`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "name": "John Doe Updated",
    "email": "john.doe@company.com",
    "phone": "081234567899",
    "photo": "john-new.jpg"
}
```

**Response:**

```json
{
    "message": "Profile updated successfully"
}
```

---

### 9. Change My Password

**Endpoint:** `PUT /api/profile/password`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
 
```

**Response:**

```json
{
    "message": "Password updated successfully"
}
```

---

## 👥 Employee Management (Admin/HR)

### 10. Get All Employees

**Endpoint:** `GET /api/employees`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_or_hr_token>"
}
```

**Response:**

```json
{
    "employees": [
        {
            "id": 1,
            "user_id": 1,
            "employee_code": "EMP001",
            "full_name": "John Doe",
            "position_id": 6,
            "join_date": "2026-01-15",
            "basic_salary": "5000000.00",
            "employment_status": "permanent",
            "name": "John Doe",
            "email": "john.doe@company.com",
            "phone": "081234567890",
            "photo": "john.jpg",
            "status": "active",
            "position_name": "Mentor",
            "level": "staff",
            "department_name": "Operations"
        }
    ]
}
```

---

### 11. Get Employee Detail

**Endpoint:** `GET /api/employees/:id`  
**Example:** `GET /api/employees/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_or_hr_token>"
}
```

**Response:**

```json
{
    "employee": {
        "id": 1,
        "user_id": 1,
        "employee_code": "EMP001",
        "full_name": "John Doe",
        "position_id": 6,
        "join_date": "2026-01-15",
        "basic_salary": "5000000.00",
        "employment_status": "permanent",
        "name": "John Doe",
        "email": "john.doe@company.com",
        "username": "johndoe",
        "phone": "081234567890",
        "photo": "john.jpg",
        "status": "active",
        "position_name": "Mentor",
        "level": "staff",
        "base_salary": "5000000.00",
        "department_name": "Operations",
        "department_code": "01"
    }
}
```

---

### 12. Update Employee Data

**Endpoint:** `PUT /api/employees/:id`  
**Example:** `PUT /api/employees/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_or_hr_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "full_name": "John Doe Senior",
    "position_id": 5,
    "basic_salary": 7000000,
    "employment_status": "permanent"
}
```

**Response:**

```json
{
    "message": "Employee data updated successfully"
}
```

---

### 13. Delete Employee

**Endpoint:** `DELETE /api/employees/:id`  
**Example:** `DELETE /api/employees/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_or_hr_token>"
}
```

**Response:**

```json
{
    "message": "Employee deleted successfully"
}
```

---

## ⏰ Attendance Management

### 14. Clock In

**Endpoint:** `POST /api/attendance/checkin`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:** *(Empty object, tidak perlu parameter)*

```json
{}
```

**Response:**

```json
{
    "message": "Check-in successful",
    "employee_id": 1,
    "date": "2026-01-12",
    "check_in": "08:05:00",
    "is_late": 1,
    "late_minutes": 5,
    "standard_check_in": "08:00:00"
}
```

**Note:** Jika datang terlambat, message berubah menjadi "Check-in successful but LATE"

---

### 15. Clock Out

**Endpoint:** `POST /api/attendance/checkout`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:** *(Empty object, tidak perlu parameter)*

```json
{}
```

**Response:**

```json
{
    "message": "Check-out successful",
    "employee_id": 1,
    "date": "2026-01-12",
    "check_out": "16:30:00",
    "working_hours": 8.42,
    "overtime_hours": 0.5
}
```

---

### 16. Get My Attendance

**Endpoint:** `GET /api/attendance/my-attendance`  
**Query Params:** `?month=1&year=2026`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "attendance": [
        {
            "id": 1,
            "employee_id": 1,
            "date": "2026-01-12",
            "check_in": "08:05:00",
            "check_out": "16:30:00",
            "status": "hadir",
            "is_late": 1,
            "late_minutes": 5,
            "working_hours": "8.42",
            "overtime_hours": "0.50",
            "notes": "Mulai kerja hari ini"
        }
    ]
}
```

---

### 17. Get All Attendance (Admin/HR)

**Endpoint:** `GET /api/attendance`  
**Query Params:** `?month=1&year=2026&employee_id=1`  
**Headers:**

```json
{
    "Authorization": "Bearer <admin_or_hr_token>"
}
```

**Response:**

```json
{
    "attendance": [
        {
            "id": 1,
            "employee_id": 1,
            "employee_name": "John Doe",
            "employee_code": "EMP001",
            "date": "2026-01-12",
            "check_in": "08:05:00",
            "check_out": "16:30:00",
            "status": "hadir",
            "is_late": 1,
            "late_minutes": 5,
            "working_hours": "8.42",
            "overtime_hours": "0.50"
        }
    ]
}
```

---

### 18. Submit Leave Request

**Endpoint:** `POST /api/attendance/leave-request`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "leave_type": "cuti_tahunan",
    "start_date": "2026-01-20",
    "end_date": "2026-01-22",
    "reason": "Liburan keluarga",
    "bukti": "surat-cuti.pdf"
}
```

**Response:**

```json
{
    "message": "Leave request submitted successfully",
    "request_id": 1
}
```

---

### 19. Get My Leave Requests

**Endpoint:** `GET /api/attendance/my-leave-requests`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "leave_requests": [
        {
            "id": 1,
            "employee_id": 1,
            "leave_type": "cuti_tahunan",
            "start_date": "2026-01-20",
            "end_date": "2026-01-22",
            "total_days": 3,
            "reason": "Liburan keluarga",
            "bukti": "surat-cuti.pdf",
            "status": "pending",
            "created_at": "2026-01-12T10:00:00.000Z"
        }
    ]
}
```

---

### 20. Approve/Reject Leave Request (Atasan/HR)

**Endpoint:** `PUT /api/attendance/leave-request/:id`  
**Example:** `PUT /api/attendance/leave-request/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <atasan_or_hr_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "status": "approved"
}
```

**Note:** status: "approved" atau "rejected"  
**Response:**

```json
{
    "message": "Leave request approved successfully"
}
```

---

## 💰 Payroll Management

### 21. Generate Payroll (HR/Finance)

**Endpoint:** `POST /api/payroll/generate`  
**Headers:**

```json
{
    "Authorization": "Bearer <hr_or_finance_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "period_month": 1,
    "period_year": 2026
}
```

**Response:**

```json
{
    "message": "Payroll generated for 5 employees",
    "period": "January 2026",
    "total_employees": 5
}
```

---

### 22. Get All Payrolls (HR/Finance)

**Endpoint:** `GET /api/payroll`  
**Query Params:** `?month=1&year=2026`  
**Headers:**

```json
{
    "Authorization": "Bearer <hr_or_finance_token>"
}
```

**Response:**

```json
{
    "payrolls": [
        {
            "id": 1,
            "employee_id": 1,
            "employee_name": "John Doe",
            "employee_code": "EMP001",
            "period_month": 1,
            "period_year": 2026,
            "basic_salary": "5000000.00",
            "allowance": "0.00",
            "reimbursement_total": "0.00",
            "deduction": "0.00",
            "late_deduction": "50000.00",
            "absent_deduction": "0.00",
            "total_late_days": 1,
            "total_absent_days": 0,
            "net_salary": "4950000.00",
            "status": "draft",
            "appeal_status": "none"
        }
    ]
}
```

---

### 23. Get My Payroll

**Endpoint:** `GET /api/payroll/my-payroll`  
**Query Params:** `?month=1&year=2026`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "payroll": {
        "id": 1,
        "employee_id": 1,
        "period_month": 1,
        "period_year": 2026,
        "basic_salary": "5000000.00",
        "allowance": "0.00",
        "reimbursement_total": "0.00",
        "deduction": "0.00",
        "late_deduction": "50000.00",
        "absent_deduction": "0.00",
        "total_late_days": 1,
        "total_absent_days": 0,
        "net_salary": "4950000.00",
        "status": "published",
        "appeal_status": "none",
        "final_amount": null,
        "published_at": "2026-01-12T10:00:00.000Z"
    }
}
```

---

### 24. Publish Payroll (HR/Finance)

**Endpoint:** `PUT /api/payroll/:id/publish`  
**Example:** `PUT /api/payroll/1/publish`  
**Headers:**

```json
{
    "Authorization": "Bearer <hr_or_finance_token>"
}
```

**Response:**

```json
{
    "message": "Payroll published successfully"
}
```

---

### 25. Submit Reimbursement

**Endpoint:** `POST /api/payroll/reimbursement`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "reimbursement_type": "transport",
    "amount": 150000,
    "description": "Biaya transportasi meeting client",
    "attachment": "bukti-transport.jpg"
}
```

**Response:**

```json
{
    "message": "Reimbursement submitted successfully",
    "reimbursement_id": 1
}
```

---

### 26. Get My Reimbursements

**Endpoint:** `GET /api/payroll/my-reimbursements`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "reimbursements": [
        {
            "id": 1,
            "employee_id": 1,
            "reimbursement_type": "transport",
            "amount": "150000.00",
            "description": "Biaya transportasi meeting client",
            "attachment": "bukti-transport.jpg",
            "status": "pending",
            "created_at": "2026-01-12T10:00:00.000Z"
        }
    ]
}
```

---

### 27. Approve/Reject Reimbursement (Atasan/Finance)

**Endpoint:** `PUT /api/payroll/reimbursement/:id`  
**Example:** `PUT /api/payroll/reimbursement/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <atasan_or_finance_token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "status": "approved"
}
```

**Note:** status: "approved" atau "rejected"  
**Response:**

```json
{
    "message": "Reimbursement approved successfully"
}
```

---

### 28. Submit Salary Appeal (Banding Gaji)

**Endpoint:** `POST /api/payroll/salary-appeal`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>",
    "Content-Type": "application/json"
}
```

**Body:**

```json
{
    "payroll_id": 1,
    "reason": "Potongan keterlambatan tidak sesuai. Saya datang jam 08:00 tepat karena ada masalah di jalan",
    "expected_amount": 5000000,
    "supporting_documents": "bukti-macet.jpg"
}
```

**Response:**

```json
{
    "message": "Salary appeal submitted successfully",
    "appeal_id": 1
}
```

---

### 29. Get My Salary Appeals

**Endpoint:** `GET /api/payroll/my-salary-appeals`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "salary_appeals": [
        {
            "id": 1,
            "employee_id": 1,
            "payroll_id": 1,
            "reason": "Potongan keterlambatan tidak sesuai",
            "expected_amount": "5000000.00",
            "supporting_documents": "bukti-macet.jpg",
            "status": "pending",
            "reviewed_by": null,
            "review_notes": null,
            "reviewed_at": null,
            "created_at": "2026-01-12T10:00:00.000Z"
        }
    ]
}
```

---

### 30. Get All Salary Appeals (HR)

**Endpoint:** `GET /api/payroll/salary-appeals`  
**Headers:**

```json
{
    "Authorization": "Bearer <hr_token>"
}
```

**Response:**

```json
{
    "salary_appeals": [
        {
            "id": 1,
            "employee_id": 1,
            "employee_name": "John Doe",
            "employee_code": "EMP001",
            "payroll_id": 1,
            "period": "January 2026",
            "net_salary": "4950000.00",
            "reason": "Potongan keterlambatan tidak sesuai",
            "expected_amount": "5000000.00",
            "supporting_documents": "bukti-macet.jpg",
            "status": "pending",
            "created_at": "2026-01-12T10:00:00.000Z"
        }
    ]
}
```

---

### 31. Approve/Reject Salary Appeal (HR)

**Endpoint:** `PUT /api/payroll/salary-appeal/:id`  
**Example:** `PUT /api/payroll/salary-appeal/1`  
**Headers:**

```json
{
    "Authorization": "Bearer <hr_token>",
    "Content-Type": "application/json"
}
```

**Body (Approve):**

```json
{
    "status": "approved",
    "review_notes": "Approved. Bukti valid, potongan dikembalikan",
    "final_amount": 5000000
}
```

**Body (Reject):**

```json
{
    "status": "rejected",
    "review_notes": "Rejected. CCTV menunjukkan datang jam 08:05"
}
```

**Response:**

```json
{
    "message": "Salary appeal approved successfully"
}
```

---

### 32. Claim Payroll

**Endpoint:** `POST /api/payroll/:id/claim`  
**Example:** `POST /api/payroll/1/claim`  
**Headers:**

```json
{
    "Authorization": "Bearer <token>"
}
```

**Response:**

```json
{
    "message": "Payroll claimed successfully",
    "amount_received": "5000000.00"
}
```

---

## 📊 Testing Flow Recommendations

### **Scenario 1: Complete Employee Onboarding**

1. Admin login (#4)
2. Register new staff (#1)
3. Staff login with new credentials (#4)
4. Staff view profile (#7)
5. Staff update profile photo (#8)
6. Staff change password (#9)

---

### **Scenario 2: Daily Attendance Flow**

1. Employee login (#4)
2. Clock in (#14)
3. (Work during the day)
4. Clock out (#15)
5. View my attendance history (#16)

---

### **Scenario 3: Leave Request Process**

1. Employee login (#4)
2. Submit leave request (#18)
3. View my leave requests (#19)
4. Manager/HR login (#4)
5. Approve leave request (#20)

---

### **Scenario 4: Monthly Payroll Process**

1. HR/Finance login (#4)
2. Generate payroll for the month (#21)
3. Review all payrolls (#22)
4. Publish payroll (#24)
5. Employee login (#4)
6. View my payroll (#23)
7. Claim payroll (#32)

---

### **Scenario 5: Reimbursement Process**

1. Employee login (#4)
2. Submit reimbursement (#25)
3. View my reimbursements (#26)
4. Finance login (#4)
5. Approve reimbursement (#27)
6. (Reimbursement included in next payroll)

---

### **Scenario 6: Salary Appeal Process**

1. Employee login (#4)
2. View my payroll (#23)
3. Submit salary appeal (#28)
4. View my salary appeals (#29)
5. HR login (#4)
6. View all salary appeals (#30)
7. Review and approve/reject appeal (#31)
8. Employee claim final payroll (#32)

---

### **Scenario 7: Admin Employee Management**

1. Admin login (#4)
2. View all employees (#10)
3. View employee detail (#11)
4. Update employee data (#12)
5. Reset employee password (if forgot) (#6)

---

### **Scenario 8: Forgot Password Recovery**

1. Employee forgot password
2. Contact admin
3. Admin login (#4)
4. Admin reset employee password (#6)
5. Employee login with new password (#4)
6. Employee change password (#9)

---

## 🔑 Test Users Setup

Before testing, create these users:

1. **Admin User**

    - Email: admin@company.com
    - Password: admin123
    - Roles: ["admin"]

2. **HR User**

    - Email: hr@company.com
    - Password: hr123
    - Roles: ["hr"]

3. **Finance User**

    - Email: finance@company.com
    - Password: finance123
    - Roles: ["finance"]

4. **Manager/Atasan**

    - Email: manager@company.com
    - Password: manager123
    - Roles: ["atasan"]

5. **Regular Employee**
    - Email: employee@company.com
    - Password: emp123
    - Roles: ["pegawai"]

---

## 📝 Notes

-   All tokens expire in 1 hour
-   After logout, token is blacklisted and cannot be reused
-   Admin can reset any user's password without knowing old password
-   Pegawai can only update their own profile and password
-   HR/Finance can manage payroll and reimbursements
-   Atasan can approve leave requests and reimbursements
-   Salary appeals can only be submitted for published payrolls
-   Payroll must be published before employees can claim

---

## ⚠️ Common Error Responses

**401 Unauthorized:**

```json
{
    "message": "Token expired"
}
```

**403 Forbidden:**

```json
{
    "message": "Access denied"
}
```

**404 Not Found:**

```json
{
    "message": "User not found"
}
```

**409 Conflict:**

```json
{
    "message": "Email already registered"
}
```

**500 Server Error:**

```json
{
    "message": "Server error"
}
```
