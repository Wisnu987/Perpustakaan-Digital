        <!-- ==================== SIDEBAR KIRI (DESKTOP) ==================== -->
        <aside class="app-sidebar" aria-label="Navigasi Perpustakaan">
            <div class="brand">
                <div class="brand-mark" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                        <line x1="9" y1="7" x2="16" y2="7"></line>
                        <line x1="9" y1="11" x2="14" y2="11"></line>
                    </svg>
                </div>
                <div class="brand-text">
                    <span class="brand-title">SMPN 1 Dramaga</span>
                    <span class="brand-sub">Smart Library • 11 Tabel 3NF</span>
                </div>
            </div>

            <nav class="rail-nav" aria-label="Navigasi Utama">
                <button type="button" class="nav-tab" data-tab="circulation">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                    <span class="nav-label">Sirkulasi</span>
                </button>
                <button type="button" class="nav-tab active" data-tab="catalog" aria-current="page">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    <span class="nav-label">Katalog &amp; Inventaris</span>
                </button>
                <button type="button" class="nav-tab" data-tab="members">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span class="nav-label">Anggota &amp; Staf</span>
                </button>
                <button type="button" class="nav-tab" data-tab="fines">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                    <span class="nav-label">Sanksi &amp; Denda</span>
                    <span class="nav-badge hidden" id="nav-fines-badge">0</span>
                </button>
                <button type="button" class="nav-tab" data-tab="reports">
                    <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    <span class="nav-label">Mission Objectives</span>
                </button>
            </nav>

            <div class="rail-footer">
                <div class="db-pill" id="db-status-pill" title="Status Koneksi Supabase PostgreSQL">
                    <span class="db-dot" id="db-status-dot"></span>
                    <span class="mono" id="db-status-text">Menghubungkan...</span>
                </div>
                <button type="button" class="account-btn" id="btn-open-login">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span class="account-btn-text" id="auth-role-label">Mode Tamu • Login</span>
                </button>
            </div>
        </aside>
