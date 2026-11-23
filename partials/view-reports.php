                <!-- ==================== TAB 5: MISSION OBJECTIVES & LAPORAN ==================== -->
                <section id="view-reports" class="view-section">
                    <div class="page-head">
                        <div>
                            <h1 class="page-title">SQL Mission Objectives &amp; Laporan</h1>
                            <p class="page-desc">Uji 5 kueri <em>Mission Objectives</em> Fase 3 langsung terhadap PostgreSQL Supabase beserta statistik 11 tabel relasional.</p>
                        </div>
                    </div>

                    <div class="card u-mb-lg">
                        <div class="card-title">
                            <h2 class="card-heading">5 Query SQL Mission Objectives (Interaktif)</h2>
                        </div>

                        <div class="mo-list">
                            <div class="mo-item">
                                <label class="mo-item-title field-label" for="mo1-input">1. Cari Anggota berdasarkan NISN / NIP atau Nama</label>
                                <div class="input-row">
                                    <input type="text" id="mo1-input" class="input" value="Rina" placeholder="NISN, NIP, atau Nama (misal: 0081234567 atau Rina)" />
                                    <button type="button" class="btn btn-primary btn-sm" id="btn-run-mo1">Jalankan</button>
                                </div>
                            </div>

                            <div class="mo-item">
                                <label class="mo-item-title field-label" for="mo2-input">2. Cari Buku berdasarkan Judul, Penerbit, atau ISBN</label>
                                <div class="input-row">
                                    <input type="text" id="mo2-input" class="input" value="Laskar Pelangi" placeholder="Judul, Penerbit, atau ISBN" />
                                    <button type="button" class="btn btn-primary btn-sm" id="btn-run-mo2">Jalankan</button>
                                </div>
                            </div>

                            <div class="mo-item">
                                <div class="form-grid-2">
                                    <div>
                                        <label class="mo-item-title field-label" for="mo3-input">3. Peminjaman Aktif berdasarkan Tanggal Pinjam</label>
                                        <div class="input-row">
                                            <input type="date" id="mo3-input" class="input mono" value="2026-11-10" />
                                            <button type="button" class="btn btn-primary btn-sm" id="btn-run-mo3">Jalankan</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label class="mo-item-title field-label" for="mo4-input">4. Peminjaman Aktif berdasarkan Identitas Anggota</label>
                                        <div class="input-row">
                                            <input type="text" id="mo4-input" class="input" value="A001" placeholder="ID Anggota atau Nama (misal: A001)" />
                                            <button type="button" class="btn btn-primary btn-sm" id="btn-run-mo4">Jalankan</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="mo-item mo-item-row">
                                <div>
                                    <div class="mo-item-title">5. Riwayat Denda yang Belum Diselesaikan</div>
                                    <div class="mo-item-desc">Menampilkan catatan <code>sanksi_denda</code> dengan status <code>Belum Lunas</code>.</div>
                                </div>
                                <button type="button" class="btn btn-primary btn-sm" id="btn-run-mo5">Jalankan Query 5</button>
                            </div>
                        </div>

                        <div id="mo-result-box" class="mo-result hidden">
                            <div class="mo-result-head">
                                <strong id="mo-result-title">Hasil Query</strong>
                                <span class="mono mo-result-meta" id="mo-result-meta"></span>
                            </div>
                            <pre id="mo-sql-preview" class="mono sql-preview"></pre>
                            <div id="mo-result-table" class="table-wrap"></div>
                        </div>
                    </div>

                    <div class="grid-2">
                        <div class="card">
                            <div class="card-title">
                                <h2 class="card-heading">Peringkat Buku Sering Dipinjam &amp; Kas Denda</h2>
                                <button type="button" class="btn btn-sm" id="btn-refresh-reports">Muat Ulang</button>
                            </div>
                            <div id="report-kas-summary" class="notice-box"></div>
                            <div id="report-top-books"></div>
                        </div>

                        <div class="card">
                            <div class="card-title">
                                <h2 class="card-heading">Statistik 11 Tabel Relasional (Supabase)</h2>
                            </div>
                            <div id="report-table-counts" class="mono count-list"></div>
                        </div>
                    </div>
                </section>
