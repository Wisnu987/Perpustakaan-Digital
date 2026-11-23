                <!-- ==================== TAB 3: ANGGOTA & STAF ==================== -->
                <section id="view-members" class="view-section">
                    <div class="page-head">
                        <div>
                            <h1 class="page-title">Keanggotaan &amp; Struktur Staf</h1>
                            <p class="page-desc">Spesialisasi Disjoint <code>anggota</code> (<code>siswa</code> / <code>guru_karyawan</code>) serta hierarki supervisi rekursif <code>staf</code>.</p>
                        </div>
                        <div id="staff-member-actions" class="hidden header-btn-group">
                            <button type="button" class="btn btn-primary" id="btn-open-add-member">+ Tambah Anggota</button>
                            <button type="button" class="btn hidden" id="btn-open-add-staf">+ Tambah Staf</button>
                        </div>
                    </div>

                    <div id="members-guest-lock" class="restricted-state hidden">
                        <div class="restricted-head">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <h2 class="restricted-title">Data Pribadi Anggota Terlindungi</h2>
                        </div>
                        <p class="restricted-desc">Daftar NISN, NIP, nomor telepon, dan alamat anggota hanya ditampilkan kepada Staf atau akun Anggota pemilik data.</p>
                        <button type="button" class="btn btn-primary" data-action="open-login">Login Staf / Anggota</button>
                    </div>

                    <div id="members-toolbar" class="toolbar">
                        <div class="toolbar-left">
                            <div class="segmented-control">
                                <button type="button" class="segmented-btn active" data-member-subtab="ANGGOTA">Data Anggota</button>
                                <button type="button" class="segmented-btn" id="member-subtab-staf" data-member-subtab="STAF">Struktur Staf</button>
                            </div>
                            <select id="member-type-filter" class="select select-auto" aria-label="Filter jenis anggota">
                                <option value="ALL">Semua Tipe</option>
                                <option value="Siswa">Siswa</option>
                                <option value="Guru/Karyawan">Guru / Karyawan</option>
                            </select>
                            <div class="search-input-wrap">
                                <input type="text" id="member-search-input" class="input" placeholder="Cari nama, ID, NISN, atau NIP..." aria-label="Cari anggota" />
                            </div>
                        </div>
                    </div>

                    <div id="members-table-wrap" class="sheet">
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID Anggota</th>
                                        <th>Nama &amp; Kontak</th>
                                        <th>Tipe (Disjoint)</th>
                                        <th>NISN / NIP</th>
                                        <th>Kelas / Unit Kerja</th>
                                        <th>Tgl Gabung</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="members-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div id="staf-table-wrap" class="sheet hidden">
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID Staf</th>
                                        <th>Jabatan</th>
                                        <th>Username</th>
                                        <th>Supervisor (Rekursif)</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="staf-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </section>
