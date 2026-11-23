                <!-- ==================== TAB 2: KATALOG & INVENTARIS ==================== -->
                <section id="view-catalog" class="view-section active">
                    <div class="page-head">
                        <div>
                            <h1 class="page-title">Katalog Buku, Kategori &amp; Inventaris</h1>
                            <p class="page-desc">Penelusuran publik OPAC serta pengelolaan <code>kategori_buku</code>, <code>katalog_buku</code>, dan eksemplar fisik <code>inventaris</code>.</p>
                        </div>
                        <div id="staff-catalog-actions" class="hidden header-btn-group">
                            <button type="button" class="btn" id="btn-open-categories">Kelola Kategori Buku</button>
                            <button type="button" class="btn btn-primary" id="btn-open-add-katalog">+ Tambah Judul Buku</button>
                        </div>
                    </div>

                    <div class="toolbar">
                        <div class="toolbar-left">
                            <div class="search-input-wrap">
                                <input type="text" id="catalog-search-input" class="input" placeholder="Cari judul, ISBN, penerbit, atau ID buku..." aria-label="Cari katalog buku" />
                            </div>
                            <select id="catalog-kategori-filter" class="select select-auto" aria-label="Filter kategori">
                                <option value="ALL">Semua Kategori</option>
                            </select>
                        </div>
                    </div>

                    <div class="sheet">
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID Buku</th>
                                        <th>Judul &amp; ISBN</th>
                                        <th>Penerbit / Tahun</th>
                                        <th>Kategori &amp; Rak</th>
                                        <th>Stok (Tersedia / Total)</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="catalog-tbody">
                                    <tr>
                                        <td><span class="skeleton-bar"></span></td>
                                        <td><span class="skeleton-bar"></span></td>
                                        <td><span class="skeleton-bar"></span></td>
                                        <td><span class="skeleton-bar"></span></td>
                                        <td><span class="skeleton-bar"></span></td>
                                        <td><span class="skeleton-bar"></span></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
