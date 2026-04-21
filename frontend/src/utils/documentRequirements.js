// ========================================
// Position to Required Documents Mapping
// ========================================

const POSITION_DOCUMENT_MAPPING = {    
    // Director
    "director": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "marketing_portfolio_link", "campaign_link", "other_document"]
    },
    
    // Operations Manager
    "operations manager": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    },
    
    // Operations Supervisor
    "operations supervisor": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    },
    
    // Developer (Frontend / Backend / Mobile)
    "developer": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "github_link"],
        optional: ["experience_letter_file", "reference_letter_file" , "other_document"]
    },

    // UI/UX Designer
    "ui/ux designer": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "design_link"],
        optional: ["experience_letter_file", "reference_letter_file", "github_link", "other_document"]
    },

    // Content Creator
    "content creator": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "youtube_link"],
        optional: ["experience_letter_file", "reference_letter_file", "design_link", "marketing_portfolio_link", "campaign_link"]
    },

    // Graphic Designer
    "graphic designer": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "design_link"],
        optional: ["experience_letter_file", "reference_letter_file", "youtube_link", "other_document"]
    },

    // Videographer / Video Editor
    "videographer / video editor": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "youtube_link"],
        optional: ["experience_letter_file", "reference_letter_file", "design_link", "other_document"]
    },
    
    // Marketing & Sales Manager
    "marketing & sales manager": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "marketing_portfolio_link", "campaign_link"],
        optional: ["experience_letter_file", "reference_letter_file", "youtube_link", "other_document"]
    },
    
    // Marketing Leader
    "marketing leader": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "marketing_portfolio_link", "campaign_link"],
        optional: ["experience_letter_file", "reference_letter_file", "youtube_link", "other_document"]
    },
    
    // Business Development
    "business development": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "marketing_portfolio_link", "campaign_link"],
        optional: ["experience_letter_file", "reference_letter_file", "youtube_link", "other_document"]
    },
    
    // Digital Marketing
    "digital marketing": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file", "portfolio_file", "marketing_portfolio_link", "campaign_link"],
        optional: ["experience_letter_file", "reference_letter_file", "youtube_link", "other_document"]
    },
    
    // Finance, Accounting & Tax Manager
    "finance, accounting & tax manager": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    },
    
    // Finance / Accounting Staff
    "finance team": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    },

    // HR & GA Manager
    "hr & ga manager": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    },

    // General Affair
    "general affair": {
        required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
        optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
    }
};


/**
 * Get required documents for a specific position, with optional basePosition for keahlian tambahan
 * @param {string} positionName - Nama posisi utama (misal: Mentor, Project Manager, Developer, dsb)
 * @param {string} [basePosition] - Keahlian tambahan (misal: Developer, Designer, dsb)
 * @returns {object} - Object dengan array required dan optional documents
 */
function getRequiredDocuments(positionName, basePosition = "") {
    const normalized = (positionName || "").toLowerCase().trim();
    const baseNorm = (basePosition || "").toLowerCase().trim();

    // Jika basePosition mengandung 'developer', gunakan mapping dokumen 'developer' saja
    if (baseNorm.includes('developer')) {
        return POSITION_DOCUMENT_MAPPING['developer'] || { required: [], optional: [] };
    }

    // Jika ada basePosition dan posisi mengandung mentor/project manager, gabungkan dokumen
    if ((normalized.startsWith("mentor") || normalized.startsWith("project manager")) && baseNorm) {
        // Gabungkan dokumen sesuai logic mapping
        let mappingKey = normalized;
        if (normalized === "mentor" || normalized === "project manager") {
            mappingKey = normalized + " " + baseNorm;
        } else if (!normalized.includes(baseNorm)) {
            mappingKey = normalized + " " + baseNorm;
        }
        // Coba exact match
        if (POSITION_DOCUMENT_MAPPING[mappingKey]) {
            return POSITION_DOCUMENT_MAPPING[mappingKey];
        }
        // Jika tidak ada, lakukan penggabungan manual
        // Modifier requirement
        const mentorReq = {
            required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
            optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
        };
        const projectManagerReq = {
            required: ["cv_file", "ktp_file", "photo_file", "ijazah_file", "transcript_file", "certificate_file", "skck_file"],
            optional: ["experience_letter_file", "reference_letter_file", "portfolio_file", "other_document"]
        };
        const modifierReq = normalized.startsWith("mentor") ? mentorReq : projectManagerReq;
        // Cari base position di mapping
        let baseReq = null;
        for (const [key, value] of Object.entries(POSITION_DOCUMENT_MAPPING)) {
            if (baseNorm.includes(key) || key.includes(baseNorm)) {
                baseReq = value;
                break;
            }
        }
        if (baseReq) {
            const required = [...new Set([...(modifierReq.required || []), ...(baseReq.required || [])])];
            const optional = [...new Set([...(modifierReq.optional || []), ...(baseReq.optional || [])])];
            const optionalFiltered = optional.filter((f) => !required.includes(f));
            return { required, optional: optionalFiltered };
        }
        return modifierReq;
    }

    // Exact match
    if (POSITION_DOCUMENT_MAPPING[normalized]) {
        return POSITION_DOCUMENT_MAPPING[normalized];
    }

    // Partial match (untuk variasi nama)
    for (const [key, value] of Object.entries(POSITION_DOCUMENT_MAPPING)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return value;
        }
    }

    // Default: basic documents required
    return {
        required: ["cv_file", "ijazah_file", "transcript_file", "certificate_file", "ktp_file", "photo_file", "skck_file"],
        optional: ["other_document"]
    };
}

// Document field metadata dengan label dan deskripsi
const DOCUMENT_FIELD_METADATA = {
    // ===== DOKUMEN DASAR (WAJIB SEMUA POSISI) =====
    cv_file: {
        label: "CV / Resume",
        description: "Curriculum Vitae atau Resume Anda",
        accept: ".pdf,.doc,.docx",
        maxSize: 3 * 1024 * 1024, // 3MB
    },
    ktp_file: {
        label: "KTP",
        description: "Fotokopi Kartu Tanda Penduduk",
        accept: "image/*,.pdf",
        maxSize: 3 * 1024 * 1024, // 3MB
    },
    photo_file: {
        label: "Foto Diri",
        description: "Foto ukuran 4x6 atau 3x4",
        accept: "image/*",
        maxSize: 3 * 1024 * 1024, // 3MB
    },
    ijazah_file: {
        label: "Ijazah / Sertifikat Pendidikan",
        description: "Dokumen ijazah atau sertifikat pendidikan",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    transcript_file: {
        label: "Transkrip Nilai",
        description: "Lembar nilai akademik",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    certificate_file: {
        label: "Sertifikat & Penghargaan",
        description: "Sertifikat kursus, pelatihan, atau penghargaan",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    experience_letter_file: {
        label: "Surat Pengalaman Kerja",
        description: "Surat pengalaman kerja dari perusahaan sebelumnya",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    reference_letter_file: {
        label: "Surat Referensi",
        description: "Surat rekomendasi/referensi dari atasan atau rekan kerja",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    skck_file: {
        label: "SKCK (Surat Keterangan Catatan Kepolisian)",
        description: "Dokumen SKCK dari kepolisian setempat",
        accept: "image/*,.pdf",
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    
    // ===== DOKUMEN SPESIALIS =====
    portfolio_file: {
        label: "Portfolio File",
        description: "File portfolio pekerjaan Anda (ZIP, PDF, atau file lainnya)",
        accept: ".pdf,.zip,.rar,.7z",
        maxSize: 10 * 1024 * 1024, // 10MB
    },
    github_link: {
        label: "GitHub / GitLab Link",
        description: "Link ke repository atau profil GitHub/GitLab Anda",
        accept: "text/plain,.txt",
        maxSize: 1 * 1024 * 1024, // 1MB
        isUrl: true,
    },
    design_link: {
        label: "Design Portfolio Link",
        description: "Link ke Figma, Behance, Dribbble, atau platform design lainnya",
        accept: "text/plain,.txt",
        maxSize: 1 * 1024 * 1024, // 1MB
        isUrl: true,
    },
    youtube_link: {
        label: "YouTube / Video Link",
        description: "Link ke video portfolio Anda di YouTube atau platform video lainnya",
        accept: "text/plain,.txt",
        maxSize: 1 * 1024 * 1024, // 1MB
        isUrl: true,
    },
    marketing_portfolio_link: {
        label: "Marketing Portfolio Link",
        description: "Link ke portfolio marketing, blog, atau karya marketing Anda",
        accept: "text/plain,.txt",
        maxSize: 1 * 1024 * 1024, // 1MB
        isUrl: true,
    },
    campaign_link: {
        label: "Campaign Link",
        description: "Link ke kampanye marketing yang telah Anda buat",
        accept: "text/plain,.txt",
        maxSize: 1 * 1024 * 1024, // 1MB
        isUrl: true,
    },
        other_document: {
        label: "Dokumen lainnya",
        description: "Dokumen tambahan yang relevan",
        accept: "image/*,.pdf,.zip,.rar,.7z,.doc,.docx",
        maxSize: 5 * 1024 * 1024, // 5MB
    }
};

/**
 * Validate uploaded files against position requirements
 * @param {string} positionName - Nama posisi
 * @param {object} uploadedFiles - Object berisi nama-nama file yang diupload
 * @returns {object} - { isValid: bool, missingDocuments: [], errors: [] }
 */
function validateDocuments(positionName, uploadedFiles) {
    const requirements = getRequiredDocuments(positionName);
    const missingDocuments = [];
    const errors = [];
    
    // Check required documents only
    for (const docType of requirements.required || []) {
        if (!uploadedFiles[docType]) {
            missingDocuments.push(docType);
        }
    }
    
    return {
        isValid: missingDocuments.length === 0,
        missingDocuments: missingDocuments,
        requiredCount: (requirements.required || []).length,
        uploadedCount: Object.values(uploadedFiles).filter(v => v).length
    };
}

module.exports = {
    POSITION_DOCUMENT_MAPPING,
    DOCUMENT_FIELD_METADATA,
    getRequiredDocuments,
    validateDocuments
};
