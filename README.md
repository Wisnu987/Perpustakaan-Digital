# Smart Library — SMP Negeri 1 Dramaga

Aplikasi web sistem basis data perpustakaan sekolah berbasis **PostgreSQL (Supabase)** dan skema relasional **11 tabel (3NF)** sesuai makalah projek Mata Kuliah Basis Data (Kelompok 10, Paralel 2 — IPB University).

## Struktur Skema Basis Data (11 Tabel)

Lihat skrip lengkap pada [database/schema.sql](database/schema.sql):

1. `anggota` — Super class peminjam (`id_anggota`, `nama`, `no_telepon`, `alamat`, `tgl_bergabung`)
2. `siswa` — Subclass disjoint anggota (`nisn`, `kelas`, `tahun_angkatan`)
3. `guru_karyawan` — Subclass disjoint anggota (`nip`, `unit_kerja_mata_pelajaran`)
4. `staf` — Petugas perpustakaan dengan relasi rekursif `id_supervisor`
5. `kategori_buku` — Klasifikasi dan `lokasi_rak`
6. `katalog_buku` — Master judul buku (`isbn`, `judul`, `penerbit`, `tahun_terbit`, `id_kategori`)
7. `inventaris` — Komposisi eksemplar fisik (`id_buku`, `no_eksemplar`, `status_ketersediaan`, `kondisi_fisik`)
8. `peminjaman` — Transaksi peminjaman (`tgl_pinjam`, `tgl_jatuh_tempo`, `status_peminjaman`, `id_anggota`, `id_staf`)
9. `pengembalian` — Transaksi pengembalian 1:1 terhadap `peminjaman` (`tgl_kembali`, `hari_terlambat`)
10. `detail_pengembalian` — Resolusi M:N antara `pengembalian` dan `inventaris`
11. `sanksi_denda` — Pencatatan sanksi keterlambatan/kerusakan dan status pelunasan (`Lunas` / `Belum Lunas`)

## Cara Menjalankan

1. Buka **SQL Editor** pada dashboard project Supabase Anda (`Perpustakaan Digital`), lalu jalankan seluruh isi [database/schema.sql](database/schema.sql) satu kali.
2. Buka [index.html](index.html) di browser (disarankan melalui local server seperti VS Code Live Server).
3. Login menggunakan akun demo:
   - **Kepala Perpustakaan:** username `kepala_perpus`, password `dramaga2026`
   - **Staf Sirkulasi:** username `sirkulasi_1`, password `dramaga2026`
   - **Mode Anggota (Query-Only):** masukkan `A001` (Rina Putri — Siswa) atau `A006` (Drs. Hendra Wijaya — Guru)

## Keamanan & Hardening Basis Data

- **Frontend Security**: Halaman [index.html](index.html) menerapkan Content Security Policy (CSP) tanpa inline script/style, pin versi `@supabase/supabase-js@2.119.1` dengan Subresource Integrity (`SHA-384`), sanitasi filter PostgREST, delegasi event tanpa `onclick`, serta perlindungan data pribadi anggota (PII) pada Mode Tamu.
- **Database Hardening (`database/schema_hardened.sql`)**: Untuk mengaktifkan RLS ketat di Supabase (menutup akses baca/tulis langsung `anon` ke tabel anggota/transaksi, memindahkan sesi staf ke skema non-exposed `private.staf_sessions`, serta memakai RPC transaksi atomik), jalankan [database/schema_hardened.sql](database/schema_hardened.sql) di SQL Editor Supabase setelah [database/schema.sql](database/schema.sql).
