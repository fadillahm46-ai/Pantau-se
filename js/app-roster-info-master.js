/* =====================================================================
 * 7. ROSTER SE & SORTIR TABEL GENERIK 3-KLIK
 * ===================================================================== */
let activeRosterSubMenu = 'all';

const ROSTER_SUBMENU_CONFIG = {
    'all': {
        label: 'Semua Jabatan',
        roleWord: 'operator',
        defaultJabatan: 'Operator Crane',
        usesUnit: true,
        match: () => true,
        unitMatch: () => true
    },
    'gl': {
        label: 'GL',
        roleWord: 'GL',
        defaultJabatan: 'Group Leader',
        usesUnit: false,
        match: (j) => j.includes('group leader') || j === 'gl' || j.includes('pengawas'),
        unitMatch: () => false
    },
    'admin': {
        label: 'Admin',
        roleWord: 'Admin',
        defaultJabatan: 'Admin',
        usesUnit: false,
        match: (j) => j.includes('admin'),
        unitMatch: () => false
    },
    'operator-crane': {
        label: 'Operator Crane',
        roleWord: 'Operator Crane',
        defaultJabatan: 'Operator Crane',
        usesUnit: true,
        match: (j) => j.includes('crane'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /\bcrane\b|tadano|kobelco|grove|kato|liebherr|sany|xcmg/.test(txt) || /^cr[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'operator-telehandler': {
        label: 'Operator Telehandler',
        roleWord: 'Operator Telehandler',
        defaultJabatan: 'Operator Telehandler',
        usesUnit: true,
        match: (j) => j.includes('telehandler'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /telehandler|jcb|manitou|merlo/.test(txt) || /^th[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'operator-forklift': {
        label: 'Operator Forklift',
        roleWord: 'Operator Forklift',
        defaultJabatan: 'Operator Forklift',
        usesUnit: true,
        match: (j) => j.includes('forklift'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /forklift/.test(txt) || /^(fl|fkl)[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'operator-lt-wt': {
        label: 'Operator LT & WT',
        roleWord: 'Operator LT & WT',
        defaultJabatan: 'Operator LT & WT',
        usesUnit: true,
        match: (j) => j.includes('lt') || j.includes('wt'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return u.kategori_unit === 'lt_wt' || /lube|water/.test(txt) || /^(lt|wt)[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'operator-exca-dozer': {
        label: 'Operator Exca & Dozer',
        roleWord: 'Operator Exca & Dozer',
        defaultJabatan: 'Operator Exca & Dozer',
        usesUnit: true,
        match: (j) => j.includes('exca') || j.includes('dozer'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /\b(exca|excavator|dozer|bulldozer)\b|\bpc\s?\d+/.test(txt) || /^(ex|dz|pc)[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'driver-truck': {
        label: 'Driver Truck',
        roleWord: 'Driver Truck',
        defaultJabatan: 'Driver Truck',
        usesUnit: true,
        match: (j) => j.includes('driver'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /dump\s*truck|lowboy|flatbed|hiab|prime\s*mover|trailer/.test(txt) || /^(dt|lb|ft|tr)[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'rigger-lowboy': {
        label: 'Rigger & Helper Lowboy',
        roleWord: 'Rigger & Helper Lowboy',
        defaultJabatan: 'Rigger & Helper Lowboy',
        usesUnit: true,
        match: (j) => j.includes('rigger') || j.includes('lowboy') || j.includes('helper'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /\bcrane\b|lowboy|tadano|kobelco|grove|kato/.test(txt) || /^(cr|lb)[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'oilman': {
        label: 'Oilman',
        roleWord: 'Oilman',
        defaultJabatan: 'Oilman',
        usesUnit: true,
        match: (j) => j.includes('oilman'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /lube/.test(txt) || /^lt[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    },
    'washingman': {
        label: 'Washingman',
        roleWord: 'Washingman',
        defaultJabatan: 'Washingman',
        usesUnit: true,
        match: (j) => j.includes('washing'),
        unitMatch: (u) => {
            const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
            return /water|wash/.test(txt) || /^wt[\s\-0-9]/i.test(String(u.no_unit || '').trim());
        }
    }
};

const DAYS_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

/* =====================================================================
 * 7A. SISTEM PIC PER ROSTER & KUNCI HAK AKSES EDIT (ADMIN / GL PIC / PASSWORD PIC)
 * ===================================================================== */
const ROSTER_PIC_STORAGE_KEY = 'pantau_se_roster_pic_v1';
let rosterPicConfigState = {};          // { [subMenuKey]: { nrp, nama } }
let rosterPicConfigLoaded = false;
const rosterPicUnlockedGrants = new Map(); // scopeKey -> { picNrp, picNama, unlockedAt }
let pendingRosterPicUnlock = null;      // { scopeKey, pic, onAuthorized }

function getRosterPicSubMenuKeys() {
    return Object.keys(ROSTER_SUBMENU_CONFIG).filter(k => k !== 'all');
}

function getRosterPicGlCandidates() {
    const list = (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) ? manpowerState : [];
    return list
        .filter(mp => {
            const role = String(mp?.jabatan || '').trim().toLowerCase();
            return role === 'group leader' || role.includes('group leader') || role === 'gl' || role.startsWith('gl ') || role.includes('pengawas') || role.includes('section');
        })
        .sort((a, b) => String(a.nama || '').localeCompare(String(b.nama || ''), 'id'));
}

function getRosterSubMenuKeyForJabatan(jabatan) {
    const keys = getRosterPicSubMenuKeys();
    for (let i = 0; i < keys.length; i++) {
        if (matchesRosterSubMenu(jabatan, keys[i])) return keys[i];
    }
    return 'all';
}

function saveRosterPicConfigToLocal() {
    try {
        localStorage.setItem(ROSTER_PIC_STORAGE_KEY, JSON.stringify(rosterPicConfigState || {}));
    } catch (_) { /* abaikan bila storage penuh */ }
}

function ensureRosterPicConfigLoaded() {
    if (rosterPicConfigLoaded) return;
    rosterPicConfigLoaded = true;
    try {
        const raw = localStorage.getItem(ROSTER_PIC_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                rosterPicConfigState = parsed;
            }
        }
    } catch (_) { /* abaikan */ }
}

function hydrateRosterPicFromSupabase(rows) {
    if (!Array.isArray(rows)) return;
    const next = {};
    rows.forEach(r => {
        const key = String(r.submenu_key || '').trim();
        if (!key) return;
        const nrp = String(r.pic_nrp || '').trim();
        const nama = String(r.pic_nama || '').trim();
        if (nrp || nama) {
            next[key] = { nrp, nama };
        }
    });
    rosterPicConfigState = next;
    rosterPicConfigLoaded = true;
    saveRosterPicConfigToLocal();
}

function getRosterPicSupabasePayload() {
    ensureRosterPicConfigLoaded();
    const actor = getCurrentRosterActor();
    const updatedBy = actor.nama || 'Admin SE';
    return getRosterPicSubMenuKeys().map(key => {
        const rec = rosterPicConfigState[key];
        return {
            submenu_key: key,
            pic_nrp: rec?.nrp || '',
            pic_nama: rec?.nama || '',
            updated_by: updatedBy
        };
    });
}

function getCurrentRosterActor() {
    const activeProf = (typeof getActiveUserProfile === 'function') ? getActiveUserProfile() : null;
    const authSess = (typeof getPantauAuthSession === 'function') ? getPantauAuthSession() : null;
    const isRealAdmin = Boolean(authSess && String(authSess.type || '').toLowerCase() === 'admin');
    const src = (isRealAdmin && activeProf) ? activeProf : (authSess || activeProf || { type: 'karyawan', nrp: '', nama: '' });
    const roleType = String(src.type || 'karyawan').toLowerCase();
    return {
        type: roleType,
        nrp: String(src.nrp || '').trim(),
        nama: String(src.nama || '').trim(),
        jabatan: String(src.jabatan || '').trim(),
        isAdmin: roleType === 'admin'
    };
}

function getRosterPicForScope(scopeKey) {
    ensureRosterPicConfigLoaded();
    const rec = rosterPicConfigState[scopeKey];
    if (!rec || (!rec.nrp && !rec.nama)) return null;
    const nrpClean = String(rec.nrp || '').trim();
    const mpList = (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) ? manpowerState : [];
    const matchedMp = nrpClean
        ? mpList.find(m => String(m.nrp || '').trim().toLowerCase() === nrpClean.toLowerCase())
        : mpList.find(m => String(m.nama || '').trim().toLowerCase() === String(rec.nama || '').trim().toLowerCase());
    return {
        nrp: matchedMp ? String(matchedMp.nrp || '').trim() : nrpClean,
        nama: matchedMp ? String(matchedMp.nama || '').trim() : String(rec.nama || '').trim(),
        mp: matchedMp || null
    };
}

function clearRosterPicUnlockedGrants() {
    rosterPicUnlockedGrants.clear();
    pendingRosterPicUnlock = null;
}

function hasRosterEditAccess(scopeKey = activeRosterSubMenu) {
    const actor = getCurrentRosterActor();
    const pic = getRosterPicForScope(scopeKey);
    if (actor.isAdmin) {
        return { allowed: true, reason: 'admin', scopeKey, pic, actor };
    }
    if (!pic || !pic.nrp) {
        return { allowed: false, reason: 'no_pic', scopeKey, pic: null, actor };
    }
    if (actor.nrp && actor.nrp.toLowerCase() === pic.nrp.toLowerCase()) {
        return { allowed: true, reason: 'pic_owner', scopeKey, pic, actor };
    }
    const grant = rosterPicUnlockedGrants.get(scopeKey);
    if (grant && String(grant.picNrp || '').toLowerCase() === pic.nrp.toLowerCase()) {
        return { allowed: true, reason: 'pic_password', scopeKey, pic, actor };
    }
    return { allowed: false, reason: 'locked', scopeKey, pic, actor };
}

function hasRosterRowEditAccess(row) {
    const actor = getCurrentRosterActor();
    if (actor.isAdmin) {
        const sc = activeRosterSubMenu !== 'all' ? activeRosterSubMenu : getRosterSubMenuKeyForJabatan(row?.jabatan);
        return { allowed: true, reason: 'admin', scopeKey: sc, pic: getRosterPicForScope(sc), actor };
    }
    const targetScope = activeRosterSubMenu !== 'all'
        ? activeRosterSubMenu
        : getRosterSubMenuKeyForJabatan(row?.jabatan);
    return hasRosterEditAccess(targetScope);
}

function requireRosterEditAccess(scopeKey = activeRosterSubMenu, row = null, onAuthorized = null) {
    const check = row ? hasRosterRowEditAccess(row) : hasRosterEditAccess(scopeKey);
    if (check.allowed) {
        return true;
    }
    if (check.reason === 'no_pic') {
        if (check.scopeKey === 'all') {
            showToast('Pada tab Semua, hanya Admin yang memiliki akses penuh. Buka tab kategori roster masing-masing untuk edit sesuai PIC.', 'info');
        } else {
            const subLabel = ROSTER_SUBMENU_CONFIG[check.scopeKey]?.label || check.scopeKey;
            showToast(`PIC Roster ${subLabel} belum ditentukan. Hubungi Admin untuk mengatur PIC terlebih dahulu.`, 'error');
        }
        return false;
    }
    openRosterPicPasswordModal(check.scopeKey, check.pic, onAuthorized);
    return false;
}

function verifyRosterBulkDeleteAccess(rowIdSet, onAuthorized = null) {
    if (!rowIdSet || !rowIdSet.size) return true;
    const actor = getCurrentRosterActor();
    if (actor.isAdmin) return true;
    const targetRows = rosterState.filter(r => rowIdSet.has(Number(r.id)));
    for (let i = 0; i < targetRows.length; i++) {
        const check = hasRosterRowEditAccess(targetRows[i]);
        if (!check.allowed) {
            requireRosterEditAccess(check.scopeKey, targetRows[i], onAuthorized);
            return false;
        }
    }
    return true;
}

function handleLockedRosterCellClick(event, rowId) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    if (!row) return;
    const check = hasRosterRowEditAccess(row);
    if (check.allowed) return;
    if (event) event.preventDefault();
    requireRosterEditAccess(check.scopeKey, row);
}

function lockRosterPicAccess(scopeKey = activeRosterSubMenu) {
    rosterPicUnlockedGrants.delete(scopeKey);
    renderRosterTable();
    const subLabel = ROSTER_SUBMENU_CONFIG[scopeKey]?.label || 'Roster';
    showToast(`Izin edit sementara untuk Roster ${subLabel} dikunci kembali.`, 'info');
}

function openRosterPicPasswordModal(scopeKey = activeRosterSubMenu, picOverride = null, onAuthorized = null) {
    const pic = picOverride || getRosterPicForScope(scopeKey);
    const subLabel = ROSTER_SUBMENU_CONFIG[scopeKey]?.label || scopeKey;
    if (!pic || !pic.nrp) {
        showToast(`PIC Roster ${subLabel} belum ditentukan. Hubungi Admin.`, 'error');
        return;
    }

    pendingRosterPicUnlock = { scopeKey, pic, onAuthorized };

    const scopeEl = document.getElementById('roster-pic-pwd-scope');
    const nameEl = document.getElementById('roster-pic-pwd-pic-name');
    const errBox = document.getElementById('roster-pic-pwd-error');
    const errTxt = document.getElementById('roster-pic-pwd-error-text');
    const inp = document.getElementById('roster-pic-pwd-input');
    const eye = document.getElementById('roster-pic-pwd-eye');

    if (scopeEl) scopeEl.textContent = `Roster ${subLabel}`;
    if (nameEl) nameEl.textContent = `PIC : ${pic.nama} (NRP ${pic.nrp})`;
    if (errBox) errBox.classList.add('hidden');
    if (errTxt) errTxt.textContent = '';
    if (inp) { inp.value = ''; inp.type = 'password'; }
    if (eye) eye.className = 'fa-regular fa-eye text-xs';

    const modal = document.getElementById('modal-roster-pic-password');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => inp?.focus(), 40);
    }
}

function closeRosterPicPasswordModal() {
    pendingRosterPicUnlock = null;
    const modal = document.getElementById('modal-roster-pic-password');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function toggleRosterPicPwdVisibility() {
    const inp = document.getElementById('roster-pic-pwd-input');
    const eye = document.getElementById('roster-pic-pwd-eye');
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    if (eye) eye.className = isHidden ? 'fa-regular fa-eye-slash text-xs text-teal-600' : 'fa-regular fa-eye text-xs';
}

async function resolveExpectedPasswordForNrp(targetNrp) {
    const cleanNrp = String(targetNrp || '').trim();
    if (!cleanNrp) return '';
    const nrpLower = cleanNrp.toLowerCase();

    // 1. Cek data terbaru dari Supabase bila dikonfigurasi (agar reset password terbaru selalu terbaca)
    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && typeof supabaseSelect === 'function') {
        try {
            const remote = await supabaseSelect('manpower', `select=nrp,password&nrp=eq.${encodeURIComponent(cleanNrp)}&limit=1`);
            if (Array.isArray(remote) && remote.length > 0) {
                const remotePwd = String(remote[0].password || '').trim();
                if (remotePwd) return remotePwd;
            }
        } catch (_) { /* fallback ke lokal */ }
    }

    // 2. Cek override lokal dari fitur Lupa Password
    if (typeof readPasswordOverrides === 'function') {
        const overrides = readPasswordOverrides();
        if (overrides && overrides[nrpLower]) return String(overrides[nrpLower]).trim();
    }

    // 3. Cek dari pool manpower lokal
    const pool = (typeof getManpowerCandidatePool === 'function')
        ? getManpowerCandidatePool()
        : ((typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) ? manpowerState : []);
    const matched = pool.find(m => String(m.nrp || '').trim().toLowerCase() === nrpLower);
    return String(matched?.password || '').trim() || cleanNrp;
}

async function handleRosterPicPasswordSubmit(event) {
    event.preventDefault();
    if (!pendingRosterPicUnlock) {
        closeRosterPicPasswordModal();
        return;
    }

    const { scopeKey, pic, onAuthorized } = pendingRosterPicUnlock;
    const inputPwd = String(document.getElementById('roster-pic-pwd-input')?.value || '').trim();
    const errBox = document.getElementById('roster-pic-pwd-error');
    const errTxt = document.getElementById('roster-pic-pwd-error-text');
    const btn = document.getElementById('btn-roster-pic-pwd-submit');
    const lbl = document.getElementById('btn-roster-pic-pwd-label');

    const showErr = (msg) => {
        if (errTxt) errTxt.textContent = msg;
        if (errBox) errBox.classList.remove('hidden');
    };

    if (!inputPwd) {
        showErr('Harap masukkan password akun PIC terlebih dahulu.');
        return;
    }

    if (btn) btn.disabled = true;
    if (lbl) lbl.textContent = 'Memeriksa...';

    try {
        const expectedPwd = await resolveExpectedPasswordForNrp(pic.nrp);
        if (!expectedPwd || inputPwd !== expectedPwd) {
            showErr(`Password PIC (${pic.nama}) tidak sesuai. Silakan konfirmasi izin ke PIC terkait.`);
            const inp = document.getElementById('roster-pic-pwd-input');
            if (inp) { inp.select(); inp.focus(); }
            return;
        }

        rosterPicUnlockedGrants.set(scopeKey, {
            picNrp: pic.nrp,
            picNama: pic.nama,
            unlockedAt: Date.now()
        });

        const cb = onAuthorized;
        closeRosterPicPasswordModal();
        renderRosterTable();

        const subLabel = ROSTER_SUBMENU_CONFIG[scopeKey]?.label || scopeKey;
        showToast(`Izin edit disetujui oleh PIC ${pic.nama}. Roster ${subLabel} kini dapat diedit.`, 'success');
        if (typeof cb === 'function') {
            setTimeout(() => cb(), 30);
        }
    } finally {
        if (btn) btn.disabled = false;
        if (lbl) lbl.textContent = 'Buka Edit';
    }
}

function openRosterPicManageModal() {
    const actor = getCurrentRosterActor();
    if (!actor.isAdmin) {
        showToast('Hanya Admin yang dapat mengatur PIC masing-masing Roster.', 'error');
        return;
    }
    ensureRosterPicConfigLoaded();
    const listEl = document.getElementById('roster-pic-manage-list');
    if (!listEl) return;

    const gls = getRosterPicGlCandidates();
    const keys = getRosterPicSubMenuKeys();

    listEl.innerHTML = keys.map(key => {
        const cfg = ROSTER_SUBMENU_CONFIG[key];
        const currentPic = getRosterPicForScope(key);
        const currentNrp = currentPic?.nrp || '';
        const isCurrentTab = key === activeRosterSubMenu;
        const optsHtml = ['<option value="">— Belum Ditentukan —</option>'].concat(
            gls.map(gl => {
                const sel = String(gl.nrp).trim().toLowerCase() === currentNrp.toLowerCase() ? 'selected' : '';
                return `<option value="${escapeHtml(gl.nrp)}" ${sel}>${escapeHtml(gl.nama)} (${escapeHtml(gl.nrp)})</option>`;
            })
        ).join('');

        return `
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border ${isCurrentTab ? 'bg-teal-50/70 border-teal-300' : 'bg-gray-50/70 border-gray-200/80'}">
                <div class="min-w-0">
                    <p class="text-xs font-bold ${isCurrentTab ? 'text-teal-800' : 'text-gray-800'} flex items-center gap-1.5">
                        <span>${escapeHtml(cfg.label)}</span>
                        ${isCurrentTab ? '<span class="px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[8px] font-bold">Aktif</span>' : ''}
                    </p>
                </div>
                <select data-pic-submenu="${escapeHtml(key)}"
                    class="sm:w-56 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500">
                    ${optsHtml}
                </select>
            </div>
        `;
    }).join('');

    const modal = document.getElementById('modal-roster-pic-manage');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeRosterPicManageModal() {
    const modal = document.getElementById('modal-roster-pic-manage');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleSaveRosterPicManage(event) {
    event.preventDefault();
    const actor = getCurrentRosterActor();
    if (!actor.isAdmin) {
        showToast('Hanya Admin yang dapat menyimpan pengaturan PIC Roster.', 'error');
        return;
    }

    const gls = getRosterPicGlCandidates();
    const selects = document.querySelectorAll('#roster-pic-manage-list select[data-pic-submenu]');
    selects.forEach(sel => {
        const key = sel.getAttribute('data-pic-submenu');
        if (!key) return;
        const selectedNrp = String(sel.value || '').trim();
        const prevNrp = String(rosterPicConfigState[key]?.nrp || '').trim();
        if (!selectedNrp) {
            delete rosterPicConfigState[key];
            rosterPicUnlockedGrants.delete(key);
        } else {
            const gl = gls.find(g => String(g.nrp || '').trim().toLowerCase() === selectedNrp.toLowerCase());
            rosterPicConfigState[key] = {
                nrp: gl ? String(gl.nrp).trim() : selectedNrp,
                nama: gl ? String(gl.nama).trim() : selectedNrp
            };
            if (prevNrp.toLowerCase() !== selectedNrp.toLowerCase()) {
                rosterPicUnlockedGrants.delete(key);
            }
        }
    });

    rosterPicConfigLoaded = true;
    saveRosterPicConfigToLocal();
    if (typeof pushRosterPicToSupabase === 'function') {
        pushRosterPicToSupabase();
    }

    closeRosterPicManageModal();
    renderRosterTable();
    showToast('Pengaturan PIC masing-masing Roster berhasil disimpan.', 'success');
}

function renderRosterPicBar() {
    const wrap = document.getElementById('roster-legend-wrap');
    if (!wrap) return;
    ensureRosterPicConfigLoaded();

    const actor = getCurrentRosterActor();
    const isAllTab = activeRosterSubMenu === 'all';

    if (isAllTab) {
        const ownedTabs = !actor.isAdmin && actor.nrp
            ? getRosterPicSubMenuKeys().filter(k => {
                const p = getRosterPicForScope(k);
                return p && p.nrp.toLowerCase() === actor.nrp.toLowerCase();
            }).map(k => ROSTER_SUBMENU_CONFIG[k]?.label || k)
            : [];

        const picLabelHtml = `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-800 shadow-2xs">
                <i class="fa-solid fa-user-tie text-teal-600 text-[10px]"></i>
                <span class="text-gray-500 font-semibold">PIC :</span>
                <span class="font-bold text-gray-900">Sesuai Masing-Masing Roster</span>
            </span>
        `;

        let statusHtml = '';
        if (actor.isAdmin) {
            statusHtml = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[9px] font-bold">
                    <i class="fa-solid fa-shield-halved text-[8.5px]"></i>
                    <span>Full Akses Admin</span>
                </span>
                <button type="button" onclick="openRosterPicManageModal()"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-teal-700 text-[9.5px] font-semibold transition-colors cursor-pointer">
                    <i class="fa-solid fa-sliders text-[9px]"></i>
                    <span>Atur PIC</span>
                </button>
            `;
        } else if (ownedTabs.length > 0) {
            statusHtml = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold" title="Anda dapat langsung mengedit baris pada: ${escapeHtml(ownedTabs.join(', '))}">
                    <i class="fa-solid fa-lock-open text-[8.5px]"></i>
                    <span>PIC: ${escapeHtml(ownedTabs.slice(0, 2).join(', '))}${ownedTabs.length > 2 ? ` +${ownedTabs.length - 2}` : ''}</span>
                </span>
            `;
        } else {
            statusHtml = `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold">
                    <i class="fa-solid fa-lock text-[8.5px]"></i>
                    <span>Edit Perlu Izin PIC</span>
                </span>
            `;
        }

        wrap.innerHTML = `${picLabelHtml}${statusHtml}`;
        return;
    }

    const access = hasRosterEditAccess(activeRosterSubMenu);
    const pic = access.pic;
    const picDisplayName = pic ? pic.nama : 'Belum Ditentukan';

    const picBadgeHtml = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-800 shadow-2xs">
            <i class="fa-solid fa-user-tie text-teal-600 text-[10px]"></i>
            <span class="text-gray-500 font-semibold">PIC :</span>
            <span class="font-bold ${pic ? 'text-gray-900' : 'text-gray-400 italic'}">${escapeHtml(picDisplayName)}</span>
        </span>
    `;

    let rightHtml = '';
    if (actor.isAdmin) {
        rightHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[9px] font-bold">
                <i class="fa-solid fa-shield-halved text-[8.5px]"></i>
                <span>Full Akses Admin</span>
            </span>
            <button type="button" onclick="openRosterPicManageModal()"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-teal-700 text-[9.5px] font-semibold transition-colors cursor-pointer">
                <i class="fa-solid fa-pen-to-square text-[9px]"></i>
                <span>Atur PIC</span>
            </button>
        `;
    } else if (access.reason === 'pic_owner') {
        rightHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">
                <i class="fa-solid fa-lock-open text-[8.5px]"></i>
                <span>Akses Edit PIC Aktif</span>
            </span>
        `;
    } else if (access.reason === 'pic_password') {
        rightHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[9px] font-bold">
                <i class="fa-solid fa-key text-[8.5px]"></i>
                <span>Izin PIC Aktif</span>
            </span>
            <button type="button" onclick="lockRosterPicAccess('${escapeJsString(activeRosterSubMenu)}')"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-600 hover:text-red-600 text-[9px] font-semibold transition-colors cursor-pointer">
                <i class="fa-solid fa-lock text-[8.5px]"></i>
                <span>Kunci</span>
            </button>
        `;
    } else if (pic) {
        rightHtml = `
            <button type="button" onclick="openRosterPicPasswordModal('${escapeJsString(activeRosterSubMenu)}')"
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-teal-50 border border-gray-200 hover:border-teal-300 text-teal-700 text-[9.5px] font-semibold transition-colors cursor-pointer">
                <i class="fa-solid fa-pen text-[8.5px]"></i>
                <span>Edit</span>
            </button>
        `;
    } else {
        rightHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 text-[9px] font-semibold">
                <i class="fa-solid fa-lock text-[8.5px]"></i>
                <span>Terkunci · Hubungi Admin</span>
            </span>
        `;
    }

    wrap.innerHTML = `${picBadgeHtml}${rightHtml}`;
}

function syncRosterEditToolbarState() {
    const scopeAccess = hasRosterEditAccess(activeRosterSubMenu);
    const canEditActiveScope = scopeAccess.allowed;
    const addIcon = document.getElementById('btn-roster-add-person-icon');
    const upIcon = document.getElementById('btn-roster-upload-icon');
    const addBtn = document.getElementById('btn-roster-add-person');
    const upBtn = document.getElementById('btn-roster-upload');
    const blockBtn = document.getElementById('btn-roster-block-mode');

    if (addIcon) addIcon.className = canEditActiveScope ? 'fa-solid fa-user-plus' : 'fa-solid fa-lock text-[9px]';
    if (upIcon) upIcon.className = canEditActiveScope ? 'fa-solid fa-file-excel' : 'fa-solid fa-lock text-[9px]';
    if (addBtn) addBtn.title = canEditActiveScope ? 'Tambah personil ke roster' : 'Perlu akses PIC / Password PIC untuk menambah personil';
    if (upBtn) upBtn.title = canEditActiveScope ? 'Upload file Excel roster' : 'Perlu akses PIC / Password PIC untuk upload roster';
    if (blockBtn) {
        const actor = getCurrentRosterActor();
        const hasAnyRowAccess = canEditActiveScope || (activeRosterSubMenu === 'all' && !actor.isAdmin && getRosterPicSubMenuKeys().some(k => hasRosterEditAccess(k).allowed));
        blockBtn.classList.toggle('hidden', !hasAnyRowAccess);
        if (!hasAnyRowAccess && rosterTouchBlockMode) {
            rosterTouchBlockMode = false;
            document.getElementById('table-roster')?.classList.remove('roster-touch-block-mode');
        }
    }
}

function matchesRosterSubMenu(jabatan, subMenuKey) {
    const cfg = ROSTER_SUBMENU_CONFIG[subMenuKey] || ROSTER_SUBMENU_CONFIG.all;
    if (subMenuKey === 'all') return true;
    return cfg.match(String(jabatan || '').trim().toLowerCase());
}

function getScopedUnitsForRosterSubMenu(subMenuKey, scopedRoster) {
    const cfg = ROSTER_SUBMENU_CONFIG[subMenuKey] || ROSTER_SUBMENU_CONFIG.all;
    if (subMenuKey === 'all') return komisioningState;
    if (!cfg.usesUnit) return [];

    const assignedKeys = new Set(
        (scopedRoster || [])
            .map(r => normalizeUnitKey(r.unit))
            .filter(k => k && k !== '-')
    );

    return komisioningState.filter(u => {
        const uKey = normalizeUnitKey(u.no_unit);
        return assignedKeys.has(uKey) || (typeof cfg.unitMatch === 'function' && cfg.unitMatch(u));
    });
}

function getRosterActiveMonthYear() {
    const monthIdx = parseInt(document.getElementById('roster-filter-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('roster-filter-year')?.value || '2026', 10);
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    return { monthIdx, year, ymKey: `${year}-${monthIdx}`, daysInMonth };
}

function countRosterOffDays(scheduleMap, daysInMonth) {
    if (!scheduleMap) return 0;
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const raw = String(scheduleMap[d] || '').trim().toUpperCase();
        if (!raw) continue;
        const rule = resolveRosterCodeRule(raw);
        if (rule?.artiSistem === 'LIBUR' || /^O+FF/.test(raw)) count++;
    }
    return count;
}

/**
 * Palet warna pekat Roster (dipakai seragam di Web & Download Excel .xlsx):
 * - DWS / Shift 1 (Awalan D): Putih (#FFFFFF) teks hitam pekat
 * - NWS / Shift 2 (Awalan N): Hijau pekat (#006740) teks putih
 * - OFF / OOFF (Libur)      : Merah pekat (#FF0000) teks putih
 * - CCUTI / CUTI            : Biru pekat (#00B0F0) teks hitam pekat
 * - INDK (Induksi)          : Kuning-Amber pekat (#FFC000) teks hitam pekat
 * - MCU                     : Ungu pekat (#7030A0) teks putih
 * - TR (Training)           : Kuning pekat (#FFFF00) teks hitam pekat
 * - SAKIT / IZIN            : Oranye pekat (#ED7D31) teks putih
 */
const ROSTER_SHIFT2_HEX = '006740';

function getRosterCodePalette(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code || code === '-') {
        return {
            cellCls: 'bg-white text-gray-300',
            fillHex: 'FFFFFF',
            fontHex: '9CA3AF',
            bold: false,
            tooltip: 'Klik untuk isi kode roster'
        };
    }
    const rule = resolveRosterCodeRule(code);
    const arti = rule?.artiSistem || '';
    const tooltip = rule ? `${code} — ${rule.keterangan}` : code;

    if (arti === 'LIBUR' || /^O+FF/.test(code)) {
        return { cellCls: 'bg-[#FF0000] text-white font-bold', fillHex: 'FF0000', fontHex: 'FFFFFF', bold: true, tooltip };
    }
    if (arti === 'CUTI' || code.startsWith('CCUTI') || code.startsWith('CUTI')) {
        return { cellCls: 'bg-[#00B0F0] text-gray-950 font-bold', fillHex: '00B0F0', fontHex: '000000', bold: true, tooltip };
    }
    if (arti === 'INDUKSI' || code.startsWith('INDK') || code.startsWith('INDUKSI')) {
        return { cellCls: 'bg-[#FFC000] text-gray-950 font-bold', fillHex: 'FFC000', fontHex: '000000', bold: true, tooltip };
    }
    if (arti === 'MCU' || code.startsWith('MCU')) {
        return { cellCls: 'bg-[#7030A0] text-white font-bold', fillHex: '7030A0', fontHex: 'FFFFFF', bold: true, tooltip };
    }
    if (arti === 'TRAINING' || code.startsWith('TR')) {
        return { cellCls: 'bg-[#FFFF00] text-gray-950 font-bold', fillHex: 'FFFF00', fontHex: '000000', bold: true, tooltip };
    }
    if (arti === 'SHIFT_2' || code.startsWith('N') || code === 'S2') {
        return { cellCls: 'bg-[#006740] text-white font-bold', fillHex: ROSTER_SHIFT2_HEX, fontHex: 'FFFFFF', bold: true, tooltip };
    }
    if (arti === 'SHIFT_1' || code.startsWith('D') || code === 'S1') {
        return { cellCls: 'bg-white text-gray-900 font-bold', fillHex: 'FFFFFF', fontHex: '000000', bold: true, tooltip };
    }
    if (arti === 'SAKIT' || arti === 'IZIN') {
        return { cellCls: 'bg-[#ED7D31] text-white font-bold', fillHex: 'ED7D31', fontHex: 'FFFFFF', bold: true, tooltip };
    }
    return { cellCls: 'bg-gray-200 text-gray-900 font-semibold', fillHex: 'E5E7EB', fontHex: '111827', bold: true, tooltip };
}

function getRosterCodeCellStyle(rawCode) {
    const p = getRosterCodePalette(rawCode);
    return { cellCls: p.cellCls, tooltip: p.tooltip };
}

function getRosterCodeShiftNumber(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code || code === '-') return 0;
    const rule = resolveRosterCodeRule(code);
    const arti = rule?.artiSistem || '';
    if (
        arti === 'LIBUR' || /^O+FF/.test(code) ||
        arti === 'CUTI' || code.startsWith('CCUTI') || code.startsWith('CUTI') ||
        arti === 'INDUKSI' || code.startsWith('INDK') || code.startsWith('INDUKSI') ||
        arti === 'MCU' || code.startsWith('MCU') ||
        arti === 'TRAINING' || code.startsWith('TR') ||
        arti === 'SAKIT' || arti === 'IZIN'
    ) {
        return 0;
    }
    if (arti === 'SHIFT_2' || code.startsWith('N') || code === 'S2') return 2;
    if (arti === 'SHIFT_1' || code.startsWith('D') || code === 'S1') return 1;
    return 0;
}

function getFilteredRosterRows() {
    const query = (document.getElementById('roster-search')?.value || '').trim().toLowerCase();
    return rosterState.filter(r => {
        if (!matchesRosterSubMenu(r.jabatan, activeRosterSubMenu)) return false;
        if (!query) return true;
        return `${r.nrp} ${r.nama} ${r.jabatan} ${r.unit}`.toLowerCase().includes(query);
    });
}

function renderRosterShiftSummaryFooter(displayRows = null) {
    const tfoot = document.getElementById('roster-table-foot');
    if (!tfoot) return;

    const rows = Array.isArray(displayRows) ? displayRows : getFilteredRosterRows();
    if (!rows.length) {
        tfoot.innerHTML = '';
        return;
    }

    const { monthIdx, year, ymKey, daysInMonth } = getRosterActiveMonthYear();
    const monthName = (typeof MONTH_NAMES_ID !== 'undefined' && MONTH_NAMES_ID[monthIdx]) ? MONTH_NAMES_ID[monthIdx] : '';
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const shift1Counts = new Array(daysInMonth + 1).fill(0);
    const shift2Counts = new Array(daysInMonth + 1).fill(0);

    rows.forEach(r => {
        const sched = r.scheduleByMonth?.[ymKey] || {};
        for (let d = 1; d <= daysInMonth; d++) {
            const shiftNum = getRosterCodeShiftNumber(sched[d]);
            if (shiftNum === 1) shift1Counts[d]++;
            else if (shiftNum === 2) shift2Counts[d]++;
        }
    });

    const shift1Cells = days.map(d => {
        const cnt = shift1Counts[d];
        const titleTxt = `Tgl ${d}${monthName ? ' ' + monthName : ''} ${year} • Shift 1 (Siang): ${cnt} orang`;
        return `<td title="${escapeHtml(titleTxt)}" class="py-2 px-1 text-center font-mono text-[10px] whitespace-nowrap bg-white ${cnt > 0 ? 'font-bold text-gray-800' : 'font-normal text-gray-300'}">${cnt}</td>`;
    }).join('');

    const shift2Cells = days.map(d => {
        const cnt = shift2Counts[d];
        const titleTxt = `Tgl ${d}${monthName ? ' ' + monthName : ''} ${year} • Shift 2 (Malam): ${cnt} orang`;
        return `<td title="${escapeHtml(titleTxt)}" class="py-2 px-1 text-center font-mono text-[10px] whitespace-nowrap bg-[#006740] ${cnt > 0 ? 'font-bold text-white' : 'font-normal text-white/45'}">${cnt}</td>`;
    }).join('');

    tfoot.innerHTML = `
        <tr class="roster-summary-s1 bg-white">
            <td colspan="2" data-bulk-merge-col="1" class="py-2 px-3 sticky left-0 z-20 bg-white border-r-0 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] sm:shadow-none whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-white border border-gray-500 shrink-0"></span>
                    <span class="font-bold tracking-wide text-gray-900 text-[10px]">SHIFT 1</span>
                </div>
            </td>
            <td class="py-2 px-2.5 sm:sticky sm:left-[132px] z-20 bg-white sm:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] text-right whitespace-nowrap">
                <span class="text-[8.5px] font-medium text-gray-500">Siang (DWS)</span>
            </td>
            <td colspan="2" class="py-2 px-2 bg-white whitespace-nowrap"></td>
            ${shift1Cells}
        </tr>
        <tr class="roster-summary-s2 bg-[#006740] text-white">
            <td colspan="2" data-bulk-merge-col="1" class="py-2 px-3 sticky left-0 z-20 bg-[#006740] border-r-0 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] sm:shadow-none whitespace-nowrap">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-white shrink-0"></span>
                    <span class="font-bold tracking-wide text-white text-[10px]">SHIFT 2</span>
                </div>
            </td>
            <td class="py-2 px-2.5 sm:sticky sm:left-[132px] z-20 bg-[#006740] sm:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] text-right whitespace-nowrap">
                <span class="text-[8.5px] font-medium text-white/85">Malam (NWS)</span>
            </td>
            <td colspan="2" class="py-2 px-2 bg-[#006740] whitespace-nowrap"></td>
            ${shift2Cells}
        </tr>
    `;

    const tableEl = document.getElementById('table-roster');
    if (tableEl && typeof decorateTableFooterWithBulkSelect === 'function') {
        decorateTableFooterWithBulkSelect(tableEl);
    }
}

function toggleRosterSort(column) {
    if (rosterSortState.column !== column) rosterSortState = { column, direction: 'desc' };
    else if (rosterSortState.direction === 'desc') rosterSortState.direction = 'asc';
    else rosterSortState = { column: null, direction: 'none' };
    renderRosterTable();
}

function renderRosterTable() {
    const thead = document.getElementById('roster-table-head');
    const tbody = document.getElementById('roster-table-body');
    if (!thead || !tbody) return;

    const { monthIdx, year, ymKey, daysInMonth } = getRosterActiveMonthYear();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    renderRosterLegend();

    const getIconCls = (col) => {
        if (rosterSortState.column === col && rosterSortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (rosterSortState.column === col && rosterSortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };

    thead.innerHTML = `
                <tr class="bg-gray-50 text-[10px] font-semibold text-gray-600">
                    <th rowspan="2" class="py-2 px-2 text-center sticky left-0 z-20 bg-gray-50 w-[44px] min-w-[44px] max-w-[44px] whitespace-nowrap">NO</th>
                    <th rowspan="2" onclick="toggleRosterSort('nrp')" class="py-2 px-2.5 cursor-pointer select-none hover:bg-gray-100 sticky left-[44px] z-20 bg-gray-50 w-[88px] min-w-[88px] max-w-[88px] whitespace-nowrap">
                        <div class="flex items-center justify-between gap-1"><span>NRP</span><i class="fa-solid ${getIconCls('nrp')} text-[8px]"></i></div>
                    </th>
                    <th rowspan="2" onclick="toggleRosterSort('nama')" class="py-2 px-2.5 cursor-pointer select-none hover:bg-gray-100 sm:sticky sm:left-[132px] z-20 bg-gray-50 w-[148px] min-w-[148px] max-w-[148px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] whitespace-nowrap">
                        <div class="flex items-center justify-between gap-1"><span>NAMA</span><i class="fa-solid ${getIconCls('nama')} text-[8px]"></i></div>
                    </th>
                    <th rowspan="2" onclick="toggleRosterSort('unit')" class="py-2 px-2.5 cursor-pointer select-none hover:bg-gray-100 bg-gray-50 min-w-[92px] whitespace-nowrap">
                        <div class="flex items-center justify-between gap-1"><span>UNIT</span><i class="fa-solid ${getIconCls('unit')} text-[8px]"></i></div>
                    </th>
                    <th rowspan="2" onclick="toggleRosterSort('off')" class="py-2 px-2 text-center cursor-pointer select-none hover:bg-gray-100 bg-red-50/70 text-red-700 min-w-[78px] whitespace-nowrap">
                        <div class="flex items-center justify-center gap-1"><span>OFF</span><i class="fa-solid ${getIconCls('off')} text-[8px]"></i></div>
                    </th>
                    ${days.map(d => {
        const dow = new Date(year, monthIdx, d).getDay();
        const isWknd = dow === 0 || dow === 6;
        return `<th data-col-day="${d}" onmousedown="handleRosterColHeaderMouseDown(event, ${d})" ontouchstart="handleRosterColHeaderTouchStart(event, ${d})" title="Klik atau seret (kursor/jari) untuk blok kolom tgl ${d} (Ctrl/Shift untuk gabung)" class="roster-col-select-th py-1.5 px-1 text-center font-mono cursor-pointer hover:bg-sky-100/70 transition-colors ${isWknd ? 'bg-red-50/50 text-red-700' : 'bg-gray-50 text-gray-700'} min-w-[48px] whitespace-nowrap">${d}</th>`;
    }).join('')}
                </tr>
                <tr class="text-[8.5px] font-medium">
                    ${days.map(d => {
        const dow = new Date(year, monthIdx, d).getDay();
        const isWknd = dow === 0 || dow === 6;
        return `<th data-col-day="${d}" onmousedown="handleRosterColHeaderMouseDown(event, ${d})" ontouchstart="handleRosterColHeaderTouchStart(event, ${d})" title="Klik atau seret (kursor/jari) untuk blok kolom tgl ${d}" class="roster-col-select-th py-1 px-1 text-center cursor-pointer hover:bg-sky-100/70 transition-colors ${isWknd ? 'bg-red-50/50 text-red-600' : 'bg-gray-50/90 text-gray-500'} whitespace-nowrap">${DAYS_SHORT_ID[dow]}</th>`;
    }).join('')}
                </tr>
            `;

    let rows = getFilteredRosterRows();

    if (rosterSortState.column && rosterSortState.direction !== 'none') {
        const col = rosterSortState.column;
        const dir = rosterSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'off') {
                const idxA = ROSTER_OFF_DAY_OPTIONS.findIndex(o => o.value === (a.offDay || ''));
                const idxB = ROSTER_OFF_DAY_OPTIONS.findIndex(o => o.value === (b.offDay || ''));
                const vA = idxA >= 0 ? idxA : 999;
                const vB = idxB >= 0 ? idxB : 999;
                return (vA - vB) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || '').toLowerCase(), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        const subLabel = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu]?.label || 'kategori ini';
        tbody.innerHTML = `<tr><td colspan="${daysInMonth + 5}" class="py-10 text-center text-xs text-gray-400">Belum ada personil pada Roster <strong>${escapeHtml(subLabel)}</strong>. Klik <strong>Tambah Personil</strong> atau <strong>Upload Roster</strong>.</td></tr>`;
        renderRosterShiftSummaryFooter([]);
        syncRosterEditToolbarState();
        renderRosterInfoPanel();
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
        const rowBg = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
        const sched = r.scheduleByMonth?.[ymKey] || {};
        const offRaw = r.offDay || detectOffDayFromSchedule(year, monthIdx, sched, daysInMonth) || '-';
        const offDisplay = typeof formatRosterOffDayShort === 'function' ? formatRosterOffDayShort(offRaw) : offRaw;
        const offTitle = typeof formatRosterOffDayLabel === 'function' ? formatRosterOffDayLabel(offRaw) : offRaw;
        const rowAccess = hasRosterRowEditAccess(r);
        const canEditRow = rowAccess.allowed;
        const lockedHint = rowAccess.pic
            ? `Terkunci — hanya PIC (${rowAccess.pic.nama}) atau Admin. Klik untuk masukkan Password PIC.`
            : 'Terkunci — PIC roster belum ditentukan. Hubungi Admin.';

        return `
                    <tr class="group ${rowBg} hover:bg-teal-50/40 transition-colors">
                        <td class="py-2 px-1.5 text-center sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 w-[44px] min-w-[44px] max-w-[44px] whitespace-nowrap">
                            <button type="button" data-row-select="${idx}" onmousedown="handleRosterRowHeaderMouseDown(event, ${idx})" ontouchstart="handleRosterRowHeaderTouchStart(event, ${idx})" title="Klik atau seret (kursor/jari) untuk blok baris milik ${escapeHtml(r.nama)} (Ctrl/Shift untuk gabung)" class="roster-row-select-btn font-mono text-gray-500 hover:text-sky-700 hover:font-bold cursor-pointer px-1">${idx + 1}</button>
                        </td>
                        <td id="roster-nrp-cell-${r.id}" class="py-2 px-2.5 sticky left-[44px] z-10 ${rowBg} group-hover:bg-teal-50 w-[88px] min-w-[88px] max-w-[88px] whitespace-nowrap">
                            <button type="button" onclick="openRosterPersonInlineEdit(${Number(r.id)})" title="${escapeHtml(canEditRow ? 'Klik untuk ubah personil dari Master Data Manpower' : lockedHint)}" class="font-mono text-teal-700 ${canEditRow ? 'hover:underline cursor-pointer' : 'cursor-not-allowed opacity-90'} text-left truncate max-w-full">${escapeHtml(r.nrp)}</button>
                        </td>
                        <td id="roster-nama-cell-${r.id}" class="py-2 px-2.5 sm:sticky sm:left-[132px] z-10 ${rowBg} group-hover:bg-teal-50 w-[148px] min-w-[148px] max-w-[148px] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] whitespace-nowrap">
                            <button type="button" onclick="openRosterPersonInlineEdit(${Number(r.id)})" title="${escapeHtml(canEditRow ? 'Klik untuk ganti nama dari Master Data Manpower' : lockedHint)}" class="text-left ${canEditRow ? 'cursor-pointer' : 'cursor-not-allowed'} group/name max-w-full block">
                                <p class="text-gray-800 font-medium truncate ${canEditRow ? 'group-hover/name:text-teal-700' : ''}">${escapeHtml(r.nama)}</p>
                                <p class="text-[8.5px] text-gray-400 truncate">${escapeHtml(r.jabatan || '-')}</p>
                            </button>
                        </td>
                        <td id="roster-unit-cell-${r.id}" class="p-0 whitespace-nowrap">
                            <input
                                type="text"
                                id="roster-unit-input-${r.id}"
                                list="roster-unit-datalist"
                                data-row-id="${Number(r.id)}"
                                data-prev="${escapeHtml(r.unit || '-')}"
                                value="${escapeHtml(r.unit || '-')}"
                                autocomplete="off"
                                spellcheck="false"
                                ${canEditRow ? '' : 'readonly'}
                                title="${escapeHtml(canEditRow ? "Ketik langsung No Unit sesuai Master Data Unit (atau '-' untuk tanpa unit)" : lockedHint)}"
                                ${canEditRow ? 'onfocus="this.select()"' : `onclick="handleLockedRosterCellClick(event, ${Number(r.id)})"`}
                                oninput="handleRosterUnitDirectInput(this)"
                                onkeydown="handleRosterUnitDirectKeydown(event, this)"
                                onblur="commitRosterUnitDirectInput(this)"
                                class="roster-grid-input w-full min-w-[88px] h-full min-h-[28px] px-2.5 py-1.5 font-mono text-[10px] uppercase bg-transparent text-gray-700 border-0 focus:outline-none ${canEditRow ? 'focus:bg-white focus:text-gray-900 focus:ring-2 focus:ring-inset focus:ring-teal-500 cursor-text' : 'cursor-not-allowed select-none'}"
                            >
                        </td>
                        <td id="roster-off-cell-${r.id}" class="py-2 px-2 text-center whitespace-nowrap ${offDisplay !== '-' ? 'bg-red-50/70' : ''}">
                            <button
                                type="button"
                                onclick="openRosterOffInlineEdit(${Number(r.id)})"
                                title="${escapeHtml(canEditRow ? `${offTitle} — Klik untuk ubah Hari OFF (Awal Bulan / Pertengahan). Otomatis membentuk 6 hari DWS + 7 hari NWS + OFF.` : lockedHint)}"
                                class="text-[10px] font-semibold ${offDisplay !== '-' ? 'text-red-700' : 'text-gray-400'} ${canEditRow ? 'hover:text-teal-700 hover:underline cursor-pointer' : 'cursor-not-allowed'} focus:outline-none"
                            >${escapeHtml(offDisplay)}</button>
                        </td>
                        ${days.map(d => {
            const code = String(sched[d] || '').trim().toUpperCase();
            const st = getRosterCodeCellStyle(code);
            const hasCustomUnit = typeof hasCustomRosterUnitForDate === 'function' && hasCustomRosterUnitForDate(r, ymKey, d);
            const unitOnDay = hasCustomUnit ? getRosterUnitForDate(r, ymKey, d) : '';
            const baseCellTitle = hasCustomUnit ? `${st.tooltip} • Settingan Unit Tgl ${d}: ${unitOnDay}` : st.tooltip;
            const cellTitle = canEditRow ? baseCellTitle : `${baseCellTitle} — ${lockedHint}`;
            return `
                                <td id="roster-day-cell-${r.id}-${d}" class="p-0 text-center whitespace-nowrap relative ${st.cellCls}">
                                    <input
                                        type="text"
                                        id="roster-day-input-${r.id}-${d}"
                                        data-row-id="${Number(r.id)}"
                                        data-row-idx="${idx}"
                                        data-ym-key="${ymKey}"
                                        data-day="${d}"
                                        data-prev="${escapeHtml(code)}"
                                        value="${escapeHtml(code)}"
                                        placeholder="-"
                                        autocomplete="off"
                                        spellcheck="false"
                                        ${canEditRow ? '' : 'readonly'}
                                        title="${escapeHtml(cellTitle)}"
                                        ${canEditRow ? '' : `onclick="handleLockedRosterCellClick(event, ${Number(r.id)})"`}
                                        onmousedown="handleRosterGridMouseDown(event, this)"
                                        onmouseenter="handleRosterGridMouseEnter(event, this)"
                                        ontouchstart="handleRosterGridTouchStart(event, this)"
                                        onfocus="handleRosterGridFocus(this)"
                                        oninput="handleRosterGridInput(this)"
                                        onkeydown="handleRosterGridKeydown(event, this)"
                                        onblur="handleRosterGridBlur(this)"
                                        oncopy="handleRosterGridCopy(event, this)"
                                        onpaste="handleRosterGridPaste(event, this)"
                                        class="roster-grid-input w-full h-full min-h-[28px] px-0.5 py-1.5 text-center font-mono text-[9.5px] uppercase bg-transparent text-inherit placeholder:text-gray-300 border-0 focus:outline-none ${canEditRow ? 'focus:bg-white focus:text-gray-900 focus:ring-2 focus:ring-inset focus:ring-teal-500 cursor-text' : 'cursor-not-allowed select-none'}"
                                    >${hasCustomUnit ? '<span class="pointer-events-none absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-indigo-500" title="Unit khusus tanggal ini"></span>' : ''}
                                </td>
                            `;
        }).join('')}
                    </tr>
                `;
    }).join('');

    renderRosterShiftSummaryFooter(rows);
    syncRosterEditToolbarState();
    clearRosterGridSelection(false);
    updateRosterUndoButton();
    renderRosterInfoPanel();
}

/* ----- LAYAR INFORMASI SETTINGAN ROSTER (UNIT KOSONG, DOUBLE SETTING, BELUM SETTING) ----- */
const dismissedRosterAlertKeys = new Set();
let lastVisibleRosterAlertKeys = [];

function isOperatorOrDriverRole(jabatan) {
    const role = String(jabatan || '').trim().toLowerCase();
    return role.includes('operator') || role.includes('driver');
}

function isUnitBasedRole(jabatan) {
    return !matchesRosterSubMenu(jabatan, 'gl') && !matchesRosterSubMenu(jabatan, 'admin');
}

function getRosterConflictRoleGroup(jabatan) {
    if (isOperatorOrDriverRole(jabatan)) return { key: 'operator', label: 'Operator' };
    if (matchesRosterSubMenu(jabatan, 'rigger-lowboy')) return { key: 'rigger', label: 'Rigger & Helper Lowboy' };
    if (matchesRosterSubMenu(jabatan, 'oilman')) return { key: 'oilman', label: 'Oilman' };
    if (matchesRosterSubMenu(jabatan, 'washingman')) return { key: 'washingman', label: 'Washingman' };
    return null;
}

let rosterInfoPanelOpen = true;
const rosterInfoSwipeState = { active: false, startX: 0, moved: false, suppressClick: false };

function setRosterInfoPanelOpen(isOpen) {
    rosterInfoPanelOpen = Boolean(isOpen);
    const wrap = document.getElementById('roster-info-drawer-wrap');
    const icon = document.getElementById('roster-info-slide-icon');
    const handle = document.getElementById('roster-info-slide-handle');
    const handleBadge = document.getElementById('roster-info-handle-badge');
    const toggleBtn = document.getElementById('btn-toggle-roster-info');

    if (wrap) {
        wrap.classList.toggle('is-collapsed', !rosterInfoPanelOpen);
    }
    if (icon) {
        icon.classList.toggle('rotate-180', !rosterInfoPanelOpen);
    }
    if (handle) {
        handle.title = rosterInfoPanelOpen
            ? 'Klik atau geser ke kanan untuk menutup Layar Informasi Settingan'
            : 'Klik atau geser ke kiri untuk membuka Layar Informasi Settingan';
        handle.classList.toggle('bg-amber-50', !rosterInfoPanelOpen);
        handle.classList.toggle('border-amber-300', !rosterInfoPanelOpen);
        handle.classList.toggle('text-amber-700', !rosterInfoPanelOpen);
    }
    if (handleBadge) {
        const count = Number(handleBadge.textContent || '0') || 0;
        handleBadge.classList.toggle('hidden', rosterInfoPanelOpen || count <= 0);
    }
    if (toggleBtn) {
        toggleBtn.classList.toggle('ring-2', rosterInfoPanelOpen);
        toggleBtn.classList.toggle('ring-amber-300', rosterInfoPanelOpen);
    }
}

function toggleRosterInfoPanel() {
    setRosterInfoPanelOpen(!rosterInfoPanelOpen);
}

function handleRosterInfoSlideStart(event) {
    if (event.target?.closest('button[onclick*="setRosterInfoPanelOpen"]')) return;
    const pt = event.touches ? event.touches[0] : event;
    if (!pt) return;
    rosterInfoSwipeState.active = true;
    rosterInfoSwipeState.startX = pt.clientX;
    rosterInfoSwipeState.moved = false;
}

function handleRosterInfoSlideClick(event) {
    if (rosterInfoSwipeState.suppressClick) {
        rosterInfoSwipeState.suppressClick = false;
        event.preventDefault();
        return;
    }
    toggleRosterInfoPanel();
}

function processRosterInfoSwipeMove(clientX) {
    if (!rosterInfoSwipeState.active) return;
    const dx = clientX - rosterInfoSwipeState.startX;
    if (Math.abs(dx) < 30) return;

    rosterInfoSwipeState.moved = true;
    rosterInfoSwipeState.active = false;
    rosterInfoSwipeState.suppressClick = true;
    setTimeout(() => { rosterInfoSwipeState.suppressClick = false; }, 120);

    if (dx > 0 && rosterInfoPanelOpen) {
        // Geser ke kanan -> tutup panel
        setRosterInfoPanelOpen(false);
    } else if (dx < 0 && !rosterInfoPanelOpen) {
        // Geser ke kiri -> buka panel
        setRosterInfoPanelOpen(true);
    }
}

document.addEventListener('mousemove', (event) => {
    if (!rosterInfoSwipeState.active) return;
    if ((event.buttons & 1) === 0) { rosterInfoSwipeState.active = false; return; }
    processRosterInfoSwipeMove(event.clientX);
});

document.addEventListener('mouseup', () => {
    rosterInfoSwipeState.active = false;
});

document.addEventListener('touchmove', (event) => {
    if (!rosterInfoSwipeState.active) return;
    const touch = event.touches && event.touches[0];
    if (touch) processRosterInfoSwipeMove(touch.clientX);
}, { passive: true });

document.addEventListener('touchend', () => {
    rosterInfoSwipeState.active = false;
});

function setRosterAlertTypeFilter(typeKey) {
    const sel = document.getElementById('roster-alert-type-filter');
    if (!sel) return;
    sel.value = sel.value === typeKey ? 'all' : typeKey;
    renderRosterInfoPanel();
}

function setRosterAlertToday() {
    const { daysInMonth } = getRosterActiveMonthYear();
    const sel = document.getElementById('roster-alert-day-filter');
    if (!sel) return;
    const todayNum = new Date().getDate();
    sel.value = String(Math.min(todayNum, daysInMonth));
    renderRosterInfoPanel();
}

function dismissRosterAlert(alertKey) {
    dismissedRosterAlertKeys.add(alertKey);
    renderRosterInfoPanel();
}

function dismissVisibleRosterAlerts() {
    if (!lastVisibleRosterAlertKeys.length) return;
    const count = lastVisibleRosterAlertKeys.length;
    lastVisibleRosterAlertKeys.forEach(k => dismissedRosterAlertKeys.add(k));
    renderRosterInfoPanel();
    showToast(`${count} keterangan settingan dihapus dari layar informasi.`, 'info');
}

function restoreDismissedRosterAlerts() {
    const { ymKey } = getRosterActiveMonthYear();
    const scopeKey = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu] ? activeRosterSubMenu : 'all';
    const prefix = `${ymKey}::${scopeKey}::`;
    let restored = 0;
    Array.from(dismissedRosterAlertKeys).forEach(k => {
        if (k.startsWith(prefix)) {
            dismissedRosterAlertKeys.delete(k);
            restored++;
        }
    });
    renderRosterInfoPanel();
    if (restored > 0) showToast(`${restored} keterangan yang dihapus ditampilkan kembali.`, 'success');
}

function syncRosterAlertFilterOptions(year, monthIdx, daysInMonth, scopedUnits = komisioningState, cfg = ROSTER_SUBMENU_CONFIG.all) {
    const daySel = document.getElementById('roster-alert-day-filter');
    if (daySel) {
        const prevDay = daySel.value || 'all';
        const dayOpts = Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const dow = DAYS_SHORT_ID[new Date(year, monthIdx, d).getDay()];
            return `<option value="${d}">Tgl ${d} (${dow})</option>`;
        }).join('');
        daySel.innerHTML = `<option value="all">Semua Tgl (1–${daysInMonth})</option>${dayOpts}`;
        if (prevDay && Array.from(daySel.options).some(o => o.value === prevDay)) {
            daySel.value = prevDay;
        }
    }

    const unitSel = document.getElementById('roster-alert-unit-filter');
    if (unitSel) {
        const prevUnit = unitSel.value || 'all';
        const unitsArr = Array.isArray(scopedUnits) ? scopedUnits : [];
        if (cfg && cfg.usesUnit === false) {
            unitSel.innerHTML = `<option value="all">Non-Unit (${escapeHtml(cfg.label)})</option>`;
            unitSel.value = 'all';
            unitSel.disabled = true;
        } else {
            unitSel.disabled = false;
            const unitOpts = unitsArr
                .map(u => `<option value="${escapeHtml(u.no_unit)}">${escapeHtml(u.no_unit)}</option>`)
                .join('');
            const allLabel = unitsArr.length ? `Semua Unit (${unitsArr.length})` : 'Semua Unit';
            unitSel.innerHTML = `<option value="all">${allLabel}</option>${unitOpts}`;
            if (prevUnit && Array.from(unitSel.options).some(o => o.value === prevUnit)) {
                unitSel.value = prevUnit;
            } else {
                unitSel.value = 'all';
            }
        }
    }
}

function computeRosterSettingAlerts(year, monthIdx, ymKey, daysInMonth, subMenuKey = activeRosterSubMenu) {
    const alerts = [];
    const monthShort = MONTH_SHORT_ID[monthIdx] || '';
    const scopeKey = ROSTER_SUBMENU_CONFIG[subMenuKey] ? subMenuKey : 'all';
    const cfg = ROSTER_SUBMENU_CONFIG[scopeKey];
    const isAll = scopeKey === 'all';
    const roleWord = cfg.roleWord || cfg.label;

    const scopedManpower = isAll
        ? manpowerState
        : manpowerState.filter(mp => matchesRosterSubMenu(mp.jabatan, scopeKey));
    const scopedRoster = isAll
        ? rosterState
        : rosterState.filter(r => matchesRosterSubMenu(r.jabatan, scopeKey));
    const scopedUnits = getScopedUnitsForRosterSubMenu(scopeKey, scopedRoster);

    // Jika tabel roster pada bar menu & bulan aktif masih kosong (belum ada personil atau belum ada kode jadwal sama sekali),
    // maka layar informasi settingan ikut kosong hingga roster diisi atau diupload.
    const hasAnyScheduleForMonth = scopedRoster.some(r => {
        const sched = r.scheduleByMonth?.[ymKey];
        if (!sched) return false;
        for (let d = 1; d <= daysInMonth; d++) {
            const code = String(sched[d] || '').trim();
            if (code && code !== '-') return true;
        }
        return false;
    });

    if (scopedRoster.length === 0 || !hasAnyScheduleForMonth) {
        return {
            alerts: [],
            scopedUnits: scopedRoster.length === 0 ? [] : scopedUnits,
            cfg,
            isRosterEmpty: true
        };
    }

    // 1. Cek personil pada kategori aktif di Master Manpower yang belum masuk daftar Roster sama sekali
    scopedManpower.forEach(mp => {
        const inRoster = rosterState.some(r =>
            String(r.nrp).trim().toLowerCase() === String(mp.nrp).trim().toLowerCase() ||
            String(r.nama).trim().toLowerCase() === String(mp.nama).trim().toLowerCase()
        );
        if (!inRoster) {
            alerts.push({
                key: `${ymKey}::${scopeKey}::belum_roster::${mp.nrp}`,
                type: 'belum_setting',
                day: 0,
                dayLabel: `1–${daysInMonth} ${monthShort}`,
                unit: '-',
                shift: 'Semua',
                title: `${mp.nama}`,
                desc: `NRP ${mp.nrp} (${mp.jabatan}) terdaftar di Master Data namun belum masuk daftar Roster bulan ini.`
            });
        }
    });

    // 2. Analisis harian dari Tgl 1 s/d akhir bulan sesuai bar menu aktif
    for (let d = 1; d <= daysInMonth; d++) {
        const dow = DAYS_SHORT_ID[new Date(year, monthIdx, d).getDay()];
        const dayLabel = `Tgl ${String(d).padStart(2, '0')} ${monthShort} (${dow})`;

        const unitCoverageByShift = {};   // { [unitKey]: { unitNo, 'Shift 1': [], 'Shift 2': [] } }
        const unitConflictByGroup = {};   // { [unitKey::groupKey]: { unitNo, groupKey, groupLabel, 'Shift 1': [], 'Shift 2': [] } }
        const nrpRowsOnDay = {};          // { [nrpKey]: row[] }

        scopedRoster.forEach(r => {
            const nrpKey = String(r.nrp || '').trim().toLowerCase();
            if (nrpKey && nrpKey !== '-') {
                if (!nrpRowsOnDay[nrpKey]) nrpRowsOnDay[nrpKey] = [];
                nrpRowsOnDay[nrpKey].push(r);
            }

            const rawCode = String(r.scheduleByMonth?.[ymKey]?.[d] || '').trim().toUpperCase();
            if (!rawCode || rawCode === '-') {
                alerts.push({
                    key: `${ymKey}::${scopeKey}::belum_jadwal::${d}::${r.id}`,
                    type: 'belum_setting',
                    day: d,
                    dayLabel,
                    unit: r.unit || '-',
                    shift: 'Semua',
                    title: `${r.nama}`,
                    desc: `${r.jabatan} (${r.nrp}) belum memiliki kode shift pada ${dayLabel}.`
                });
                return;
            }

            const rule = resolveRosterCodeRule(rawCode);
            const arti = rule?.artiSistem || '';
            const shiftName = arti === 'SHIFT_1' ? 'Shift 1' : (arti === 'SHIFT_2' ? 'Shift 2' : '');
            if (!shiftName) return;

            const needsUnit = isAll ? isUnitBasedRole(r.jabatan) : Boolean(cfg.usesUnit);
            if (!needsUnit) return;

            const effectiveUnit = (typeof getRosterUnitForDate === 'function')
                ? getRosterUnitForDate(r, ymKey, d)
                : (r.unit || '-');
            const cleanUnit = String(effectiveUnit || '').trim();
            if (!cleanUnit || cleanUnit === '-') {
                alerts.push({
                    key: `${ymKey}::${scopeKey}::belum_unit::${d}::${r.id}`,
                    type: 'belum_setting',
                    day: d,
                    dayLabel,
                    unit: '-',
                    shift: shiftName,
                    title: `${r.nama}`,
                    desc: `${r.jabatan} masuk ${shiftName} (${rawCode}), tetapi kolom UNIT masih kosong (-).`
                });
                return;
            }

            const uKey = normalizeUnitKey(cleanUnit);
            const countsForUnitCoverage = isAll ? isOperatorOrDriverRole(r.jabatan) : true;
            if (countsForUnitCoverage) {
                if (!unitCoverageByShift[uKey]) {
                    unitCoverageByShift[uKey] = { unitNo: cleanUnit, 'Shift 1': [], 'Shift 2': [] };
                }
                unitCoverageByShift[uKey][shiftName].push(r);
            }

            const conflictGrp = isAll
                ? getRosterConflictRoleGroup(r.jabatan)
                : { key: scopeKey, label: roleWord };
            if (conflictGrp) {
                const cKey = `${uKey}::${conflictGrp.key}`;
                if (!unitConflictByGroup[cKey]) {
                    unitConflictByGroup[cKey] = {
                        uKey,
                        unitNo: cleanUnit,
                        groupKey: conflictGrp.key,
                        groupLabel: conflictGrp.label,
                        'Shift 1': [],
                        'Shift 2': []
                    };
                }
                unitConflictByGroup[cKey][shiftName].push(r);
            }
        });

        // Cek 2A: Unit Kosong sesuai kategori menu bar aktif
        if (isAll || cfg.usesUnit) {
            scopedUnits.forEach(u => {
                const uKey = normalizeUnitKey(u.no_unit);
                const hasS1 = (unitCoverageByShift[uKey]?.['Shift 1']?.length || 0) > 0;
                const hasS2 = (unitCoverageByShift[uKey]?.['Shift 2']?.length || 0) > 0;

                if (!hasS1 && !hasS2) {
                    alerts.push({
                        key: `${ymKey}::${scopeKey}::unit_kosong::${d}::ALL::${uKey}`,
                        type: 'unit_kosong',
                        day: d,
                        dayLabel,
                        unit: u.no_unit,
                        shift: 'Shift 1 & 2',
                        title: `${u.no_unit}`,
                        desc: `Tidak ada ${roleWord} di unit ${u.no_unit} (${u.model_tipe}) pada Shift 1 & Shift 2.`
                    });
                } else if (!hasS1) {
                    alerts.push({
                        key: `${ymKey}::${scopeKey}::unit_kosong::${d}::S1::${uKey}`,
                        type: 'unit_kosong',
                        day: d,
                        dayLabel,
                        unit: u.no_unit,
                        shift: 'Shift 1',
                        title: `${u.no_unit}`,
                        desc: `Belum ada ${roleWord} aktif di unit ${u.no_unit} (${u.model_tipe}) pada Shift 1 (Siang).`
                    });
                } else if (!hasS2) {
                    alerts.push({
                        key: `${ymKey}::${scopeKey}::unit_kosong::${d}::S2::${uKey}`,
                        type: 'unit_kosong',
                        day: d,
                        dayLabel,
                        unit: u.no_unit,
                        shift: 'Shift 2',
                        title: `${u.no_unit}`,
                        desc: `Belum ada ${roleWord} aktif di unit ${u.no_unit} (${u.model_tipe}) pada Shift 2 (Malam).`
                    });
                }
            });

            // Cek 2B: Double Settingan (2+ personil peran sama di unit & shift yang sama)
            Object.values(unitConflictByGroup).forEach(info => {
                ['Shift 1', 'Shift 2'].forEach(shiftName => {
                    const ops = info[shiftName];
                    if (ops.length >= 2) {
                        alerts.push({
                            key: `${ymKey}::${scopeKey}::double_unit::${d}::${info.groupKey}::${shiftName}::${info.uKey}`,
                            type: 'double_setting',
                            day: d,
                            dayLabel,
                            unit: info.unitNo,
                            shift: shiftName,
                            title: `${info.unitNo}`,
                            desc: `Bentrok pada ${shiftName}: ${ops.map(o => `${o.nama} (${o.jabatan})`).join(', ')}.`
                        });
                    }
                });
            });
        }

        // Cek 2C: Personil yang sama tercatat ganda di roster pada kategori aktif
        Object.entries(nrpRowsOnDay).forEach(([nrpKey, dupRows]) => {
            if (dupRows.length >= 2) {
                alerts.push({
                    key: `${ymKey}::${scopeKey}::double_nrp::${d}::${nrpKey}`,
                    type: 'double_setting',
                    day: d,
                    dayLabel,
                    unit: dupRows.map(x => x.unit || '-').join('/'),
                    shift: 'Shift 1 & 2',
                    title: `${dupRows[0].nama}`,
                    desc: `NRP ${dupRows[0].nrp} muncul ganda di ${dupRows.length} baris roster pada ${dayLabel}.`
                });
            }
        });
    }

    return { alerts, scopedUnits, cfg, isRosterEmpty: false };
}

function renderRosterInfoPanel() {
    const listEl = document.getElementById('roster-info-alert-list');
    if (!listEl) return;

    const { monthIdx, year, ymKey, daysInMonth } = getRosterActiveMonthYear();
    const scopeKey = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu] ? activeRosterSubMenu : 'all';
    const { alerts: allAlerts, scopedUnits, cfg, isRosterEmpty } = computeRosterSettingAlerts(year, monthIdx, ymKey, daysInMonth, scopeKey);

    syncRosterAlertFilterOptions(year, monthIdx, daysInMonth, scopedUnits, cfg);

    const periodLabelEl = document.getElementById('roster-info-period-label');
    if (periodLabelEl) {
        periodLabelEl.textContent = `${cfg.label} • Tgl 1–${daysInMonth} ${MONTH_NAMES_ID[monthIdx]} ${year}`;
    }

    const activeAlerts = allAlerts.filter(a => !dismissedRosterAlertKeys.has(a.key));
    const dismissedCountForMonth = allAlerts.length - activeAlerts.length;

    const countKosong = activeAlerts.filter(a => a.type === 'unit_kosong').length;
    const countDouble = activeAlerts.filter(a => a.type === 'double_setting').length;
    const countBelum = activeAlerts.filter(a => a.type === 'belum_setting').length;

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
    setTxt('roster-alert-count-kosong', countKosong);
    setTxt('roster-alert-count-double', countDouble);
    setTxt('roster-alert-count-belum', countBelum);
    setTxt('roster-info-total-badge', activeAlerts.length);
    setTxt('roster-info-toggle-badge', activeAlerts.length);
    setTxt('roster-info-handle-badge', activeAlerts.length);
    const handleBadgeEl = document.getElementById('roster-info-handle-badge');
    if (handleBadgeEl) {
        handleBadgeEl.classList.toggle('hidden', rosterInfoPanelOpen || activeAlerts.length <= 0);
    }
    setTxt('roster-dismissed-count', dismissedCountForMonth);

    const restoreBtn = document.getElementById('btn-restore-roster-alerts');
    if (restoreBtn) restoreBtn.classList.toggle('hidden', dismissedCountForMonth === 0);

    const typeFilter = document.getElementById('roster-alert-type-filter')?.value || 'all';
    const dayFilter = document.getElementById('roster-alert-day-filter')?.value || 'all';
    const unitFilter = document.getElementById('roster-alert-unit-filter')?.value || 'all';
    const shiftFilter = document.getElementById('roster-alert-shift-filter')?.value || 'all';

    const filtered = activeAlerts.filter(a => {
        if (typeFilter !== 'all' && a.type !== typeFilter) return false;
        if (dayFilter !== 'all' && a.day !== 0 && String(a.day) !== String(dayFilter)) return false;
        if (unitFilter !== 'all' && normalizeUnitKey(a.unit) !== normalizeUnitKey(unitFilter)) return false;
        if (shiftFilter !== 'all') {
            if (a.shift !== shiftFilter && a.shift !== 'Shift 1 & 2' && a.shift !== 'Semua') return false;
        }
        return true;
    });

    lastVisibleRosterAlertKeys = filtered.map(a => a.key);

    const dismissAllBtn = document.getElementById('btn-dismiss-visible-alerts');
    if (dismissAllBtn) dismissAllBtn.disabled = filtered.length === 0;

    const showingEl = document.getElementById('roster-info-showing-label');
    if (showingEl) {
        showingEl.textContent = isRosterEmpty
            ? '0 keterangan (Roster kosong)'
            : `Menampilkan ${filtered.length} dari ${activeAlerts.length} keterangan`;
    }

    if (isRosterEmpty) {
        listEl.innerHTML = `
                    <div class="py-10 px-4 text-center space-y-2">
                        <div class="w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                            <i class="fa-solid fa-calendar-xmark"></i>
                        </div>
                        <p class="text-xs font-bold text-gray-600">Roster ${escapeHtml(cfg.label)} Kosong</p>
                    </div>
                `;
        return;
    }

    if (!filtered.length) {
        listEl.innerHTML = `
                    <div class="py-10 px-4 text-center space-y-2">
                        <div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <p class="text-xs font-bold text-gray-700">Settingan ${escapeHtml(cfg.label)} Aman</p>
                    </div>
                `;
        return;
    }

    const ALERT_STYLE = {
        unit_kosong: {
            card: 'bg-red-50 border-red-200 border-l-red-500',
            badge: 'bg-red-200/80 text-red-800',
            title: 'text-red-950',
            sub: 'text-red-800/80',
            label: 'Unit Kosong'
        },
        double_setting: {
            card: 'bg-amber-50 border-amber-200 border-l-amber-500',
            badge: 'bg-amber-200/80 text-amber-900',
            title: 'text-amber-950',
            sub: 'text-amber-900/80',
            label: 'Double Settingan'
        },
        belum_setting: {
            card: 'bg-blue-50 border-blue-200 border-l-blue-500',
            badge: 'bg-blue-200/80 text-blue-800',
            title: 'text-blue-950',
            sub: 'text-blue-800/80',
            label: 'Belum Settingan'
        }
    };

    const MAX_RENDER = 120;
    const visibleSlice = filtered.slice(0, MAX_RENDER);

    listEl.innerHTML = visibleSlice.map(a => {
        const st = ALERT_STYLE[a.type] || ALERT_STYLE.unit_kosong;
        const compactSub = a.type === 'double_setting' && a.desc
            ? `<p class="text-[9.5px] ${st.sub} truncate">${escapeHtml(String(a.desc).replace(/^Bentrok pada [^:]+:\s*/i, ''))}</p>`
            : '';
        return `
                    <div title="${escapeHtml(a.desc || '')}" class="p-2 rounded-xl border border-l-4 ${st.card} shadow-xs space-y-1">
                        <div class="flex items-start justify-between gap-1.5">
                            <div class="flex flex-wrap items-center gap-1 min-w-0">
                                <span class="px-1.5 py-0.5 rounded text-[8.5px] font-bold ${st.badge}">${st.label}</span>
                                <span class="px-1.5 py-0.5 rounded bg-white/80 border border-black/5 text-gray-600 font-mono text-[8.5px]">${escapeHtml(a.dayLabel)}</span>
                                <span class="px-1.5 py-0.5 rounded bg-white/85 border border-teal-200/60 text-teal-700 text-[8.5px] font-semibold">${escapeHtml(a.shift)}</span>
                            </div>
                            <button
                                type="button"
                                onclick="dismissRosterAlert('${escapeJsString(a.key)}')"
                                title="Hapus"
                                class="w-5 h-5 rounded-lg text-gray-500 hover:bg-white/80 hover:text-red-600 flex items-center justify-center shrink-0 transition-colors"
                            >
                                <i class="fa-solid fa-xmark text-[10px]"></i>
                            </button>
                        </div>
                        <p class="text-[11px] font-bold ${st.title} leading-snug">${escapeHtml(a.title)}</p>
                        ${compactSub}
                    </div>
                `;
    }).join('') + (filtered.length > MAX_RENDER ? `
                <div class="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-center text-[9px] text-amber-800">
                    Menampilkan ${MAX_RENDER} dari ${filtered.length}
                </div>
            ` : '');
}

function openRosterPersonInlineEdit(rowId) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    const cell = document.getElementById(`roster-nama-cell-${rowId}`);
    if (!row || !cell) return;
    if (!requireRosterEditAccess(null, row, () => openRosterPersonInlineEdit(rowId))) return;

    const opts = manpowerState.map(mp => {
        const selected = String(mp.nrp) === String(row.nrp) ? 'selected' : '';
        return `<option value="${Number(mp.id)}" ${selected}>${escapeHtml(mp.nama)} (${escapeHtml(mp.nrp)})</option>`;
    }).join('');

    cell.innerHTML = `
                <select
                    id="roster-person-select-${rowId}"
                    onchange="commitRosterPersonEdit(${Number(rowId)}, this.value)"
                    onblur="renderRosterTable()"
                    class="w-full px-1.5 py-1 rounded-lg border border-teal-400 bg-white text-[10px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >${opts}</select>
            `;
    document.getElementById(`roster-person-select-${rowId}`)?.focus();
}

function commitRosterPersonEdit(rowId, mpId) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!row || !mp) { renderRosterTable(); return; }
    if (!hasRosterRowEditAccess(row).allowed) { renderRosterTable(); return; }
    row.nrp = mp.nrp;
    row.nama = mp.nama;
    row.jabatan = mp.jabatan;
    if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase([row]);
    renderRosterTable();
    renderManpowerTable();
    showToast(`Baris roster diubah ke ${mp.nama} (${mp.nrp}).`, 'success');
}

function openRosterUnitInlineEdit(rowId) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    const cell = document.getElementById(`roster-unit-cell-${rowId}`);
    if (!row || !cell) return;
    if (!requireRosterEditAccess(null, row, () => openRosterUnitInlineEdit(rowId))) return;

    const opts = ['<option value="-">-</option>'].concat(
        komisioningState.map(u => {
            const selected = normalizeUnitKey(u.no_unit) === normalizeUnitKey(row.unit) ? 'selected' : '';
            return `<option value="${escapeHtml(u.no_unit)}" ${selected}>${escapeHtml(u.no_unit)} (${escapeHtml(u.model_tipe)})</option>`;
        })
    ).join('');

    cell.innerHTML = `
                <select
                    id="roster-unit-select-${rowId}"
                    onchange="commitRosterUnitEdit(${Number(rowId)}, this.value)"
                    onblur="renderRosterTable()"
                    class="w-28 px-1.5 py-1 rounded-lg border border-teal-400 bg-white text-[10px] font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >${opts}</select>
            `;
    document.getElementById(`roster-unit-select-${rowId}`)?.focus();
}

function commitRosterUnitEdit(rowId, unitVal) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    if (row && !hasRosterRowEditAccess(row).allowed) { renderRosterTable(); return; }
    if (row) {
        row.unit = unitVal || '-';
        if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase([row]);
    }
    renderRosterTable();
}

function openRosterOffInlineEdit(rowId) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    const cell = document.getElementById(`roster-off-cell-${rowId}`);
    if (!row || !cell) return;
    if (!requireRosterEditAccess(null, row, () => openRosterOffInlineEdit(rowId))) return;

    const currentOff = row.offDay || '-';
    const opts = ['<option value="-">- (Manual)</option>'].concat(
        ROSTER_OFF_DAY_OPTIONS.map(o => {
            const selected = o.value === currentOff ? 'selected' : '';
            return `<option value="${escapeHtml(o.value)}" ${selected}>${escapeHtml(o.label)}</option>`;
        })
    ).join('');

    cell.innerHTML = `
                <select
                    id="roster-off-select-${rowId}"
                    onchange="commitRosterOffEdit(${Number(rowId)}, this.value)"
                    onblur="renderRosterTable()"
                    class="w-32 px-1.5 py-1 rounded-lg border border-red-400 bg-white text-[10px] font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >${opts}</select>
            `;
    document.getElementById(`roster-off-select-${rowId}`)?.focus();
}

function commitRosterOffEdit(rowId, offVal) {
    const row = rosterState.find(r => Number(r.id) === Number(rowId));
    if (!row) { renderRosterTable(); return; }
    if (!hasRosterRowEditAccess(row).allowed) { renderRosterTable(); return; }

    const { monthIdx, year, ymKey } = getRosterActiveMonthYear();
    const parsed = parseRosterOffDay(offVal);
    if (!parsed) {
        row.offDay = '-';
        if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase([row]);
        renderRosterTable();
        showToast(`Hari OFF ${row.nama} diatur ke mode manual.`, 'info');
        return;
    }

    row.offDay = parsed.value;
    if (!row.scheduleByMonth) row.scheduleByMonth = {};
    const existingMonthSched = row.scheduleByMonth[ymKey] || null;
    row.scheduleByMonth[ymKey] = generateMonthlyRosterFromOffDay(year, monthIdx, parsed.value, {}, existingMonthSched);
    if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase([row]);

    renderRosterTable();
    const offLabel = typeof formatRosterOffDayLabel === 'function' ? formatRosterOffDayLabel(parsed.value) : parsed.value;
    showToast(`OFF ${row.nama} diubah ke ${offLabel} — jadwal ${MONTH_NAMES_ID[monthIdx]} ${year} otomatis dibuat (6 DWS + 7 NWS + OFF).`, 'success');
}

let activeRosterGridInputEl = null;
const rosterGridSelection = new Set(); // key: "${rowIdx}:${dayNum}"
let rosterGridAnchor = null;           // { rowIdx, day }
let rosterGridCursor = null;           // { rowIdx, day }
let isRosterGridDragging = false;
let rosterGridDragBase = new Set();
let rosterTouchBlockMode = false;
let rosterInternalClipboard = '';
let rosterTouchHoldTimer = null;
let rosterTouchPending = null;         // { inputEl, pos, startX, startY }
const rosterDragState = {
    active: false,
    viaTouch: false,
    mode: null,       // 'cell' | 'col' | 'row'
    moved: false,
    startX: 0,
    startY: 0,
    anchorDay: null,
    anchorRow: null
};
const rosterUndoStack = [];            // Array<Array<{ rowId, ymKey, dayNum, before, after }>>
const ROSTER_UNDO_MAX = 25;

function cancelRosterTouchHoldTimer() {
    if (rosterTouchHoldTimer) {
        clearTimeout(rosterTouchHoldTimer);
        rosterTouchHoldTimer = null;
    }
    rosterTouchPending = null;
}

function setRosterDraggingVisual(isDragging) {
    const tbl = document.getElementById('table-roster');
    if (tbl) tbl.classList.toggle('roster-grid-dragging', Boolean(isDragging));
}

function toggleRosterTouchBlockMode(forceState = null) {
    rosterTouchBlockMode = forceState === null ? !rosterTouchBlockMode : Boolean(forceState);
    const tbl = document.getElementById('table-roster');
    if (tbl) tbl.classList.toggle('roster-touch-block-mode', rosterTouchBlockMode);

    const btn = document.getElementById('btn-roster-block-mode');
    if (btn) {
        btn.className = rosterTouchBlockMode
            ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-600 border border-sky-700 text-white text-[9px] font-bold shadow-xs transition-colors'
            : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-gray-200 hover:bg-sky-50 hover:border-sky-300 text-gray-700 text-[9px] font-semibold transition-colors';
        btn.innerHTML = rosterTouchBlockMode
            ? '<i class="fa-solid fa-vector-square"></i><span>Mode Blok: ON</span>'
            : '<i class="fa-solid fa-vector-square text-sky-600"></i><span>Mode Blok</span>';
    }

    if (rosterTouchBlockMode) {
        showToast('Mode Blok AKTIF — geser jari atau kursor langsung di sel/kolom untuk memblok banyak sel.', 'info');
    }
}

function autoScrollRosterContainer(clientX) {
    const tbl = document.getElementById('table-roster');
    const scroller = tbl?.parentElement;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const edge = 40;
    if (clientX > rect.right - edge) scroller.scrollLeft += 18;
    else if (clientX < rect.left + edge) scroller.scrollLeft -= 18;
}

function getRosterMaxRowAndDay() {
    const inputs = getAllVisibleRosterDayInputs();
    if (!inputs.length) return { maxRow: -1, maxDay: 0 };
    let maxRow = 0;
    let maxDay = 0;
    inputs.forEach(inp => {
        const r = Number(inp.dataset.rowIdx);
        const d = Number(inp.dataset.day);
        if (r > maxRow) maxRow = r;
        if (d > maxDay) maxDay = d;
    });
    return { maxRow, maxDay };
}

function selectRosterColumnRange(dayA, dayB, mergeBaseSet = null) {
    const { maxRow } = getRosterMaxRowAndDay();
    if (maxRow < 0) return;
    const dMin = Math.min(Number(dayA), Number(dayB));
    const dMax = Math.max(Number(dayA), Number(dayB));
    rosterGridAnchor = { rowIdx: 0, day: Number(dayA) };
    rosterGridCursor = { rowIdx: maxRow, day: Number(dayB) };
    setRosterSelectionRect({ rowIdx: 0, day: dMin }, { rowIdx: maxRow, day: dMax }, mergeBaseSet);
}

function selectRosterRowRange(rowA, rowB, mergeBaseSet = null) {
    const { maxDay } = getRosterMaxRowAndDay();
    if (maxDay <= 0) return;
    const rMin = Math.min(Number(rowA), Number(rowB));
    const rMax = Math.max(Number(rowA), Number(rowB));
    rosterGridAnchor = { rowIdx: Number(rowA), day: 1 };
    rosterGridCursor = { rowIdx: Number(rowB), day: maxDay };
    setRosterSelectionRect({ rowIdx: rMin, day: 1 }, { rowIdx: rMax, day: maxDay }, mergeBaseSet);
}

function applyRosterDragPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;
    const base = rosterGridDragBase.size ? rosterGridDragBase : null;

    if (rosterDragState.mode === 'col') {
        const th = el.closest('th[data-col-day]');
        const tdInput = el.closest('td')?.querySelector('input.roster-grid-input[data-day]');
        const targetDay = th ? Number(th.dataset.colDay) : (tdInput ? Number(tdInput.dataset.day) : null);
        if (targetDay && rosterDragState.anchorDay) {
            selectRosterColumnRange(rosterDragState.anchorDay, targetDay, base);
        }
        return;
    }

    if (rosterDragState.mode === 'row') {
        const rowBtn = el.closest('[data-row-select]');
        const trInput = el.closest('tr')?.querySelector('input.roster-grid-input[data-row-idx]');
        const targetRow = rowBtn ? Number(rowBtn.dataset.rowSelect) : (trInput ? Number(trInput.dataset.rowIdx) : null);
        if (targetRow !== null && !isNaN(targetRow) && rosterDragState.anchorRow !== null) {
            selectRosterRowRange(rosterDragState.anchorRow, targetRow, base);
        }
        return;
    }

    if (rosterDragState.mode === 'cell') {
        const targetInput = el.matches?.('input.roster-grid-input[data-day]')
            ? el
            : el.closest('td')?.querySelector('input.roster-grid-input[data-day]');
        if (targetInput && rosterGridAnchor) {
            const pos = { rowIdx: Number(targetInput.dataset.rowIdx), day: Number(targetInput.dataset.day) };
            rosterGridCursor = pos;
            setRosterSelectionRect(rosterGridAnchor, pos, base);
        }
    }
}

function finishRosterDrag() {
    cancelRosterTouchHoldTimer();
    const wasActive = rosterDragState.active || isRosterGridDragging;
    const wasMoved = rosterDragState.moved;
    isRosterGridDragging = false;
    rosterDragState.active = false;
    rosterDragState.viaTouch = false;
    rosterDragState.mode = null;
    rosterDragState.moved = false;
    setRosterDraggingVisual(false);

    if (wasActive && wasMoved && rosterGridSelection.size > 1) {
        const ordered = getSelectedRosterInputsOrdered();
        if (ordered.length) {
            activeRosterGridInputEl = ordered[0].inputEl;
            if (!rosterTouchBlockMode) {
                ordered[0].inputEl.focus({ preventScroll: true });
            }
        }
    }
}

document.addEventListener('mousemove', (event) => {
    if (!rosterDragState.active || rosterDragState.viaTouch) return;
    if ((event.buttons & 1) === 0) {
        finishRosterDrag();
        return;
    }
    const dist = Math.hypot(event.clientX - rosterDragState.startX, event.clientY - rosterDragState.startY);
    if (!rosterDragState.moved && dist < 4) return;

    if (!rosterDragState.moved) {
        rosterDragState.moved = true;
        setRosterDraggingVisual(true);
        if (window.getSelection) window.getSelection().removeAllRanges();
        if (document.activeElement && document.activeElement.classList?.contains('roster-grid-input')) {
            document.activeElement.blur();
        }
    }

    autoScrollRosterContainer(event.clientX);
    applyRosterDragPoint(event.clientX, event.clientY);
});

document.addEventListener('mouseup', () => {
    finishRosterDrag();
});

document.addEventListener('touchmove', (event) => {
    const touch = event.touches && event.touches[0];
    if (!touch) return;

    // Jika sedang menunggu long-press 250ms pada sel dan jari bergeser -> batalkan hold agar scroll tabel tetap lancar
    if (rosterTouchPending && !rosterDragState.active) {
        const dist = Math.hypot(touch.clientX - rosterTouchPending.startX, touch.clientY - rosterTouchPending.startY);
        if (dist > 10) cancelRosterTouchHoldTimer();
        return;
    }

    if (!rosterDragState.active || !rosterDragState.viaTouch) return;
    event.preventDefault();
    rosterDragState.moved = true;
    setRosterDraggingVisual(true);
    autoScrollRosterContainer(touch.clientX);
    applyRosterDragPoint(touch.clientX, touch.clientY);
}, { passive: false });

document.addEventListener('touchend', () => {
    finishRosterDrag();
});

document.addEventListener('touchcancel', () => {
    finishRosterDrag();
});

function rosterCellKey(rowIdx, dayNum) {
    return `${Number(rowIdx)}:${Number(dayNum)}`;
}

function parseRosterCellKey(key) {
    const [rStr, dStr] = String(key).split(':');
    return { rowIdx: Number(rStr), day: Number(dStr) };
}

function getRosterGridInputByPos(rowIdx, dayNum) {
    return document.querySelector(`#roster-table-body input.roster-grid-input[data-row-idx="${Number(rowIdx)}"][data-day="${Number(dayNum)}"]`);
}

function getAllVisibleRosterDayInputs() {
    return Array.from(document.querySelectorAll('#roster-table-body input.roster-grid-input[data-day]'));
}

function updateRosterUndoButton() {
    const btn = document.getElementById('btn-roster-undo');
    if (btn) btn.classList.toggle('hidden', rosterUndoStack.length === 0);
}

function refreshRosterSelectionStyles() {
    const allInputs = getAllVisibleRosterDayInputs();
    const anchorKey = rosterGridAnchor ? rosterCellKey(rosterGridAnchor.rowIdx, rosterGridAnchor.day) : '';
    const showMultiStyle = rosterGridSelection.size > 1;

    allInputs.forEach(inp => {
        const td = inp.closest('td');
        if (!td) return;
        const key = rosterCellKey(inp.dataset.rowIdx, inp.dataset.day);
        const isSelected = showMultiStyle && rosterGridSelection.has(key);
        const isAnchor = showMultiStyle && key === anchorKey;
        td.classList.toggle('roster-cell-selected', isSelected);
        td.classList.toggle('roster-cell-anchor', isAnchor);
    });

    const statusEl = document.getElementById('roster-selection-status');
    const labelEl = document.getElementById('roster-selection-count-label');
    if (statusEl && labelEl) {
        if (rosterGridSelection.size > 1) {
            statusEl.classList.remove('hidden');
            labelEl.textContent = `${rosterGridSelection.size} sel terblok`;
        } else {
            statusEl.classList.add('hidden');
        }
    }
}

function clearRosterGridSelection(keepAnchor = false) {
    rosterGridSelection.clear();
    if (keepAnchor && rosterGridAnchor) {
        rosterGridSelection.add(rosterCellKey(rosterGridAnchor.rowIdx, rosterGridAnchor.day));
        rosterGridCursor = { ...rosterGridAnchor };
    } else {
        rosterGridAnchor = null;
        rosterGridCursor = null;
    }
    refreshRosterSelectionStyles();
}

function setRosterSelectionRect(fromPos, toPos, mergeBaseSet = null) {
    rosterGridSelection.clear();
    if (mergeBaseSet) {
        mergeBaseSet.forEach(k => rosterGridSelection.add(k));
    }
    const rMin = Math.min(fromPos.rowIdx, toPos.rowIdx);
    const rMax = Math.max(fromPos.rowIdx, toPos.rowIdx);
    const dMin = Math.min(fromPos.day, toPos.day);
    const dMax = Math.max(fromPos.day, toPos.day);

    for (let r = rMin; r <= rMax; r++) {
        for (let d = dMin; d <= dMax; d++) {
            if (getRosterGridInputByPos(r, d)) {
                rosterGridSelection.add(rosterCellKey(r, d));
            }
        }
    }
    refreshRosterSelectionStyles();
}

function getSelectedRosterInputsOrdered() {
    const items = [];
    rosterGridSelection.forEach(k => {
        const { rowIdx, day } = parseRosterCellKey(k);
        const inp = getRosterGridInputByPos(rowIdx, day);
        if (inp) items.push({ rowIdx, day, inputEl: inp });
    });
    items.sort((a, b) => (a.rowIdx - b.rowIdx) || (a.day - b.day));
    return items;
}

function selectRosterColumn(dayNum, event) {
    const colInputs = Array.from(document.querySelectorAll(`#roster-table-body input.roster-grid-input[data-day="${Number(dayNum)}"]`));
    if (!colInputs.length) return;
    const isCtrl = Boolean(event?.ctrlKey || event?.metaKey);
    const isShift = Boolean(event?.shiftKey);

    if (isShift && rosterGridAnchor) {
        selectRosterColumnRange(rosterGridAnchor.day, Number(dayNum), null);
    } else {
        const base = isCtrl ? new Set(rosterGridSelection) : null;
        selectRosterColumnRange(Number(dayNum), Number(dayNum), base);
    }

    activeRosterGridInputEl = colInputs[0];
    colInputs[0].focus({ preventScroll: true });
}

function handleRosterColHeaderMouseDown(event, dayNum) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (activeRosterGridInputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }
    const isCtrl = Boolean(event.ctrlKey || event.metaKey);
    const isShift = Boolean(event.shiftKey);
    if (isShift && rosterGridAnchor) {
        selectRosterColumnRange(rosterGridAnchor.day, Number(dayNum), null);
    } else {
        rosterGridDragBase = isCtrl ? new Set(rosterGridSelection) : new Set();
        selectRosterColumnRange(Number(dayNum), Number(dayNum), rosterGridDragBase.size ? rosterGridDragBase : null);
    }
    isRosterGridDragging = true;
    rosterDragState.active = true;
    rosterDragState.viaTouch = false;
    rosterDragState.mode = 'col';
    rosterDragState.moved = false;
    rosterDragState.startX = event.clientX;
    rosterDragState.startY = event.clientY;
    rosterDragState.anchorDay = Number(dayNum);
    rosterDragState.anchorRow = null;

    const firstCell = getRosterGridInputByPos(0, dayNum);
    if (firstCell) {
        activeRosterGridInputEl = firstCell;
        firstCell.focus({ preventScroll: true });
    }
}

function handleRosterColHeaderTouchStart(event, dayNum) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    event.preventDefault();
    if (activeRosterGridInputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }
    rosterGridDragBase = new Set();
    selectRosterColumnRange(Number(dayNum), Number(dayNum), null);
    isRosterGridDragging = true;
    rosterDragState.active = true;
    rosterDragState.viaTouch = true;
    rosterDragState.mode = 'col';
    rosterDragState.moved = false;
    rosterDragState.startX = touch.clientX;
    rosterDragState.startY = touch.clientY;
    rosterDragState.anchorDay = Number(dayNum);
    rosterDragState.anchorRow = null;
    setRosterDraggingVisual(true);
    const firstCell = getRosterGridInputByPos(0, dayNum);
    if (firstCell) activeRosterGridInputEl = firstCell;
}

function selectRosterRow(rowIdx, event) {
    const rowInputs = Array.from(document.querySelectorAll(`#roster-table-body input.roster-grid-input[data-row-idx="${Number(rowIdx)}"][data-day]`));
    if (!rowInputs.length) return;
    const isCtrl = Boolean(event?.ctrlKey || event?.metaKey);
    const isShift = Boolean(event?.shiftKey);

    if (isShift && rosterGridAnchor) {
        selectRosterRowRange(rosterGridAnchor.rowIdx, Number(rowIdx), null);
    } else {
        const base = isCtrl ? new Set(rosterGridSelection) : null;
        selectRosterRowRange(Number(rowIdx), Number(rowIdx), base);
    }

    activeRosterGridInputEl = rowInputs[0];
    rowInputs[0].focus({ preventScroll: true });
}

function handleRosterRowHeaderMouseDown(event, rowIdx) {
    if (event.button !== 0) return;
    event.preventDefault();
    if (activeRosterGridInputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }
    const isCtrl = Boolean(event.ctrlKey || event.metaKey);
    const isShift = Boolean(event.shiftKey);
    if (isShift && rosterGridAnchor) {
        selectRosterRowRange(rosterGridAnchor.rowIdx, Number(rowIdx), null);
    } else {
        rosterGridDragBase = isCtrl ? new Set(rosterGridSelection) : new Set();
        selectRosterRowRange(Number(rowIdx), Number(rowIdx), rosterGridDragBase.size ? rosterGridDragBase : null);
    }
    isRosterGridDragging = true;
    rosterDragState.active = true;
    rosterDragState.viaTouch = false;
    rosterDragState.mode = 'row';
    rosterDragState.moved = false;
    rosterDragState.startX = event.clientX;
    rosterDragState.startY = event.clientY;
    rosterDragState.anchorDay = null;
    rosterDragState.anchorRow = Number(rowIdx);

    const firstCell = getRosterGridInputByPos(rowIdx, 1);
    if (firstCell) {
        activeRosterGridInputEl = firstCell;
        firstCell.focus({ preventScroll: true });
    }
}

function handleRosterRowHeaderTouchStart(event, rowIdx) {
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    event.preventDefault();
    if (activeRosterGridInputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }
    rosterGridDragBase = new Set();
    selectRosterRowRange(Number(rowIdx), Number(rowIdx), null);
    isRosterGridDragging = true;
    rosterDragState.active = true;
    rosterDragState.viaTouch = true;
    rosterDragState.mode = 'row';
    rosterDragState.moved = false;
    rosterDragState.startX = touch.clientX;
    rosterDragState.startY = touch.clientY;
    rosterDragState.anchorDay = null;
    rosterDragState.anchorRow = Number(rowIdx);
    setRosterDraggingVisual(true);
    const firstCell = getRosterGridInputByPos(rowIdx, 1);
    if (firstCell) activeRosterGridInputEl = firstCell;
}

function handleRosterGridMouseDown(event, inputEl) {
    if (event.button !== 0 || inputEl?.readOnly) return;
    const pos = { rowIdx: Number(inputEl.dataset.rowIdx), day: Number(inputEl.dataset.day) };
    const key = rosterCellKey(pos.rowIdx, pos.day);
    const isCtrl = Boolean(event.ctrlKey || event.metaKey);
    const isShift = Boolean(event.shiftKey);

    // Simpan sel sebelumnya terlebih dahulu bila sedang diedit
    if (activeRosterGridInputEl && activeRosterGridInputEl !== inputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }

    if (isShift && rosterGridAnchor) {
        event.preventDefault();
        rosterGridCursor = pos;
        setRosterSelectionRect(rosterGridAnchor, pos);
        activeRosterGridInputEl = inputEl;
        inputEl.focus({ preventScroll: true });
        return;
    }

    if (isCtrl) {
        event.preventDefault();
        if (rosterGridSelection.has(key) && rosterGridSelection.size > 1) {
            rosterGridSelection.delete(key);
        } else {
            rosterGridSelection.add(key);
        }
        rosterGridAnchor = pos;
        rosterGridCursor = pos;
        rosterGridDragBase = new Set(rosterGridSelection);
        isRosterGridDragging = true;
        rosterDragState.active = true;
        rosterDragState.viaTouch = false;
        rosterDragState.mode = 'cell';
        rosterDragState.moved = false;
        rosterDragState.startX = event.clientX;
        rosterDragState.startY = event.clientY;
        activeRosterGridInputEl = inputEl;
        refreshRosterSelectionStyles();
        inputEl.focus({ preventScroll: true });
        return;
    }

    // Jika Mode Blok aktif, langsung cegah fokus teks agar kursor langsung geser blok
    if (rosterTouchBlockMode) {
        event.preventDefault();
    }

    // Klik biasa: mulai seleksi tunggal + siap drag kursor mulus ala Excel
    rosterGridSelection.clear();
    rosterGridSelection.add(key);
    rosterGridAnchor = pos;
    rosterGridCursor = pos;
    rosterGridDragBase = new Set();
    isRosterGridDragging = true;
    rosterDragState.active = true;
    rosterDragState.viaTouch = false;
    rosterDragState.mode = 'cell';
    rosterDragState.moved = false;
    rosterDragState.startX = event.clientX;
    rosterDragState.startY = event.clientY;
    activeRosterGridInputEl = inputEl;
    refreshRosterSelectionStyles();
}

function handleRosterGridMouseEnter(event, inputEl) {
    if (!isRosterGridDragging || rosterDragState.mode !== 'cell' || !rosterGridAnchor) return;
    if ((event.buttons & 1) === 0) {
        finishRosterDrag();
        return;
    }
    const pos = { rowIdx: Number(inputEl.dataset.rowIdx), day: Number(inputEl.dataset.day) };
    if (pos.rowIdx !== rosterGridAnchor.rowIdx || pos.day !== rosterGridAnchor.day) {
        rosterDragState.moved = true;
        setRosterDraggingVisual(true);
        if (window.getSelection) window.getSelection().removeAllRanges();
    }
    rosterGridCursor = pos;
    setRosterSelectionRect(rosterGridAnchor, pos, rosterGridDragBase.size ? rosterGridDragBase : null);
}

function handleRosterGridTouchStart(event, inputEl) {
    if (inputEl?.readOnly) return;
    const touch = event.touches && event.touches[0];
    if (!touch) return;
    const pos = { rowIdx: Number(inputEl.dataset.rowIdx), day: Number(inputEl.dataset.day) };
    const key = rosterCellKey(pos.rowIdx, pos.day);

    if (activeRosterGridInputEl && activeRosterGridInputEl !== inputEl && document.body.contains(activeRosterGridInputEl)) {
        commitRosterGridInput(activeRosterGridInputEl, false);
    }

    const startCellTouchDrag = () => {
        rosterGridSelection.clear();
        rosterGridSelection.add(key);
        rosterGridAnchor = pos;
        rosterGridCursor = pos;
        rosterGridDragBase = new Set();
        isRosterGridDragging = true;
        rosterDragState.active = true;
        rosterDragState.viaTouch = true;
        rosterDragState.mode = 'cell';
        rosterDragState.moved = true;
        rosterDragState.startX = touch.clientX;
        rosterDragState.startY = touch.clientY;
        activeRosterGridInputEl = inputEl;
        setRosterDraggingVisual(true);
        refreshRosterSelectionStyles();
        if (document.activeElement && document.activeElement.classList?.contains('roster-grid-input')) {
            document.activeElement.blur();
        }
        if (navigator.vibrate && navigator.userActivation?.hasBeenActive) {
            try { navigator.vibrate(15); } catch (_) { }
        }
    };

    if (rosterTouchBlockMode) {
        event.preventDefault();
        startCellTouchDrag();
        return;
    }

    // Mode normal: tahan singkat 250ms lalu geser jari untuk memblok sel (tanpa mengganggu scroll biasa)
    cancelRosterTouchHoldTimer();
    rosterTouchPending = { inputEl, pos, startX: touch.clientX, startY: touch.clientY };
    rosterTouchHoldTimer = setTimeout(() => {
        if (!rosterTouchPending) return;
        rosterTouchPending = null;
        rosterTouchHoldTimer = null;
        startCellTouchDrag();
    }, 250);
}

function applyRosterBatchChanges(changeSpecs, recordUndo = true) {
    const undoBatch = [];
    let blockedRow = null;
    changeSpecs.forEach(spec => {
        const row = rosterState.find(r => Number(r.id) === Number(spec.rowId));
        if (!row) return;
        if (!hasRosterRowEditAccess(row).allowed) {
            if (!blockedRow) blockedRow = row;
            return;
        }
        if (!row.scheduleByMonth) row.scheduleByMonth = {};
        if (!row.scheduleByMonth[spec.ymKey]) row.scheduleByMonth[spec.ymKey] = {};

        const before = String(row.scheduleByMonth[spec.ymKey][spec.dayNum] || '').trim().toUpperCase();
        const after = String(spec.newVal || '').trim().toUpperCase();

        if (before !== after) {
            undoBatch.push({ rowId: row.id, ymKey: spec.ymKey, dayNum: spec.dayNum, before, after });
            if (!after) delete row.scheduleByMonth[spec.ymKey][spec.dayNum];
            else row.scheduleByMonth[spec.ymKey][spec.dayNum] = after;
        }

        const inp = spec.inputEl || document.getElementById(`roster-day-input-${row.id}-${spec.dayNum}`);
        updateRosterDayCellVisual(inp?.closest('td'), inp, row, spec.ymKey, spec.dayNum, after);
    });

    if (blockedRow && undoBatch.length === 0) {
        requireRosterEditAccess(null, blockedRow);
        return 0;
    }

    if (recordUndo && undoBatch.length > 0) {
        rosterUndoStack.push(undoBatch);
        if (rosterUndoStack.length > ROSTER_UNDO_MAX) rosterUndoStack.shift();
        updateRosterUndoButton();
    }

    if (undoBatch.length > 0 && typeof pushRosterRowsToSupabase === 'function') {
        const touchedIds = new Set(undoBatch.map(u => Number(u.rowId)));
        const touchedRows = rosterState.filter(r => touchedIds.has(Number(r.id)));
        if (touchedRows.length) pushRosterRowsToSupabase(touchedRows);
    }

    refreshRosterSelectionStyles();
    renderRosterShiftSummaryFooter();
    renderRosterInfoPanel();
    return undoBatch.length;
}

function undoRosterGridChange() {
    if (!rosterUndoStack.length) {
        showToast('Tidak ada perubahan untuk dibatalkan.', 'info');
        return false;
    }
    const lastBatch = rosterUndoStack.pop();
    const revertSpecs = lastBatch.map(ch => ({
        rowId: ch.rowId,
        ymKey: ch.ymKey,
        dayNum: ch.dayNum,
        newVal: ch.before
    }));
    applyRosterBatchChanges(revertSpecs, false);
    updateRosterUndoButton();
    showToast(`Undo: ${lastBatch.length} sel dikembalikan ke kode sebelumnya.`, 'info');
    return true;
}

function getValidMasterRosterCodesList() {
    return masterKodeRosterState
        .map(item => String(item.kode || '').trim().toUpperCase())
        .filter(Boolean);
}

/**
 * Validasi ketat kode roster terhadap Master Data > Kode Roster:
 * - Kosong / '-' diizinkan (menghapus isi sel)
 * - Harus cocok persis dengan kode di Master Data Kode Roster
 * - Variasi angka pada awalan 1 huruf D / N (mis. D520, N520) diizinkan HANYA bila kode D / N ada di Master Data
 * - Selain itu DITOLAK.
 */
function validateMasterRosterCode(rawCode) {
    const clean = String(rawCode || '').trim().toUpperCase();
    if (!clean || clean === '-') {
        return { valid: true, normalized: '', rule: null };
    }

    const exact = masterKodeRosterState.find(
        item => String(item.kode || '').trim().toUpperCase() === clean
    );
    if (exact) {
        return { valid: true, normalized: clean, rule: exact };
    }

    const codes = getValidMasterRosterCodesList();
    if (codes.includes('D') && /^D\d+$/.test(clean)) {
        return { valid: true, normalized: clean, rule: resolveRosterCodeRule(clean) };
    }
    if (codes.includes('N') && /^N\d+$/.test(clean)) {
        return { valid: true, normalized: clean, rule: resolveRosterCodeRule(clean) };
    }

    return { valid: false, normalized: clean, rule: null };
}

function isValidMasterRosterPrefix(rawCode) {
    const clean = String(rawCode || '').trim().toUpperCase();
    if (!clean || clean === '-') return true;
    const codes = getValidMasterRosterCodesList();
    if (codes.some(k => k.startsWith(clean))) return true;
    if (codes.includes('D') && /^D\d+$/.test(clean)) return true;
    if (codes.includes('N') && /^N\d+$/.test(clean)) return true;
    return false;
}

function validateMasterUnitCode(rawUnit) {
    const clean = String(rawUnit || '').trim().toUpperCase();
    if (!clean || clean === '-') {
        return { valid: true, canonical: '-' };
    }
    const targetKey = normalizeUnitKey(clean);
    const matched = komisioningState.find(u => normalizeUnitKey(u.no_unit) === targetKey);
    if (matched) {
        return { valid: true, canonical: matched.no_unit };
    }
    return { valid: false, canonical: clean };
}

function flashRosterCellRejected(cellEl) {
    if (!cellEl) return;
    cellEl.classList.remove('roster-cell-rejected');
    void cellEl.offsetWidth; // trigger reflow agar animasi selalu berjalan
    cellEl.classList.add('roster-cell-rejected');
    setTimeout(() => cellEl.classList.remove('roster-cell-rejected'), 550);
}

function handleRosterUnitDirectInput(inputEl) {
    if (!inputEl) return;
    const val = String(inputEl.value || '').trim().toUpperCase();
    if (!val || val === '-') {
        inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');
        return;
    }
    const norm = normalizeUnitKey(val);
    const isPrefixOk = komisioningState.some(u =>
        normalizeUnitKey(u.no_unit).startsWith(norm) || String(u.no_unit || '').toUpperCase().startsWith(val)
    );
    inputEl.classList.toggle('!bg-red-50', !isPrefixOk);
    inputEl.classList.toggle('!text-red-700', !isPrefixOk);
    inputEl.classList.toggle('!ring-red-500', !isPrefixOk);
}

function handleRosterUnitDirectKeydown(event, inputEl) {
    if (event.key === 'Enter') {
        event.preventDefault();
        if (commitRosterUnitDirectInput(inputEl)) {
            const rowId = Number(inputEl.dataset.rowId);
            const firstDay = document.getElementById(`roster-day-input-${rowId}-1`);
            if (firstDay) firstDay.focus();
            else inputEl.blur();
        }
    } else if (event.key === 'Escape') {
        event.preventDefault();
        inputEl.value = inputEl.dataset.prev || '-';
        inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');
        inputEl.blur();
    }
}

function commitRosterUnitDirectInput(inputEl) {
    if (!inputEl) return false;
    inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');
    const rowId = Number(inputEl.dataset.rowId);
    const prevVal = String(inputEl.dataset.prev || '-').trim() || '-';
    const rawVal = String(inputEl.value || '').trim();
    const row = rosterState.find(r => Number(r.id) === rowId);
    if (!row) return false;
    if (!hasRosterRowEditAccess(row).allowed) {
        inputEl.value = prevVal;
        return false;
    }

    const check = validateMasterUnitCode(rawVal);
    if (!check.valid) {
        inputEl.value = prevVal;
        flashRosterCellRejected(inputEl.closest('td'));
        const validUnits = komisioningState.map(u => u.no_unit).join(', ');
        showToast(`Unit "${rawVal.toUpperCase()}" ditolak — tidak ada di Master Data Unit (${validUnits || '-'}).`, 'error');
        return false;
    }

    inputEl.value = check.canonical;
    inputEl.dataset.prev = check.canonical;
    if (normalizeUnitKey(row.unit) !== normalizeUnitKey(check.canonical)) {
        row.unit = check.canonical;
        if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase([row]);
        renderRosterInfoPanel();
    }
    return true;
}

function handleRosterGridFocus(inputEl) {
    if (!inputEl || inputEl.readOnly) return;
    activeRosterGridInputEl = inputEl;
    const pos = { rowIdx: Number(inputEl.dataset.rowIdx), day: Number(inputEl.dataset.day) };
    const key = rosterCellKey(pos.rowIdx, pos.day);
    if (!rosterGridSelection.has(key)) {
        rosterGridSelection.clear();
        rosterGridSelection.add(key);
        rosterGridAnchor = pos;
        rosterGridCursor = pos;
        refreshRosterSelectionStyles();
    }
    if (rosterGridSelection.size <= 1) {
        inputEl.select();
    }
}

function handleRosterGridInput(inputEl) {
    if (!inputEl) return;
    const val = String(inputEl.value || '').trim().toUpperCase();
    const isPrefixOk = isValidMasterRosterPrefix(val);
    inputEl.classList.toggle('!bg-red-50', !isPrefixOk);
    inputEl.classList.toggle('!text-red-700', !isPrefixOk);
    inputEl.classList.toggle('!ring-red-500', !isPrefixOk);
}

function updateRosterDayCellVisual(tdEl, inputEl, row, ymKey, dayNum, code) {
    const st = getRosterCodeCellStyle(code);
    const hasCustomUnit = typeof hasCustomRosterUnitForDate === 'function' && hasCustomRosterUnitForDate(row, ymKey, dayNum);
    const unitOnDay = hasCustomUnit ? getRosterUnitForDate(row, ymKey, dayNum) : '';
    const cellTitle = hasCustomUnit ? `${st.tooltip} • Settingan Unit Tgl ${dayNum}: ${unitOnDay}` : st.tooltip;

    if (tdEl) {
        const wasSelected = tdEl.classList.contains('roster-cell-selected');
        const wasAnchor = tdEl.classList.contains('roster-cell-anchor');
        tdEl.className = `p-0 text-center whitespace-nowrap relative ${st.cellCls}${wasSelected ? ' roster-cell-selected' : ''}${wasAnchor ? ' roster-cell-anchor' : ''}`;
    }
    if (inputEl) {
        inputEl.value = code;
        inputEl.dataset.prev = code;
        inputEl.title = cellTitle;
        inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');
    }
}

function commitRosterGridInput(inputEl, keepFocusOnError = false) {
    if (!inputEl) return { ok: false };
    const rowId = Number(inputEl.dataset.rowId);
    const ymKey = inputEl.dataset.ymKey;
    const dayNum = Number(inputEl.dataset.day);
    const prevVal = String(inputEl.dataset.prev || '').trim().toUpperCase();
    const rawVal = String(inputEl.value || '').trim().toUpperCase();

    inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');

    // Tidak ada perubahan -> tidak perlu proses ulang
    if (rawVal === prevVal) {
        inputEl.value = prevVal;
        return { ok: true, changed: false };
    }

    const row = rosterState.find(r => Number(r.id) === rowId);
    if (!row) return { ok: false };

    const check = validateMasterRosterCode(rawVal);
    if (!check.valid) {
        inputEl.value = prevVal;
        flashRosterCellRejected(inputEl.closest('td'));
        const validList = getValidMasterRosterCodesList().join(', ');
        showToast(`Kode "${rawVal}" ditolak — tidak terdaftar di Master Data Kode Roster (${validList}).`, 'error');
        if (keepFocusOnError) {
            setTimeout(() => { inputEl.focus(); inputEl.select(); }, 0);
        }
        return { ok: false, rejected: true };
    }

    applyRosterBatchChanges([{
        inputEl,
        rowId,
        ymKey,
        dayNum,
        newVal: check.normalized
    }], true);
    return { ok: true, changed: true, value: check.normalized };
}

function moveRosterGridFocus(currRowIdx, currDay, dRow, dDay, extendSelection = false) {
    const nextRow = currRowIdx + dRow;
    const nextDay = currDay + dDay;
    const target = getRosterGridInputByPos(nextRow, nextDay);
    if (!target) return false;

    if (extendSelection) {
        if (!rosterGridAnchor) rosterGridAnchor = { rowIdx: currRowIdx, day: currDay };
        rosterGridCursor = { rowIdx: nextRow, day: nextDay };
        setRosterSelectionRect(rosterGridAnchor, rosterGridCursor);
        target.focus({ preventScroll: true });
        return true;
    }

    rosterGridSelection.clear();
    rosterGridSelection.add(rosterCellKey(nextRow, nextDay));
    rosterGridAnchor = { rowIdx: nextRow, day: nextDay };
    rosterGridCursor = { rowIdx: nextRow, day: nextDay };
    refreshRosterSelectionStyles();
    target.focus();
    target.select();
    return true;
}

function fillSelectedRosterCellsWithCode(rawCode, sourceInputEl = null) {
    const check = validateMasterRosterCode(rawCode);
    const selectedItems = getSelectedRosterInputsOrdered();
    if (!selectedItems.length && sourceInputEl) {
        selectedItems.push({
            rowIdx: Number(sourceInputEl.dataset.rowIdx),
            day: Number(sourceInputEl.dataset.day),
            inputEl: sourceInputEl
        });
    }
    if (!selectedItems.length) return { ok: false };

    if (!check.valid) {
        selectedItems.forEach(it => {
            it.inputEl.value = it.inputEl.dataset.prev || '';
            flashRosterCellRejected(it.inputEl.closest('td'));
        });
        const validList = getValidMasterRosterCodesList().join(', ');
        showToast(`Kode "${String(rawCode || '').trim().toUpperCase()}" ditolak — tidak terdaftar di Master Data Kode Roster (${validList}).`, 'error');
        return { ok: false, rejected: true };
    }

    const specs = selectedItems.map(it => ({
        inputEl: it.inputEl,
        rowId: Number(it.inputEl.dataset.rowId),
        ymKey: it.inputEl.dataset.ymKey,
        dayNum: Number(it.inputEl.dataset.day),
        newVal: check.normalized
    }));
    const changedCount = applyRosterBatchChanges(specs, true);
    showToast(`${selectedItems.length} sel terblok diisi kode "${check.normalized || '-'}" (${changedCount} berubah).`, 'success');
    return { ok: true, count: selectedItems.length, value: check.normalized };
}

function handleRosterGridKeydown(event, inputEl) {
    if (inputEl?.readOnly) {
        const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Shift', 'Control', 'Alt', 'Meta'];
        if (!navKeys.includes(event.key)) {
            event.preventDefault();
            const rowId = Number(inputEl.dataset.rowId);
            const row = rosterState.find(r => Number(r.id) === rowId);
            if (row) requireRosterEditAccess(null, row);
        }
        return;
    }
    const rowIdx = Number(inputEl.dataset.rowIdx);
    const dayNum = Number(inputEl.dataset.day);
    const isCtrl = Boolean(event.ctrlKey || event.metaKey);

    // Ctrl + Z -> Undo massal / tunggal
    if (isCtrl && String(event.key || '').toLowerCase() === 'z') {
        event.preventDefault();
        undoRosterGridChange();
        return;
    }

    // Ctrl + A -> Blok seluruh sel tanggal terlihat
    if (isCtrl && String(event.key || '').toLowerCase() === 'a') {
        event.preventDefault();
        const allInputs = getAllVisibleRosterDayInputs();
        rosterGridSelection.clear();
        allInputs.forEach(inp => rosterGridSelection.add(rosterCellKey(inp.dataset.rowIdx, inp.dataset.day)));
        if (allInputs.length) {
            rosterGridAnchor = { rowIdx: Number(allInputs[0].dataset.rowIdx), day: Number(allInputs[0].dataset.day) };
            const last = allInputs[allInputs.length - 1];
            rosterGridCursor = { rowIdx: Number(last.dataset.rowIdx), day: Number(last.dataset.day) };
        }
        refreshRosterSelectionStyles();
        showToast(`${rosterGridSelection.size} sel tanggal diblok (Ctrl+C / Ctrl+V / Del / Esc).`, 'info');
        return;
    }

    // Ctrl + Enter -> Isi seluruh sel terblok dengan kode yang sedang diketik (ala Excel)
    if (isCtrl && event.key === 'Enter' && rosterGridSelection.size > 1) {
        event.preventDefault();
        fillSelectedRosterCellsWithCode(inputEl.value, inputEl);
        return;
    }

    // Delete / Backspace saat banyak sel terblok -> kosongkan semua sel terblok sekaligus
    if ((event.key === 'Delete' || event.key === 'Backspace') && rosterGridSelection.size > 1) {
        event.preventDefault();
        const selectedItems = getSelectedRosterInputsOrdered();
        const specs = selectedItems.map(it => ({
            inputEl: it.inputEl,
            rowId: Number(it.inputEl.dataset.rowId),
            ymKey: it.inputEl.dataset.ymKey,
            dayNum: Number(it.inputEl.dataset.day),
            newVal: ''
        }));
        applyRosterBatchChanges(specs, true);
        showToast(`${selectedItems.length} sel terblok dikosongkan. Tekan Ctrl+Z untuk membatalkan.`, 'info');
        return;
    }

    if (event.key === 'Escape') {
        event.preventDefault();
        inputEl.value = inputEl.dataset.prev || '';
        inputEl.classList.remove('!bg-red-50', '!text-red-700', '!ring-red-500');
        if (rosterGridSelection.size > 1) {
            rosterGridAnchor = { rowIdx, day: dayNum };
            clearRosterGridSelection(true);
        }
        inputEl.select();
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        const res = commitRosterGridInput(inputEl, true);
        if (res.ok) {
            const moved = moveRosterGridFocus(rowIdx, dayNum, event.shiftKey ? -1 : 1, 0, false);
            if (!moved) inputEl.select();
        }
        return;
    }

    if (event.key === 'Tab') {
        const res = commitRosterGridInput(inputEl, true);
        if (!res.ok) {
            event.preventDefault();
            return;
        }
        const moved = moveRosterGridFocus(rowIdx, dayNum, 0, event.shiftKey ? -1 : 1, false);
        if (moved) event.preventDefault();
        return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const res = commitRosterGridInput(inputEl, true);
        if (res.ok) {
            const base = event.shiftKey && rosterGridCursor ? rosterGridCursor : { rowIdx, day: dayNum };
            moveRosterGridFocus(base.rowIdx, base.day, event.key === 'ArrowDown' ? 1 : -1, 0, Boolean(event.shiftKey));
        }
        return;
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        if (event.shiftKey) {
            event.preventDefault();
            const res = commitRosterGridInput(inputEl, true);
            if (res.ok) {
                const base = rosterGridCursor || { rowIdx, day: dayNum };
                moveRosterGridFocus(base.rowIdx, base.day, 0, event.key === 'ArrowRight' ? 1 : -1, true);
            }
            return;
        }
        const valLen = (inputEl.value || '').length;
        const allSelected = inputEl.selectionStart === 0 && inputEl.selectionEnd === valLen;
        const atEdge = event.key === 'ArrowRight'
            ? (inputEl.selectionStart === valLen && inputEl.selectionEnd === valLen)
            : (inputEl.selectionStart === 0 && inputEl.selectionEnd === 0);
        if (allSelected || atEdge || rosterGridSelection.size > 1) {
            event.preventDefault();
            const res = commitRosterGridInput(inputEl, true);
            if (res.ok) moveRosterGridFocus(rowIdx, dayNum, 0, event.key === 'ArrowRight' ? 1 : -1, false);
        }
    }
}

function handleRosterGridBlur(inputEl) {
    commitRosterGridInput(inputEl, false);
}

function buildSelectedRosterTsv(fallbackInputEl = null) {
    const selectedItems = getSelectedRosterInputsOrdered();
    if (!selectedItems.length && fallbackInputEl) {
        selectedItems.push({
            rowIdx: Number(fallbackInputEl.dataset.rowIdx),
            day: Number(fallbackInputEl.dataset.day),
            inputEl: fallbackInputEl
        });
    }
    if (!selectedItems.length) return { count: 0, text: '' };

    const rMin = Math.min(...selectedItems.map(it => it.rowIdx));
    const rMax = Math.max(...selectedItems.map(it => it.rowIdx));
    const dMin = Math.min(...selectedItems.map(it => it.day));
    const dMax = Math.max(...selectedItems.map(it => it.day));
    const mapByKey = new Map(selectedItems.map(it => [rosterCellKey(it.rowIdx, it.day), String(it.inputEl.value || '').trim().toUpperCase()]));

    const tsvLines = [];
    for (let r = rMin; r <= rMax; r++) {
        const rowCols = [];
        for (let d = dMin; d <= dMax; d++) {
            const k = rosterCellKey(r, d);
            rowCols.push(mapByKey.has(k) ? mapByKey.get(k) : '');
        }
        tsvLines.push(rowCols.join('\t'));
    }
    return { count: selectedItems.length, text: tsvLines.join('\n') };
}

function handleRosterGridCopy(event, inputEl) {
    const { count, text } = buildSelectedRosterTsv(inputEl);
    if (!count) return;
    rosterInternalClipboard = text;

    if (event && event.clipboardData) {
        event.preventDefault();
        event.clipboardData.setData('text/plain', text);
    } else if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(() => { });
    }

    if (count > 1) {
        showToast(`${count} sel disalin (siap tempel ke Roster / Excel).`, 'info');
    }
}

function copySelectedRosterCellsBtn() {
    const { count, text } = buildSelectedRosterTsv(activeRosterGridInputEl);
    if (!count) {
        showToast('Blok sel terlebih dahulu untuk menyalin.', 'info');
        return;
    }
    rosterInternalClipboard = text;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(() => { });
    }
    showToast(`${count} sel terblok disalin — blok tujuan lalu tekan Tempel / Ctrl+V.`, 'success');
}

function clearSelectedRosterCellsBtn() {
    const selectedItems = getSelectedRosterInputsOrdered();
    if (!selectedItems.length) return;
    const specs = selectedItems.map(it => ({
        inputEl: it.inputEl,
        rowId: Number(it.inputEl.dataset.rowId),
        ymKey: it.inputEl.dataset.ymKey,
        dayNum: Number(it.inputEl.dataset.day),
        newVal: ''
    }));
    applyRosterBatchChanges(specs, true);
    showToast(`${selectedItems.length} sel terblok dikosongkan. Tekan Undo / Ctrl+Z untuk membatalkan.`, 'info');
}

function pasteToSelectedRosterCellsBtn() {
    const targetInput = activeRosterGridInputEl || getSelectedRosterInputsOrdered()[0]?.inputEl;
    if (!targetInput) {
        showToast('Blok sel tujuan terlebih dahulu sebelum menempel.', 'info');
        return;
    }
    const applyFallback = () => {
        if (rosterInternalClipboard) {
            processRosterGridPasteText(rosterInternalClipboard, targetInput);
        } else {
            showToast('Clipboard kosong. Tekan Salin (Ctrl+C) terlebih dahulu atau tekan Ctrl+V langsung.', 'info');
        }
    };
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        navigator.clipboard.readText()
            .then(txt => {
                if (txt && txt.trim()) processRosterGridPasteText(txt, targetInput);
                else applyFallback();
            })
            .catch(applyFallback);
    } else {
        applyFallback();
    }
}

function handleRosterGridPaste(event, startInputEl) {
    if (startInputEl?.readOnly) {
        event.preventDefault();
        const row = rosterState.find(r => Number(r.id) === Number(startInputEl.dataset.rowId));
        if (row) requireRosterEditAccess(null, row);
        return;
    }
    const pasted = event.clipboardData?.getData('text') || '';
    if (!pasted) return;
    event.preventDefault();
    processRosterGridPasteText(pasted, startInputEl);
}

function processRosterGridPasteText(pasted, startInputEl) {
    if (!pasted || !startInputEl) return;

    const cleaned = pasted.replace(/\r\n/g, '\n').replace(/\n$/, '');
    const rowsText = cleaned.split('\n');
    const matrix = rowsText.map(line => line.split('\t'));
    const isSingleValue = matrix.length === 1 && matrix[0].length === 1;

    // KASUS 1: Paste 1 nilai ke 1 atau BANYAK sel yang sedang diblok (Drag / Jari / Shift / Ctrl / Header)
    if (isSingleValue) {
        const rawVal = matrix[0][0];
        const selectedItems = getSelectedRosterInputsOrdered();
        if (selectedItems.length > 1) {
            fillSelectedRosterCellsWithCode(rawVal, startInputEl);
            return;
        }
        const check = validateMasterRosterCode(rawVal);
        if (!check.valid) {
            startInputEl.value = startInputEl.dataset.prev || '';
            flashRosterCellRejected(startInputEl.closest('td'));
            const validList = getValidMasterRosterCodesList().join(', ');
            showToast(`Paste ditolak: kode "${String(rawVal || '').trim().toUpperCase()}" tidak terdaftar di Master Data Kode Roster (${validList}).`, 'error');
            return;
        }
        applyRosterBatchChanges([{
            inputEl: startInputEl,
            rowId: Number(startInputEl.dataset.rowId),
            ymKey: startInputEl.dataset.ymKey,
            dayNum: Number(startInputEl.dataset.day),
            newVal: check.normalized
        }], true);
        return;
    }

    // KASUS 2: Paste blok multi-sel dari Excel / hasil Copy Roster (Opsi A: valid tersimpan, invalid ditolak)
    const selectedItems = getSelectedRosterInputsOrdered();
    const originRowIdx = selectedItems.length > 1
        ? Math.min(...selectedItems.map(it => it.rowIdx))
        : Number(startInputEl.dataset.rowIdx);
    const originDay = selectedItems.length > 1
        ? Math.min(...selectedItems.map(it => it.day))
        : Number(startInputEl.dataset.day);

    const validSpecs = [];
    const rejectedCodes = [];

    const uniqueSelRows = Array.from(new Set(selectedItems.map(it => it.rowIdx))).sort((a, b) => a - b);
    const tileSingleRowAcrossSelectedRows = matrix.length === 1 && uniqueSelRows.length > 1;
    const targetRows = tileSingleRowAcrossSelectedRows
        ? uniqueSelRows
        : matrix.map((_, rOffset) => originRowIdx + rOffset);

    targetRows.forEach((targetRowIdx, idxInTarget) => {
        const cols = tileSingleRowAcrossSelectedRows ? matrix[0] : matrix[idxInTarget];
        cols.forEach((rawCell, cOffset) => {
            const targetInput = getRosterGridInputByPos(targetRowIdx, originDay + cOffset);
            if (!targetInput) return;
            const check = validateMasterRosterCode(rawCell);
            if (!check.valid) {
                rejectedCodes.push(String(rawCell || '').trim().toUpperCase());
                flashRosterCellRejected(targetInput.closest('td'));
                return;
            }
            validSpecs.push({
                inputEl: targetInput,
                rowId: Number(targetInput.dataset.rowId),
                ymKey: targetInput.dataset.ymKey,
                dayNum: Number(targetInput.dataset.day),
                newVal: check.normalized
            });
        });
    });

    if (validSpecs.length > 0) {
        applyRosterBatchChanges(validSpecs, true);
    }

    if (rejectedCodes.length > 0) {
        const uniqRej = Array.from(new Set(rejectedCodes)).slice(0, 5).join(', ');
        showToast(`Paste selesai: ${validSpecs.length} sel disimpan, ${rejectedCodes.length} kode ditolak (${uniqRej}) karena tidak ada di Master Data.`, 'error');
    } else if (validSpecs.length > 0) {
        showToast(`${validSpecs.length} sel jadwal berhasil ditempel sesuai Master Data Kode Roster.`, 'success');
    }
}

function applyQuickMasterCodeToActiveCell(code) {
    if (rosterGridSelection.size > 1) {
        fillSelectedRosterCellsWithCode(code, activeRosterGridInputEl);
        return;
    }
    if (!activeRosterGridInputEl || !document.body.contains(activeRosterGridInputEl)) {
        showToast('Klik atau blok sel tanggal di tabel Roster terlebih dahulu, lalu ketik/paste atau pilih kode.', 'info');
        return;
    }
    const target = activeRosterGridInputEl;
    target.value = String(code || '').toUpperCase();
    const res = commitRosterGridInput(target, true);
    if (res.ok) {
        const moved = moveRosterGridFocus(Number(target.dataset.rowIdx), Number(target.dataset.day), 0, 1, false);
        if (!moved) target.select();
    }
}

function openRosterDayCellEdit(rowId, ymKey, dayNum) {
    const input = document.getElementById(`roster-day-input-${rowId}-${dayNum}`);
    if (input) { input.focus(); input.select(); }
}

function handleRosterDayKeydown(event, rowId, ymKey, dayNum) {
    const input = document.getElementById(`roster-day-input-${rowId}-${dayNum}`);
    if (input) handleRosterGridKeydown(event, input);
}

function commitRosterDayEdit(rowId, ymKey, dayNum) {
    const input = document.getElementById(`roster-day-input-${rowId}-${dayNum}`);
    if (input) commitRosterGridInput(input, false);
}

function openAddRosterRowModal() {
    if (!requireRosterEditAccess(activeRosterSubMenu, null, () => openAddRosterRowModal())) return;
    const mpSel = document.getElementById('roster-add-mp');
    const unitSel = document.getElementById('roster-add-unit');
    if (mpSel) {
        const preferred = manpowerState.filter(mp => matchesRosterSubMenu(mp.jabatan, activeRosterSubMenu));
        const others = manpowerState.filter(mp => !matchesRosterSubMenu(mp.jabatan, activeRosterSubMenu));
        const ordered = [...preferred, ...others];
        mpSel.innerHTML = ordered.map(mp =>
            `<option value="${Number(mp.id)}">${escapeHtml(mp.nama)} (${escapeHtml(mp.nrp)}) — ${escapeHtml(mp.jabatan)}</option>`
        ).join('');
    }
    if (unitSel) {
        unitSel.innerHTML = ['<option value="-">- (Tanpa Unit)</option>'].concat(
            komisioningState.map(u => `<option value="${escapeHtml(u.no_unit)}">${escapeHtml(u.no_unit)} — ${escapeHtml(u.model_tipe)}</option>`)
        ).join('');
    }
    const offEl = document.getElementById('roster-add-off-day');
    if (offEl) offEl.value = 'Senin 1';

    const modal = document.getElementById('modal-roster-add-row');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeAddRosterRowModal() {
    const modal = document.getElementById('modal-roster-add-row');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function handleAddRosterRowSubmit(event) {
    event.preventDefault();
    const mpId = Number(document.getElementById('roster-add-mp')?.value);
    const unitVal = document.getElementById('roster-add-unit')?.value || '-';
    const offDayVal = document.getElementById('roster-add-off-day')?.value || 'Senin 1';
    const mp = manpowerState.find(m => Number(m.id) === mpId);
    if (!mp) return;
    const targetScope = activeRosterSubMenu !== 'all' ? activeRosterSubMenu : getRosterSubMenuKeyForJabatan(mp.jabatan);
    if (!hasRosterEditAccess(targetScope).allowed) {
        closeAddRosterRowModal();
        requireRosterEditAccess(targetScope);
        return;
    }

    const { monthIdx, year, ymKey } = getRosterActiveMonthYear();
    const parsedOff = parseRosterOffDay(offDayVal);
    const normalizedOff = parsedOff ? parsedOff.value : 'Senin 1';
    const monthSched = generateMonthlyRosterFromOffDay(year, monthIdx, normalizedOff);

    const existing = rosterState.find(r => String(r.nrp) === String(mp.nrp));
    const offLabel = typeof formatRosterOffDayLabel === 'function' ? formatRosterOffDayLabel(normalizedOff) : normalizedOff;
    if (existing) {
        existing.unit = unitVal;
        existing.jabatan = mp.jabatan;
        existing.offDay = normalizedOff;
        if (!existing.scheduleByMonth) existing.scheduleByMonth = {};
        existing.scheduleByMonth[ymKey] = monthSched;
        showToast(`Jadwal ${MONTH_NAMES_ID[monthIdx]} ${year} untuk ${mp.nama} diperbarui (OFF: ${offLabel}, 6 DWS + 7 NWS).`, 'success');
    } else {
        const nextId = rosterState.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
        rosterState.push({
            id: nextId,
            nrp: mp.nrp,
            nama: mp.nama,
            jabatan: mp.jabatan,
            unit: unitVal,
            offDay: normalizedOff,
            scheduleByMonth: { [ymKey]: monthSched }
        });
        showToast(`${mp.nama} (${mp.nrp}) ditambahkan ke Roster SE (OFF: ${offLabel}, otomatis 6 DWS + 7 NWS).`, 'success');
    }

    if (typeof pushRosterRowsToSupabase === 'function') {
        const savedRow = rosterState.find(r => String(r.nrp) === String(mp.nrp));
        if (savedRow) pushRosterRowsToSupabase([savedRow]);
    }

    closeAddRosterRowModal();
    renderRosterTable();
    renderManpowerTable();
}

function removePersonFromRosterById(rowId) {
    const person = rosterState.find(r => Number(r.id) === Number(rowId));
    if (!person) return;

    openConfirmDeleteModal({
        title: 'Keluarkan dari Roster SE',
        message: `Apakah Anda yakin ingin mengeluarkan <strong>${escapeHtml(person.nama)}</strong> (NRP: ${escapeHtml(person.nrp)}) dari Roster aktif? Nama yang bersangkutan akan otomatis ditandai <strong class="text-red-600">(out)</strong> di Data Manpower.`,
        confirmText: 'Ya, Keluarkan',
        onConfirm: () => {
            rosterState = rosterState.filter(r => Number(r.id) !== Number(rowId));
            renderRosterTable();
            renderManpowerTable();
            showToast(`${person.nama} dikeluarkan dari roster dan ditandai (out) di Data Manpower.`, 'info');
        }
    });
}

function downloadRosterExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const { monthIdx, year, daysInMonth } = getRosterActiveMonthYear();
    const subLabel = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu]?.label || 'Semua';
    const row1 = ['NO', 'NRP', 'NAMA', 'UNIT', 'OFF'];
    const row2 = ['', '', '', '', ''];
    for (let d = 1; d <= daysInMonth; d++) {
        row1.push(d);
        row2.push(DAYS_SHORT_ID[new Date(year, monthIdx, d).getDay()]);
    }

    const ws = XLSX.utils.aoa_to_sheet([row1, row2]);
    ws['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 11 },
        ...Array.from({ length: daysInMonth }, () => ({ wch: 7 }))
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Roster');
    const safeSub = subLabel.replace(/[^a-zA-Z0-9]+/g, '_');
    XLSX.writeFile(wb, `Template_Roster_${safeSub}_${MONTH_NAMES_ID[monthIdx]}_${year}.xlsx`);
    showToast(`Template Roster (${MONTH_NAMES_ID[monthIdx]} ${year}, ${daysInMonth} hari) berhasil diunduh.`, 'success');
}

function downloadRosterAllExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const { monthIdx, year, ymKey, daysInMonth } = getRosterActiveMonthYear();
    const subLabel = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu]?.label || 'Semua';

    let rows = getFilteredRosterRows();
    if (rosterSortState.column && rosterSortState.direction !== 'none') {
        const col = rosterSortState.column;
        const dir = rosterSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'off') {
                const idxA = ROSTER_OFF_DAY_OPTIONS.findIndex(o => o.value === (a.offDay || ''));
                const idxB = ROSTER_OFF_DAY_OPTIONS.findIndex(o => o.value === (b.offDay || ''));
                const vA = idxA >= 0 ? idxA : 999;
                const vB = idxB >= 0 ? idxB : 999;
                return (vA - vB) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (!rows.length) {
        showToast(`Belum ada data Roster ${subLabel} untuk diunduh.`, 'info');
        return;
    }

    const row1 = ['NO', 'NRP', 'NAMA', 'JABATAN', 'UNIT', 'OFF'];
    const row2 = ['', '', '', '', '', ''];
    for (let d = 1; d <= daysInMonth; d++) {
        row1.push(d);
        row2.push(DAYS_SHORT_ID[new Date(year, monthIdx, d).getDay()]);
    }

    const shift1Counts = new Array(daysInMonth + 1).fill(0);
    const shift2Counts = new Array(daysInMonth + 1).fill(0);

    const dataRows = rows.map((r, idx) => {
        const sched = r.scheduleByMonth?.[ymKey] || {};
        const offRaw = r.offDay || detectOffDayFromSchedule(year, monthIdx, sched, daysInMonth) || '-';
        const offDisplay = typeof formatRosterOffDayShort === 'function' ? formatRosterOffDayShort(offRaw) : offRaw;
        const line = [
            idx + 1,
            String(r.nrp || ''),
            String(r.nama || '').toUpperCase(),
            String(r.jabatan || '-'),
            String(r.unit || '-').toUpperCase(),
            String(offDisplay || '-').toUpperCase()
        ];
        for (let d = 1; d <= daysInMonth; d++) {
            const code = String(sched[d] || '').trim().toUpperCase();
            line.push(code);
            const shiftNum = getRosterCodeShiftNumber(code);
            if (shiftNum === 1) shift1Counts[d]++;
            else if (shiftNum === 2) shift2Counts[d]++;
        }
        return line;
    });

    const summaryShift1 = ['SHIFT 1', '', '', 'Siang (DWS)', '', ''];
    const summaryShift2 = ['SHIFT 2', '', '', 'Malam (NWS)', '', ''];
    for (let d = 1; d <= daysInMonth; d++) {
        summaryShift1.push(shift1Counts[d]);
        summaryShift2.push(shift2Counts[d]);
    }

    const aoa = [row1, row2, ...dataRows, summaryShift1, summaryShift2];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const totalCols = 6 + daysInMonth;
    const totalRows = aoa.length;
    const s1RowIdx = 2 + dataRows.length;
    const s2RowIdx = s1RowIdx + 1;

    const thinBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };
    const footerTopBorder = {
        top: { style: 'medium', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
    };

    const ensureCellStyle = (rIdx, cIdx, styleObj) => {
        const ref = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        ws[ref].s = styleObj;
    };

    // 1. Styling Header (Baris 0 & 1)
    for (let c = 0; c < totalCols; c++) {
        const isDayCol = c >= 6;
        const dNum = c - 5;
        const dow = isDayCol ? new Date(year, monthIdx, dNum).getDay() : -1;
        const isWeekend = dow === 0 || dow === 6;
        const hdrFill = isWeekend ? 'FEE2E2' : 'E5E7EB';
        const hdrFont = isWeekend ? 'B91C1C' : '111827';
        const hdrStyle = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: hdrFont } },
            fill: { patternType: 'solid', fgColor: { rgb: hdrFill } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
            border: thinBorder
        };
        ensureCellStyle(0, c, hdrStyle);
        ensureCellStyle(1, c, hdrStyle);
    }

    // 2. Styling Baris Data Personil (pekat & border tipis hitam seperti referensi Excel)
    for (let i = 0; i < dataRows.length; i++) {
        const rIdx = 2 + i;
        for (let c = 0; c < totalCols; c++) {
            if (c < 6) {
                const isLeft = (c === 2 || c === 3);
                ensureCellStyle(rIdx, c, {
                    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
                    fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
                    alignment: { horizontal: isLeft ? 'left' : 'center', vertical: 'center' },
                    border: thinBorder
                });
            } else {
                const code = String(dataRows[i][c] || '').trim().toUpperCase();
                const pal = getRosterCodePalette(code);
                ensureCellStyle(rIdx, c, {
                    font: { name: 'Calibri', sz: 10, bold: pal.bold, color: { rgb: pal.fontHex } },
                    fill: { patternType: 'solid', fgColor: { rgb: pal.fillHex } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: thinBorder
                });
            }
        }
    }

    // 3. Styling Footer Ringkasan SHIFT 1 (Putih) & SHIFT 2 (Hijau Foto 1 #006740)
    for (let c = 0; c < totalCols; c++) {
        ensureCellStyle(s1RowIdx, c, {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
            alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
            border: footerTopBorder
        });
        ensureCellStyle(s2RowIdx, c, {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
            fill: { patternType: 'solid', fgColor: { rgb: ROSTER_SHIFT2_HEX } },
            alignment: { horizontal: c === 0 ? 'left' : 'center', vertical: 'center' },
            border: thinBorder
        });
    }

    // Merge vertikal kolom A-F di header & merge label SHIFT 1 / SHIFT 2 di footer
    ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },
        { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } },
        { s: { r: 0, c: 4 }, e: { r: 1, c: 4 } },
        { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },
        { s: { r: s1RowIdx, c: 0 }, e: { r: s1RowIdx, c: 2 } },
        { s: { r: s1RowIdx, c: 3 }, e: { r: s1RowIdx, c: 5 } },
        { s: { r: s2RowIdx, c: 0 }, e: { r: s2RowIdx, c: 2 } },
        { s: { r: s2RowIdx, c: 3 }, e: { r: s2RowIdx, c: 5 } }
    ];

    ws['!cols'] = [
        { wch: 5 }, { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 11 }, { wch: 10 },
        ...Array.from({ length: daysInMonth }, () => ({ wch: 6.5 }))
    ];
    ws['!rows'] = Array.from({ length: totalRows }, (_, idx) => ({ hpt: idx < 2 ? 20 : 19 }));

    const wb = XLSX.utils.book_new();
    const safeSheetName = `Roster ${MONTH_NAMES_ID[monthIdx]} ${year}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    const safeSub = subLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    XLSX.writeFile(wb, `Roster_ALL_${safeSub}_${MONTH_NAMES_ID[monthIdx]}_${year}.xlsx`);
    showToast(`Berhasil mengunduh Roster ${subLabel} berwarna (${rows.length} personil • ${MONTH_NAMES_ID[monthIdx]} ${year}).`, 'success');
}

function handleRosterExcelUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!hasRosterEditAccess(activeRosterSubMenu).allowed) {
        event.target.value = '';
        closeRosterUploadModal();
        requireRosterEditAccess(activeRosterSubMenu);
        return;
    }
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const { monthIdx, year, ymKey, daysInMonth } = getRosterActiveMonthYear();
    const defaultJabatan = ROSTER_SUBMENU_CONFIG[activeRosterSubMenu]?.defaultJabatan || 'Operator Crane';

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            let headerRowIdx = aoa.findIndex(r =>
                Array.isArray(r) && r.some(c => /^(nrp|nik|nama|name)$/i.test(String(c || '').trim()))
            );
            if (headerRowIdx === -1) headerRowIdx = 0;

            const headerRow = (aoa[headerRowIdx] || []).map(c => String(c || '').trim());
            const findCol = (aliases) => headerRow.findIndex(h =>
                aliases.some(a => h.toLowerCase() === a.toLowerCase())
            );

            const nrpCol = findCol(['NRP', 'NIK']);
            const namaCol = findCol(['NAMA', 'NAMA MANPOWER', 'NAME']);
            const unitCol = findCol(['UNIT', 'NO UNIT']);
            const offCol = findCol(['OFF', 'HARI OFF', 'OFF DAY']);
            const jabatanCol = findCol(['JABATAN', 'ROLE', 'POSITION']);

            const dayCols = {};
            headerRow.forEach((h, idx) => {
                const m = h.match(/^(\d{1,2})$/);
                if (m) {
                    const dNum = parseInt(m[1], 10);
                    if (dNum >= 1 && dNum <= 31) dayCols[dNum] = idx;
                }
            });

            const parsedRows = [];
            for (let rIdx = headerRowIdx + 1; rIdx < aoa.length; rIdx++) {
                const row = aoa[rIdx];
                if (!Array.isArray(row)) continue;
                const nrp = nrpCol >= 0 ? String(row[nrpCol] || '').trim() : '';
                const nama = namaCol >= 0 ? String(row[namaCol] || '').trim() : '';

                if (!nrp && !nama) continue;
                if (/^shift\s*[12]$/i.test(nama) || /^shift\s*[12]$/i.test(nrp)) continue;

                const matchedMp = manpowerState.find(m =>
                    (nrp && String(m.nrp).trim().toLowerCase() === nrp.toLowerCase()) ||
                    (nama && String(m.nama).trim().toLowerCase() === nama.toLowerCase())
                );

                let monthSched = {};
                Object.entries(dayCols).forEach(([dKey, cIdx]) => {
                    const val = String(row[cIdx] || '').trim().toUpperCase();
                    if (val && val !== '-') monthSched[Number(dKey)] = val;
                });

                const rawOff = offCol >= 0 ? String(row[offCol] || '').trim() : '';
                const parsedOff = parseRosterOffDay(rawOff);
                let offDay = parsedOff ? parsedOff.value : '';

                // Bila kolom tanggal di Excel kosong namun kolom OFF (mis. Senin 1 / Senin 2) diisi,
                // otomatis buatkan jadwal 6 DWS + 7 NWS + OFF untuk bulan aktif.
                if (Object.keys(monthSched).length === 0 && offDay) {
                    monthSched = generateMonthlyRosterFromOffDay(year, monthIdx, offDay);
                } else if (!offDay) {
                    offDay = detectOffDayFromSchedule(year, monthIdx, monthSched, daysInMonth);
                }

                parsedRows.push({
                    nrp: nrp || matchedMp?.nrp || '-',
                    nama: nama || matchedMp?.nama || '-',
                    jabatan: matchedMp?.jabatan || (jabatanCol >= 0 ? String(row[jabatanCol] || '').trim() : '') || defaultJabatan,
                    unit: unitCol >= 0 ? (String(row[unitCol] || '').trim().toUpperCase() || '-') : '-',
                    offDay: offDay || '-',
                    monthSched
                });
            }

            if (!parsedRows.length) {
                showToast('File Roster kosong atau header NRP/NAMA tidak ditemukan.', 'error');
                return;
            }

            const saveMode = document.getElementById('roster-upload-save-mode')?.value || 'overwrite';
            let added = 0;
            let updated = 0;
            let skipped = 0;
            let nextId = rosterState.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;

            if (saveMode === 'overwrite' && activeRosterSubMenu === 'all') {
                updated = rosterState.length;
                rosterState = parsedRows.map(item => ({
                    id: nextId++,
                    nrp: item.nrp,
                    nama: item.nama,
                    jabatan: item.jabatan,
                    unit: item.unit,
                    offDay: item.offDay,
                    scheduleByMonth: { [ymKey]: item.monthSched }
                }));
                added = rosterState.length;
            } else {
                parsedRows.forEach(item => {
                    const existing = rosterState.find(r =>
                        (item.nrp !== '-' && String(r.nrp).trim().toLowerCase() === item.nrp.toLowerCase()) ||
                        (item.nama !== '-' && String(r.nama).trim().toLowerCase() === item.nama.toLowerCase())
                    );
                    if (existing) {
                        if (saveMode === 'append') {
                            skipped++;
                        } else {
                            existing.nama = item.nama;
                            existing.jabatan = item.jabatan;
                            if (item.unit && item.unit !== '-') existing.unit = item.unit;
                            if (item.offDay && item.offDay !== '-') existing.offDay = item.offDay;
                            if (!existing.scheduleByMonth) existing.scheduleByMonth = {};
                            existing.scheduleByMonth[ymKey] = item.monthSched;
                            updated++;
                        }
                    } else {
                        rosterState.push({
                            id: nextId++,
                            nrp: item.nrp,
                            nama: item.nama,
                            jabatan: item.jabatan,
                            unit: item.unit,
                            offDay: item.offDay,
                            scheduleByMonth: { [ymKey]: item.monthSched }
                        });
                        added++;
                    }
                });
            }

            if (typeof pushRosterRowsToSupabase === 'function') pushRosterRowsToSupabase(rosterState);
            renderRosterTable();
            renderManpowerTable();
            closeRosterUploadModal();
            showToast(formatUploadResultToast(`Roster SE (${daysInMonth} hari)`, { added, updated, skipped }, saveMode), 'success');
        } catch (err) {
            console.error('Gagal membaca Excel Roster:', err);
            showToast('File Excel Roster tidak dapat dibaca.', 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

function openRosterUploadModal() {
    if (!requireRosterEditAccess(activeRosterSubMenu, null, () => openRosterUploadModal())) return;
    const modal = document.getElementById('modal-roster-upload');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeRosterUploadModal() {
    const modal = document.getElementById('modal-roster-upload');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function toggleGenericTableSort(tableId, colIndex, type = 'text') {
    const table = document.getElementById(tableId);
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    if (rows.length <= 1) return;

    if (!genericTableSortState[tableId]) {
        rows.forEach((tr, idx) => tr.dataset.origOrder = String(idx));
        genericTableSortState[tableId] = { colIndex: null, direction: 'none' };
    }

    const st = genericTableSortState[tableId];
    if (st.colIndex !== colIndex) {
        st.colIndex = colIndex;
        st.direction = 'desc';
    } else if (st.direction === 'desc') {
        st.direction = 'asc';
    } else {
        st.colIndex = null;
        st.direction = 'none';
    }

    table.querySelectorAll('[data-gen-sort-icon]').forEach(icon => {
        const key = icon.getAttribute('data-gen-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (st.colIndex !== null && key === `${tableId}:${st.colIndex}`) {
            icon.classList.add(st.direction === 'desc' ? 'fa-sort-down' : 'fa-sort-up', 'text-teal-600');
        } else {
            icon.classList.add('fa-sort', 'text-gray-300');
        }
    });

    if (st.direction === 'none' || st.colIndex === null) {
        rows.sort((a, b) => Number(a.dataset.origOrder || 0) - Number(b.dataset.origOrder || 0));
    } else {
        const dir = st.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            const txtA = (a.children[colIndex]?.textContent || '').trim();
            const txtB = (b.children[colIndex]?.textContent || '').trim();
            if (type === 'number') {
                const nA = parseFloat(txtA.replace(/[^0-9.\-]/g, '')) || 0;
                const nB = parseFloat(txtB.replace(/[^0-9.\-]/g, '')) || 0;
                return (nA - nB) * dir;
            }
            return txtA.toLowerCase().localeCompare(txtB.toLowerCase(), 'id') * dir;
        });
    }

    rows.forEach(tr => tbody.appendChild(tr));
}

/* =====================================================================
 * 8. MODAL KONFIRMASI HAPUS DATA (REUSABLE)
 * ===================================================================== */
function openConfirmDeleteModal({ title, message, confirmText, onConfirm }) {
    pendingConfirmDeleteAction = typeof onConfirm === 'function' ? onConfirm : null;
    const titleEl = document.getElementById('confirm-delete-title');
    const msgEl = document.getElementById('confirm-delete-message');
    const btnTextEl = document.getElementById('btn-confirm-delete-text');

    if (titleEl) titleEl.textContent = title || 'Konfirmasi Hapus Data';
    if (msgEl) msgEl.innerHTML = message || 'Apakah Anda yakin ingin menghapus data ini?';
    if (btnTextEl) btnTextEl.textContent = confirmText || 'Ya, Hapus';

    const modal = document.getElementById('modal-confirm-delete');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeConfirmDeleteModal() {
    pendingConfirmDeleteAction = null;
    const modal = document.getElementById('modal-confirm-delete');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function executeConfirmDelete() {
    const action = pendingConfirmDeleteAction;
    closeConfirmDeleteModal();
    if (action) action();
}

/* =====================================================================
 * 9. UTILITAS UMUM & TOAST NOTIFICATION
 * ===================================================================== */
function getTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateID(dateStr) {
    if (!dateStr) return '-';
    const clean = String(dateStr).trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length !== 3) return clean;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 0 || m > 11) return clean;
    return `${String(d).padStart(2, '0')} ${MONTH_SHORT_ID[m]} ${y}`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsString(str) {
    return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function findRowValueByAliases(row, aliases) {
    if (!row || typeof row !== 'object') return '';
    const keys = Object.keys(row);
    for (const alias of aliases) {
        const target = alias.trim().toLowerCase();
        const foundKey = keys.find(k => k.trim().toLowerCase() === target);
        if (foundKey !== undefined && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
        }
    }
    return '';
}

function normalizeExcelDate(val) {
    if (val === null || val === undefined || val === '') return '';
    if (typeof val === 'number') {
        const utcDays = Math.floor(val - 25569);
        const d = new Date(utcDays * 86400 * 1000);
        if (!isNaN(d.getTime())) {
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
    return '';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const styles = {
        success: { bg: 'bg-emerald-600', icon: 'fa-circle-check' },
        error: { bg: 'bg-red-600', icon: 'fa-circle-exclamation' },
        info: { bg: 'bg-gray-800', icon: 'fa-circle-info' }
    };
    const st = styles[type] || styles.info;

    const el = document.createElement('div');
    el.className = `pointer-events-auto ${st.bg} text-white px-3.5 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-medium transition-all duration-300 opacity-0 translate-y-2`;
    el.innerHTML = `<i class="fa-solid ${st.icon} shrink-0"></i><span class="leading-snug">${escapeHtml(message)}</span>`;
    container.appendChild(el);

    requestAnimationFrame(() => {
        el.classList.remove('opacity-0', 'translate-y-2');
    });

    setTimeout(() => {
        el.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => el.remove(), 300);
    }, 3400);
}

/* =====================================================================
 * 9C. PUSAT INFORMASI (CHANNEL TELEGRAM: AUDIENS, LINK, EDIT & SLOW MODE)
 * ===================================================================== */
const INFO_CATEGORY_BADGE = {
    'SAFETY ALERT': 'bg-red-100 text-red-700',
    'OPERASIONAL': 'bg-teal-100 text-teal-700',
    'ADMINISTRASI': 'bg-indigo-100 text-indigo-700',
    'URGENT': 'bg-amber-100 text-amber-800',
    'UMUM': 'bg-gray-100 text-gray-700'
};

function getActiveUserProfile() {
    return USER_ACCESS_PROFILES[activeUserProfileKey] || USER_ACCESS_PROFILES.admin;
}

function sanitizeExternalUrl(rawUrl) {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    if (/^javascript:|^data:|^vbscript:/i.test(trimmed)) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

function formatNowWitaLabel() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `Hari ini, ${hh}:${mm} WITA`;
}

function getInfoCooldownMs(item) {
    const val = Number(item?.chatCooldownValue) || 0;
    if (val <= 0) return 0;
    return item.chatCooldownUnit === 'hours' ? val * 3600000 : val * 60000;
}

function formatInfoCooldownLabel(item) {
    if (!item.chatEnabled) return 'Komentar Ditutup';
    const val = Number(item.chatCooldownValue) || 0;
    if (val <= 0) return 'Chat Terbuka';
    return `Jeda Chat: ${val} ${item.chatCooldownUnit === 'hours' ? 'Jam' : 'Menit'}`;
}

function getRemainingCommentWaitMs(item, profile) {
    if (!item.chatEnabled || profile.type === 'admin') return 0;
    const cooldownMs = getInfoCooldownMs(item);
    if (cooldownMs <= 0) return 0;
    const lastAt = infoCommentCooldowns[`${item.id}::${profile.key}`];
    if (!lastAt) return 0;
    return Math.max(0, cooldownMs - (Date.now() - lastAt));
}

function formatCountdownClock(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isInfoVisibleToProfile(item, profile) {
    if (profile.type === 'admin') return true;
    if (item.audiensAll) return true;
    return Array.isArray(item.audiens) && item.audiens.includes(profile.jabatan);
}

/**
 * Mengubah mode akses aktif (Admin, Group Leader, atau Karyawan/Audiens)
 * dan menyinkronkan tampilan Sidebar Footer + toolbar Pusat Informasi.
 */
function setActiveUserProfile(profileKey, notify = true) {
    if (!USER_ACCESS_PROFILES[profileKey]) return;
    activeUserProfileKey = profileKey;
    const profile = getActiveUserProfile();

    const avatarEl = document.getElementById('sidebar-user-avatar');
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    if (avatarEl) {
        avatarEl.textContent = profile.avatar;
        avatarEl.className = `w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${profile.type === 'admin' ? 'bg-teal-600' : (profile.type === 'section' ? 'bg-purple-700' : (profile.type === 'gl' ? 'bg-gray-800' : 'bg-sky-600'))
            }`;
    }
    if (nameEl) nameEl.textContent = profile.nama;
    if (roleEl) roleEl.textContent = profile.roleLabel;

    const addBtn = document.getElementById('btn-add-informasi');
    if (addBtn) {
        addBtn.classList.toggle('hidden', profile.type !== 'admin');
        addBtn.classList.toggle('inline-flex', profile.type === 'admin');
    }

    const accessBadge = document.getElementById('info-access-badge');
    if (accessBadge) {
        const badgeConfig = {
            admin: { cls: 'bg-teal-50 text-teal-700 border-teal-200', icon: 'fa-shield-halved', text: 'Akses Admin (Full Control)' },
            gl: { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: 'fa-user-tie', text: 'Akses GL (Edit & Komen)' },
            section: { cls: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'fa-user-shield', text: 'Akses Section (Edit & Komen)' },
            karyawan: { cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'fa-user', text: `Manpower: ${profile.jabatan}` }
        };
        const cfg = badgeConfig[profile.type] || badgeConfig.karyawan;
        accessBadge.className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.cls}`;
        accessBadge.innerHTML = `<i class="fa-solid ${cfg.icon}"></i><span>${escapeHtml(cfg.text)}</span>`;
    }

    renderInformasiSection();
    clearRosterPicUnlockedGrants();
    if (typeof applyRoleAccessAndNavigationUi === 'function') {
        applyRoleAccessAndNavigationUi();
    }
    if (document.getElementById('roster-table-body')) {
        renderRosterTable();
    }
    if (notify) {
        showToast(`Mode akses aktif diubah ke ${profile.nama} (${profile.roleLabel}).`, 'info');
    }
}

function syncInfoCooldownTicker() {
    const profile = getActiveUserProfile();
    const hasActiveCooldown = informasiState.some(item =>
        activeInfoChatId === item.id &&
        isInfoVisibleToProfile(item, profile) &&
        getRemainingCommentWaitMs(item, profile) > 0
    );

    if (!hasActiveCooldown) {
        if (infoCooldownTickerId) {
            clearInterval(infoCooldownTickerId);
            infoCooldownTickerId = null;
        }
        return;
    }

    if (infoCooldownTickerId) return;
    infoCooldownTickerId = setInterval(() => {
        const currentProfile = getActiveUserProfile();
        let stillWaiting = false;
        let anyJustExpired = false;

        document.querySelectorAll('.info-cooldown-timer[data-info-id]').forEach(el => {
            const infoId = Number(el.getAttribute('data-info-id'));
            const item = informasiState.find(i => i.id === infoId);
            if (!item) return;
            const rem = getRemainingCommentWaitMs(item, currentProfile);
            if (rem > 0) {
                stillWaiting = true;
                el.textContent = formatCountdownClock(rem);
            } else {
                anyJustExpired = true;
            }
        });

        if (anyJustExpired) {
            renderInformasiSection();
        } else if (!stillWaiting && infoCooldownTickerId) {
            clearInterval(infoCooldownTickerId);
            infoCooldownTickerId = null;
        }
    }, 1000);
}

function isOwnInfoComment(comment, profile) {
    if (!comment || !profile) return false;
    if (comment.authorKey) return comment.authorKey === profile.key;
    const cName = String(comment.authorName || '').trim().toLowerCase();
    const pName = String(profile.nama || '').trim().toLowerCase();
    return Boolean(cName && pName && cName === pName);
}

function getInfoCardAccent(kategori) {
    const map = {
        'SAFETY ALERT': 'border-l-red-500',
        'URGENT': 'border-l-rose-600',
        'OPERASIONAL': 'border-l-teal-500',
        'ADMINISTRASI': 'border-l-indigo-500',
        'UMUM': 'border-l-slate-400'
    };
    return map[kategori] || 'border-l-teal-500';
}

function getInfoCategoryDotColor(kategori) {
    const map = {
        'SAFETY ALERT': 'bg-red-500',
        'URGENT': 'bg-rose-600',
        'OPERASIONAL': 'bg-teal-500',
        'ADMINISTRASI': 'bg-indigo-500',
        'UMUM': 'bg-slate-400'
    };
    return map[kategori] || 'bg-teal-500';
}

const INFO_QUICK_EMOJIS = ['👍', '❤️', '🔥', '✅', '👏', '🙏', '💪', '⚠️'];
let openInfoEmojiPickerId = null;
let openChatEmojiBarId = null;

function ensureInfoSocialState(item) {
    if (!item) return;
    if (!Array.isArray(item.likes)) item.likes = [];
    if (!item.reactions || typeof item.reactions !== 'object') item.reactions = {};
    if (typeof item.shares !== 'number' || Number.isNaN(item.shares)) item.shares = 0;
}

function getInfoAuthorInitials(name) {
    const clean = String(name || 'SE').trim();
    if (!clean) return 'SE';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
}

function getInfoReactionTotal(item) {
    ensureInfoSocialState(item);
    return Object.values(item.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}

function toggleInfoLike(infoId) {
    const item = informasiState.find(i => Number(i.id) === Number(infoId));
    if (!item) return;
    ensureInfoSocialState(item);
    const key = getActiveUserProfile().key;
    const idx = item.likes.indexOf(key);
    if (idx >= 0) item.likes.splice(idx, 1);
    else item.likes.push(key);
    renderInformasiSection();
    if (typeof schedulePatchInformasiSocial === 'function') schedulePatchInformasiSocial(item);
}

function toggleInfoEmojiPicker(infoId, event) {
    if (event) event.stopPropagation();
    const numId = Number(infoId);
    openInfoEmojiPickerId = openInfoEmojiPickerId === numId ? null : numId;
    renderInformasiSection();
    if (openInfoEmojiPickerId === numId) {
        setTimeout(() => {
            const inp = document.getElementById(`info-custom-emoji-${numId}`);
            if (inp) inp.focus();
        }, 30);
    }
}

function toggleInfoEmojiReaction(infoId, emoji) {
    const item = informasiState.find(i => Number(i.id) === Number(infoId));
    const cleanEmoji = String(emoji || '').trim();
    if (!item || !cleanEmoji) return;
    ensureInfoSocialState(item);
    const key = getActiveUserProfile().key;
    if (!Array.isArray(item.reactions[cleanEmoji])) item.reactions[cleanEmoji] = [];
    const idx = item.reactions[cleanEmoji].indexOf(key);
    if (idx >= 0) {
        item.reactions[cleanEmoji].splice(idx, 1);
        if (item.reactions[cleanEmoji].length === 0) delete item.reactions[cleanEmoji];
    } else {
        item.reactions[cleanEmoji].push(key);
    }
    openInfoEmojiPickerId = null;
    renderInformasiSection();
    if (typeof schedulePatchInformasiSocial === 'function') schedulePatchInformasiSocial(item);
}

function extractFirstEmojiToken(rawStr) {
    const text = String(rawStr || '').trim();
    if (!text) return '';
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        const seg = new Intl.Segmenter('id', { granularity: 'grapheme' });
        const first = Array.from(seg.segment(text))[0]?.segment || '';
        return first.trim();
    }
    return Array.from(text).slice(0, 2).join('').trim();
}

function submitCustomInfoEmoji(event, infoId) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const inp = document.getElementById(`info-custom-emoji-${infoId}`);
    const token = extractFirstEmojiToken(inp?.value || '');
    if (!token) {
        showToast('Ketik atau pilih emoji/stiker dari keyboard HP Anda.', 'info');
        if (inp) inp.focus();
        return;
    }
    toggleInfoEmojiReaction(infoId, token);
}

function toggleChatEmojiBar(infoId) {
    const numId = Number(infoId);
    openChatEmojiBarId = openChatEmojiBarId === numId ? null : numId;
    renderInformasiSection();
    const inp = document.getElementById(`info-comment-input-${numId}`);
    if (inp) inp.focus();
}

function appendEmojiToChatInput(infoId, emoji) {
    const inp = document.getElementById(`info-comment-input-${infoId}`);
    if (!inp) return;
    const start = inp.selectionStart ?? inp.value.length;
    const end = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0, start) + emoji + inp.value.slice(end);
    const pos = start + emoji.length;
    inp.focus();
    try { inp.setSelectionRange(pos, pos); } catch (_) { /* ignore */ }
}

function copyTextFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    document.body.removeChild(ta);
    return ok;
}

async function shareInformasiPost(infoId) {
    const item = informasiState.find(i => Number(i.id) === Number(infoId));
    if (!item) return;
    ensureInfoSocialState(item);

    const baseHref = window.location.href.split('#')[0];
    const shareUrl = `${baseHref}#info-${item.id}`;
    const firstLink = Array.isArray(item.links) && item.links.length ? item.links[0].url : '';
    const shareTitle = `[${item.kategori}] ${item.judul}`;
    const shareText = `${shareTitle}\n${item.deskripsi}${firstLink ? `\nLampiran: ${firstLink}` : ''}\n${shareUrl}`;

    try {
        if (navigator.share && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
            await navigator.share({ title: shareTitle, text: `${shareTitle}\n${item.deskripsi}`, url: shareUrl });
            item.shares += 1;
            renderInformasiSection();
            if (typeof schedulePatchInformasiSocial === 'function') schedulePatchInformasiSocial(item);
            showToast('Postingan berhasil dibagikan.', 'success');
            return;
        }
    } catch (err) {
        if (err && err.name === 'AbortError') return;
    }

    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareText);
            copied = true;
        }
    } catch (_) {
        copied = false;
    }
    if (!copied) copied = copyTextFallback(shareText);

    item.shares += 1;
    renderInformasiSection();
    if (typeof schedulePatchInformasiSocial === 'function') schedulePatchInformasiSocial(item);
    showToast(
        copied ? 'Link & isi postingan berhasil disalin — siap dibagikan!' : 'Siap dibagikan.',
        copied ? 'success' : 'info'
    );
}

function buildThreadsActionBarHtml(item, profile, inChatRoom = false) {
    ensureInfoSocialState(item);
    const key = profile.key;
    const likeCount = item.likes.length;
    const liked = item.likes.includes(key);
    const commentCount = Array.isArray(item.comments) ? item.comments.length : 0;
    const reactionEntries = Object.entries(item.reactions).filter(([, users]) => Array.isArray(users) && users.length > 0);
    const totalReactions = getInfoReactionTotal(item);
    const isPickerOpen = Number(openInfoEmojiPickerId) === Number(item.id);

    const reactionChipsHtml = reactionEntries.length
        ? `<div class="flex flex-wrap items-center gap-1 mt-1.5">
                ${reactionEntries.map(([emoji, users]) => {
            const active = users.includes(key);
            return `
                        <button type="button" onclick="toggleInfoEmojiReaction(${item.id}, '${escapeHtml(emoji)}')"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-medium border transition-colors ${active ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'}"
                            title="Klik untuk menambah/membatalkan reaksi">
                            <span class="text-[9.5px] leading-none">${escapeHtml(emoji)}</span>
                            <span class="tabular-nums">${users.length}</span>
                        </button>
                    `;
        }).join('')}
           </div>`
        : '';

    const commentBtnAction = inChatRoom
        ? `document.getElementById('info-comment-input-${item.id}')?.focus()`
        : `openInfoChatRoom(${item.id})`;

    const pickerPopoverHtml = isPickerOpen
        ? `<div onclick="event.stopPropagation()" class="info-emoji-popover absolute left-0 top-full mt-1 z-30 w-60 max-w-[85vw] p-2 rounded-xl bg-white border border-gray-200 shadow-lg space-y-1.5">
                <div class="flex items-center justify-between gap-0.5">
                    ${INFO_QUICK_EMOJIS.map(em => `
                        <button type="button" onclick="toggleInfoEmojiReaction(${item.id}, '${em}')"
                            class="w-6 h-6 rounded-full hover:bg-gray-100 active:scale-90 flex items-center justify-center text-[12px] transition-transform"
                            title="Reaksi ${em}">${em}</button>
                    `).join('')}
                </div>
                <form onsubmit="submitCustomInfoEmoji(event, ${item.id})" class="flex items-center gap-1 pt-1 border-t border-gray-100">
                    <input type="text" id="info-custom-emoji-${item.id}" maxlength="12" autocomplete="off"
                        placeholder="Ketik emoji/stiker keyboard HP..."
                        class="flex-1 min-w-0 px-2 py-1 rounded-full border border-gray-200 bg-gray-50 focus:bg-white text-[9.5px] focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <button type="submit" class="px-2 py-1 rounded-full bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-semibold shrink-0 transition-colors">
                        Kirim
                    </button>
                </form>
           </div>`
        : '';

    return `
        ${reactionChipsHtml}
        <div class="relative flex flex-wrap items-center gap-0.5 sm:gap-1 mt-1.5 -ml-1.5 select-none">
            <button type="button" onclick="toggleInfoLike(${item.id})" title="Suka"
                class="inline-flex items-center gap-1 px-1.5 py-1 rounded-full hover:bg-rose-50 transition-colors ${liked ? 'text-rose-600' : 'text-gray-600 hover:text-rose-600'}">
                <i class="${liked ? 'fa-solid' : 'fa-regular'} fa-heart text-[10.5px]"></i>
                ${likeCount > 0 ? `<span class="text-[9px] font-medium tabular-nums">${likeCount}</span>` : ''}
            </button>

            <button type="button" onclick="${commentBtnAction}" title="Respon &amp; Komentar"
                class="inline-flex items-center gap-1 px-1.5 py-1 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <i class="fa-regular fa-comment text-[10.5px]"></i>
                ${commentCount > 0 ? `<span class="text-[9px] font-medium tabular-nums">${commentCount}</span>` : ''}
            </button>

            <button type="button" onclick="toggleInfoEmojiPicker(${item.id}, event)" title="Kirim Stiker / Emoji Keyboard HP"
                class="inline-flex items-center gap-1 px-1.5 py-1 rounded-full transition-colors ${isPickerOpen ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}">
                <i class="fa-regular fa-face-smile text-[10.5px]"></i>
                ${totalReactions > 0 ? `<span class="text-[9px] font-medium tabular-nums">${totalReactions}</span>` : ''}
            </button>

            <button type="button" onclick="shareInformasiPost(${item.id})" title="Bagikan / Salin Link Postingan"
                class="inline-flex items-center gap-1 px-1.5 py-1 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <i class="fa-regular fa-paper-plane text-[10px]"></i>
                ${item.shares > 0 ? `<span class="text-[9px] font-medium tabular-nums">${item.shares}</span>` : ''}
            </button>
            ${pickerPopoverHtml}
        </div>
    `;
}

if (typeof document !== 'undefined' && !window.__pantauInfoEmojiDocListener) {
    window.__pantauInfoEmojiDocListener = true;
    document.addEventListener('click', (e) => {
        if (openInfoEmojiPickerId !== null && !e.target.closest('.info-emoji-popover')) {
            openInfoEmojiPickerId = null;
            renderInformasiSection();
        }
    });
}

function renderInformasiChatRoom(item, profile) {
    const chatView = document.getElementById('informasi-chat-view');
    if (!chatView || !item) return;

    const isAdmin = profile.type === 'admin';
    const canEdit = isAdmin || profile.type === 'gl' || profile.type === 'section';
    const comments = Array.isArray(item.comments) ? item.comments : [];
    const remainingMs = getRemainingCommentWaitMs(item, profile);

    const catStyle = INFO_CATEGORY_BADGE[item.kategori] || 'bg-gray-100 text-gray-700';
    const audLabel = item.audiensAll ? 'Semua Karyawan' : (item.audiens && item.audiens.length ? item.audiens.join(', ') : '-');
    const cooldownText = formatInfoCooldownLabel(item);
    const cooldownStyle = !item.chatEnabled
        ? 'bg-red-50 text-red-600 border-red-200'
        : (getInfoCooldownMs(item) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');
    const cooldownIcon = !item.chatEnabled ? 'fa-comment-slash' : (getInfoCooldownMs(item) > 0 ? 'fa-clock' : 'fa-comments');
    const cardAccent = getInfoCardAccent(item.kategori);
    const editedMeta = item.editedBy ? ` · Diedit oleh ${escapeHtml(item.editedBy)}` : '';

    const linksHtml = Array.isArray(item.links) && item.links.length
        ? `<div class="flex flex-wrap items-center gap-2 mt-2">
                ${item.links.map(lnk => `
                    <a href="${escapeHtml(lnk.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50/70 hover:bg-teal-100 border border-teal-200 text-[10px] font-medium text-teal-700 transition-colors">
                        <i class="fa-solid fa-link text-[9px]"></i>
                        <span>${escapeHtml(lnk.label || lnk.url)}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-[8px] opacity-75"></i>
                    </a>
                `).join('')}
           </div>`
        : '';

    const messagesHtml = comments.length
        ? comments.map(c => {
            const own = isOwnInfoComment(c, profile);
            if (own) {
                return `
                    <div class="flex justify-end" data-chat-side="right">
                        <div class="max-w-[84%] sm:max-w-[68%] rounded-2xl rounded-br-sm bg-blue-600 text-white px-3.5 py-2.5 shadow-sm">
                            <div class="flex items-center justify-between gap-3 mb-0.5">
                                <span class="text-[10px] font-bold text-blue-100">${escapeHtml(c.authorName)}</span>
                                <div class="flex items-center gap-1.5 shrink-0">
                                    <span class="text-[9.5px] text-blue-200">${escapeHtml(c.timeLabel)}</span>
                                    ${isAdmin ? `
                                        <button type="button" onclick="deleteInfoComment(${item.id}, ${c.id})" title="Hapus pesan" class="text-blue-200 hover:text-white text-[10px]">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            <p class="text-xs text-white leading-relaxed break-words whitespace-pre-line">${escapeHtml(c.text)}</p>
                        </div>
                    </div>
                `;
            }

            const roleColor = c.authorType === 'admin'
                ? 'bg-teal-100 text-teal-700'
                : (c.authorType === 'gl'
                    ? 'bg-indigo-100 text-indigo-700'
                    : (c.authorType === 'section' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200/80 text-gray-600'));
            const initials = String(c.authorName || '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();

            return `
                <div class="flex justify-start items-end gap-2" data-chat-side="left">
                    <div class="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9.5px] font-bold shrink-0 shadow-xs">
                        ${escapeHtml(initials)}
                    </div>
                    <div class="max-w-[84%] sm:max-w-[68%] rounded-2xl rounded-bl-sm bg-gradient-to-b from-white to-slate-100 border border-slate-200 text-gray-800 px-3.5 py-2.5 shadow-xs">
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-0.5">
                            <div class="flex items-center gap-1.5 min-w-0">
                                <span class="text-[11px] font-bold text-gray-800 truncate">${escapeHtml(c.authorName)}</span>
                                <span class="px-1.5 py-0.2 rounded-full text-[8.5px] font-semibold ${roleColor}">${escapeHtml(c.authorRole)}</span>
                            </div>
                            <div class="flex items-center gap-1.5 shrink-0">
                                <span class="text-[9.5px] text-gray-400">${escapeHtml(c.timeLabel)}</span>
                                ${isAdmin ? `
                                    <button type="button" onclick="deleteInfoComment(${item.id}, ${c.id})" title="Hapus pesan" class="text-gray-400 hover:text-red-600 text-[10px]">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        <p class="text-xs text-gray-700 leading-relaxed break-words whitespace-pre-line">${escapeHtml(c.text)}</p>
                    </div>
                </div>
            `;
        }).join('')
        : `
            <div class="py-10 text-center space-y-1.5">
                <div class="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center mx-auto">
                    <i class="fa-regular fa-comments"></i>
                </div>
                <p class="text-xs font-semibold text-gray-500">Belum ada obrolan</p>
            </div>
        `;

    let composerHtml = '';
    if (!item.chatEnabled) {
        composerHtml = `
            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-100 border border-gray-200 text-[11px] text-gray-600">
                <span><i class="fa-solid fa-lock mr-1.5 text-gray-500"></i>Obrolan dinonaktifkan oleh Admin.</span>
                ${isAdmin ? `<button type="button" onclick="openInformasiModal(${item.id})" class="text-teal-600 font-semibold hover:underline shrink-0">Ubah Pengaturan</button>` : ''}
            </div>
        `;
    } else if (remainingMs > 0) {
        composerHtml = `
            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                <span>
                    <i class="fa-solid fa-hourglass-half mr-1.5 text-amber-600"></i>
                    Jeda chat aktif (${escapeHtml(cooldownText)}). Kirim lagi dalam
                    <strong class="info-cooldown-timer font-mono text-amber-900" data-info-id="${item.id}">${formatCountdownClock(remainingMs)}</strong>.
                </span>
            </div>
        `;
    } else {
        const showEmojiBar = Number(openChatEmojiBarId) === Number(item.id);
        composerHtml = `
            <div class="space-y-2">
                ${showEmojiBar ? `
                    <div class="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-xl bg-gray-50 border border-gray-200">
                        ${INFO_QUICK_EMOJIS.map(em => `
                            <button type="button" onclick="appendEmojiToChatInput(${item.id}, '${em}')"
                                class="w-7 h-7 rounded-full hover:bg-white hover:shadow-xs flex items-center justify-center text-[15px] transition-all">${em}</button>
                        `).join('')}
                        <span class="text-[10px] text-gray-400 ml-1">atau pakai emoji keyboard HP</span>
                    </div>
                ` : ''}
                <form onsubmit="submitInfoComment(event, ${item.id})" class="flex items-center gap-2">
                    <button type="button" onclick="toggleChatEmojiBar(${item.id})" title="Pilih Emoji / Stiker"
                        class="w-8 h-8 rounded-full border border-gray-200 ${showEmojiBar ? 'bg-teal-50 text-teal-700 border-teal-300' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'} flex items-center justify-center shrink-0 transition-colors">
                        <i class="fa-regular fa-face-smile text-[14px]"></i>
                    </button>
                    <input
                        type="text"
                        id="info-comment-input-${item.id}"
                        required
                        autocomplete="off"
                        placeholder="Tulis balasan atau emoji sebagai ${escapeHtml(profile.nama)}..."
                        class="flex-1 px-3.5 py-2 rounded-full border border-gray-200 bg-gray-50 focus:bg-white text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <button type="submit" class="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 shadow-sm transition-colors">
                        <i class="fa-solid fa-paper-plane text-[10px]"></i>
                        <span>Kirim</span>
                    </button>
                </form>
            </div>
        `;
    }

    chatView.innerHTML = `
        <!-- Header Ruang Obrolan -->
        <div class="px-4 py-2.5 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
                <button type="button" onclick="closeInfoChatRoom()"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-teal-50 text-gray-700 hover:text-teal-700 text-xs font-semibold transition-colors shrink-0">
                    <i class="fa-solid fa-arrow-left text-[10px]"></i>
                    <span>Kembali</span>
                </button>
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                        <span class="px-1.5 py-0.5 rounded-full text-[8px] leading-tight font-bold shrink-0 ${catStyle}">${escapeHtml(item.kategori)}</span>
                        <h3 class="text-[13px] sm:text-[14px] font-bold text-gray-900 truncate">${escapeHtml(item.judul)}</h3>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                ${canEdit ? `
                    <button type="button" onclick="openInformasiModal(${item.id})" class="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-teal-50 text-gray-600 hover:text-teal-700 text-[10px] font-semibold transition-colors" title="Edit Informasi">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                ` : ''}
                ${isAdmin ? `
                    <button type="button" onclick="confirmDeleteInformasi(${item.id})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors" title="Hapus Informasi">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                ` : ''}
            </div>
        </div>

        <!-- Informasi Utama (Tetap Tampil di Atas Obrolan agar Fokus) -->
        <div class="px-3.5 sm:px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 max-h-[34vh] overflow-y-auto">
            <div class="flex items-start gap-2.5">
                <div class="relative w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-[9px] shrink-0 shadow-xs">
                    ${escapeHtml(getInfoAuthorInitials(item.createdBy || 'Admin SE'))}
                    <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${getInfoCategoryDotColor(item.kategori)} ring-2 ring-white"></span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center justify-between gap-1">
                        <div class="flex items-center gap-1 min-w-0">
                            <span class="text-[10px] font-bold text-gray-900">${escapeHtml(item.createdBy || 'Admin SE')}</span>
                            <i class="fa-solid fa-circle-check text-teal-600 text-[8.5px]"></i>
                            <span class="text-[8.5px] text-gray-400">· ${escapeHtml(item.createdAtLabel)}${editedMeta}</span>
                        </div>
                        <div class="flex flex-wrap items-center gap-1">
                            <span class="px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-bold tracking-wide ${catStyle}">${escapeHtml(item.kategori)}</span>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-medium bg-gray-100 text-gray-600">
                                <i class="fa-solid fa-users text-[6.5px] text-gray-400"></i>
                                <span>${escapeHtml(audLabel)}</span>
                            </span>
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-medium border ${cooldownStyle}">
                                <i class="fa-solid ${cooldownIcon} text-[6.5px]"></i>
                                <span>${escapeHtml(cooldownText)}</span>
                            </span>
                        </div>
                    </div>
                    <h4 class="text-[11px] sm:text-[11.5px] font-bold text-gray-900 leading-snug tracking-tight mt-1">${escapeHtml(item.judul)}</h4>
                    <p class="text-[10px] sm:text-[10.5px] text-gray-700 mt-0.5 leading-relaxed whitespace-pre-line">${escapeHtml(item.deskripsi)}</p>
                    ${linksHtml}
                    ${buildThreadsActionBarHtml(item, profile, true)}
                </div>
            </div>
        </div>

        <!-- Daftar Pesan Obrolan -->
        <div id="info-chat-messages" class="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-slate-50/70">
            ${messagesHtml}
        </div>

        <!-- Kolom Kirim Pesan -->
        <div class="px-4 py-3 bg-white border-t border-gray-200 shrink-0">
            ${composerHtml}
        </div>
    `;

    const msgBox = document.getElementById('info-chat-messages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
}

const INFO_READ_STORAGE_PREFIX = 'pantau_se_read_info_ids_v1:';

function getInformasiReaderKey() {
    const actor = (typeof getCurrentRosterActor === 'function') ? getCurrentRosterActor() : null;
    const prof = (typeof getActiveUserProfile === 'function') ? getActiveUserProfile() : null;
    const raw = actor?.nrp || prof?.nrp || prof?.key || actor?.nama || 'guest';
    return String(raw).trim().toLowerCase() || 'guest';
}

function getReadInformasiIdSet() {
    try {
        const raw = localStorage.getItem(INFO_READ_STORAGE_PREFIX + getInformasiReaderKey());
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.map(x => String(x)));
    } catch (_) {
        return new Set();
    }
}

function saveReadInformasiIdSet(idSet) {
    try {
        const arr = Array.from(idSet).slice(-500);
        localStorage.setItem(INFO_READ_STORAGE_PREFIX + getInformasiReaderKey(), JSON.stringify(arr));
    } catch (_) { /* ignore storage quota */ }
}

function markVisibleInformasiAsRead(visibleItems = null) {
    const profile = getActiveUserProfile();
    const list = Array.isArray(visibleItems)
        ? visibleItems
        : informasiState.filter(item => isInfoVisibleToProfile(item, profile));
    if (!list.length) return;
    const readSet = getReadInformasiIdSet();
    let changed = false;
    list.forEach(item => {
        const key = String(item.id);
        if (!readSet.has(key)) {
            readSet.add(key);
            changed = true;
        }
    });
    if (changed) saveReadInformasiIdSet(readSet);
}

function getUnreadInformasiCount(visibleItems = null) {
    const profile = getActiveUserProfile();
    const list = Array.isArray(visibleItems)
        ? visibleItems
        : informasiState.filter(item => isInfoVisibleToProfile(item, profile));
    if (!list.length) return 0;
    const readSet = getReadInformasiIdSet();
    return list.reduce((acc, item) => acc + (readSet.has(String(item.id)) ? 0 : 1), 0);
}

function syncInformasiUnreadBadges(visibleItems = null) {
    const unreadCount = getUnreadInformasiCount(visibleItems);
    const badgeEl = document.getElementById('sidebar-informasi-badge');
    if (badgeEl) {
        if (unreadCount > 0) {
            badgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.textContent = '';
            badgeEl.classList.add('hidden');
        }
    }
    const mobBadgeEl = document.getElementById('mobile-informasi-badge');
    if (mobBadgeEl) {
        if (unreadCount > 0) {
            mobBadgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            mobBadgeEl.classList.remove('hidden');
            mobBadgeEl.classList.add('inline-flex');
        } else {
            mobBadgeEl.textContent = '';
            mobBadgeEl.classList.add('hidden');
            mobBadgeEl.classList.remove('inline-flex');
        }
    }
    return unreadCount;
}

function renderInformasiSection() {
    const feedView = document.getElementById('informasi-feed-view');
    const chatView = document.getElementById('informasi-chat-view');
    const container = document.getElementById('informasi-list-container');
    const profile = getActiveUserProfile();
    const isAdmin = profile.type === 'admin';
    const canEdit = isAdmin || profile.type === 'gl' || profile.type === 'section';

    const visibleAll = informasiState.filter(item => isInfoVisibleToProfile(item, profile));
    if (typeof currentSection !== 'undefined' && currentSection === 'informasi') {
        markVisibleInformasiAsRead(visibleAll);
    }
    syncInformasiUnreadBadges(visibleAll);

    // Jika sedang membuka ruang obrolan salah satu informasi
    const activeItem = activeInfoChatId !== null
        ? visibleAll.find(i => Number(i.id) === Number(activeInfoChatId))
        : null;

    if (activeItem && chatView && feedView) {
        feedView.classList.add('hidden');
        feedView.classList.remove('flex');
        chatView.classList.remove('hidden');
        chatView.classList.add('flex');
        renderInformasiChatRoom(activeItem, profile);
        const titleEl = document.getElementById('header-page-title');
        if (titleEl && currentSection === 'informasi') titleEl.textContent = 'Beranda — Obrolan';
        syncInfoCooldownTicker();
        return;
    }

    activeInfoChatId = null;
    if (feedView && chatView) {
        feedView.classList.remove('hidden');
        feedView.classList.add('flex');
        chatView.classList.add('hidden');
        chatView.classList.remove('flex');
    }
    const titleEl = document.getElementById('header-page-title');
    if (titleEl && currentSection === 'informasi') titleEl.textContent = 'Beranda';
    if (!container) return;

    const query = (document.getElementById('info-search')?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById('info-category-filter')?.value || 'all';

    const filtered = visibleAll.filter(item => {
        if (catFilter !== 'all' && item.kategori !== catFilter) return false;
        if (!query) return true;
        const audText = item.audiensAll ? 'semua karyawan' : (item.audiens || []).join(' ').toLowerCase();
        return (
            String(item.judul || '').toLowerCase().includes(query) ||
            String(item.deskripsi || '').toLowerCase().includes(query) ||
            String(item.kategori || '').toLowerCase().includes(query) ||
            audText.includes(query)
        );
    });

    if (!filtered.length) {
        container.innerHTML = `
                    <div class="py-12 text-center space-y-2">
                        <div class="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                            <i class="fa-solid fa-house"></i>
                        </div>
                        <p class="text-xs font-semibold text-gray-600">Tidak ada informasi tersedia.</p>
                        ${isAdmin ? `<button type="button" onclick="openInformasiModal()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 text-teal-700 text-xs font-semibold hover:bg-teal-100"><i class="fa-solid fa-plus"></i> Tambah Informasi Baru</button>` : ''}
                    </div>
                `;
        syncInfoCooldownTicker();
        return;
    }

    container.innerHTML = filtered.map(item => {
        ensureInfoSocialState(item);
        const catStyle = INFO_CATEGORY_BADGE[item.kategori] || 'bg-gray-100 text-gray-700';
        const audLabel = item.audiensAll ? 'Semua Karyawan' : (item.audiens && item.audiens.length ? item.audiens.join(', ') : '-');
        const cooldownText = formatInfoCooldownLabel(item);
        const cooldownStyle = !item.chatEnabled
            ? 'bg-red-50 text-red-600 border-red-200'
            : (getInfoCooldownMs(item) > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');
        const cooldownIcon = !item.chatEnabled ? 'fa-comment-slash' : (getInfoCooldownMs(item) > 0 ? 'fa-clock' : 'fa-comments');

        const linksHtml = Array.isArray(item.links) && item.links.length
            ? `<div class="flex flex-wrap items-center gap-1 mt-1.5">
                        ${item.links.map(lnk => `
                            <a href="${escapeHtml(lnk.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 hover:bg-teal-50 border border-gray-200 hover:border-teal-200 text-[8.5px] font-medium text-teal-700 transition-colors">
                                <i class="fa-solid fa-link text-[7.5px]"></i>
                                <span>${escapeHtml(lnk.label || lnk.url)}</span>
                                <i class="fa-solid fa-arrow-up-right-from-square text-[7px] opacity-70"></i>
                            </a>
                        `).join('')}
                    </div>`
            : '';

        const comments = Array.isArray(item.comments) ? item.comments : [];
        const commentCount = comments.length;
        const editedMeta = item.editedBy ? ` · Diedit ${escapeHtml(item.editedBy)}` : '';
        const authorName = item.createdBy || 'Admin SE';
        const authorInitials = getInfoAuthorInitials(authorName);
        const catDot = getInfoCategoryDotColor(item.kategori);
        const uniqueReplyAuthors = [];
        comments.forEach(c => {
            const init = getInfoAuthorInitials(c.authorName);
            if (!uniqueReplyAuthors.includes(init)) uniqueReplyAuthors.push(init);
        });
        const miniReplyAvatarsHtml = uniqueReplyAuthors.slice(0, 2).map((init, idx) =>
            `<span class="w-3.5 h-3.5 rounded-full ${idx === 0 ? 'bg-slate-600' : 'bg-teal-600'} text-white text-[6px] font-bold inline-flex items-center justify-center ring-1 ring-white ${idx > 0 ? '-ml-1' : ''}">${escapeHtml(init)}</span>`
        ).join('');

        return `
                    <article id="info-post-${item.id}" class="px-3.5 sm:px-5 py-3 bg-white hover:bg-gray-50/40 transition-colors">
                        <div class="flex items-start gap-2.5 max-w-4xl">
                            <!-- Kolom Kiri: Avatar Penulis & Garis Thread -->
                            <div class="w-7 shrink-0 flex flex-col items-center self-stretch">
                                <div class="relative w-7 h-7 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-[9px] shadow-xs shrink-0">
                                    ${escapeHtml(authorInitials)}
                                    <span class="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${catDot} ring-2 ring-white" title="${escapeHtml(item.kategori)}"></span>
                                </div>
                                ${commentCount > 0 ? `
                                    <div class="w-[1.5px] flex-1 bg-gray-200/90 rounded-full my-1.5 min-h-[14px]"></div>
                                    <button type="button" onclick="openInfoChatRoom(${item.id})" class="flex items-center justify-center hover:opacity-80 transition-opacity" title="Lihat ${commentCount} balasan">
                                        ${miniReplyAvatarsHtml}
                                    </button>
                                ` : ''}
                            </div>

                            <!-- Kolom Kanan: Header, Badge Kecil, Isi Informasi, & Action Bar Gaya Threads (Kompak -35%) -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-1">
                                            <span class="text-[10px] font-bold text-gray-900 leading-none">${escapeHtml(authorName)}</span>
                                            <i class="fa-solid fa-circle-check text-teal-600 text-[8.5px]" title="Resmi Support Equipment"></i>
                                            <span class="text-[8.5px] text-gray-400 leading-none">${escapeHtml(item.createdAtLabel)}${editedMeta}</span>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-1 mt-1">
                                            <span class="px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-bold tracking-wide ${catStyle}">${escapeHtml(item.kategori)}</span>
                                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-medium bg-gray-100 text-gray-600">
                                                <i class="fa-solid fa-users text-[6.5px] text-gray-400"></i>
                                                <span>${escapeHtml(audLabel)}</span>
                                            </span>
                                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-medium border ${cooldownStyle}">
                                                <i class="fa-solid ${cooldownIcon} text-[6.5px]"></i>
                                                <span>${escapeHtml(cooldownText)}</span>
                                            </span>
                                            ${(item._pendingSync || Number(item.id) >= 1e12) ? `
                                                <button type="button" onclick="if(typeof syncBerandaFromSupabase==='function'){syncBerandaFromSupabase({deltaOnly:false});}" title="Belum tersinkron ke server — klik untuk kirim ulang" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[7.5px] leading-tight font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
                                                    <i class="fa-solid fa-cloud-arrow-up text-[6.5px]"></i>
                                                    <span>Menunggu Sinkron</span>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-0.5 shrink-0">
                                        ${canEdit ? `
                                            <button type="button" onclick="openInformasiModal(${item.id})" class="w-5 h-5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-teal-700 inline-flex items-center justify-center transition-colors" title="Edit Informasi">
                                                <i class="fa-solid fa-pen-to-square text-[9px]"></i>
                                            </button>
                                        ` : ''}
                                        ${isAdmin ? `
                                            <button type="button" onclick="confirmDeleteInformasi(${item.id})" class="w-5 h-5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-600 inline-flex items-center justify-center transition-colors" title="Hapus Informasi (Khusus Admin)">
                                                <i class="fa-solid fa-trash-can text-[9px]"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Konten Postingan (Proporsional & Kompak) -->
                                <h4 class="text-[11px] sm:text-[11.5px] font-bold text-gray-900 leading-snug tracking-tight mt-1.5">${escapeHtml(item.judul)}</h4>
                                <p class="text-[10px] sm:text-[10.5px] text-gray-700 mt-0.5 leading-relaxed whitespace-pre-line">${escapeHtml(item.deskripsi)}</p>
                                ${linksHtml}

                                <!-- Bar Aksi Bawah (Suka, Komentar, Stiker/Emoji Keyboard HP, Share Link) -->
                                ${buildThreadsActionBarHtml(item, profile, false)}

                                ${commentCount > 0 ? `
                                    <div class="mt-0.5 flex items-center gap-1.5 text-[8.5px] text-gray-400">
                                        <button type="button" onclick="openInfoChatRoom(${item.id})" class="hover:text-gray-700 hover:underline transition-colors">
                                            ${commentCount} balasan · ${item.chatEnabled ? 'Lihat obrolan' : 'Obrolan dikunci'}
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </article>
                `;
    }).join('');

    syncInfoCooldownTicker();
}

function openInfoChatRoom(infoId) {
    activeInfoChatId = Number(infoId);
    renderInformasiSection();
    const input = document.getElementById(`info-comment-input-${activeInfoChatId}`);
    if (input) input.focus();
}

function closeInfoChatRoom() {
    activeInfoChatId = null;
    renderInformasiSection();
}

function toggleInfoComments(infoId) {
    openInfoChatRoom(infoId);
}

function submitInfoComment(event, infoId) {
    event.preventDefault();
    const item = informasiState.find(i => i.id === infoId);
    if (!item) return;

    const profile = getActiveUserProfile();
    if (!item.chatEnabled) {
        showToast('Obrolan pada informasi ini sedang dinonaktifkan oleh Admin.', 'error');
        return;
    }

    const remainingMs = getRemainingCommentWaitMs(item, profile);
    if (remainingMs > 0) {
        showToast(`Jeda chat aktif. Tunggu ${formatCountdownClock(remainingMs)} lagi.`, 'error');
        return;
    }

    const input = document.getElementById(`info-comment-input-${infoId}`);
    const text = String(input?.value || '').trim();
    if (!text) return;

    if (!Array.isArray(item.comments)) item.comments = [];
    const commentObj = {
        id: Date.now(),
        authorKey: profile.key,
        authorName: profile.nama,
        authorRole: profile.jabatan,
        authorType: profile.type,
        text,
        timeLabel: formatNowWitaLabel().replace('Hari ini, ', ''),
        _pendingSync: true
    };
    item.comments.push(commentObj);
    if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();

    if (profile.type !== 'admin' && getInfoCooldownMs(item) > 0) {
        infoCommentCooldowns[`${infoId}::${profile.key}`] = Date.now();
    }

    activeInfoChatId = Number(infoId);
    renderInformasiSection();
    const nextInput = document.getElementById(`info-comment-input-${infoId}`);
    if (nextInput) nextInput.focus();

    // Kirim realtime ke Supabase + Broadcast ke seluruh audiens online
    if (typeof pushInformasiCommentToSupabase === 'function') {
        pushInformasiCommentToSupabase(item.id, commentObj).then((saved) => {
            if (saved && saved.id) {
                commentObj.id = Number(saved.id);
                delete commentObj._pendingSync;
                if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();
            }
        }).catch(() => {});
    }
}

function deleteInfoComment(infoId, commentId) {
    if (getActiveUserProfile().type !== 'admin') {
        showToast('Hanya Admin yang dapat menghapus komentar.', 'error');
        return;
    }
    const item = informasiState.find(i => Number(i.id) === Number(infoId));
    if (!item || !Array.isArray(item.comments)) return;
    item.comments = item.comments.filter(c => Number(c.id) !== Number(commentId));
    if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();
    renderInformasiSection();
    if (typeof deleteInformasiCommentFromSupabase === 'function') {
        deleteInformasiCommentFromSupabase(infoId, commentId);
    }
    showToast('Komentar dihapus oleh Admin.', 'success');
}

function toggleAllInfoAudience(checked) {
    if (checked) {
        document.querySelectorAll('.info-audience-checkbox').forEach(cb => { cb.checked = false; });
    }
}

function onSpecificInfoAudienceChange() {
    const anyChecked = Array.from(document.querySelectorAll('.info-audience-checkbox')).some(cb => cb.checked);
    const allCb = document.getElementById('info-audience-all');
    if (allCb && anyChecked) allCb.checked = false;
}

function addInfoLinkRow(url = '', label = '') {
    const container = document.getElementById('info-links-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'info-link-row grid grid-cols-1 sm:grid-cols-12 gap-2 items-center';
    row.innerHTML = `
                <input type="text" class="info-link-label sm:col-span-5 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Judul link (opsional)" value="${escapeHtml(label)}">
                <input type="text" class="info-link-url sm:col-span-6 px-2.5 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="https://contoh-link.com/dokumen" value="${escapeHtml(url)}">
                <button type="button" onclick="removeInfoLinkRow(this)" class="sm:col-span-1 w-full sm:w-7 h-7 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0" title="Hapus baris link">
                    <i class="fa-solid fa-xmark text-xs"></i>
                </button>
            `;
    container.appendChild(row);
}

function removeInfoLinkRow(btn) {
    const row = btn.closest('.info-link-row');
    if (row) row.remove();
}

function toggleInfoChatCooldownFields() {
    const enabled = Boolean(document.getElementById('info-chat-enabled')?.checked);
    const wrap = document.getElementById('info-cooldown-wrap');
    if (wrap) {
        wrap.classList.toggle('opacity-50', !enabled);
        wrap.classList.toggle('pointer-events-none', !enabled);
    }
}

function setInfoCooldownPreset(value, unit, enabled) {
    const enabledEl = document.getElementById('info-chat-enabled');
    const valEl = document.getElementById('info-cooldown-value');
    const unitEl = document.getElementById('info-cooldown-unit');
    if (enabledEl) enabledEl.checked = enabled;
    if (valEl) valEl.value = String(value);
    if (unitEl) unitEl.value = unit;
    toggleInfoChatCooldownFields();
}

function openInformasiModal(infoId = null) {
    const profile = getActiveUserProfile();
    const isAdmin = profile.type === 'admin';
    const isGl = profile.type === 'gl' || profile.type === 'section';

    if (!infoId && !isAdmin) {
        showToast('Hanya Admin yang dapat menambahkan informasi baru.', 'error');
        return;
    }
    if (infoId && !isAdmin && !isGl) {
        showToast('Hanya Admin atau Group Leader yang dapat mengedit informasi.', 'error');
        return;
    }

    const modal = document.getElementById('modal-informasi');
    const form = document.getElementById('form-informasi');
    if (!modal || !form) return;
    form.reset();

    const item = infoId ? informasiState.find(i => i.id === infoId) : null;
    document.getElementById('info-edit-id').value = item ? String(item.id) : '';
    document.getElementById('modal-info-title').textContent = item ? 'Edit Informasi' : 'Tambah Informasi Baru';
    document.getElementById('modal-info-subtitle').textContent = item
        ? (isAdmin ? 'Perbarui konten, audiens target, link, & pembatasan chat' : 'Mode Group Leader: edit keterangan, judul, deskripsi, & lampiran link')
        : 'Bagikan pengumuman beserta audiens target, link lampiran, & pembatasan chat';
    document.getElementById('btn-submit-info-text').textContent = item ? 'Simpan Perubahan' : 'Bagikan Informasi';

    const linksContainer = document.getElementById('info-links-container');
    linksContainer.innerHTML = '';

    if (item) {
        document.getElementById('info-kategori').value = item.kategori;
        document.getElementById('info-judul').value = item.judul;
        document.getElementById('info-deskripsi').value = item.deskripsi;
        document.getElementById('info-audience-all').checked = Boolean(item.audiensAll);
        document.querySelectorAll('.info-audience-checkbox').forEach(cb => {
            cb.checked = !item.audiensAll && Array.isArray(item.audiens) && item.audiens.includes(cb.value);
        });
        const links = Array.isArray(item.links) && item.links.length ? item.links : [{ label: '', url: '' }];
        links.forEach(l => addInfoLinkRow(l.url, l.label));
        document.getElementById('info-chat-enabled').checked = Boolean(item.chatEnabled);
        document.getElementById('info-cooldown-value').value = String(item.chatCooldownValue || 0);
        document.getElementById('info-cooldown-unit').value = item.chatCooldownUnit || 'minutes';
    } else {
        document.getElementById('info-kategori').value = 'OPERASIONAL';
        document.getElementById('info-audience-all').checked = true;
        document.querySelectorAll('.info-audience-checkbox').forEach(cb => { cb.checked = false; });
        addInfoLinkRow();
        document.getElementById('info-chat-enabled').checked = true;
        document.getElementById('info-cooldown-value').value = '0';
        document.getElementById('info-cooldown-unit').value = 'minutes';
    }

    // Kunci kontrol pembatasan audiens, slow mode chat & hapus bila user adalah GL (hanya Admin)
    const lockAdminControls = !isAdmin;
    const audAllEl = document.getElementById('info-audience-all');
    if (audAllEl) audAllEl.disabled = lockAdminControls;
    document.querySelectorAll('.info-audience-checkbox').forEach(cb => { cb.disabled = lockAdminControls; });
    document.getElementById('info-audience-lock-note')?.classList.toggle('hidden', !lockAdminControls);

    const chatEnabledEl = document.getElementById('info-chat-enabled');
    const cooldownValEl = document.getElementById('info-cooldown-value');
    const cooldownUnitEl = document.getElementById('info-cooldown-unit');
    if (chatEnabledEl) chatEnabledEl.disabled = lockAdminControls;
    if (cooldownValEl) cooldownValEl.disabled = lockAdminControls;
    if (cooldownUnitEl) cooldownUnitEl.disabled = lockAdminControls;
    document.querySelectorAll('#info-cooldown-wrap button').forEach(btn => { btn.disabled = lockAdminControls; });
    document.getElementById('info-chat-lock-note')?.classList.toggle('hidden', !lockAdminControls);

    const delBtn = document.getElementById('btn-delete-informasi');
    if (delBtn) {
        const showDelete = Boolean(item && isAdmin);
        delBtn.classList.toggle('hidden', !showDelete);
        delBtn.classList.toggle('inline-flex', showDelete);
    }

    toggleInfoChatCooldownFields();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeInformasiModal() {
    const modal = document.getElementById('modal-informasi');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleInformasiSubmit(event) {
    event.preventDefault();
    const profile = getActiveUserProfile();
    const isAdmin = profile.type === 'admin';
    const editId = Number(document.getElementById('info-edit-id').value) || 0;

    if (!editId && !isAdmin) {
        showToast('Hanya Admin yang dapat menambahkan informasi baru.', 'error');
        return;
    }
    if (editId && !isAdmin && profile.type !== 'gl' && profile.type !== 'section') {
        showToast('Hanya Admin, Section, atau Group Leader yang dapat mengedit informasi.', 'error');
        return;
    }

    const kategori = document.getElementById('info-kategori').value;
    const judul = document.getElementById('info-judul').value.trim();
    const deskripsi = document.getElementById('info-deskripsi').value.trim();
    const audiensAll = document.getElementById('info-audience-all').checked;
    const audiens = Array.from(document.querySelectorAll('.info-audience-checkbox'))
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (!judul || !deskripsi) {
        showToast('Judul dan deskripsi informasi wajib diisi.', 'error');
        return;
    }

    if (isAdmin && !audiensAll && audiens.length === 0) {
        showToast('Pilih "Semua Karyawan" atau minimal satu jabatan audiens.', 'error');
        return;
    }

    const links = [];
    document.querySelectorAll('#info-links-container .info-link-row').forEach(row => {
        const rawUrl = row.querySelector('.info-link-url')?.value || '';
        const label = String(row.querySelector('.info-link-label')?.value || '').trim();
        const safeUrl = sanitizeExternalUrl(rawUrl);
        if (safeUrl) links.push({ label: label || safeUrl, url: safeUrl });
    });

    const chatEnabled = Boolean(document.getElementById('info-chat-enabled').checked);
    const rawCooldown = Math.max(0, parseInt(document.getElementById('info-cooldown-value').value, 10) || 0);
    const chatCooldownUnit = document.getElementById('info-cooldown-unit').value === 'hours' ? 'hours' : 'minutes';

    const submitBtn = document.querySelector('#form-informasi button[type="submit"]');
    const submitLbl = document.getElementById('btn-submit-info-text');
    const prevLblText = submitLbl ? submitLbl.textContent : '';
    if (submitBtn) {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
    }
    if (submitLbl) submitLbl.textContent = 'Menyimpan...';

    try {
        if (editId) {
            const target = informasiState.find(i => Number(i.id) === editId);
            if (!target) return;
            target.kategori = kategori;
            target.judul = judul;
            target.deskripsi = deskripsi;
            target.links = links;
            target.editedBy = `${profile.nama} (${profile.type === 'admin' ? 'Admin' : (profile.type === 'section' ? 'Section' : 'GL')})`;
            if (isAdmin) {
                target.audiensAll = audiensAll;
                target.audiens = audiensAll ? [] : audiens;
                target.chatEnabled = chatEnabled;
                target.chatCooldownValue = rawCooldown;
                target.chatCooldownUnit = chatCooldownUnit;
            }
            target._pendingSync = true;
            target._pendingAction = Number(target.id) >= 1e12 ? 'insert' : 'update';
            if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();

            if (typeof pushInformasiPostToSupabase === 'function' && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
                try {
                    await pushInformasiPostToSupabase(target, Number(target.id) >= 1e12, { throwOnError: true });
                    showToast('Informasi berhasil diperbarui & tersimpan di server.', 'success');
                } catch (err) {
                    showToast(`Perubahan tersimpan lokal (gagal kirim ke server: ${err?.message || 'koneksi terganggu'}). Akan dicoba ulang otomatis.`, 'error');
                }
            } else {
                showToast('Informasi berhasil diperbarui (tersimpan lokal).', 'success');
            }
        } else {
            const tempId = Date.now();
            const newItem = {
                id: tempId,
                kategori,
                judul,
                deskripsi,
                audiensAll,
                audiens: audiensAll ? [] : audiens,
                links,
                chatEnabled,
                chatCooldownValue: rawCooldown,
                chatCooldownUnit,
                createdBy: profile.nama,
                createdAtLabel: formatNowWitaLabel(),
                editedBy: '',
                likes: [],
                reactions: {},
                shares: 0,
                comments: [],
                _pendingSync: true,
                _pendingAction: 'insert'
            };
            informasiState.unshift(newItem);
            expandedInfoCommentIds.add(tempId);
            if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();
            renderInformasiSection();

            if (typeof pushInformasiPostToSupabase === 'function' && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
                try {
                    const saved = await pushInformasiPostToSupabase(newItem, true, { throwOnError: true });
                    if (saved && saved.id) {
                        const realId = Number(saved.id);
                        newItem.id = realId;
                        expandedInfoCommentIds.delete(tempId);
                        expandedInfoCommentIds.add(realId);
                        if (Number(activeInfoChatId) === Number(tempId)) {
                            activeInfoChatId = realId;
                        }
                        const readSet = getReadInformasiIdSet();
                        readSet.add(String(realId));
                        saveReadInformasiIdSet(readSet);
                        if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();
                        showToast('Informasi baru berhasil disimpan & dikirim realtime ke seluruh audiens.', 'success');
                    } else {
                        showToast('Informasi tersimpan lokal — respon server kosong, akan otomatis disinkronkan ulang.', 'info');
                    }
                } catch (err) {
                    showToast(`Informasi tersimpan di perangkat (gagal kirim ke server: ${err?.message || 'koneksi terganggu'}). Otomatis dicoba ulang saat refresh/online.`, 'error');
                }
            } else {
                showToast('Informasi baru berhasil disimpan secara lokal.', 'success');
            }
        }

        closeInformasiModal();
        renderInformasiSection();
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitLbl && prevLblText) submitLbl.textContent = prevLblText;
    }
}

function confirmDeleteInformasi(infoId) {
    if (getActiveUserProfile().type !== 'admin') {
        showToast('Hanya Admin yang dapat menghapus informasi.', 'error');
        return;
    }
    const item = informasiState.find(i => Number(i.id) === Number(infoId));
    if (!item) return;
    openConfirmDeleteModal({
        title: 'Hapus Informasi?',
        message: `Informasi "${item.judul}" beserta seluruh komentarnya akan dihapus.`,
        confirmText: 'Ya, Hapus',
        onConfirm: () => {
            informasiState = informasiState.filter(i => Number(i.id) !== Number(infoId));
            expandedInfoCommentIds.delete(infoId);
            if (Number(activeInfoChatId) === Number(infoId)) activeInfoChatId = null;
            if (typeof persistBerandaCacheNow === 'function') persistBerandaCacheNow();
            if (typeof deleteInformasiPostFromSupabase === 'function') {
                deleteInformasiPostFromSupabase(infoId);
            }
            closeInformasiModal();
            renderInformasiSection();
            showToast('Informasi berhasil dihapus.', 'success');
        }
    });
}

function deleteInformasiFromModal() {
    const editId = Number(document.getElementById('info-edit-id').value) || 0;
    if (editId) confirmDeleteInformasi(editId);
}

/* =====================================================================
 * 9D. MASTER DATA & SINKRONISASI TERPUSAT KE SELURUH TABEL & FILTER
 * ===================================================================== */
const ROSTER_SYSTEM_ACTION_META = {
    SHIFT_1: { label: 'SHIFT 1 / Siang (Putih)', badgeCls: 'bg-white text-gray-900 border border-gray-300 font-bold' },
    SHIFT_2: { label: 'SHIFT 2 / Malam (Hijau Pekat)', badgeCls: 'bg-[#006740] text-white font-bold' },
    LIBUR: { label: 'LIBUR / OFF (Merah Pekat)', badgeCls: 'bg-[#FF0000] text-white font-bold' },
    CUTI: { label: 'CUTI / CCUTI (Biru Pekat)', badgeCls: 'bg-[#00B0F0] text-gray-950 font-bold' },
    INDUKSI: { label: 'INDUKSI / INDK (Kuning-Oranye)', badgeCls: 'bg-[#FFC000] text-gray-950 font-bold' },
    MCU: { label: 'MCU (Ungu Pekat)', badgeCls: 'bg-[#7030A0] text-white font-bold' },
    TRAINING: { label: 'TRAINING / TR (Kuning Pekat)', badgeCls: 'bg-[#FFFF00] text-gray-950 font-bold' },
    SAKIT: { label: 'SAKIT (Oranye Pekat)', badgeCls: 'bg-[#ED7D31] text-white font-bold' },
    IZIN: { label: 'IZIN (Oranye Pekat)', badgeCls: 'bg-[#ED7D31] text-white font-bold' }
};

/**
 * Resolusi kode roster berbasis:
 * 1) Cocok persis di Master Kode Roster
 * 2) Cocok kode awalan terpanjang di Master Kode Roster (mis. D520 -> D, N520 -> N, INDK1 -> INDK)
 * 3) Fallback awalan bawaan (OFF/OOFF, CCUTI/CUTI, INDK, MCU, TR, D, N)
 */
function resolveRosterCodeRule(rawCode) {
    const clean = String(rawCode || '').trim().toUpperCase();
    if (!clean) return null;

    const exact = masterKodeRosterState.find(item => String(item.kode || '').trim().toUpperCase() === clean);
    if (exact) return exact;

    const byPrefix = [...masterKodeRosterState]
        .filter(item => {
            const k = String(item.kode || '').trim().toUpperCase();
            return k.length > 0 && clean.startsWith(k);
        })
        .sort((a, b) => String(b.kode || '').length - String(a.kode || '').length);
    if (byPrefix.length > 0) return byPrefix[0];

    if (/^O+FF/.test(clean)) return { kode: 'OFF', artiSistem: 'LIBUR', keterangan: 'LIBUR' };
    if (clean.startsWith('CCUTI') || clean.startsWith('CUTI')) return { kode: 'CCUTI', artiSistem: 'CUTI', keterangan: 'CUTI' };
    if (clean.startsWith('INDK') || clean.startsWith('INDUKSI')) return { kode: 'INDK', artiSistem: 'INDUKSI', keterangan: 'INDUKSI' };
    if (clean.startsWith('MCU')) return { kode: 'MCU', artiSistem: 'MCU', keterangan: 'MCU' };
    if (clean.startsWith('TR')) return { kode: 'TR', artiSistem: 'TRAINING', keterangan: 'TRAINING' };
    if (clean.startsWith('N') || clean === 'S2') return { kode: 'N', artiSistem: 'SHIFT_2', keterangan: 'MALAM / SHIFT 2' };
    if (clean.startsWith('D') || clean === 'S1') return { kode: 'D', artiSistem: 'SHIFT_1', keterangan: 'SIANG / SHIFT 1' };
    return null;
}

function renderRosterLegend() {
    renderRosterPicBar();

    const datalist = document.getElementById('roster-kode-datalist');
    if (datalist) {
        datalist.innerHTML = masterKodeRosterState
            .map(item => `<option value="${escapeHtml(item.kode)}">${escapeHtml(item.keterangan)}</option>`)
            .join('');
    }
    const unitDatalist = document.getElementById('roster-unit-datalist');
    if (unitDatalist) {
        unitDatalist.innerHTML = ['<option value="-">Tanpa Unit / Standby</option>'].concat(
            komisioningState.map(u => `<option value="${escapeHtml(u.no_unit)}">${escapeHtml(u.model_tipe || '')}</option>`)
        ).join('');
    }
}

function fillSelectPreserveValue(selectEl, defaultOptionHtml, itemsHtml) {
    if (!selectEl) return;
    const prevVal = selectEl.value;
    selectEl.innerHTML = `${defaultOptionHtml}${itemsHtml}`;
    if (prevVal && Array.from(selectEl.options).some(o => o.value === prevVal)) {
        selectEl.value = prevVal;
    }
}

/**
 * Menyinkronkan seluruh dropdown filter, form modal, checkbox audiens, & legend kode roster
 * dari Master Data secara otomatis.
 */
function syncMasterDropdownOptions() {
    const jabatanOpts = masterJabatanState
        .map(j => `<option value="${escapeHtml(j.nama)}">${escapeHtml(j.nama)}</option>`)
        .join('');
    fillSelectPreserveValue(document.getElementById('atr-role-filter'), '<option value="all">Semua Jabatan</option>', jabatanOpts);
    fillSelectPreserveValue(document.getElementById('master-mp-role-filter'), '<option value="all">Semua Jabatan</option>', jabatanOpts);
    fillSelectPreserveValue(document.getElementById('mp-jabatan'), '<option value="">Pilih Jabatan / Role</option>', jabatanOpts);

    const companyFilterOpts = masterPerusahaanState
        .map(p => `<option value="${escapeHtml(p.kode)}">${escapeHtml(p.kode)}</option>`)
        .join('');
    const companyModalOpts = masterPerusahaanState
        .map(p => `<option value="${escapeHtml(p.kode)}">${escapeHtml(p.kode)}${p.keterangan ? ` — ${escapeHtml(p.keterangan)}` : ''}</option>`)
        .join('');
    fillSelectPreserveValue(document.getElementById('master-mp-company-filter'), '<option value="all">Semua Perusahaan</option>', companyFilterOpts);
    fillSelectPreserveValue(document.getElementById('mp-perusahaan'), '', companyModalOpts);

    const craneUnitSet = new Set(['MC7001', 'GR501']);
    komisioningState.forEach(u => {
        if (getUnitCategoryGroup(u.no_unit, u.model_tipe, u.kategori_unit) === 'lifting') {
            craneUnitSet.add(String(u.no_unit).trim().toUpperCase());
        }
    });
    const craneUnitOpts = Array.from(craneUnitSet)
        .map(code => `<option value="${escapeHtml(code)}">${escapeHtml(code)}</option>`)
        .join('');
    fillSelectPreserveValue(document.getElementById('crane-no-unit'), '', craneUnitOpts);

    const audWrap = document.getElementById('info-audience-list-wrap');
    if (audWrap) {
        const checkedSet = new Set(
            Array.from(audWrap.querySelectorAll('.info-audience-checkbox:checked')).map(cb => cb.value)
        );
        audWrap.innerHTML = masterJabatanState.map(j => `
                    <label class="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-700 cursor-pointer hover:border-teal-300">
                        <input type="checkbox" value="${escapeHtml(j.nama)}" ${checkedSet.has(j.nama) ? 'checked' : ''} onchange="onSpecificInfoAudienceChange()" class="info-audience-checkbox rounded text-teal-600 focus:ring-teal-500">
                        <span class="truncate">${escapeHtml(j.nama)}</span>
                    </label>
                `).join('');
    }
}

function syncAllMasterConnections(masterOnly = false) {
    syncMasterDropdownOptions();
    populateRentalModalDatalists();
    renderRosterLegend();
    renderMasterDataSection();

    if (!masterOnly) {
        renderManpowerTable();
        renderPerformaManpower();
        renderInputKpiPengawasTable();
        renderDashboardKpiPengawas();
        renderKomisioningTable();
        renderRentalBibTable();
        renderBigCraneTimeframeTable();
        renderRosterTable();
        if (typeof renderRosterPersonalCalendar === 'function') renderRosterPersonalCalendar();
        if (typeof renderRosterDailyView === 'function') renderRosterDailyView();
        renderInformasiSection();
    }
}

function renderMasterDataSection(activeTab = '') {
    const tab = activeTab || (currentSection === 'master' ? currentSubSection : '');
    if (!tab || tab === 'manpower') renderMasterManpowerTable();
    if (!tab || tab === 'jabatan') renderMasterJabatanTable();
    if (!tab || tab === 'perusahaan') renderMasterPerusahaanTable();
    if (!tab || tab === 'unit') renderMasterUnitTable();
    if (!tab || tab === 'kode-roster') renderMasterKodeRosterTable();
    if (!tab || tab === 'kode-spi') renderMasterKodeSpiTable();
}

function getKodeSpiForMonth(year, monthIdx) {
    const y = Number(year);
    const m = Number(monthIdx);
    const exact = masterKodeSpiState.find(item => Number(item.tahun) === y && Number(item.bulan) === m);
    if (exact) {
        return {
            found: true,
            record: exact,
            kodePengawas: String(exact.kodePengawas || '').trim().toUpperCase() || '-',
            kodeOperator: String(exact.kodeOperator || '').trim().toUpperCase() || '-'
        };
    }
    const sorted = [...masterKodeSpiState].sort((a, b) => (Number(b.tahun) - Number(a.tahun)) || (Number(b.bulan) - Number(a.bulan)));
    const fallback = sorted[0] || null;
    return {
        found: false,
        record: fallback,
        kodePengawas: fallback ? String(fallback.kodePengawas || '').trim().toUpperCase() : 'GUNAKAN',
        kodeOperator: fallback ? String(fallback.kodeOperator || '').trim().toUpperCase() : 'APD'
    };
}

function renderMasterKodeSpiTable() {
    const tbody = document.getElementById('master-kode-spi-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-spi-search')?.value || '').trim().toLowerCase();
    const now = new Date();
    const nowY = now.getFullYear();
    const nowM = now.getMonth();

    const rows = [...masterKodeSpiState]
        .sort((a, b) => (Number(b.tahun) - Number(a.tahun)) || (Number(b.bulan) - Number(a.bulan)))
        .filter(s => {
            if (!query) return true;
            const monthLabel = `${MONTH_NAMES_ID[s.bulan] || ''} ${s.tahun}`;
            return `${monthLabel} ${s.kodePengawas} ${s.kodeOperator} ${s.keterangan || ''}`.toLowerCase().includes(query);
        });

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-xs text-gray-400">Belum ada data Kode SPI bulanan. Klik <strong>Tambah / Update Kode SPI</strong> untuk menambahkan.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((s, idx) => {
        const isCurrentMonth = Number(s.tahun) === nowY && Number(s.bulan) === nowM;
        const activeBadge = isCurrentMonth
            ? ' <span class="ml-1.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8.5px] font-bold">Bulan Ini</span>'
            : '';
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 text-gray-800 font-semibold whitespace-nowrap">${escapeHtml(MONTH_NAMES_ID[s.bulan] || '')} ${Number(s.tahun)}${activeBadge}</td>
                        <td class="py-2.5 px-4 whitespace-nowrap"><span class="px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-200 font-mono font-bold text-teal-800">${escapeHtml(s.kodePengawas)}</span></td>
                        <td class="py-2.5 px-4 whitespace-nowrap"><span class="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 font-mono font-bold text-indigo-800">${escapeHtml(s.kodeOperator)}</span></td>
                        <td class="py-2.5 px-4 text-gray-600">${escapeHtml(s.keterangan || '-')}</td>
                        <td class="py-2.5 px-4 text-center whitespace-nowrap space-x-1">
                            <button type="button" onclick="openMasterItemModal('kode-spi', ${Number(s.id)})" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white text-[10px] font-semibold transition-colors">Edit</button>
                            <button type="button" onclick="confirmDeleteMasterItem('kode-spi', ${Number(s.id)})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function renderMasterManpowerTable() {
    const tbody = document.getElementById('master-manpower-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-mp-search')?.value || '').trim().toLowerCase();
    const roleFilter = document.getElementById('master-mp-role-filter')?.value || 'all';
    const companyFilter = document.getElementById('master-mp-company-filter')?.value || 'all';

    const rows = manpowerState.filter(mp => {
        if (roleFilter !== 'all' && mp.jabatan !== roleFilter) return false;
        if (companyFilter !== 'all' && mp.perusahaan !== companyFilter) return false;
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    });

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Tidak ada data manpower yang cocok dengan filter.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((mp, idx) => {
        const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
        const pwdVal = getManpowerPassword(mp);
        const maskedPwd = pwdVal ? '•'.repeat(Math.min(10, Math.max(6, pwdVal.length))) : '-';
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 whitespace-nowrap">
                            <button type="button" onclick="openManpowerDetailModal(${Number(mp.id)})"
                                title="Klik NRP untuk Edit atau Hapus data manpower"
                                class="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer focus:outline-none">${escapeHtml(mp.nrp)}</button>
                        </td>
                        <td class="py-2.5 px-4 text-gray-800 font-medium whitespace-nowrap">${escapeHtml(mp.nama)}${outBadge}</td>
                        <td class="py-2.5 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(mp.jabatan || '-')}</td>
                        <td class="py-2.5 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(mp.perusahaan || '-')}</td>
                        <td class="py-2.5 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(mp.domisili || '-')}</td>
                        <td class="py-2.5 px-4 whitespace-nowrap">
                            <div class="inline-flex items-center gap-2">
                                <span id="master-mp-pwd-${Number(mp.id)}" data-revealed="0" class="font-mono text-gray-700 tracking-wider">${escapeHtml(maskedPwd)}</span>
                                <button type="button" onclick="toggleMasterMpPasswordVisibility(${Number(mp.id)})"
                                    title="Lihat / sembunyikan password"
                                    class="text-gray-400 hover:text-teal-600 transition-colors focus:outline-none cursor-pointer">
                                    <i id="master-mp-pwd-icon-${Number(mp.id)}" class="fa-regular fa-eye text-[11px]"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

function getManpowerPassword(mp) {
    if (!mp) return '';
    const custom = String(mp.password || '').trim();
    return custom || String(mp.nrp || '').trim();
}

function toggleMasterMpPasswordVisibility(mpId) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    const spanEl = document.getElementById(`master-mp-pwd-${Number(mpId)}`);
    const iconEl = document.getElementById(`master-mp-pwd-icon-${Number(mpId)}`);
    if (!mp || !spanEl) return;

    const pwdVal = getManpowerPassword(mp);
    const isRevealed = spanEl.dataset.revealed === '1';
    if (isRevealed) {
        spanEl.dataset.revealed = '0';
        spanEl.textContent = pwdVal ? '•'.repeat(Math.min(10, Math.max(6, pwdVal.length))) : '-';
        if (iconEl) iconEl.className = 'fa-regular fa-eye text-[11px]';
    } else {
        spanEl.dataset.revealed = '1';
        spanEl.textContent = pwdVal || '-';
        if (iconEl) iconEl.className = 'fa-regular fa-eye-slash text-[11px] text-teal-600';
    }
}

function confirmDeleteMasterManpower(mpId) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;
    openConfirmDeleteModal({
        title: 'Hapus Master Manpower',
        message: `Hapus <strong>${escapeHtml(mp.nama)}</strong> (NRP: ${escapeHtml(mp.nrp)})? Seluruh tabel yang terkoneksi akan otomatis diperbarui.`,
        confirmText: 'Ya, Hapus',
        onConfirm: () => {
            manpowerState = manpowerState.filter(m => Number(m.id) !== Number(mpId));
            syncAllMasterConnections(false);
            showToast(`Manpower ${mp.nama} dihapus dari Master Data.`, 'info');
        }
    });
}

function renderMasterJabatanTable() {
    const tbody = document.getElementById('master-jabatan-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-jabatan-search')?.value || '').trim().toLowerCase();
    const rows = masterJabatanState.filter(j => !query || String(j.nama).toLowerCase().includes(query));

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-xs text-gray-400">Tidak ada data jabatan yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((j, idx) => {
        const docList = getAllowedDocsForRole(j.nama).map(k => DOC_RULES[k]?.label || k).join(', ');
        const mpCount = manpowerState.filter(m => m.jabatan === j.nama).length;
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 text-gray-800 font-semibold whitespace-nowrap">${escapeHtml(j.nama)}</td>
                        <td class="py-2.5 px-4 text-gray-600">${escapeHtml(docList || '-')}</td>
                        <td class="py-2.5 px-4 text-center font-mono font-semibold text-teal-700">${mpCount} orang</td>
                        <td class="py-2.5 px-4 text-center whitespace-nowrap space-x-1">
                            <button type="button" onclick="openMasterItemModal('jabatan', ${Number(j.id)})" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white text-[10px] font-semibold transition-colors">Edit</button>
                            <button type="button" onclick="confirmDeleteMasterItem('jabatan', ${Number(j.id)})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function renderMasterPerusahaanTable() {
    const tbody = document.getElementById('master-perusahaan-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-perusahaan-search')?.value || '').trim().toLowerCase();
    const rows = masterPerusahaanState.filter(p =>
        !query || `${p.kode} ${p.keterangan}`.toLowerCase().includes(query)
    );

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-xs text-gray-400">Tidak ada data perusahaan yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((p, idx) => {
        const mpCount = manpowerState.filter(m => m.perusahaan === p.kode).length;
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 font-mono font-bold text-teal-700 whitespace-nowrap">${escapeHtml(p.kode)}</td>
                        <td class="py-2.5 px-4 text-gray-700">${escapeHtml(p.keterangan || '-')}</td>
                        <td class="py-2.5 px-4 text-center font-mono font-semibold text-gray-700">${mpCount} orang</td>
                        <td class="py-2.5 px-4 text-center whitespace-nowrap space-x-1">
                            <button type="button" onclick="openMasterItemModal('perusahaan', ${Number(p.id)})" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white text-[10px] font-semibold transition-colors">Edit</button>
                            <button type="button" onclick="confirmDeleteMasterItem('perusahaan', ${Number(p.id)})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function renderMasterUnitTable() {
    const tbody = document.getElementById('master-unit-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-unit-search')?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById('master-unit-cat-filter')?.value || 'all';

    const rows = komisioningState.filter(u => {
        const cat = getUnitCategoryGroup(u.no_unit, u.model_tipe, u.kategori_unit);
        if (catFilter !== 'all' && cat !== catFilter) return false;
        if (!query) return true;
        return `${u.no_unit} ${u.model_tipe}`.toLowerCase().includes(query);
    });

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Tidak ada data unit yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((u, idx) => {
        const cat = getUnitCategoryGroup(u.no_unit, u.model_tipe, u.kategori_unit);
        const catBadge = cat === 'lt_wt'
            ? '<span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">LT &amp; WT</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 font-semibold">Lifting</span>';
        const hmRate = Number(u.hm_rate ?? 10);
        const rentalRate = Number(u.rental_rate ?? 0);
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 font-mono font-bold text-gray-800 whitespace-nowrap">${escapeHtml(u.no_unit)}</td>
                        <td class="py-2.5 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(u.model_tipe || '-')}</td>
                        <td class="py-2.5 px-4 whitespace-nowrap">${catBadge}</td>
                        <td class="py-2.5 px-4 text-right font-mono font-semibold text-gray-700 whitespace-nowrap">${hmRate.toFixed(1)} Jam / Hari</td>
                        <td class="py-2.5 px-4 text-right font-mono font-semibold text-teal-700 whitespace-nowrap">${formatRupiah(rentalRate)} / Jam</td>
                        <td class="py-2.5 px-4 text-center whitespace-nowrap space-x-1">
                            <button type="button" onclick="openMasterItemModal('unit', ${Number(u.id)})" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white text-[10px] font-semibold transition-colors">Edit</button>
                            <button type="button" onclick="confirmDeleteMasterItem('unit', ${Number(u.id)})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function renderMasterKodeRosterTable() {
    const tbody = document.getElementById('master-kode-roster-tbody');
    if (!tbody) return;
    const query = (document.getElementById('master-kode-search')?.value || '').trim().toLowerCase();
    const rows = masterKodeRosterState.filter(k =>
        !query || `${k.kode} ${k.artiSistem} ${k.keterangan}`.toLowerCase().includes(query)
    );

    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-xs text-gray-400">Tidak ada kode roster yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((k, idx) => {
        const meta = ROSTER_SYSTEM_ACTION_META[k.artiSistem] || ROSTER_SYSTEM_ACTION_META.LIBUR;
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-4 text-center font-mono text-gray-500">${idx + 1}</td>
                        <td class="py-2.5 px-4 font-mono font-bold text-gray-800 whitespace-nowrap">${escapeHtml(k.kode)}</td>
                        <td class="py-2.5 px-4 whitespace-nowrap"><span class="px-2.5 py-0.5 rounded-full text-[9px] font-semibold ${meta.badgeCls}">${escapeHtml(meta.label)}</span></td>
                        <td class="py-2.5 px-4 text-gray-700">${escapeHtml(k.keterangan)}</td>
                        <td class="py-2.5 px-4 text-center whitespace-nowrap space-x-1">
                            <button type="button" onclick="openMasterItemModal('kode-roster', ${Number(k.id)})" class="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white text-[10px] font-semibold transition-colors">Edit</button>
                            <button type="button" onclick="confirmDeleteMasterItem('kode-roster', ${Number(k.id)})" class="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
    }).join('');
}

function openMasterItemModal(type, editId = null) {
    const modal = document.getElementById('modal-master-item');
    const form = document.getElementById('form-master-item');
    if (!modal || !form) return;
    form.reset();

    document.getElementById('master-item-type').value = type;
    document.getElementById('master-item-edit-id').value = editId ? String(editId) : '';

    ['jabatan', 'perusahaan', 'unit', 'kode-roster', 'kode-spi'].forEach(panelType => {
        document.getElementById(`master-fields-${panelType}`)?.classList.toggle('hidden', panelType !== type);
    });

    const titles = {
        jabatan: editId ? 'Edit Master Jabatan' : 'Tambah Jabatan Baru',
        perusahaan: editId ? 'Edit Master Perusahaan' : 'Tambah Perusahaan Baru',
        unit: editId ? 'Edit Unit, Type, HM Rate & Rental Rate' : 'Tambah Unit & Tarif Baru',
        'kode-roster': editId ? 'Edit Kode Roster' : 'Tambah Kode Roster Baru',
        'kode-spi': editId ? 'Edit Kode SPI Bulanan' : 'Tambah / Update Kode SPI Bulanan'
    };
    document.getElementById('modal-master-title').textContent = titles[type] || 'Master Data';
    document.getElementById('btn-submit-master-text').textContent = editId ? 'Simpan Perubahan' : 'Simpan Data';

    if (type === 'jabatan' && editId) {
        const item = masterJabatanState.find(j => Number(j.id) === Number(editId));
        if (item) document.getElementById('master-jabatan-nama').value = item.nama;
    } else if (type === 'perusahaan' && editId) {
        const item = masterPerusahaanState.find(p => Number(p.id) === Number(editId));
        if (item) {
            document.getElementById('master-perusahaan-kode').value = item.kode;
            document.getElementById('master-perusahaan-nama').value = item.keterangan || '';
        }
    } else if (type === 'unit') {
        if (editId) {
            const item = komisioningState.find(u => Number(u.id) === Number(editId));
            if (item) {
                document.getElementById('master-unit-no').value = item.no_unit;
                document.getElementById('master-unit-type').value = item.model_tipe || '';
                document.getElementById('master-unit-kategori').value = getUnitCategoryGroup(item.no_unit, item.model_tipe, item.kategori_unit);
                document.getElementById('master-unit-hm-rate').value = String(item.hm_rate ?? 10);
                document.getElementById('master-unit-rental-rate').value = String(item.rental_rate ?? 0);
            }
        } else {
            document.getElementById('master-unit-hm-rate').value = '10';
            document.getElementById('master-unit-rental-rate').value = '0';
        }
    } else if (type === 'kode-roster' && editId) {
        const item = masterKodeRosterState.find(k => Number(k.id) === Number(editId));
        if (item) {
            document.getElementById('master-kode-roster-code').value = item.kode;
            document.getElementById('master-kode-roster-action').value = item.artiSistem;
            document.getElementById('master-kode-roster-ket').value = item.keterangan;
        }
    } else if (type === 'kode-spi') {
        if (editId) {
            const item = masterKodeSpiState.find(s => Number(s.id) === Number(editId));
            if (item) {
                document.getElementById('master-spi-month').value = String(item.bulan);
                document.getElementById('master-spi-year').value = String(item.tahun);
                document.getElementById('master-spi-pengawas').value = item.kodePengawas || '';
                document.getElementById('master-spi-operator').value = item.kodeOperator || '';
                document.getElementById('master-spi-ket').value = item.keterangan || '';
            }
        } else {
            const dailyDateStr = document.getElementById('roster-daily-date')?.value || '';
            const refDate = dailyDateStr ? new Date(dailyDateStr + 'T00:00:00') : new Date();
            const defMonth = isNaN(refDate.getTime()) ? new Date().getMonth() : refDate.getMonth();
            const defYear = isNaN(refDate.getTime()) ? new Date().getFullYear() : refDate.getFullYear();
            document.getElementById('master-spi-month').value = String(defMonth);
            document.getElementById('master-spi-year').value = String(defYear);
        }
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeMasterItemModal() {
    const modal = document.getElementById('modal-master-item');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleMasterItemSubmit(event) {
    event.preventDefault();
    const type = document.getElementById('master-item-type').value;
    const editId = Number(document.getElementById('master-item-edit-id').value) || 0;
    const nextIdFor = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

    if (type === 'jabatan') {
        const nama = document.getElementById('master-jabatan-nama').value.trim();
        if (!nama) { showToast('Nama jabatan wajib diisi.', 'error'); return; }
        const dup = masterJabatanState.some(j => j.nama.toLowerCase() === nama.toLowerCase() && Number(j.id) !== editId);
        if (dup) { showToast(`Jabatan "${nama}" sudah terdaftar.`, 'error'); return; }

        if (editId) {
            const item = masterJabatanState.find(j => Number(j.id) === editId);
            if (!item) return;
            const oldName = item.nama;
            item.nama = nama;
            manpowerState.forEach(m => { if (m.jabatan === oldName) m.jabatan = nama; });
            rosterState.forEach(r => { if (r.jabatan === oldName) r.jabatan = nama; });
            informasiState.forEach(info => {
                if (Array.isArray(info.audiens)) {
                    info.audiens = info.audiens.map(a => a === oldName ? nama : a);
                }
            });
            showToast(`Jabatan diperbarui ke "${nama}" & tersinkron.`, 'success');
        } else {
            masterJabatanState.push({ id: nextIdFor(masterJabatanState), nama });
            showToast(`Jabatan "${nama}" ditambahkan & tersedia di semua filter.`, 'success');
        }
    } else if (type === 'perusahaan') {
        const kode = document.getElementById('master-perusahaan-kode').value.trim().toUpperCase();
        const keterangan = document.getElementById('master-perusahaan-nama').value.trim();
        if (!kode) { showToast('Kode perusahaan wajib diisi.', 'error'); return; }
        const dup = masterPerusahaanState.some(p => p.kode.toUpperCase() === kode && Number(p.id) !== editId);
        if (dup) { showToast(`Perusahaan "${kode}" sudah terdaftar.`, 'error'); return; }

        if (editId) {
            const item = masterPerusahaanState.find(p => Number(p.id) === editId);
            if (!item) return;
            const oldKode = item.kode;
            item.kode = kode;
            item.keterangan = keterangan;
            manpowerState.forEach(m => { if (m.perusahaan === oldKode) m.perusahaan = kode; });
            showToast(`Perusahaan "${kode}" diperbarui & tersinkron.`, 'success');
        } else {
            masterPerusahaanState.push({ id: nextIdFor(masterPerusahaanState), kode, keterangan });
            showToast(`Perusahaan "${kode}" ditambahkan.`, 'success');
        }
    } else if (type === 'unit') {
        const noUnit = document.getElementById('master-unit-no').value.trim().toUpperCase();
        const modelTipe = document.getElementById('master-unit-type').value.trim();
        const kategoriUnit = document.getElementById('master-unit-kategori').value || 'lifting';
        const hmRate = Math.max(0, parseFloat(document.getElementById('master-unit-hm-rate').value) || 0);
        const rentalRate = Math.max(0, Math.round(parseFloat(document.getElementById('master-unit-rental-rate').value) || 0));
        if (!noUnit || !modelTipe) { showToast('Nama/No Unit dan Type Unit wajib diisi.', 'error'); return; }

        const dup = komisioningState.some(u => normalizeUnitKey(u.no_unit) === normalizeUnitKey(noUnit) && Number(u.id) !== editId);
        if (dup) { showToast(`Unit "${noUnit}" sudah ada di Master Unit.`, 'error'); return; }

        if (editId) {
            const item = komisioningState.find(u => Number(u.id) === editId);
            if (!item) return;
            const oldKey = normalizeUnitKey(item.no_unit);
            item.no_unit = noUnit;
            item.model_tipe = modelTipe;
            item.kategori_unit = kategoriUnit;
            item.hm_rate = hmRate;
            item.rental_rate = rentalRate;
            Object.values(hmUaRecordsState).forEach(rec => {
                if (normalizeUnitKey(rec.unit) === oldKey) rec.unit = noUnit;
            });
            showToast(`Unit ${noUnit} (HM Rate: ${hmRate} Jam, Rental: ${formatRupiah(rentalRate)}) diperbarui & tersinkron.`, 'success');
        } else {
            komisioningState.push({
                id: nextIdFor(komisioningState),
                no_unit: noUnit,
                model_tipe: modelTipe,
                kategori_unit: kategoriUnit,
                hm_rate: hmRate,
                rental_rate: rentalRate,
                KOMISIONING_BIB: '',
                KOMISIONING_TIA: '',
                KOMISIONING_TMA: ''
            });
            showToast(`Unit ${noUnit} ditambahkan & otomatis terhubung ke HM & UA, Komisioning, & Rental BIB.`, 'success');
        }
    } else if (type === 'kode-roster') {
        const kode = document.getElementById('master-kode-roster-code').value.trim().toUpperCase();
        const artiSistem = document.getElementById('master-kode-roster-action').value || 'SHIFT_1';
        const keterangan = document.getElementById('master-kode-roster-ket').value.trim();
        if (!kode || !keterangan) { showToast('Kode roster dan keterangan wajib diisi.', 'error'); return; }

        const dup = masterKodeRosterState.some(k => k.kode.toUpperCase() === kode && Number(k.id) !== editId);
        if (dup) { showToast(`Kode roster "${kode}" sudah terdaftar.`, 'error'); return; }

        if (editId) {
            const item = masterKodeRosterState.find(k => Number(k.id) === editId);
            if (!item) return;
            item.kode = kode;
            item.artiSistem = artiSistem;
            item.keterangan = keterangan;
            showToast(`Kode roster "${kode}" (${keterangan}) diperbarui & tersinkron ke Roster & Absensi.`, 'success');
        } else {
            masterKodeRosterState.push({
                id: nextIdFor(masterKodeRosterState),
                kode,
                artiSistem,
                keterangan
            });
            showToast(`Kode roster "${kode}" ditambahkan ke sistem pembacaan Roster & Absensi.`, 'success');
        }
    } else if (type === 'kode-spi') {
        const bulan = parseInt(document.getElementById('master-spi-month').value, 10);
        const tahun = parseInt(document.getElementById('master-spi-year').value, 10) || new Date().getFullYear();
        const kodePengawas = document.getElementById('master-spi-pengawas').value.trim().toUpperCase();
        const kodeOperator = document.getElementById('master-spi-operator').value.trim().toUpperCase();
        const keterangan = document.getElementById('master-spi-ket').value.trim() || `Kode SPI Bulan ${MONTH_NAMES_ID[bulan] || ''} ${tahun}`;
        if (!kodePengawas || !kodeOperator) {
            showToast('Kode SPI Pengawas dan Operator wajib diisi.', 'error');
            return;
        }

        const existingSamePeriod = masterKodeSpiState.find(s => Number(s.tahun) === tahun && Number(s.bulan) === bulan && Number(s.id) !== editId);
        if (editId) {
            if (existingSamePeriod) {
                showToast(`Kode SPI untuk ${MONTH_NAMES_ID[bulan]} ${tahun} sudah ada. Edit langsung baris tersebut.`, 'error');
                return;
            }
            const item = masterKodeSpiState.find(s => Number(s.id) === editId);
            if (!item) return;
            item.tahun = tahun;
            item.bulan = bulan;
            item.kodePengawas = kodePengawas;
            item.kodeOperator = kodeOperator;
            item.keterangan = keterangan;
            showToast(`Kode SPI ${MONTH_NAMES_ID[bulan]} ${tahun} (${kodePengawas} / ${kodeOperator}) diperbarui & tersinkron ke Roster Daily.`, 'success');
        } else if (existingSamePeriod) {
            existingSamePeriod.kodePengawas = kodePengawas;
            existingSamePeriod.kodeOperator = kodeOperator;
            existingSamePeriod.keterangan = keterangan;
            showToast(`Kode SPI ${MONTH_NAMES_ID[bulan]} ${tahun} diperbarui ke ${kodePengawas} / ${kodeOperator} & tersinkron ke Roster Daily.`, 'success');
        } else {
            masterKodeSpiState.push({
                id: nextIdFor(masterKodeSpiState),
                tahun,
                bulan,
                kodePengawas,
                kodeOperator,
                keterangan
            });
            showToast(`Kode SPI ${MONTH_NAMES_ID[bulan]} ${tahun} ditambahkan & tersinkron ke Roster Daily.`, 'success');
        }
    }

    closeMasterItemModal();
    syncAllMasterConnections(false);
}

function confirmDeleteMasterItem(type, id) {
    const labelMap = {
        jabatan: () => masterJabatanState.find(j => Number(j.id) === Number(id))?.nama,
        perusahaan: () => masterPerusahaanState.find(p => Number(p.id) === Number(id))?.kode,
        unit: () => komisioningState.find(u => Number(u.id) === Number(id))?.no_unit,
        'kode-roster': () => masterKodeRosterState.find(k => Number(k.id) === Number(id))?.kode,
        'kode-spi': () => {
            const s = masterKodeSpiState.find(x => Number(x.id) === Number(id));
            return s ? `Kode SPI ${MONTH_NAMES_ID[s.bulan] || ''} ${s.tahun} (${s.kodePengawas}/${s.kodeOperator})` : null;
        }
    };
    const targetLabel = labelMap[type]?.() || `#${id}`;
    openConfirmDeleteModal({
        title: 'Hapus Item Master Data?',
        message: `Apakah Anda yakin ingin menghapus <strong>${escapeHtml(targetLabel)}</strong> dari Master Data? Perubahan akan tersinkron ke tabel & filter terkait.`,
        confirmText: 'Ya, Hapus',
        onConfirm: () => {
            if (type === 'jabatan') masterJabatanState = masterJabatanState.filter(j => Number(j.id) !== Number(id));
            if (type === 'perusahaan') masterPerusahaanState = masterPerusahaanState.filter(p => Number(p.id) !== Number(id));
            if (type === 'unit') komisioningState = komisioningState.filter(u => Number(u.id) !== Number(id));
            if (type === 'kode-roster') masterKodeRosterState = masterKodeRosterState.filter(k => Number(k.id) !== Number(id));
            if (type === 'kode-spi') masterKodeSpiState = masterKodeSpiState.filter(s => Number(s.id) !== Number(id));
            syncAllMasterConnections(false);
            showToast(`Item Master Data "${targetLabel}" dihapus.`, 'info');
        }
    });
}

/* =====================================================================
 * 10. INISIALISASI APLIKASI SAAT HALAMAN SELESAI DIMUAT
 * ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Tampilkan tanggal hari ini pada pill header
    const datePillSpan = document.querySelector('#current-date-pill span');
    if (datePillSpan) {
        const daysID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
        const now = new Date();
        datePillSpan.textContent = `${daysID[now.getDay()]}, ${formatDateID(getTodayISO())}`;
    }

    // Sinkronkan default bulan/tahun filter dengan tanggal sekarang
    const now = new Date();
    const currMonth = String(now.getMonth());
    const currYear = String(now.getFullYear());
    ['atr-monitoring-month', 'atr-weekly-month', 'atr-upload-month', 'absensi-monthly-month', 'ua-weekly-month', 'hmua-upload-month', 'rental-filter-month', 'crane-filter-month', 'roster-filter-month', 'roster-personal-month'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = currMonth;
    });
    ['atr-monitoring-year', 'atr-weekly-year', 'atr-monthly-year', 'atr-upload-year', 'absensi-monthly-year', 'ua-weekly-year', 'hmua-upload-year', 'rental-filter-year', 'crane-filter-year', 'roster-filter-year', 'roster-personal-year'].forEach(id => {
        const el = document.getElementById(id);
        if (el && Array.from(el.options).some(o => o.value === currYear)) el.value = currYear;
    });
    const dailyDateInput = document.getElementById('roster-daily-date');
    if (dailyDateInput && !dailyDateInput.value) dailyDateInput.value = getTodayISO();

    // Inisialisasi dropdown week kalender & grafik
    populateKpiWeekFilters();
    populateAtrMonitoringPeriodOptions();
    populateAtrUploadWeekOptions();
    populateHmUaUploadWeekOptions();
    toggleHmUaUploadTargetFields();
    initCharts();

    // Muat cache lokal instan (0 query); sinkronisasi Supabase & Realtime dijalankan setelah sesi login aktif
    if (typeof hydrateStateFromLocalCache === 'function') {
        hydrateStateFromLocalCache();
    }
    syncMasterDropdownOptions();
    renderRosterLegend();
    setActiveUserProfile(activeUserProfileKey, false);
    renderManpowerTable();
    renderKomisioningTable();
    renderRentalBibTable();
    renderBigCraneTimeframeTable();
    if (typeof initOperasionalSeState === 'function') initOperasionalSeState();
    if (typeof initUniversalTablePagination === 'function') initUniversalTablePagination();
    if (typeof initUniversalTableBulkSelect === 'function') initUniversalTableBulkSelect();
    renderRosterTable();
    if (typeof initRosterSubViews === 'function') initRosterSubViews();
    renderMasterDataSection();

    // Tutup semua dropdown sidebar saat pertama kali masuk halaman Dashboard utama
    SIDEBAR_DROPDOWN_KEYS.forEach(key => setSidebarDropdown(key, false));
});
