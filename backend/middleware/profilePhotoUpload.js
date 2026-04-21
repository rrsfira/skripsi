const fs = require("fs");
const multer = require("multer");
const path = require("path");

const profilePhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../uploads/profile_photos");
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `photo-${uniqueSuffix}${ext}`);
    },
});

const profilePhotoFileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
        return cb(null, true);
    }
    return cb(new Error("Only JPG/PNG/WEBP are allowed for profile photo"));
};

const uploadProfilePhoto = multer({
    storage: profilePhotoStorage,
    fileFilter: profilePhotoFileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024,
    },
});

module.exports = uploadProfilePhoto;
