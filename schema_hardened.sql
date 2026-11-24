-- ============================================================================
-- Smart Library SMP Negeri 1 Dramaga — Hardened Security Migration
-- Jalankan file ini di Supabase SQL Editor SETELAH database/schema.sql
-- (atau jalankan langsung database/schema.sql versi terbaru yang sudah
-- menyertakan seluruh proteksi ini).
--
-- Proteksi keamanan yang diterapkan:
-- 1. Menutup akses tulis langsung & baca PII/transaksi dari role anon/authenticated.
-- 2. Sesi server-side pada skema non-exposed `private` (token SHA-256) untuk
--    Staf (`private.staf_sessions`) dan Anggota (`private.anggota_sessions`).
-- 3. Login Anggota mewajibkan pasangan ID Anggota + NISN/NIP (2 faktor identitas).
-- 4. Seluruh operasi baca/tulis sensitif melalui RPC SECURITY DEFINER berotorisasi
--    dengan scope paksa server-side untuk Anggota & hak Kepala Perpustakaan.
-- 5. Menghapus policy permisif `USING (true)` dan fungsi legacy `verify_staf_login`.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- 1. Tabel Sesi Server-Side (skema private tidak terekspos PostgREST Data API)
CREATE TABLE IF NOT EXISTS private.staf_sessions (
    token_hash BYTEA PRIMARY KEY,
    id_staf VARCHAR(10) NOT NULL REFERENCES public.staf(id_staf) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_staf_sessions_expires
    ON private.staf_sessions(expires_at);

CREATE TABLE IF NOT EXISTS private.anggota_sessions (
    token_hash BYTEA PRIMARY KEY,
    id_anggota VARCHAR(10) NOT NULL REFERENCES public.anggota(id_anggota) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_private_anggota_sessions_expires
    ON private.anggota_sessions(expires_at);

-- 2. Helper Verifikasi Sesi & Peran (SECURITY DEFINER, private)
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

CREATE OR REPLACE FUNCTION private.try_actor(p_token TEXT)
RETURNS TABLE (
    actor_role TEXT,
    actor_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_token_hash BYTEA;
    v_id TEXT;
BEGIN
    IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
        RETURN;
    END IF;

    v_token_hash := extensions.digest(p_token, 'sha256');
    DELETE FROM private.staf_sessions WHERE expires_at <= now();
    DELETE FROM private.anggota_sessions WHERE expires_at <= now();

    SELECT ss.id_staf INTO v_id
    FROM private.staf_sessions ss
    WHERE ss.token_hash = v_token_hash
      AND ss.expires_at > now();

    IF FOUND THEN
        actor_role := 'staf';
        actor_id := v_id;
        RETURN NEXT;
        RETURN;
    END IF;

    SELECT ags.id_anggota INTO v_id
    FROM private.anggota_sessions ags
    WHERE ags.token_hash = v_token_hash
      AND ags.expires_at > now();

    IF FOUND THEN
        actor_role := 'anggota';
        actor_id := v_id;
        RETURN NEXT;
        RETURN;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.require_actor(p_token TEXT)
RETURNS TABLE (
    actor_role TEXT,
    actor_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM private.try_actor(p_token) LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sesi login telah berakhir atau tidak terotorisasi.' USING ERRCODE = '28000';
    END IF;
    actor_role := v_rec.actor_role;
    actor_id := v_rec.actor_id;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION private.require_staf(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_head_librarian(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.try_actor(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.require_actor(TEXT) FROM PUBLIC, anon, authenticated;

-- 3. Cabut Policy Permisif, Fungsi Legacy, & Hak Baca/Tulis Langsung
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

REVOKE SELECT ON TABLE
    public.anggota,
    public.siswa,
    public.guru_karyawan,
    public.staf,
    public.peminjaman,
    public.pengembalian,
    public.detail_pengembalian,
    public.sanksi_denda
FROM PUBLIC, anon, authenticated;

REVOKE SELECT ON
    public.v_anggota_lengkap,
    public.v_denda_lengkap
FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.verify_staf_login(TEXT, TEXT);

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

-- 4. RPC Autentikasi Staf & Anggota Berbasis Sesi Server-Side
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
    WHERE s.username = trim(COALESCE(p_username, ''))
      AND s.password_hash = extensions.crypt(COALESCE(p_password, ''), s.password_hash);

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

CREATE OR REPLACE FUNCTION public.anggota_login_session(p_id_anggota TEXT, p_identitas TEXT)
RETURNS TABLE (
    id_anggota VARCHAR(10),
    nama VARCHAR(100),
    tipe_anggota TEXT,
    kelas VARCHAR(5),
    tahun_angkatan SMALLINT,
    unit_kerja_mata_pelajaran VARCHAR(60),
    tgl_bergabung DATE,
    session_token TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_id TEXT := upper(trim(COALESCE(p_id_anggota, '')));
    v_ident TEXT := trim(COALESCE(p_identitas, ''));
    v_row RECORD;
    v_raw_token TEXT;
    v_expires TIMESTAMPTZ;
BEGIN
    IF v_id !~ '^[A-Za-z0-9_-]{1,10}$' OR v_ident !~ '^[0-9]{10,18}$' THEN
        RETURN;
    END IF;

    SELECT
        a.id_anggota,
        a.nama,
        CASE
            WHEN s.id_anggota IS NOT NULL THEN 'Siswa'
            WHEN gk.id_anggota IS NOT NULL THEN 'Guru/Karyawan'
            ELSE 'Umum'
        END AS tipe_anggota,
        s.kelas,
        s.tahun_angkatan,
        gk.unit_kerja_mata_pelajaran,
        a.tgl_bergabung
    INTO v_row
    FROM public.anggota a
    LEFT JOIN public.siswa s ON s.id_anggota = a.id_anggota
    LEFT JOIN public.guru_karyawan gk ON gk.id_anggota = a.id_anggota
    WHERE upper(a.id_anggota) = v_id
      AND (trim(s.nisn) = v_ident OR trim(gk.nip) = v_ident);

    IF NOT FOUND THEN
        RETURN;
    END IF;

    DELETE FROM private.anggota_sessions WHERE private.anggota_sessions.expires_at <= now();

    v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_expires := now() + INTERVAL '8 hours';

    INSERT INTO private.anggota_sessions (token_hash, id_anggota, expires_at)
    VALUES (extensions.digest(v_raw_token, 'sha256'), v_row.id_anggota, v_expires);

    id_anggota := v_row.id_anggota;
    nama := v_row.nama;
    tipe_anggota := v_row.tipe_anggota;
    kelas := v_row.kelas;
    tahun_angkatan := v_row.tahun_angkatan;
    unit_kerja_mata_pelajaran := v_row.unit_kerja_mata_pelajaran;
    tgl_bergabung := v_row.tgl_bergabung;
    session_token := v_raw_token;
    expires_at := v_expires;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.anggota_logout_session(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
    IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
        RETURN FALSE;
    END IF;
    DELETE FROM private.anggota_sessions
    WHERE token_hash = extensions.digest(p_token, 'sha256');
    RETURN FOUND;
END;
$$;

-- 5. RPC Statistik Agregat Publik-Aman (Tanpa PII)
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard_stats(p_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_total_judul INT;
    v_total_eksemplar INT;
    v_tersedia INT;
    v_dipinjam INT;
    v_aktif INT;
    v_telat INT;
    v_denda_count INT := 0;
    v_denda_total NUMERIC(12,2) := 0;
BEGIN
    SELECT * INTO v_actor FROM private.try_actor(p_token) LIMIT 1;

    SELECT COUNT(*)::INT INTO v_total_judul FROM public.katalog_buku;
    SELECT
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE status_ketersediaan = 'Tersedia')::INT,
        COUNT(*) FILTER (WHERE status_ketersediaan = 'Dipinjam')::INT
    INTO v_total_eksemplar, v_tersedia, v_dipinjam
    FROM public.inventaris;

    SELECT
        COUNT(*)::INT,
        COUNT(*) FILTER (WHERE status_peminjaman = 'Terlambat' OR tgl_jatuh_tempo < CURRENT_DATE)::INT
    INTO v_aktif, v_telat
    FROM public.peminjaman
    WHERE status_peminjaman IN ('Dipinjam', 'Terlambat');

    IF v_actor.actor_role = 'staf' THEN
        SELECT COUNT(*)::INT, COALESCE(SUM(jumlah_denda), 0)
        INTO v_denda_count, v_denda_total
        FROM public.sanksi_denda
        WHERE status_pembayaran = 'Belum Lunas';
    ELSIF v_actor.actor_role = 'anggota' THEN
        SELECT COUNT(*)::INT, COALESCE(SUM(sd.jumlah_denda), 0)
        INTO v_denda_count, v_denda_total
        FROM public.sanksi_denda sd
        JOIN public.pengembalian pg ON pg.id_pengembalian = sd.id_pengembalian
        JOIN public.peminjaman p ON p.id_peminjaman = pg.id_peminjaman
        WHERE sd.status_pembayaran = 'Belum Lunas'
          AND p.id_anggota = v_actor.actor_id;
    END IF;

    RETURN jsonb_build_object(
        'totalJudul', v_total_judul,
        'totalEksemplar', v_total_eksemplar,
        'eksemplarTersedia', v_tersedia,
        'eksemplarDipinjam', v_dipinjam,
        'peminjamanAktif', v_aktif,
        'peminjamanTerlambat', v_telat,
        'dendaBelumLunasCount', v_denda_count,
        'dendaBelumLunasTotal', v_denda_total
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_laporan_statistik(p_token TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_counts JSONB;
    v_top_books JSONB;
    v_kas_lunas NUMERIC(12,2) := 0;
    v_lunas_count INT := 0;
    v_overdue_count INT := 0;
BEGIN
    SELECT * INTO v_actor FROM private.try_actor(p_token) LIMIT 1;

    v_counts := jsonb_build_array(
        jsonb_build_object('table', 'anggota', 'count', (SELECT COUNT(*)::INT FROM public.anggota)),
        jsonb_build_object('table', 'siswa', 'count', (SELECT COUNT(*)::INT FROM public.siswa)),
        jsonb_build_object('table', 'guru_karyawan', 'count', (SELECT COUNT(*)::INT FROM public.guru_karyawan)),
        jsonb_build_object('table', 'staf', 'count', (SELECT COUNT(*)::INT FROM public.staf)),
        jsonb_build_object('table', 'kategori_buku', 'count', (SELECT COUNT(*)::INT FROM public.kategori_buku)),
        jsonb_build_object('table', 'katalog_buku', 'count', (SELECT COUNT(*)::INT FROM public.katalog_buku)),
        jsonb_build_object('table', 'inventaris', 'count', (SELECT COUNT(*)::INT FROM public.inventaris)),
        jsonb_build_object('table', 'peminjaman', 'count', (SELECT COUNT(*)::INT FROM public.peminjaman)),
        jsonb_build_object('table', 'pengembalian', 'count', (SELECT COUNT(*)::INT FROM public.pengembalian)),
        jsonb_build_object('table', 'detail_pengembalian', 'count', (SELECT COUNT(*)::INT FROM public.detail_pengembalian)),
        jsonb_build_object('table', 'sanksi_denda', 'count', (SELECT COUNT(*)::INT FROM public.sanksi_denda))
    );

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_books
    FROM (
        SELECT
            d.id_buku,
            COALESCE(kb.judul, d.id_buku) AS judul,
            COALESCE(kat.nama_kategori, '-') AS kategori,
            COUNT(*)::INT AS jumlah_sirkulasi
        FROM public.detail_pengembalian d
        LEFT JOIN public.katalog_buku kb ON kb.id_buku = d.id_buku
        LEFT JOIN public.kategori_buku kat ON kat.id_kategori = kb.id_kategori
        GROUP BY d.id_buku, kb.judul, kat.nama_kategori
        ORDER BY jumlah_sirkulasi DESC, d.id_buku
    ) t;

    IF v_actor.actor_role = 'staf' THEN
        SELECT COALESCE(SUM(jumlah_denda), 0), COUNT(*)::INT
        INTO v_kas_lunas, v_lunas_count
        FROM public.sanksi_denda
        WHERE status_pembayaran = 'Lunas';

        SELECT COUNT(*)::INT INTO v_overdue_count
        FROM public.peminjaman
        WHERE status_peminjaman IN ('Dipinjam', 'Terlambat')
          AND (status_peminjaman = 'Terlambat' OR tgl_jatuh_tempo < CURRENT_DATE);
    END IF;

    RETURN jsonb_build_object(
        'tableCounts', v_counts,
        'topBooks', v_top_books,
        'totalKasLunas', v_kas_lunas,
        'lunasCount', v_lunas_count,
        'overdueCount', v_overdue_count
    );
END;
$$;

-- 6. RPC Baca Terotorisasi (Staf & Anggota Scoped)
CREATE OR REPLACE FUNCTION public.rpc_next_id(
    p_token TEXT,
    p_table TEXT,
    p_prefix TEXT,
    p_pad INT DEFAULT 3
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_max INT := 0;
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_table = 'anggota' THEN
        SELECT COALESCE(MAX((substring(id_anggota FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.anggota WHERE id_anggota LIKE p_prefix || '%' AND substring(id_anggota FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'staf' THEN
        SELECT COALESCE(MAX((substring(id_staf FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.staf WHERE id_staf LIKE p_prefix || '%' AND substring(id_staf FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'kategori_buku' THEN
        SELECT COALESCE(MAX((substring(id_kategori FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.kategori_buku WHERE id_kategori LIKE p_prefix || '%' AND substring(id_kategori FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'katalog_buku' THEN
        SELECT COALESCE(MAX((substring(id_buku FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.katalog_buku WHERE id_buku LIKE p_prefix || '%' AND substring(id_buku FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'peminjaman' THEN
        SELECT COALESCE(MAX((substring(id_peminjaman FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.peminjaman WHERE id_peminjaman LIKE p_prefix || '%' AND substring(id_peminjaman FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'pengembalian' THEN
        SELECT COALESCE(MAX((substring(id_pengembalian FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.pengembalian WHERE id_pengembalian LIKE p_prefix || '%' AND substring(id_pengembalian FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSIF p_table = 'sanksi_denda' THEN
        SELECT COALESCE(MAX((substring(id_denda FROM length(p_prefix) + 1))::INT), 0) INTO v_max
        FROM public.sanksi_denda WHERE id_denda LIKE p_prefix || '%' AND substring(id_denda FROM length(p_prefix) + 1) ~ '^[0-9]+$';
    ELSE
        RAISE EXCEPTION 'Tabel tidak valid untuk generator ID: %', p_table;
    END IF;

    RETURN p_prefix || lpad((v_max + 1)::TEXT, GREATEST(1, p_pad), '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_anggota_list(
    p_token TEXT,
    p_tipe TEXT DEFAULT 'ALL',
    p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_q TEXT := trim(COALESCE(p_search, ''));
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(row_to_json(v) ORDER BY v.id_anggota), '[]'::jsonb) INTO v_res
    FROM public.v_anggota_lengkap v
    WHERE (v_actor.actor_role = 'staf' OR v.id_anggota = v_actor.actor_id)
      AND (p_tipe = 'ALL' OR v.tipe_anggota = p_tipe)
      AND (
          v_q = ''
          OR v.nama ILIKE '%' || v_q || '%'
          OR v.id_anggota ILIKE '%' || v_q || '%'
          OR COALESCE(v.nisn, '') ILIKE '%' || v_q || '%'
          OR COALESCE(v.nip, '') ILIKE '%' || v_q || '%'
      );

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_staf_list(p_token TEXT)
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
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    RETURN QUERY
    SELECT s.id_staf, s.jabatan, s.username, s.id_supervisor
    FROM public.staf s
    ORDER BY s.id_staf;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_peminjaman_list(
    p_token TEXT,
    p_status TEXT DEFAULT 'ALL',
    p_search TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_q TEXT := trim(COALESCE(p_search, ''));
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_peminjaman', p.id_peminjaman,
            'tgl_pinjam', p.tgl_pinjam,
            'tgl_jatuh_tempo', p.tgl_jatuh_tempo,
            'status_peminjaman', p.status_peminjaman,
            'id_anggota', p.id_anggota,
            'id_staf', p.id_staf,
            'anggota', jsonb_build_object('nama', a.nama),
            'staf', jsonb_build_object('username', st.username, 'jabatan', st.jabatan),
            'pengembalian', CASE
                WHEN pg.id_pengembalian IS NOT NULL THEN jsonb_build_object(
                    'id_pengembalian', pg.id_pengembalian,
                    'tgl_kembali', pg.tgl_kembali,
                    'hari_terlambat', pg.hari_terlambat
                )
                ELSE NULL
            END
        )
        ORDER BY p.tgl_pinjam DESC, p.id_peminjaman DESC
    ), '[]'::jsonb)
    INTO v_res
    FROM public.peminjaman p
    JOIN public.anggota a ON a.id_anggota = p.id_anggota
    JOIN public.staf st ON st.id_staf = p.id_staf
    LEFT JOIN public.pengembalian pg ON pg.id_peminjaman = p.id_peminjaman
    WHERE (v_actor.actor_role = 'staf' OR p.id_anggota = v_actor.actor_id)
      AND (
          p_status = 'ALL'
          OR (p_status = 'AKTIF' AND p.status_peminjaman IN ('Dipinjam', 'Terlambat'))
          OR p.status_peminjaman = p_status
      )
      AND (
          v_q = ''
          OR p.id_peminjaman ILIKE '%' || v_q || '%'
          OR p.id_anggota ILIKE '%' || v_q || '%'
          OR a.nama ILIKE '%' || v_q || '%'
      );

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_pengembalian_list(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_pengembalian', pg.id_pengembalian,
            'id_peminjaman', pg.id_peminjaman,
            'tgl_kembali', pg.tgl_kembali,
            'hari_terlambat', pg.hari_terlambat,
            'peminjaman', jsonb_build_object(
                'id_anggota', p.id_anggota,
                'tgl_pinjam', p.tgl_pinjam,
                'tgl_jatuh_tempo', p.tgl_jatuh_tempo,
                'anggota', jsonb_build_object('nama', a.nama)
            ),
            'detail_pengembalian', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id_buku', dp.id_buku,
                        'no_eksemplar', dp.no_eksemplar,
                        'inventaris', jsonb_build_object(
                            'katalog_buku', jsonb_build_object('judul', kb.judul)
                        )
                    )
                    ORDER BY dp.id_buku, dp.no_eksemplar
                )
                FROM public.detail_pengembalian dp
                LEFT JOIN public.katalog_buku kb ON kb.id_buku = dp.id_buku
                WHERE dp.id_pengembalian = pg.id_pengembalian
            ), '[]'::jsonb),
            'sanksi_denda', CASE
                WHEN sd.id_denda IS NOT NULL THEN jsonb_build_object(
                    'id_denda', sd.id_denda,
                    'jenis_sanksi', sd.jenis_sanksi,
                    'jumlah_denda', sd.jumlah_denda,
                    'status_pembayaran', sd.status_pembayaran
                )
                ELSE NULL
            END
        )
        ORDER BY pg.tgl_kembali DESC, pg.id_pengembalian DESC
    ), '[]'::jsonb)
    INTO v_res
    FROM public.pengembalian pg
    JOIN public.peminjaman p ON p.id_peminjaman = pg.id_peminjaman
    JOIN public.anggota a ON a.id_anggota = p.id_anggota
    LEFT JOIN public.sanksi_denda sd ON sd.id_pengembalian = pg.id_pengembalian
    WHERE (v_actor.actor_role = 'staf' OR p.id_anggota = v_actor.actor_id);

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_get_denda_list(
    p_token TEXT,
    p_status TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(row_to_json(v) ORDER BY v.id_denda DESC), '[]'::jsonb)
    INTO v_res
    FROM public.v_denda_lengkap v
    WHERE (v_actor.actor_role = 'staf' OR v.id_anggota = v_actor.actor_id)
      AND (p_status = 'ALL' OR v.status_pembayaran = p_status);

    RETURN v_res;
END;
$$;

-- 7. RPC 5 SQL Mission Objectives Terotorisasi
CREATE OR REPLACE FUNCTION public.rpc_mission1_cari_anggota(
    p_token TEXT,
    p_keyword TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_q TEXT := trim(COALESCE(p_keyword, ''));
    v_res JSONB;
BEGIN
    v_staf := private.require_staf(p_token);

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_anggota', v.id_anggota,
            'nama', v.nama,
            'tipe_anggota', v.tipe_anggota,
            'nisn', v.nisn,
            'nip', v.nip,
            'kelas', v.kelas,
            'unit_kerja_mata_pelajaran', v.unit_kerja_mata_pelajaran
        )
        ORDER BY v.id_anggota
    ), '[]'::jsonb)
    INTO v_res
    FROM public.v_anggota_lengkap v
    WHERE v_q = ''
       OR v.nisn = v_q
       OR v.nip = v_q
       OR v.nama ILIKE '%' || v_q || '%'
       OR v.id_anggota ILIKE '%' || v_q || '%';

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_mission3_peminjaman_tanggal(
    p_token TEXT,
    p_tgl DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_res JSONB;
BEGIN
    v_staf := private.require_staf(p_token);

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_peminjaman', p.id_peminjaman,
            'id_anggota', p.id_anggota,
            'tgl_pinjam', p.tgl_pinjam,
            'tgl_jatuh_tempo', p.tgl_jatuh_tempo,
            'status_peminjaman', p.status_peminjaman
        )
        ORDER BY p.id_peminjaman
    ), '[]'::jsonb)
    INTO v_res
    FROM public.peminjaman p
    WHERE p.status_peminjaman IN ('Dipinjam', 'Terlambat')
      AND (p_tgl IS NULL OR p.tgl_pinjam = p_tgl);

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_mission4_peminjaman_anggota(
    p_token TEXT,
    p_keyword TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_q TEXT := trim(COALESCE(p_keyword, ''));
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_peminjaman', p.id_peminjaman,
            'id_anggota', p.id_anggota,
            'nama', a.nama,
            'tgl_pinjam', p.tgl_pinjam,
            'tgl_jatuh_tempo', p.tgl_jatuh_tempo,
            'status_peminjaman', p.status_peminjaman
        )
        ORDER BY p.id_peminjaman
    ), '[]'::jsonb)
    INTO v_res
    FROM public.peminjaman p
    JOIN public.anggota a ON a.id_anggota = p.id_anggota
    WHERE p.status_peminjaman IN ('Dipinjam', 'Terlambat')
      AND (v_actor.actor_role = 'staf' OR p.id_anggota = v_actor.actor_id)
      AND (v_q = '' OR lower(p.id_anggota) = lower(v_q) OR a.nama ILIKE '%' || v_q || '%');

    RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_mission5_denda_belum_lunas(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_actor RECORD;
    v_res JSONB;
BEGIN
    SELECT * INTO v_actor FROM private.require_actor(p_token) LIMIT 1;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id_denda', v.id_denda,
            'nama_anggota', v.nama_anggota,
            'jenis_sanksi', v.jenis_sanksi,
            'jumlah_denda', v.jumlah_denda,
            'status_pembayaran', v.status_pembayaran,
            'id_peminjaman', v.id_peminjaman,
            'hari_terlambat', v.hari_terlambat
        )
        ORDER BY v.id_denda
    ), '[]'::jsonb)
    INTO v_res
    FROM public.v_denda_lengkap v
    WHERE v.status_pembayaran = 'Belum Lunas'
      AND (v_actor.actor_role = 'staf' OR v.id_anggota = v_actor.actor_id);

    RETURN v_res;
END;
$$;

-- 8. RPC Mutasi Katalog, Kategori, Inventaris, & Anggota (Khusus Staf)
CREATE OR REPLACE FUNCTION public.rpc_save_kategori(
    p_token TEXT,
    p_id_kategori VARCHAR(10),
    p_nama_kategori VARCHAR(50),
    p_lokasi_rak VARCHAR(20) DEFAULT NULL,
    p_is_edit BOOLEAN DEFAULT FALSE
)
RETURNS public.kategori_buku
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_row public.kategori_buku%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_is_edit THEN
        UPDATE public.kategori_buku
        SET nama_kategori = trim(p_nama_kategori),
            lokasi_rak = NULLIF(trim(COALESCE(p_lokasi_rak, '')), '')
        WHERE id_kategori = p_id_kategori
        RETURNING * INTO v_row;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Kategori % tidak ditemukan.', p_id_kategori;
        END IF;
    ELSE
        INSERT INTO public.kategori_buku (id_kategori, nama_kategori, lokasi_rak)
        VALUES (trim(p_id_kategori), trim(p_nama_kategori), NULLIF(trim(COALESCE(p_lokasi_rak, '')), ''))
        RETURNING * INTO v_row;
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_kategori(
    p_token TEXT,
    p_id_kategori VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    DELETE FROM public.kategori_buku WHERE id_kategori = p_id_kategori;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_save_katalog(
    p_token TEXT,
    p_id_buku VARCHAR(10),
    p_isbn VARCHAR(17),
    p_judul VARCHAR(150),
    p_penerbit VARCHAR(80),
    p_tahun_terbit SMALLINT,
    p_id_kategori VARCHAR(10),
    p_is_edit BOOLEAN DEFAULT FALSE,
    p_initial_copies INT DEFAULT 1
)
RETURNS public.katalog_buku
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_row public.katalog_buku%ROWTYPE;
    v_copies INT := GREATEST(1, LEAST(50, COALESCE(p_initial_copies, 1)));
    i INT;
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_is_edit THEN
        UPDATE public.katalog_buku
        SET isbn = trim(p_isbn),
            judul = trim(p_judul),
            penerbit = NULLIF(trim(COALESCE(p_penerbit, '')), ''),
            tahun_terbit = p_tahun_terbit,
            id_kategori = p_id_kategori
        WHERE id_buku = p_id_buku
        RETURNING * INTO v_row;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Judul buku % tidak ditemukan.', p_id_buku;
        END IF;
    ELSE
        INSERT INTO public.katalog_buku (id_buku, isbn, judul, penerbit, tahun_terbit, id_kategori)
        VALUES (
            trim(p_id_buku),
            trim(p_isbn),
            trim(p_judul),
            NULLIF(trim(COALESCE(p_penerbit, '')), ''),
            p_tahun_terbit,
            p_id_kategori
        )
        RETURNING * INTO v_row;

        FOR i IN 1..v_copies LOOP
            INSERT INTO public.inventaris (id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik)
            VALUES (v_row.id_buku, i, 'Tersedia', 'Baik');
        END LOOP;
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_katalog(
    p_token TEXT,
    p_id_buku VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    DELETE FROM public.katalog_buku WHERE id_buku = p_id_buku;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_add_inventaris_copy(
    p_token TEXT,
    p_id_buku VARCHAR(10),
    p_status_ketersediaan VARCHAR(10) DEFAULT 'Tersedia',
    p_kondisi_fisik VARCHAR(10) DEFAULT 'Baik'
)
RETURNS public.inventaris
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_next_no SMALLINT;
    v_row public.inventaris%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    SELECT COALESCE(MAX(no_eksemplar), 0) + 1 INTO v_next_no
    FROM public.inventaris
    WHERE id_buku = p_id_buku;

    INSERT INTO public.inventaris (id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik)
    VALUES (p_id_buku, v_next_no, p_status_ketersediaan, p_kondisi_fisik)
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_update_inventaris_copy(
    p_token TEXT,
    p_id_buku VARCHAR(10),
    p_no_eksemplar SMALLINT,
    p_status_ketersediaan VARCHAR(10),
    p_kondisi_fisik VARCHAR(10)
)
RETURNS public.inventaris
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
    v_row public.inventaris%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    UPDATE public.inventaris
    SET status_ketersediaan = p_status_ketersediaan,
        kondisi_fisik = p_kondisi_fisik
    WHERE id_buku = p_id_buku AND no_eksemplar = p_no_eksemplar
    RETURNING * INTO v_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eksemplar % #% tidak ditemukan.', p_id_buku, p_no_eksemplar;
    END IF;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_inventaris_copy(
    p_token TEXT,
    p_id_buku VARCHAR(10),
    p_no_eksemplar SMALLINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    DELETE FROM public.inventaris
    WHERE id_buku = p_id_buku AND no_eksemplar = p_no_eksemplar;
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_save_anggota(
    p_token TEXT,
    p_id_anggota VARCHAR(10),
    p_nama VARCHAR(100),
    p_no_telepon VARCHAR(15),
    p_alamat VARCHAR(150),
    p_tgl_bergabung DATE,
    p_tipe TEXT,
    p_nisn TEXT DEFAULT NULL,
    p_kelas VARCHAR(5) DEFAULT NULL,
    p_tahun_angkatan SMALLINT DEFAULT NULL,
    p_nip TEXT DEFAULT NULL,
    p_unit_kerja VARCHAR(60) DEFAULT NULL,
    p_is_edit BOOLEAN DEFAULT FALSE
)
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);

    IF p_is_edit THEN
        UPDATE public.anggota
        SET nama = trim(p_nama),
            no_telepon = NULLIF(trim(COALESCE(p_no_telepon, '')), ''),
            alamat = NULLIF(trim(COALESCE(p_alamat, '')), ''),
            tgl_bergabung = p_tgl_bergabung
        WHERE id_anggota = p_id_anggota;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Anggota % tidak ditemukan.', p_id_anggota;
        END IF;

        IF p_tipe = 'Siswa' THEN
            UPDATE public.siswa
            SET nisn = trim(p_nisn),
                kelas = trim(p_kelas),
                tahun_angkatan = p_tahun_angkatan
            WHERE id_anggota = p_id_anggota;
        ELSIF p_tipe = 'Guru/Karyawan' THEN
            UPDATE public.guru_karyawan
            SET nip = trim(p_nip),
                unit_kerja_mata_pelajaran = NULLIF(trim(COALESCE(p_unit_kerja, '')), '')
            WHERE id_anggota = p_id_anggota;
        ELSE
            RAISE EXCEPTION 'Tipe anggota tidak valid: %', p_tipe;
        END IF;
    ELSE
        INSERT INTO public.anggota (id_anggota, nama, no_telepon, alamat, tgl_bergabung)
        VALUES (
            trim(p_id_anggota),
            trim(p_nama),
            NULLIF(trim(COALESCE(p_no_telepon, '')), ''),
            NULLIF(trim(COALESCE(p_alamat, '')), ''),
            COALESCE(p_tgl_bergabung, CURRENT_DATE)
        );

        IF p_tipe = 'Siswa' THEN
            INSERT INTO public.siswa (id_anggota, nisn, kelas, tahun_angkatan)
            VALUES (trim(p_id_anggota), trim(p_nisn), trim(p_kelas), p_tahun_angkatan);
        ELSIF p_tipe = 'Guru/Karyawan' THEN
            INSERT INTO public.guru_karyawan (id_anggota, nip, unit_kerja_mata_pelajaran)
            VALUES (trim(p_id_anggota), trim(p_nip), NULLIF(trim(COALESCE(p_unit_kerja, '')), ''));
        ELSE
            RAISE EXCEPTION 'Tipe anggota tidak valid: %', p_tipe;
        END IF;
    END IF;

    RETURN trim(p_id_anggota);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_delete_anggota(
    p_token TEXT,
    p_id_anggota VARCHAR(10)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
    v_staf public.staf%ROWTYPE;
BEGIN
    v_staf := private.require_staf(p_token);
    DELETE FROM public.anggota WHERE id_anggota = p_id_anggota;
    RETURN FOUND;
END;
$$;

-- 9. RPC Transaksi Atomik Peminjaman, Pengembalian, Denda, & Staf
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
    v_sup VARCHAR(10) := NULLIF(trim(COALESCE(p_id_supervisor, '')), '');
BEGIN
    v_head := private.require_head_librarian(p_token);

    IF p_username !~ '^[a-zA-Z0-9_.-]{3,30}$' THEN
        RAISE EXCEPTION 'Username staf harus 3-30 karakter alfanumerik/._-.';
    END IF;
    IF p_password IS NOT NULL AND length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password staf minimal 8 karakter.';
    END IF;
    IF v_sup = p_id_staf THEN
        RAISE EXCEPTION 'Staf tidak dapat menjadi supervisor dirinya sendiri.';
    END IF;

    IF p_is_edit THEN
        IF p_id_staf = v_head.id_staf AND v_sup IS NOT NULL THEN
            RAISE EXCEPTION 'Kepala Perpustakaan aktif tidak dapat menurunkan perannya sendiri.';
        END IF;

        UPDATE public.staf s
        SET jabatan = trim(p_jabatan),
            username = trim(p_username),
            id_supervisor = v_sup,
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
        VALUES (trim(p_id_staf), trim(p_jabatan), trim(p_username), p_password, v_sup);
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

-- 10. Hak Eksekusi Publik Terbatas pada RPC Terproteksi
REVOKE ALL ON FUNCTION public.staf_login_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staf_logout_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anggota_login_session(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anggota_logout_session(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_dashboard_stats(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_laporan_statistik(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_next_id(TEXT, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_anggota_list(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_staf_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_peminjaman_list(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_pengembalian_list(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_get_denda_list(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_mission1_cari_anggota(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_mission3_peminjaman_tanggal(TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_mission4_peminjaman_anggota(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_mission5_denda_belum_lunas(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_save_kategori(TEXT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_kategori(TEXT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_save_katalog(TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, SMALLINT, VARCHAR, BOOLEAN, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_katalog(TEXT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_add_inventaris_copy(TEXT, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_update_inventaris_copy(TEXT, VARCHAR, SMALLINT, VARCHAR, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_inventaris_copy(TEXT, VARCHAR, SMALLINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_save_anggota(TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, TEXT, TEXT, VARCHAR, SMALLINT, TEXT, VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_anggota(TEXT, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_create_peminjaman(TEXT, VARCHAR, DATE, DATE, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_process_pengembalian(TEXT, VARCHAR, VARCHAR, DATE, INT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_bayar_denda(TEXT, VARCHAR, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_upsert_staf(TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_delete_staf(TEXT, VARCHAR) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
    public.staf_login_session(TEXT, TEXT),
    public.staf_logout_session(TEXT),
    public.anggota_login_session(TEXT, TEXT),
    public.anggota_logout_session(TEXT),
    public.rpc_get_dashboard_stats(TEXT),
    public.rpc_get_laporan_statistik(TEXT),
    public.rpc_next_id(TEXT, TEXT, TEXT, INT),
    public.rpc_get_anggota_list(TEXT, TEXT, TEXT),
    public.rpc_get_staf_list(TEXT),
    public.rpc_get_peminjaman_list(TEXT, TEXT, TEXT),
    public.rpc_get_pengembalian_list(TEXT),
    public.rpc_get_denda_list(TEXT, TEXT),
    public.rpc_mission1_cari_anggota(TEXT, TEXT),
    public.rpc_mission3_peminjaman_tanggal(TEXT, DATE),
    public.rpc_mission4_peminjaman_anggota(TEXT, TEXT),
    public.rpc_mission5_denda_belum_lunas(TEXT),
    public.rpc_save_kategori(TEXT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN),
    public.rpc_delete_kategori(TEXT, VARCHAR),
    public.rpc_save_katalog(TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, SMALLINT, VARCHAR, BOOLEAN, INT),
    public.rpc_delete_katalog(TEXT, VARCHAR),
    public.rpc_add_inventaris_copy(TEXT, VARCHAR, VARCHAR, VARCHAR),
    public.rpc_update_inventaris_copy(TEXT, VARCHAR, SMALLINT, VARCHAR, VARCHAR),
    public.rpc_delete_inventaris_copy(TEXT, VARCHAR, SMALLINT),
    public.rpc_save_anggota(TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, DATE, TEXT, TEXT, VARCHAR, SMALLINT, TEXT, VARCHAR, BOOLEAN),
    public.rpc_delete_anggota(TEXT, VARCHAR),
    public.rpc_create_peminjaman(TEXT, VARCHAR, DATE, DATE, VARCHAR, JSONB),
    public.rpc_process_pengembalian(TEXT, VARCHAR, VARCHAR, DATE, INT, JSONB, JSONB),
    public.rpc_bayar_denda(TEXT, VARCHAR, DATE),
    public.rpc_upsert_staf(TEXT, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN),
    public.rpc_delete_staf(TEXT, VARCHAR)
TO anon, authenticated;
