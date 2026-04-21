-- Migration: Tambah kolom base_position pada tabel job_openings
ALTER TABLE job_openings
ADD COLUMN base_position VARCHAR(64) NULL AFTER position_id; -- Bisa disesuaikan letaknya

-- Untuk rollback (jika pakai migration tool yang support down):
-- ALTER TABLE job_openings DROP COLUMN base_position;