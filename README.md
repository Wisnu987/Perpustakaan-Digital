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

1. Buka **SQL Editor** pada dashboard project Supabase Anda (`Perpustakaan Digital`), lalu jalankan seluruh isi [database/schema.sql](database/schema.sql) satu kali (atau jalankan [database/schema_hardened.sql](database/schema_hardened.sql) jika skema lama sudah terpasang).
2. Setel password akun staf awal melalui SQL Editor Supabase (password awal dibuat acak agar tidak ada kredensial bawaan di repository):
   ```sql
   UPDATE public.staf
   SET password_hash = 'GantiPasswordAmanMin8Karakter'
   WHERE username = 'kepala_perpus';
   ```
3. Pilih salah satu dari 2 versi UI/UX yang tersedia:
   - **Versi HTML/JS:** buka [index.html](index.html) di browser (disarankan melalui local server seperti VS Code Live Server).
   - **Versi PHP:** jalankan PHP server dari folder root proyek (misal `php -S localhost:8000` atau letakkan folder proyek di `htdocs` XAMPP/Laragon), lalu buka `http://localhost:8000/php/` ([php/index.php](php/index.php)).
4. Login:
   - **Staf:** gunakan `username` (misal `kepala_perpus`) dan password yang telah Anda atur di SQL Editor.
   - **Anggota:** masukkan pasangan **ID Anggota** dan **NISN (10 digit)** atau **NIP (18 digit)**.

## Keamanan & Hardening Basis Data

- **Frontend Security**: Halaman [index.html](index.html) menerapkan Content Security Policy (CSP) tanpa inline script/style, pin versi `@supabase/supabase-js@2.119.1` dengan Subresource Integrity (`SHA-384`), sanitasi filter PostgREST, delegasi event tanpa `onclick`, serta perlindungan data pribadi anggota (PII) pada Mode Tamu.
- **Database Hardening (`database/schema.sql` & `database/schema_hardened.sql`)**: RLS ketat aktif secara bawaan—role `anon`/`authenticated` hanya dapat membaca katalog OPAC publik (`kategori_buku`, `katalog_buku`, `inventaris`, `v_katalog_stok`). Seluruh pembacaan PII, transaksi, dan mutasi melewati RPC `SECURITY DEFINER` dengan validasi token sesi server-side (SHA-256) pada skema non-exposed `private.staf_sessions` dan `private.anggota_sessions`.
