-- =====================================================
-- MIGRATION: tambah status `libur` pada tabel attendance
-- Jalankan sekali di database produksi/development
-- =====================================================

ALTER TABLE attendance
MODIFY COLUMN status ENUM('hadir','izin','sakit','alpha','libur') DEFAULT NULL;
