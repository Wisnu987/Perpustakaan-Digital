    <!-- ==================== NAVIGASI BAWAH KHUSUS HP ==================== -->
    <nav class="mobile-nav" aria-label="Navigasi HP">
        <button type="button" class="mobile-nav-btn" data-tab="circulation">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            <span>Sirkulasi</span>
        </button>
        <button type="button" class="mobile-nav-btn active" data-tab="catalog" aria-current="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
            <span>Katalog</span>
        </button>
        <button type="button" class="mobile-nav-btn" data-tab="members">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
            <span>Anggota</span>
        </button>
        <button type="button" class="mobile-nav-btn" data-tab="fines">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
            <span>Denda</span>
            <span class="mobile-badge hidden" id="mobile-fines-badge">0</span>
        </button>
        <button type="button" class="mobile-nav-btn" data-tab="reports">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            <span>Laporan</span>
        </button>
    </nav>

    <!-- ==================== SLIDE-OVER DRAWER ==================== -->
    <div id="detail-drawer" class="drawer-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div class="drawer-panel">
            <div class="drawer-header">
                <div>
                    <h2 class="drawer-title" id="drawer-title">Detail</h2>
                    <div class="drawer-subtitle" id="drawer-subtitle"></div>
                </div>
                <button type="button" class="icon-btn" id="btn-close-drawer" aria-label="Tutup Panel">&times;</button>
            </div>
            <div class="drawer-body" id="drawer-body"></div>
        </div>
    </div>

    <!-- ==================== MODAL DINAMIS ==================== -->
    <div id="app-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-card">
            <div class="modal-header">
                <h2 class="modal-title" id="modal-title">Judul Modal</h2>
                <button type="button" class="icon-btn" id="btn-close-modal" aria-label="Tutup">&times;</button>
            </div>
            <div id="modal-body"></div>
        </div>
    </div>

    <div class="toast-container" id="toast-container" aria-live="polite" aria-atomic="true"></div>
