# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Pustakawan SMP Negeri 1 Dramaga** (`Kepala Perpustakaan`, `Pustakawan Layanan Sirkulasi`, `Staf Pengolahan & Katalogisasi`, `Staf Administrasi & Inventaris`): mencatat peminjaman, pengembalian, denda, katalog buku, eksemplar fisik, data anggota, dan struktur staf selama jam layanan perpustakaan sekolah.
- **Anggota Perpustakaan** (`Siswa` dan `Guru/Karyawan`): menelusuri ketersediaan katalog buku (OPAC) dan memantau riwayat peminjaman serta status denda pribadi.
- **Dosen & Asisten Penilai Mata Kuliah Basis Data (Kelompok 10, Paralel 2 — IPB University)**: menguji implementasi fisik 11 tabel relasional 3NF, spesialisasi disjoint (`siswa` / `guru_karyawan`), relasi rekursif supervisi (`staf.id_supervisor`), integritas referensial, dan 5 kueri SQL Mission Objectives secara langsung di ruang kelas/proyektor.

## Product Purpose

Sistem informasi perpustakaan sekolah berbasis web yang menggabungkan operasional harian pustakawan (sirkulasi peminjaman-pengembalian, stok inventaris per eksemplar, dan rekap sanksi denda) dengan transparansi struktur basis data relasional 11 tabel 3NF PostgreSQL/Supabase. Keberhasilan diukur dari kelancaran petugas memproses transaksi tanpa kebingungan navigasi, keterlindungan privasi data anggota di mode publik, dan kemudahan demonstrasi 5 SQL Mission Objectives.

## Operating Context

- Berjalan pada komputer meja layanan perpustakaan (pencahayaan ruang baca terang pada siang hari serta opsi mode gelap untuk layar proyektor/ruang redup) dan perangkat seluler anggota.
- Backend live terhubung langsung ke Supabase PostgreSQL (`@supabase/supabase-js` UMD) tanpa proses build atau bundler tambahan (dibuka via static HTTP / VS Code Live Server).

## Capabilities and Constraints

- Arsitektur statis murni: vanilla HTML5, CSS3, dan ES6+ JavaScript tanpa framework atau step build.
- Wajib mempertahankan toggle tema Terang & Gelap (`[data-theme="light"|"dark"]`).
- Wajib mempertahankan akun demo cepat pada modal login untuk kebutuhan evaluasi akademik, dengan penandaan jelas sebagai mode demo.
- Wajib menjaga kompatibilitas dengan skema 11 tabel `database/schema.sql` dan menerapkan proteksi keamanan frontend ketat (CSP tanpa `unsafe-inline`, SRI pada skrip CDN, pencegahan XSS berbasis DOM/delegasi event, sanitasi filter PostgREST, dan perlindungan PII pada Mode Tamu).
- Istilah skema Basis Data (`11 Tabel 3NF`, `Disjoint`, `Rekursif`, `Mission Objectives`) tetap dipertahankan secara akurat namun tertata rapi agar tidak mengganggu alur kerja petugas.

## Evidence on Hand

- Skema SQL lengkap 11 tabel, view, trigger, dan data contoh SMPN 1 Dramaga pada `database/schema.sql`.
- Panduan proyek dan daftar akun demo pada `README.md`.
- Sampel data impor sekolah pada `contoh_import_buku_smp.csv` dan `contoh_import_siswa_smp.csv`.
