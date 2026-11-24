/**
 * Smart Library SMP Negeri 1 Dramaga — UI Controller (Supabase PostgreSQL)
 */

const state = {
    activeTab: 'catalog',
    circSubtab: 'LOANS',
    loanFilter: 'AKTIF',
    memberSubtab: 'ANGGOTA',
    fineFilter: 'ALL',
    auth: null, // { role: 'staf' | 'anggota', user: {...} }
    categories: [],
    loansCache: [],
    stafCache: []
};

const SESSION_KEY = 'smartlib_dramaga_session_v1';

const TAB_TITLES = {
    circulation: 'Sirkulasi Peminjaman & Pengembalian',
    catalog: 'Katalog Buku, Kategori & Inventaris',
    members: 'Keanggotaan & Struktur Staf',
    fines: 'Rekapitulasi Sanksi & Denda',
    reports: 'SQL Mission Objectives & Laporan'
};

let lastFocusedBeforeModal = null;
let lastFocusedBeforeDrawer = null;

// ==================== HELPERS ====================
function $(id) {
    return document.getElementById(id);
}

function escapeHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRupiah(num) {
    return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function debounce(fn, waitMs = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), waitMs);
    };
}

function createToastIcon(type) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('toast-icon');

    if (type === 'success') {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M20 6L9 17l-5-5');
        svg.appendChild(path);
    } else if (type === 'error') {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        const l1 = document.createElementNS(svgNS, 'line');
        l1.setAttribute('x1', '12');
        l1.setAttribute('y1', '8');
        l1.setAttribute('x2', '12');
        l1.setAttribute('y2', '12');
        const l2 = document.createElementNS(svgNS, 'line');
        l2.setAttribute('x1', '12');
        l2.setAttribute('y1', '16');
        l2.setAttribute('x2', '12.01');
        l2.setAttribute('y2', '16');
        svg.append(circle, l1, l2);
    } else {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '10');
        const l1 = document.createElementNS(svgNS, 'line');
        l1.setAttribute('x1', '12');
        l1.setAttribute('y1', '16');
        l1.setAttribute('x2', '12');
        l1.setAttribute('y2', '12');
        const l2 = document.createElementNS(svgNS, 'line');
        l2.setAttribute('x1', '12');
        l2.setAttribute('y1', '8');
        l2.setAttribute('x2', '12.01');
        l2.setAttribute('y2', '8');
        svg.append(circle, l1, l2);
    }
    return svg;
}

function showToast(message, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const normalizedType = type === 'error' || type === 'success' ? type : 'info';

    const el = document.createElement('div');
    el.className = `toast toast-${normalizedType}`;
    el.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');

    const msgSpan = document.createElement('span');
    msgSpan.className = 'toast-msg';
    msgSpan.textContent = message;

    el.appendChild(createToastIcon(normalizedType));
    el.appendChild(msgSpan);
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

async function withSubmitLock(form, asyncFn) {
    const submitBtn = form?.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = 'Memproses...';
    }
    try {
        return await asyncFn();
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute('aria-busy');
            submitBtn.textContent = originalText;
        }
    }
}

function isStaff() {
    return state.auth?.role === 'staf';
}

function isHeadLibrarian() {
    return isStaff() && !state.auth.user.id_supervisor;
}

function isMember() {
    return state.auth?.role === 'anggota';
}

function statusBadge(status) {
    const map = {
        Tersedia: 'badge-ok',
        Baik: 'badge-ok',
        Selesai: 'badge-ok',
        Lunas: 'badge-ok',
        Dipinjam: 'badge-blue',
        Terlambat: 'badge-danger',
        Rusak: 'badge-warn',
        Hilang: 'badge-danger',
        'Belum Lunas': 'badge-danger',
        Siswa: 'badge-blue',
        'Guru/Karyawan': 'badge-neutral'
    };
    return `<span class="badge ${map[status] || 'badge-neutral'}">${escapeHtml(status)}</span>`;
}

// ==================== THEME & MODAL/DRAWER ====================
function initTheme() {
    let saved = 'light';
    try {
        const stored = localStorage.getItem('smartlib_theme');
        if (stored === 'dark' || stored === 'light') saved = stored;
    } catch (_) {
        saved = 'light';
    }
    applyTheme(saved);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem('smartlib_theme', theme);
    } catch (_) {
        // Abaikan jika storage dibatasi
    }
    $('theme-icon-moon').classList.toggle('hidden', theme === 'dark');
    $('theme-icon-sun').classList.toggle('hidden', theme !== 'dark');
}

function openModal(title, html) {
    lastFocusedBeforeModal = document.activeElement;
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = html;
    $('app-modal').classList.remove('hidden');
    requestAnimationFrame(() => {
        const focusable = $('modal-body').querySelector('input:not([readonly]), select, button, textarea') || $('btn-close-modal');
        if (focusable) focusable.focus();
    });
}

function closeModal() {
    const modal = $('app-modal');
    if (modal.classList.contains('hidden')) return;
    modal.classList.add('hidden');
    $('modal-body').innerHTML = '';
    if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
        lastFocusedBeforeModal.focus();
    }
    lastFocusedBeforeModal = null;
}

function openDrawer(title, subtitle, html) {
    lastFocusedBeforeDrawer = document.activeElement;
    $('drawer-title').textContent = title;
    $('drawer-subtitle').textContent = subtitle || '';
    $('drawer-body').innerHTML = html;
    $('detail-drawer').classList.remove('hidden');
    requestAnimationFrame(() => {
        const focusable = $('drawer-body').querySelector('button, input, select') || $('btn-close-drawer');
        if (focusable) focusable.focus();
    });
}

function closeDrawer() {
    const drawer = $('detail-drawer');
    if (drawer.classList.contains('hidden')) return;
    drawer.classList.add('hidden');
    $('drawer-body').innerHTML = '';
    if (lastFocusedBeforeDrawer && typeof lastFocusedBeforeDrawer.focus === 'function') {
        lastFocusedBeforeDrawer.focus();
    }
    lastFocusedBeforeDrawer = null;
}

// ==================== AUTH & ROLE UI ====================
function loadSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            sessionStorage.removeItem(SESSION_KEY);
            return;
        }
        const hasValidToken = typeof parsed.token === 'string' && parsed.token.length >= 32;
        const notExpired = parsed.expires_at && new Date(parsed.expires_at) > new Date();
        if (
            hasValidToken &&
            notExpired &&
            parsed.role === 'staf' &&
            parsed.user &&
            typeof parsed.user.id_staf === 'string' &&
            typeof parsed.user.username === 'string'
        ) {
            state.auth = parsed;
            window.SmartDB.setSession(parsed.token, 'staf');
        } else if (
            hasValidToken &&
            notExpired &&
            parsed.role === 'anggota' &&
            parsed.user &&
            typeof parsed.user.id_anggota === 'string' &&
            typeof parsed.user.nama === 'string'
        ) {
            state.auth = parsed;
            window.SmartDB.setSession(parsed.token, 'anggota');
        } else {
            sessionStorage.removeItem(SESSION_KEY);
        }
    } catch (_) {
        state.auth = null;
        window.SmartDB.setSession(null, null);
        sessionStorage.removeItem(SESSION_KEY);
    }
}

function saveSession(authObj) {
    state.auth = authObj;
    if (authObj) {
        window.SmartDB.setSession(authObj.token, authObj.role);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(authObj));
    } else {
        window.SmartDB.setSession(null, null);
        sessionStorage.removeItem(SESSION_KEY);
    }
}

function syncRoleUI() {
    const staffMode = isStaff();
    const headMode = isHeadLibrarian();

    $('staff-circulation-forms').classList.toggle('hidden', !staffMode);
    $('staff-catalog-actions').classList.toggle('hidden', !staffMode);
    $('staff-member-actions').classList.toggle('hidden', !staffMode);
    $('btn-open-add-staf').classList.toggle('hidden', !headMode);

    const roleBanner = $('role-info-banner');
    const mobileRoleLabel = $('auth-role-label-mobile');

    if (staffMode) {
        const u = state.auth.user;
        const label = `${u.username} (${u.id_staf})`;
        $('auth-role-label').textContent = label;
        if (mobileRoleLabel) mobileRoleLabel.textContent = u.username;
        roleBanner.className = 'notice-box';
        roleBanner.innerHTML = `Masuk sebagai <strong>${escapeHtml(u.jabatan)}</strong> (<code>${escapeHtml(u.id_staf)}</code>). ${headMode ? 'Anda memiliki akses penuh Kepala Perpustakaan termasuk manajemen Staf.' : 'Anda memiliki akses operasional petugas.'}`;
        roleBanner.classList.remove('hidden');
    } else if (isMember()) {
        const m = state.auth.user;
        const label = `${m.nama} (${m.id_anggota})`;
        $('auth-role-label').textContent = label;
        if (mobileRoleLabel) mobileRoleLabel.textContent = m.id_anggota;
        roleBanner.className = 'notice-box';
        roleBanner.innerHTML = `Masuk sebagai <strong>${escapeHtml(m.tipe_anggota)}: ${escapeHtml(m.nama)}</strong> (Mode Query Anggota). Anda dapat menelusuri katalog dan memantau peminjaman atau denda pribadi.`;
        roleBanner.classList.remove('hidden');
    } else {
        $('auth-role-label').textContent = 'Mode Tamu • Login';
        if (mobileRoleLabel) mobileRoleLabel.textContent = 'Login';
        roleBanner.className = 'notice-box role-banner-row';
        roleBanner.innerHTML = `
            <span>Anda berada di <strong>Mode Tamu (Katalog Publik)</strong>. Data pribadi anggota dan transaksi dilindungi hingga Anda masuk.</span>
            <button type="button" class="btn btn-sm btn-primary" data-action="open-login">Login Staf / Anggota</button>
        `;
        roleBanner.classList.remove('hidden');
    }
}

function openLoginModal() {
    const loggedInHtml = state.auth ? `
        <div class="notice-box u-mb-md role-banner-row">
            <span>Sedang masuk sebagai <strong>${escapeHtml(isStaff() ? state.auth.user.username : state.auth.user.nama)}</strong>.</span>
            <button type="button" class="btn btn-sm btn-danger-outline" id="btn-logout-now">Keluar</button>
        </div>` : '';

    openModal('Masuk Sistem Smart Library', `
        ${loggedInHtml}
        <div class="segmented-control u-mb-md">
            <button type="button" class="segmented-btn active" id="login-tab-staf">Login Staf Perpustakaan</button>
            <button type="button" class="segmented-btn" id="login-tab-anggota">Masuk sebagai Anggota</button>
        </div>

        <form id="form-login-staf">
            <div class="field-group">
                <label class="field-label" for="login-staf-user">Username Staf</label>
                <input type="text" id="login-staf-user" class="input" placeholder="Masukkan username staf" required autocomplete="username" />
            </div>
            <div class="field-group">
                <label class="field-label" for="login-staf-pass">Password</label>
                <input type="password" id="login-staf-pass" class="input" placeholder="Password staf" required autocomplete="current-password" />
            </div>
            <button type="submit" class="btn btn-primary u-full">Masuk sebagai Staf</button>
        </form>

        <form id="form-login-anggota" class="hidden">
            <div class="field-group">
                <label class="field-label" for="login-anggota-id">ID Anggota</label>
                <input type="text" id="login-anggota-id" class="input mono" placeholder="Misal: A001" required maxlength="10" />
            </div>
            <div class="field-group">
                <label class="field-label" for="login-anggota-identitas">Verifikasi NISN (10 digit) / NIP (18 digit)</label>
                <input type="password" id="login-anggota-identitas" class="input mono" placeholder="Masukkan NISN atau NIP Anda" required minlength="10" maxlength="18" pattern="[0-9]{10,18}" />
            </div>
            <button type="submit" class="btn btn-primary u-full">Masuk Mode Query Anggota</button>
        </form>
    `);

    const btnLogout = $('btn-logout-now');
    if (btnLogout) {
        btnLogout.onclick = async () => {
            await window.SmartDB.logout();
            saveSession(null);
            closeModal();
            if (state.activeTab === 'circulation' || state.activeTab === 'members' || state.activeTab === 'fines') {
                switchTab('catalog');
            } else {
                refreshAll();
            }
            showToast('Anda telah keluar.', 'info');
        };
    }

    $('login-tab-staf').onclick = () => {
        $('login-tab-staf').classList.add('active');
        $('login-tab-anggota').classList.remove('active');
        $('form-login-staf').classList.remove('hidden');
        $('form-login-anggota').classList.add('hidden');
    };
    $('login-tab-anggota').onclick = () => {
        $('login-tab-anggota').classList.add('active');
        $('login-tab-staf').classList.remove('active');
        $('form-login-anggota').classList.remove('hidden');
        $('form-login-staf').classList.add('hidden');
    };

    const formStaf = $('form-login-staf');
    formStaf.onsubmit = (e) => {
        e.preventDefault();
        withSubmitLock(formStaf, async () => {
            try {
                const session = await window.SmartDB.loginStaf(
                    $('login-staf-user').value,
                    $('login-staf-pass').value
                );
                saveSession({ role: 'staf', user: session.user, token: session.token, expires_at: session.expires_at });
                closeModal();
                await refreshAll();
                showToast(`Selamat datang, ${session.user.jabatan}!`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    const formAnggota = $('form-login-anggota');
    formAnggota.onsubmit = (e) => {
        e.preventDefault();
        withSubmitLock(formAnggota, async () => {
            try {
                const session = await window.SmartDB.loginAnggota(
                    $('login-anggota-id').value,
                    $('login-anggota-identitas').value
                );
                saveSession({ role: 'anggota', user: session.user, token: session.token, expires_at: session.expires_at });
                closeModal();
                await refreshAll();
                showToast(`Masuk sebagai ${session.user.nama}`, 'success');
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

// ==================== TAB NAVIGATION ====================
function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll('.nav-tab, .mobile-nav-btn').forEach((b) => {
        const active = b.dataset.tab === tabName;
        b.classList.toggle('active', active);
        if (active) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.view-section').forEach((sec) => {
        sec.classList.toggle('active', sec.id === `view-${tabName}`);
    });
    const topbarCtx = $('topbar-context');
    if (topbarCtx) topbarCtx.textContent = TAB_TITLES[tabName] || 'Smart Library';
    refreshCurrentTab();
}

async function refreshCurrentTab() {
    if (!window.SmartDB.schemaReady) return;
    try {
        if (state.activeTab === 'circulation') await refreshCirculationView();
        else if (state.activeTab === 'catalog') await refreshCatalogView();
        else if (state.activeTab === 'members') await refreshMembersView();
        else if (state.activeTab === 'fines') await refreshFinesView();
        else if (state.activeTab === 'reports') await refreshReportsView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function refreshDashboardMetrics() {
    const s = await window.SmartDB.getDashboardStats();
    $('stat-total-eksemplar').textContent = s.totalEksemplar;
    $('stat-total-judul').textContent = `${s.totalJudul} judul • ${s.eksemplarTersedia} tersedia`;
    $('stat-dipinjam-eksemplar').textContent = s.eksemplarDipinjam;
    $('stat-peminjaman-aktif').textContent = s.peminjamanAktif;
    $('stat-peminjaman-telat').textContent = `${s.peminjamanTerlambat} terlambat`;

    const stockProg = $('stat-stock-progress');
    if (stockProg) {
        stockProg.max = Math.max(1, s.totalEksemplar);
        stockProg.value = s.eksemplarTersedia;
    }

    const hidePrivateCounts = !isStaff() && !isMember();
    $('stat-denda-belum').textContent = hidePrivateCounts ? '—' : s.dendaBelumLunasCount;
    $('stat-denda-nominal').textContent = hidePrivateCounts ? 'Khusus akun login' : `Total ${formatRupiah(s.dendaBelumLunasTotal)}`;

    const showBadge = isStaff() && s.dendaBelumLunasCount > 0;
    const badge = $('nav-fines-badge');
    const mobileBadge = $('mobile-fines-badge');
    if (badge) {
        badge.textContent = s.dendaBelumLunasCount;
        badge.classList.toggle('hidden', !showBadge);
    }
    if (mobileBadge) {
        mobileBadge.textContent = s.dendaBelumLunasCount;
        mobileBadge.classList.toggle('hidden', !showBadge);
    }
}

// ==================== TAB 1: SIRKULASI ====================
async function refreshCirculationView() {
    await refreshDashboardMetrics();

    if (!isStaff() && !isMember()) {
        $('circ-loans-wrap').classList.add('hidden');
        $('circ-returns-wrap').classList.add('hidden');
        $('circ-guest-lock').classList.remove('hidden');
        return;
    }

    $('circ-guest-lock').classList.add('hidden');
    $('circ-loans-wrap').classList.toggle('hidden', state.circSubtab !== 'LOANS');
    $('circ-returns-wrap').classList.toggle('hidden', state.circSubtab !== 'RETURNS');

    const scopedMemberId = isMember() ? state.auth.user.id_anggota : null;
    const loans = await window.SmartDB.getPeminjamanList({
        status: state.loanFilter,
        search: $('circ-search-input').value,
        idAnggota: scopedMemberId
    });
    state.loansCache = loans;

    const tbody = $('circ-loans-tbody');
    if (loans.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="u-center u-muted">Belum ada data peminjaman pada filter ini.</td></tr>';
    } else {
        const today = window.DateUtil.todayLocalISO();
        tbody.innerHTML = loans.map((l) => {
            const isOverdue = l.status_peminjaman !== 'Selesai' && l.tgl_jatuh_tempo < today;
            const statusText = l.status_peminjaman === 'Dipinjam' && isOverdue ? 'Terlambat' : l.status_peminjaman;
            const actionBtn = isStaff() && l.status_peminjaman !== 'Selesai'
                ? `<button type="button" class="btn btn-sm btn-soft-blue" data-action="select-loan" data-id="${escapeHtml(l.id_peminjaman)}">Proses Kembali</button>`
                : (l.pengembalian ? `<span class="mono cell-sub">Kembali: ${escapeHtml(l.pengembalian.tgl_kembali)}</span>` : '—');

            return `
                <tr>
                    <td class="mono u-bold">${escapeHtml(l.id_peminjaman)}</td>
                    <td><strong>${escapeHtml(l.anggota?.nama || '—')}</strong><div class="mono cell-sub">${escapeHtml(l.id_anggota)}</div></td>
                    <td class="mono">${escapeHtml(l.tgl_pinjam)}</td>
                    <td class="mono">${escapeHtml(l.tgl_jatuh_tempo)}</td>
                    <td>${escapeHtml(l.staf?.username || l.id_staf)}</td>
                    <td>${statusBadge(statusText)}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }

    if (state.circSubtab === 'RETURNS') {
        await refreshReturnsTable();
    }
    if (isStaff()) {
        await loadCirculationFormOptions();
    }
}

async function refreshReturnsTable() {
    const returns = await window.SmartDB.getPengembalianList();
    const filtered = isMember()
        ? returns.filter((r) => r.peminjaman?.id_anggota === state.auth.user.id_anggota)
        : returns;

    const tbody = $('circ-returns-tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="u-center u-muted">Belum ada riwayat pengembalian.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map((r) => {
        const itemsHtml = (r.detail_pengembalian || []).map((d) =>
            `<span class="badge badge-neutral badge-inline">${escapeHtml(d.id_buku)} #${Number(d.no_eksemplar)} (${escapeHtml(d.inventaris?.katalog_buku?.judul || '')})</span>`
        ).join('') || '—';
        const denda = r.sanksi_denda;
        const dendaHtml = denda
            ? `${statusBadge(denda.status_pembayaran)} <span class="mono">${formatRupiah(denda.jumlah_denda)}</span>`
            : '<span class="u-muted">Tidak ada</span>';

        return `
            <tr>
                <td class="mono u-bold">${escapeHtml(r.id_pengembalian)}</td>
                <td><span class="mono">${escapeHtml(r.id_peminjaman)}</span> • ${escapeHtml(r.peminjaman?.anggota?.nama || '—')}</td>
                <td class="mono">${escapeHtml(r.tgl_kembali)}</td>
                <td class="mono">${Number(r.hari_terlambat)} hari</td>
                <td>${itemsHtml}</td>
                <td>${dendaHtml}</td>
            </tr>
        `;
    }).join('');
}

async function loadCirculationFormOptions() {
    const [nextPj, nextPg, nextD, anggotaList, availInv, activeLoans, borrowedInv] = await Promise.all([
        window.SmartDB.nextId('peminjaman', 'id_peminjaman', 'PJ', 3),
        window.SmartDB.nextId('pengembalian', 'id_pengembalian', 'PG', 3),
        window.SmartDB.nextId('sanksi_denda', 'id_denda', 'D', 3),
        window.SmartDB.getAnggotaList(),
        window.SmartDB.getInventarisList({ status: 'Tersedia' }),
        window.SmartDB.getPeminjamanList({ status: 'AKTIF' }),
        window.SmartDB.getInventarisList({ status: 'Dipinjam' })
    ]);

    $('loan-id-input').value = nextPj;
    $('next-loan-id-badge').textContent = nextPj;
    $('return-id-input').value = nextPg;
    $('next-return-id-badge').textContent = nextPg;
    $('return-denda-id').value = nextD;

    const today = window.DateUtil.todayLocalISO();
    if (!$('loan-tgl-pinjam').value) $('loan-tgl-pinjam').value = today;
    if (!$('loan-tgl-tempo').value) $('loan-tgl-tempo').value = window.DateUtil.addDaysISO(today, 7);
    if (!$('return-tgl-kembali').value) $('return-tgl-kembali').value = today;

    $('loan-member-select').innerHTML = anggotaList.map((a) =>
        `<option value="${escapeHtml(a.id_anggota)}">${escapeHtml(a.id_anggota)} — ${escapeHtml(a.nama)} (${escapeHtml(a.tipe_anggota)})</option>`
    ).join('');

    const availWrap = $('loan-available-copies-list');
    availWrap.innerHTML = availInv.length === 0
        ? '<div class="empty-hint">Tidak ada eksemplar berstatus Tersedia.</div>'
        : availInv.map((c) => `
            <label class="copy-check-label">
                <input type="checkbox" class="chk-borrow-copy" data-id-buku="${escapeHtml(c.id_buku)}" data-no="${Number(c.no_eksemplar)}" />
                <span class="mono u-bold">${escapeHtml(c.id_buku)} #${Number(c.no_eksemplar)}</span>
                <span>${escapeHtml(c.katalog_buku?.judul || '')}</span>
            </label>
        `).join('');

    const retLoanSel = $('return-loan-select');
    retLoanSel.innerHTML = activeLoans.length === 0
        ? '<option value="">Tidak ada peminjaman aktif</option>'
        : activeLoans.map((l) =>
            `<option value="${escapeHtml(l.id_peminjaman)}" data-tempo="${escapeHtml(l.tgl_jatuh_tempo)}">${escapeHtml(l.id_peminjaman)} — ${escapeHtml(l.anggota?.nama || l.id_anggota)} (Tempo: ${escapeHtml(l.tgl_jatuh_tempo)})</option>`
        ).join('');

    const borWrap = $('return-borrowed-copies-list');
    borWrap.innerHTML = borrowedInv.length === 0
        ? '<div class="empty-hint">Tidak ada eksemplar berstatus Dipinjam.</div>'
        : borrowedInv.map((c) => `
            <div class="copy-item-row">
                <label class="copy-check-label">
                    <input type="checkbox" class="chk-return-copy" data-id-buku="${escapeHtml(c.id_buku)}" data-no="${Number(c.no_eksemplar)}" />
                    <span class="mono u-bold">${escapeHtml(c.id_buku)} #${Number(c.no_eksemplar)}</span>
                    <span>${escapeHtml(c.katalog_buku?.judul || '')}</span>
                </label>
                <select class="select ret-copy-cond ret-cond-select" data-key="${escapeHtml(c.id_buku)}#${Number(c.no_eksemplar)}" aria-label="Kondisi fisik buku ${escapeHtml(c.id_buku)}">
                    <option value="Baik">Baik</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Hilang">Hilang</option>
                </select>
            </div>
        `).join('');

    recomputeLateDays();
}

function recomputeLateDays() {
    const sel = $('return-loan-select');
    const opt = sel.options[sel.selectedIndex];
    const tempo = opt?.dataset?.tempo;
    const tglKembali = $('return-tgl-kembali').value;
    const days = tempo ? window.DateUtil.diffDaysISO(tglKembali, tempo) : 0;
    $('return-hari-terlambat').value = days;

    if (days > 0) {
        $('return-apply-fine-chk').checked = true;
        $('return-fine-fields').classList.remove('hidden');
        $('return-denda-jumlah').value = days * 1000;
        $('return-denda-jenis').value = `Keterlambatan ${days} Hari`;
    }
}

function selectLoanForReturn(idPeminjaman) {
    $('return-loan-select').value = idPeminjaman;
    recomputeLateDays();
    $('return-loan-select').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ==================== TAB 2: KATALOG, KATEGORI & INVENTARIS ====================
async function refreshCatalogView() {
    const cats = await window.SmartDB.getKategoriList();
    state.categories = cats;

    const filterSel = $('catalog-kategori-filter');
    const curVal = filterSel.value;
    filterSel.innerHTML = '<option value="ALL">Semua Kategori</option>' +
        cats.map((c) => `<option value="${escapeHtml(c.id_kategori)}">${escapeHtml(c.nama_kategori)} (${escapeHtml(c.lokasi_rak || '—')})</option>`).join('');
    filterSel.value = cats.some((c) => c.id_kategori === curVal) ? curVal : 'ALL';

    const rows = await window.SmartDB.getKatalogStok({
        search: $('catalog-search-input').value,
        idKategori: filterSel.value
    });

    const tbody = $('catalog-tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="u-center u-muted">Belum ada judul buku ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((b) => `
        <tr>
            <td class="mono u-bold">${escapeHtml(b.id_buku)}</td>
            <td>
                <strong>${escapeHtml(b.judul)}</strong>
                <div class="mono cell-sub">ISBN: ${escapeHtml(b.isbn)}</div>
            </td>
            <td>${escapeHtml(b.penerbit || '—')}<div class="mono cell-sub">${escapeHtml(b.tahun_terbit || '—')}</div></td>
            <td>${escapeHtml(b.nama_kategori)}<div class="cell-sub">${escapeHtml(b.lokasi_rak || '—')}</div></td>
            <td class="mono">
                <span class="badge ${b.stok_tersedia > 0 ? 'badge-ok' : 'badge-warn'}">${Number(b.stok_tersedia)} / ${Number(b.stok_total)}</span>
                ${b.stok_dipinjam > 0 ? `<span class="cell-sub u-ml-xs">(${Number(b.stok_dipinjam)} dipinjam)</span>` : ''}
            </td>
            <td>
                <div class="action-group">
                    <button type="button" class="btn btn-sm btn-soft-blue" data-action="open-inventaris" data-id="${escapeHtml(b.id_buku)}" data-title="${escapeHtml(b.judul)}">Eksemplar</button>
                    ${isStaff() ? `
                        <button type="button" class="btn btn-sm" data-action="edit-katalog" data-id="${escapeHtml(b.id_buku)}">Edit</button>
                        <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-katalog" data-id="${escapeHtml(b.id_buku)}" data-title="${escapeHtml(b.judul)}">Hapus</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

async function openInventarisDrawer(idBuku, judul) {
    try {
        const copies = await window.SmartDB.getInventarisList({ idBuku });
        const addBtnHtml = isStaff() ? `
            <div class="drawer-toolbar">
                <span class="cell-sub">Komposisi fisik dari <code>katalog_buku</code></span>
                <button type="button" class="btn btn-sm btn-primary" id="btn-drawer-add-copy">+ Tambah Eksemplar</button>
            </div>` : '';

        const listHtml = copies.length === 0
            ? '<div class="notice-box">Belum ada eksemplar fisik terdaftar.</div>'
            : `<div class="sheet"><div class="table-wrap"><table class="data-table">
                <thead><tr><th>No</th><th>Ketersediaan</th><th>Kondisi</th>${isStaff() ? '<th>Aksi</th>' : ''}</tr></thead>
                <tbody>
                    ${copies.map((c) => `
                        <tr>
                            <td class="mono">#${Number(c.no_eksemplar)}</td>
                            <td>${statusBadge(c.status_ketersediaan)}</td>
                            <td>${statusBadge(c.kondisi_fisik)}</td>
                            ${isStaff() ? `
                                <td>
                                    <div class="action-group">
                                        <button type="button" class="btn btn-sm" data-action="edit-copy" data-id="${escapeHtml(c.id_buku)}" data-no="${Number(c.no_eksemplar)}" data-avail="${escapeHtml(c.status_ketersediaan)}" data-cond="${escapeHtml(c.kondisi_fisik)}">Ubah</button>
                                        <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-copy" data-id="${escapeHtml(c.id_buku)}" data-no="${Number(c.no_eksemplar)}" data-title="${escapeHtml(judul)}">Hapus</button>
                                    </div>
                                </td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table></div></div>`;

        openDrawer(`Inventaris: ${judul}`, `ID Buku: ${idBuku} • ${copies.length} Eksemplar`, addBtnHtml + listHtml);

        const addBtn = $('btn-drawer-add-copy');
        if (addBtn) {
            addBtn.onclick = async () => {
                try {
                    await window.SmartDB.addInventarisCopy({ id_buku: idBuku });
                    showToast('Eksemplar baru ditambahkan.', 'success');
                    await openInventarisDrawer(idBuku, judul);
                    await refreshCatalogView();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            };
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function openEditCopyModal(idBuku, noEksemplar, statusAvail, kondisi) {
    openModal(`Ubah Eksemplar ${idBuku} #${noEksemplar}`, `
        <form id="form-edit-copy">
            <div class="field-group">
                <label class="field-label" for="copy-avail-sel">Status Ketersediaan</label>
                <select id="copy-avail-sel" class="select">
                    <option value="Tersedia">Tersedia</option>
                    <option value="Dipinjam">Dipinjam</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Hilang">Hilang</option>
                </select>
            </div>
            <div class="field-group">
                <label class="field-label" for="copy-cond-sel">Kondisi Fisik</label>
                <select id="copy-cond-sel" class="select">
                    <option value="Baik">Baik</option>
                    <option value="Rusak">Rusak</option>
                    <option value="Hilang">Hilang</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary u-full">Simpan Perubahan</button>
        </form>
    `);
    $('copy-avail-sel').value = statusAvail;
    $('copy-cond-sel').value = kondisi;
    const form = $('form-edit-copy');
    form.onsubmit = (e) => {
        e.preventDefault();
        withSubmitLock(form, async () => {
            try {
                await window.SmartDB.updateInventarisCopy({
                    id_buku: idBuku,
                    no_eksemplar: noEksemplar,
                    status_ketersediaan: $('copy-avail-sel').value,
                    kondisi_fisik: $('copy-cond-sel').value
                });
                closeModal();
                showToast('Status eksemplar diperbarui.', 'success');
                await refreshCatalogView();
                closeDrawer();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

async function handleDeleteCopy(idBuku, noEksemplar, judul) {
    if (!confirm(`Hapus eksemplar ${idBuku} #${noEksemplar}?`)) return;
    try {
        await window.SmartDB.deleteInventarisCopy(idBuku, noEksemplar);
        showToast('Eksemplar dihapus.', 'success');
        await openInventarisDrawer(idBuku, judul);
        await refreshCatalogView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openKatalogModal(editId = null) {
    const isEdit = Boolean(editId);
    const cats = state.categories.length ? state.categories : await window.SmartDB.getKategoriList();
    let existing = null;
    if (isEdit) {
        const rows = await window.SmartDB.getKatalogStok({});
        existing = rows.find((r) => r.id_buku === editId);
    }
    const nextId = isEdit ? editId : await window.SmartDB.nextId('katalog_buku', 'id_buku', 'B', 3);

    openModal(isEdit ? `Edit Katalog ${editId}` : 'Tambah Judul Buku Baru', `
        <form id="form-katalog">
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="kat-id-buku">ID Buku</label>
                    <input type="text" id="kat-id-buku" class="input mono" value="${escapeHtml(nextId)}" ${isEdit ? 'readonly' : 'required'} maxlength="10" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="kat-isbn">ISBN</label>
                    <input type="text" id="kat-isbn" class="input mono" value="${escapeHtml(existing?.isbn || '')}" placeholder="978-602-..." required maxlength="17" />
                </div>
            </div>
            <div class="field-group">
                <label class="field-label" for="kat-judul">Judul Buku</label>
                <input type="text" id="kat-judul" class="input" value="${escapeHtml(existing?.judul || '')}" required maxlength="150" />
            </div>
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="kat-penerbit">Penerbit</label>
                    <input type="text" id="kat-penerbit" class="input" value="${escapeHtml(existing?.penerbit || '')}" maxlength="80" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="kat-tahun">Tahun Terbit</label>
                    <input type="number" id="kat-tahun" class="input mono" min="1900" max="2100" value="${escapeHtml(existing?.tahun_terbit || new Date().getFullYear())}" />
                </div>
            </div>
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="kat-kategori">Kategori Buku</label>
                    <select id="kat-kategori" class="select" required>
                        ${cats.map((c) => `<option value="${escapeHtml(c.id_kategori)}">${escapeHtml(c.nama_kategori)}</option>`).join('')}
                    </select>
                </div>
                ${!isEdit ? `
                <div class="field-group">
                    <label class="field-label" for="kat-eksemplar">Jumlah Eksemplar Awal</label>
                    <input type="number" id="kat-eksemplar" class="input mono" min="1" max="50" value="2" required />
                </div>` : '<div></div>'}
            </div>
            <button type="submit" class="btn btn-primary u-full">${isEdit ? 'Simpan Perubahan' : 'Simpan Judul & Eksemplar'}</button>
        </form>
    `);
    if (existing) $('kat-kategori').value = existing.id_kategori;

    const form = $('form-katalog');
    form.onsubmit = (e) => {
        e.preventDefault();
        withSubmitLock(form, async () => {
            try {
                await window.SmartDB.saveKatalog({
                    id_buku: $('kat-id-buku').value.trim(),
                    isbn: $('kat-isbn').value.trim(),
                    judul: $('kat-judul').value.trim(),
                    penerbit: $('kat-penerbit').value.trim() || null,
                    tahun_terbit: $('kat-tahun').value ? Number($('kat-tahun').value) : null,
                    id_kategori: $('kat-kategori').value
                }, isEdit, isEdit ? 0 : Number($('kat-eksemplar').value));
                closeModal();
                showToast(isEdit ? 'Katalog diperbarui.' : 'Judul buku dan eksemplar ditambahkan.', 'success');
                await refreshCatalogView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

async function handleDeleteKatalog(idBuku, judul) {
    if (!confirm(`Hapus "${judul}" (${idBuku})? Seluruh eksemplar inventaris yang belum pernah dikembalikan akan ikut terhapus (CASCADE).`)) return;
    try {
        await window.SmartDB.deleteKatalog(idBuku);
        showToast('Judul buku dihapus.', 'success');
        await refreshCatalogView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openCategoriesModal() {
    const cats = await window.SmartDB.getKategoriList();
    const nextKat = await window.SmartDB.nextId('kategori_buku', 'id_kategori', 'K', 2);

    openModal('Kelola Kategori Buku', `
        <form id="form-new-kategori" class="panel-section-bottom u-mb-md">
            <div class="form-grid-2">
                <input type="text" id="new-kat-id" class="input mono" value="${escapeHtml(nextKat)}" placeholder="ID (K06)" required maxlength="10" aria-label="ID Kategori" />
                <input type="text" id="new-kat-rak" class="input" placeholder="Lokasi Rak (Rak F1)" maxlength="20" aria-label="Lokasi Rak" />
            </div>
            <div class="input-row u-mt-sm">
                <input type="text" id="new-kat-nama" class="input" placeholder="Nama Kategori Baru" required maxlength="50" aria-label="Nama Kategori" />
                <button type="submit" class="btn btn-primary btn-sm">Tambah</button>
            </div>
        </form>
        <div class="sheet"><div class="table-wrap">
            <table class="data-table">
                <thead><tr><th>ID</th><th>Nama Kategori</th><th>Lokasi Rak</th><th>Aksi</th></tr></thead>
                <tbody>
                    ${cats.map((c) => `
                        <tr>
                            <td class="mono">${escapeHtml(c.id_kategori)}</td>
                            <td>${escapeHtml(c.nama_kategori)}</td>
                            <td>${escapeHtml(c.lokasi_rak || '—')}</td>
                            <td><button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-kategori" data-id="${escapeHtml(c.id_kategori)}">Hapus</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div></div>
    `);

    const form = $('form-new-kategori');
    form.onsubmit = (e) => {
        e.preventDefault();
        withSubmitLock(form, async () => {
            try {
                await window.SmartDB.saveKategori({
                    id_kategori: $('new-kat-id').value.trim(),
                    nama_kategori: $('new-kat-nama').value.trim(),
                    lokasi_rak: $('new-kat-rak').value.trim() || null
                }, false);
                showToast('Kategori ditambahkan.', 'success');
                await openCategoriesModal();
                await refreshCatalogView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

async function handleDeleteKategori(idKategori) {
    try {
        await window.SmartDB.deleteKategori(idKategori);
        showToast('Kategori dihapus.', 'success');
        await openCategoriesModal();
        await refreshCatalogView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==================== TAB 3: ANGGOTA & STAF ====================
async function refreshMembersView() {
    if (!isStaff() && !isMember()) {
        $('members-toolbar').classList.add('hidden');
        $('members-table-wrap').classList.add('hidden');
        $('staf-table-wrap').classList.add('hidden');
        $('members-guest-lock').classList.remove('hidden');
        return;
    }

    $('members-guest-lock').classList.add('hidden');
    $('members-toolbar').classList.remove('hidden');

    const stafBtn = $('member-subtab-staf');
    if (isMember()) {
        if (stafBtn) stafBtn.classList.add('hidden');
        state.memberSubtab = 'ANGGOTA';
        document.querySelectorAll('[data-member-subtab]').forEach((b) => {
            b.classList.toggle('active', b.dataset.memberSubtab === 'ANGGOTA');
        });
    } else if (stafBtn) {
        stafBtn.classList.remove('hidden');
    }

    if (state.memberSubtab === 'STAF') {
        $('members-table-wrap').classList.add('hidden');
        $('staf-table-wrap').classList.remove('hidden');
        await refreshStafTable();
        return;
    }

    $('members-table-wrap').classList.remove('hidden');
    $('staf-table-wrap').classList.add('hidden');

    let rows = await window.SmartDB.getAnggotaList({
        tipe: $('member-type-filter').value,
        search: $('member-search-input').value
    });
    if (isMember()) {
        rows = rows.filter((r) => r.id_anggota === state.auth.user.id_anggota);
    }

    const tbody = $('members-tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="u-center u-muted">Data anggota tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((m) => `
        <tr>
            <td class="mono u-bold">${escapeHtml(m.id_anggota)}</td>
            <td><strong>${escapeHtml(m.nama)}</strong><div class="cell-sub">${escapeHtml(m.no_telepon || '—')}</div></td>
            <td>${statusBadge(m.tipe_anggota)}</td>
            <td class="mono">${escapeHtml(m.nisn || m.nip || '—')}</td>
            <td>${m.tipe_anggota === 'Siswa' ? `Kelas ${escapeHtml(m.kelas)} (${escapeHtml(m.tahun_angkatan)})` : escapeHtml(m.unit_kerja_mata_pelajaran || '—')}</td>
            <td class="mono">${escapeHtml(m.tgl_bergabung)}</td>
            <td>
                ${isStaff() ? `
                    <div class="action-group">
                        <button type="button" class="btn btn-sm" data-action="edit-member" data-id="${escapeHtml(m.id_anggota)}">Edit</button>
                        <button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-member" data-id="${escapeHtml(m.id_anggota)}" data-name="${escapeHtml(m.nama)}">Hapus</button>
                    </div>
                ` : '—'}
            </td>
        </tr>
    `).join('');
}

async function refreshStafTable() {
    const rows = await window.SmartDB.getStafList();
    state.stafCache = rows;
    const byId = Object.fromEntries(rows.map((s) => [s.id_staf, s]));
    const tbody = $('staf-tbody');

    tbody.innerHTML = rows.map((s) => {
        const sup = s.id_supervisor ? byId[s.id_supervisor] : null;
        const supLabel = sup ? `${sup.id_staf} (${sup.jabatan})` : '<span class="badge badge-blue">Kepala (Top)</span>';
        return `
            <tr>
                <td class="mono u-bold">${escapeHtml(s.id_staf)}</td>
                <td>${escapeHtml(s.jabatan)}</td>
                <td class="mono">${escapeHtml(s.username)}</td>
                <td>${sup ? escapeHtml(`${sup.id_staf} — ${sup.username}`) : supLabel}</td>
                <td>
                    ${isHeadLibrarian() ? `
                        <div class="action-group">
                            <button type="button" class="btn btn-sm" data-action="edit-staf" data-id="${escapeHtml(s.id_staf)}">Edit</button>
                            ${s.id_staf !== state.auth.user.id_staf ? `<button type="button" class="btn btn-sm btn-danger-outline" data-action="delete-staf" data-id="${escapeHtml(s.id_staf)}">Hapus</button>` : ''}
                        </div>
                    ` : '<span class="cell-sub">Khusus Kepala Perpus</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

async function openMemberModal(editId = null) {
    const isEdit = Boolean(editId);
    let existing = null;
    if (isEdit) {
        const all = await window.SmartDB.getAnggotaList();
        existing = all.find((a) => a.id_anggota === editId);
    }
    const nextId = isEdit ? editId : await window.SmartDB.nextId('anggota', 'id_anggota', 'A', 3);
    const curType = existing?.tipe_anggota || 'Siswa';

    openModal(isEdit ? `Edit Anggota ${editId}` : 'Tambah Anggota Baru', `
        <form id="form-member">
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="mem-id">ID Anggota</label>
                    <input type="text" id="mem-id" class="input mono" value="${escapeHtml(nextId)}" ${isEdit ? 'readonly' : 'required'} maxlength="10" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="mem-tipe">Spesialisasi (Disjoint)</label>
                    <select id="mem-tipe" class="select" ${isEdit ? 'disabled' : ''}>
                        <option value="Siswa">Siswa</option>
                        <option value="Guru/Karyawan">Guru / Karyawan</option>
                    </select>
                </div>
            </div>
            <div class="field-group">
                <label class="field-label" for="mem-nama">Nama Lengkap</label>
                <input type="text" id="mem-nama" class="input" value="${escapeHtml(existing?.nama || '')}" required maxlength="100" />
            </div>
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="mem-telp">No. Telepon</label>
                    <input type="text" id="mem-telp" class="input mono" value="${escapeHtml(existing?.no_telepon || '')}" maxlength="15" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="mem-tgl">Tanggal Bergabung</label>
                    <input type="date" id="mem-tgl" class="input mono" value="${escapeHtml(existing?.tgl_bergabung || window.DateUtil.todayLocalISO())}" required />
                </div>
            </div>
            <div class="field-group">
                <label class="field-label" for="mem-alamat">Alamat</label>
                <input type="text" id="mem-alamat" class="input" value="${escapeHtml(existing?.alamat || '')}" maxlength="150" />
            </div>

            <div id="mem-siswa-fields">
                <div class="form-grid-2">
                    <div class="field-group">
                        <label class="field-label" for="mem-nisn">NISN (10 Digit Angka)</label>
                        <input type="text" id="mem-nisn" class="input mono" value="${escapeHtml(existing?.nisn || '')}" maxlength="10" minlength="10" pattern="[0-9]{10}" />
                    </div>
                    <div class="field-group">
                        <label class="field-label" for="mem-kelas">Kelas</label>
                        <input type="text" id="mem-kelas" class="input" value="${escapeHtml(existing?.kelas || '7A')}" maxlength="5" />
                    </div>
                </div>
                <div class="field-group">
                    <label class="field-label" for="mem-angkatan">Tahun Angkatan</label>
                    <input type="number" id="mem-angkatan" class="input mono" min="2000" max="2100" value="${escapeHtml(existing?.tahun_angkatan || 2026)}" />
                </div>
            </div>

            <div id="mem-guru-fields" class="hidden">
                <div class="field-group">
                    <label class="field-label" for="mem-nip">NIP (18 Digit Angka)</label>
                    <input type="text" id="mem-nip" class="input mono" value="${escapeHtml(existing?.nip || '')}" maxlength="18" minlength="18" pattern="[0-9]{18}" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="mem-unit">Unit Kerja / Mata Pelajaran</label>
                    <input type="text" id="mem-unit" class="input" value="${escapeHtml(existing?.unit_kerja_mata_pelajaran || '')}" maxlength="60" />
                </div>
            </div>

            <button type="submit" class="btn btn-primary u-full">${isEdit ? 'Simpan Perubahan' : 'Simpan Anggota'}</button>
        </form>
    `);

    const tipeSel = $('mem-tipe');
    tipeSel.value = curType;
    const syncSubtype = () => {
        const isSiswa = tipeSel.value === 'Siswa';
        $('mem-siswa-fields').classList.toggle('hidden', !isSiswa);
        $('mem-guru-fields').classList.toggle('hidden', isSiswa);
        $('mem-nisn').required = isSiswa;
        $('mem-kelas').required = isSiswa;
        $('mem-angkatan').required = isSiswa;
        $('mem-nip').required = !isSiswa;
    };
    tipeSel.onchange = syncSubtype;
    syncSubtype();

    const form = $('form-member');
    form.onsubmit = (e) => {
        e.preventDefault();
        const tipe = tipeSel.value;
        const nisnVal = $('mem-nisn').value.trim();
        const nipVal = $('mem-nip').value.trim();
        if (tipe === 'Siswa' && !/^\d{10}$/.test(nisnVal)) {
            showToast('NISN harus tepat 10 digit angka.', 'error');
            return;
        }
        if (tipe === 'Guru/Karyawan' && !/^\d{18}$/.test(nipVal)) {
            showToast('NIP harus tepat 18 digit angka.', 'error');
            return;
        }

        const base = {
            id_anggota: $('mem-id').value.trim(),
            nama: $('mem-nama').value.trim(),
            no_telepon: $('mem-telp').value.trim() || null,
            alamat: $('mem-alamat').value.trim() || null,
            tgl_bergabung: $('mem-tgl').value
        };
        const detail = tipe === 'Siswa'
            ? {
                nisn: nisnVal,
                kelas: $('mem-kelas').value.trim(),
                tahun_angkatan: Number($('mem-angkatan').value)
            }
            : {
                nip: nipVal,
                unit_kerja_mata_pelajaran: $('mem-unit').value.trim() || null
            };

        withSubmitLock(form, async () => {
            try {
                if (isEdit) {
                    await window.SmartDB.updateAnggotaLengkap({ id_anggota: editId, base, tipe, detail });
                } else {
                    await window.SmartDB.createAnggotaLengkap({ base, tipe, detail });
                }
                closeModal();
                showToast(isEdit ? 'Data anggota diperbarui.' : 'Anggota baru ditambahkan.', 'success');
                await refreshMembersView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

async function handleDeleteMember(idAnggota, nama) {
    if (!confirm(`Hapus anggota "${nama}" (${idAnggota})?`)) return;
    try {
        await window.SmartDB.deleteAnggota(idAnggota);
        showToast('Anggota dihapus.', 'success');
        await refreshMembersView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function openStafModal(editId = null) {
    const isEdit = Boolean(editId);
    const list = state.stafCache.length ? state.stafCache : await window.SmartDB.getStafList();
    const existing = isEdit ? list.find((s) => s.id_staf === editId) : null;
    const nextId = isEdit ? editId : await window.SmartDB.nextId('staf', 'id_staf', 'S', 3);

    openModal(isEdit ? `Edit Staf ${editId}` : 'Tambah Staf Perpustakaan', `
        <form id="form-staf">
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="staf-id">ID Staf</label>
                    <input type="text" id="staf-id" class="input mono" value="${escapeHtml(nextId)}" ${isEdit ? 'readonly' : 'required'} maxlength="10" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="staf-user">Username</label>
                    <input type="text" id="staf-user" class="input" value="${escapeHtml(existing?.username || '')}" required minlength="3" maxlength="30" />
                </div>
            </div>
            <div class="field-group">
                <label class="field-label" for="staf-jabatan">Jabatan</label>
                <input type="text" id="staf-jabatan" class="input" value="${escapeHtml(existing?.jabatan || '')}" required maxlength="50" />
            </div>
            <div class="form-grid-2">
                <div class="field-group">
                    <label class="field-label" for="staf-pass">${isEdit ? 'Password Baru (Opsional, min 8 karakter)' : 'Password (min 8 karakter)'}</label>
                    <input type="password" id="staf-pass" class="input" ${isEdit ? '' : 'required'} minlength="8" placeholder="${isEdit ? 'Kosongkan jika tetap' : 'Minimal 8 karakter'}" />
                </div>
                <div class="field-group">
                    <label class="field-label" for="staf-sup">Supervisor (Relasi Rekursif)</label>
                    <select id="staf-sup" class="select">
                        <option value="">(Tidak Ada / Kepala Perpustakaan)</option>
                        ${list.filter((s) => s.id_staf !== editId).map((s) => `<option value="${escapeHtml(s.id_staf)}">${escapeHtml(s.id_staf)} — ${escapeHtml(s.jabatan)}</option>`).join('')}
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary u-full">${isEdit ? 'Simpan Perubahan' : 'Tambah Staf'}</button>
        </form>
    `);
    if (existing) $('staf-sup').value = existing.id_supervisor || '';

    const form = $('form-staf');
    form.onsubmit = (e) => {
        e.preventDefault();
        const passwordVal = $('staf-pass').value;
        if (passwordVal && passwordVal.length < 8) {
            showToast('Password staf minimal 8 karakter.', 'error');
            return;
        }
        withSubmitLock(form, async () => {
            try {
                await window.SmartDB.saveStaf({
                    id_staf: $('staf-id').value.trim(),
                    username: $('staf-user').value.trim(),
                    jabatan: $('staf-jabatan').value.trim(),
                    password: passwordVal || null,
                    id_supervisor: $('staf-sup').value || null
                }, isEdit);
                closeModal();
                showToast(isEdit ? 'Data staf diperbarui.' : 'Staf baru ditambahkan.', 'success');
                await refreshStafTable();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };
}

async function handleDeleteStaf(idStaf) {
    if (!confirm(`Hapus staf ${idStaf}?`)) return;
    try {
        await window.SmartDB.deleteStaf(idStaf);
        showToast('Staf dihapus.', 'success');
        await refreshStafTable();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==================== TAB 4: SANKSI & DENDA ====================
async function refreshFinesView() {
    await refreshDashboardMetrics();

    if (!isStaff() && !isMember()) {
        $('fines-toolbar').classList.add('hidden');
        $('fines-table-wrap').classList.add('hidden');
        $('fines-guest-lock').classList.remove('hidden');
        return;
    }

    $('fines-guest-lock').classList.add('hidden');
    $('fines-toolbar').classList.remove('hidden');
    $('fines-table-wrap').classList.remove('hidden');

    const scopedMemberId = isMember() ? state.auth.user.id_anggota : null;
    const rows = await window.SmartDB.getDendaList({
        statusFilter: state.fineFilter,
        idAnggota: scopedMemberId
    });

    const totalNominal = rows.reduce((s, r) => s + Number(r.jumlah_denda || 0), 0);
    $('fines-summary-text').textContent = `${rows.length} catatan • Total ${formatRupiah(totalNominal)}`;

    const tbody = $('fines-tbody');
    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="u-center u-muted">Tidak ada data sanksi atau denda.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((d) => `
        <tr>
            <td class="mono u-bold">${escapeHtml(d.id_denda)}</td>
            <td><strong>${escapeHtml(d.nama_anggota)}</strong><div class="mono cell-sub">${escapeHtml(d.id_anggota)}</div></td>
            <td class="mono">${escapeHtml(d.id_peminjaman)} / ${escapeHtml(d.id_pengembalian)}</td>
            <td>${escapeHtml(d.jenis_sanksi)}</td>
            <td class="mono u-bold">${formatRupiah(d.jumlah_denda)}</td>
            <td>
                ${statusBadge(d.status_pembayaran)}
                ${d.tgl_bayar ? `<div class="mono cell-sub">${escapeHtml(d.tgl_bayar)}</div>` : ''}
            </td>
            <td>
                ${isStaff() && d.status_pembayaran === 'Belum Lunas'
                    ? `<button type="button" class="btn btn-sm btn-primary" data-action="pay-fine" data-id="${escapeHtml(d.id_denda)}">Tandai Lunas</button>`
                    : '—'}
            </td>
        </tr>
    `).join('');
}

async function handlePayFine(idDenda) {
    try {
        await window.SmartDB.bayarDenda(idDenda);
        showToast(`Denda ${idDenda} ditandai Lunas.`, 'success');
        await refreshFinesView();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ==================== TAB 5: MISSION OBJECTIVES & LAPORAN ====================
function renderMissionResult(title, sqlText, rows, elapsedMs) {
    $('mo-result-box').classList.remove('hidden');
    $('mo-result-title').textContent = title;
    $('mo-result-meta').textContent = `${rows.length} baris • ${elapsedMs.toFixed(1)} ms`;
    $('mo-sql-preview').textContent = sqlText;

    const container = $('mo-result-table');
    if (!rows || rows.length === 0) {
        container.innerHTML = '<div class="empty-hint u-center">Query mengembalikan 0 baris.</div>';
        return;
    }
    const cols = Object.keys(rows[0]);
    container.innerHTML = `
        <table class="data-table">
            <thead><tr>${cols.map((c) => `<th class="mono">${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>
                ${rows.map((r) => `<tr>${cols.map((c) => `<td class="mono">${escapeHtml(r[c] ?? '—')}</td>`).join('')}</tr>`).join('')}
            </tbody>
        </table>
    `;
}

async function runMissionObjective(num) {
    if (num !== 2 && !isStaff() && !isMember()) {
        showToast('Query ini mengakses data anggota/transaksi. Silakan login terlebih dahulu.', 'error');
        openLoginModal();
        return;
    }
    if ((num === 1 || num === 3) && !isStaff()) {
        showToast('Mission Objective 1 & 3 memuat data anggota sekolah dan hanya dapat dijalankan oleh Staf.', 'error');
        return;
    }

    const t0 = performance.now();
    try {
        if (num === 1) {
            const q = $('mo1-input').value;
            const rows = await window.SmartDB.mission1CariAnggota(q);
            renderMissionResult(
                'Mission Objective 1: Pencarian Anggota',
                `-- Parameter $1 = ${JSON.stringify(q)}\nSELECT a.id_anggota, a.nama, s.nisn, gk.nip\nFROM anggota a\nLEFT JOIN siswa s ON a.id_anggota = s.id_anggota\nLEFT JOIN guru_karyawan gk ON a.id_anggota = gk.id_anggota\nWHERE s.nisn = $1 OR gk.nip = $1 OR a.nama ILIKE ('%' || $1 || '%');`,
                rows,
                performance.now() - t0
            );
        } else if (num === 2) {
            const q = $('mo2-input').value;
            const rows = await window.SmartDB.mission2CariBuku(q);
            renderMissionResult(
                'Mission Objective 2: Pencarian Katalog Buku',
                `-- Parameter $1 = ${JSON.stringify(q)}\nSELECT id_buku, isbn, judul, penerbit, tahun_terbit\nFROM katalog_buku\nWHERE judul ILIKE ('%' || $1 || '%')\n   OR penerbit ILIKE ('%' || $1 || '%')\n   OR isbn ILIKE ('%' || $1 || '%');`,
                rows,
                performance.now() - t0
            );
        } else if (num === 3) {
            const tgl = $('mo3-input').value;
            const rows = await window.SmartDB.mission3PeminjamanTanggal(tgl);
            renderMissionResult(
                'Mission Objective 3: Peminjaman Aktif per Tanggal Pinjam',
                `-- Parameter $1 = ${JSON.stringify(tgl)}\nSELECT id_peminjaman, id_anggota, tgl_pinjam, tgl_jatuh_tempo, status_peminjaman\nFROM peminjaman\nWHERE status_peminjaman IN ('Dipinjam', 'Terlambat')\n  AND tgl_pinjam = $1::date;`,
                rows,
                performance.now() - t0
            );
        } else if (num === 4) {
            const idOrNama = isMember() ? state.auth.user.id_anggota : $('mo4-input').value;
            const rows = await window.SmartDB.mission4PeminjamanAnggota(idOrNama);
            renderMissionResult(
                'Mission Objective 4: Peminjaman Aktif per Identitas Anggota',
                `-- Parameter $1 = ${JSON.stringify(idOrNama)}\nSELECT p.id_peminjaman, a.id_anggota, a.nama, p.tgl_pinjam, p.status_peminjaman\nFROM peminjaman p\nJOIN anggota a ON p.id_anggota = a.id_anggota\nWHERE p.status_peminjaman IN ('Dipinjam', 'Terlambat')\n  AND (a.id_anggota = $1 OR a.nama ILIKE ('%' || $1 || '%'));`,
                rows,
                performance.now() - t0
            );
        } else if (num === 5) {
            const rows = isMember()
                ? await window.SmartDB.getDendaList({
                    statusFilter: 'Belum Lunas',
                    idAnggota: state.auth.user.id_anggota
                })
                : await window.SmartDB.mission5DendaBelumLunas();
            renderMissionResult(
                'Mission Objective 5: Riwayat Denda Belum Diselesaikan',
                `SELECT sd.id_denda, a.nama, sd.jenis_sanksi, sd.jumlah_denda, sd.status_pembayaran\nFROM sanksi_denda sd\nJOIN pengembalian pg ON sd.id_pengembalian = pg.id_pengembalian\nJOIN peminjaman p ON pg.id_peminjaman = p.id_peminjaman\nJOIN anggota a ON p.id_anggota = a.id_anggota\nWHERE sd.status_pembayaran = 'Belum Lunas';`,
                rows,
                performance.now() - t0
            );
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function refreshReportsView() {
    const rep = await window.SmartDB.getLaporanStatistik();
    const isGuest = !isStaff() && !isMember();
    const overdueCount = Number(rep.overdueCount ?? rep.overdueList?.length ?? 0);
    $('report-kas-summary').innerHTML = isGuest
        ? `<div><strong>Status Laporan Keuangan &amp; Overdue:</strong> Informasi agregat transaksi tersedia penuh setelah Staf masuk.</div>`
        : `<div><strong>Total Kas Denda Lunas:</strong> <span class="mono">${formatRupiah(rep.totalKasLunas)}</span> (${rep.lunasCount} transaksi lunas)</div>
           <div><strong>Peminjaman Perlu Perhatian (Overdue):</strong> <span class="mono">${overdueCount}</span> transaksi</div>`;

    $('report-top-books').innerHTML = rep.topBooks.length === 0
        ? '<div class="u-muted">Belum ada riwayat sirkulasi buku.</div>'
        : `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Buku</th><th>Kategori</th><th>Sirkulasi</th></tr></thead>
            <tbody>
                ${rep.topBooks.map((b) => `
                    <tr>
                        <td><strong>${escapeHtml(b.judul)}</strong> <span class="mono cell-sub">(${escapeHtml(b.id_buku)})</span></td>
                        <td>${escapeHtml(b.kategori)}</td>
                        <td class="mono u-bold">${Number(b.jumlah_sirkulasi)}x</td>
                    </tr>
                `).join('')}
            </tbody>
        </table></div>`;

    $('report-table-counts').innerHTML = rep.tableCounts.map((t) =>
        `<div class="count-row">
            <span>${escapeHtml(t.table)}</span>
            <strong>${Number(t.count)} baris</strong>
        </div>`
    ).join('');
}

// ==================== EVENT BINDINGS & INIT ====================
function bindEvents() {
    $('theme-toggle-btn').onclick = () => {
        const cur = document.documentElement.getAttribute('data-theme');
        applyTheme(cur === 'dark' ? 'light' : 'dark');
    };

    $('btn-open-login').onclick = openLoginModal;
    const mobileLoginBtn = $('btn-open-login-mobile');
    if (mobileLoginBtn) mobileLoginBtn.onclick = openLoginModal;

    $('btn-close-modal').onclick = closeModal;
    $('btn-close-drawer').onclick = closeDrawer;
    $('app-modal').onclick = (e) => { if (e.target === $('app-modal')) closeModal(); };
    $('detail-drawer').onclick = (e) => { if (e.target === $('detail-drawer')) closeDrawer(); };

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!$('app-modal').classList.contains('hidden')) {
            closeModal();
        } else if (!$('detail-drawer').classList.contains('hidden')) {
            closeDrawer();
        }
    });

    // Delegasi aksi terpusat (tanpa inline onclick)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'open-login') {
            openLoginModal();
        } else if (action === 'select-loan') {
            selectLoanForReturn(btn.dataset.id);
        } else if (action === 'open-inventaris') {
            openInventarisDrawer(btn.dataset.id, btn.dataset.title);
        } else if (action === 'edit-katalog') {
            openKatalogModal(btn.dataset.id);
        } else if (action === 'delete-katalog') {
            handleDeleteKatalog(btn.dataset.id, btn.dataset.title);
        } else if (action === 'edit-copy') {
            openEditCopyModal(btn.dataset.id, Number(btn.dataset.no), btn.dataset.avail, btn.dataset.cond);
        } else if (action === 'delete-copy') {
            handleDeleteCopy(btn.dataset.id, Number(btn.dataset.no), btn.dataset.title);
        } else if (action === 'delete-kategori') {
            handleDeleteKategori(btn.dataset.id);
        } else if (action === 'edit-member') {
            openMemberModal(btn.dataset.id);
        } else if (action === 'delete-member') {
            handleDeleteMember(btn.dataset.id, btn.dataset.name);
        } else if (action === 'edit-staf') {
            openStafModal(btn.dataset.id);
        } else if (action === 'delete-staf') {
            handleDeleteStaf(btn.dataset.id);
        } else if (action === 'pay-fine') {
            handlePayFine(btn.dataset.id);
        }
    });

    document.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.onclick = () => switchTab(btn.dataset.tab);
    });

    // Sub-tabs Sirkulasi
    document.querySelectorAll('[data-circ-subtab]').forEach((btn) => {
        btn.onclick = () => {
            state.circSubtab = btn.dataset.circSubtab;
            document.querySelectorAll('[data-circ-subtab]').forEach((b) => b.classList.toggle('active', b === btn));
            refreshCirculationView();
        };
    });

    document.querySelectorAll('[data-loan-filter]').forEach((btn) => {
        btn.onclick = () => {
            state.loanFilter = btn.dataset.loanFilter;
            document.querySelectorAll('[data-loan-filter]').forEach((b) => b.classList.toggle('active', b === btn));
            refreshCirculationView();
        };
    });

    $('circ-search-input').oninput = debounce(() => refreshCirculationView(), 250);
    $('catalog-search-input').oninput = debounce(() => refreshCatalogView(), 250);
    $('catalog-kategori-filter').onchange = () => refreshCatalogView();
    $('member-type-filter').onchange = () => refreshMembersView();
    $('member-search-input').oninput = debounce(() => refreshMembersView(), 250);

    document.querySelectorAll('[data-member-subtab]').forEach((btn) => {
        btn.onclick = () => {
            state.memberSubtab = btn.dataset.memberSubtab;
            document.querySelectorAll('[data-member-subtab]').forEach((b) => b.classList.toggle('active', b === btn));
            refreshMembersView();
        };
    });

    document.querySelectorAll('[data-fine-filter]').forEach((btn) => {
        btn.onclick = () => {
            state.fineFilter = btn.dataset.fineFilter;
            document.querySelectorAll('[data-fine-filter]').forEach((b) => b.classList.toggle('active', b === btn));
            refreshFinesView();
        };
    });

    $('btn-open-categories').onclick = openCategoriesModal;
    $('btn-open-add-katalog').onclick = () => openKatalogModal(null);
    $('btn-open-add-member').onclick = () => openMemberModal(null);
    $('btn-open-add-staf').onclick = () => openStafModal(null);

    // Form Peminjaman Baru
    const formNewLoan = $('form-new-loan');
    formNewLoan.onsubmit = (e) => {
        e.preventDefault();
        if (!isStaff()) return;
        const tglPinjam = $('loan-tgl-pinjam').value;
        const tglTempo = $('loan-tgl-tempo').value;
        if (!tglPinjam || !tglTempo || tglTempo < tglPinjam) {
            showToast('Tanggal jatuh tempo tidak boleh lebih awal dari tanggal pinjam.', 'error');
            return;
        }
        const selectedCopies = Array.from(document.querySelectorAll('.chk-borrow-copy:checked')).map((el) => ({
            id_buku: el.dataset.idBuku,
            no_eksemplar: Number(el.dataset.no)
        }));
        if (selectedCopies.length === 0) {
            showToast('Pilih minimal 1 eksemplar buku yang tersedia.', 'error');
            return;
        }
        withSubmitLock(formNewLoan, async () => {
            try {
                await window.SmartDB.createPeminjaman({
                    id_peminjaman: $('loan-id-input').value.trim(),
                    tgl_pinjam: tglPinjam,
                    tgl_jatuh_tempo: tglTempo,
                    id_anggota: $('loan-member-select').value,
                    id_staf: state.auth.user.id_staf,
                    copies: selectedCopies
                });
                showToast('Transaksi peminjaman tercatat.', 'success');
                await refreshCirculationView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    // Form Pengembalian
    $('return-loan-select').onchange = recomputeLateDays;
    $('return-tgl-kembali').onchange = recomputeLateDays;
    $('return-apply-fine-chk').onchange = () => {
        $('return-fine-fields').classList.toggle('hidden', !$('return-apply-fine-chk').checked);
    };

    const formNewReturn = $('form-new-return');
    formNewReturn.onsubmit = (e) => {
        e.preventDefault();
        if (!isStaff()) return;
        const idPeminjaman = $('return-loan-select').value;
        if (!idPeminjaman) {
            showToast('Tidak ada transaksi peminjaman aktif yang dipilih.', 'error');
            return;
        }
        const items = Array.from(document.querySelectorAll('.chk-return-copy:checked')).map((el) => {
            const key = `${el.dataset.idBuku}#${el.dataset.no}`;
            const condEl = document.querySelector(`.ret-copy-cond[data-key="${CSS.escape(key)}"]`);
            return {
                id_buku: el.dataset.idBuku,
                no_eksemplar: Number(el.dataset.no),
                kondisi_fisik: condEl ? condEl.value : 'Baik'
            };
        });
        if (items.length === 0) {
            showToast('Pilih minimal 1 eksemplar yang dikembalikan.', 'error');
            return;
        }
        const applyFine = $('return-apply-fine-chk').checked;
        const denda = applyFine ? {
            id_denda: $('return-denda-id').value.trim(),
            jenis_sanksi: $('return-denda-jenis').value.trim() || 'Denda Keterlambatan',
            jumlah_denda: Number($('return-denda-jumlah').value || 0),
            status_pembayaran: 'Belum Lunas'
        } : null;

        withSubmitLock(formNewReturn, async () => {
            try {
                await window.SmartDB.processPengembalian({
                    id_pengembalian: $('return-id-input').value.trim(),
                    id_peminjaman: idPeminjaman,
                    tgl_kembali: $('return-tgl-kembali').value,
                    hari_terlambat: Number($('return-hari-terlambat').value || 0),
                    items,
                    denda
                });
                $('return-apply-fine-chk').checked = false;
                $('return-fine-fields').classList.add('hidden');
                showToast('Pengembalian & detail buku tersimpan.', 'success');
                await refreshCirculationView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    };

    // Mission Objectives
    $('btn-run-mo1').onclick = () => runMissionObjective(1);
    $('btn-run-mo2').onclick = () => runMissionObjective(2);
    $('btn-run-mo3').onclick = () => runMissionObjective(3);
    $('btn-run-mo4').onclick = () => runMissionObjective(4);
    $('btn-run-mo5').onclick = () => runMissionObjective(5);
    $('btn-refresh-reports').onclick = () => refreshReportsView();

    // Schema setup helper buttons
    $('btn-recheck-schema').onclick = async () => {
        try {
            const status = await window.SmartDB.checkSchema();
            updateConnectionStatus(status);
            if (status.schemaReady) {
                showToast('11 tabel terdeteksi! Memuat data...', 'success');
                await refreshAll();
            } else {
                showToast('Tabel belum ditemukan di Supabase.', 'error');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    $('btn-copy-schema-sql').onclick = async () => {
        try {
            const res = await fetch(document.body.dataset.schemaUrl || 'database/schema.sql');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const sqlText = await res.text();
            await navigator.clipboard.writeText(sqlText);
            showToast('Isi database/schema.sql disalin ke clipboard! Tempel di SQL Editor Supabase.', 'success');
        } catch (_) {
            showToast('Buka file database/schema.sql di folder proyek, lalu salin isinya ke SQL Editor Supabase.', 'info');
        }
    };
}

function updateConnectionStatus(status) {
    const dot = $('db-status-dot');
    const txt = $('db-status-text');
    const banner = $('schema-setup-banner');

    dot.classList.remove('is-connected', 'is-warning', 'is-error');
    if (status.connected && status.schemaReady) {
        dot.classList.add('is-connected');
        txt.textContent = 'Supabase Connected';
        banner.classList.add('hidden');
    } else if (status.connected) {
        dot.classList.add('is-warning');
        txt.textContent = 'Schema Belum Dipasang';
        banner.classList.remove('hidden');
    } else {
        dot.classList.add('is-error');
        txt.textContent = 'Koneksi Gagal';
    }
}

async function refreshAll() {
    syncRoleUI();
    if (!window.SmartDB.schemaReady) return;
    await refreshCurrentTab();
}

document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    window.SmartDB.onSessionExpired = () => {
        saveSession(null);
        syncRoleUI();
        if (state.activeTab === 'circulation' || state.activeTab === 'members' || state.activeTab === 'fines') {
            switchTab('catalog');
        }
    };
    loadSession();
    state.activeTab = state.auth ? 'circulation' : 'catalog';
    bindEvents();
    syncRoleUI();
    switchTab(state.activeTab);

    try {
        const status = await window.SmartDB.init();
        updateConnectionStatus(status);
        if (status.schemaReady) {
            await refreshAll();
        }
    } catch (err) {
        updateConnectionStatus({ connected: false, schemaReady: false });
        showToast(err.message, 'error');
    }
});
