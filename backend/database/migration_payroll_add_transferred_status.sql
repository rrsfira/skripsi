-- Menambahkan status transfer payroll agar finance bisa menandai gaji sudah dikirim ke rekening
ALTER TABLE `payrolls`
MODIFY COLUMN `status` ENUM('draft','published','claimed','transferred') DEFAULT 'draft';
