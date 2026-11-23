                <!-- ==================== TAB 4: SANKSI & DENDA ==================== -->
                <section id="view-fines" class="view-section">
                    <div class="page-head">
                        <div>
                            <h1 class="page-title">Rekapitulasi Sanksi &amp; Denda</h1>
                            <p class="page-desc">Pengelolaan tabel <code>sanksi_denda</code> beserta status pembayaran <code>Lunas</code> dan <code>Belum Lunas</code>.</p>
                        </div>
                    </div>

                    <div id="fines-guest-lock" class="restricted-state hidden">
                        <div class="restricted-head">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                            <h2 class="restricted-title">Catatan Sanksi &amp; Denda Terbatas</h2>
                        </div>
                        <p class="restricted-desc">Silakan masuk sebagai Staf Perpustakaan atau Anggota untuk meninjau rincian denda keterlambatan dan pelunasan.</p>
                        <button type="button" class="btn btn-primary" data-action="open-login">Login Staf / Anggota</button>
                    </div>

                    <div id="fines-toolbar" class="toolbar">
                        <div class="segmented-control">
                            <button type="button" class="segmented-btn active" data-fine-filter="ALL">Semua</button>
                            <button type="button" class="segmented-btn" data-fine-filter="Belum Lunas">Belum Lunas</button>
                            <button type="button" class="segmented-btn" data-fine-filter="Lunas">Lunas</button>
                        </div>
                        <div class="mono fines-summary" id="fines-summary-text"></div>
                    </div>

                    <div id="fines-table-wrap" class="sheet">
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID Denda</th>
                                        <th>Anggota</th>
                                        <th>Ref. Pinjam / Kembali</th>
                                        <th>Jenis Sanksi</th>
                                        <th>Jumlah Denda</th>
                                        <th>Status &amp; Tgl Bayar</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="fines-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </section>
