/* =====================================================================
 * PANTAU SE — SISTEM LOGIN PERMANEN (CUKUP SEKALI LOGIN SAJA)
 * - Sesi disimpan permanen di localStorage + IndexedDB + Storage Persist API
 * - Tidak pernah kedaluwarsa otomatis; hanya minta login ulang jika aplikasi
 *   dihapus, semua data browser/aplikasi dibersihkan, atau user menekan Keluar.
 * - Mendukung login:
 *     1. Akun Admin Utama (default: admin / admin123)
 *     2. Seluruh akun Manpower berdasarkan NRP / Nama + Password
 *        (sinkron dengan Master Data -> Nama Manpower & tabel Supabase `manpower`)
 * ===================================================================== */

const PANTAU_AUTH_STORAGE_KEY = 'pantau_se_auth_session_v1';
const PANTAU_PWD_OVERRIDE_KEY = 'pantau_se_pwd_overrides_v1';
const PANTAU_AUTH_IDB_NAME = 'PantauSE_AuthDB';
const PANTAU_AUTH_IDB_STORE = 'session';
const PANTAU_AUTH_IDB_KEY = 'active_session';

const PANTAU_DEFAULT_ACCOUNTS = [
    {
        username: 'admin',
        aliases: ['admin', 'adminse', 'admin se'],
        password: String(window.PANTAU_SE_CONFIG?.ADMIN_PASSWORD || 'admin123'),
        profileKey: 'admin',
        type: 'admin',
        avatar: 'AD',
        nrp: 'ADMIN',
        nama: 'Admin SE',
        jabatan: 'Admin',
        roleLabel: 'Admin Support Equipment'
    }
];

let pantauAuthCurrentSession = null;
let pantauPendingResetMp = null;

function readPasswordOverrides() {
    try {
        const raw = localStorage.getItem(PANTAU_PWD_OVERRIDE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        return {};
    }
}

function savePasswordOverride(nrp, newPassword) {
    const key = String(nrp || '').trim().toLowerCase();
    if (!key) return;
    try {
        const map = readPasswordOverrides();
        map[key] = String(newPassword || '');
        localStorage.setItem(PANTAU_PWD_OVERRIDE_KEY, JSON.stringify(map));
    } catch (_) {
        /* abaikan bila storage penuh */
    }
}

function applyPasswordOverridesToList(list) {
    if (!Array.isArray(list)) return;
    const overrides = readPasswordOverrides();
    if (!Object.keys(overrides).length) return;
    list.forEach((mp) => {
        const key = String(mp?.nrp || '').trim().toLowerCase();
        if (key && overrides[key]) {
            mp.password = overrides[key];
        }
    });
}

/* =====================================================================
 * 1. PENYIMPANAN PERMANEN DUAL-LAYER (localStorage + IndexedDB)
 * ===================================================================== */

function readAuthFromLocalStorage() {
    try {
        const raw = localStorage.getItem(PANTAU_AUTH_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.loggedIn && parsed.profileKey && parsed.nama) {
            return parsed;
        }
    } catch (_) {
        /* abaikan bila storage corrupt */
    }
    return null;
}

function writeAuthToLocalStorage(sessionObj) {
    try {
        if (sessionObj) {
            localStorage.setItem(PANTAU_AUTH_STORAGE_KEY, JSON.stringify(sessionObj));
        } else {
            localStorage.removeItem(PANTAU_AUTH_STORAGE_KEY);
        }
    } catch (_) {
        /* abaikan bila storage penuh/privat */
    }
}

function openAuthIdb() {
    return new Promise((resolve) => {
        if (typeof indexedDB === 'undefined' || (typeof location !== 'undefined' && location.protocol === 'file:')) {
            return resolve(null);
        }
        let settled = false;
        const finish = (db) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(db);
        };
        const timer = setTimeout(() => finish(null), 1200);
        try {
            const req = indexedDB.open(PANTAU_AUTH_IDB_NAME, 1);
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result;
                if (!db.objectStoreNames.contains(PANTAU_AUTH_IDB_STORE)) {
                    db.createObjectStore(PANTAU_AUTH_IDB_STORE);
                }
            };
            req.onsuccess = () => finish(req.result);
            req.onerror = () => finish(null);
            req.onblocked = () => finish(null);
        } catch (_) {
            finish(null);
        }
    });
}

async function readAuthFromIndexedDb() {
    const db = await openAuthIdb();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(PANTAU_AUTH_IDB_STORE, 'readonly');
            const req = tx.objectStore(PANTAU_AUTH_IDB_STORE).get(PANTAU_AUTH_IDB_KEY);
            req.onsuccess = () => {
                const val = req.result;
                db.close();
                resolve(val && val.loggedIn && val.profileKey ? val : null);
            };
            req.onerror = () => {
                db.close();
                resolve(null);
            };
        } catch (_) {
            try { db.close(); } catch (__) { }
            resolve(null);
        }
    });
}

async function writeAuthToIndexedDb(sessionObj) {
    const db = await openAuthIdb();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(PANTAU_AUTH_IDB_STORE, 'readwrite');
            const store = tx.objectStore(PANTAU_AUTH_IDB_STORE);
            if (sessionObj) store.put(sessionObj, PANTAU_AUTH_IDB_KEY);
            else store.delete(PANTAU_AUTH_IDB_KEY);
            tx.oncomplete = () => { db.close(); resolve(); };
            tx.onerror = () => { db.close(); resolve(); };
        } catch (_) {
            try { db.close(); } catch (__) { }
            resolve();
        }
    });
}

function requestDurableBrowserStorage() {
    try {
        if (navigator.storage && typeof navigator.storage.persist === 'function') {
            navigator.storage.persist().catch(() => { });
        }
    } catch (_) {
        /* opsional di browser tertentu */
    }
}

async function persistAuthSession(sessionObj) {
    pantauAuthCurrentSession = sessionObj;
    writeAuthToLocalStorage(sessionObj);
    await writeAuthToIndexedDb(sessionObj);
    if (sessionObj) requestDurableBrowserStorage();
}

/* =====================================================================
 * 2. RESOLUSI ROLE & VERIFIKASI AKUN (ADMIN, MANPOWER LOKAL & SUPABASE)
 * ===================================================================== */

function deriveRoleTypeFromJabatan(jabatan) {
    const j = String(jabatan || '').trim().toLowerCase();
    if (!j) return 'karyawan';
    if (j.includes('admin')) return 'admin';
    if (j.includes('section')) return 'section';
    if (j.includes('group leader') || j === 'gl' || j.startsWith('gl ') || j.includes('pengawas')) return 'gl';
    return 'karyawan';
}

function buildInitialsFromName(nama) {
    const clean = String(nama || 'SE').trim();
    if (!clean) return 'SE';
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
}

function buildSessionFromManpower(mp) {
    const roleType = deriveRoleTypeFromJabatan(mp.jabatan);
    const nrpClean = String(mp.nrp || mp.id || 'user').trim();
    const profileKey = roleType === 'admin'
        ? 'admin'
        : `mp_${nrpClean.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
    const roleLabel = roleType === 'admin'
        ? (mp.jabatan || 'Admin Support Equipment')
        : (roleType === 'section'
            ? 'Section Head SE'
            : (roleType === 'gl' ? 'Group Leader SE' : (mp.jabatan || 'Manpower SE')));

    return {
        loggedIn: true,
        profileKey,
        type: roleType,
        avatar: buildInitialsFromName(mp.nama),
        nrp: nrpClean,
        nama: String(mp.nama || nrpClean).trim(),
        jabatan: String(mp.jabatan || 'Karyawan').trim(),
        perusahaan: String(mp.perusahaan || '').trim(),
        roleLabel,
        signedInAt: new Date().toISOString()
    };
}

function getManpowerCandidatePool() {
    const merged = [];
    const seen = new Set();
    const pushItem = (item) => {
        if (!item) return;
        const key = String(item.nrp || item.nama || '').trim().toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push(item);
    };
    if (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) {
        applyPasswordOverridesToList(manpowerState);
        manpowerState.forEach(pushItem);
    }
    return merged;
}

async function authenticatePantauCredentials(rawIdentity, rawPassword) {
    const identity = String(rawIdentity || '').trim();
    const password = String(rawPassword || '').trim();
    const identityLower = identity.toLowerCase();

    if (!identity || !password) {
        return { ok: false, error: 'Masukkan NRP / Username dan Password terlebih dahulu.' };
    }

    // 1. Cek akun Admin bawaan
    for (const acc of PANTAU_DEFAULT_ACCOUNTS) {
        if (acc.aliases.includes(identityLower)) {
            if (password === acc.password) {
                return {
                    ok: true,
                    session: {
                        loggedIn: true,
                        profileKey: acc.profileKey,
                        type: acc.type,
                        avatar: acc.avatar,
                        nrp: acc.nrp,
                        nama: acc.nama,
                        jabatan: acc.jabatan,
                        roleLabel: acc.roleLabel,
                        signedInAt: new Date().toISOString()
                    }
                };
            }
            return { ok: false, error: 'Password Admin SE tidak sesuai.' };
        }
    }

    // 2. Jika Supabase aktif, cari HANYA 1 baris yang cocok (Mode Hemat Egress & Log Query)
    let matchedMp = null;
    if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && typeof supabaseSelect === 'function') {
        try {
            const safeVal = cleanIdentity.replace(/["\\]/g, '').trim();
            const orFilter = `or=(nrp.ilike."${safeVal}",nama.ilike."${safeVal}",email.ilike."${safeVal}")`;
            const remoteRows = await supabaseSelect(
                'manpower',
                `select=id,nrp,nama,jabatan,perusahaan,domisili,kontak,email,password&${encodeURI(orFilter)}&limit=1`
            );
            if (Array.isArray(remoteRows) && remoteRows.length > 0) {
                const r = remoteRows[0];
                const overridePwd = getPasswordOverridesMap()[String(r.nrp || '').trim().toLowerCase()];
                matchedMp = {
                    id: r.id, nrp: r.nrp, nama: r.nama, jabatan: r.jabatan || '',
                    perusahaan: r.perusahaan || 'PPA', domisili: r.domisili || 'Mess',
                    kontak: r.kontak || '', email: r.email || '',
                    password: overridePwd || r.password || r.nrp || ''
                };
            }
        } catch (err) {
            console.warn('Cek login ke Supabase gagal, menggunakan data manpower lokal:', err);
        }
    }

    // 3. Fallback cocokkan ke pool lokal bila offline / belum ditemukan di query remote
    if (!matchedMp) {
        const candidateList = getManpowerCandidatePool();
        matchedMp = candidateList.find((mp) => {
            const nrp = String(mp.nrp || '').trim().toLowerCase();
            const nama = String(mp.nama || '').trim().toLowerCase();
            const email = String(mp.email || '').trim().toLowerCase();
            return identityLower === nrp || identityLower === nama || (email && identityLower === email);
        });
    }

    if (!matchedMp) {
        return { ok: false, error: 'NRP / Username tidak ditemukan. Pastikan NRP terdaftar di Data Manpower.' };
    }

    const expectedPassword = String(matchedMp.password || '').trim() || String(matchedMp.nrp || '').trim();
    if (password !== expectedPassword) {
        return { ok: false, error: 'Password salah. Gunakan password akun Anda (default: NRP Anda).' };
    }

    return {
        ok: true,
        session: buildSessionFromManpower(matchedMp)
    };
}

/* =====================================================================
 * 3. APPLY SESI KE UI APLIKASI (SIDEBAR, HAK AKSES, & PROFILE AKTIF)
 * ===================================================================== */

function applyAuthenticatedSessionToApp(sessionObj) {
    if (!sessionObj || !sessionObj.loggedIn) return;
    pantauAuthCurrentSession = sessionObj;

    // Daftarkan profil akun ke USER_ACCESS_PROFILES agar obrolan/like/reaksi memakai nama & jabatan asli
    if (typeof USER_ACCESS_PROFILES !== 'undefined') {
        USER_ACCESS_PROFILES[sessionObj.profileKey] = {
            key: sessionObj.profileKey,
            type: sessionObj.type,
            avatar: sessionObj.avatar || buildInitialsFromName(sessionObj.nama),
            nama: sessionObj.nama,
            nrp: sessionObj.nrp || '',
            jabatan: sessionObj.jabatan || 'Karyawan',
            roleLabel: sessionObj.roleLabel || sessionObj.jabatan || 'Support Equipment'
        };
    }

    if (typeof setActiveUserProfile === 'function') {
        setActiveUserProfile(sessionObj.profileKey, false);
    }

    const sideName = document.getElementById('sidebar-user-name');
    const sideRole = document.getElementById('sidebar-user-role');
    const sideAvatar = document.getElementById('sidebar-user-avatar');
    if (sideName) sideName.textContent = sessionObj.nama;
    if (sideRole) {
        sideRole.textContent = sessionObj.nrp && sessionObj.nrp !== 'ADMIN'
            ? `${sessionObj.jabatan} · ${sessionObj.nrp}`
            : (sessionObj.roleLabel || 'Admin Support Equipment');
    }
    if (sideAvatar) sideAvatar.textContent = sessionObj.avatar || buildInitialsFromName(sessionObj.nama);

    hidePantauLoginScreen();
    if (typeof clearRosterPicUnlockedGrants === 'function') clearRosterPicUnlockedGrants();
    if (typeof applyRoleAccessAndNavigationUi === 'function') applyRoleAccessAndNavigationUi();
    if (typeof renderRosterTable === 'function') renderRosterTable();
    // Jalankan sync hemat egress + Realtime WebSocket segera setelah sesi aktif
    if (typeof bootstrapPantauCloudSync === 'function') {
        bootstrapPantauCloudSync();
    }
}

/* =====================================================================
 * 4. TAMPILAN LAYAR SIGN IN (DESAIN BERSIH & MODERN SEPERTI REFERENSI)
 * ===================================================================== */

const PANTAU_AUTH_HERO_URL = 'https://lh3.googleusercontent.com/d/1_Vjd7dVrMCm4EK0Clug3zNyXEeYCUx9A';
const PANTAU_AUTH_HERO_FALLBACK = 'https://drive.google.com/thumbnail?id=1_Vjd7dVrMCm4EK0Clug3zNyXEeYCUx9A&sz=w1200';

function ensurePantauLoginScreenElement() {
    let screen = document.getElementById('pantau-auth-screen');
    if (screen) return screen;

    screen = document.createElement('div');
    screen.id = 'pantau-auth-screen';
    screen.className = 'fixed inset-0 w-full max-w-full z-[9999] hidden flex-col md:items-center md:justify-center p-0 md:p-6 bg-[#F5F5F5] md:bg-gradient-to-br md:from-[#F7F4EF] md:via-[#F2F7F5] md:to-[#E3F0EC] overflow-x-hidden overflow-y-auto';
    screen.innerHTML = `
        <div id="auth-card-shell" class="w-full max-w-full min-h-[100dvh] md:min-h-0 md:w-auto md:max-w-[860px] flex flex-col md:flex-row md:items-stretch bg-[#F5F5F5] md:bg-white rounded-none md:rounded-[28px] shadow-none md:shadow-[0_24px_64px_-16px_rgba(15,76,92,0.2)] border-0 md:border md:border-gray-100 overflow-hidden">

            <!-- KIRI (Desktop) / TENGAH (HP): Foto Utama PANTAU SE -->
            <div id="auth-hero-col" class="flex-1 md:flex-none w-full max-w-full md:w-[400px] lg:w-[430px] shrink-0 bg-[#F5F5F5] flex items-center justify-center px-3 md:px-0 py-6 md:py-0 overflow-hidden">
                <img
                    id="auth-hero-image"
                    src="${PANTAU_AUTH_HERO_URL}"
                    onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${PANTAU_AUTH_HERO_FALLBACK}';}"
                    alt="PANTAU SE — Support Equipment"
                    class="block w-full max-w-[380px] md:max-w-full h-[210px] sm:h-[240px] md:h-auto object-cover object-center select-none"
                >
            </div>

            <!-- KANAN (Desktop, tinggi otomatis ikut foto) / BAWAH (HP, menyatu tanpa pembatas) -->
            <div id="auth-form-col" class="flex-none md:flex-1 w-full max-w-full md:w-[390px] lg:w-[410px] shrink-0 bg-[#F5F5F5] md:bg-white px-5 sm:px-8 md:px-9 pt-2 pb-8 sm:pb-10 md:py-9 flex flex-col justify-end md:justify-center box-border">

                <!-- VIEW 1: SIGN IN -->
                <div id="auth-view-signin" class="w-full max-w-[420px] mx-auto md:max-w-none">
                    <h1 class="text-[30px] sm:text-[32px] font-extrabold tracking-tight text-[#0D4A3E] leading-tight">Sign in</h1>

                    <!-- Inline Success Alert (setelah reset password) -->
                    <div id="auth-success-box" class="hidden mt-4 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[12px] font-medium text-emerald-700 flex items-start gap-2">
                        <i class="fa-solid fa-circle-check mt-0.5 text-emerald-600 shrink-0"></i>
                        <span id="auth-success-text"></span>
                    </div>

                    <!-- Inline Error Alert -->
                    <div id="auth-error-box" class="hidden mt-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] font-medium text-red-700 flex items-start gap-2">
                        <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500 shrink-0"></i>
                        <span id="auth-error-text"></span>
                    </div>

                    <!-- Sign In Form -->
                    <form id="pantau-login-form" onsubmit="handlePantauLoginSubmit(event)" class="mt-5 space-y-3.5" novalidate>
                        <div>
                            <input
                                id="auth-input-username"
                                type="text"
                                autocomplete="username"
                                enterkeyhint="next"
                                onkeydown="handlePantauEnterFocusNext(event, 'auth-input-password')"
                                required
                                placeholder="User Name / NRP"
                                class="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1B7361] focus:ring-2 focus:ring-[#1B7361]/20 transition-all"
                            >
                        </div>

                        <div class="relative">
                            <input
                                id="auth-input-password"
                                type="password"
                                autocomplete="current-password"
                                enterkeyhint="done"
                                required
                                placeholder="Password"
                                class="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1B7361] focus:ring-2 focus:ring-[#1B7361]/20 transition-all"
                            >
                            <button
                                type="button"
                                id="auth-toggle-pwd-btn"
                                onclick="togglePantauPwdField('auth-input-password', 'auth-toggle-pwd-icon')"
                                title="Tampilkan / sembunyikan password"
                                aria-label="Tampilkan atau sembunyikan password"
                                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1B7361] hover:bg-teal-50/70 transition-colors"
                            >
                                <i id="auth-toggle-pwd-icon" class="fa-regular fa-eye text-[15px]"></i>
                            </button>
                        </div>

                        <!-- Forgot Password Link (Rata Kanan) -->
                        <div class="flex items-center justify-end pt-0.5 pb-1">
                            <button
                                type="button"
                                onclick="openPantauResetPasswordView()"
                                class="text-[12px] font-semibold text-gray-500 hover:text-[#1B7361] transition-colors"
                            >
                                Lupa Password?
                            </button>
                        </div>

                        <!-- Submit Button -->
                        <button
                            type="submit"
                            id="auth-submit-btn"
                            class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1E826E] via-[#1B7361] to-[#125648] hover:brightness-105 active:scale-[0.99] text-white text-[15px] font-bold tracking-wide shadow-lg shadow-[#1B7361]/25 transition-all inline-flex items-center justify-center gap-2"
                        >
                            <span id="auth-submit-label">Masuk</span>
                        </button>
                    </form>
                </div>

                <!-- VIEW 2: RESET PASSWORD (MASUKKAN NRP -> PASSWORD BARU & VALIDASI) -->
                <div id="auth-view-reset" class="hidden w-full max-w-[420px] mx-auto md:max-w-none">
                    <button
                        type="button"
                        onclick="backToPantauSignInView()"
                        class="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 hover:text-[#1B7361] mb-4 transition-colors"
                    >
                        <i class="fa-solid fa-arrow-left text-[11px]"></i>
                        <span>Kembali ke Sign in</span>
                    </button>

                    <h2 class="text-[26px] font-extrabold tracking-tight text-[#0D4A3E] leading-tight">Reset Password</h2>

                    <!-- Inline Reset Error Alert -->
                    <div id="auth-reset-error-box" class="hidden mt-4 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-[12px] font-medium text-red-700 flex items-start gap-2">
                        <i class="fa-solid fa-circle-exclamation mt-0.5 text-red-500 shrink-0"></i>
                        <span id="auth-reset-error-text"></span>
                    </div>

                    <!-- Langkah 1: Masukkan NRP -->
                    <form id="auth-reset-nrp-form" onsubmit="handlePantauVerifyResetNrp(event)" class="mt-5 space-y-3.5" novalidate>
                        <div>
                            <input
                                id="auth-reset-nrp"
                                type="text"
                                autocomplete="off"
                                required
                                placeholder="Masukkan NRP Anda"
                                class="w-full px-4 py-3.5 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1B7361] focus:ring-2 focus:ring-[#1B7361]/20 transition-all"
                            >
                        </div>
                        <button
                            type="submit"
                            id="auth-reset-verify-btn"
                            class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1E826E] via-[#1B7361] to-[#125648] hover:brightness-105 active:scale-[0.99] text-white text-[14.5px] font-bold tracking-wide shadow-lg shadow-[#1B7361]/25 transition-all"
                        >
                            <span id="auth-reset-verify-label">Lanjutkan</span>
                        </button>
                    </form>

                    <!-- Langkah 2: Password Baru & Validasi Password Baru -->
                    <form id="auth-reset-pwd-form" onsubmit="handlePantauSaveResetPassword(event)" class="hidden mt-5 space-y-3.5" novalidate>
                        <div class="px-3.5 py-2.5 rounded-xl bg-teal-50/90 border border-teal-200 flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <p id="auth-reset-mp-name" class="text-[12.5px] font-bold text-[#0D4A3E] truncate"></p>
                                <p id="auth-reset-mp-meta" class="text-[10.5px] text-teal-700 truncate"></p>
                            </div>
                            <button type="button" onclick="resetPantauNrpStep()" class="text-[11px] font-semibold text-teal-700 hover:underline shrink-0">
                                Ganti NRP
                            </button>
                        </div>

                        <div class="relative">
                            <input
                                id="auth-reset-new-pwd"
                                type="password"
                                autocomplete="new-password"
                                enterkeyhint="next"
                                onkeydown="handlePantauEnterFocusNext(event, 'auth-reset-confirm-pwd')"
                                required
                                placeholder="Password Baru"
                                class="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1B7361] focus:ring-2 focus:ring-[#1B7361]/20 transition-all"
                            >
                            <button
                                type="button"
                                onclick="togglePantauPwdField('auth-reset-new-pwd', 'auth-reset-new-eye')"
                                title="Tampilkan / sembunyikan password baru"
                                aria-label="Tampilkan atau sembunyikan password baru"
                                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1B7361] hover:bg-teal-50/70 transition-colors"
                            >
                                <i id="auth-reset-new-eye" class="fa-regular fa-eye text-[15px]"></i>
                            </button>
                        </div>

                        <div class="relative">
                            <input
                                id="auth-reset-confirm-pwd"
                                type="password"
                                autocomplete="new-password"
                                enterkeyhint="done"
                                required
                                placeholder="Validasi Password Baru"
                                class="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1B7361] focus:ring-2 focus:ring-[#1B7361]/20 transition-all"
                            >
                            <button
                                type="button"
                                onclick="togglePantauPwdField('auth-reset-confirm-pwd', 'auth-reset-confirm-eye')"
                                title="Tampilkan / sembunyikan validasi password baru"
                                aria-label="Tampilkan atau sembunyikan validasi password baru"
                                class="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1B7361] hover:bg-teal-50/70 transition-colors"
                            >
                                <i id="auth-reset-confirm-eye" class="fa-regular fa-eye text-[15px]"></i>
                            </button>
                        </div>

                        <button
                            type="submit"
                            id="auth-reset-save-btn"
                            class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#1E826E] via-[#1B7361] to-[#125648] hover:brightness-105 active:scale-[0.99] text-white text-[14.5px] font-bold tracking-wide shadow-lg shadow-[#1B7361]/25 transition-all"
                        >
                            <span id="auth-reset-save-label">Simpan Password Baru</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(screen);
    return screen;
}

function showPantauLoginScreen() {
    const screen = ensurePantauLoginScreenElement();
    backToPantauSignInView(false);
    screen.classList.remove('hidden');
    screen.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    setTimeout(() => {
        const inp = document.getElementById('auth-input-username');
        if (inp) inp.focus();
    }, 50);
}

function hidePantauLoginScreen() {
    const screen = document.getElementById('pantau-auth-screen');
    if (screen) {
        screen.classList.add('hidden');
        screen.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

function setPantauLoginError(message = '') {
    const box = document.getElementById('auth-error-box');
    const txt = document.getElementById('auth-error-text');
    if (!box || !txt) return;
    if (message) {
        txt.textContent = message;
        box.classList.remove('hidden');
        setPantauLoginSuccess('');
    } else {
        txt.textContent = '';
        box.classList.add('hidden');
    }
}

function setPantauLoginSuccess(message = '') {
    const box = document.getElementById('auth-success-box');
    const txt = document.getElementById('auth-success-text');
    if (!box || !txt) return;
    if (message) {
        txt.textContent = message;
        box.classList.remove('hidden');
    } else {
        txt.textContent = '';
        box.classList.add('hidden');
    }
}

function setPantauResetError(message = '') {
    const box = document.getElementById('auth-reset-error-box');
    const txt = document.getElementById('auth-reset-error-text');
    if (!box || !txt) return;
    if (message) {
        txt.textContent = message;
        box.classList.remove('hidden');
    } else {
        txt.textContent = '';
        box.classList.add('hidden');
    }
}

function togglePantauPwdField(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    if (icon) {
        icon.className = isHidden ? 'fa-regular fa-eye-slash text-[15px]' : 'fa-regular fa-eye text-[15px]';
    }
}

function handlePantauEnterFocusNext(event, nextInputId) {
    if (event && (event.key === 'Enter' || event.keyCode === 13)) {
        event.preventDefault();
        setPantauLoginError('');
        setPantauResetError('');
        const nextEl = document.getElementById(nextInputId);
        if (nextEl) {
            nextEl.focus();
            if (typeof nextEl.select === 'function') nextEl.select();
        }
    }
}

function togglePantauLoginPassword() {
    togglePantauPwdField('auth-input-password', 'auth-toggle-pwd-icon');
}

function openPantauResetPasswordView() {
    pantauPendingResetMp = null;
    setPantauLoginError('');
    setPantauLoginSuccess('');
    setPantauResetError('');
    const signInView = document.getElementById('auth-view-signin');
    const resetView = document.getElementById('auth-view-reset');
    const nrpForm = document.getElementById('auth-reset-nrp-form');
    const pwdForm = document.getElementById('auth-reset-pwd-form');
    if (signInView) signInView.classList.add('hidden');
    if (resetView) resetView.classList.remove('hidden');
    if (nrpForm) nrpForm.classList.remove('hidden');
    if (pwdForm) {
        pwdForm.classList.add('hidden');
        pwdForm.reset();
    }
    const existingVal = String(document.getElementById('auth-input-username')?.value || '').trim();
    const nrpInp = document.getElementById('auth-reset-nrp');
    if (nrpInp) {
        nrpInp.value = existingVal && existingVal.toLowerCase() !== 'admin' ? existingVal : '';
        setTimeout(() => nrpInp.focus(), 40);
    }
}

function resetPantauNrpStep() {
    pantauPendingResetMp = null;
    setPantauResetError('');
    const nrpForm = document.getElementById('auth-reset-nrp-form');
    const pwdForm = document.getElementById('auth-reset-pwd-form');
    if (nrpForm) nrpForm.classList.remove('hidden');
    if (pwdForm) {
        pwdForm.classList.add('hidden');
        pwdForm.reset();
    }
    setTimeout(() => document.getElementById('auth-reset-nrp')?.focus(), 40);
}

function backToPantauSignInView(focusUsername = true) {
    pantauPendingResetMp = null;
    setPantauResetError('');
    const signInView = document.getElementById('auth-view-signin');
    const resetView = document.getElementById('auth-view-reset');
    if (resetView) resetView.classList.add('hidden');
    if (signInView) signInView.classList.remove('hidden');
    if (focusUsername) {
        setTimeout(() => document.getElementById('auth-input-username')?.focus(), 40);
    }
}

async function handlePantauVerifyResetNrp(event) {
    if (event) event.preventDefault();
    setPantauResetError('');

    const rawNrp = String(document.getElementById('auth-reset-nrp')?.value || '').trim();
    if (!rawNrp) {
        setPantauResetError('Harap masukkan NRP Anda terlebih dahulu.');
        return;
    }

    const btn = document.getElementById('auth-reset-verify-btn');
    const lbl = document.getElementById('auth-reset-verify-label');
    if (btn) btn.disabled = true;
    if (lbl) lbl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>Mencari NRP...';

    try {
        // Cari HANYA 1 baris manpower yang cocok dengan NRP (Mode Hemat Egress & Log Query)
        let matched = null;
        if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && typeof supabaseSelect === 'function') {
            try {
                const remoteRows = await supabaseSelect(
                    'manpower',
                    `select=id,nrp,nama,jabatan,perusahaan,email&nrp=ilike.${encodeURIComponent(rawNrp)}&limit=1`
                );
                if (Array.isArray(remoteRows) && remoteRows.length > 0) {
                    matched = remoteRows[0];
                }
            } catch (_) {
                /* fallback ke data manpower lokal */
            }
        }

        if (!matched) {
            const nrpLower = rawNrp.toLowerCase();
            const candidateList = getManpowerCandidatePool();
            matched = candidateList.find((mp) => String(mp.nrp || '').trim().toLowerCase() === nrpLower);
        }

        if (!matched) {
            setPantauResetError(`NRP "${rawNrp}" tidak ditemukan di Data Manpower.`);
            return;
        }

        pantauPendingResetMp = matched;
        const nameEl = document.getElementById('auth-reset-mp-name');
        const metaEl = document.getElementById('auth-reset-mp-meta');
        if (nameEl) nameEl.textContent = matched.nama || matched.nrp;
        if (metaEl) metaEl.textContent = `NRP ${matched.nrp} · ${matched.jabatan || 'Manpower SE'}`;

        document.getElementById('auth-reset-nrp-form')?.classList.add('hidden');
        const pwdForm = document.getElementById('auth-reset-pwd-form');
        if (pwdForm) {
            pwdForm.classList.remove('hidden');
            pwdForm.reset();
        }
        // Reset ikon mata ke default tertutup
        ['auth-reset-new-pwd', 'auth-reset-confirm-pwd'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.type = 'password';
        });
        ['auth-reset-new-eye', 'auth-reset-confirm-eye'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.className = 'fa-regular fa-eye text-[15px]';
        });

        setTimeout(() => document.getElementById('auth-reset-new-pwd')?.focus(), 40);
    } finally {
        if (btn) btn.disabled = false;
        if (lbl) lbl.textContent = 'Lanjutkan';
    }
}

async function handlePantauSaveResetPassword(event) {
    if (event) event.preventDefault();
    setPantauResetError('');

    if (!pantauPendingResetMp) {
        resetPantauNrpStep();
        return;
    }

    const newPwd = String(document.getElementById('auth-reset-new-pwd')?.value || '').trim();
    const confirmPwd = String(document.getElementById('auth-reset-confirm-pwd')?.value || '').trim();

    if (!newPwd) {
        setPantauResetError('Password baru tidak boleh kosong.');
        return;
    }
    if (newPwd.length < 4) {
        setPantauResetError('Password baru minimal 4 karakter.');
        return;
    }
    if (newPwd !== confirmPwd) {
        setPantauResetError('Validasi password baru tidak cocok. Periksa kembali.');
        return;
    }

    const btn = document.getElementById('auth-reset-save-btn');
    const lbl = document.getElementById('auth-reset-save-label');
    if (btn) btn.disabled = true;
    if (lbl) lbl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>Menyimpan...';

    try {
        const targetNrp = String(pantauPendingResetMp.nrp || '').trim();
        const targetName = String(pantauPendingResetMp.nama || targetNrp).trim();
        const targetLower = targetNrp.toLowerCase();

        // 1. Update di state manpowerState & localStorage override agar permanen
        if (typeof manpowerState !== 'undefined' && Array.isArray(manpowerState)) {
            const stateMp = manpowerState.find((m) => String(m.nrp || '').trim().toLowerCase() === targetLower);
            if (stateMp) stateMp.password = newPwd;
        }
        savePasswordOverride(targetNrp, newPwd);

        // 2. Jika Supabase aktif, langsung update kolom password di public.manpower
        if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured() && typeof getPantauSeConfig === 'function') {
            try {
                const cfg = getPantauSeConfig();
                await fetch(`${cfg.SUPABASE_URL}/rest/v1/manpower?nrp=eq.${encodeURIComponent(targetNrp)}`, {
                    method: 'PATCH',
                    headers: {
                        apikey: cfg.SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        Prefer: 'return=minimal'
                    },
                    body: JSON.stringify({ password: newPwd })
                });
            } catch (err) {
                console.warn('Update password ke Supabase gagal (tersimpan lokal):', err);
            }
        }

        // 3. Refresh tabel Master Data Manpower bila sudah dimuat
        try {
            if (typeof renderMasterDataSection === 'function') renderMasterDataSection();
        } catch (_) { /* ignore */ }

        // 4. Kembali ke Sign in dengan NRP terisi otomatis + notifikasi sukses
        backToPantauSignInView(false);
        const userInp = document.getElementById('auth-input-username');
        const pwdInp = document.getElementById('auth-input-password');
        if (userInp) userInp.value = targetNrp;
        if (pwdInp) {
            pwdInp.value = '';
            pwdInp.type = 'password';
            setTimeout(() => pwdInp.focus(), 50);
        }
        const eyeIcon = document.getElementById('auth-toggle-pwd-icon');
        if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye text-[15px]';

        setPantauLoginSuccess(`Password untuk ${targetName} (${targetNrp}) berhasil direset. Silakan masuk dengan password baru.`);
    } finally {
        if (btn) btn.disabled = false;
        if (lbl) lbl.textContent = 'Simpan Password Baru';
    }
}

async function handlePantauLoginSubmit(event) {
    if (event) event.preventDefault();
    setPantauLoginError('');
    setPantauLoginSuccess('');

    const userInput = document.getElementById('auth-input-username')?.value || '';
    const passInput = document.getElementById('auth-input-password')?.value || '';
    const submitBtn = document.getElementById('auth-submit-btn');
    const submitLabel = document.getElementById('auth-submit-label');

    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>Memeriksa akun...';

    try {
        const res = await authenticatePantauCredentials(userInput, passInput);
        if (!res.ok) {
            setPantauLoginError(res.error || 'Login gagal. Periksa NRP dan Password Anda.');
            return;
        }

        // Selalu simpan permanen secara otomatis (localStorage + IndexedDB)
        await persistAuthSession(res.session);
        applyAuthenticatedSessionToApp(res.session);

        // Bersihkan input form
        const form = document.getElementById('pantau-login-form');
        if (form) form.reset();
        const eyeIcon = document.getElementById('auth-toggle-pwd-icon');
        if (eyeIcon) eyeIcon.className = 'fa-regular fa-eye text-[15px]';

        if (typeof showToast === 'function') {
            showToast(`Selamat datang, ${res.session.nama}!`, 'success');
        }
    } catch (err) {
        console.error('Login error:', err);
        setPantauLoginError('Terjadi kendala saat memproses login. Silakan coba lagi.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitLabel) submitLabel.textContent = 'Masuk';
    }
}

function confirmPantauLogout() {
    const userName = pantauAuthCurrentSession?.nama || 'akun ini';
    if (typeof openConfirmDeleteModal === 'function') {
        openConfirmDeleteModal({
            title: 'Keluar dari Akun?',
            message: `Anda sedang masuk sebagai <strong>${escapeHtml(userName)}</strong>. Jika keluar, Anda perlu memasukkan NRP &amp; Password kembali untuk masuk.`,
            confirmText: 'Ya, Keluar',
            onConfirm: async () => {
                if (typeof stopPantauSupabaseRealtime === 'function') stopPantauSupabaseRealtime();
                if (typeof clearRosterPicUnlockedGrants === 'function') clearRosterPicUnlockedGrants();
                await persistAuthSession(null);
                showPantauLoginScreen();
                if (typeof showToast === 'function') {
                    showToast('Anda telah keluar dari akun.', 'info');
                }
            }
        });
    } else {
        if (typeof stopPantauSupabaseRealtime === 'function') stopPantauSupabaseRealtime();
        persistAuthSession(null).then(() => showPantauLoginScreen());
    }
}

function getPantauAuthSession() {
    return pantauAuthCurrentSession || readAuthFromLocalStorage();
}

/* =====================================================================
 * 5. INISIALISASI OTOMATIS SAAT APLIKASI DIBUKA
 * ===================================================================== */

async function initPantauAuthGate() {
    // Cek cepat sinkron dari localStorage agar ZERO flash bagi user yang sudah pernah login
    const localSession = readAuthFromLocalStorage();
    if (localSession) {
        applyAuthenticatedSessionToApp(localSession);
        // Pastikan salinan cadangan di IndexedDB juga selalu sinkron + storage persistent
        writeAuthToIndexedDb(localSession).catch(() => { });
        requestDurableBrowserStorage();
        return;
    }

    // Jika localStorage kosong, cek cadangan permanen di IndexedDB sebelum menampilkan Sign in
    const idbSession = await readAuthFromIndexedDb();
    if (idbSession) {
        writeAuthToLocalStorage(idbSession);
        applyAuthenticatedSessionToApp(idbSession);
        requestDurableBrowserStorage();
        return;
    }

    // Belum pernah login (atau aplikasi/data baru saja dihapus) -> tampilkan layar Sign in
    showPantauLoginScreen();
}

// Pasang layar login secara sinkron sebelum first-paint bila belum ada sesi di localStorage (bebas kedipan)
if (typeof document !== 'undefined') {
    if (document.body && !readAuthFromLocalStorage()) {
        showPantauLoginScreen();
    }
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            initPantauAuthGate();
        }, 0);
    });
}
