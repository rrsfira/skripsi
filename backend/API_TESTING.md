# API Testing Guide - Postman

Server: `http://localhost:5000`

---

## 📌 Authentication Endpoints

### 1. Register Candidate (Public)

**POST** `/api/auth/register/candidate`

**Headers:**

```
Content-Type: application/json
```

**Body (raw JSON):**

```json
{
    "name": "John Candidate",
    "email": "john.candidate@example.com",
    "username": "johncand",
    "password": "password123",
    "phone": "08123456789",
    "photo": "https://example.com/photo.jpg"
}
```

**Response Success (201):**

```json
{
    "message": "Candidate registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": 1
}
```

---

### 2. Login

**POST** `/api/auth/login`

**Headers:**

```
Content-Type: application/json
```

**Body (raw JSON):**

```json
{
    "email": "john.candidate@example.com",
    "password": "password123"
}
```

**Response Success (200):**

```json
{
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "roles": ["kandidat"],
    "name": "John Candidate",
    "email": "john.candidate@example.com",
    "username": "johncand",
    "user_id": 1,
    "phone": "08123456789",
    "photo": "https://example.com/photo.jpg",
    "status": "pending"
}
```

---

### 3. Register Staff (Admin Only)

**POST** `/api/auth/register/staff`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer {ADMIN_TOKEN}
```

**Body (raw JSON):**

```json
{
    "name": "Pegawai Baru",
    "email": "pegawai@example.com",
    "username": "pegawai123",
    "password": "password123",
    "phone": "08987654321",
    "photo": "https://example.com/photo.jpg",
    "status": "active",
    "roles": ["pegawai", "atasan"]
}
```

**Response Success (201):**

```json
{
    "message": "User registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": 2
}
```

---

### 4. Logout

**POST** `/api/auth/logout`

**Headers:**

```
Authorization: Bearer {YOUR_TOKEN}
```

**Response Success (200):**

```json
{
    "message": "Logged out successfully"
}
```

---

## 🚀 Testing Steps in Postman

### Step 1: Test Register Candidate

1. Create new request in Postman
2. Set method to **POST**
3. URL: `http://localhost:5000/api/auth/register/candidate`
4. Go to **Headers** tab, add:
    - Key: `Content-Type`
    - Value: `application/json`
5. Go to **Body** tab → Select **raw** → Choose **JSON**
6. Paste the candidate registration JSON
7. Click **Send**
8. Save the token from response

### Step 2: Test Login

1. Create new request
2. Set method to **POST**
3. URL: `http://localhost:5000/api/auth/login`
4. Headers: `Content-Type: application/json`
5. Body (raw JSON): email & password
6. Click **Send**
7. Verify response contains token and user info

### Step 3: Create Admin User in Database

Before testing staff registration, create an admin user manually:

```sql
-- Hash password "admin123" menggunakan bcrypt online atau script
-- Hash: $2a$10$YourHashedPasswordHere

INSERT INTO users (name, email, username, password, phone, status, created_at, updated_at)
VALUES (
  'Admin User',
  'admin@example.com',
  'admin',
  '$2a$10$[PASTE_HASHED_PASSWORD]',
  '08111111111',
  'active',
  NOW(),
  NOW()
);

-- Get role_id for admin
INSERT INTO user_roles (user_id, role_id)
SELECT LAST_INSERT_ID(), id FROM roles WHERE name = 'admin';
```

**Generate Hash Password:**
Visit https://bcrypt-generator.com/

-   Input: `admin123`
-   Rounds: `10`
-   Copy the hash

### Step 4: Login as Admin

1. Use login endpoint with admin credentials
2. Copy the admin token

### Step 5: Test Register Staff

1. Create new request
2. Set method to **POST**
3. URL: `http://localhost:5000/api/auth/register/staff`
4. Headers:
    - `Content-Type: application/json`
    - `Authorization: Bearer {PASTE_ADMIN_TOKEN}`
5. Body: Staff registration JSON with roles array
6. Click **Send**

### Step 6: Test Logout

1. Create new request
2. Set method to **POST**
3. URL: `http://localhost:5000/api/auth/logout`
4. Headers: `Authorization: Bearer {YOUR_TOKEN}`
5. Click **Send**

---

## ⚠️ Common Errors

### 404 Not Found

-   Check URL is correct: `/api/auth/...` not just `/auth/...`
-   Ensure server is running

### 500 Server Error

-   Check database connection in `.env`
-   Verify tables exist (run migration.sql)
-   Check server console for error details

### 409 Conflict

-   Email or username already exists
-   Use different email/username

### 403 Forbidden (Register Staff)

-   Missing or invalid admin token
-   User is not admin role

---

## 📝 Postman Collection Variables

You can set up environment variables in Postman:

-   `baseURL`: `http://localhost:5000`
-   `token`: (save after login)
-   `adminToken`: (save after admin login)

Then use: `{{baseURL}}/api/auth/login`
