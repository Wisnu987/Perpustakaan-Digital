-- ============================================================================
-- Smart Library SMP Negeri 1 Dramaga — Hardened Security Migration
-- Jalankan file ini di Supabase SQL Editor SETELAH database/schema.sql
--
-- Mengatasi temuan keamanan kritis & tinggi:
-- 1. Menutup akses tulis langsung (INSERT/UPDATE/DELETE) & baca PII dari role anon.
-- 2. Memindahkan sesi staf ke skema non-exposed `private.staf_sessions` (token hash SHA-256).
-- 3. Mengganti kebijakan `USING (true)` menjadi read-only OPAC untuk publik serta
--    RPC SECURITY DEFINER berotorisasi & atomik untuk seluruh mutasi staf.
-- 4. Memisahkan hak akses khusus Kepala Perpustakaan (`id_supervisor IS NULL`).
--
-- Catatan Migrasi Produksi Penuh:
-- Untuk aplikasi multi-tenant jangka panjang, migrasikan akun staf ke
-- Supabase Auth (auth.users) dengan klaim peran pada `raw_app_meta_data`
-- (bukan `user_metadata`), sehingga JWT terverifikasi langsung oleh RLS.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- 1. Tabel Sesi Staf Server-Side (di skema private yang tidak terekspos Data API)
CREATE TABLE IF NOT EXISTS private.staf_sessions (
    token_hash BYTEA PRIMARY KEY,
    id_staf VARCHAR(10) NOT NULL REFERENCES public.staf(id_staf) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_staf_sessions_expires
    ON private.staf_sessions(expires_at);

-- 2. Helper Verifikasi Sesi Staf & Kepala Perpustakaan (SECURITY DEFINER, private)
CREATE OR REPLACE FUNCTION private.require_staf(p_token TEXT)
RETURNS public.staf
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_token_hash BYTEA;
    v_staf public.staf%ROWTYPE;
BEGIN
    IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
        RAISE EXCEPTION 'Sesi staf tidak valid atau kosong.' USING ERRCODE = '28000';
    END IF;

    v_token_hash := extensions.digest(p_token, 'sha256');

    DELETE FROM private.staf_sessions WHERE expires_at <= now();

    SELECT st.*
    INTO v_staf
    FROM private.staf_sessions ss
    JOIN public.staf st ON st.id_staf = ss.id_staf
    WHERE ss.token_hash = v_token_hash
      AND ss.expires_at > now();

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesi staf telah berakhir atau tidak terotorisasi.' USING ERRCODE = '28000';
    END IF;

    RETURN v_staf;
END;
$$;

CREATE OR REPLACE FUNCTION private.require_head_librarian(p_token TEXT)
RETURNS public.staf
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    IF v_staf.id_supervisor IS NOT NULL THEN
        RAISE EXCEPTION 'Aksi ini hanya diizinkan untuk Kepala Perpustakaan.' USING ERRCODE = '42501';
    END IF;
    RETURN v_staf;
END;
$$;

REVOKE ALL ON FUNCTION private.require_staf(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_head_librarian(TEXT) FROM PUBLIC, anon, authenticated;

-- 3. Cabut Policy Permisif & Hak Tulis/Baca PII dari anon & authenticated
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
        EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON public.%I;', tbl, tbl);
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE public.%I FROM PUBLIC, anon, authenticated;', tbl);
    END LOOP;
END;
$$;

-- Cabut akses SELECT langsung ke tabel PII dan staf dari anon
REVOKE SELECT ON TABLE
    public.anggota,
    public.siswa,
    public.guru_karyawan,
    public.staf,
    public.peminjaman,
    public.pengembalian,
    public.detail_pengembalian,
    public.sanksi_denda
FROM PUBLIC, anon;

REVOKE SELECT ON
    public.v_anggota_lengkap,
    public.v_denda_lengkap
FROM PUBLIC, anon;

-- Izinkan anon hanya membaca katalog buku publik (OPAC)
GRANT SELECT ON
    public.kategori_buku,
    public.katalog_buku,
    public.inventaris,
    public.v_katalog_stok
TO anon, authenticated;

CREATE POLICY "public_read_kategori_buku"
    ON public.kategori_buku FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_katalog_buku"
    ON public.katalog_buku FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public_read_inventaris"
    ON public.inventaris FOR SELECT TO anon, authenticated USING (true);

-- Perketat verify_staf_login agar tidak terbuka ke PUBLIC secara implisit
REVOKE ALL ON FUNCTION public.verify_staf_login(TEXT, TEXT) FROM PUBLIC;

-- 4. RPC Autentikasi Staf Berbasis Sesi Server-Side
CREATE OR REPLACE FUNCTION public.staf_login_session(p_username TEXT, p_password TEXT)
RETURNS TABLE (
    id_staf VARCHAR(10),
    jabatan VARCHAR(50),
    username VARCHAR(30),
    id_supervisor VARCHAR(10),
    session_token TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_raw_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_staf
    FROM public.staf s
    WHERE s.username = trim(p_username)
      AND s.password_hash = extensions.crypt(p_password, s.password_hash);

    IF NOT FOUND THEN
        RETURN;
    END IF;

    DELETE FROM private.staf_sessions WHERE private.staf_sessions.expires_at <= now();

    v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_expires := now() + INTERVAL '8 hours';

    INSERT INTO private.staf_sessions (token_hash, id_staf, expires_at)
    VALUES (extensions.digest(v_raw_token, 'sha256'), v_staf.id_staf, v_expires);

    RETURN QUERY
    SELECT v_staf.id_staf, v_staf.jabatan, v_staf.username, v_staf.id_supervisor, v_raw_token, v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.staf_logout_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
    IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
        RETURN FALSE;
    END IF;
    DELETE FROM private.staf_sessions
    WHERE token_hash = extensions.digest(p_token, 'sha256');
    RETURN FOUND;
END;
$$;

-- 5. RPC Transaksi Atomik Peminjaman (mengunci baris inventaris dengan FOR UPDATE)
CREATE OR REPLACE FUNCTION public.rpc_create_peminjaman(
    p_token TEXT,
    p_id_peminjaman VARCHAR(10),
    p_tgl_pinjam DATE,
    p_tgl_jatuh_tempo DATE,
    p_id_anggota VARCHAR(10),
    p_copies JSONB
)
RETURNS public.peminjaman
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_loan public.peminjaman%ROWTYPE;
    v_item JSONB;
    v_id_buku VARCHAR(10);
    v_no_eksemplar SMALLINT;
    v_inv public.inventaris%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_copies IS NULL OR jsonb_typeof(p_copies) <> 'array' OR jsonb_array_length(p_copies) = 0 THEN
        RAISE EXCEPTION 'Pilih minimal 1 eksemplar buku yang tersedia.';
    END IF;

    IF p_tgl_jatuh_tempo < p_tgl_pinjam THEN
        RAISE EXCEPTION 'Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.';
    END IF;

    INSERT INTO public.peminjaman (
        id_peminjaman, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman, id_anggota, id_staf
    ) VALUES (
        p_id_peminjaman, p_tgl_pinjam, p_tgl_jatuh_tempo, 'Dipinjam', p_id_anggota, v_staf.id_staf
    )
    RETURNING * INTO v_loan;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_copies)
    LOOP
        v_id_buku := v_item->>'id_buku';
        v_no_eksemplar := (v_item->>'no_eksemplar')::SMALLINT;

        SELECT * INTO v_inv
        FROM public.inventaris
        WHERE id_buku = v_id_buku AND no_eksemplar = v_no_eksemplar
        FOR UPDATE;

        IF NOT FOUND OR v_inv.status_ketersediaan <> 'Tersedia' THEN
            RAISE EXCEPTION 'Eksemplar % #% tidak tersedia untuk dipinjam.', v_id_buku, v_no_eksemplar;
        END IF;

        UPDATE public.inventaris
        SET status_ketersediaan = 'Dipinjam'
        WHERE id_buku = v_id_buku AND no_eksemplar = v_no_eksemplar;
    END LOOP;

    RETURN v_loan;
END;
$$;

-- 6. RPC Transaksi Atomik Pengembalian + Detail + Inventaris + Denda Opsional
CREATE OR REPLACE FUNCTION public.rpc_process_pengembalian(
    p_token TEXT,
    p_id_pengembalian VARCHAR(10),
    p_id_peminjaman VARCHAR(10),
    p_tgl_kembali DATE,
    p_hari_terlambat INT,
    p_items JSONB,
    p_denda JSONB DEFAULT NULL
)
RETURNS public.pengembalian
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_loan public.peminjaman%ROWTYPE;
    v_ret public.pengembalian%ROWTYPE;
    v_item JSONB;
    v_id_buku VARCHAR(10);
    v_no_eksemplar SMALLINT;
    v_kondisi VARCHAR(10);
    v_status_avail VARCHAR(10);
    v_denda_nominal NUMERIC(10,2);
    v_denda_status VARCHAR(12);
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Pilih minimal 1 eksemplar buku yang dikembalikan.';
    END IF;
    IF p_hari_terlambat < 0 THEN
        RAISE EXCEPTION 'Hari terlambat tidak boleh negatif.';
    END IF;

    SELECT * INTO v_loan
    FROM public.peminjaman
    WHERE id_peminjaman = p_id_peminjaman
    FOR UPDATE;

    IF NOT FOUND OR v_loan.status_peminjaman = 'Selesai' THEN
        RAISE EXCEPTION 'Transaksi peminjaman % tidak ditemukan atau sudah selesai.', p_id_peminjaman;
    END IF;

    INSERT INTO public.pengembalian (id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat)
    VALUES (p_id_pengembalian, p_id_peminjaman, p_tgl_kembali, p_hari_terlambat)
    RETURNING * INTO v_ret;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_buku := v_item->>'id_buku';
        v_no_eksemplar := (v_item->>'no_eksemplar')::SMALLINT;
        v_kondisi := COALESCE(v_item->>'kondisi_fisik', 'Baik');
        IF v_kondisi NOT IN ('Baik', 'Rusak', 'Hilang') THEN
            RAISE EXCEPTION 'Kondisi fisik tidak valid: %', v_kondisi;
        END IF;
        v_status_avail := CASE WHEN v_kondisi = 'Baik' THEN 'Tersedia' ELSE v_kondisi END;

        INSERT INTO public.detail_pengembalian (id_pengembalian, id_buku, no_eksemplar)
        VALUES (p_id_pengembalian, v_id_buku, v_no_eksemplar);

        UPDATE public.inventaris
        SET kondisi_fisik = v_kondisi,
            status_ketersediaan = v_status_avail
        WHERE id_buku = v_id_buku AND no_eksemplar = v_no_eksemplar;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Eksemplar % #% tidak ditemukan di inventaris.', v_id_buku, v_no_eksemplar;
        END IF;
    END LOOP;

    UPDATE public.peminjaman
    SET status_peminjaman = 'Selesai'
    WHERE id_peminjaman = p_id_peminjaman;

    IF p_denda IS NOT NULL AND COALESCE((p_denda->>'jumlah_denda')::NUMERIC, 0) > 0 THEN
        v_denda_nominal := (p_denda->>'jumlah_denda')::NUMERIC(10,2);
        v_denda_status := COALESCE(p_denda->>'status_pembayaran', 'Belum Lunas');
        INSERT INTO public.sanksi_denda (
            id_denda, id_pengembalian, jenis_sanksi, jumlah_denda, status_pembayaran, tgl_bayar
        ) VALUES (
            p_denda->>'id_denda',
            p_id_pengembalian,
            COALESCE(NULLIF(trim(p_denda->>'jenis_sanksi'), ''), 'Denda Keterlambatan'),
            v_denda_nominal,
            v_denda_status,
            CASE WHEN v_denda_status = 'Lunas' THEN p_tgl_kembali ELSE NULL END
        );
    END IF;

    RETURN v_ret;
END;
$$;

-- 7. RPC Pelunasan Denda (Terotorisasi Staf)
CREATE OR REPLACE FUNCTION public.rpc_bayar_denda(
    p_token TEXT,
    p_id_denda VARCHAR(10),
    p_tgl_bayar DATE DEFAULT CURRENT_DATE
)
RETURNS public.sanksi_denda
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_denda public.sanksi_denda%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    UPDATE public.sanksi_denda
    SET status_pembayaran = 'Lunas',
        tgl_bayar = COALESCE(p_tgl_bayar, CURRENT_DATE)
    WHERE id_denda = p_id_denda
    RETURNING * INTO v_denda;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Data denda % tidak ditemukan.', p_id_denda;
    END IF;

    RETURN v_denda;
END;
$$;

-- 8. RPC Manajemen Staf (Khusus Kepala Perpustakaan)
CREATE OR REPLACE FUNCTION public.rpc_upsert_staf(
    p_token TEXT,
    p_id_staf VARCHAR(10),
    p_jabatan VARCHAR(50),
    p_username VARCHAR(30),
    p_password TEXT DEFAULT NULL,
    p_id_supervisor VARCHAR(10) DEFAULT NULL,
    p_is_edit BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id_staf VARCHAR(10),
    jabatan VARCHAR(50),
    username VARCHAR(30),
    id_supervisor VARCHAR(10)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_head public.staf%ROWTYPE;
BEGIN
    v_head := private.require_head_librarian(p_token);

    IF p_username !~ '^[a-zA-Z0-9_.-]{3,30}$' THEN
        RAISE EXCEPTION 'Username staf harus 3-30 karakter alfanumerik/._-.';
    END IF;
    IF p_password IS NOT NULL AND length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password staf minimal 8 karakter.';
    END IF;

    IF p_is_edit THEN
        UPDATE public.staf s
        SET jabatan = trim(p_jabatan),
            username = trim(p_username),
            id_supervisor = NULLIF(p_id_supervisor, ''),
            password_hash = CASE WHEN p_password IS NOT NULL AND length(p_password) > 0 THEN p_password ELSE s.password_hash END
        WHERE s.id_staf = p_id_staf;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Staf % tidak ditemukan.', p_id_staf;
        END IF;
    ELSE
        IF p_password IS NULL OR length(p_password) < 8 THEN
            RAISE EXCEPTION 'Password wajib diisi minimal 8 karakter untuk staf baru.';
        END IF;
        INSERT INTO public.staf (id_staf, jabatan, username, password_hash, id_supervisor)
        VALUES (p_id_staf, trim(p_jabatan), trim(p_username), p_password, NULLIF(p_id_supervisor, ''));
    END IF;

    RETURN QUERY
    SELECT s.id_staf, s.jabatan, s.username, s.id_supervisor
    FROM public.staf s
    WHERE s.id_staf = p_id_staf;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_staf(
    p_token TEXT,
    p_id_staf VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_head public.staf%ROWTYPE;
BEGIN
    v_head := private.require_head_librarian(p_token);

    IF v_head.id_staf = p_id_staf THEN
        RAISE EXCEPTION 'Kepala Perpustakaan tidak dapat menghapus akunnya sendiri.';
    END IF;

    DELETE FROM public.staf WHERE id_staf = p_id_staf;
    RETURN FOUND;
END;
$$;

-- Hak Eksekusi Publik Terbatas pada RPC Terproteksi Token
REVOKE ALL ON FUNCTION public.staf_login_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staf_logout_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_peminjaman(TEXT, VARCHAR, DATE, DATE, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_process_pengembalian(TEXT, VARCHAR, VARCHAR, DATE, INT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_bayar_denda(TEXT, VARCHAR, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_upsert_staf(TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_staf(TEXT, VARCHAR) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.staf_login_session(TEXT, TEXT),
    public.staf_logout_session(TEXT),
    public.rpc_create_peminjaman(TEXT, VARCHAR, DATE, DATE, VARCHAR, JSONB),
    public.rpc_process_pengembalian(TEXT, VARCHAR, VARCHAR, DATE, INT, JSONB, JSONB),
    public.rpc_bayar_denda(TEXT, VARCHAR, DATE),
    public.rpc_upsert_staf(TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN),
    public.rpc_delete_staf(TEXT, VARCHAR)
TO anon, authenticated;
