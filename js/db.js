/**
 * Smart Library SMP Negeri 1 Dramaga — Data Layer Supabase (PostgreSQL 3NF)
 * Kelompok 10 (Paralel 2) — Basis Data IPB University
 */

const SUPABASE_URL = 'https://rntjeqcmamlzqpmmcmxi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YU9WMSH469XyUtH88FgtCA_k5_tyRe5';

const TABLES_11 = [
    'anggota', 'siswa', 'guru_karyawan', 'staf',
    'kategori_buku', 'katalog_buku', 'inventaris',
    'peminjaman', 'pengembalian', 'detail_pengembalian', 'sanksi_denda'
];

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

function unwrap(res, context = 'Operasi database') {
    if (res.error) {
        const msg = res.error.message || res.error.details || 'Kesalahan tidak diketahui';
        throw new Error(`${context}: ${msg}`);
    }
    return res.data;
}

class SmartLibraryDB {
    constructor() {
        this.client = null;
        this.schemaReady = false;
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

    // ==================== AUTHENTIKASI & PERAN ====================
    async loginStaf(username, password) {
        const data = unwrap(
            await this.client.rpc('verify_staf_login', {
                p_username: username.trim(),
                p_password: password
            }),
            'Login staf'
        );
        if (!data || data.length === 0) {
            throw new Error('Username atau password staf salah.');
        }
        return data[0];
    }

    async loginAnggota(identifier) {
        const q = sanitizeStrictIdentifier(identifier);
        if (!q) {
            throw new Error('Format ID Anggota, NISN, atau NIP tidak valid (gunakan huruf, angka, -, atau _).');
        }
        const rows = unwrap(
            await this.client
                .from('v_anggota_lengkap')
                .select('*')
                .or(`id_anggota.eq."${q}",nisn.eq."${q}",nip.eq."${q}"`)
                .limit(1),
            'Cari akun anggota'
        );
        if (!rows || rows.length === 0) {
            throw new Error('Data anggota tidak ditemukan.');
        }
        return rows[0];
    }

    // ==================== ID GENERATOR ====================
    async nextId(table, col, prefix, pad = 3) {
        const rows = unwrap(
            await this.client.from(table).select(col),
            `Ambil ID ${table}`
        );
        let maxNum = 0;
        for (const r of rows) {
            const val = String(r[col] || '');
            if (val.startsWith(prefix)) {
                const n = parseInt(val.slice(prefix.length), 10);
                if (!Number.isNaN(n) && n > maxNum) maxNum = n;
            }
        }
        return `${prefix}${String(maxNum + 1).padStart(pad, '0')}`;
    }

    // ==================== DASHBOARD & STATISTIK ====================
    async getDashboardStats() {
        const [katalogRes, invRes, pinjamRes, dendaRes] = await Promise.all([
            this.client.from('katalog_buku').select('id_buku', { count: 'exact', head: true }),
            this.client.from('inventaris').select('status_ketersediaan'),
            this.client.from('peminjaman').select('status_peminjaman, tgl_jatuh_tempo').in('status_peminjaman', ['Dipinjam', 'Terlambat']),
            this.client.from('sanksi_denda').select('jumlah_denda').eq('status_pembayaran', 'Belum Lunas')
        ]);

        const inv = unwrap(invRes, 'Statistik inventaris');
        const pinjam = unwrap(pinjamRes, 'Statistik peminjaman');
        const denda = unwrap(dendaRes, 'Statistik denda');
        const today = todayLocalISO();

        return {
            totalJudul: katalogRes.count || 0,
            totalEksemplar: inv.length,
            eksemplarTersedia: inv.filter((x) => x.status_ketersediaan === 'Tersedia').length,
            eksemplarDipinjam: inv.filter((x) => x.status_ketersediaan === 'Dipinjam').length,
            peminjamanAktif: pinjam.length,
            peminjamanTerlambat: pinjam.filter((x) => x.status_peminjaman === 'Terlambat' || x.tgl_jatuh_tempo < today).length,
            dendaBelumLunasCount: denda.length,
            dendaBelumLunasTotal: denda.reduce((s, r) => s + Number(r.jumlah_denda || 0), 0)
        };
    }

    // ==================== KATEGORI, KATALOG & INVENTARIS ====================
    async getKategoriList() {
        return unwrap(
            await this.client.from('kategori_buku').select('*').order('id_kategori'),
            'Ambil kategori'
        );
    }

    async saveKategori(payload, isEdit = false) {
        if (isEdit) {
            return unwrap(
                await this.client
                    .from('kategori_buku')
                    .update({ nama_kategori: payload.nama_kategori, lokasi_rak: payload.lokasi_rak || null })
                    .eq('id_kategori', payload.id_kategori)
                    .select(),
                'Perbarui kategori'
            );
        }
        return unwrap(
            await this.client.from('kategori_buku').insert(payload).select(),
            'Tambah kategori'
        );
    }

    async deleteKategori(id_kategori) {
        unwrap(
            await this.client.from('kategori_buku').delete().eq('id_kategori', id_kategori),
            'Hapus kategori'
        );
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
        return unwrap(await query, 'Ambil katalog');
    }

    async saveKatalog(payload, isEdit = false, initialCopies = 1) {
        if (isEdit) {
            return unwrap(
                await this.client
                    .from('katalog_buku')
                    .update({
                        isbn: payload.isbn,
                        judul: payload.judul,
                        penerbit: payload.penerbit || null,
                        tahun_terbit: payload.tahun_terbit || null,
                        id_kategori: payload.id_kategori
                    })
                    .eq('id_buku', payload.id_buku)
                    .select(),
                'Perbarui katalog'
            );
        }

        const inserted = unwrap(
            await this.client.from('katalog_buku').insert(payload).select(),
            'Tambah katalog'
        );

        const copies = [];
        for (let i = 1; i <= Math.max(1, Number(initialCopies || 1)); i++) {
            copies.push({
                id_buku: payload.id_buku,
                no_eksemplar: i,
                status_ketersediaan: 'Tersedia',
                kondisi_fisik: 'Baik'
            });
        }
        try {
            unwrap(await this.client.from('inventaris').insert(copies), 'Buat eksemplar awal');
        } catch (err) {
            await this.client.from('katalog_buku').delete().eq('id_buku', payload.id_buku);
            throw err;
        }
        return inserted;
    }

    async deleteKatalog(id_buku) {
        unwrap(
            await this.client.from('katalog_buku').delete().eq('id_buku', id_buku),
            'Hapus katalog buku'
        );
    }

    async getInventarisList({ idBuku = null, status = 'ALL' } = {}) {
        let query = this.client
            .from('inventaris')
            .select('id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik, katalog_buku(judul, isbn, kategori_buku(nama_kategori, lokasi_rak))')
            .order('id_buku')
            .order('no_eksemplar');
        if (idBuku) query = query.eq('id_buku', idBuku);
        if (status !== 'ALL') query = query.eq('status_ketersediaan', status);
        return unwrap(await query, 'Ambil inventaris');
    }

    async addInventarisCopy({ id_buku, status_ketersediaan = 'Tersedia', kondisi_fisik = 'Baik' }) {
        const existing = unwrap(
            await this.client.from('inventaris').select('no_eksemplar').eq('id_buku', id_buku),
            'Cek no eksemplar'
        );
        const maxNo = existing.reduce((m, r) => Math.max(m, Number(r.no_eksemplar || 0)), 0);
        return unwrap(
            await this.client
                .from('inventaris')
                .insert({ id_buku, no_eksemplar: maxNo + 1, status_ketersediaan, kondisi_fisik })
                .select(),
            'Tambah eksemplar'
        );
    }

    async updateInventarisCopy({ id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik }) {
        return unwrap(
            await this.client
                .from('inventaris')
                .update({ status_ketersediaan, kondisi_fisik })
                .eq('id_buku', id_buku)
                .eq('no_eksemplar', no_eksemplar)
                .select(),
            'Perbarui eksemplar'
        );
    }

    async deleteInventarisCopy(id_buku, no_eksemplar) {
        unwrap(
            await this.client
                .from('inventaris')
                .delete()
                .eq('id_buku', id_buku)
                .eq('no_eksemplar', no_eksemplar),
            'Hapus eksemplar'
        );
    }

    // ==================== ANGGOTA (DISJOINT) & STAF (REKURSIF) ====================
    async getAnggotaList({ tipe = 'ALL', search = '' } = {}) {
        let query = this.client.from('v_anggota_lengkap').select('*').order('id_anggota');
        if (tipe !== 'ALL') query = query.eq('tipe_anggota', tipe);
        if (search.trim()) {
            const s = sanitizePostgrestSearch(search);
            if (s) query = query.or(`nama.ilike.%${s}%,id_anggota.ilike.%${s}%,nisn.ilike.%${s}%,nip.ilike.%${s}%`);
        }
        return unwrap(await query, 'Ambil anggota');
    }

    async createAnggotaLengkap({ base, tipe, detail }) {
        unwrap(await this.client.from('anggota').insert(base), 'Tambah anggota');
        try {
            if (tipe === 'Siswa') {
                unwrap(
                    await this.client.from('siswa').insert({ id_anggota: base.id_anggota, ...detail }),
                    'Tambah data siswa'
                );
            } else {
                unwrap(
                    await this.client.from('guru_karyawan').insert({ id_anggota: base.id_anggota, ...detail }),
                    'Tambah data guru/karyawan'
                );
            }
        } catch (err) {
            await this.client.from('anggota').delete().eq('id_anggota', base.id_anggota);
            throw err;
        }
    }

    async updateAnggotaLengkap({ id_anggota, base, tipe, detail }) {
        unwrap(
            await this.client.from('anggota').update(base).eq('id_anggota', id_anggota),
            'Perbarui anggota'
        );
        if (tipe === 'Siswa') {
            unwrap(
                await this.client.from('siswa').update(detail).eq('id_anggota', id_anggota),
                'Perbarui siswa'
            );
        } else if (tipe === 'Guru/Karyawan') {
            unwrap(
                await this.client.from('guru_karyawan').update(detail).eq('id_anggota', id_anggota),
                'Perbarui guru/karyawan'
            );
        }
    }

    async deleteAnggota(id_anggota) {
        unwrap(
            await this.client.from('anggota').delete().eq('id_anggota', id_anggota),
            'Hapus anggota'
        );
    }

    async getStafList() {
        return unwrap(
            await this.client
                .from('staf')
                .select('id_staf, jabatan, username, id_supervisor')
                .order('id_staf'),
            'Ambil data staf'
        );
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

        if (isEdit) {
            const updateObj = {
                jabatan: payload.jabatan,
                username,
                id_supervisor: payload.id_supervisor || null
            };
            if (payload.password) updateObj.password_hash = payload.password;
            return unwrap(
                await this.client
                    .from('staf')
                    .update(updateObj)
                    .eq('id_staf', payload.id_staf)
                    .select('id_staf, jabatan, username, id_supervisor'),
                'Perbarui staf'
            );
        }
        return unwrap(
            await this.client
                .from('staf')
                .insert({
                    id_staf: payload.id_staf,
                    jabatan: payload.jabatan,
                    username,
                    password_hash: payload.password,
                    id_supervisor: payload.id_supervisor || null
                })
                .select('id_staf, jabatan, username, id_supervisor'),
            'Tambah staf'
        );
    }

    async deleteStaf(id_staf) {
        unwrap(
            await this.client.from('staf').delete().eq('id_staf', id_staf),
            'Hapus staf'
        );
    }

    // ==================== SIRKULASI: PEMINJAMAN & PENGEMBALIAN ====================
    async getPeminjamanList({ status = 'ALL', search = '', idAnggota = null } = {}) {
        let query = this.client
            .from('peminjaman')
            .select('id_peminjaman, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman, id_anggota, id_staf, anggota(nama), staf(username, jabatan), pengembalian(id_pengembalian, tgl_kembali, hari_terlambat)')
            .order('tgl_pinjam', { ascending: false })
            .order('id_peminjaman', { ascending: false });

        if (status === 'AKTIF') {
            query = query.in('status_peminjaman', ['Dipinjam', 'Terlambat']);
        } else if (status !== 'ALL') {
            query = query.eq('status_peminjaman', status);
        }
        if (idAnggota) query = query.eq('id_anggota', idAnggota);

        const rows = unwrap(await query, 'Ambil daftar peminjaman');
        if (!search.trim()) return rows;
        const s = search.trim().toLowerCase();
        return rows.filter((r) =>
            r.id_peminjaman.toLowerCase().includes(s) ||
            r.id_anggota.toLowerCase().includes(s) ||
            (r.anggota?.nama || '').toLowerCase().includes(s)
        );
    }

    async createPeminjaman({ id_peminjaman, tgl_pinjam, tgl_jatuh_tempo, id_anggota, id_staf, copies }) {
        if (!copies || copies.length === 0) {
            throw new Error('Pilih minimal 1 eksemplar buku yang tersedia.');
        }
        if (!tgl_pinjam || !tgl_jatuh_tempo || tgl_jatuh_tempo < tgl_pinjam) {
            throw new Error('Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.');
        }

        const inserted = unwrap(
            await this.client
                .from('peminjaman')
                .insert({
                    id_peminjaman,
                    tgl_pinjam,
                    tgl_jatuh_tempo,
                    status_peminjaman: 'Dipinjam',
                    id_anggota,
                    id_staf
                })
                .select(),
            'Simpan peminjaman'
        );

        const updatedCopies = [];
        try {
            for (const c of copies) {
                const updated = unwrap(
                    await this.client
                        .from('inventaris')
                        .update({ status_ketersediaan: 'Dipinjam' })
                        .eq('id_buku', c.id_buku)
                        .eq('no_eksemplar', c.no_eksemplar)
                        .eq('status_ketersediaan', 'Tersedia')
                        .select(),
                    `Ubah status eksemplar ${c.id_buku} #${c.no_eksemplar}`
                );
                if (!updated || updated.length === 0) {
                    throw new Error(`Eksemplar ${c.id_buku} #${c.no_eksemplar} sudah tidak tersedia.`);
                }
                updatedCopies.push(c);
            }
        } catch (err) {
            for (const uc of updatedCopies) {
                await this.client
                    .from('inventaris')
                    .update({ status_ketersediaan: 'Tersedia' })
                    .eq('id_buku', uc.id_buku)
                    .eq('no_eksemplar', uc.no_eksemplar);
            }
            await this.client.from('peminjaman').delete().eq('id_peminjaman', id_peminjaman);
            throw err;
        }
        return inserted[0];
    }

    async markPeminjamanOverdue(id_peminjaman) {
        return unwrap(
            await this.client
                .from('peminjaman')
                .update({ status_peminjaman: 'Terlambat' })
                .eq('id_peminjaman', id_peminjaman)
                .select(),
            'Tandai terlambat'
        );
    }

    async getPengembalianList() {
        return unwrap(
            await this.client
                .from('pengembalian')
                .select('id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat, peminjaman(id_anggota, tgl_pinjam, tgl_jatuh_tempo, anggota(nama)), detail_pengembalian(id_buku, no_eksemplar, inventaris(katalog_buku(judul))), sanksi_denda(id_denda, jenis_sanksi, jumlah_denda, status_pembayaran)')
                .order('tgl_kembali', { ascending: false })
                .order('id_pengembalian', { ascending: false }),
            'Ambil riwayat pengembalian'
        );
    }

    async processPengembalian({ id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat, items, denda }) {
        if (!items || items.length === 0) {
            throw new Error('Pilih minimal 1 eksemplar buku yang dikembalikan untuk dicatat di detail_pengembalian.');
        }
        const lateDays = Number(hari_terlambat || 0);
        if (!Number.isFinite(lateDays) || lateDays < 0) {
            throw new Error('Hari terlambat tidak boleh bernilai negatif.');
        }
        if (denda && Number(denda.jumlah_denda) < 0) {
            throw new Error('Nominal denda tidak boleh bernilai negatif.');
        }

        const prevLoanRows = unwrap(
            await this.client
                .from('peminjaman')
                .select('status_peminjaman')
                .eq('id_peminjaman', id_peminjaman)
                .limit(1),
            'Cek status peminjaman'
        );
        const prevLoanStatus = prevLoanRows?.[0]?.status_peminjaman || 'Dipinjam';

        const prevCopyStates = [];
        for (const it of items) {
            const snap = unwrap(
                await this.client
                    .from('inventaris')
                    .select('id_buku, no_eksemplar, status_ketersediaan, kondisi_fisik')
                    .eq('id_buku', it.id_buku)
                    .eq('no_eksemplar', Number(it.no_eksemplar))
                    .limit(1),
                `Cek eksemplar ${it.id_buku} #${it.no_eksemplar}`
            );
            if (snap && snap[0]) prevCopyStates.push(snap[0]);
        }

        unwrap(
            await this.client
                .from('pengembalian')
                .insert({ id_pengembalian, id_peminjaman, tgl_kembali, hari_terlambat: lateDays }),
            'Catat pengembalian'
        );

        let updatedInvCount = 0;
        let loanMarkedDone = false;
        try {
            const detailRows = items.map((it) => ({
                id_pengembalian,
                id_buku: it.id_buku,
                no_eksemplar: Number(it.no_eksemplar)
            }));
            unwrap(
                await this.client.from('detail_pengembalian').insert(detailRows),
                'Simpan detail pengembalian'
            );

            for (const it of items) {
                const statusAvail = it.kondisi_fisik === 'Baik' ? 'Tersedia' : it.kondisi_fisik;
                unwrap(
                    await this.client
                        .from('inventaris')
                        .update({
                            kondisi_fisik: it.kondisi_fisik,
                            status_ketersediaan: statusAvail
                        })
                        .eq('id_buku', it.id_buku)
                        .eq('no_eksemplar', Number(it.no_eksemplar)),
                    `Update inventaris ${it.id_buku} #${it.no_eksemplar}`
                );
                updatedInvCount += 1;
            }

            unwrap(
                await this.client
                    .from('peminjaman')
                    .update({ status_peminjaman: 'Selesai' })
                    .eq('id_peminjaman', id_peminjaman),
                'Selesaikan peminjaman'
            );
            loanMarkedDone = true;

            if (denda && Number(denda.jumlah_denda) > 0) {
                unwrap(
                    await this.client.from('sanksi_denda').insert({
                        id_denda: denda.id_denda,
                        id_pengembalian,
                        jenis_sanksi: denda.jenis_sanksi,
                        jumlah_denda: Number(denda.jumlah_denda),
                        status_pembayaran: denda.status_pembayaran || 'Belum Lunas',
                        tgl_bayar: denda.status_pembayaran === 'Lunas' ? tgl_kembali : null
                    }),
                    'Catat sanksi denda'
                );
            }
        } catch (err) {
            if (loanMarkedDone) {
                await this.client
                    .from('peminjaman')
                    .update({ status_peminjaman: prevLoanStatus })
                    .eq('id_peminjaman', id_peminjaman);
            }
            for (let i = 0; i < updatedInvCount; i++) {
                const prev = prevCopyStates[i];
                if (prev) {
                    await this.client
                        .from('inventaris')
                        .update({
                            kondisi_fisik: prev.kondisi_fisik,
                            status_ketersediaan: prev.status_ketersediaan
                        })
                        .eq('id_buku', prev.id_buku)
                        .eq('no_eksemplar', prev.no_eksemplar);
                }
            }
            await this.client.from('pengembalian').delete().eq('id_pengembalian', id_pengembalian);
            throw err;
        }
    }

    // ==================== SANKSI & DENDA ====================
    async getDendaList({ statusFilter = 'ALL', idAnggota = null } = {}) {
        let query = this.client.from('v_denda_lengkap').select('*').order('id_denda', { ascending: false });
        if (statusFilter !== 'ALL') query = query.eq('status_pembayaran', statusFilter);
        if (idAnggota) query = query.eq('id_anggota', idAnggota);
        return unwrap(await query, 'Ambil sanksi denda');
    }

    async bayarDenda(id_denda, tgl_bayar = todayLocalISO()) {
        return unwrap(
            await this.client
                .from('sanksi_denda')
                .update({ status_pembayaran: 'Lunas', tgl_bayar })
                .eq('id_denda', id_denda)
                .select(),
            'Pelunasan denda'
        );
    }

    async createDendaForPengembalian(payload) {
        return unwrap(
            await this.client.from('sanksi_denda').insert(payload).select(),
            'Tambah sanksi denda'
        );
    }

    // ==================== 5 SQL MISSION OBJECTIVES & LAPORAN ====================
    async mission1CariAnggota(keyword) {
        const s = sanitizePostgrestSearch(keyword);
        const strictId = sanitizeStrictIdentifier(keyword);
        let query = this.client
            .from('v_anggota_lengkap')
            .select('id_anggota, nama, tipe_anggota, nisn, nip, kelas, unit_kerja_mata_pelajaran');
        const clauses = [];
        if (strictId) {
            clauses.push(`nisn.eq."${strictId}"`, `nip.eq."${strictId}"`);
        }
        if (s) {
            clauses.push(`nama.ilike.%${s}%`, `id_anggota.ilike.%${s}%`);
        }
        if (clauses.length > 0) {
            query = query.or(clauses.join(','));
        }
        return unwrap(await query.order('id_anggota'), 'Mission Objective 1');
    }

    async mission2CariBuku(keyword) {
        const s = sanitizePostgrestSearch(keyword);
        let query = this.client
            .from('v_katalog_stok')
            .select('id_buku, isbn, judul, penerbit, tahun_terbit, nama_kategori, lokasi_rak, stok_total, stok_tersedia');
        if (s) {
            query = query.or(`judul.ilike.%${s}%,penerbit.ilike.%${s}%,isbn.ilike.%${s}%,nama_kategori.ilike.%${s}%`);
        }
        return unwrap(await query.order('id_buku'), 'Mission Objective 2');
    }

    async mission3PeminjamanTanggal(tglPinjam) {
        let query = this.client
            .from('peminjaman')
            .select('id_peminjaman, id_anggota, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman')
            .in('status_peminjaman', ['Dipinjam', 'Terlambat']);
        if (tglPinjam) query = query.eq('tgl_pinjam', tglPinjam);
        return unwrap(await query.order('id_peminjaman'), 'Mission Objective 3');
    }

    async mission4PeminjamanAnggota(idOrNama) {
        const q = idOrNama.trim();
        const rows = unwrap(
            await this.client
                .from('peminjaman')
                .select('id_peminjaman, id_anggota, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman, anggota(nama)')
                .in('status_peminjaman', ['Dipinjam', 'Terlambat'])
                .order('id_peminjaman'),
            'Mission Objective 4'
        );
        const mapped = rows.map((r) => ({
            id_peminjaman: r.id_peminjaman,
            id_anggota: r.id_anggota,
            nama: r.anggota?.nama || '-',
            tgl_pinjam: r.tgl_pinjam,
            tgl_jatuh_tempo: r.tgl_jatuh_tempo,
            status_peminjaman: r.status_peminjaman
        }));
        if (!q) return mapped;
        const ql = q.toLowerCase();
        return mapped.filter((r) => r.id_anggota.toLowerCase() === ql || r.nama.toLowerCase().includes(ql));
    }

    async mission5DendaBelumLunas() {
        return unwrap(
            await this.client
                .from('v_denda_lengkap')
                .select('id_denda, nama_anggota, jenis_sanksi, jumlah_denda, status_pembayaran, id_peminjaman, hari_terlambat')
                .eq('status_pembayaran', 'Belum Lunas')
                .order('id_denda'),
            'Mission Objective 5'
        );
    }

    async getLaporanStatistik() {
        const countCols = {
            inventaris: 'id_buku',
            detail_pengembalian: 'id_pengembalian',
            staf: 'id_staf'
        };
        const [counts, detailRows, lunasRows, overdueRows] = await Promise.all([
            Promise.all(
                TABLES_11.map(async (tbl) => {
                    const col = countCols[tbl] || '*';
                    const { count } = await this.client.from(tbl).select(col, { count: 'exact', head: true });
                    return { table: tbl, count: count || 0 };
                })
            ),
            this.client.from('detail_pengembalian').select('id_buku, inventaris(katalog_buku(judul, kategori_buku(nama_kategori)))'),
            this.client.from('sanksi_denda').select('jumlah_denda, tgl_bayar').eq('status_pembayaran', 'Lunas'),
            this.client.from('peminjaman').select('id_peminjaman, id_anggota, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman, anggota(nama)').in('status_peminjaman', ['Dipinjam', 'Terlambat'])
        ]);

        const details = unwrap(detailRows, 'Peringkat buku');
        const freq = new Map();
        for (const d of details) {
            const cur = freq.get(d.id_buku) || {
                id_buku: d.id_buku,
                judul: d.inventaris?.katalog_buku?.judul || d.id_buku,
                kategori: d.inventaris?.katalog_buku?.kategori_buku?.nama_kategori || '-',
                jumlah_sirkulasi: 0
            };
            cur.jumlah_sirkulasi += 1;
            freq.set(d.id_buku, cur);
        }
        const topBooks = Array.from(freq.values()).sort((a, b) => b.jumlah_sirkulasi - a.jumlah_sirkulasi);

        const lunas = unwrap(lunasRows, 'Kas denda');
        const today = todayLocalISO();
        const overdue = unwrap(overdueRows, 'Daftar overdue').filter(
            (r) => r.status_peminjaman === 'Terlambat' || r.tgl_jatuh_tempo < today
        );

        return {
            tableCounts: counts,
            topBooks,
            totalKasLunas: lunas.reduce((s, r) => s + Number(r.jumlah_denda || 0), 0),
            lunasCount: lunas.length,
            overdueList: overdue
        };
    }
}

window.SmartDB = new SmartLibraryDB();
window.DateUtil = { todayLocalISO, addDaysISO, diffDaysISO };
window.SmartDBHelpers = { sanitizePostgrestSearch, sanitizeStrictIdentifier };
