/**
 * Smart Library SMP Negeri 1 Dramaga — Data Layer Supabase (PostgreSQL 3NF)
 * Kelompok 10 (Paralel 2) — Basis Data IPB University
 *
 * Catatan Keamanan:
 * SUPABASE_URL dan SUPABASE_PUBLISHABLE_KEY adalah kunci publik frontend Supabase.
 * Seluruh tabel PII/transaksi dilindungi RLS ketat dan hanya dapat diakses melalui
 * RPC SECURITY DEFINER berotorisasi token sesi server-side (skema `private`).
 */

const SUPABASE_URL = 'https://rntjeqcmamlzqpmmcmxi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YU9WMSH469XyUtH88FgtCA_k5_tyRe5';

function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function addDaysISO(baseIso, days) {
    const [y, m, d] = baseIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + Number(days || 0));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function diffDaysISO(laterIso, earlierIso) {
    if (!laterIso || !earlierIso) return 0;
    const [y1, m1, d1] = laterIso.split('-').map(Number);
    const [y2, m2, d2] = earlierIso.split('-').map(Number);
    const ms = new Date(y1, m1 - 1, d1) - new Date(y2, m2 - 1, d2);
    return Math.max(0, Math.round(ms / 86400000));
}

function sanitizePostgrestSearch(str) {
    return String(str || '')
        .slice(0, 100)
        .replace(/[(),.*"'\\%_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeStrictIdentifier(str) {
    const trimmed = String(str || '').trim();
    return /^[A-Za-z0-9_-]{1,30}$/.test(trimmed) ? trimmed : '';
}

class SmartLibraryDB {
    constructor() {
        this.client = null;
        this.schemaReady = false;
        this.sessionToken = null;
        this.sessionRole = null;
        this.onSessionExpired = null;
    }

    setSession(token, role) {
        this.sessionToken = token || null;
        this.sessionRole = role || null;
    }

    unwrap(res, context = 'Operasi database') {
        if (res.error) {
            if (res.error.code === '28000' && typeof this.onSessionExpired === 'function') {
                this.onSessionExpired();
            }
            const msg = res.error.message || res.error.details || 'Kesalahan tidak diketahui';
            throw new Error(`${context}: ${msg}`);
        }
        return res.data;
    }

    async rpc(fnName, params = {}, context = 'Operasi database') {
        return this.unwrap(await this.client.rpc(fnName, params), context);
    }

    init() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            throw new Error('Library @supabase/supabase-js gagal dimuat. Pastikan koneksi internet aktif.');
        }
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        return this.checkSchema();
    }

    async checkSchema() {
        const { error } = await this.client
            .from('kategori_buku')
            .select('id_kategori', { count: 'exact', head: true });

        if (!error) {
            this.schemaReady = true;
            return { connected: true, schemaReady: true };
        }

        const msg = (error.message || '').toLowerCase();
        const code = error.code || '';
        const isMissingTable = code === 'PGRST205' || code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
        if (isMissingTable) {
            this.schemaReady = false;
            return { connected: true, schemaReady: false, reason: error.message };
        }
        throw new Error(`Koneksi Supabase gagal: ${error.message}`);
    }

    // ==================== AUTENTIKASI & SESI SERVER-SIDE ====================
    async loginStaf(username, password) {
        const rows = await this.rpc('staf_login_session', {
            p_username: String(username || '').trim(),
            p_password: String(password || '')
        }, 'Login staf');

        if (!rows || rows.length === 0) {
            throw new Error('Username atau password staf salah.');
        }
        const row = rows[0];
        this.setSession(row.session_token, 'staf');
        return {
            token: row.session_token,
            expires_at: row.expires_at,
            user: {
                id_staf: row.id_staf,
                jabatan: row.jabatan,
                username: row.username,
                id_supervisor: row.id_supervisor
            }
        };
    }

    async loginAnggota(idAnggota, identitas) {
        const qId = sanitizeStrictIdentifier(idAnggota);
        const qIdent = String(identitas || '').trim();
        if (!qId) {
            throw new Error('Format ID Anggota tidak valid (misal: A001).');
        }
        if (!/^\d{10,18}$/.test(qIdent)) {
            throw new Error('Masukkan NISN (10 digit) atau NIP (18 digit) yang valid.');
        }
        const rows = await this.rpc('anggota_login_session', {
            p_id_anggota: qId,
            p_identitas: qIdent
        }, 'Login anggota');

        if (!rows || rows.length === 0) {
            throw new Error('Kombinasi ID Anggota dan NISN/NIP tidak cocok.');
        }
        const row = rows[0];
        this.setSession(row.session_token, 'anggota');
        return {
            token: row.session_token,
            expires_at: row.expires_at,
            user: {
                id_anggota: row.id_anggota,
                nama: row.nama,
                tipe_anggota: row.tipe_anggota,
                kelas: row.kelas,
                tahun_angkatan: row.tahun_angkatan,
                unit_kerja_mata_pelajaran: row.unit_kerja_mata_pelajaran,
                tgl_bergabung: row.tgl_bergabung
            }
        };
    }

    async logout() {
        const token = this.sessionToken;
        const role = this.sessionRole;
        this.setSession(null, null);
        if (!token || !this.client) return;
        try {
            const fn = role === 'staf' ? 'staf_logout_session' : 'anggota_logout_session';
            await this.client.rpc(fn, { p_token: token });
        } catch (_) {
            // Abaikan error jaringan saat logout
        }
    }

    // ==================== ID GENERATOR & DASHBOARD ====================
    async nextId(table, _col, prefix, pad = 3) {
        return this.rpc('rpc_next_id', {
            p_token: this.sessionToken,
            p_table: table,
            p_prefix: prefix,
            p_pad: pad
        }, `Ambil ID ${table}`);
    }

    async getDashboardStats() {
        return this.rpc('rpc_get_dashboard_stats', {
            p_token: this.sessionToken
        }, 'Statistik dashboard');
    }

    // ==================== KATEGORI, KATALOG & INVENTARIS ====================
    async getKategoriList() {
        return this.unwrap(
            await this.client.from('kategori_buku').select('*').order('id_kategori'),
            'Ambil kategori'
        );
    }

    async saveKategori(payload, isEdit = false) {
        return this.rpc('rpc_save_kategori', {
            p_token: this.sessionToken,
            p_id_kategori: payload.id_kategori,
            p_nama_kategori: payload.nama_kategori,
            p_lokasi_rak: payload.lokasi_rak || null,
            p_is_edit: isEdit
        }, isEdit ? 'Perbarui kategori' : 'Tambah kategori');
    }

    async deleteKategori(id_kategori) {
        return this.rpc('rpc_delete_kategori', {
            p_token: this.sessionToken,
            p_id_kategori: id_kategori
        }, 'Hapus kategori');
    }

    async getKatalogStok({ search = '', idKategori = 'ALL' } = {}) {
        let query = this.client.from('v_katalog_stok').select('*').order('id_buku');
        if (idKategori !== 'ALL') {
            query = query.eq('id_kategori', idKategori);
        }
        if (search.trim()) {
            const s = sanitizePostgrestSearch(search);
            if (s) query = query.or(`judul.ilike.%${s}%,isbn.ilike.%${s}%,penerbit.ilike.%${s}%,id_buku.ilike.%${s}%`);
        }
        return this.unwrap(await query, 'Ambil katalog');
    }

    async saveKatalog(payload, isEdit = false, initialCopies = 1) {
        return this.rpc('rpc_save_katalog', {
            p_token: this.sessionToken,
            p_id_buku: payload.id_buku,
            p_isbn: payload.isbn,
            p_judul: payload.judul,
            p_penerbit: payload.penerbit || null,
            p_tahun_terbit: payload.tahun_terbit || null,
            p_id_kategori: payload.id_kategori,
            p_is_edit: isEdit,
            p_initial_copies: Number(initialCopies || 1)
        }, isEdit ? 'Perbarui katalog' : 'Tambah katalog');
    }

    async deleteKatalog(id_buku) {
        return this.rpc('rpc_delete_katalog', {
            p_token: this.sessionToken,
            p_id_buku: id_buku
        }, 'Hapus katalog buku');
    }

    async getInventarisList({ idBuku = null, status = 'ALL' } = {}) {
        let query = this.client
            .from('inventaris')
            .select('id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik, katalog_buku(judul, isbn, kategori_buku(nama_kategori, lokasi_rak))')
            .order('id_buku')
            .order('no_eksemplar');
        if (idBuku) query = query.eq('id_buku', idBuku);
        if (status !== 'ALL') query = query.eq('status_ketersediaan', status);
        return this.unwrap(await query, 'Ambil inventaris');
    }

    async addInventarisCopy({ id_buku, status_ketersediaan = 'Tersedia', kondisi_fisik = 'Baik' }) {
        return this.rpc('rpc_add_inventaris_copy', {
            p_token: this.sessionToken,
            p_id_buku: id_buku,
            p_status_ketersediaan: status_ketersediaan,
            p_kondisi_fisik: kondisi_fisik
        }, 'Tambah eksemplar');
    }

    async updateInventarisCopy({ id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik }) {
        return this.rpc('rpc_update_inventaris_copy', {
            p_token: this.sessionToken,
            p_id_buku: id_buku,
            p_no_eksemplar: Number(no_eksemplar),
            p_status_ketersediaan: status_ketersediaan,
            p_kondisi_fisik: kondisi_fisik
        }, 'Perbarui eksemplar');
    }

    async deleteInventarisCopy(id_buku, no_eksemplar) {
        return this.rpc('rpc_delete_inventaris_copy', {
            p_token: this.sessionToken,
            p_id_buku: id_buku,
            p_no_eksemplar: Number(no_eksemplar)
        }, 'Hapus eksemplar');
    }

    // ==================== ANGGOTA (DISJOINT) & STAF (REKURSIF) ====================
    async getAnggotaList({ tipe = 'ALL', search = '' } = {}) {
        return this.rpc('rpc_get_anggota_list', {
            p_token: this.sessionToken,
            p_tipe: tipe,
            p_search: search || ''
        }, 'Ambil anggota');
    }

    async createAnggotaLengkap({ base, tipe, detail }) {
        return this.rpc('rpc_save_anggota', {
            p_token: this.sessionToken,
            p_id_anggota: base.id_anggota,
            p_nama: base.nama,
            p_no_telepon: base.no_telepon,
            p_alamat: base.alamat,
            p_tgl_bergabung: base.tgl_bergabung,
            p_tipe: tipe,
            p_nisn: detail.nisn || null,
            p_kelas: detail.kelas || null,
            p_tahun_angkatan: detail.tahun_angkatan || null,
            p_nip: detail.nip || null,
            p_unit_kerja: detail.unit_kerja_mata_pelajaran || null,
            p_is_edit: false
        }, 'Tambah anggota');
    }

    async updateAnggotaLengkap({ id_anggota, base, tipe, detail }) {
        return this.rpc('rpc_save_anggota', {
            p_token: this.sessionToken,
            p_id_anggota: id_anggota,
            p_nama: base.nama,
            p_no_telepon: base.no_telepon,
            p_alamat: base.alamat,
            p_tgl_bergabung: base.tgl_bergabung,
            p_tipe: tipe,
            p_nisn: detail.nisn || null,
            p_kelas: detail.kelas || null,
            p_tahun_angkatan: detail.tahun_angkatan || null,
            p_nip: detail.nip || null,
            p_unit_kerja: detail.unit_kerja_mata_pelajaran || null,
            p_is_edit: true
        }, 'Perbarui anggota');
    }

    async deleteAnggota(id_anggota) {
        return this.rpc('rpc_delete_anggota', {
            p_token: this.sessionToken,
            p_id_anggota: id_anggota
        }, 'Hapus anggota');
    }

    async getStafList() {
        return this.rpc('rpc_get_staf_list', {
            p_token: this.sessionToken
        }, 'Ambil data staf');
    }

    async saveStaf(payload, isEdit = false) {
        const username = String(payload.username || '').trim();
        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
            throw new Error('Username staf harus 3-30 karakter (huruf, angka, _, ., atau -).');
        }
        if (payload.password && String(payload.password).length < 8) {
            throw new Error('Password staf minimal 8 karakter.');
        }
        if (!isEdit && !payload.password) {
            throw new Error('Password wajib diisi untuk staf baru.');
        }

        return this.rpc('rpc_upsert_staf', {
            p_token: this.sessionToken,
            p_id_staf: payload.id_staf,
            p_jabatan: payload.jabatan,
            p_username: username,
            p_password: payload.password || null,
            p_id_supervisor: payload.id_supervisor || null,
            p_is_edit: isEdit
        }, isEdit ? 'Perbarui staf' : 'Tambah staf');
    }

    async deleteStaf(id_staf) {
        return this.rpc('rpc_delete_staf', {
            p_token: this.sessionToken,
            p_id_staf: id_staf
        }, 'Hapus staf');
    }

    // ==================== SIRKULASI: PEMINJAMAN & PENGEMBALIAN ====================
    async getPeminjamanList({ status = 'ALL', search = '' } = {}) {
        return this.rpc('rpc_get_peminjaman_list', {
            p_token: this.sessionToken,
            p_status: status,
            p_search: search || ''
        }, 'Ambil daftar peminjaman');
    }

    async createPeminjaman({ id_peminjaman, tgl_pinjam, tgl_jatuh_tempo, id_anggota, copies }) {
        if (!copies || copies.length === 0) {
            throw new Error('Pilih minimal 1 eksemplar buku yang tersedia.');
        }
        if (!tgl_pinjam || !tgl_jatuh_tempo || tgl_jatuh_tempo < tgl_pinjam) {
            throw new Error('Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.');
        }
        return this.rpc('rpc_create_peminjaman', {
            p_token: this.sessionToken,
            p_id_peminjaman: id_peminjaman,
            p_tgl_pinjam: tgl_pinjam,
            p_tgl_jatuh_tempo: tgl_jatuh_tempo,
            p_id_anggota: id_anggota,
            p_copies: copies
        }, 'Simpan peminjaman');
    }

    async getPengembalianList() {
        return this.rpc('rpc_get_pengembalian_list', {
            p_token: this.sessionToken
        }, 'Ambil riwayat pengembalian');
    }

    async processPengembalian({ id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat, items, denda }) {
        if (!items || items.length === 0) {
            throw new Error('Pilih minimal 1 eksemplar buku yang dikembalikan.');
        }
        const lateDays = Number(hari_terlambat || 0);
        if (!Number.isFinite(lateDays) || lateDays < 0) {
            throw new Error('Hari terlambat tidak boleh bernilai negatif.');
        }
        if (denda && Number(denda.jumlah_denda) < 0) {
            throw new Error('Nominal denda tidak boleh bernilai negatif.');
        }

        return this.rpc('rpc_process_pengembalian', {
            p_token: this.sessionToken,
            p_id_pengembalian: id_pengembalian,
            p_id_peminjaman: id_peminjaman,
            p_tgl_kembali: tgl_kembali,
            p_hari_terlambat: lateDays,
            p_items: items,
            p_denda: denda && Number(denda.jumlah_denda) > 0 ? denda : null
        }, 'Catat pengembalian');
    }

    // ==================== SANKSI & DENDA ====================
    async getDendaList({ statusFilter = 'ALL' } = {}) {
        return this.rpc('rpc_get_denda_list', {
            p_token: this.sessionToken,
            p_status: statusFilter
        }, 'Ambil sanksi denda');
    }

    async bayarDenda(id_denda, tgl_bayar = todayLocalISO()) {
        return this.rpc('rpc_bayar_denda', {
            p_token: this.sessionToken,
            p_id_denda: id_denda,
            p_tgl_bayar: tgl_bayar
        }, 'Pelunasan denda');
    }

    // ==================== 5 SQL MISSION OBJECTIVES & LAPORAN ====================
    async mission1CariAnggota(keyword) {
        return this.rpc('rpc_mission1_cari_anggota', {
            p_token: this.sessionToken,
            p_keyword: keyword || ''
        }, 'Mission Objective 1');
    }

    async mission2CariBuku(keyword) {
        const s = sanitizePostgrestSearch(keyword);
        let query = this.client
            .from('v_katalog_stok')
            .select('id_buku, isbn, judul, penerbit, tahun_terbit, nama_kategori, lokasi_rak, stok_total, stok_tersedia');
        if (s) {
            query = query.or(`judul.ilike.%${s}%,penerbit.ilike.%${s}%,isbn.ilike.%${s}%,nama_kategori.ilike.%${s}%`);
        }
        return this.unwrap(await query.order('id_buku'), 'Mission Objective 2');
    }

    async mission3PeminjamanTanggal(tglPinjam) {
        return this.rpc('rpc_mission3_peminjaman_tanggal', {
            p_token: this.sessionToken,
            p_tgl: tglPinjam || null
        }, 'Mission Objective 3');
    }

    async mission4PeminjamanAnggota(idOrNama) {
        return this.rpc('rpc_mission4_peminjaman_anggota', {
            p_token: this.sessionToken,
            p_keyword: idOrNama || ''
        }, 'Mission Objective 4');
    }

    async mission5DendaBelumLunas() {
        return this.rpc('rpc_mission5_denda_belum_lunas', {
            p_token: this.sessionToken
        }, 'Mission Objective 5');
    }

    async getLaporanStatistik() {
        return this.rpc('rpc_get_laporan_statistik', {
            p_token: this.sessionToken
        }, 'Laporan statistik');
    }
}

window.SmartDB = new SmartLibraryDB();
window.DateUtil = { todayLocalISO, addDaysISO, diffDaysISO };
