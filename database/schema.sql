-- ============================================================================
-- Smart Library SMP Negeri 1 Dramaga — Skema Fisik PostgreSQL / Supabase (3NF)
-- Kelompok 10 (Paralel 2) — Mata Kuliah Basis Data IPB University
-- Terdiri atas 11 tabel relasional sesuai rancangan konseptual, logikal, & fisik
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. ANGGOTA (Super Class)
CREATE TABLE IF NOT EXISTS public.anggota (
    id_anggota VARCHAR(10) PRIMARY KEY,
    nama VARCHAR(100) NOT NULL,
    no_telepon VARCHAR(15),
    alamat VARCHAR(150),
    tgl_bergabung DATE NOT NULL DEFAULT CURRENT_DATE
);

-- 2. SISWA (Sub Class Disjoint dari ANGGOTA)
CREATE TABLE IF NOT EXISTS public.siswa (
    id_anggota VARCHAR(10) PRIMARY KEY,
    nisn CHAR(10) NOT NULL UNIQUE,
    kelas VARCHAR(5) NOT NULL,
    tahun_angkatan SMALLINT NOT NULL CHECK (tahun_angkatan BETWEEN 2000 AND 2100),
    CONSTRAINT fk_siswa_anggota FOREIGN KEY (id_anggota)
        REFERENCES public.anggota(id_anggota) ON DELETE CASCADE
);

-- 3. GURU_KARYAWAN (Sub Class Disjoint dari ANGGOTA)
CREATE TABLE IF NOT EXISTS public.guru_karyawan (
    id_anggota VARCHAR(10) PRIMARY KEY,
    nip CHAR(18) NOT NULL UNIQUE,
    unit_kerja_mata_pelajaran VARCHAR(60),
    CONSTRAINT fk_guru_anggota FOREIGN KEY (id_anggota)
        REFERENCES public.anggota(id_anggota) ON DELETE CASCADE
);

-- 4. STAF (Relasi Rekursif Supervisi)
CREATE TABLE IF NOT EXISTS public.staf (
    id_staf VARCHAR(10) PRIMARY KEY,
    jabatan VARCHAR(50) NOT NULL,
    username VARCHAR(30) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_supervisor VARCHAR(10),
    CONSTRAINT fk_staf_supervisor FOREIGN KEY (id_supervisor)
        REFERENCES public.staf(id_staf) ON DELETE RESTRICT
);

-- 5. KATEGORI_BUKU
CREATE TABLE IF NOT EXISTS public.kategori_buku (
    id_kategori VARCHAR(10) PRIMARY KEY,
    nama_kategori VARCHAR(50) NOT NULL UNIQUE,
    lokasi_rak VARCHAR(20)
);

-- 6. KATALOG_BUKU
CREATE TABLE IF NOT EXISTS public.katalog_buku (
    id_buku VARCHAR(10) PRIMARY KEY,
    isbn VARCHAR(17) NOT NULL UNIQUE,
    judul VARCHAR(150) NOT NULL,
    penerbit VARCHAR(80),
    tahun_terbit SMALLINT CHECK (tahun_terbit BETWEEN 1900 AND 2100),
    id_kategori VARCHAR(10) NOT NULL,
    CONSTRAINT fk_katalog_kategori FOREIGN KEY (id_kategori)
        REFERENCES public.kategori_buku(id_kategori) ON DELETE RESTRICT
);

-- 7. INVENTARIS (Weak Entity / Komposisi dari KATALOG_BUKU)
CREATE TABLE IF NOT EXISTS public.inventaris (
    id_buku VARCHAR(10),
    no_eksemplar SMALLINT CHECK (no_eksemplar > 0),
    status_ketersediaan VARCHAR(10) NOT NULL DEFAULT 'Tersedia'
        CHECK (status_ketersediaan IN ('Tersedia', 'Dipinjam', 'Rusak', 'Hilang')),
    kondisi_fisik VARCHAR(10) NOT NULL DEFAULT 'Baik'
        CHECK (kondisi_fisik IN ('Baik', 'Rusak', 'Hilang')),
    PRIMARY KEY (id_buku, no_eksemplar),
    CONSTRAINT fk_inventaris_katalog FOREIGN KEY (id_buku)
        REFERENCES public.katalog_buku(id_buku) ON DELETE CASCADE
);

-- 8. PEMINJAMAN
CREATE TABLE IF NOT EXISTS public.peminjaman (
    id_peminjaman VARCHAR(10) PRIMARY KEY,
    tgl_pinjam DATE NOT NULL DEFAULT CURRENT_DATE,
    tgl_jatuh_tempo DATE NOT NULL CHECK (tgl_jatuh_tempo >= tgl_pinjam),
    status_peminjaman VARCHAR(10) NOT NULL DEFAULT 'Dipinjam'
        CHECK (status_peminjaman IN ('Dipinjam', 'Selesai', 'Terlambat')),
    id_anggota VARCHAR(10) NOT NULL,
    id_staf VARCHAR(10) NOT NULL,
    CONSTRAINT fk_peminjaman_anggota FOREIGN KEY (id_anggota)
        REFERENCES public.anggota(id_anggota) ON DELETE RESTRICT,
    CONSTRAINT fk_peminjaman_staf FOREIGN KEY (id_staf)
        REFERENCES public.staf(id_staf) ON DELETE RESTRICT
);

-- 9. PENGEMBALIAN (1:1 dengan PEMINJAMAN)
CREATE TABLE IF NOT EXISTS public.pengembalian (
    id_pengembalian VARCHAR(10) PRIMARY KEY,
    id_peminjaman VARCHAR(10) NOT NULL UNIQUE,
    tgl_kembali DATE NOT NULL,
    hari_terlambat INT NOT NULL DEFAULT 0 CHECK (hari_terlambat >= 0),
    CONSTRAINT fk_pengembalian_peminjaman FOREIGN KEY (id_peminjaman)
        REFERENCES public.peminjaman(id_peminjaman) ON DELETE RESTRICT
);

-- 10. DETAIL_PENGEMBALIAN (Resolusi M:N antara PENGEMBALIAN & INVENTARIS)
CREATE TABLE IF NOT EXISTS public.detail_pengembalian (
    id_pengembalian VARCHAR(10),
    id_buku VARCHAR(10),
    no_eksemplar SMALLINT,
    PRIMARY KEY (id_pengembalian, id_buku, no_eksemplar),
    CONSTRAINT fk_detail_pengembalian FOREIGN KEY (id_pengembalian)
        REFERENCES public.pengembalian(id_pengembalian) ON DELETE CASCADE,
    CONSTRAINT fk_detail_inventaris FOREIGN KEY (id_buku, no_eksemplar)
        REFERENCES public.inventaris(id_buku, no_eksemplar) ON DELETE RESTRICT
);

-- 11. SANKSI_DENDA (1:1 opsional dengan PENGEMBALIAN)
CREATE TABLE IF NOT EXISTS public.sanksi_denda (
    id_denda VARCHAR(10) PRIMARY KEY,
    id_pengembalian VARCHAR(10) NOT NULL UNIQUE,
    jenis_sanksi VARCHAR(30) NOT NULL,
    jumlah_denda NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (jumlah_denda >= 0),
    status_pembayaran VARCHAR(12) NOT NULL DEFAULT 'Belum Lunas'
        CHECK (status_pembayaran IN ('Lunas', 'Belum Lunas')),
    tgl_bayar DATE,
    CONSTRAINT fk_denda_pengembalian FOREIGN KEY (id_pengembalian)
        REFERENCES public.pengembalian(id_pengembalian) ON DELETE RESTRICT
);

-- ============================================================================
-- INDEKS (Sesuai Dokumen + Indeks Foreign Key untuk Performa JOIN & CASCADE)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_katalog_judul ON public.katalog_buku(judul);
CREATE INDEX IF NOT EXISTS idx_anggota_nama ON public.anggota(nama);
CREATE INDEX IF NOT EXISTS idx_peminjaman_tgl ON public.peminjaman(tgl_pinjam);

CREATE INDEX IF NOT EXISTS idx_staf_supervisor ON public.staf(id_supervisor);
CREATE INDEX IF NOT EXISTS idx_katalog_kategori ON public.katalog_buku(id_kategori);
CREATE INDEX IF NOT EXISTS idx_peminjaman_anggota ON public.peminjaman(id_anggota);
CREATE INDEX IF NOT EXISTS idx_peminjaman_staf ON public.peminjaman(id_staf);
CREATE INDEX IF NOT EXISTS idx_detail_pengembalian_inv ON public.detail_pengembalian(id_buku, no_eksemplar);

-- ============================================================================
-- TRIGGER INTEGRITAS (Disjoint Subclass & Hashing Password Staf)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cek_disjoint_siswa()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.guru_karyawan WHERE id_anggota = NEW.id_anggota) THEN
        RAISE EXCEPTION 'Anggota % sudah terdaftar sebagai Guru/Karyawan (aturan Disjoint).', NEW.id_anggota;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disjoint_siswa ON public.siswa;
CREATE TRIGGER trg_disjoint_siswa
BEFORE INSERT OR UPDATE ON public.siswa
FOR EACH ROW EXECUTE FUNCTION public.cek_disjoint_siswa();

CREATE OR REPLACE FUNCTION public.cek_disjoint_guru()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.siswa WHERE id_anggota = NEW.id_anggota) THEN
        RAISE EXCEPTION 'Anggota % sudah terdaftar sebagai Siswa (aturan Disjoint).', NEW.id_anggota;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disjoint_guru ON public.guru_karyawan;
CREATE TRIGGER trg_disjoint_guru
BEFORE INSERT OR UPDATE ON public.guru_karyawan
FOR EACH ROW EXECUTE FUNCTION public.cek_disjoint_guru();

CREATE OR REPLACE FUNCTION public.hash_staf_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL
       AND NEW.password_hash NOT LIKE '$2a$%'
       AND NEW.password_hash NOT LIKE '$2b$%'
       AND NEW.password_hash NOT LIKE '$2y$%' THEN
        NEW.password_hash := extensions.crypt(NEW.password_hash, extensions.gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_staf_password ON public.staf;
CREATE TRIGGER trg_hash_staf_password
BEFORE INSERT OR UPDATE OF password_hash ON public.staf
FOR EACH ROW EXECUTE FUNCTION public.hash_staf_password();

-- ============================================================================
-- VIEWS (Menggunakan security_invoker = true sesuai standar Supabase Postgres 15+)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_anggota_lengkap
WITH (security_invoker = true) AS
SELECT
    a.id_anggota,
    a.nama,
    a.no_telepon,
    a.alamat,
    a.tgl_bergabung,
    CASE
        WHEN s.id_anggota IS NOT NULL THEN 'Siswa'
        WHEN gk.id_anggota IS NOT NULL THEN 'Guru/Karyawan'
        ELSE 'Umum'
    END AS tipe_anggota,
    TRIM(s.nisn) AS nisn,
    s.kelas,
    s.tahun_angkatan,
    TRIM(gk.nip) AS nip,
    gk.unit_kerja_mata_pelajaran
FROM public.anggota a
LEFT JOIN public.siswa s ON a.id_anggota = s.id_anggota
LEFT JOIN public.guru_karyawan gk ON a.id_anggota = gk.id_anggota;

CREATE OR REPLACE VIEW public.v_katalog_stok
WITH (security_invoker = true) AS
SELECT
    kb.id_buku,
    kb.isbn,
    kb.judul,
    kb.penerbit,
    kb.tahun_terbit,
    kb.id_kategori,
    kat.nama_kategori,
    kat.lokasi_rak,
    COUNT(inv.no_eksemplar)::INT AS stok_total,
    COUNT(*) FILTER (WHERE inv.status_ketersediaan = 'Tersedia')::INT AS stok_tersedia,
    COUNT(*) FILTER (WHERE inv.status_ketersediaan = 'Dipinjam')::INT AS stok_dipinjam
FROM public.katalog_buku kb
JOIN public.kategori_buku kat ON kb.id_kategori = kat.id_kategori
LEFT JOIN public.inventaris inv ON kb.id_buku = inv.id_buku
GROUP BY kb.id_buku, kb.isbn, kb.judul, kb.penerbit, kb.tahun_terbit, kb.id_kategori, kat.nama_kategori, kat.lokasi_rak;

CREATE OR REPLACE VIEW public.v_denda_lengkap
WITH (security_invoker = true) AS
SELECT
    sd.id_denda,
    sd.id_pengembalian,
    sd.jenis_sanksi,
    sd.jumlah_denda,
    sd.status_pembayaran,
    sd.tgl_bayar,
    pg.id_peminjaman,
    pg.tgl_kembali,
    pg.hari_terlambat,
    p.id_anggota,
    a.nama AS nama_anggota,
    p.tgl_pinjam,
    p.tgl_jatuh_tempo
FROM public.sanksi_denda sd
JOIN public.pengembalian pg ON sd.id_pengembalian = pg.id_pengembalian
JOIN public.peminjaman p ON pg.id_peminjaman = p.id_peminjaman
JOIN public.anggota a ON p.id_anggota = a.id_anggota;

-- ============================================================================
-- RPC LOGIN STAF & TRANSAKSI ATOMIK
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_staf_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id_staf VARCHAR(10),
    jabatan VARCHAR(50),
    username VARCHAR(30),
    id_supervisor VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id_staf, s.jabatan, s.username, s.id_supervisor
    FROM public.staf s
    WHERE s.username = p_username
      AND s.password_hash = extensions.crypt(p_password, s.password_hash);
END;
$$;

-- ============================================================================
-- DATA CONTOH SESUAI DOKUMEN FASE 3 (SMP Negeri 1 Dramaga)
-- Password login demo semua akun staf: dramaga2026
-- ============================================================================
INSERT INTO public.anggota (id_anggota, nama, no_telepon, alamat, tgl_bergabung) VALUES
('A001', 'Rina Putri', '081234567801', 'Jl. Raya Dramaga No. 12, Bogor', '2025-07-15'),
('A002', 'Budi Santoso', '081234567802', 'Jl. Babakan Tengah No. 45, Bogor', '2025-07-15'),
('A003', 'Citra Lestari', '081234567803', 'Perum Alam Sinarsari Blok B2, Bogor', '2025-07-16'),
('A004', 'Dimas Pratama', '081234567804', 'Jl. Cangkurawok No. 8, Bogor', '2026-07-14'),
('A005', 'Eka Saputra', '081234567805', 'Jl. Cibanteng Proyek No. 21, Bogor', '2026-07-14'),
('A006', 'Drs. Hendra Wijaya', '081311112201', 'Perum Dosen IPB Dramaga, Bogor', '2020-01-10'),
('A007', 'Siti Aminah, S.Pd.', '081311112202', 'Jl. Laladon Indah No. 19, Bogor', '2021-03-22'),
('A008', 'Ahmad Fauzi, M.Pd.', '081311112203', 'Jl. Ciherang Cutak No. 5, Bogor', '2019-08-05'),
('A009', 'Nurul Hidayah, S.Si.', '081311112204', 'Komplek Margajaya Blok C4, Bogor', '2022-02-14'),
('A010', 'Bambang Sutrisno', '081311112205', 'Jl. Petir No. 33, Dramaga, Bogor', '2018-06-01')
ON CONFLICT (id_anggota) DO NOTHING;

INSERT INTO public.siswa (id_anggota, nisn, kelas, tahun_angkatan) VALUES
('A001', '0081234567', '8A', 2025),
('A002', '0081234568', '8B', 2025),
('A003', '0081234569', '9A', 2024),
('A004', '0091234570', '7A', 2026),
('A005', '0091234571', '7C', 2026)
ON CONFLICT (id_anggota) DO NOTHING;

INSERT INTO public.guru_karyawan (id_anggota, nip, unit_kerja_mata_pelajaran) VALUES
('A006', '197504122000031001', 'Ilmu Pengetahuan Alam (IPA)'),
('A007', '198208172005012002', 'Bahasa Indonesia'),
('A008', '197911052003121003', 'Matematika'),
('A009', '198802202010012004', 'Ilmu Pengetahuan Sosial (IPS)'),
('A010', '198005102006041005', 'Tata Usaha / Administrasi Sekolah')
ON CONFLICT (id_anggota) DO NOTHING;

INSERT INTO public.staf (id_staf, jabatan, username, password_hash, id_supervisor) VALUES
('S001', 'Kepala Perpustakaan', 'kepala_perpus', 'dramaga2026', NULL),
('S002', 'Pustakawan Layanan Sirkulasi', 'sirkulasi_1', 'dramaga2026', 'S001'),
('S003', 'Pustakawan Layanan Sirkulasi', 'sirkulasi_2', 'dramaga2026', 'S001'),
('S004', 'Staf Pengolahan & Katalogisasi', 'katalog_1', 'dramaga2026', 'S001'),
('S005', 'Staf Administrasi & Inventaris', 'admin_perpus', 'dramaga2026', 'S001')
ON CONFLICT (id_staf) DO NOTHING;

INSERT INTO public.kategori_buku (id_kategori, nama_kategori, lokasi_rak) VALUES
('K01', 'Fiksi & Sastra', 'Rak A1 - A3'),
('K02', 'Buku Pelajaran SMP', 'Rak B1 - B5'),
('K03', 'Sains & Teknologi', 'Rak C1 - C2'),
('K04', 'Sejarah & Budaya', 'Rak D1 - D2'),
('K05', 'Referensi & Ensiklopedia', 'Rak E1')
ON CONFLICT (id_kategori) DO NOTHING;

INSERT INTO public.katalog_buku (id_buku, isbn, judul, penerbit, tahun_terbit, id_kategori) VALUES
('B001', '978-979-3062-79-2', 'Laskar Pelangi', 'Bentang Pustaka', 2005, 'K01'),
('B002', '978-602-244-789-4', 'Matematika SMP/MTs Kelas VIII', 'Kemendikbudristek', 2022, 'K02'),
('B003', '978-602-03-3295-6', 'Bumi', 'Gramedia Pustaka Utama', 2014, 'K01'),
('B004', '978-602-424-694-5', 'Ensiklopedia Sains & Antariksa', 'Erlangga', 2021, 'K03'),
('B005', '978-979-461-888-2', 'Sejarah Nasional Indonesia untuk Pelajar', 'Balai Pustaka', 2019, 'K04')
ON CONFLICT (id_buku) DO NOTHING;

INSERT INTO public.inventaris (id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik) VALUES
('B001', 1, 'Tersedia', 'Baik'),
('B001', 2, 'Dipinjam', 'Baik'),
('B002', 1, 'Tersedia', 'Baik'),
('B002', 2, 'Dipinjam', 'Baik'),
('B003', 1, 'Tersedia', 'Baik'),
('B004', 1, 'Tersedia', 'Baik'),
('B004', 2, 'Rusak', 'Rusak'),
('B005', 1, 'Tersedia', 'Baik')
ON CONFLICT (id_buku, no_eksemplar) DO NOTHING;

INSERT INTO public.peminjaman (id_peminjaman, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman, id_anggota, id_staf) VALUES
('PJ001', '2026-10-01', '2026-10-08', 'Selesai', 'A001', 'S002'),
('PJ002', '2026-10-03', '2026-10-10', 'Selesai', 'A002', 'S002'),
('PJ003', '2026-10-05', '2026-10-12', 'Selesai', 'A003', 'S003'),
('PJ004', '2026-10-10', '2026-10-17', 'Selesai', 'A004', 'S002'),
('PJ005', '2026-10-15', '2026-10-22', 'Selesai', 'A006', 'S003'),
('PJ006', '2026-11-01', '2026-11-08', 'Terlambat', 'A005', 'S002'),
('PJ007', '2026-11-10', '2026-11-17', 'Dipinjam', 'A001', 'S003')
ON CONFLICT (id_peminjaman) DO NOTHING;

INSERT INTO public.pengembalian (id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat) VALUES
('PG001', 'PJ001', '2026-10-07', 0),
('PG002', 'PJ002', '2026-10-13', 3),
('PG003', 'PJ003', '2026-10-12', 0),
('PG004', 'PJ004', '2026-10-21', 4),
('PG005', 'PJ005', '2026-10-25', 3)
ON CONFLICT (id_pengembalian) DO NOTHING;

INSERT INTO public.detail_pengembalian (id_pengembalian, id_buku, no_eksemplar) VALUES
('PG001', 'B001', 1),
('PG001', 'B002', 1),
('PG002', 'B003', 1),
('PG003', 'B004', 1),
('PG004', 'B001', 1),
('PG005', 'B005', 1)
ON CONFLICT (id_pengembalian, id_buku, no_eksemplar) DO NOTHING;

INSERT INTO public.sanksi_denda (id_denda, id_pengembalian, jenis_sanksi, jumlah_denda, status_pembayaran, tgl_bayar) VALUES
('D001', 'PG002', 'Keterlambatan 3 Hari', 3000.00, 'Belum Lunas', NULL),
('D002', 'PG004', 'Keterlambatan 4 Hari', 4000.00, 'Lunas', '2026-10-21'),
('D003', 'PG005', 'Keterlambatan 3 Hari', 3000.00, 'Lunas', '2026-10-25'),
('D004', 'PG001', 'Kerusakan Ringan Sampul', 5000.00, 'Belum Lunas', NULL),
('D005', 'PG003', 'Hilang Pembatas Buku', 2000.00, 'Lunas', '2026-10-12')
ON CONFLICT (id_denda) DO NOTHING;

-- ============================================================================
-- DATA API GRANTS & ROW LEVEL SECURITY (RLS)
-- Catatan: File schema.sql ini memakai kebijakan RLS terbuka untuk demo kelas
-- dan penyiapan cepat di Supabase SQL Editor tanpa server backend terpisah.
-- password_hash di tabel staf tidak diberikan hak SELECT ke anon/authenticated
-- sehingga hanya diverifikasi lewat fungsi SECURITY DEFINER verify_staf_login.
--
-- UNTUK HARDENING KEAMANAN PENUH (strict RLS, sesi staf server-side pada skema
-- private, dan transaksi atomik RPC): jalankan database/schema_hardened.sql
-- setelah file ini di Supabase SQL Editor.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.anggota,
    public.siswa,
    public.guru_karyawan,
    public.kategori_buku,
    public.katalog_buku,
    public.inventaris,
    public.peminjaman,
    public.pengembalian,
    public.detail_pengembalian,
    public.sanksi_denda
TO anon, authenticated;

REVOKE ALL ON TABLE public.staf FROM anon, authenticated;
GRANT SELECT (id_staf, jabatan, username, id_supervisor), INSERT, UPDATE, DELETE
    ON TABLE public.staf TO anon, authenticated;

GRANT SELECT ON
    public.v_anggota_lengkap,
    public.v_katalog_stok,
    public.v_denda_lengkap
TO anon, authenticated;

REVOKE ALL ON FUNCTION public.verify_staf_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staf_login(TEXT, TEXT) TO anon, authenticated;

ALTER TABLE public.anggota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.siswa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_karyawan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kategori_buku ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.katalog_buku ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventaris ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peminjaman ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pengembalian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detail_pengembalian ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sanksi_denda ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'anggota', 'siswa', 'guru_karyawan', 'staf',
        'kategori_buku', 'katalog_buku', 'inventaris',
        'peminjaman', 'pengembalian', 'detail_pengembalian', 'sanksi_denda'
    ]
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_app_access_%s" ON public.%I;', tbl, tbl);
        EXECUTE format(
            'CREATE POLICY "allow_app_access_%s" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END;
$$;
