const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Folder tujuan upload
const uploadDir = path.join(__dirname, "../uploads/invitation_letters");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const unique = Date.now();
    cb(null, `${name}_${unique}${ext}`);
  },
});

const upload = multer({ storage });

// POST /api/upload-invitation
router.post("/upload-invitation", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  // Path relatif untuk disimpan di DB
  const relativePath = `uploads/invitation_letters/${req.file.filename}`;
  res.json({ path: relativePath, url: `/uploads/invitation_letters/${req.file.filename}` });
});

module.exports = router;
