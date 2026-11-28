/* =====================================================================
 * PANTAU SE — KONTROL AKSES 4 ROLE, NAVIGASI HP, DRAWER SUB-MENU,
 *             GLOBAL SEARCHING, & HALAMAN PROFIL
 *
 * 4 Role Akses:
 *   1. admin    : Full akses (termasuk Master Data & Atur PIC Roster)
 *   2. gl       : Semua menu operasional KECUALI Master Data; Roster ikut PIC
 *   3. section  : Sama seperti GL (tanpa Master Data; Roster ikut PIC)
 *   4. karyawan : Manpower (hanya Beranda, KPI SE, Roster, & Profil — desktop & HP)
 * ===================================================================== */

const profilMenuOpenState = {}; // { [menuKey]: boolean }

function getNormalizedAccessRole() {
    const actor = (typeof getCurrentRosterActor === 'function')
        ? getCurrentRosterActor()
        : null;
    if (actor && actor.type) {
        const t = String(actor.type).toLowerCase();
        if (t === 'admin' || t === 'gl' || t === 'section') return t;
        return 'karyawan';
    }
    const prof = (typeof getActiveUserProfile === 'function') ? getActiveUserProfile() : null;
    const t = String(prof?.type || 'karyawan').toLowerCase();
    if (t === 'admin' || t === 'gl' || t === 'section') return t;
    return 'karyawan';
}

function getAccessRoleMeta(role = getNormalizedAccessRole()) {
    switch (role) {
        case 'admin':
            return {
                key: 'admin',
                label: 'Admin',
                fullLabel: 'Admin — Full Akses',
                badgeCls: 'bg-teal-50 text-teal-700 border-teal-200',
                heroBadgeCls: 'bg-white/15 text-emerald-100 border-white/25',
                icon: 'fa-shield-halved'
            };
        case 'gl':
            return {
                key: 'gl',
                label: 'Group Leader (GL)',
                fullLabel: 'Group Leader (GL)',
                badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                heroBadgeCls: 'bg-indigo-400/25 text-indigo-100 border-indigo-300/35',
                icon: 'fa-user-tie'
            };
        case 'section':
            return {
                key: 'section',
                label: 'Section',
                fullLabel: 'Section Head',
                badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
                heroBadgeCls: 'bg-purple-400/25 text-purple-100 border-purple-300/35',
                icon: 'fa-user-shield'
            };
        default:
            return {
                key: 'karyawan',
                label: 'Manpower',
                fullLabel: 'Manpower SE',
                badgeCls: 'bg-sky-50 text-sky-700 border-sky-200',
                heroBadgeCls: 'bg-sky-400/25 text-sky-100 border-sky-300/35',
                icon: 'fa-hard-hat'
            };
    }
}

function isRealAdminLoggedIn() {
    const authSess = (typeof getPantauAuthSession === 'function') ? getPantauAuthSession() : null;
    if (authSess && authSess.loggedIn) {
        return String(authSess.type || '').toLowerCase() === 'admin';
    }
    return getNormalizedAccessRole() === 'admin';
}

function isDesktopViewport() {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
}

function resolveAllowedNavigationTarget(section, subSection = null) {
    const role = getNormalizedAccessRole();
    const sec = String(section || 'informasi');
    const sub = subSection ? String(subSection) : '';

    // Menu Profil hanya untuk mode HP (di desktop semua menu sudah terlihat di sidebar)
    if (sec === 'profil' && isDesktopViewport()) {
        return { section: 'informasi', subSection: '', redirected: true, reason: '' };
    }

    if (role === 'admin') {
        return { section: sec, subSection: sub, redirected: false };
    }

    if (role === 'gl' || role === 'section') {
        if (sec === 'master') {
            return { section: 'informasi', subSection: '', redirected: true, reason: 'Menu Master Data khusus untuk akses Admin.' };
        }
        return { section: sec, subSection: sub, redirected: false };
    }

    // Manpower (karyawan): hanya Beranda, KPI SE, Roster, dan Profil (HP)
    const allowedManpowerSections = ['informasi', 'dashboard', 'roster', 'profil'];
    if (!allowedManpowerSections.includes(sec)) {
        return { section: 'informasi', subSection: '', redirected: true, reason: 'Akses Manpower hanya mencakup Beranda, KPI SE, Roster, dan Profil.' };
    }
    if (sec === 'dashboard' && sub && sub !== 'kpi-se') {
        return { section: 'dashboard', subSection: 'kpi-se', redirected: true, reason: 'Pada akses Manpower, Dashboard yang tersedia adalah KPI SE.' };
    }
    return { section: sec, subSection: sub, redirected: false };
}

function getSectionSubMenusForRole(section, role = getNormalizedAccessRole()) {
    const map = {
        dashboard: role === 'karyawan'
            ? []
            : [
                { key: 'kpi-se', label: 'KPI SE', icon: 'fa-gauge-high' },
                { key: 'kpi-pengawas', label: 'KPI Pengawas', icon: 'fa-user-tie' },
                { key: 'dokumen-analisis', label: 'Dokumen Analisis', icon: 'fa-file-shield', badgeId: 'sidebar-warning-badge' }
            ],
        performa: role === 'karyawan'
            ? []
            : [
                { key: 'atr', label: 'Data ATR', icon: 'fa-clipboard-check' },
                { key: 'absensi', label: 'Data Absensi Harian', icon: 'fa-user-clock' },
                { key: 'input-kpi-pengawas', label: 'Input KPI Pengawas', icon: 'fa-pen-to-square' }
            ],
        utilitas: role === 'karyawan'
            ? []
            : [
                { key: 'hm', label: 'HM & UA', icon: 'fa-stopwatch' },
                { key: 'rental', label: 'Rental BIB', icon: 'fa-file-invoice-dollar' },
                { key: 'crane', label: 'Time Frame Big Crane', icon: 'fa-tower-observation' },
                { key: 'komisioning', label: 'Data Komisioning Unit', icon: 'fa-truck-monster' }
            ],
        operasional: role === 'karyawan'
            ? []
            : [
                { key: 'lt-wt', label: 'Lubetruck / Watertruck', icon: 'fa-oil-can' },
                { key: 'lifting', label: 'Lifting', icon: 'fa-dolly' }
            ],
        roster: [
            { key: 'roster-all', label: 'Roster ALL', icon: 'fa-table-cells' },
            { key: 'roster-personal', label: 'Roster Personal', icon: 'fa-calendar-day' },
            { key: 'roster-daily', label: 'Roster Daily', icon: 'fa-clipboard-list' }
        ],
        master: role === 'admin'
            ? [
                { key: 'manpower', label: 'Nama Manpower', icon: 'fa-users' },
                { key: 'jabatan', label: 'Jabatan', icon: 'fa-briefcase' },
                { key: 'perusahaan', label: 'Perusahaan', icon: 'fa-building' },
                { key: 'unit', label: 'Unit, HM & Rental Rate', icon: 'fa-truck-monster' },
                { key: 'kode-roster', label: 'Kode Roster', icon: 'fa-calendar-check' },
                { key: 'kode-spi', label: 'Kode SPI', icon: 'fa-shield' }
            ]
            : []
    };
    return map[section] || [];
}

function getSectionDisplayMeta(section, role = getNormalizedAccessRole()) {
    const meta = {
        informasi: { title: 'Beranda', icon: 'fa-house' },
        dashboard: { title: role === 'karyawan' ? 'KPI SE' : 'Dashboard', icon: 'fa-chart-pie' },
        manpower: { title: 'Data Manpower', icon: 'fa-id-card-clip' },
        performa: { title: 'Performa Manpower', icon: 'fa-chart-line' },
        utilitas: { title: 'Utilitas & Operasi Unit', icon: 'fa-gears' },
        operasional: { title: 'Operasional SE', icon: 'fa-truck-fast' },
        roster: { title: 'Roster SE', icon: 'fa-calendar-days' },
        master: { title: 'Master Data', icon: 'fa-database' },
        searching: { title: 'Searching', icon: 'fa-magnifying-glass' },
        profil: { title: 'Profil', icon: 'fa-user' }
    };
    return meta[section] || { title: 'Menu', icon: 'fa-bars' };
}

function handleDesktopDashboardClick() {
    const role = getNormalizedAccessRole();
    if (role === 'karyawan') {
        navigateTo('dashboard', 'kpi-se');
        return;
    }
    toggleSidebarDropdown('dashboard');
}

/* =====================================================================
 * 1. SINKRONISASI SIDEBAR DESKTOP & HEADER SESUAI 4 ROLE
 * ===================================================================== */

function syncDesktopSidebarForRole(role = getNormalizedAccessRole()) {
    const isAdmin = role === 'admin';
    const isManpower = role === 'karyawan';

    const setVis = (id, show) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !show);
    };

    // Menu utama desktop (Profil tidak ditampilkan di desktop, khusus mode HP)
    setVis('sidebar-btn-informasi', true);
    setVis('sidebar-group-dashboard', true);
    setVis('sidebar-btn-manpower', !isManpower);
    setVis('sidebar-group-performa', !isManpower);
    setVis('sidebar-group-utilitas', !isManpower);
    setVis('sidebar-group-operasional', !isManpower);
    setVis('sidebar-group-roster', true);
    setVis('sidebar-btn-master', isAdmin);

    // Dashboard pada akses Manpower langsung menjadi KPI SE tanpa submenu
    const dashLabel = document.getElementById('sidebar-dashboard-label');
    const dashChev = document.getElementById('dashboard-chevron');
    const dashSub = document.getElementById('dashboard-submenu');
    if (dashLabel) dashLabel.textContent = isManpower ? 'KPI SE' : 'Dashboard';
    if (dashChev) dashChev.classList.toggle('hidden', isManpower);
    if (dashSub && isManpower) dashSub.classList.add('hidden');

    // Ikon bel Dokumen Analisis di header (tidak untuk Manpower)
    setVis('btn-header-dokumen-bell', !isManpower);
}

/* =====================================================================
 * 2. MOBILE BOTTOM NAVIGATION BAR & TOP-RIGHT SUB-MENU SIDEBAR DRAWER
 * ===================================================================== */

function getMobileDockItemsForRole(role = getNormalizedAccessRole()) {
    if (role === 'karyawan') {
        return [
            { id: 'informasi', label: 'Beranda', icon: 'fa-house', section: 'informasi', sub: '' },
            { id: 'dashboard', label: 'KPI SE', icon: 'fa-chart-pie', section: 'dashboard', sub: 'kpi-se' },
            { id: 'roster', label: 'Roster', icon: 'fa-calendar-days', section: 'roster', sub: 'roster-all' },
            { id: 'profil', label: 'Profil', icon: 'fa-user', section: 'profil', sub: '' }
        ];
    }
    return [
        { id: 'informasi', label: 'Beranda', icon: 'fa-house', section: 'informasi', sub: '' },
        { id: 'dashboard', label: 'KPI', icon: 'fa-chart-pie', section: 'dashboard', sub: 'kpi-se' },
        { id: 'manpower', label: 'Manpower', icon: 'fa-id-card-clip', section: 'manpower', sub: '' },
        { id: 'searching', label: 'Searching', icon: 'fa-magnifying-glass', section: 'searching', sub: '' },
        { id: 'profil', label: 'Profil', icon: 'fa-user', section: 'profil', sub: '' }
    ];
}

function updateMobileNavigationUi(activeSection = currentSection, activeSub = currentSubSection) {
    const role = getNormalizedAccessRole();
    const grid = document.getElementById('mobile-bottom-nav-grid');
    if (grid) {
        const items = getMobileDockItemsForRole(role);
        const overflowSections = ['performa', 'utilitas', 'operasional', 'roster', 'master'];
        const highlightedTab = (role !== 'karyawan' && overflowSections.includes(activeSection))
            ? 'profil'
            : activeSection;

        const dockEl = document.getElementById('mobile-bottom-nav-dock');
        if (dockEl) {
            dockEl.classList.toggle('is-4-cols', items.length === 4);
        }

        grid.className = `relative z-[1] grid ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-5'} items-center gap-0.5`;
        grid.innerHTML = items.map(item => {
            const isAct = highlightedTab === item.id;
            const btnCls = isAct
                ? 'mob-nav-btn is-active flex flex-col items-center justify-center py-1.5 px-0.5 rounded-full bg-gradient-to-b from-[#1E826E] to-[#146555] text-white shadow-md shadow-teal-700/25 transition-all duration-200 focus:outline-none'
                : 'mob-nav-btn flex flex-col items-center justify-center py-1.5 px-0.5 rounded-full bg-transparent text-gray-600 hover:bg-white/45 hover:text-gray-900 transition-all duration-200 focus:outline-none';
            const iconCls = isAct
                ? 'mob-nav-icon flex items-center justify-center text-white transition-transform duration-200 scale-105'
                : 'mob-nav-icon flex items-center justify-center text-gray-500 transition-transform duration-200';
            const lblCls = isAct
                ? 'mob-nav-label text-[8px] font-bold text-white leading-none mt-1 truncate max-w-full transition-colors'
                : 'mob-nav-label text-[8px] font-semibold text-gray-600 leading-none mt-1 truncate max-w-full transition-colors';
            const onclickCall = item.sub
                ? `navigateTo('${item.section}', '${item.sub}')`
                : `navigateTo('${item.section}')`;

            const unreadInfoCount = (item.id === 'informasi' && typeof getUnreadInformasiCount === 'function')
                ? getUnreadInformasiCount()
                : 0;
            const mobBadgeHtml = item.id === 'informasi'
                ? `<span id="mobile-informasi-badge" class="${unreadInfoCount > 0 ? 'inline-flex' : 'hidden'} items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-bold leading-none absolute -top-1.5 -right-2.5 ${isAct ? 'bg-white text-teal-700' : 'bg-teal-600 text-white'} shadow-xs">${unreadInfoCount > 99 ? '99+' : (unreadInfoCount > 0 ? unreadInfoCount : '')}</span>`
                : '';

            return `
                <button type="button" onclick="${onclickCall}" data-mobnav="${item.id}" class="${btnCls}">
                    <span class="${iconCls} relative">
                        <i class="fa-solid ${item.icon} text-[13.5px]"></i>
                        ${mobBadgeHtml}
                    </span>
                    <span class="${lblCls}">${escapeHtml(item.label)}</span>
                </button>
            `;
        }).join('');
    }

    // Tombol Sidebar Sub-Menu di Pojok Kanan Atas HP (tampil HANYA jika menu aktif punya sub-menu)
    const subMenus = getSectionSubMenusForRole(activeSection, role);
    const subBtn = document.getElementById('btn-mobile-submenu-drawer');
    if (subBtn) {
        const showBtn = subMenus.length > 0;
        subBtn.classList.toggle('hidden', !showBtn);
        subBtn.classList.toggle('flex', showBtn);
        if (showBtn) {
            const secMeta = getSectionDisplayMeta(activeSection, role);
            subBtn.title = `Sub-menu ${secMeta.title}`;
        }
    }

    // Jika drawer sub-menu sedang terbuka, perbarui isinya agar selalu sinkron
    const drawer = document.getElementById('mobile-submenu-drawer');
    if (drawer && !drawer.classList.contains('hidden')) {
        if (subMenus.length === 0) closeMobileSubmenuDrawer();
        else renderMobileSubmenuDrawerContent(activeSection, activeSub);
    }

    // Tutup tray aksi panah > dan filter slide jika sedang berpindah halaman
    if (typeof closeAllMobileActionGroups === 'function') closeAllMobileActionGroups();
    if (typeof closeMobileFilterDrawer === 'function') closeMobileFilterDrawer(true);
    if (typeof syncMobileActionGroupVisibility === 'function') syncMobileActionGroupVisibility();
    if (typeof syncMobileDockScrollState === 'function') syncMobileDockScrollState();
}

function renderMobileSubmenuDrawerContent(section = currentSection, subSection = currentSubSection) {
    const role = getNormalizedAccessRole();
    const subMenus = getSectionSubMenusForRole(section, role);
    const secMeta = getSectionDisplayMeta(section, role);

    const titleEl = document.getElementById('mobile-submenu-drawer-title');
    const iconEl = document.getElementById('mobile-submenu-drawer-icon');
    const listEl = document.getElementById('mobile-submenu-drawer-list');
    if (!listEl) return;

    if (titleEl) titleEl.textContent = secMeta.title;
    if (iconEl) iconEl.className = `fa-solid ${secMeta.icon} text-teal-600 text-sm`;

    const activeSubKey = section === 'roster' ? activeRosterViewMode : subSection;
    listEl.innerHTML = subMenus.map(sm => {
        const isAct = sm.key === activeSubKey;
        const badgeCount = sm.badgeId ? (document.getElementById(sm.badgeId)?.textContent || '').trim() : '';
        const badgeHtml = (badgeCount && Number(badgeCount) > 0)
            ? `<span class="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">${escapeHtml(badgeCount)}</span>`
            : '';

        return `
            <button type="button" onclick="navigateTo('${section}', '${sm.key}'); closeMobileSubmenuDrawer();"
                class="w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs transition-all text-left ${isAct ? 'bg-teal-50 text-teal-700 font-bold border border-teal-200/80 shadow-2xs' : 'text-gray-700 hover:bg-gray-100 font-medium border border-transparent'}">
                <span class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2 h-2 rounded-full shrink-0 ${isAct ? 'bg-teal-500' : 'bg-gray-300'}"></span>
                    <i class="fa-solid ${sm.icon || 'fa-circle'} w-4 text-center text-[11px] ${isAct ? 'text-teal-600' : 'text-gray-400'} shrink-0"></i>
                    <span class="truncate">${escapeHtml(sm.label)}</span>
                </span>
                ${badgeHtml}
            </button>
        `;
    }).join('');
}

function openMobileSubmenuDrawer() {
    const role = getNormalizedAccessRole();
    const subMenus = getSectionSubMenusForRole(currentSection, role);
    if (!subMenus.length) return;

    renderMobileSubmenuDrawerContent(currentSection, currentSubSection);
    const drawer = document.getElementById('mobile-submenu-drawer');
    const panel = document.getElementById('mobile-submenu-drawer-panel');
    if (drawer) {
        drawer.classList.remove('hidden');
        drawer.classList.add('flex');
        requestAnimationFrame(() => {
            if (panel) panel.classList.remove('translate-x-full');
        });
    }
}

function closeMobileSubmenuDrawer() {
    const drawer = document.getElementById('mobile-submenu-drawer');
    const panel = document.getElementById('mobile-submenu-drawer-panel');
    if (!drawer) return;
    if (panel) panel.classList.add('translate-x-full');
    setTimeout(() => {
        drawer.classList.add('hidden');
        drawer.classList.remove('flex');
    }, 180);
}

/* =====================================================================
 * 3. HALAMAN GLOBAL SEARCHING (MENU, SUB-MENU, & KARYAWAN LINTAS MENU)
 * ===================================================================== */

function getSearchableMenuCatalog(role = getNormalizedAccessRole()) {
    const items = [
        { title: 'Beranda', parent: 'Menu Utama', keywords: 'beranda informasi pengumuman safety alert obrolan chat', icon: 'fa-house', action: () => navigateTo('informasi') },
        { title: 'KPI SE', parent: 'Dashboard', keywords: 'dashboard kpi se performa unit lubetruck watertruck washing ua', icon: 'fa-gauge-high', action: () => navigateTo('dashboard', 'kpi-se') }
    ];

    if (role !== 'karyawan') {
        items.push(
            { title: 'KPI Pengawas', parent: 'Dashboard', keywords: 'dashboard kpi pengawas gl group leader sap closing sqi', icon: 'fa-user-tie', action: () => navigateTo('dashboard', 'kpi-pengawas') },
            { title: 'Dokumen Analisis', parent: 'Dashboard', keywords: 'dashboard dokumen analisis early warning expired permit bib tia mcu sio', icon: 'fa-file-shield', action: () => navigateTo('dashboard', 'dokumen-analisis') },
            { title: 'Data Manpower', parent: 'Menu Utama', keywords: 'data manpower karyawan pegawai permit bib tia mcu lototo simpol sio ketinggian', icon: 'fa-id-card-clip', action: () => navigateTo('manpower') },
            { title: 'Data ATR (Monitoring)', parent: 'Performa Manpower', keywords: 'performa data atr monitoring bapak asuh grade', icon: 'fa-clipboard-check', action: () => { navigateTo('performa', 'atr'); if (typeof switchAtrSubView === 'function') switchAtrSubView('monitoring'); } },
            { title: 'ATR Weekly', parent: 'Performa Manpower → Data ATR', keywords: 'atr weekly mingguan week', icon: 'fa-calendar-week', action: () => { navigateTo('performa', 'atr'); if (typeof switchAtrSubView === 'function') switchAtrSubView('weekly'); } },
            { title: 'ATR Monthly', parent: 'Performa Manpower → Data ATR', keywords: 'atr monthly bulanan tahunan pembinaan', icon: 'fa-calendar-days', action: () => { navigateTo('performa', 'atr'); if (typeof switchAtrSubView === 'function') switchAtrSubView('monthly'); } },
            { title: 'Riwayat Punishment', parent: 'Performa Manpower → Data ATR', keywords: 'punishment cc st sp1 sp2 sp3 phk pembinaan eviden foto', icon: 'fa-gavel', action: () => { navigateTo('performa', 'atr'); if (typeof switchAtrSubView === 'function') switchAtrSubView('punishment'); } },
            { title: 'Data Absensi Harian', parent: 'Performa Manpower', keywords: 'absensi harian cekin telat nc sakit izin cuti', icon: 'fa-user-clock', action: () => navigateTo('performa', 'absensi') },
            { title: 'Input KPI Pengawas', parent: 'Performa Manpower', keywords: 'input kpi pengawas gl sap sqi closing rate', icon: 'fa-pen-to-square', action: () => navigateTo('performa', 'input-kpi-pengawas') },
            { title: 'HM & UA', parent: 'Utilitas & Operasi Unit', keywords: 'hm ua hour meter utilitas availability daily weekly mtd', icon: 'fa-stopwatch', action: () => navigateTo('utilitas', 'hm') },
            { title: 'Rental BIB', parent: 'Utilitas & Operasi Unit', keywords: 'rental bib tagihan hm charge rate', icon: 'fa-file-invoice-dollar', action: () => navigateTo('utilitas', 'rental') },
            { title: 'Time Frame Big Crane', parent: 'Utilitas & Operasi Unit', keywords: 'time frame big crane schedule aktual', icon: 'fa-tower-observation', action: () => navigateTo('utilitas', 'crane') },
            { title: 'Data Komisioning Unit', parent: 'Utilitas & Operasi Unit', keywords: 'komisioning unit bib tia tma alat berat', icon: 'fa-truck-monster', action: () => navigateTo('utilitas', 'komisioning') },
            { title: 'Lubetruck / Watertruck', parent: 'Operasional SE', keywords: 'operasional lubetruck watertruck lt wt washing greasing', icon: 'fa-oil-can', action: () => navigateTo('operasional', 'lt-wt') },
            { title: 'Lifting', parent: 'Operasional SE', keywords: 'operasional lifting wo crane rigger lowboy', icon: 'fa-dolly', action: () => navigateTo('operasional', 'lifting') }
        );
    }

    // Roster SE (semua role)
    items.push(
        { title: 'Roster ALL', parent: 'Roster SE', keywords: 'roster all jadwal bulanan shift dws nws off pic', icon: 'fa-table-cells', action: () => navigateTo('roster', 'roster-all') },
        { title: 'Roster Personal', parent: 'Roster SE', keywords: 'roster personal kalender bulanan individu', icon: 'fa-calendar-day', action: () => navigateTo('roster', 'roster-personal') },
        { title: 'Roster Daily', parent: 'Roster SE', keywords: 'roster daily harian settingan ltwt lifting driver spi', icon: 'fa-clipboard-list', action: () => navigateTo('roster', 'roster-daily') }
    );

    // Sub-tab kategori di Roster ALL
    if (typeof ROSTER_SUBMENU_CONFIG !== 'undefined') {
        Object.entries(ROSTER_SUBMENU_CONFIG).forEach(([key, cfg]) => {
            if (key === 'all') return;
            items.push({
                title: `Roster ${cfg.label}`,
                parent: 'Roster SE → Roster ALL',
                keywords: `roster ${cfg.label.toLowerCase()} ${key}`,
                icon: 'fa-calendar-check',
                action: () => navigateTo('roster', key)
            });
        });
    }

    // Master Data (Khusus Admin)
    if (role === 'admin') {
        items.push(
            { title: 'Master Nama Manpower', parent: 'Master Data', keywords: 'master data manpower karyawan password', icon: 'fa-users', action: () => navigateTo('master', 'manpower') },
            { title: 'Master Jabatan', parent: 'Master Data', keywords: 'master data jabatan role posisi', icon: 'fa-briefcase', action: () => navigateTo('master', 'jabatan') },
            { title: 'Master Perusahaan', parent: 'Master Data', keywords: 'master data perusahaan kontraktor ppa bjm srj', icon: 'fa-building', action: () => navigateTo('master', 'perusahaan') },
            { title: 'Master Unit, HM & Rental Rate', parent: 'Master Data', keywords: 'master data unit hm rate rental', icon: 'fa-truck-monster', action: () => navigateTo('master', 'unit') },
            { title: 'Master Kode Roster', parent: 'Master Data', keywords: 'master data kode roster dws nws off cuti mcu', icon: 'fa-calendar-check', action: () => navigateTo('master', 'kode-roster') },
            { title: 'Master Kode SPI', parent: 'Master Data', keywords: 'master data kode spi pengawas operator', icon: 'fa-shield', action: () => navigateTo('master', 'kode-spi') }
        );
    }

    if (!isDesktopViewport()) {
        items.push(
            { title: 'Profil Akun', parent: 'Menu Utama', keywords: 'profil akun keluar logout menu lainnya', icon: 'fa-user', action: () => navigateTo('profil') }
        );
    }

    return items;
}

let lastGlobalSearchMenuActions = [];

function triggerGlobalSearchMenuAction(idx) {
    const fn = lastGlobalSearchMenuActions[idx];
    if (typeof fn === 'function') fn();
}

function jumpSearchToManpower(nrp) {
    navigateTo('manpower');
    const inp = document.getElementById('manpower-search');
    if (inp) { inp.value = nrp || ''; renderManpowerTable(); }
}

function jumpSearchToAtr(nrp, subView = 'monitoring') {
    navigateTo('performa', 'atr');
    if (typeof switchAtrSubView === 'function') switchAtrSubView(subView);
    const inputId = subView === 'weekly'
        ? 'atr-weekly-search'
        : (subView === 'monthly'
            ? 'atr-monthly-search'
            : (subView === 'punishment' ? 'punishment-history-search' : 'atr-monitoring-search'));
    const inp = document.getElementById(inputId);
    if (inp) {
        inp.value = nrp || '';
        if (subView === 'weekly' && typeof renderAtrWeeklyTable === 'function') renderAtrWeeklyTable();
        else if (subView === 'monthly' && typeof renderAtrMonthlyTable === 'function') renderAtrMonthlyTable();
        else if (subView === 'punishment' && typeof renderPunishmentHistoryTable === 'function') renderPunishmentHistoryTable();
        else if (typeof renderPerformaManpower === 'function') renderPerformaManpower();
    }
}

function jumpSearchToAbsensi(nrp) {
    navigateTo('performa', 'absensi');
    const inp = document.getElementById('absensi-monitoring-search');
    if (inp) { inp.value = nrp || ''; renderPerformaManpower(); }
}

function jumpSearchToRosterAll(nrp) {
    navigateTo('roster', 'all');
    const inp = document.getElementById('roster-search');
    if (inp) { inp.value = nrp || ''; renderRosterTable(); }
}

function jumpSearchToRosterPersonal(mpId) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    navigateTo('roster', 'roster-personal');
    const searchEl = document.getElementById('roster-personal-search');
    if (searchEl) searchEl.value = '';
    if (typeof populateRosterPersonalSelect === 'function') populateRosterPersonalSelect(false);
    const sel = document.getElementById('roster-personal-person');
    if (sel && mp) {
        const matchRow = rosterState.find(r => String(r.nrp).trim().toLowerCase() === String(mp.nrp).trim().toLowerCase());
        if (matchRow) sel.value = String(matchRow.id);
    }
    if (typeof renderRosterPersonalCalendar === 'function') renderRosterPersonalCalendar();
}

function clearGlobalSearchInput() {
    const inp = document.getElementById('global-search-input');
    if (inp) {
        inp.value = '';
        inp.focus();
    }
    renderGlobalSearchResults();
}

function renderGlobalSearchSection() {
    renderGlobalSearchResults();
    setTimeout(() => {
        const inp = document.getElementById('global-search-input');
        if (inp && window.innerWidth >= 1024) inp.focus();
    }, 30);
}

function renderGlobalSearchResults() {
    const container = document.getElementById('global-search-results');
    const clearBtn = document.getElementById('btn-global-search-clear');
    const rawQuery = String(document.getElementById('global-search-input')?.value || '').trim();
    const query = rawQuery.toLowerCase();
    if (clearBtn) clearBtn.classList.toggle('hidden', !rawQuery);
    if (!container) return;

    const role = getNormalizedAccessRole();
    const catalog = getSearchableMenuCatalog(role);
    lastGlobalSearchMenuActions = [];

    // Jika belum mengetik -> tampilkan pintasan cepat menu & panduan pencarian
    if (!query) {
        const quickMenu = catalog.slice(0, 12);
        const quickChipsHtml = quickMenu.map(item => {
            const idx = lastGlobalSearchMenuActions.push(item.action) - 1;
            return `
                <button type="button" onclick="triggerGlobalSearchMenuAction(${idx})"
                    class="flex items-center gap-2.5 p-2.5 rounded-xl bg-white hover:bg-teal-50/70 border border-gray-200 hover:border-teal-300 text-left transition-all shadow-2xs">
                    <span class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                        <i class="fa-solid ${item.icon} text-xs"></i>
                    </span>
                    <div class="min-w-0">
                        <p class="text-[11px] font-bold text-gray-800 truncate">${escapeHtml(item.title)}</p>
                        <p class="text-[9px] text-gray-400 truncate">${escapeHtml(item.parent)}</p>
                    </div>
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <div class="space-y-3">
                <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 flex items-start gap-2.5">
                    <i class="fa-solid fa-lightbulb text-teal-600 mt-0.5 text-xs shrink-0"></i>
                    <p class="text-[10.5px] text-teal-900 leading-relaxed">
                        Ketik <strong>nama menu / sub-menu</strong> (mis. <em>ATR</em>, <em>Lifting</em>, <em>Roster Daily</em>, <em>HM</em>) atau ketik <strong>nama / NRP karyawan</strong> untuk langsung melihat data karyawan di masing-masing menu.
                    </p>
                </div>
                <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Pintasan Menu Cepat</p>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        ${quickChipsHtml}
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // 1. Cari Menu & Sub-Menu
    const matchedMenus = catalog.filter(item =>
        `${item.title} ${item.parent} ${item.keywords}`.toLowerCase().includes(query)
    );

    // 2. Cari Karyawan di Masing-Masing Menu
    const mpList = (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) ? manpowerState : [];
    const matchedEmployees = mpList.filter(mp =>
        `${mp.nrp || ''} ${mp.nama || ''} ${mp.jabatan || ''} ${mp.perusahaan || ''} ${mp.domisili || ''}`.toLowerCase().includes(query)
    ).slice(0, 25);

    if (!matchedMenus.length && !matchedEmployees.length) {
        container.innerHTML = `
            <div class="py-12 px-4 text-center space-y-2 bg-white rounded-xl border border-gray-200">
                <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                    <i class="fa-solid fa-magnifying-glass text-sm"></i>
                </div>
                <p class="text-xs font-bold text-gray-700">Tidak ada hasil untuk "${escapeHtml(rawQuery)}"</p>
                <p class="text-[10px] text-gray-400">Coba kata kunci menu lain atau masukkan nama / NRP karyawan.</p>
            </div>
        `;
        return;
    }

    let html = '';

    if (matchedMenus.length > 0) {
        const menuCards = matchedMenus.map(item => {
            const idx = lastGlobalSearchMenuActions.push(item.action) - 1;
            return `
                <button type="button" onclick="triggerGlobalSearchMenuAction(${idx})"
                    class="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white hover:bg-teal-50/60 border border-gray-200 hover:border-teal-300 text-left transition-all shadow-2xs">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                            <i class="fa-solid ${item.icon} text-xs"></i>
                        </span>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(item.title)}</p>
                            <p class="text-[9.5px] text-gray-400 truncate">${escapeHtml(item.parent)}</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-[10px] text-gray-300 shrink-0"></i>
                </button>
            `;
        }).join('');

        html += `
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Menu &amp; Sub-Menu (${matchedMenus.length})</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${menuCards}
                </div>
            </div>
        `;
    }

    if (matchedEmployees.length > 0) {
        const empCards = matchedEmployees.map(mp => {
            const nrpSafe = escapeJsString(mp.nrp || '');
            const rosterRow = (typeof rosterState !== 'undefined' && Array.isArray(rosterState))
                ? rosterState.find(r => String(r.nrp || '').trim().toLowerCase() === String(mp.nrp || '').trim().toLowerCase())
                : null;
            const punishCount = (typeof punishmentHistoryState !== 'undefined' && Array.isArray(punishmentHistoryState))
                ? punishmentHistoryState.filter(p => Number(p.mpId) === Number(mp.id) || String(p.nrp || '').trim().toLowerCase() === String(mp.nrp || '').trim().toLowerCase()).length
                : 0;
            const isGlEmp = String(mp.jabatan || '').toLowerCase().includes('group leader') || String(mp.jabatan || '').toLowerCase() === 'gl';
            const outTag = (typeof isPersonOutOfRoster === 'function' && isPersonOutOfRoster(mp))
                ? ' <span class="text-red-600 font-bold">(out)</span>'
                : '';

            const menuPills = [];
            if (role !== 'karyawan') {
                menuPills.push(`
                    <button type="button" onclick="openManpowerDetailModal(${Number(mp.id)})"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-id-card text-[9px]"></i>
                        <span>Detail Manpower</span>
                    </button>
                    <button type="button" onclick="jumpSearchToManpower('${nrpSafe}')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-id-card-clip text-teal-600 text-[9px]"></i>
                        <span>Data Manpower</span>
                    </button>
                    <button type="button" onclick="jumpSearchToAtr('${nrpSafe}', 'monitoring')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-clipboard-check text-emerald-600 text-[9px]"></i>
                        <span>Data ATR</span>
                    </button>
                    <button type="button" onclick="jumpSearchToAtr('${nrpSafe}', 'monthly')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-calendar-days text-indigo-600 text-[9px]"></i>
                        <span>ATR Monthly</span>
                    </button>
                    <button type="button" onclick="jumpSearchToAbsensi('${nrpSafe}')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-user-clock text-sky-600 text-[9px]"></i>
                        <span>Absensi</span>
                    </button>
                `);
            }

            if (rosterRow) {
                const unitNote = rosterRow.unit && rosterRow.unit !== '-' ? ` · ${rosterRow.unit}` : '';
                menuPills.push(`
                    <button type="button" onclick="jumpSearchToRosterAll('${nrpSafe}')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-table-cells text-teal-600 text-[9px]"></i>
                        <span>Roster ALL${escapeHtml(unitNote)}</span>
                    </button>
                    <button type="button" onclick="jumpSearchToRosterPersonal(${Number(mp.id)})"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-calendar-day text-emerald-600 text-[9px]"></i>
                        <span>Roster Personal</span>
                    </button>
                `);
            }

            if (role !== 'karyawan' && isGlEmp) {
                menuPills.push(`
                    <button type="button" onclick="navigateTo('dashboard', 'kpi-pengawas')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-chart-line text-[9px]"></i>
                        <span>KPI Pengawas</span>
                    </button>
                `);
            }

            if (role !== 'karyawan' && punishCount > 0) {
                menuPills.push(`
                    <button type="button" onclick="jumpSearchToAtr('${nrpSafe}', 'punishment')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-gavel text-[9px]"></i>
                        <span>Punishment (${punishCount})</span>
                    </button>
                `);
            }

            if (role === 'admin') {
                menuPills.push(`
                    <button type="button" onclick="navigateTo('master', 'manpower')"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-database text-[9px]"></i>
                        <span>Master Data</span>
                    </button>
                `);
            }

            return `
                <div class="p-3.5 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-2.5">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-9 h-9 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                ${escapeHtml(typeof buildInitialsFromName === 'function' ? buildInitialsFromName(mp.nama) : String(mp.nama || 'SE').slice(0, 2).toUpperCase())}
                            </div>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-gray-900 truncate">${escapeHtml(mp.nama)}${outTag}</p>
                                <p class="text-[10px] text-gray-500 truncate">
                                    <span class="font-mono text-teal-700 font-semibold">${escapeHtml(mp.nrp)}</span>
                                    · ${escapeHtml(mp.jabatan || '-')} · ${escapeHtml(mp.perusahaan || '-')}
                                </p>
                            </div>
                        </div>
                        ${rosterRow ? `<span class="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold shrink-0">Di Roster</span>` : ''}
                    </div>
                    <div>
                        <p class="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Buka di Menu:</p>
                        <div class="flex flex-wrap gap-1.5">
                            ${menuPills.join('')}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        html += `
            <div class="space-y-2">
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Karyawan Ditemukan (${matchedEmployees.length})</p>
                <div class="space-y-2">
                    ${empCards}
                </div>
            </div>
        `;
    }

    container.innerHTML = `<div class="space-y-4">${html}</div>`;
}

/* =====================================================================
 * 4. HALAMAN PROFIL (AKUN + MENU SISA BER-DROPDOWN UNTUK ADMIN/GL/SECTION)
 * ===================================================================== */

function toggleProfilMenuDropdown(menuKey) {
    profilMenuOpenState[menuKey] = !profilMenuOpenState[menuKey];
    const subEl = document.getElementById(`profil-submenu-${menuKey}`);
    const chevEl = document.getElementById(`profil-chevron-${menuKey}`);
    const isOpen = Boolean(profilMenuOpenState[menuKey]);
    if (subEl) subEl.classList.toggle('hidden', !isOpen);
    if (chevEl) chevEl.classList.toggle('rotate-180', isOpen);
}

function getProfilOverflowMenuGroups(role = getNormalizedAccessRole()) {
    if (role === 'karyawan') return [];

    const groups = [
        {
            key: 'performa',
            title: 'Performa Manpower',
            icon: 'fa-chart-line',
            iconBg: 'bg-emerald-50 text-emerald-600',
            subMenus: getSectionSubMenusForRole('performa', role)
        },
        {
            key: 'utilitas',
            title: 'Utilitas & Operasi Unit',
            icon: 'fa-gears',
            iconBg: 'bg-sky-50 text-sky-600',
            subMenus: getSectionSubMenusForRole('utilitas', role)
        },
        {
            key: 'operasional',
            title: 'Operasional SE',
            icon: 'fa-truck-fast',
            iconBg: 'bg-amber-50 text-amber-600',
            subMenus: getSectionSubMenusForRole('operasional', role)
        },
        {
            key: 'roster',
            title: 'Roster SE',
            icon: 'fa-calendar-days',
            iconBg: 'bg-teal-50 text-teal-600',
            subMenus: getSectionSubMenusForRole('roster', role)
        }
    ];

    if (role === 'admin') {
        groups.push({
            key: 'master',
            title: 'Master Data',
            icon: 'fa-database',
            iconBg: 'bg-purple-50 text-purple-600',
            subMenus: getSectionSubMenusForRole('master', role)
        });
    }

    return groups;
}

function renderProfilSection() {
    const host = document.getElementById('profil-content-host');
    if (!host) return;

    const actor = (typeof getCurrentRosterActor === 'function')
        ? getCurrentRosterActor()
        : { type: 'karyawan', nrp: '', nama: 'Pengguna', jabatan: '' };
    const role = getNormalizedAccessRole();
    const roleMeta = getAccessRoleMeta(role);
    const initials = (typeof buildInitialsFromName === 'function')
        ? buildInitialsFromName(actor.nama || 'SE')
        : String(actor.nama || 'SE').slice(0, 2).toUpperCase();

    const matchedMp = (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState) && actor.nrp)
        ? manpowerState.find(m => String(m.nrp || '').trim().toLowerCase() === actor.nrp.toLowerCase())
        : null;

    // 1. Kartu Hero Akun Pengguna
    const heroHtml = `
        <div class="rounded-2xl bg-gradient-to-br from-[#125648] via-[#1B7361] to-[#0D4A3E] text-white p-4 sm:p-5 shadow-md">
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm">
                        ${escapeHtml(initials)}
                    </div>
                    <div class="min-w-0">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold ${roleMeta.heroBadgeCls}">
                            <i class="fa-solid ${roleMeta.icon} text-[8.5px]"></i>
                            <span>${escapeHtml(roleMeta.fullLabel)}</span>
                        </span>
                        <h3 class="text-base sm:text-lg font-extrabold tracking-tight truncate mt-1">${escapeHtml(actor.nama || 'Pengguna')}</h3>
                        <p class="text-[11px] text-teal-100/90 truncate">
                            ${actor.nrp && actor.nrp !== 'ADMIN' ? `<span class="font-mono font-semibold">NRP ${escapeHtml(actor.nrp)}</span> · ` : ''}${escapeHtml(actor.jabatan || roleMeta.label)}${matchedMp?.perusahaan ? ` · ${escapeHtml(matchedMp.perusahaan)}` : ''}
                        </p>
                    </div>
                </div>
                <button type="button" onclick="confirmPantauLogout()"
                    class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/15 hover:bg-red-500/90 border border-white/25 text-white text-[11px] font-semibold transition-colors shrink-0">
                    <i class="fa-solid fa-right-from-bracket text-[11px]"></i>
                    <span>Keluar</span>
                </button>
            </div>
        </div>
    `;

    // 2. Menu Lainnya untuk Admin, GL, & Section (dengan panah bawah dropdown seperti Sidebar Desktop)
    const overflowGroups = getProfilOverflowMenuGroups(role);
    let overflowMenuHtml = '';
    if (overflowGroups.length > 0) {
        const cardsHtml = overflowGroups.map(grp => {
            const hasSub = grp.subMenus && grp.subMenus.length > 0;
            const isOpen = Boolean(profilMenuOpenState[grp.key]);
            const subHtml = hasSub
                ? `
                    <div id="profil-submenu-${grp.key}" class="${isOpen ? '' : 'hidden'} mt-1.5 ml-4 pl-3 border-l-2 border-teal-100 space-y-1 pb-1">
                        ${grp.subMenus.map(sm => `
                            <button type="button" onclick="navigateTo('${grp.key}', '${sm.key}')"
                                class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700 text-left transition-colors">
                                <span class="flex items-center gap-2.5 min-w-0">
                                    <span class="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"></span>
                                    <span class="truncate">${escapeHtml(sm.label)}</span>
                                </span>
                                <i class="fa-solid fa-chevron-right text-[9px] text-gray-300 shrink-0"></i>
                            </button>
                        `).join('')}
                    </div>
                `
                : '';

            return `
                <div class="rounded-xl bg-white border border-gray-200/90 p-2 shadow-2xs">
                    <button type="button" onclick="${hasSub ? `toggleProfilMenuDropdown('${grp.key}')` : `navigateTo('${grp.key}')`}"
                        class="w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left focus:outline-none">
                        <span class="flex items-center gap-3 min-w-0">
                            <span class="w-8 h-8 rounded-xl ${grp.iconBg} flex items-center justify-center shrink-0">
                                <i class="fa-solid ${grp.icon} text-xs"></i>
                            </span>
                            <span class="text-xs font-bold text-gray-800 truncate">${escapeHtml(grp.title)}</span>
                        </span>
                        ${hasSub ? `<i id="profil-chevron-${grp.key}" class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}"></i>` : `<i class="fa-solid fa-chevron-right text-[10px] text-gray-300 shrink-0"></i>`}
                    </button>
                    ${subHtml}
                </div>
            `;
        }).join('');

        overflowMenuHtml = `
            <div class="space-y-2">
                <p class="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Menu Lainnya</p>
                <div class="space-y-2">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    // 3. Info Legalitas Pribadi & Pintasan Roster Personal (jika akun terdaftar di Data Manpower)
    let personalCardHtml = '';
    if (matchedMp) {
        const allowedDocs = typeof getAllowedDocsForRole === 'function' ? getAllowedDocsForRole(matchedMp.jabatan) : [];
        const docLabels = {
            PERMIT_BIB: 'Permit BIB',
            PERMIT_TIA: 'Permit TIA',
            MCU: 'MCU Ulang (9 Bln)',
            LOTOTO: 'LOTOTO',
            SIMPOL: 'SIMPOL',
            SIO: 'SIO',
            KETINGGIAN: 'Sert. Ketinggian'
        };
        const docItemsHtml = allowedDocs.map(docKey => {
            const dt = docKey === 'MCU'
                ? (typeof getEffectiveMcuDate === 'function' ? getEffectiveMcuDate(matchedMp) : (matchedMp.docs?.MCU || ''))
                : (matchedMp.docs?.[docKey] || '');
            const ev = typeof evaluateDocumentStatus === 'function' ? evaluateDocumentStatus(docKey, dt) : null;
            const dateDisplay = dt ? (typeof formatDateID === 'function' ? formatDateID(dt) : dt) : 'Belum diisi';
            const statusText = ev ? ev.subText : '-';
            const statusCls = ev ? ev.subColor : 'text-gray-400';
            return `
                <div class="flex items-center justify-between gap-2 py-2">
                    <span class="text-[11px] font-semibold text-gray-600">${escapeHtml(docLabels[docKey] || docKey)}</span>
                    <div class="text-right">
                        <p class="text-[11px] font-bold text-gray-800 font-mono">${escapeHtml(dateDisplay)}</p>
                        ${dt ? `<p class="text-[9px] ${statusCls}">${escapeHtml(statusText)}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        personalCardHtml = `
            <div class="bg-white rounded-2xl border border-gray-200 shadow-2xs p-4 space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <h4 class="text-xs font-bold text-gray-800 flex items-center gap-2">
                        <i class="fa-solid fa-id-card text-teal-600"></i>
                        <span>Status Dokumen &amp; Legalitas Saya</span>
                    </h4>
                    <button type="button" onclick="jumpSearchToRosterPersonal(${Number(matchedMp.id)})"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-600 text-teal-700 hover:text-white border border-teal-200 text-[10px] font-semibold transition-colors">
                        <i class="fa-solid fa-calendar-day text-[9px]"></i>
                        <span>Roster Saya</span>
                    </button>
                </div>
                <div class="divide-y divide-gray-100">
                    ${docItemsHtml || '<p class="text-xs text-gray-400 py-2">Belum ada data dokumen.</p>'}
                </div>
            </div>
        `;
    }

    host.innerHTML = `
        <div class="max-w-2xl mx-auto w-full space-y-4">
            ${heroHtml}
            ${overflowMenuHtml}
            ${personalCardHtml}
            <p class="lg:hidden text-center text-[11px] italic font-normal text-[#D2CBC0] pt-4 pb-1 select-none tracking-wide">created by @fadilm</p>
        </div>
    `;
}

/* =====================================================================
 * 5. MOBILE MINIMALIST TOOLBARS:
 *    - TOMBOL PANAH '>' ANIMASI KELUAR MENU DOWNLOAD/UPLOAD/TAMBAH (ICON-ONLY DI HP)
 *    - LOGO FILTER -> SLIDE DRAWER KANAN KE KIRI UNTUK SEMUA HALAMAN
 * ===================================================================== */

let mobileMinimalToolbarsInitialized = false;
const mobileFilterGroupRegistry = new Map();
let activeMobileFilterDrawerState = null; // { key, title, restores: [{ el, parent, nextSibling }] }

const MOBILE_ACTION_GROUP_SPECS = [
    { key: 'beranda-actions', selectors: ['#btn-add-informasi'] },
    { key: 'manpower-actions', selectors: ['#section-manpower button[onclick="downloadManpowerExcel()"]', '#section-manpower button[onclick="openManpowerModal()"]'] },
    { key: 'atr-top-actions', selectors: ['#btn-atr-download', '#btn-atr-open-upload'] },
    { key: 'atr-monthly-actions', selectors: ['#atr-view-monthly button[onclick="openPunishmentModal()"]'] },
    { key: 'atr-punishment-actions', selectors: ['#atr-view-punishment button[onclick="openPunishmentModal()"]'] },
    { key: 'absensi-actions', selectors: ['#performa-tab-absensi button[onclick="openAbsensiUploadModal()"]'] },
    { key: 'hmua-actions', selectors: ['#btn-hmua-open-upload'] },
    { key: 'rental-actions', selectors: ['#utilitas-tab-rental button[onclick="openRentalModal()"]'] },
    { key: 'crane-actions', selectors: ['#utilitas-tab-crane button[onclick="openCraneScheduleModal()"]'] },
    { key: 'komisioning-actions', selectors: ['#utilitas-tab-komisioning button[onclick="openKomisioningModal()"]'] },
    { key: 'ops-ltwt-actions', selectors: ['#operasional-tab-lt-wt button[onclick="exportOpsLtWtExcel()"]', '#operasional-tab-lt-wt button[onclick="openOpsLtWtUploadModal()"]'] },
    { key: 'ops-lifting-actions', selectors: ['#operasional-tab-lifting button[onclick="exportOpsLiftingExcel()"]', '#operasional-tab-lifting button[onclick="openOpsLiftingUploadModal()"]'] },
    { key: 'roster-all-actions', selectors: ['#roster-view-all button[onclick="downloadRosterAllExcel()"]', '#btn-roster-upload', '#btn-roster-add-person', '#btn-toggle-roster-info'] },
    { key: 'roster-daily-actions', selectors: ['#roster-view-daily button[onclick="syncRosterDailyFromRoster(true)"]', '#roster-view-daily button[onclick="resetRosterDailyTemplate()"]', '#btn-copy-roster-daily'] },
    { key: 'master-mp-actions', selectors: ['#master-tab-manpower button[onclick="openManpowerModal()"]'] },
    { key: 'master-jab-actions', selectors: ['#master-tab-jabatan button[onclick="openMasterItemModal(\'jabatan\')"]'] },
    { key: 'master-comp-actions', selectors: ['#master-tab-perusahaan button[onclick="openMasterItemModal(\'perusahaan\')"]'] },
    { key: 'master-unit-actions', selectors: ['#master-tab-unit button[onclick="openMasterItemModal(\'unit\')"]'] },
    { key: 'master-koderoster-actions', selectors: ['#master-tab-kode-roster button[onclick="openMasterItemModal(\'kode-roster\')"]'] },
    { key: 'master-kodespi-actions', selectors: ['#master-tab-kode-spi button[onclick="openMasterItemModal(\'kode-spi\')"]'] }
];

const MOBILE_FILTER_GROUP_SPECS = [
    {
        key: 'beranda-filter',
        title: 'Filter Beranda',
        items: [
            { selector: '#info-category-filter', label: 'Kategori Informasi' }
        ]
    },
    {
        key: 'kpi-se-filter',
        title: 'Filter KPI SE',
        items: [
            { selector: '#filter-kpi-se-week', label: 'Periode Weekly' },
            { selector: '#sub-kpi-se button[onclick="resetDashboardFilters()"]', label: 'Pintasan Periode', isInlineBtn: true }
        ]
    },
    {
        key: 'kpi-pengawas-filter',
        title: 'Filter KPI Pengawas',
        items: [
            { selector: '#dash-kpi-week-filter', label: 'Periode Week' }
        ]
    },
    {
        key: 'atr-monitoring-filter',
        title: 'Filter Monitoring ATR',
        items: [
            { selector: '#atr-role-filter', label: 'Jabatan' },
            { selector: '#atr-monitoring-mode', label: 'Mode Periode' },
            { selector: '#atr-monitoring-week', label: 'Periode Week' },
            { selector: '#atr-monitoring-month', label: 'Bulan' },
            { selector: '#atr-monitoring-year', label: 'Tahun' }
        ]
    },
    {
        key: 'atr-weekly-filter',
        title: 'Filter ATR Weekly',
        items: [
            { selector: '#atr-weekly-month', label: 'Bulan' },
            { selector: '#atr-weekly-year', label: 'Tahun' }
        ]
    },
    {
        key: 'atr-monthly-filter',
        title: 'Filter ATR Monthly',
        items: [
            { selector: '#atr-monthly-year', label: 'Tahun', companionLabelFor: 'atr-monthly-year' },
            { selector: '#atr-monthly-punishment-filter', label: 'Status Pembinaan' }
        ]
    },
    {
        key: 'punishment-filter',
        title: 'Filter Riwayat Punishment',
        items: [
            { selector: '#punishment-filter-category', label: 'Kategori' },
            { selector: '#punishment-filter-level', label: 'Tingkat Punishment' },
            { selector: '#punishment-filter-year', label: 'Tahun' }
        ]
    },
    {
        key: 'absensi-date-filter',
        title: 'Filter Tanggal Absensi',
        items: [
            { selector: '#absensi-monitoring-date', label: 'Tanggal Absensi' }
        ]
    },
    {
        key: 'absensi-shift-filter',
        title: 'Filter Shift Absensi',
        items: [
            { selector: '#absensi-shift-filter', label: 'Shift Kerja' }
        ]
    },
    {
        key: 'absensi-monthly-filter',
        title: 'Filter Absensi Monthly',
        items: [
            { selector: '#absensi-monthly-month', label: 'Bulan' },
            { selector: '#absensi-monthly-year', label: 'Tahun' }
        ]
    },
    {
        key: 'input-kpi-filter',
        title: 'Filter Input KPI Pengawas',
        items: [
            { selector: '#input-kpi-week-filter', label: 'Periode Week' }
        ]
    },
    {
        key: 'hmua-date-filter',
        title: 'Filter Tanggal HM & UA',
        items: [
            { selector: '#hmua-filter-date', label: 'Tanggal Monitoring' }
        ]
    },
    {
        key: 'hm-unit-filter',
        title: 'Filter HM Unit',
        items: [
            { selector: '#hm-unit-shift-filter', label: 'Shift Kerja' },
            { selector: '#hm-unit-category-filter', label: 'Kategori Unit' }
        ]
    },
    {
        key: 'ua-unit-filter',
        title: 'Filter UA Unit',
        items: [
            { selector: '#ua-unit-category-filter', label: 'Kategori Unit' }
        ]
    },
    {
        key: 'ua-weekly-filter',
        title: 'Filter UA Weekly',
        items: [
            { selector: '#ua-weekly-month', label: 'Bulan' },
            { selector: '#ua-weekly-year', label: 'Tahun' },
            { selector: '#ua-weekly-category-filter', label: 'Kategori Unit' }
        ]
    },
    {
        key: 'ua-mtd-filter',
        title: 'Filter UA MTD',
        items: [
            { selector: '#ua-mtd-month', label: 'Bulan' },
            { selector: '#ua-mtd-year', label: 'Tahun' },
            { selector: '#ua-mtd-category-filter', label: 'Kategori Unit' }
        ]
    },
    {
        key: 'rental-filter',
        title: 'Filter Rental BIB',
        items: [
            { selector: '#rental-filter-month', label: 'Bulan' },
            { selector: '#rental-filter-year', label: 'Tahun' }
        ]
    },
    {
        key: 'crane-filter',
        title: 'Filter Big Crane',
        items: [
            { selector: '#crane-filter-month', label: 'Bulan' },
            { selector: '#crane-filter-year', label: 'Tahun' }
        ]
    },
    {
        key: 'ops-ltwt-filter',
        title: 'Filter Lubetruck / Watertruck',
        items: [
            { selector: '#ops-ltwt-filter-job', label: 'Jenis Job' },
            { selector: '#ops-ltwt-filter-shift', label: 'Shift' },
            { selector: '#ops-ltwt-filter-status', label: 'Status' }
        ]
    },
    {
        key: 'ops-lifting-filter',
        title: 'Filter Operasional Lifting',
        items: [
            { selector: '#ops-lifting-filter-kategori', label: 'Kategori' },
            { selector: '#ops-lifting-filter-shift', label: 'Shift' },
            { selector: '#ops-lifting-filter-status', label: 'Status' }
        ]
    },
    {
        key: 'roster-all-filter',
        title: 'Filter Periode Roster',
        items: [
            { selector: '#roster-filter-month', label: 'Bulan' },
            { selector: '#roster-filter-year', label: 'Tahun' }
        ]
    },
    {
        key: 'roster-personal-filter',
        title: 'Filter Roster Personal',
        items: [
            { selector: '#roster-personal-person', label: 'Pilih Personil' },
            { selector: '#roster-view-personal .inline-flex.items-center.gap-1.bg-gray-50', label: 'Bulan & Tahun', isPeriodBox: true }
        ]
    },
    {
        key: 'roster-daily-filter',
        title: 'Filter Roster Daily',
        items: [
            { selector: '#roster-daily-date', label: 'Tanggal', wrapParent: true },
            { selector: '#roster-daily-shift', label: 'Shift Kerja', wrapParent: true },
            { selector: '#roster-daily-spi-pill', label: 'Kode SPI Bulan Aktif', isInlineBtn: true }
        ]
    },
    {
        key: 'master-mp-filter',
        title: 'Filter Master Manpower',
        items: [
            { selector: '#master-mp-role-filter', label: 'Jabatan' },
            { selector: '#master-mp-company-filter', label: 'Perusahaan' }
        ]
    },
    {
        key: 'master-unit-filter',
        title: 'Filter Master Unit',
        items: [
            { selector: '#master-unit-cat-filter', label: 'Kategori Unit' }
        ]
    }
];

function closeAllMobileActionGroups(exceptWrap = null) {
    document.querySelectorAll('.mob-act-wrap.is-open').forEach(w => {
        if (w === exceptWrap) return;
        w.classList.remove('is-open');
        const t = w.querySelector('.mob-act-toggle');
        if (t) t.setAttribute('aria-expanded', 'false');
    });
}

function toggleMobileActionGroup(wrapEl) {
    if (!wrapEl) return;
    const willOpen = !wrapEl.classList.contains('is-open');
    closeAllMobileActionGroups(willOpen ? wrapEl : null);
    wrapEl.classList.toggle('is-open', willOpen);
    const t = wrapEl.querySelector('.mob-act-toggle');
    if (t) t.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function syncMobileActionGroupVisibility() {
    document.querySelectorAll('.mob-act-wrap').forEach(wrap => {
        const tray = wrap.querySelector('.mob-act-tray');
        if (!tray) return;
        const buttons = Array.from(tray.children).filter(el => el.tagName === 'BUTTON');
        const hasVisibleBtn = buttons.some(btn => !btn.classList.contains('hidden'));
        wrap.classList.toggle('mob-act-empty', !hasVisibleBtn);
    });
}

function isFilterItemNonDefault(el) {
    if (!el) return false;
    if (el.tagName === 'SELECT') {
        const val = String(el.value || '').trim().toLowerCase();
        return val !== '' && val !== 'all' && el.selectedIndex > 0;
    }
    return false;
}

function updateMobileFilterActiveDots() {
    mobileFilterGroupRegistry.forEach((entry, key) => {
        const dot = entry.triggerBtn?.querySelector('.mob-flt-dot');
        if (!dot) return;
        const hasActive = entry.items.some(it => {
            const target = it.controlEl || it.el;
            if (!target || target.classList.contains('hidden')) return false;
            return isFilterItemNonDefault(target);
        });
        dot.classList.toggle('hidden', !hasActive);
    });
}

function syncMobileFilterFieldVisibility() {
    const body = document.getElementById('mob-filter-sheet-body');
    if (!body) return;
    body.querySelectorAll('.mob-flt-field').forEach(field => {
        const ctrlId = field.dataset.ctrlId;
        const ctrl = ctrlId ? document.getElementById(ctrlId) : field.querySelector('select, input, button');
        const isHidden = Boolean(ctrl && ctrl.classList.contains('hidden'));
        field.classList.toggle('is-hidden-ctrl', isHidden);
    });
}

function openMobileFilterDrawer(groupKey) {
    const entry = mobileFilterGroupRegistry.get(groupKey);
    const portal = document.getElementById('mob-filter-sheet-portal');
    const panel = document.getElementById('mob-filter-sheet-panel');
    const titleEl = document.getElementById('mob-filter-sheet-title');
    const bodyEl = document.getElementById('mob-filter-sheet-body');
    if (!entry || !portal || !panel || !bodyEl) return;

    // Tutup drawer lain yang mungkin terbuka terlebih dahulu
    if (activeMobileFilterDrawerState) {
        closeMobileFilterDrawer(true);
    }
    closeAllMobileActionGroups();
    if (typeof closeMobileSubmenuDrawer === 'function') closeMobileSubmenuDrawer();

    if (titleEl) titleEl.textContent = entry.title || 'Filter';
    bodyEl.innerHTML = '';

    const restores = [];
    entry.items.forEach(item => {
        const el = item.el;
        if (!el || !el.parentNode) return;
        restores.push({ el, parent: el.parentNode, nextSibling: el.nextSibling });

        const fieldWrap = document.createElement('div');
        fieldWrap.className = 'mob-flt-field space-y-1.5';
        const ctrlEl = item.controlEl || el;
        if (ctrlEl && ctrlEl.id) fieldWrap.dataset.ctrlId = ctrlEl.id;

        const lbl = document.createElement('label');
        lbl.className = 'block text-[10.5px] font-bold uppercase tracking-wider text-gray-500';
        lbl.textContent = item.label || 'Filter';
        if (ctrlEl && ctrlEl.id) lbl.setAttribute('for', ctrlEl.id);

        fieldWrap.appendChild(lbl);
        fieldWrap.appendChild(el);
        bodyEl.appendChild(fieldWrap);
    });

    activeMobileFilterDrawerState = { key: groupKey, title: entry.title, restores };
    syncMobileFilterFieldVisibility();

    portal.classList.remove('hidden');
    portal.classList.add('flex');
    requestAnimationFrame(() => {
        panel.classList.remove('translate-x-full');
    });
}

function closeMobileFilterDrawer(immediate = false) {
    const portal = document.getElementById('mob-filter-sheet-portal');
    const panel = document.getElementById('mob-filter-sheet-panel');
    if (!portal || !panel) return;

    const restoreNow = () => {
        if (activeMobileFilterDrawerState && Array.isArray(activeMobileFilterDrawerState.restores)) {
            activeMobileFilterDrawerState.restores.forEach(r => {
                if (r.parent && r.el) {
                    if (r.nextSibling && r.nextSibling.parentNode === r.parent) {
                        r.parent.insertBefore(r.el, r.nextSibling);
                    } else {
                        r.parent.appendChild(r.el);
                    }
                }
            });
            activeMobileFilterDrawerState = null;
        }
        portal.classList.add('hidden');
        portal.classList.remove('flex');
        updateMobileFilterActiveDots();
    };

    panel.classList.add('translate-x-full');
    if (immediate) {
        restoreNow();
    } else {
        setTimeout(restoreNow, 190);
    }
}

function initMobileMinimalToolbars() {
    if (mobileMinimalToolbarsInitialized || typeof document === 'undefined') return;
    mobileMinimalToolbarsInitialized = true;

    // Tandai badge angka pada Info Settingan agar tetap tampak mungil di pojok ikon pada mode HP
    const rosterInfoBadge = document.getElementById('roster-info-toggle-badge');
    if (rosterInfoBadge) rosterInfoBadge.setAttribute('data-mob-keep-badge', '1');

    // 2. Bangun Grup Tombol Aksi Panah '>' (Animasi Keluar Icon-Only di HP)
    MOBILE_ACTION_GROUP_SPECS.forEach(spec => {
        const foundBtns = spec.selectors
            .map(sel => document.querySelector(sel))
            .filter(Boolean);
        if (!foundBtns.length) return;

        const firstBtn = foundBtns[0];
        const parent = firstBtn.parentNode;
        if (!parent || firstBtn.closest('.mob-act-wrap')) return;

        const wrap = document.createElement('div');
        wrap.className = 'mob-act-wrap inline-flex items-center';
        wrap.dataset.mobActKey = spec.key;

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'mob-act-toggle lg:hidden';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.title = 'Tampilkan Menu Aksi';
        toggleBtn.innerHTML = '<i class="fa-solid fa-chevron-right mob-act-chevron text-[11px]"></i>';
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileActionGroup(wrap);
        });

        const tray = document.createElement('div');
        tray.className = 'mob-act-tray';

        parent.insertBefore(wrap, firstBtn);
        wrap.appendChild(toggleBtn);
        wrap.appendChild(tray);

        foundBtns.forEach(btn => {
            // Pastikan tombol punya tooltip informatif saat menjadi icon-only di HP
            if (!btn.getAttribute('title')) {
                const txt = (btn.textContent || '').replace(/\s+/g, ' ').trim();
                if (txt) btn.setAttribute('title', txt);
            }
            tray.appendChild(btn);
        });
    });

    // 3. Bangun Grup Logo Filter -> Slide Drawer dari Kanan ke Kiri
    MOBILE_FILTER_GROUP_SPECS.forEach(spec => {
        const resolvedItems = [];
        spec.items.forEach(it => {
            const rawEl = document.querySelector(it.selector);
            if (!rawEl) return;
            const moveEl = it.wrapParent && rawEl.parentElement ? rawEl.parentElement : rawEl;
            if (it.isPeriodBox) moveEl.classList.add('mob-flt-period-box');
            if (it.isInlineBtn) moveEl.classList.add('mob-flt-inline-btn');
            if (it.companionLabelFor) {
                const compLbl = document.querySelector(`label[for="${it.companionLabelFor}"]`);
                if (compLbl) compLbl.classList.add('hidden', 'lg:inline');
            }
            // Pada Roster Daily, label desktop di dalam wrapper ikut tersembunyi di dalam drawer karena drawer punya label seragam
            if (it.wrapParent) {
                const innerLbl = moveEl.querySelector('label');
                if (innerLbl) innerLbl.classList.add('hidden', 'lg:inline');
            }
            resolvedItems.push({
                el: moveEl,
                controlEl: rawEl,
                label: it.label
            });
        });

        if (!resolvedItems.length) return;
        const firstEl = resolvedItems[0].el;
        const parent = firstEl.parentNode;
        if (!parent) return;

        // Buat tombol Logo Filter khusus mode HP tepat sebelum elemen filter pertama
        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.className = 'mob-flt-trigger lg:hidden inline-flex items-center justify-center relative w-8 h-8 rounded-full border border-gray-200 bg-white hover:bg-teal-50 text-gray-600 hover:text-teal-700 shadow-2xs transition-colors shrink-0';
        triggerBtn.dataset.mobFltKey = spec.key;
        triggerBtn.title = spec.title || 'Filter';
        triggerBtn.innerHTML = `
            <i class="fa-solid fa-filter text-[11px]"></i>
            <span class="mob-flt-dot hidden absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-teal-500 ring-2 ring-white"></span>
        `;
        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openMobileFilterDrawer(spec.key);
        });

        parent.insertBefore(triggerBtn, firstEl);

        // Tandai setiap kontrol filter agar di HP tersembunyi (masuk drawer) tanpa mengubah posisi DOM di Desktop
        resolvedItems.forEach(item => {
            item.el.classList.add('mob-flt-hidden-mobile');
        });

        mobileFilterGroupRegistry.set(spec.key, {
            key: spec.key,
            title: spec.title,
            triggerBtn,
            items: resolvedItems
        });
    });

    // Listener global: sinkronisasi field dinamis (mis. ATR mode Weekly <-> Monthly) saat berubah di dalam drawer
    const sheetBody = document.getElementById('mob-filter-sheet-body');
    if (sheetBody) {
        sheetBody.addEventListener('change', () => {
            setTimeout(() => {
                syncMobileFilterFieldVisibility();
                updateMobileFilterActiveDots();
            }, 0);
        });
    }

    // Tutup tray aksi panah '>' ketika klik di luar
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.mob-act-wrap')) {
            closeAllMobileActionGroups();
        }
    });

    // Tutup drawer & tray saat tekan Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileFilterDrawer();
            closeAllMobileActionGroups();
        }
    });

    syncMobileActionGroupVisibility();
    updateMobileFilterActiveDots();
}

/* =====================================================================
 * 5B. EFEK TRANSPARAN GLOSSY MOBILE BOTTOM BAR SAAT MENU DI-SCROLL
 * ===================================================================== */

let _mobDockScrollRaf = 0;

function hasActiveSectionScrolledContent() {
    const winY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (winY > 4) return true;

    const activeSec = document.querySelector('main section.spa-section:not(.hidden)');
    if (!activeSec) return false;

    const scrollables = activeSec.querySelectorAll('.overflow-y-auto, .overflow-auto, .overflow-x-auto');
    for (let i = 0; i < scrollables.length; i++) {
        const el = scrollables[i];
        if (el.scrollTop > 4 || el.scrollLeft > 4) {
            return true;
        }
    }
    return false;
}

function syncMobileDockScrollState() {
    const nav = document.getElementById('mobile-bottom-nav');
    if (!nav) return;
    nav.classList.toggle('is-scrolled', hasActiveSectionScrolledContent());
}

function initMobileDockScrollGlass() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (window.__pantauMobDockScrollReady) return;
    window.__pantauMobDockScrollReady = true;

    const scheduleSync = (ev) => {
        const target = ev && ev.target;
        if (target && target !== document && target !== window && target.closest) {
            if (target.closest('div[id^="modal-"], #mobile-submenu-drawer, #mob-filter-sheet-portal')) {
                return;
            }
        }
        if (_mobDockScrollRaf) return;
        _mobDockScrollRaf = requestAnimationFrame(() => {
            _mobDockScrollRaf = 0;
            syncMobileDockScrollState();
        });
    };

    window.addEventListener('scroll', scheduleSync, { passive: true });
    document.addEventListener('scroll', scheduleSync, { capture: true, passive: true });
    syncMobileDockScrollState();
}

/* =====================================================================
 * 6. APPLY ROLE & NAVIGASI TERPADU (DIPANGGIL SAAT LOGIN / GANTI ROLE / INIT)
 * ===================================================================== */

function applyRoleAccessAndNavigationUi() {
    const role = getNormalizedAccessRole();
    syncDesktopSidebarForRole(role);

    const check = resolveAllowedNavigationTarget(currentSection, currentSubSection);
    if (check.redirected) {
        navigateTo(check.section, check.subSection || null);
        return;
    }

    updateMobileNavigationUi(currentSection, currentSubSection);
    syncMobileActionGroupVisibility();
    if (currentSection === 'profil') renderProfilSection();
    if (currentSection === 'searching') renderGlobalSearchResults();
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        initMobileMinimalToolbars();
        initMobileDockScrollGlass();
        setTimeout(() => {
            applyRoleAccessAndNavigationUi();
        }, 40);
    });
}

if (typeof window !== 'undefined') {
    let _lastDesktopState = isDesktopViewport();
    window.addEventListener('resize', () => {
        const nowDesktop = isDesktopViewport();
        if (nowDesktop !== _lastDesktopState) {
            _lastDesktopState = nowDesktop;
            if (nowDesktop) {
                closeMobileFilterDrawer(true);
                closeAllMobileActionGroups();
                if (currentSection === 'profil') {
                    navigateTo('informasi');
                }
            }
        }
    });
}
