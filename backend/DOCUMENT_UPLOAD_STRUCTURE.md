## Dokumentasi Sistem Upload Dokumen Kandidat

### Struktur Folder Upload yang Baru

Setiap dokumen kandidat disimpan dalam struktur folder terorganisir per user:

```
uploads/candidate_documents/
│
├── ahmad_wijaya/                              # Folder per kandidat (nama dari user, format: lowercase_underscore)
│   ├── profile_photo/                         # Folder untuk foto profil
│   │   └── profile.jpg
│   │
│   ├── LamaranDeveloper_17032026/            # Folder per lamaran (format: Lamaran{Posisi}_{Tanggal})
│   │   ├── cv_file-1710700000000-123456.pdf
│   │   ├── portfolio_file-1710700000001-789012.zip
│   │   ├── ijazah_file-1710700000002-345678.pdf
│   │   ├── transcript_file-1710700000003-901234.pdf
│   │   ├── certificate_file-1710700000004-567890.pdf
│   │   ├── ktp_file-1710700000005-123456.pdf
│   │   └── photo_file-1710700000006-789012.jpg
│   │
│   └── LamaranUIUXDesigner_17032026/         # Lamaran kedua - position berbeda
│       ├── cv_file-1710700100000-123456.pdf
│       ├── portfolio_file-1710700100001-789012.zip
│       ├── design_portfolio_file-1710700100002-345678.pdf
│       └── ...dokumen lainnya
│
└── siti_nurhaliza/                            # Kandidat lain
    ├── profile_photo/
    │   └── profile.png
    │
    └── LamaranGraphicDesigner_17032026/
        ├── cv_file-...
        └── ...
```

### API Endpoints

#### 1. Upload Profile Photo
**Endpoint:** `POST /api/candidates/upload-photo`  
**Auth:** Required (kandidat)  
**Body:** FormData dengan field `photo` (image file)  

**Response:**
```json
{
  "message": "Profile photo uploaded successfully",
  "photo": "uploads/candidate_documents/ahmad_wijaya/profile_photo/profile.jpg",
  "filename": "profile.jpg"
}
```

**Catatan:**
- File akan otomatis disimpan di folder `{candidateName}/profile_photo/`
- Nama file dijamin unik dan safe
- User photo di database akan di-update dengan path baru

#### 2. Apply to Job (dengan dokumen)
**Endpoint:** `POST /api/candidates/apply`  
**Auth:** Required (kandidat)  
**Body:** FormData dengan:
- `job_opening_id`: ID lowongan (required)
- `cover_letter`: Surat lamaran (optional)
- File fields (optional sesuai posisi):
  - `cv_file`
  - `portfolio_file`
  - `ijazah_file`
  - `transcript_file`
  - `certificate_file`
  - `ktp_file`
  - `photo_file`
  - `design_portfolio_file`
  - `marketing_campaign_file`
- Text fields (optional):
  - `github_repo`: URL ke GitHub
  - `youtube_video`: URL ke YouTube
  
**Response:**
```json
{
  "message": "Application submitted successfully",
  "application_id": 123
}
```

**Error Response Jika Dokumen Tidak Lengkap:**
```json
{
  "message": "Missing required documents",
  "missingDocuments": [
    {
      "fieldName": "cv_file",
      "label": "CV / Resume",
      "description": "Curriculum Vitae atau Resume Anda"
    },
    {
      "fieldName": "github_repo",
      "label": "Repository GitHub / GitLab",
      "description": "Link ke repository atau profil GitHub/GitLab Anda"
    }
  ],
  "requiredCount": 11,
  "uploadedCount": 8
}
```

### Penjelasan Folder Naming

#### Candidate Folder Name
**Format:** `{candidate_name_lowercase_underscore}`

**Contoh:**
- "Ahmad Wijaya" → `ahmad_wijaya`
- "Siti Nur Haliza" → `siti_nur_haliza`
- "John O'Connor" → `john_oconnor` (special char dihapus)

**Fungsi:** PHP function `generateSafeFolderName($name)`
- Convert ke lowercase
- Ganti spasi dengan underscore
- Hapus special characters
- Max 50 characters

#### Application Folder Name
**Format:** `Lamaran{PosisiNama}_{Tanggal}`

**Contoh:**
- Lamaran untuk posisi "Developer" pada tanggal 17/03/2026 → `LamaranDeveloper_17032026`
- Lamaran untuk posisi "UI/UX Designer" pada tanggal 17/03/2026 → `LamaranUIUXDesigner_17032026`
- Lamaran untuk posisi "Marketing & Sales Manager" → `LamaranMarketing_17032026`

**Fungsi:** PHP function `getApplicationFolderName($positionName, $date)`
- Position name: lowercase, hapus spasi, hapus special char
- Capitalize first letter
- Append dengan tanggal format: DDMMYYYY

### Path yang Disimpan di Database

Saat dokumen di-upload, path yang disimpan di kolom aplikasi adalah:

```
uploads/candidate_documents/{candidateName}/{applicationFolderName}/{filename}
```

**Contoh:**
```
uploads/candidate_documents/ahmad_wijaya/LamaranDeveloper_17032026/cv_file-1710700000000-123456.pdf
uploads/candidate_documents/ahmad_wijaya/LamaranDeveloper_17032026/portfolio_file-1710700000001-789012.zip
```

### Frontend Integration

#### Upload Profile Photo
```javascript
const formData = new FormData();
formData.append('photo', fileInput.files[0]);

await axios.post('/api/candidates/upload-photo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

#### Apply to Job
```javascript
const formData = new FormData();
formData.append('job_opening_id', jobId);
formData.append('cover_letter', coverLetter);
formData.append('cv_file', cvFile);
formData.append('portfolio_file', portfolioFile);
formData.append('github_repo', githubUrl);
// ... dokumen lainnya

await axios.post('/api/candidates/apply', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### Penanganan File Access

Untuk mengakses file yang di-upload:
```
GET http://localhost:5000/uploads/candidate_documents/ahmad_wijaya/profile_photo/profile.jpg
GET http://localhost:5000/uploads/candidate_documents/ahmad_wijaya/LamaranDeveloper_17032026/cv_file-...pdf
```

### Advantages dari Struktur Baru

✅ **Organized per User:** Semua dokumen kandidat terorganisir dalam satu folder  
✅ **Multiple Applications:** Setiap lamaran punya folder tersendiri, memudahkan tracking  
✅ **Profile Photo Terpisah:** Foto profil terpisah dari dokumen lamaran  
✅ **Easy Cleanup:** Untuk delete aplikasi, cukup delete satu folder  
✅ **Scalability:** Struktur ini mendukung ratusan ribu kandidat  
✅ **Analytics-Friendly:** Mudah untuk menghitung jumlah dokumen per kandidat/lamaran  

### Backup & Migration

Jika ada existing dokumen di struktur lama:

```sql
-- Query untuk get existing files
SELECT id, candidate_id, cv_file, portfolio_file, ... 
FROM applications 
WHERE cv_file IS NOT NULL;
```

Dapat di-migrate dengan script yang:
1. Get candidate name dari candidate_id
2. Generate target folder path
3. Move files ke folder baru
4. Update database dengan path baru

### Future Enhancements

1. **File Deduplication:** Jika candidate upload file sama berkali-kali, bisa optimize dengan symlink
2. **Compression:** Compress folder lamaran sebelum di-download
3. **Virus Scanning:** Scan uploaded files with antivirus
4. **S3 Integration:** Move ke cloud storage (AWS S3) untuk scaling
5. **CDN:** Serve via CDN untuk faster downloads
