                <!-- ==================== TAB 1: SIRKULASI ==================== -->
                <section id="view-circulation" class="view-section">
                    <div class="page-head">
                        <div>
                            <h1 class="page-title">Sirkulasi Peminjaman &amp; Pengembalian</h1>
                            <p class="page-desc">Pencatatan transaksi <code>peminjaman</code>, <code>pengembalian</code>, <code>detail_pengembalian</code>, serta sanksi keterlambatan.</p>
                        </div>
                        <div class="segmented-control" role="tablist" aria-label="Sub-tab Sirkulasi">
                            <button type="button" class="segmented-btn active" data-circ-subtab="LOANS">Daftar Peminjaman</button>
                            <button type="button" class="segmented-btn" data-circ-subtab="RETURNS">Riwayat Pengembalian</button>
                        </div>
                    </div>

                    <div class="ledger-ribbon" aria-label="Ringkasan Sirkulasi">
                        <div class="ledger-cell">
                            <div class="ledger-label">Katalog &amp; Eksemplar</div>
                            <div class="ledger-value mono" id="stat-total-eksemplar">0</div>
                            <div class="ledger-sub" id="stat-total-judul">0 judul • 0 tersedia</div>
                            <progress class="stock-progress" id="stat-stock-progress" max="100" value="0" aria-label="Rasio ketersediaan eksemplar"></progress>
                        </div>
                        <div class="ledger-cell">
                            <div class="ledger-label">Eksemplar Dipinjam</div>
                            <div class="ledger-value mono" id="stat-dipinjam-eksemplar">0</div>
                            <div class="ledger-sub">Status inventaris = Dipinjam</div>
                        </div>
                        <div class="ledger-cell">
                            <div class="ledger-label">Peminjaman Aktif / Telat</div>
                            <div class="ledger-value mono" id="stat-peminjaman-aktif">0</div>
                            <div class="ledger-sub is-danger" id="stat-peminjaman-telat">0 melewati jatuh tempo</div>
                        </div>
                        <div class="ledger-cell">
                            <div class="ledger-label">Denda Belum Lunas</div>
                            <div class="ledger-value mono is-danger" id="stat-denda-belum">0</div>
                            <div class="ledger-sub" id="stat-denda-nominal">Total Rp 0</div>
                        </div>
                    </div>

                    <!-- Proteksi Mode Tamu untuk PII Sirkulasi -->
                    <div id="circ-guest-lock" class="restricted-state hidden">
                        <div class="restricted-head">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <h2 class="restricted-title">Riwayat Peminjaman Dilindungi</h2>
                        </div>
                        <p class="restricted-desc">Daftar peminjaman memuat identitas siswa dan guru. Masuk sebagai Staf untuk memproses sirkulasi atau sebagai Anggota untuk memantau pinjaman pribadi.</p>
                        <button type="button" class="btn btn-primary" data-action="open-login">Login Staf / Anggota</button>
                    </div>

                    <!-- Panel Form Transaksi (Hanya muncul untuk Staf yang Login) -->
                    <div id="staff-circulation-forms" class="grid-2 hidden u-mb-lg">
                        <div class="card">
                            <div class="card-title">
                                <h2 class="card-heading">Catat Peminjaman Baru</h2>
                                <span class="badge badge-blue mono" id="next-loan-id-badge">PJ---</span>
                            </div>
                            <form id="form-new-loan">
                                <div class="form-grid-2">
                                    <div class="field-group">
                                        <label class="field-label" for="loan-id-input">ID Peminjaman</label>
                                        <input type="text" id="loan-id-input" class="input mono" required maxlength="10" />
                                    </div>
                                    <div class="field-group">
                                        <label class="field-label" for="loan-member-select">Anggota Peminjam</label>
                                        <select id="loan-member-select" class="select" required></select>
                                    </div>
                                </div>
                                <div class="form-grid-2">
                                    <div class="field-group">
                                        <label class="field-label" for="loan-tgl-pinjam">Tanggal Pinjam</label>
                                        <input type="date" id="loan-tgl-pinjam" class="input mono" required />
                                    </div>
                                    <div class="field-group">
                                        <label class="field-label" for="loan-tgl-tempo">Tanggal Jatuh Tempo</label>
                                        <input type="date" id="loan-tgl-tempo" class="input mono" required />
                                    </div>
                                </div>
                                <div class="field-group">
                                    <span class="field-label">Pilih Eksemplar Tersedia (Inventaris → Dipinjam)</span>
                                    <div id="loan-available-copies-list" class="copy-checklist"></div>
                                </div>
                                <button type="submit" class="btn btn-primary u-full">Simpan Transaksi Peminjaman</button>
                            </form>
                        </div>

                        <div class="card">
                            <div class="card-title">
                                <h2 class="card-heading">Proses Pengembalian &amp; Denda</h2>
                                <span class="badge badge-ok mono" id="next-return-id-badge">PG---</span>
                            </div>
                            <form id="form-new-return">
                                <div class="form-grid-2">
                                    <div class="field-group">
                                        <label class="field-label" for="return-id-input">ID Pengembalian</label>
                                        <input type="text" id="return-id-input" class="input mono" required maxlength="10" />
                                    </div>
                                    <div class="field-group">
                                        <label class="field-label" for="return-loan-select">Transaksi Peminjaman Aktif</label>
                                        <select id="return-loan-select" class="select" required></select>
                                    </div>
                                </div>
                                <div class="form-grid-2">
                                    <div class="field-group">
                                        <label class="field-label" for="return-tgl-kembali">Tanggal Kembali</label>
                                        <input type="date" id="return-tgl-kembali" class="input mono" required />
                                    </div>
                                    <div class="field-group">
                                        <label class="field-label" for="return-hari-terlambat">Hari Terlambat (Otomatis)</label>
                                        <input type="number" id="return-hari-terlambat" class="input mono" min="0" value="0" required />
                                    </div>
                                </div>
                                <div class="field-group">
                                    <span class="field-label">Eksemplar yang Dikembalikan (→ <code>detail_pengembalian</code>)</span>
                                    <div id="return-borrowed-copies-list" class="copy-checklist"></div>
                                </div>
                                <div class="panel-section">
                                    <label class="copy-check-label u-bold">
                                        <input type="checkbox" id="return-apply-fine-chk" />
                                        <span>Catat Sanksi / Denda (<code>sanksi_denda</code>)</span>
                                    </label>
                                    <div id="return-fine-fields" class="hidden u-mt-sm">
                                        <div class="form-grid-2">
                                            <input type="text" id="return-denda-id" class="input mono" placeholder="ID Denda (D006)" maxlength="10" aria-label="ID Denda" />
                                            <input type="number" id="return-denda-jumlah" class="input mono" min="0" step="500" value="0" placeholder="Nominal Rp" aria-label="Nominal Denda" />
                                        </div>
                                        <input type="text" id="return-denda-jenis" class="input u-mt-sm" placeholder="Jenis Sanksi (misal: Keterlambatan 3 Hari)" maxlength="30" aria-label="Jenis Sanksi" />
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-primary u-full">Selesaikan Pengembalian</button>
                            </form>
                        </div>
                    </div>

                    <!-- Sub-tab Daftar Peminjaman -->
                    <div id="circ-loans-wrap">
                        <div class="toolbar">
                            <div class="toolbar-left">
                                <div class="segmented-control">
                                    <button type="button" class="segmented-btn active" data-loan-filter="AKTIF">Aktif / Terlambat</button>
                                    <button type="button" class="segmented-btn" data-loan-filter="Selesai">Selesai</button>
                                    <button type="button" class="segmented-btn" data-loan-filter="ALL">Semua</button>
                                </div>
                                <div class="search-input-wrap">
                                    <input type="text" id="circ-search-input" class="input" placeholder="Cari ID peminjaman atau nama anggota..." aria-label="Cari peminjaman" />
                                </div>
                            </div>
                        </div>

                        <div class="sheet">
                            <div class="table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID Pinjam</th>
                                            <th>Peminjam</th>
                                            <th>Tgl Pinjam</th>
                                            <th>Jatuh Tempo</th>
                                            <th>Petugas</th>
                                            <th>Status</th>
                                            <th>Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody id="circ-loans-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Sub-tab Riwayat Pengembalian -->
                    <div id="circ-returns-wrap" class="hidden">
                        <div class="sheet">
                            <div class="table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID Kembali</th>
                                            <th>ID Pinjam &amp; Anggota</th>
                                            <th>Tgl Kembali</th>
                                            <th>Terlambat</th>
                                            <th>Detail Eksemplar Buku</th>
                                            <th>Sanksi / Denda</th>
                                        </tr>
                                    </thead>
                                    <tbody id="circ-returns-tbody"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>
