/* =====================================================================
 * KONFIGURASI ENVIRONMENT (Membaca window.PANTAU_SE_CONFIG dari index.html)
 * ===================================================================== */
const _PANTAU_ENV = (typeof window !== 'undefined' && window.PANTAU_SE_CONFIG) ? window.PANTAU_SE_CONFIG : {};
const APP_CONFIG = {
    SUPABASE_URL: _PANTAU_ENV.SUPABASE_URL || 'https://your-project-id.supabase.co',
    SUPABASE_ANON_KEY: _PANTAU_ENV.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
    GAS_UPLOAD_URL: _PANTAU_ENV.GAS_UPLOAD_URL || 'https://script.google.com/macros/s/YOUR_DEPLOYED_GAS_ID/exec',
    GAS_API_TOKEN: _PANTAU_ENV.GAS_API_TOKEN || ''
};

/* =====================================================================
 * STATE APLIKASI GLOBAL
 * ===================================================================== */
let manpowerState = [];
let pendingExcelManpower = [];
let pendingAtrUpload = [];
let pendingAbsensiUpload = [];
let pendingHmUaUpload = [];
let manpowerSortState = { column: null, direction: 'none' }; // 'desc' (1x) -> 'asc' (2x) -> 'none' (3x reset)
let komisioningSortState = { column: null, direction: 'none' };
let hmUnitSortState = { column: null, direction: 'none' };
let uaUnitSortState = { column: null, direction: 'none' };
let uaWeeklySortState = { column: null, direction: 'none' };
let uaMtdSortState = { column: null, direction: 'none' };
let rentalSortState = { column: null, direction: 'none' };
let craneSortState = { column: null, direction: 'none' };
let atrSortState = { column: null, direction: 'none' };
let atrWeeklySortState = { column: null, direction: 'none' };
let atrMonthlySortState = { column: null, direction: 'none' };
let absensiSortState = { column: null, direction: 'none' };
let absensiMonthlySortState = { column: null, direction: 'none' };
let rosterSortState = { column: null, direction: 'none' };
let inputKpiSortState = { column: null, direction: 'none' };
let dashKpiSortState = { column: null, direction: 'none' };
const genericTableSortState = {}; // { [tableId]: { colIndex: number|null, direction: 'desc'|'asc'|'none' } }
const absensiRecordsState = {};   // { [`${mpId}::${YYYY-MM-DD}`]: { mpId, date, code, shift, cekin, status, note } }
const atrWeeklyState = {};        // { [`${mpId}::${year}-${monthIndex}-${W1..W5}`]: { atr, nc, s, i, a, periode } }
const atrMonthlyState = {};       // { [`${mpId}::${year}-${monthIndex}`]: { atr, nc, s, i, a } }
let punishmentHistoryState = [];  // [{ id, mpId, nrp, nama, year, monthIdx, tanggal, kategori:'ATR'|'NON_ATR', tingkat:'CC'|'ST'|'SP1'|'SP2'|'SP3'|'PHK', noSurat, keterangan }]
let punishmentHistorySeeded = false;
let pendingPunishmentUpload = [];
const hmUaRecordsState = {};      // { [`${unitCode}::${YYYY-MM-DD}::${shift}`]: { unit, date, shift, nrp, hm_start, hm_stop, hm_diff, hm_aktual } }
const uaWeeklyUploadState = {};   // { [`${unitCode}::${weekKey}`]: { total, count } }
const uaMtdUploadState = {};      // { [`${unitCode}::${year}-${monthIdx}`]: { total, days, shifts } }
let performaHistorySeeded = false;
let hmUaHistorySeeded = false;
let bigCraneChartInstance = null;
let bookingLineChartInstance = null;
let activeLineChartMode = 'kpi';
let currentSection = 'dashboard';
let currentSubSection = 'kpi-se';
let pendingConfirmDeleteAction = null;

/* =====================================================================
 * STATE PUSAT INFORMASI & PROFIL AKUN AKTIF
 * ===================================================================== */
const USER_ACCESS_PROFILES = {
    admin: { key: 'admin', type: 'admin', avatar: 'AD', nama: 'Admin SE', jabatan: 'Admin', roleLabel: 'Admin Support Equipment' }
};
let activeUserProfileKey = 'admin';
const infoCommentCooldowns = {};      // { [`${infoId}::${profileKey}`]: lastTimestampMs }
const expandedInfoCommentIds = new Set();
let activeInfoChatId = null;
let infoCooldownTickerId = null;

let informasiState = [];

/* =====================================================================
 * DATA AWAL PRODUKSI (DIISI DARI SUPABASE / INPUT PENGGUNA)
 * ===================================================================== */
const INITIAL_MANPOWER_MOCK = [];

// Daftar pilihan Hari OFF (Siklus 14 hari: 6 hari DWS Siang + 7 hari NWS Malam + 1 hari OFF = 13 hari kerja, 1 hari OFF)
// Fase 1 = minggu ke-1 (awal bulan), Fase 2 = minggu ke-2 (pertengahan)
const ROSTER_OFF_DAY_OPTIONS = [
    { value: 'Senin 1', label: 'Senin (Awal Bulan)', short: 'Senin', dow: 1, phase: 1 },
    { value: 'Senin 2', label: 'Senin (Pertengahan)', short: 'Senin', dow: 1, phase: 2 },
    { value: 'Selasa 1', label: 'Selasa (Awal Bulan)', short: 'Selasa', dow: 2, phase: 1 },
    { value: 'Selasa 2', label: 'Selasa (Pertengahan)', short: 'Selasa', dow: 2, phase: 2 },
    { value: 'Rabu 1', label: 'Rabu (Awal Bulan)', short: 'Rabu', dow: 3, phase: 1 },
    { value: 'Rabu 2', label: 'Rabu (Pertengahan)', short: 'Rabu', dow: 3, phase: 2 },
    { value: 'Kamis 1', label: 'Kamis (Awal Bulan)', short: 'Kamis', dow: 4, phase: 1 },
    { value: 'Kamis 2', label: 'Kamis (Pertengahan)', short: 'Kamis', dow: 4, phase: 2 },
    { value: 'Jumat 1', label: 'Jumat (Awal Bulan)', short: 'Jumat', dow: 5, phase: 1 },
    { value: 'Jumat 2', label: 'Jumat (Pertengahan)', short: 'Jumat', dow: 5, phase: 2 },
    { value: 'Sabtu 1', label: 'Sabtu (Awal Bulan)', short: 'Sabtu', dow: 6, phase: 1 },
    { value: 'Sabtu 2', label: 'Sabtu (Pertengahan)', short: 'Sabtu', dow: 6, phase: 2 },
    { value: 'Minggu 1', label: 'Minggu (Awal Bulan)', short: 'Minggu', dow: 0, phase: 1 },
    { value: 'Minggu 2', label: 'Minggu (Pertengahan)', short: 'Minggu', dow: 0, phase: 2 }
];

function formatRosterOffDayShort(offDayStr) {
    const parsed = parseRosterOffDay(offDayStr);
    if (!parsed) return '-';
    return parsed.short || String(parsed.value || '').replace(/\s*[12]\s*$/, '').trim() || '-';
}

function formatRosterOffDayLabel(offDayStr) {
    const parsed = parseRosterOffDay(offDayStr);
    if (!parsed) return '-';
    return parsed.label || formatRosterOffDayShort(offDayStr);
}

function parseRosterOffDay(rawStr) {
    const clean = String(rawStr || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!clean || clean === '-') return null;
    const dayAliases = [
        { dow: 1, name: 'Senin', keys: ['senin', 'sen', 'mon', 'monday'] },
        { dow: 2, name: 'Selasa', keys: ['selasa', 'sel', 'tue', 'tuesday'] },
        { dow: 3, name: 'Rabu', keys: ['rabu', 'rab', 'wed', 'wednesday'] },
        { dow: 4, name: 'Kamis', keys: ['kamis', 'kam', 'thu', 'thursday'] },
        { dow: 5, name: 'Jumat', keys: ['jumat', 'jum', 'fri', 'friday'] },
        { dow: 6, name: 'Sabtu', keys: ['sabtu', 'sab', 'sat', 'saturday'] },
        { dow: 0, name: 'Minggu', keys: ['minggu', 'min', 'ahad', 'sun', 'sunday'] }
    ];
    const matchedDay = dayAliases.find(d => d.keys.some(k => clean.startsWith(k)));
    if (!matchedDay) return null;
    const phase = /2/.test(clean) ? 2 : 1;
    const value = `${matchedDay.name} ${phase}`;
    return ROSTER_OFF_DAY_OPTIONS.find(o => o.value === value) || { value, label: value, dow: matchedDay.dow, phase };
}

function isManualSpecialRosterCode(rawCode) {
    const c = String(rawCode || '').trim().toUpperCase();
    if (!c || c === '-') return false;
    if (c.startsWith('CCUTI') || c.startsWith('CUTI') || c.startsWith('INDK') || c.startsWith('INDUKSI') || c.startsWith('MCU') || c.startsWith('TR')) {
        return true;
    }
    if (typeof resolveRosterCodeRule === 'function') {
        const arti = resolveRosterCodeRule(c)?.artiSistem || '';
        return ['CUTI', 'INDUKSI', 'MCU', 'TRAINING', 'SAKIT', 'IZIN'].includes(arti);
    }
    return false;
}

/**
 * Membuat jadwal roster 1 bulan otomatis dari Hari OFF (mis. "Senin 1" / "Senin 2"):
 * - Siklus 14 hari: OFF -> 6 hari DWS (Siang) -> 7 hari NWS (Malam) -> OFF (total 13 hari kerja, 1 hari OFF).
 * - Fase 1 = hari OFF jatuh pada kemunculan ke-1 di awal bulan (tgl 1–7) lalu tiap +14 hari.
 * - Fase 2 = hari OFF jatuh pada kemunculan ke-2 di pertengahan (tgl 8–14) lalu tiap +14 hari.
 * - Kode manual khusus (CCUTI/CUTI, INDK, MCU, TR, Sakit, Izin) tetap dipertahankan bila preserveSpecialFrom diberikan.
 */
function generateMonthlyRosterFromOffDay(year, monthIdx, offDayStr, manualOverrides = {}, preserveSpecialFrom = null) {
    const parsed = parseRosterOffDay(offDayStr);
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const out = {};
    if (!parsed) return out;

    const firstOfMonthDow = new Date(year, monthIdx, 1).getDay();
    const firstDowDay = 1 + ((parsed.dow - firstOfMonthDow + 7) % 7); // Tanggal kemunculan pertama (1..7)
    const anchorOffDay = parsed.phase === 2 ? firstDowDay + 7 : firstDowDay;

    for (let d = 1; d <= daysInMonth; d++) {
        const cyclePos = ((d - anchorOffDay) % 14 + 14) % 14;
        let autoCode;
        if (cyclePos === 0) autoCode = 'OFF';
        else if (cyclePos <= 6) autoCode = 'DWS';
        else autoCode = 'NWS';

        if (manualOverrides && manualOverrides[d]) {
            out[d] = manualOverrides[d];
        } else if (preserveSpecialFrom && isManualSpecialRosterCode(preserveSpecialFrom[d])) {
            out[d] = String(preserveSpecialFrom[d]).trim().toUpperCase();
        } else {
            out[d] = autoCode;
        }
    }
    return out;
}

function detectOffDayFromSchedule(year, monthIdx, monthSched, daysInMonth) {
    if (!monthSched) return '-';
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    for (let d = 1; d <= daysInMonth; d++) {
        const code = String(monthSched[d] || '').trim().toUpperCase();
        if (code === 'OFF' || code.startsWith('OFF')) {
            const dow = new Date(year, monthIdx, d).getDay();
            const firstOfMonthDow = new Date(year, monthIdx, 1).getDay();
            const firstDowDay = 1 + ((dow - firstOfMonthDow + 7) % 7);
            const phase = ((d - firstDowDay) % 14 === 0) ? 1 : 2;
            return `${dayNames[dow]} ${phase}`;
        }
    }
    return '-';
}

// Helper pembentuk jadwal roster bulanan awal (Nov 2026 = '2026-10', pola 6 DWS + 7 NWS + OFF)
function buildInitialMonthlyRosterSchedule(offDayStr, overrides = {}) {
    return { '2026-10': generateMonthlyRosterFromOffDay(2026, 10, offDayStr, overrides) };
}

// Roster aktif bulanan (kosong saat awal produksi — diisi dari Supabase / input & upload Excel)
let rosterState = [];

function isPersonOutOfRoster(mp) {
    if (!mp || !Array.isArray(rosterState) || rosterState.length === 0) return false;
    const nrp = String(mp.nrp || '').trim().toLowerCase();
    const nama = String(mp.nama || '').trim().toLowerCase();
    return !rosterState.some(r =>
        (nrp && String(r.nrp || '').trim().toLowerCase() === nrp) ||
        (nama && String(r.nama || '').trim().toLowerCase() === nama)
    );
}

let komisioningState = [];

let masterJabatanState = [
    { id: 1, nama: 'Section' },
    { id: 2, nama: 'Group Leader' },
    { id: 3, nama: 'Admin' },
    { id: 4, nama: 'Operator Crane' },
    { id: 5, nama: 'Operator Telehandler' },
    { id: 6, nama: 'Operator Forklift' },
    { id: 7, nama: 'Operator Exca & Dozer' },
    { id: 8, nama: 'Operator LT & WT' },
    { id: 9, nama: 'Driver Truck' },
    { id: 10, nama: 'Rigger & Helper Lowboy' },
    { id: 11, nama: 'Oilman' },
    { id: 12, nama: 'Washingman' }
];

let masterPerusahaanState = [
    { id: 1, kode: 'PPA', keterangan: 'PT Putra Perkasa Abadi' },
    { id: 2, kode: 'BJM', keterangan: 'PT BJM Support' },
    { id: 3, kode: 'SRJ', keterangan: 'PT SRJ' }
];

let masterKodeRosterState = [
    { id: 1, kode: 'D', artiSistem: 'SHIFT_1', keterangan: 'SIANG / SHIFT 1 (Kode awalan D, mis. DWS, D520)' },
    { id: 2, kode: 'DWS', artiSistem: 'SHIFT_1', keterangan: 'SHIFT 1 (Day Work Shift)' },
    { id: 3, kode: 'N', artiSistem: 'SHIFT_2', keterangan: 'MALAM / SHIFT 2 (Kode awalan N, mis. NWS, N520)' },
    { id: 4, kode: 'NWS', artiSistem: 'SHIFT_2', keterangan: 'SHIFT 2 (Night Work Shift)' },
    { id: 5, kode: 'OFF', artiSistem: 'LIBUR', keterangan: 'LIBUR' },
    { id: 6, kode: 'CCUTI', artiSistem: 'CUTI', keterangan: 'CUTI' },
    { id: 7, kode: 'CUTI', artiSistem: 'CUTI', keterangan: 'CUTI' },
    { id: 8, kode: 'INDK', artiSistem: 'INDUKSI', keterangan: 'INDUKSI' },
    { id: 9, kode: 'MCU', artiSistem: 'MCU', keterangan: 'MCU (Medical Check Up)' },
    { id: 10, kode: 'TR', artiSistem: 'TRAINING', keterangan: 'TRAINING' }
];

// Master Kode SPI Bulanan (diisi di Master Data → Kode SPI atau disinkronkan dari Supabase)
let masterKodeSpiState = [];

let rentalBibState = [];

let bigCraneTimeframeState = [];

const kpiPengawasStore = {}; // { [`${mpId}::${weekKey}`]: { sap, closing_rate, sqi, atr_individu, atr_anak_asuh, status, updatedAt } }

/* =====================================================================
 * 0. ATURAN WARNA DOKUMEN & PEMETAAN DOKUMEN WAJIB PER JABATAN
 * ===================================================================== */
const DOC_RULES = {
    PERMIT_BIB: { label: 'Permit BIB', warn: 60, crit: 15 },
    PERMIT_TIA: { label: 'Permit TIA', warn: 60, crit: 15 },
    LOTOTO: { label: 'LOTOTO', warn: 60, crit: 15 },
    MCU: { label: 'MCU', warn: 30, crit: 10 },
    KETINGGIAN: { label: 'Sert. Ketinggian', warn: 30, crit: 10 },
    KOMISIONING_BIB: { label: 'Komisioning BIB', warn: 30, crit: 10 },
    KOMISIONING_TIA: { label: 'Komisioning TIA', warn: 30, crit: 10 },
    KOMISIONING_TMA: { label: 'Komisioning TMA', warn: 30, crit: 10 },
    SIMPOL: { label: 'SIMPOL (SIM B2 Umum)', warn: 90, crit: 30 },
    SIO: { label: 'SIO', warn: 90, crit: 30 }
};

const ALL_DOC_KEYS = ['PERMIT_BIB', 'PERMIT_TIA', 'MCU', 'LOTOTO', 'SIMPOL', 'SIO', 'KETINGGIAN'];

/**
 * Mengembalikan daftar kode dokumen wajib berdasarkan kategori jabatan/role.
 */
function getAllowedDocsForRole(jabatan) {
    const role = String(jabatan || '').trim().toLowerCase();
    if (!role) return [];
    if (role.includes('admin')) {
        return ['PERMIT_BIB', 'MCU'];
    }
    if (role.includes('crane') || role.includes('telehandler') || role.includes('forklift') || role.includes('exca') || role.includes('dozer') || role.includes('lifting')) {
        return ['PERMIT_BIB', 'PERMIT_TIA', 'SIMPOL', 'MCU', 'SIO'];
    }
    if (role.includes('lt') || role.includes('wt') || role.includes('driver')) {
        return ['PERMIT_BIB', 'PERMIT_TIA', 'SIMPOL', 'MCU'];
    }
    if (role.includes('rigger')) {
        return ['PERMIT_BIB', 'PERMIT_TIA', 'MCU', 'LOTOTO', 'KETINGGIAN', 'SIO'];
    }
    if (role.includes('oilman') || role.includes('washing')) {
        return ['PERMIT_BIB', 'PERMIT_TIA', 'MCU', 'LOTOTO'];
    }
    if (role.includes('group leader') || role.includes('gl') || role.includes('pengawas') || role.includes('section')) {
        return ['PERMIT_BIB', 'PERMIT_TIA', 'MCU', 'SIO'];
    }
    return ['PERMIT_BIB', 'MCU'];
}

/**
 * Menampilkan / menyembunyikan input Masa Berlaku Dokumen pada modal Manpower sesuai jabatan terpilih.
 */
function updateDocumentFieldsByRole() {
    const roleVal = document.getElementById('mp-jabatan')?.value || '';
    const docsSection = document.getElementById('mp-docs-section');
    if (!docsSection) return;

    if (!roleVal) {
        docsSection.classList.add('hidden');
        return;
    }

    const allowed = getAllowedDocsForRole(roleVal);
    docsSection.classList.remove('hidden');
    docsSection.querySelectorAll('[data-doc-field]').forEach(el => {
        const key = el.getAttribute('data-doc-field');
        if (allowed.includes(key)) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

const MCU_VALIDITY_MONTHS = 9;

/**
 * Menghitung tanggal jatuh tempo / MCU Ulang dari tanggal Awal MCU (+9 bulan).
 */
function calculateMcuExpiryFromAwal(awalDateStr, months = MCU_VALIDITY_MONTHS) {
    const clean = String(awalDateStr || '').trim();
    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    const totalMonths = mo + months;
    const targetYear = y + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const maxDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const clampedDay = Math.min(d, maxDay);
    return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Mengambil tanggal efektif MCU Ulang (= Exp MCU, masa berlaku 9 bulan dari Awal MCU).
 * Jika data lama masih menyimpan tepat +12 bulan dari Awal MCU atau kosong, otomatis disesuaikan ke +9 bulan.
 */
function getEffectiveMcuDate(mp) {
    if (!mp) return '';
    const awal = String(mp.mcu_awal || '').trim();
    const rawExplicit = (mp.mcu_ulang && String(mp.mcu_ulang).trim())
        ? String(mp.mcu_ulang).trim()
        : String(mp.docs?.MCU || '').trim();
    if (awal) {
        const expected9 = calculateMcuExpiryFromAwal(awal, MCU_VALIDITY_MONTHS);
        const legacy12 = calculateMcuExpiryFromAwal(awal, 12);
        if (!rawExplicit || rawExplicit === legacy12) {
            return expected9;
        }
    }
    return rawExplicit;
}

/**
 * Menghitung selisih hari antara tanggal target (YYYY-MM-DD) dan hari ini.
 */
function getDiffDaysFromToday(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target.getTime())) return null;
    const today = new Date(getTodayISO() + 'T00:00:00');
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Mengevaluasi status & kelas warna dokumen berdasarkan aturan batas hari kategori dokumen.
 */
function evaluateDocumentStatus(docKey, dateStr) {
    if (!dateStr) {
        return { level: 'none', diffDays: null, subText: 'Tidak wajib', subColor: 'text-gray-400', dateColor: 'text-gray-400' };
    }
    const rule = DOC_RULES[docKey] || { warn: 30, crit: 10 };
    const diff = getDiffDaysFromToday(dateStr);
    if (diff === null) {
        return { level: 'none', diffDays: null, subText: '-', subColor: 'text-gray-400', dateColor: 'text-gray-400' };
    }
    if (diff < 0) {
        return { level: 'mati', diffDays: diff, subText: `Lewat ${Math.abs(diff)} hr`, subColor: 'text-gray-900 font-semibold', dateColor: 'text-gray-900' };
    }
    if (diff <= rule.crit) {
        return { level: 'kritis', diffDays: diff, subText: `Sisa ${diff} hr`, subColor: 'text-red-600', dateColor: 'text-gray-800' };
    }
    if (diff <= rule.warn) {
        return { level: 'warning', diffDays: diff, subText: `Sisa ${diff} hr`, subColor: 'text-amber-500', dateColor: 'text-gray-800' };
    }
    return { level: 'aman', diffDays: diff, subText: `Sisa ${diff} hr`, subColor: 'text-emerald-600', dateColor: 'text-gray-800' };
}

/* =====================================================================
 * 1. NAVIGASI SPA & EXPANDABLE SIDEBAR DROPDOWN
 * ===================================================================== */
const PAGE_META = {
    'informasi': { title: 'Beranda', subtitle: 'Pengumuman safety alert, operasional, dan administrasi Support Equipment' },
    'dashboard:kpi-se': { title: 'Dashboard — KPI SE', subtitle: 'Ringkasan performa operasional & utilitas Unit Support Equipment' },
    'dashboard:kpi-pengawas': { title: 'Dashboard — KPI Pengawas', subtitle: 'Rekap capaian SAP, Closing Rate, SQI, & ATR Group Leader (sinkron realtime)' },
    'dashboard:dokumen-analisis': { title: 'Dashboard — Dokumen Analisis', subtitle: 'Early warning masa berlaku dokumen legalitas manpower & komisioning' },
    'manpower': { title: 'Data Manpower', subtitle: 'Database personil, legalitas dokumen, dan pemetaan wajib per jabatan' },
    'performa:atr': { title: 'Performa Manpower — Data ATR', subtitle: 'Monitoring Attendance Ratio (Weekly & Monthly) serta upload data mentah web perusahaan' },
    'performa:absensi': { title: 'Performa Manpower — Data Absensi Harian', subtitle: 'Monitoring cekin harian, rekap bulanan, dan validasi status absensi' },
    'performa:input-kpi-pengawas': { title: 'Performa Manpower — Input KPI Pengawas', subtitle: 'Update berkala MTD harian hingga closing per week (Minggu–Sabtu)' },
    'utilitas:hm': { title: 'Utilitas & Operasi Unit — HM & UA', subtitle: 'Monitoring HM Daily, UA Unit, UA Weekly, UA MTD, dan upload data mentah operasi unit' },
    'utilitas:rental': { title: 'Utilitas & Operasi Unit — Rental BIB', subtitle: 'Pencatatan utilisasi & jadwal sewa unit lifting area BIB' },
    'utilitas:crane': { title: 'Utilitas & Operasi Unit — Time Frame Big Crane', subtitle: 'Monitoring status operasi, standby, dan maintenance Big Crane' },
    'utilitas:komisioning': { title: 'Utilitas & Operasi Unit — Data Komisioning Unit', subtitle: 'Monitoring masa berlaku komisioning BIB, TIA, dan TMA unit SE' },
    'operasional': { title: 'Operasional SE — Lubetruck / Watertruck', subtitle: 'Data operasional gabungan multi-sheet Lubetruck & Watertruck' },
    'operasional:lt-wt': { title: 'Operasional SE — Lubetruck / Watertruck', subtitle: 'Data operasional gabungan multi-sheet Lubetruck & Watertruck' },
    'operasional:lifting': { title: 'Operasional SE — Lifting', subtitle: 'Data WO & realisasi pekerjaan operasional Lifting SE' },
    'roster': { title: 'Roster SE — Roster ALL', subtitle: 'Jadwal shift kerja bulanan per jabatan, edit manual Master Data, & upload Excel' },
    'roster:roster-all': { title: 'Roster SE — Roster ALL', subtitle: 'Jadwal shift bulanan seluruh personil SE (edit inline, Hari OFF, & layar informasi settingan)' },
    'roster:roster-personal': { title: 'Roster SE — Roster Personal', subtitle: 'Kalender bulanan per personil (View Only — jadwal & settingan unit otomatis dari Roster ALL)' },
    'roster:roster-daily': { title: 'Roster SE — Roster Daily', subtitle: 'Format laporan update crew harian siap salin & kirim ke grup (tersinkron Kode SPI Master Data)' },
    'roster:all': { title: 'Roster SE — Roster ALL (Semua Jabatan)', subtitle: 'Jadwal shift bulanan seluruh personil SE (edit inline & sinkron Master Data)' },
    'roster:gl': { title: 'Roster SE — GL (Group Leader)', subtitle: 'Jadwal shift bulanan Group Leader Support Equipment' },
    'roster:admin': { title: 'Roster SE — Admin', subtitle: 'Jadwal shift bulanan Admin Support Equipment' },
    'roster:operator-crane': { title: 'Roster SE — Operator Crane', subtitle: 'Jadwal shift bulanan Operator Crane' },
    'roster:operator-telehandler': { title: 'Roster SE — Operator Telehandler', subtitle: 'Jadwal shift bulanan Operator Telehandler' },
    'roster:operator-forklift': { title: 'Roster SE — Operator Forklift', subtitle: 'Jadwal shift bulanan Operator Forklift' },
    'roster:operator-lt-wt': { title: 'Roster SE — Operator LT & WT', subtitle: 'Jadwal shift bulanan Operator Lube Truck & Water Truck' },
    'roster:operator-exca-dozer': { title: 'Roster SE — Operator Exca & Dozer', subtitle: 'Jadwal shift bulanan Operator Excavator & Dozer' },
    'roster:driver-truck': { title: 'Roster SE — Driver Truck', subtitle: 'Jadwal shift bulanan Driver Truck' },
    'roster:rigger-lowboy': { title: 'Roster SE — Rigger & Helper Lowboy', subtitle: 'Jadwal shift bulanan Rigger & Helper Lowboy' },
    'roster:oilman': { title: 'Roster SE — Oilman', subtitle: 'Jadwal shift bulanan Oilman' },
    'roster:washingman': { title: 'Roster SE — Washingman', subtitle: 'Jadwal shift bulanan Washingman' },
    'master:manpower': { title: 'Master Data — Nama Manpower', subtitle: 'Atur master personil terhubung ke seluruh tabel, filter, & dropdown aplikasi' },
    'master:jabatan': { title: 'Master Data — Jabatan', subtitle: 'Atur daftar jabatan/role yang terhubung ke filter & pemetaan dokumen wajib' },
    'master:perusahaan': { title: 'Master Data — Perusahaan', subtitle: 'Atur daftar perusahaan mitra/kontraktor terhubung ke data manpower' },
    'master:unit': { title: 'Master Data — Unit, HM Rate & Rental Rate', subtitle: 'Atur nama unit, type unit, target HM rate, & harga rental per unit' },
    'master:kode-roster': { title: 'Master Data — Kode Roster', subtitle: 'Atur kode roster & keterangan sistem (DWS, NWS, OFF, CCUTI, dll.)' },
    'master:kode-spi': { title: 'Master Data — Kode SPI', subtitle: 'Atur Kode SPI Pengawas & Operator tiap bulan (terhubung otomatis ke Roster Daily)' },
    'searching': { title: 'Searching', subtitle: 'Cari menu, sub-menu, dan data karyawan lintas seluruh modul' },
    'profil': { title: 'Profil', subtitle: 'Informasi akun pengguna dan akses menu lainnya' }
};

const SIDEBAR_DROPDOWN_KEYS = ['dashboard', 'performa', 'utilitas', 'operasional', 'roster'];
let activeRosterViewMode = 'roster-all'; // 'roster-all' | 'roster-personal' | 'roster-daily'

function setSidebarDropdown(menuKey, isOpen) {
    if (menuKey === 'dashboard' && typeof getNormalizedAccessRole === 'function' && getNormalizedAccessRole() === 'karyawan') {
        isOpen = false;
    }
    const submenu = document.getElementById(`${menuKey}-submenu`);
    const chevron = document.getElementById(`${menuKey}-chevron`);
    if (submenu) {
        if (isOpen) submenu.classList.remove('hidden');
        else submenu.classList.add('hidden');
    }
    if (chevron) {
        if (isOpen) chevron.classList.add('rotate-180');
        else chevron.classList.remove('rotate-180');
    }
}

function toggleSidebarDropdown(menuKey) {
    const submenu = document.getElementById(`${menuKey}-submenu`);
    if (!submenu) return;
    const willOpen = submenu.classList.contains('hidden');
    SIDEBAR_DROPDOWN_KEYS.forEach(key => {
        setSidebarDropdown(key, key === menuKey ? willOpen : false);
    });
}

function navigateTo(section, subSection = null) {
    if (typeof resolveAllowedNavigationTarget === 'function') {
        const resolved = resolveAllowedNavigationTarget(section, subSection);
        if (resolved.redirected && resolved.reason && typeof showToast === 'function') {
            showToast(resolved.reason, 'info');
        }
        section = resolved.section;
        subSection = resolved.subSection || null;
    }

    currentSection = section;
    const defaultSubs = { dashboard: 'kpi-se', performa: 'atr', utilitas: 'hm', operasional: 'lt-wt', roster: 'roster-all', master: 'manpower' };
    currentSubSection = subSection || defaultSubs[section] || '';

    // 1. Tampilkan section aktif
    document.querySelectorAll('.spa-section').forEach(sec => {
        if (sec.id === `section-${section}`) {
            sec.classList.remove('hidden');
            sec.classList.add('flex');
        } else {
            sec.classList.add('hidden');
            sec.classList.remove('flex');
        }
    });

    // Pastikan hanya dropdown milik section aktif yang terbuka (yang lain otomatis tertutup)
    SIDEBAR_DROPDOWN_KEYS.forEach(key => {
        setSidebarDropdown(key, key === section);
    });

    // 2. Tampilkan sub-section jika berada pada menu bertingkat
    if (section === 'informasi') {
        activeInfoChatId = (subSection && !isNaN(Number(subSection))) ? Number(subSection) : null;
        renderInformasiSection();
    } else if (section === 'dashboard') {
        document.querySelectorAll('.dash-subsection').forEach(sub => {
            if (sub.id === `sub-${currentSubSection}`) {
                sub.classList.remove('hidden');
                sub.classList.add('flex');
            } else {
                sub.classList.add('hidden');
                sub.classList.remove('flex');
            }
        });
        if (currentSubSection === 'kpi-pengawas') renderDashboardKpiPengawas();
        if (currentSubSection === 'dokumen-analisis') renderDokumenAnalisis();
    } else if (section === 'performa') {
        ['atr', 'absensi', 'input-kpi-pengawas'].forEach(tab => {
            const el = document.getElementById(`performa-tab-${tab}`);
            if (el) {
                if (tab === currentSubSection) { el.classList.remove('hidden'); el.classList.add('flex'); }
                else { el.classList.add('hidden'); el.classList.remove('flex'); }
            }
        });
        if (currentSubSection === 'input-kpi-pengawas') renderInputKpiPengawasTable();
        else renderPerformaManpower();
    } else if (section === 'utilitas') {
        ['hm', 'rental', 'crane', 'komisioning'].forEach(tab => {
            const el = document.getElementById(`utilitas-tab-${tab}`);
            if (el) {
                if (tab === currentSubSection) { el.classList.remove('hidden'); el.classList.add('flex'); }
                else { el.classList.add('hidden'); el.classList.remove('flex'); }
            }
        });
        if (currentSubSection === 'hm') renderHmUaTables();
        if (currentSubSection === 'rental') renderRentalBibTable();
        if (currentSubSection === 'crane') renderBigCraneTimeframeTable();
        if (currentSubSection === 'komisioning') renderKomisioningTable();
    } else if (section === 'operasional') {
        ['lt-wt', 'lifting'].forEach(tab => {
            const el = document.getElementById(`operasional-tab-${tab}`);
            if (el) {
                if (tab === currentSubSection) { el.classList.remove('hidden'); el.classList.add('flex'); }
                else { el.classList.add('hidden'); el.classList.remove('flex'); }
            }
            const mobBtn = document.getElementById(`ops-mob-tab-${tab}`);
            if (mobBtn) {
                mobBtn.className = tab === currentSubSection
                    ? 'flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all'
                    : 'flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all';
            }
        });
        if (typeof renderOperasionalSeSection === 'function') renderOperasionalSeSection(currentSubSection);
    } else if (section === 'roster') {
        const isViewSwitch = ['roster-all', 'roster-personal', 'roster-daily'].includes(currentSubSection);
        if (isViewSwitch) {
            activeRosterViewMode = currentSubSection;
        } else {
            activeRosterViewMode = 'roster-all';
            activeRosterSubMenu = currentSubSection || 'all';
        }

        ['roster-all', 'roster-personal', 'roster-daily'].forEach(mode => {
            const panel = document.getElementById(`roster-view-${mode.replace('roster-', '')}`);
            if (panel) {
                if (mode === activeRosterViewMode) { panel.classList.remove('hidden'); panel.classList.add('flex'); }
                else { panel.classList.add('hidden'); panel.classList.remove('flex'); }
            }
        });

        document.querySelectorAll('.roster-subtab-btn').forEach(btn => {
            const isAct = btn.getAttribute('data-roster-subtab') === activeRosterSubMenu;
            btn.className = isAct
                ? 'roster-subtab-btn shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all'
                : 'roster-subtab-btn shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all';
        });

        if (activeRosterViewMode === 'roster-personal') {
            if (typeof renderRosterPersonalCalendar === 'function') renderRosterPersonalCalendar();
        } else if (activeRosterViewMode === 'roster-daily') {
            if (typeof renderRosterDailyView === 'function') renderRosterDailyView();
        } else {
            renderRosterTable();
        }
    } else if (section === 'master') {
        ['manpower', 'jabatan', 'perusahaan', 'unit', 'kode-roster', 'kode-spi'].forEach(tab => {
            const el = document.getElementById(`master-tab-${tab}`);
            if (el) {
                if (tab === currentSubSection) { el.classList.remove('hidden'); el.classList.add('flex'); }
                else { el.classList.add('hidden'); el.classList.remove('flex'); }
            }
        });
        document.querySelectorAll('.master-subtab-btn').forEach(btn => {
            const isAct = btn.getAttribute('data-master-tab') === currentSubSection;
            btn.className = isAct
                ? 'master-subtab-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all inline-flex items-center gap-1.5'
                : 'master-subtab-btn px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all inline-flex items-center gap-1.5';
        });
        renderMasterDataSection(currentSubSection);
    } else if (section === 'searching') {
        if (typeof renderGlobalSearchSection === 'function') renderGlobalSearchSection();
    } else if (section === 'profil') {
        if (typeof renderProfilSection === 'function') renderProfilSection();
    }

    // 3. Perbarui styling aktif tombol Sidebar Utama
    document.querySelectorAll('.nav-sidebar-item').forEach(btn => {
        const isActive = btn.id === `sidebar-btn-${section}`;
        btn.classList.remove('bg-teal-500', 'text-white', 'shadow-sm', 'shadow-teal-500/25', 'font-semibold', 'text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900', 'font-medium');
        if (isActive) {
            btn.classList.add('bg-teal-500', 'text-white', 'shadow-sm', 'shadow-teal-500/25', 'font-semibold');
        } else {
            btn.classList.add('text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900', 'font-medium');
        }
    });

    // 4. Perbarui styling aktif Submenu Sidebar
    const updateSubButtons = (selector, attr, activeKey) => {
        document.querySelectorAll(selector).forEach(btn => {
            const isAct = btn.getAttribute(attr) === activeKey;
            const dot = btn.querySelector('span > span:first-child');
            btn.classList.remove('font-semibold', 'text-teal-600', 'bg-teal-50', 'font-medium', 'text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900');
            if (isAct) {
                btn.classList.add('font-semibold', 'text-teal-600', 'bg-teal-50');
                if (dot) { dot.classList.remove('bg-gray-300'); dot.classList.add('bg-teal-500'); }
            } else {
                btn.classList.add('font-medium', 'text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900');
                if (dot) { dot.classList.remove('bg-teal-500'); dot.classList.add('bg-gray-300'); }
            }
        });
    };
    updateSubButtons('.subnav-item', 'data-subnav', section === 'dashboard' ? currentSubSection : '');
    updateSubButtons('.subnav-performa-item', 'data-subnav-performa', section === 'performa' ? currentSubSection : '');
    updateSubButtons('.subnav-utilitas-item', 'data-subnav-utilitas', section === 'utilitas' ? currentSubSection : '');
    updateSubButtons('.subnav-operasional-item', 'data-subnav-operasional', section === 'operasional' ? currentSubSection : '');
    updateSubButtons('.subnav-roster-item', 'data-subnav-roster', section === 'roster' ? activeRosterViewMode : '');

    // 5. Perbarui Mobile Bottom Navigation & Tombol Drawer Sub-Menu Pojok Kanan Atas
    if (typeof updateMobileNavigationUi === 'function') {
        updateMobileNavigationUi(section, currentSubSection);
    }

    // 6. Perbarui Judul & Subjudul Top Header
    const metaKey = currentSubSection ? `${section}:${currentSubSection}` : section;
    const meta = PAGE_META[metaKey] || PAGE_META[section] || { title: 'PANTAU SE', subtitle: '' };
    const titleEl = document.getElementById('header-page-title');
    const subEl = document.getElementById('header-page-subtitle');
    if (titleEl) {
        titleEl.textContent = (section === 'informasi' && activeInfoChatId !== null)
            ? 'Beranda — Obrolan'
            : meta.title;
    }
    if (subEl) subEl.textContent = meta.subtitle;

    // 7. Mode Hemat Egress: lazy-sync data grup section hanya saat dibuka
    if (typeof ensureSectionSyncedFromSupabase === 'function') {
        ensureSectionSyncedFromSupabase(section, currentSubSection);
    }
}
/* =====================================================================
 * 2. CHART.JS (BIG CRANE DONUT & BOOKING/KPI LINE) & FILTER DASHBOARD
 * ===================================================================== */
const CHART_DATASETS = {
    kpi: {
        labels: [],
        actual: [],
        target: [],
        actualLabel: 'Aktual KPI SE (%)',
        targetLabel: 'Target Minimum (%)'
    },
    booking: {
        labels: [],
        actual: [],
        target: [],
        actualLabel: 'Realisasi Job Lifting',
        targetLabel: 'Plan Job Lifting'
    }
};

function parseLooseDateIsoForKpi(rawStr) {
    const s = String(rawStr || '').trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return null;
}

function isDateWithinWeekObj(dateObj, weekObj) {
    if (!dateObj || isNaN(dateObj.getTime()) || !weekObj?.startDate || !weekObj?.endDate) return false;
    const t = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
    const s = new Date(weekObj.startDate.getFullYear(), weekObj.startDate.getMonth(), weekObj.startDate.getDate()).getTime();
    const e = new Date(weekObj.endDate.getFullYear(), weekObj.endDate.getMonth(), weekObj.endDate.getDate()).getTime();
    return t >= s && t <= e;
}

function computeKpiSeWeekMetrics(weekObjOrNum) {
    const allWeeks = typeof getAvailableCalendarWeeks === 'function' ? getAvailableCalendarWeeks() : [];
    const weekObj = (weekObjOrNum && typeof weekObjOrNum === 'object')
        ? weekObjOrNum
        : (allWeeks.find(w => w.weekNum === Number(weekObjOrNum)) || null);

    const ltWtList = (typeof window !== 'undefined' && Array.isArray(window.opsLtWtState)) ? window.opsLtWtState : [];
    const liftList = (typeof window !== 'undefined' && Array.isArray(window.opsLiftingState)) ? window.opsLiftingState : [];

    const weekLtWt = weekObj
        ? ltWtList.filter(r => isDateWithinWeekObj(parseLooseDateIsoForKpi(r.tglAction || r.timestamp), weekObj))
        : [];
    const weekLift = weekObj
        ? liftList.filter(r => isDateWithinWeekObj(parseLooseDateIsoForKpi(r.tglPelaksanaan || r.timestamp), weekObj))
        : [];

    const isDone = (st) => {
        const s = String(st || '').trim().toLowerCase();
        return s === 'done' || s === 'close' || s === 'closed' || s === 'selesai' || s === 'complete' || s === 'completed';
    };
    const calcPct = (arr) => arr.length ? Number(((arr.filter(r => isDone(r.status)).length / arr.length) * 100).toFixed(1)) : 0;

    const ltRows = weekLtWt.filter(r => {
        const j = String(r.jenisJob || '').toLowerCase();
        const a = String(r.armada || '').toLowerCase();
        return j.includes('lube') || j.includes('grease') || a.startsWith('lt');
    });
    const washRows = weekLtWt.filter(r => String(r.jenisJob || '').toLowerCase().includes('wash'));
    const wtRows = weekLtWt.filter(r => {
        const j = String(r.jenisJob || '').toLowerCase();
        const a = String(r.armada || '').toLowerCase();
        return (j.includes('water') || a.startsWith('wt')) && !j.includes('wash');
    });

    const lt = calcPct(ltRows);
    const wt = calcPct(wtRows);
    const wash = calcPct(washRows);

    // Hitung UA Unit Lifting aktual dari uaWeeklyUploadState atau hmUaRecordsState
    const liftingUnits = (Array.isArray(komisioningState) ? komisioningState : []).filter(u => u.kategori_unit === 'lifting');
    let ua = 0;
    if (weekObj && liftingUnits.length) {
        const uaVals = [];
        liftingUnits.forEach(u => {
            const uKey = normalizeUnitKey(u.no_unit);
            const rate = Number(u.hm_rate) > 0 ? Number(u.hm_rate) : 10;
            const wkRec = uaWeeklyUploadState[`${uKey}::${weekObj.key}`];
            if (wkRec && Number(wkRec.total) > 0) {
                const denom = Math.max(1, Number(wkRec.count || 1)) * rate;
                uaVals.push(Math.min(100, (Number(wkRec.total) / denom) * 100));
            } else {
                let sumDiff = 0;
                let shiftCnt = 0;
                Object.values(hmUaRecordsState).forEach(rec => {
                    if (normalizeUnitKey(rec.unit) !== uKey) return;
                    if (!isDateWithinWeekObj(parseLooseDateIsoForKpi(rec.date), weekObj)) return;
                    sumDiff += Number(rec.hm_diff || 0);
                    shiftCnt++;
                });
                if (shiftCnt > 0) {
                    uaVals.push(Math.min(100, (sumDiff / (shiftCnt * rate)) * 100));
                }
            }
        });
        if (uaVals.length) {
            ua = Number((uaVals.reduce((a, b) => a + b, 0) / uaVals.length).toFixed(1));
        }
    }

    const activeMetrics = [lt, wt, wash, ua].filter(v => v > 0);
    const avgKpi = activeMetrics.length
        ? Number((activeMetrics.reduce((a, b) => a + b, 0) / activeMetrics.length).toFixed(1))
        : 0;

    const planJobs = weekLift.length;
    const doneJobs = weekLift.filter(r => isDone(r.status)).length;
    const totalOpsJobs = weekLtWt.length + weekLift.length;

    const weekRentals = weekObj
        ? (Array.isArray(rentalBibState) ? rentalBibState : []).filter(r => isDateWithinWeekObj(parseLooseDateIsoForKpi(r.tanggal), weekObj))
        : [];
    const bibRequests = weekRentals.length + weekLift.length;

    // Donut Big Crane dari data aktual bigCraneTimeframeState pada bulan/tahun week terpilih
    let opCount = 0;
    let sbCount = 0;
    let mtCount = 0;
    if (weekObj && Array.isArray(bigCraneTimeframeState)) {
        const targetYear = weekObj.year;
        const targetMonths = Array.isArray(weekObj.months) ? weekObj.months : [weekObj.startDate.getMonth()];
        bigCraneTimeframeState.forEach(item => {
            if (Number(item.year) !== Number(targetYear) || !targetMonths.includes(Number(item.month))) return;
            Object.values(item.aktual || {}).forEach(code => {
                const c = String(code || '').toUpperCase();
                if (c === 'A') opCount++;
                else if (c === 'R') sbCount++;
                else if (c === 'C') mtCount++;
            });
            Object.values(item.planning || {}).forEach(code => {
                const c = String(code || '').toUpperCase();
                if (c === 'P') sbCount++;
            });
        });
    }

    const todayIso = getTodayISO();
    const operatingUnitsToday = new Set();
    Object.values(hmUaRecordsState).forEach(rec => {
        if (rec.date === todayIso) operatingUnitsToday.add(normalizeUnitKey(rec.unit));
    });
    const standbyUnits = Math.max(0, (Array.isArray(komisioningState) ? komisioningState.length : 0) - operatingUnitsToday.size);

    return {
        lt, wt, wash, ua, avgKpi,
        jobs: totalOpsJobs,
        liftPlan: planJobs,
        liftDone: doneJobs,
        bibRequests,
        standbyUnits,
        donut: [opCount, sbCount, mtCount]
    };
}

function updateKpiCardTrend(valId, prevId, trendId, currVal, prevVal) {
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt(valId, `${currVal.toFixed(1)}%`);
    setTxt(prevId, `${prevVal.toFixed(1)}%`);
    const diff = Number((currVal - prevVal).toFixed(1));
    const trendEl = document.getElementById(trendId);
    if (!trendEl) return;
    if (currVal === 0 && prevVal === 0) {
        trendEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-500';
        trendEl.innerHTML = '0.0%';
        return;
    }
    const isUp = diff >= 0;
    trendEl.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold ${isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`;
    trendEl.innerHTML = `<i class="fa-solid ${isUp ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i> ${isUp ? '+' : ''}${diff.toFixed(1)}%`;
}

function syncKpiSeWeeklyDatasets(selectedWeekKey) {
    const allWeeks = typeof getAvailableCalendarWeeks === 'function' ? getAvailableCalendarWeeks() : [];
    const currInfo = typeof getCurrentCalendarWeekInfo === 'function' ? getCurrentCalendarWeekInfo() : null;
    let idx = allWeeks.findIndex(w => w.key === selectedWeekKey);
    if (idx < 0) idx = allWeeks.length - 1;
    const selectedWeek = allWeeks[idx] || currInfo || { key: '', weekNum: 1, label: 'Week 1', shortRange: '' };

    const windowWeeks = allWeeks.length
        ? allWeeks.slice(Math.max(0, idx - 7), idx + 1)
        : [];

    const labels = windowWeeks.map(w => `W${w.weekNum}`);
    const weekMetrics = windowWeeks.map(w => computeKpiSeWeekMetrics(w));
    const kpiActual = weekMetrics.map(m => m.avgKpi);
    const kpiTarget = windowWeeks.map(() => 88);
    const bookActual = weekMetrics.map(m => m.liftDone);
    const bookTarget = weekMetrics.map(m => m.liftPlan);

    CHART_DATASETS.kpi.labels = labels;
    CHART_DATASETS.kpi.actual = kpiActual;
    CHART_DATASETS.kpi.target = kpiTarget;
    CHART_DATASETS.booking.labels = labels;
    CHART_DATASETS.booking.actual = bookActual;
    CHART_DATASETS.booking.target = bookTarget;

    return { selectedWeek, currWeek: currInfo, labels, kpiActual, allWeeks, idx };
}

function initCharts() {
    if (typeof Chart === 'undefined') return;
    const weekKey = document.getElementById('filter-kpi-se-week')?.value || '';
    syncKpiSeWeeklyDatasets(weekKey);

    const donutCanvas = document.getElementById('bigCraneDonutChart');
    if (donutCanvas) {
        if (bigCraneChartInstance) bigCraneChartInstance.destroy();
        bigCraneChartInstance = new Chart(donutCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Operasi (OP)', 'Standby / Plan (SB)', 'Cancel / MT'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#1B7361', '#D9822B', '#C94A4A'],
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#3B4F4B', usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 10 } }
                    }
                }
            }
        });
    }

    const lineCanvas = document.getElementById('bookingPerformanceLineChart');
    if (lineCanvas) {
        if (bookingLineChartInstance) bookingLineChartInstance.destroy();
        const ds = CHART_DATASETS[activeLineChartMode] || CHART_DATASETS.kpi;
        bookingLineChartInstance = new Chart(lineCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: ds.labels,
                datasets: [
                    {
                        label: ds.actualLabel,
                        data: ds.actual,
                        borderColor: '#1B7361',
                        backgroundColor: 'rgba(27, 115, 97, 0.16)',
                        fill: true,
                        tension: 0.35,
                        borderWidth: 2.5,
                        pointRadius: 3.5,
                        pointBackgroundColor: '#155E4F'
                    },
                    {
                        label: ds.targetLabel,
                        data: ds.target,
                        borderColor: '#7A908B',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.1,
                        borderWidth: 1.5,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { color: '#3B4F4B', usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 10 } }
                    }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(15, 76, 65, 0.08)' }, ticks: { color: '#4E5E5A', font: { family: 'Inter', size: 10 } } },
                    x: { grid: { display: false }, ticks: { color: '#4E5E5A', font: { family: 'Inter', size: 10 } } }
                }
            }
        });
    }
    applyDashboardFilters(true);
}

function switchLineChartDataset(mode) {
    activeLineChartMode = mode === 'booking' ? 'booking' : 'kpi';
    const kpiTab = document.getElementById('chart-tab-kpi');
    const bookTab = document.getElementById('chart-tab-booking');
    if (kpiTab && bookTab) {
        const actCls = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all';
        const inactCls = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all';
        kpiTab.className = activeLineChartMode === 'kpi' ? actCls : inactCls;
        bookTab.className = activeLineChartMode === 'booking' ? actCls : inactCls;
    }
    if (!bookingLineChartInstance) {
        initCharts();
        return;
    }
    const ds = CHART_DATASETS[activeLineChartMode];
    bookingLineChartInstance.data.labels = ds.labels;
    bookingLineChartInstance.data.datasets[0].label = ds.actualLabel;
    bookingLineChartInstance.data.datasets[0].data = ds.actual;
    bookingLineChartInstance.data.datasets[1].label = ds.targetLabel;
    bookingLineChartInstance.data.datasets[1].data = ds.target;
    bookingLineChartInstance.update();
}

function applyDashboardFilters(silent = false) {
    const weekSel = document.getElementById('filter-kpi-se-week');
    if (weekSel && weekSel.options.length === 0 && typeof populateKpiWeekFilters === 'function') {
        populateKpiWeekFilters();
    }
    const weekKey = weekSel?.value || '';
    const { selectedWeek, currWeek, labels, kpiActual, allWeeks, idx } = syncKpiSeWeeklyDatasets(weekKey);
    const prevWeekObj = (idx > 0 && allWeeks[idx - 1]) ? allWeeks[idx - 1] : null;
    const currMetrics = computeKpiSeWeekMetrics(selectedWeek);
    const prevMetrics = prevWeekObj ? computeKpiSeWeekMetrics(prevWeekObj) : { lt: 0, wt: 0, wash: 0, ua: 0 };

    updateKpiCardTrend('kpi-lt-val', 'kpi-lt-prev', 'kpi-lt-trend', currMetrics.lt, prevMetrics.lt);
    updateKpiCardTrend('kpi-wt-val', 'kpi-wt-prev', 'kpi-wt-trend', currMetrics.wt, prevMetrics.wt);
    updateKpiCardTrend('kpi-wash-val', 'kpi-wash-prev', 'kpi-wash-trend', currMetrics.wash, prevMetrics.wash);
    updateKpiCardTrend('kpi-ua-val', 'kpi-ua-prev', 'kpi-ua-trend', currMetrics.ua, prevMetrics.ua);

    const jobEl = document.getElementById('overview-job-count');
    if (jobEl) jobEl.textContent = String(currMetrics.jobs);
    const bibEl = document.getElementById('overview-bib-count');
    if (bibEl) bibEl.textContent = String(currMetrics.bibRequests);
    const sbEl = document.getElementById('overview-standby-count');
    if (sbEl) sbEl.textContent = String(currMetrics.standbyUnits);

    const badgeEl = document.getElementById('kpi-se-live-badge');
    if (badgeEl) {
        const isCurrent = currWeek && selectedWeek.key === currWeek.key;
        badgeEl.textContent = isCurrent ? `W${selectedWeek.weekNum} • MTD` : `W${selectedWeek.weekNum}`;
    }

    const nonZeroVals = kpiActual.filter(v => v > 0);
    const avgEl = document.getElementById('kpi-insight-avg');
    const bestEl = document.getElementById('kpi-insight-best');
    if (nonZeroVals.length > 0) {
        const avg = nonZeroVals.reduce((a, b) => a + b, 0) / nonZeroVals.length;
        let bestIdx = 0;
        kpiActual.forEach((v, i) => { if (v > kpiActual[bestIdx]) bestIdx = i; });
        if (avgEl) {
            const above = avg >= 88;
            avgEl.innerHTML = `${avg.toFixed(1)}% <span class="text-[8px] font-normal ${above ? 'text-emerald-600' : 'text-red-600'}">(${above ? 'Di atas target' : 'Di bawah target'})</span>`;
        }
        if (bestEl) bestEl.textContent = `${labels[bestIdx]} (${kpiActual[bestIdx].toFixed(1)}%)`;
    } else {
        if (avgEl) avgEl.innerHTML = '0.0% <span class="text-[8px] font-normal text-gray-400">(Belum ada data)</span>';
        if (bestEl) bestEl.textContent = '-';
    }

    if (bigCraneChartInstance) {
        bigCraneChartInstance.data.datasets[0].data = currMetrics.donut;
        bigCraneChartInstance.update();
    }
    if (bookingLineChartInstance) {
        const ds = CHART_DATASETS[activeLineChartMode] || CHART_DATASETS.kpi;
        bookingLineChartInstance.data.labels = ds.labels;
        bookingLineChartInstance.data.datasets[0].label = ds.actualLabel;
        bookingLineChartInstance.data.datasets[0].data = ds.actual;
        bookingLineChartInstance.data.datasets[1].label = ds.targetLabel;
        bookingLineChartInstance.data.datasets[1].data = ds.target;
        bookingLineChartInstance.update();
    }

    if (!silent) {
        showToast(`Filter Dashboard KPI SE diterapkan (${selectedWeek.label}${selectedWeek.shortRange ? ` • ${selectedWeek.shortRange}` : ''}).`, 'info');
    }
}

function resetDashboardFilters() {
    const weekSel = document.getElementById('filter-kpi-se-week');
    if (weekSel && typeof getCurrentCalendarWeekInfo === 'function') {
        const currKey = getCurrentCalendarWeekInfo().key;
        if (Array.from(weekSel.options).some(o => o.value === currKey)) {
            weekSel.value = currKey;
        }
    }
    applyDashboardFilters(false);
}

/* =====================================================================
 * 5. DATA KOMISIONING UNIT, HM & UA, RENTAL BIB, & TIME FRAME BIG CRANE
 * ===================================================================== */
function normalizeUnitKey(unitStr) {
    return String(unitStr || '').trim().toUpperCase().replace(/[\s\-_]+/g, '');
}

function seedInitialHmUaData() {
    hmUaHistorySeeded = true;
}

let activeHmUaSubView = 'hm';

function getHmUaModeLabel(mode) {
    if (mode === 'ua') return 'UA Unit';
    if (mode === 'ua-weekly') return 'UA Weekly';
    if (mode === 'ua-mtd') return 'UA MTD';
    return 'HM Daily';
}

function switchHmUaSubView(view) {
    if (view === 'upload') {
        openHmUaUploadModal();
        return;
    }
    const views = ['hm', 'ua', 'ua-weekly', 'ua-mtd'];
    activeHmUaSubView = views.includes(view) ? view : 'hm';
    const activeBtn = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all inline-flex items-center gap-1.5';
    const inactiveBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all inline-flex items-center gap-1.5';

    views.forEach(v => {
        const panel = document.getElementById(`hmua-view-${v}`);
        const btn = document.getElementById(`btn-hmua-view-${v}`);
        if (panel) {
            if (v === activeHmUaSubView) { panel.classList.remove('hidden'); panel.classList.add('flex'); }
            else { panel.classList.add('hidden'); panel.classList.remove('flex'); }
        }
        if (btn) btn.className = v === activeHmUaSubView ? activeBtn : inactiveBtn;
    });

    const openLabel = document.getElementById('btn-hmua-open-upload-label');
    if (openLabel) openLabel.textContent = `Upload ${getHmUaModeLabel(activeHmUaSubView)}`;

    if (activeHmUaSubView === 'hm' || activeHmUaSubView === 'ua') renderHmUaTables();
    if (activeHmUaSubView === 'ua-weekly') renderUaWeeklyTable();
    if (activeHmUaSubView === 'ua-mtd') renderUaMtdTable();
}

function openHmUaUploadModal() {
    const modeEl = document.getElementById('hmua-upload-mode');
    if (modeEl) modeEl.value = activeHmUaSubView || 'hm';

    // Sinkronkan periode target dari filter menu yang sedang aktif
    const uploadMonth = document.getElementById('hmua-upload-month');
    const uploadYear = document.getElementById('hmua-upload-year');
    if (activeHmUaSubView === 'ua-weekly') {
        const mVal = document.getElementById('ua-weekly-month')?.value;
        const yVal = document.getElementById('ua-weekly-year')?.value;
        if (uploadMonth && mVal && mVal !== 'all') uploadMonth.value = mVal;
        if (uploadYear && yVal) uploadYear.value = yVal;
    } else if (activeHmUaSubView === 'ua-mtd') {
        const mVal = document.getElementById('ua-mtd-month')?.value;
        const yVal = document.getElementById('ua-mtd-year')?.value;
        if (uploadMonth && mVal && mVal !== 'all') uploadMonth.value = mVal;
        if (uploadYear && yVal) uploadYear.value = yVal;
    }

    resetHmUaUploadState();
    populateHmUaUploadWeekOptions();
    toggleHmUaUploadTargetFields();
    const modal = document.getElementById('modal-hmua-upload');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeHmUaUploadModal() {
    const modal = document.getElementById('modal-hmua-upload');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function toggleHmUnitSort(column) {
    if (hmUnitSortState.column !== column) {
        hmUnitSortState = { column, direction: 'desc' };
    } else if (hmUnitSortState.direction === 'desc') {
        hmUnitSortState.direction = 'asc';
    } else {
        hmUnitSortState = { column: null, direction: 'none' };
    }
    document.querySelectorAll('[data-hm-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-hm-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (hmUnitSortState.column === col && hmUnitSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (hmUnitSortState.column === col && hmUnitSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderHmUaTables();
}

function toggleUaUnitSort(column) {
    if (uaUnitSortState.column !== column) {
        uaUnitSortState = { column, direction: 'desc' };
    } else if (uaUnitSortState.direction === 'desc') {
        uaUnitSortState.direction = 'asc';
    } else {
        uaUnitSortState = { column: null, direction: 'none' };
    }
    document.querySelectorAll('[data-ua-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-ua-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (uaUnitSortState.column === col && uaUnitSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (uaUnitSortState.column === col && uaUnitSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderHmUaTables();
}

function resolveHmOperatorName(nrp, explicitOperator = '') {
    const cleanOp = String(explicitOperator || '').trim();
    if (cleanOp && cleanOp !== '-') return cleanOp;
    const cleanNrp = String(nrp || '').trim();
    if (!cleanNrp || cleanNrp === '-') return '-';
    const mp = manpowerState.find(m => String(m.nrp || '').trim() === cleanNrp);
    return mp ? mp.nama : cleanNrp;
}

function computeHmDeviationInfo(hmSs6, hmAktual) {
    const hasSs6 = hmSs6 !== null && hmSs6 !== undefined && !isNaN(Number(hmSs6));
    const hasAktual = hmAktual !== null && hmAktual !== undefined && !isNaN(Number(hmAktual));

    if (!hasAktual) {
        return {
            deviasi: null,
            statusKey: '',
            deviasiHtml: '<span class="font-mono text-gray-400">-</span>',
            statusHtml: '<span class="text-gray-400">-</span>'
        };
    }
    if (!hasSs6) {
        return {
            deviasi: null,
            statusKey: 'SS6 Kosong',
            deviasiHtml: '<span class="font-mono text-gray-400">-</span>',
            statusHtml: '<span class="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">SS6 Kosong</span>'
        };
    }

    const deviasi = Number((Number(hmAktual) - Number(hmSs6)).toFixed(2));
    if (Math.abs(deviasi) < 0.005) {
        return {
            deviasi: 0,
            statusKey: 'Sesuai',
            deviasiHtml: '<span class="font-mono text-emerald-700 font-semibold">0.00</span>',
            statusHtml: '<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Sesuai</span>'
        };
    }

    const sign = deviasi > 0 ? '+' : '';
    const label = `Selisih (${sign}${deviasi.toFixed(2)} Jam)`;
    return {
        deviasi,
        statusKey: label,
        deviasiHtml: `<span class="font-mono text-red-600 font-semibold">${sign}${deviasi.toFixed(2)}</span>`,
        statusHtml: `<span class="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">${label}</span>`
    };
}

function renderHmAktualDisplayHtml(recordKey, unit, dateIso, shift, rowUid, hmAktual) {
    const hasVal = hmAktual !== null && hmAktual !== undefined && !isNaN(Number(hmAktual));
    const label = hasVal
        ? Number(hmAktual).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '-';
    const cls = hasVal
        ? 'font-mono text-gray-800 hover:text-teal-700 hover:underline'
        : 'font-mono text-gray-400 hover:text-teal-600';
    return `
                <button
                    type="button"
                    onclick="startEditHmAktualCell('${escapeJsString(recordKey)}', '${escapeJsString(unit)}', '${escapeJsString(dateIso)}', '${escapeJsString(shift)}', '${rowUid}')"
                    title="${hasVal ? 'Klik angka untuk edit HM Awal Aktual' : 'Klik untuk isi HM Awal Aktual secara manual'}"
                    class="inline-flex items-center min-w-[44px] py-0.5 rounded px-1.5 -mx-1.5 hover:bg-teal-50 transition-colors cursor-pointer ${cls}"
                >${label}</button>
            `;
}

function startEditHmAktualCell(recordKey, unit, dateIso, shift, rowUid) {
    const cellEl = document.getElementById(`hm-act-cell-${rowUid}`);
    if (!cellEl) return;

    const existingVal = hmUaRecordsState[recordKey]?.hm_aktual;
    const prevAttr = (existingVal !== null && existingVal !== undefined && !isNaN(Number(existingVal)))
        ? Number(existingVal).toFixed(2)
        : '';

    cellEl.innerHTML = `
                <input
                    id="hm-act-input-${rowUid}"
                    type="number"
                    step="0.01"
                    data-prev-val="${prevAttr}"
                    value="${prevAttr}"
                    placeholder="0.00"
                    oninput="updateHmAktualManual('${escapeJsString(recordKey)}', '${escapeJsString(unit)}', '${escapeJsString(dateIso)}', '${escapeJsString(shift)}', this.value, '${rowUid}')"
                    onkeydown="handleHmAktualKeydown(event, '${escapeJsString(recordKey)}', '${escapeJsString(unit)}', '${escapeJsString(dateIso)}', '${escapeJsString(shift)}', '${rowUid}')"
                    onblur="commitHmAktualEdit('${escapeJsString(recordKey)}', '${escapeJsString(unit)}', '${escapeJsString(dateIso)}', '${escapeJsString(shift)}', '${rowUid}')"
                    class="w-28 px-2 py-0.5 rounded-lg border border-teal-400 bg-white font-mono text-[10px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
            `;
    const inputEl = document.getElementById(`hm-act-input-${rowUid}`);
    if (inputEl) {
        inputEl.focus();
        inputEl.select();
    }
}

function handleHmAktualKeydown(event, recordKey, unit, dateIso, shift, rowUid) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target?.blur();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        const inputEl = document.getElementById(`hm-act-input-${rowUid}`);
        const prevVal = inputEl ? inputEl.getAttribute('data-prev-val') : '';
        if (inputEl) inputEl.dataset.cancelled = '1';
        updateHmAktualManual(recordKey, unit, dateIso, shift, prevVal, rowUid);
        const cellEl = document.getElementById(`hm-act-cell-${rowUid}`);
        if (cellEl) {
            const hmAktual = hmUaRecordsState[recordKey]?.hm_aktual ?? null;
            cellEl.innerHTML = renderHmAktualDisplayHtml(recordKey, unit, dateIso, shift, rowUid, hmAktual);
        }
    }
}

function commitHmAktualEdit(recordKey, unit, dateIso, shift, rowUid) {
    const inputEl = document.getElementById(`hm-act-input-${rowUid}`);
    if (!inputEl || inputEl.dataset.cancelled === '1') return;
    updateHmAktualManual(recordKey, unit, dateIso, shift, inputEl.value, rowUid);
    const cellEl = document.getElementById(`hm-act-cell-${rowUid}`);
    if (cellEl) {
        const hmAktual = hmUaRecordsState[recordKey]?.hm_aktual ?? null;
        cellEl.innerHTML = renderHmAktualDisplayHtml(recordKey, unit, dateIso, shift, rowUid, hmAktual);
    }
}

function updateHmAktualManual(recordKey, unit, dateIso, shift, rawValue, rowUid) {
    const cleaned = String(rawValue ?? '').trim().replace(/,/g, '.');
    const parsed = cleaned === '' ? null : parseFloat(cleaned);
    const hmAktual = (parsed !== null && !isNaN(parsed)) ? Number(parsed.toFixed(2)) : null;

    if (!hmUaRecordsState[recordKey]) {
        hmUaRecordsState[recordKey] = {
            unit,
            date: dateIso,
            shift: shift || '-',
            nrp: '-',
            operator: '',
            hm_start: null,
            hm_stop: null,
            hm_diff: null,
            hm_aktual: hmAktual
        };
    } else {
        hmUaRecordsState[recordKey].hm_aktual = hmAktual;
    }

    const rec = hmUaRecordsState[recordKey];
    const info = computeHmDeviationInfo(rec.hm_start, rec.hm_aktual);
    const devEl = document.getElementById(`hm-dev-${rowUid}`);
    const stEl = document.getElementById(`hm-stat-${rowUid}`);
    if (devEl) devEl.innerHTML = info.deviasiHtml;
    if (stEl) stEl.innerHTML = info.statusHtml;
}

function getUnitCategoryGroup(noUnit, modelTipe = '', explicitCat = '') {
    if (explicitCat === 'lt_wt' || explicitCat === 'lifting') return explicitCat;
    const unitObj = komisioningState.find(u => normalizeUnitKey(u.no_unit) === normalizeUnitKey(noUnit));
    if (unitObj && (unitObj.kategori_unit === 'lt_wt' || unitObj.kategori_unit === 'lifting')) {
        return unitObj.kategori_unit;
    }
    const u = String(noUnit || '').trim().toUpperCase();
    const m = String(modelTipe || '').trim().toUpperCase();
    const isLtOrWt = /^(LT|WT)([\s\-_0-9]|$)/.test(u) || m.includes('LUBE TRUCK') || m.includes('WATER TRUCK') || /\b(LT|WT)\b/.test(m);
    return isLtOrWt ? 'lt_wt' : 'lifting';
}

/**
 * Merender tabel HM Unit dan UA Unit secara realtime mengambil daftar patokan unit dari komisioningState.
 */
function renderHmUaTables() {
    seedInitialHmUaData();

    const dateInput = document.getElementById('hmua-filter-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = getTodayISO();
    }
    const activeDateIso = dateInput?.value || getTodayISO();
    const activeDateLabel = formatDateID(activeDateIso);

    const countBadge = document.getElementById('hmua-unit-count');
    const hmDateEl = document.getElementById('hm-unit-date-label');
    const uaDateEl = document.getElementById('ua-unit-date-label');
    if (countBadge) countBadge.textContent = `Total Unit: ${komisioningState.length}`;
    if (hmDateEl) hmDateEl.textContent = activeDateLabel;
    if (uaDateEl) uaDateEl.textContent = activeDateLabel;

    // Bangun daftar baris untuk tanggal aktif berbasis patokan unit dari komisioningState
    const buildRowsForView = (searchId, shiftId, categoryId) => {
        const query = (document.getElementById(searchId)?.value || '').trim().toLowerCase();
        const shiftFilter = document.getElementById(shiftId)?.value || 'all';
        const categoryFilter = document.getElementById(categoryId)?.value || 'all';
        const result = [];

        komisioningState.forEach(unit => {
            if (categoryFilter !== 'all' && getUnitCategoryGroup(unit.no_unit, unit.model_tipe) !== categoryFilter) {
                return;
            }
            const uKey = normalizeUnitKey(unit.no_unit);
            const matchingRecords = Object.entries(hmUaRecordsState)
                .filter(([, r]) => normalizeUnitKey(r.unit) === uKey && r.date === activeDateIso);

            if (matchingRecords.length > 0) {
                matchingRecords.forEach(([recKey, rec]) => {
                    const operator = resolveHmOperatorName(rec.nrp, rec.operator);
                    const hmAktual = rec.hm_aktual ?? null;
                    const devInfo = computeHmDeviationInfo(rec.hm_start, hmAktual);
                    result.push({
                        recordKey: recKey,
                        unit: unit.no_unit,
                        model_tipe: unit.model_tipe,
                        operator,
                        tanggal: rec.date,
                        tanggalText: formatDateID(rec.date),
                        shift: rec.shift,
                        nrp: rec.nrp || '-',
                        hm_start: rec.hm_start,
                        hm_stop: rec.hm_stop,
                        hm_diff: rec.hm_diff,
                        hm_aktual: hmAktual,
                        deviasi: devInfo.deviasi,
                        status: devInfo.statusKey,
                        devInfo
                    });
                });
            } else {
                const fallbackKey = `${uKey}::${activeDateIso}::-`;
                const devInfo = computeHmDeviationInfo(null, null);
                result.push({
                    recordKey: fallbackKey,
                    unit: unit.no_unit,
                    model_tipe: unit.model_tipe,
                    operator: '-',
                    tanggal: activeDateIso,
                    tanggalText: activeDateLabel,
                    shift: '-',
                    nrp: '-',
                    hm_start: null,
                    hm_stop: null,
                    hm_diff: null,
                    hm_aktual: null,
                    deviasi: null,
                    status: '',
                    devInfo
                });
            }
        });

        return result.filter(row => {
            if (shiftFilter !== 'all' && row.shift !== shiftFilter) return false;
            if (query) {
                const shiftText = row.shift === 'D' ? 'shift 1' : (row.shift === 'N' ? 'shift 2' : '');
                const hay = `${row.unit} ${row.model_tipe} ${row.operator} ${row.tanggalText} ${row.shift} ${shiftText} ${row.nrp} ${row.hm_start ?? ''} ${row.hm_aktual ?? ''} ${row.hm_diff ?? ''} ${row.status}`.toLowerCase();
                if (!hay.includes(query)) return false;
            }
            return true;
        });
    };

    const renderShiftBadge = (sh) => {
        if (sh === 'D') return '<span class="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Shift 1</span>';
        if (sh === 'N') return '<span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Shift 2</span>';
        return '<span class="text-gray-400">-</span>';
    };

    // 1. Render HM Unit (Unit, Operator, Tgl, Shift, HM Awal SS6, HM Awal Aktual, Deviasi, Status)
    const hmTbody = document.getElementById('hm-unit-tbody');
    if (hmTbody) {
        let hmRows = buildRowsForView('hm-unit-search', 'hm-unit-shift-filter', 'hm-unit-category-filter');
        if (hmUnitSortState.column && hmUnitSortState.direction !== 'none') {
            const col = hmUnitSortState.column;
            const dir = hmUnitSortState.direction === 'asc' ? 1 : -1;
            hmRows.sort((a, b) => {
                if (col === 'hm_start' || col === 'hm_aktual' || col === 'deviasi') {
                    return ((a[col] ?? -999999) - (b[col] ?? -999999)) * dir;
                }
                return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
            });
        }

        if (hmRows.length === 0) {
            hmTbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-xs text-gray-400">Tidak ada data HM Daily yang cocok.</td></tr>';
        } else {
            hmTbody.innerHTML = hmRows.map((r, idx) => {
                const rowUid = `hmr-${idx}`;
                const opSubNrp = (r.nrp && r.nrp !== '-' && r.operator !== r.nrp)
                    ? `<p class="font-mono text-[9px] text-gray-400 mt-0.5">${escapeHtml(r.nrp)}</p>`
                    : '';
                const ss6Display = r.hm_start !== null
                    ? Number(r.hm_start).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '-';

                return `
                            <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                                <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(r.unit)}</td>
                                <td class="py-3 px-4 whitespace-nowrap">
                                    <p class="text-gray-800">${escapeHtml(r.operator)}</p>
                                    ${opSubNrp}
                                </td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.tanggalText)}</td>
                                <td class="py-3 px-4 whitespace-nowrap">${renderShiftBadge(r.shift)}</td>
                                <td class="py-3 px-4 font-mono ${r.hm_start !== null ? 'text-gray-800' : 'text-gray-400'} whitespace-nowrap">${ss6Display}</td>
                                <td id="hm-act-cell-${rowUid}" class="py-3 px-4 whitespace-nowrap">${renderHmAktualDisplayHtml(r.recordKey, r.unit, r.tanggal, r.shift, rowUid, r.hm_aktual)}</td>
                                <td id="hm-dev-${rowUid}" class="py-3 px-4 whitespace-nowrap">${r.devInfo.deviasiHtml}</td>
                                <td id="hm-stat-${rowUid}" class="py-3 px-4 whitespace-nowrap">${r.devInfo.statusHtml}</td>
                            </tr>
                        `;
            }).join('');
        }
    }

    // 2. Render UA Unit Daily (Unit, Model/Tipe, Tanggal, Shift 1, Shift 2, Target HM dari Master Data, Deviasi)
    const uaTbody = document.getElementById('ua-unit-tbody');
    if (uaTbody) {
        const uaQuery = (document.getElementById('ua-unit-search')?.value || '').trim().toLowerCase();
        const uaCatFilter = document.getElementById('ua-unit-category-filter')?.value || 'all';

        let uaRows = komisioningState
            .filter(unit => uaCatFilter === 'all' || getUnitCategoryGroup(unit.no_unit, unit.model_tipe, unit.kategori_unit) === uaCatFilter)
            .map(unit => {
                const unitTargetHm = (unit.hm_rate !== undefined && unit.hm_rate !== null && !isNaN(Number(unit.hm_rate)))
                    ? Number(unit.hm_rate)
                    : 10.0;
                const uKey = normalizeUnitKey(unit.no_unit);
                const dayRecs = Object.values(hmUaRecordsState).filter(r =>
                    normalizeUnitKey(r.unit) === uKey && r.date === activeDateIso
                );

                let shift1Total = null;
                let shift2Total = null;
                dayRecs.forEach(rec => {
                    if (rec.hm_diff === null || rec.hm_diff === undefined || isNaN(Number(rec.hm_diff))) return;
                    const val = Number(rec.hm_diff);
                    if (rec.shift === 'D') shift1Total = Number(((shift1Total ?? 0) + val).toFixed(2));
                    else if (rec.shift === 'N') shift2Total = Number(((shift2Total ?? 0) + val).toFixed(2));
                });

                const hasAnyShift = shift1Total !== null || shift2Total !== null;
                const totalHm = hasAnyShift ? Number(((shift1Total ?? 0) + (shift2Total ?? 0)).toFixed(2)) : null;
                const deviasi = totalHm !== null ? Number((totalHm - unitTargetHm).toFixed(2)) : null;

                return {
                    unit: unit.no_unit,
                    model_tipe: unit.model_tipe || '-',
                    tanggal: activeDateIso,
                    tanggalText: activeDateLabel,
                    shift1: shift1Total,
                    shift2: shift2Total,
                    target_hm: unitTargetHm,
                    total_hm: totalHm,
                    deviasi
                };
            })
            .filter(row => {
                if (uaQuery) {
                    const hay = `${row.unit} ${row.model_tipe} ${row.tanggalText} ${row.shift1 ?? ''} ${row.shift2 ?? ''} ${row.deviasi ?? ''}`.toLowerCase();
                    if (!hay.includes(uaQuery)) return false;
                }
                return true;
            });

        if (uaUnitSortState.column && uaUnitSortState.direction !== 'none') {
            const col = uaUnitSortState.column;
            const dir = uaUnitSortState.direction === 'asc' ? 1 : -1;
            uaRows.sort((a, b) => {
                if (col === 'shift1' || col === 'shift2' || col === 'target_hm') {
                    return ((a[col] ?? -1) - (b[col] ?? -1)) * dir;
                }
                if (col === 'deviasi') {
                    return ((a.deviasi ?? -999999) - (b.deviasi ?? -999999)) * dir;
                }
                return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
            });
        }

        if (uaRows.length === 0) {
            uaTbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Tidak ada data UA Unit yang cocok.</td></tr>';
        } else {
            uaTbody.innerHTML = uaRows.map(r => {
                const s1Html = r.shift1 !== null
                    ? `<span class="font-mono font-semibold text-teal-700">${r.shift1.toFixed(2)} Jam</span>`
                    : '<span class="font-mono text-gray-400">-</span>';
                const s2Html = r.shift2 !== null
                    ? `<span class="font-mono font-semibold text-indigo-700">${r.shift2.toFixed(2)} Jam</span>`
                    : '<span class="font-mono text-gray-400">-</span>';

                let devHtml = '<span class="font-mono text-gray-400">-</span>';
                if (r.deviasi !== null) {
                    const isOnTarget = r.deviasi >= 0;
                    const sign = r.deviasi > 0 ? '+' : '';
                    const badgeCls = isOnTarget
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700';
                    devHtml = `<span title="Total: ${r.total_hm.toFixed(2)} Jam | Target: ${r.target_hm.toFixed(2)} Jam" class="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono font-semibold ${badgeCls}">${sign}${r.deviasi.toFixed(2)} Jam</span>`;
                }

                return `
                            <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                                <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(r.unit)}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.model_tipe)}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.tanggalText)}</td>
                                <td class="py-3 px-4 whitespace-nowrap">${s1Html}</td>
                                <td class="py-3 px-4 whitespace-nowrap">${s2Html}</td>
                                <td class="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">${r.target_hm.toFixed(2)} Jam</td>
                                <td class="py-3 px-4 whitespace-nowrap">${devHtml}</td>
                            </tr>
                        `;
            }).join('');
        }
    }

    renderUaWeeklyTable();
    renderUaMtdTable();
}

function toggleUaMtdSort(column) {
    if (uaMtdSortState.column !== column) uaMtdSortState = { column, direction: 'desc' };
    else if (uaMtdSortState.direction === 'desc') uaMtdSortState.direction = 'asc';
    else uaMtdSortState = { column: null, direction: 'none' };
    renderUaMtdTable();
}

function renderUaMtdTable() {
    seedInitialHmUaData();
    const thead = document.getElementById('ua-mtd-thead');
    const tbody = document.getElementById('ua-mtd-tbody');
    const periodEl = document.getElementById('ua-mtd-period-label');
    if (!thead || !tbody) return;

    const query = (document.getElementById('ua-mtd-search')?.value || '').trim().toLowerCase();
    const monthIdx = parseInt(document.getElementById('ua-mtd-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('ua-mtd-year')?.value || '2026', 10);
    const categoryFilter = document.getElementById('ua-mtd-category-filter')?.value || 'all';

    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const todayObj = new Date(getTodayISO() + 'T00:00:00');
    let mtdDays = daysInMonth;
    if (year === todayObj.getFullYear() && monthIdx === todayObj.getMonth()) {
        mtdDays = Math.min(daysInMonth, todayObj.getDate());
    } else if (year > todayObj.getFullYear() || (year === todayObj.getFullYear() && monthIdx > todayObj.getMonth())) {
        mtdDays = 0;
    }

    if (periodEl) {
        const mShort = MONTH_SHORT_ID[monthIdx] || '';
        periodEl.textContent = mtdDays > 0
            ? `MTD: 1–${mtdDays} ${mShort} ${year} (${mtdDays} hari)`
            : `${MONTH_NAMES_ID[monthIdx] || ''} ${year} (Belum berjalan)`;
    }

    const getIconCls = (col) => {
        if (uaMtdSortState.column === col && uaMtdSortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (uaMtdSortState.column === col && uaMtdSortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };
    const sortTh = (col, label, align = 'left') => `
                <th onclick="toggleUaMtdSort('${col}')" class="py-3 px-4 font-normal cursor-pointer select-none hover:bg-gray-100/80 transition-colors whitespace-nowrap ${align === 'right' ? 'text-right' : (align === 'center' ? 'text-center' : '')}">
                    <div class="flex items-center ${align === 'center' ? 'justify-center' : 'justify-between'} gap-2"><span>${label}</span><i class="fa-solid ${getIconCls(col)} text-[9px]"></i></div>
                </th>
            `;

    thead.innerHTML = `
                <tr class="bg-gray-50/80 border-b border-gray-100 text-[10px] font-normal text-gray-600">
                    ${sortTh('unit', 'Unit')}
                    ${sortTh('model_tipe', 'Model / Tipe')}
                    ${sortTh('days_ops', 'Hari Operasi', 'center')}
                    ${sortTh('actual_mtd', 'Aktual HM (MTD)')}
                    ${sortTh('target_mtd', 'Target HM (MTD)')}
                    ${sortTh('deviasi', 'Deviasi (MTD)')}
                    ${sortTh('ach_pct', 'Capaian UA (%)')}
                </tr>
            `;

    const ymKey = `${year}-${monthIdx}`;
    let rows = komisioningState
        .filter(unit => {
            if (categoryFilter !== 'all' && getUnitCategoryGroup(unit.no_unit, unit.model_tipe, unit.kategori_unit) !== categoryFilter) {
                return false;
            }
            if (!query) return true;
            return `${unit.no_unit} ${unit.model_tipe || ''}`.toLowerCase().includes(query);
        })
        .map(unit => {
            const uKey = normalizeUnitKey(unit.no_unit);
            const dailyTarget = (unit.hm_rate !== undefined && unit.hm_rate !== null && !isNaN(Number(unit.hm_rate)))
                ? Number(unit.hm_rate)
                : 10.0;
            const targetMtd = Number((dailyTarget * mtdDays).toFixed(2));

            const overrideRec = uaMtdUploadState[`${uKey}::${ymKey}`];
            let actualMtd = 0;
            let opsDays = 0;
            let shiftCount = 0;
            let hasData = false;

            if (overrideRec) {
                actualMtd = Number(overrideRec.total || 0);
                opsDays = Number(overrideRec.days || 0);
                shiftCount = Number(overrideRec.shifts || 0);
                hasData = true;
            } else {
                const uniqueDays = new Set();
                Object.values(hmUaRecordsState).forEach(rec => {
                    if (normalizeUnitKey(rec.unit) !== uKey || !rec.date) return;
                    if (rec.hm_diff === null || rec.hm_diff === undefined || isNaN(Number(rec.hm_diff))) return;
                    const d = new Date(rec.date + 'T00:00:00');
                    if (isNaN(d.getTime())) return;
                    if (d.getFullYear() !== year || d.getMonth() !== monthIdx) return;
                    if (mtdDays > 0 && d.getDate() > mtdDays) return;
                    actualMtd += Number(rec.hm_diff);
                    uniqueDays.add(d.getDate());
                    shiftCount += 1;
                    hasData = true;
                });
                opsDays = uniqueDays.size;
            }

            actualMtd = Number(actualMtd.toFixed(2));
            const deviasi = hasData && targetMtd > 0 ? Number((actualMtd - targetMtd).toFixed(2)) : null;
            const achPct = hasData && targetMtd > 0 ? Number(((actualMtd / targetMtd) * 100).toFixed(1)) : null;

            return {
                unit: unit.no_unit,
                model_tipe: unit.model_tipe || '-',
                daily_target: dailyTarget,
                days_ops: opsDays,
                shifts: shiftCount,
                actual_mtd: hasData ? actualMtd : null,
                target_mtd: targetMtd,
                deviasi,
                ach_pct: achPct
            };
        });

    if (uaMtdSortState.column && uaMtdSortState.direction !== 'none') {
        const col = uaMtdSortState.column;
        const dir = uaMtdSortState.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (['days_ops', 'actual_mtd', 'target_mtd', 'deviasi', 'ach_pct'].includes(col)) {
                return ((a[col] ?? -999999) - (b[col] ?? -999999)) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Tidak ada data UA MTD yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(r => {
        const actualHtml = r.actual_mtd !== null
            ? `<span class="font-mono font-bold text-teal-700">${r.actual_mtd.toFixed(2)} Jam</span>`
            : '<span class="font-mono text-gray-400">-</span>';

        let devHtml = '<span class="font-mono text-gray-400">-</span>';
        if (r.deviasi !== null) {
            const isOk = r.deviasi >= 0;
            const sign = r.deviasi > 0 ? '+' : '';
            devHtml = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full font-mono font-semibold ${isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${sign}${r.deviasi.toFixed(2)} Jam</span>`;
        }

        let achHtml = '<span class="font-mono text-gray-400">-</span>';
        if (r.ach_pct !== null) {
            const pctColor = r.ach_pct >= 100 ? 'text-emerald-700' : (r.ach_pct >= 85 ? 'text-amber-700' : 'text-red-600');
            const barColor = r.ach_pct >= 100 ? 'bg-emerald-500' : (r.ach_pct >= 85 ? 'bg-amber-500' : 'bg-red-500');
            const barW = Math.max(0, Math.min(100, r.ach_pct));
            achHtml = `
                        <div class="flex items-center gap-2 min-w-[110px]">
                            <span class="font-mono font-bold ${pctColor} w-11">${r.ach_pct.toFixed(1)}%</span>
                            <div class="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div class="h-full rounded-full ${barColor}" style="width:${barW}%"></div>
                            </div>
                        </div>
                    `;
        }

        const opsLabel = r.actual_mtd !== null
            ? `<span class="font-mono font-semibold text-gray-800">${r.days_ops} hr</span><span class="text-[8.5px] text-gray-400 block">${r.shifts} shift</span>`
            : '<span class="text-gray-400">-</span>';

        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 font-mono font-semibold text-gray-800 whitespace-nowrap">${escapeHtml(r.unit)}</td>
                        <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.model_tipe)}</td>
                        <td class="py-3 px-4 text-center whitespace-nowrap">${opsLabel}</td>
                        <td class="py-3 px-4 whitespace-nowrap">${actualHtml}</td>
                        <td class="py-3 px-4 whitespace-nowrap">
                            <span class="font-mono text-gray-700">${r.target_mtd.toFixed(2)} Jam</span>
                            <span class="text-[8.5px] text-gray-400 block">${r.daily_target.toFixed(2)} Jam/hr</span>
                        </td>
                        <td class="py-3 px-4 whitespace-nowrap">${devHtml}</td>
                        <td class="py-3 px-4 whitespace-nowrap">${achHtml}</td>
                    </tr>
                `;
    }).join('');
}

function toggleUaWeeklySort(column) {
    if (uaWeeklySortState.column !== column) uaWeeklySortState = { column, direction: 'desc' };
    else if (uaWeeklySortState.direction === 'desc') uaWeeklySortState.direction = 'asc';
    else uaWeeklySortState = { column: null, direction: 'none' };
    renderUaWeeklyTable();
}
function renderUaWeeklyTable() {
    seedInitialHmUaData();
    const thead = document.getElementById('ua-weekly-thead');
    const tbody = document.getElementById('ua-weekly-tbody');
    if (!thead || !tbody) return;

    const query = (document.getElementById('ua-weekly-search')?.value || '').trim().toLowerCase();
    const monthFilter = document.getElementById('ua-weekly-month')?.value ?? '10';
    const year = parseInt(document.getElementById('ua-weekly-year')?.value || '2026', 10);
    const categoryFilter = document.getElementById('ua-weekly-category-filter')?.value || 'all';

    const allWeeks = getWeeksInYearSunSat(year);
    const weeks = monthFilter === 'all'
        ? allWeeks
        : allWeeks.filter(w => w.months.includes(parseInt(monthFilter, 10)));

    // Hitung agregasi HM Diff per unit per week (dari harian + override upload UA Weekly)
    const weeklyMap = {};
    Object.values(hmUaRecordsState).forEach(rec => {
        if (!rec.date || rec.hm_diff === null || rec.hm_diff === undefined || isNaN(Number(rec.hm_diff))) return;
        const recDate = new Date(rec.date + 'T00:00:00');
        if (isNaN(recDate.getTime()) || recDate.getFullYear() !== year) return;
        const wk = allWeeks.find(w => recDate >= w.startDate && recDate <= w.endDate);
        if (!wk) return;
        const aggKey = `${normalizeUnitKey(rec.unit)}::${wk.key}`;
        if (!weeklyMap[aggKey]) weeklyMap[aggKey] = { total: 0, count: 0 };
        weeklyMap[aggKey].total += Number(rec.hm_diff);
        weeklyMap[aggKey].count += 1;
    });
    Object.entries(uaWeeklyUploadState).forEach(([aggKey, val]) => {
        if (val && aggKey.includes(`::${year}-W`)) {
            weeklyMap[aggKey] = { total: Number(val.total || 0), count: Number(val.count || 1) };
        }
    });

    const getIconCls = (col) => {
        if (uaWeeklySortState.column === col && uaWeeklySortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (uaWeeklySortState.column === col && uaWeeklySortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };

    thead.innerHTML = `
                <tr class="bg-gray-50 text-[10px] font-normal text-gray-600">
                    <th onclick="toggleUaWeeklySort('unit')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap sticky left-0 bg-gray-50 z-20 w-[120px] min-w-[120px] max-w-[120px] border-b border-r border-gray-200/70">
                        <div class="flex items-center justify-between gap-2"><span>Unit</span><i class="fa-solid ${getIconCls('unit')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleUaWeeklySort('model_tipe')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap sm:sticky sm:left-[120px] bg-gray-50 z-20 w-[190px] min-w-[190px] max-w-[190px] border-b border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div class="flex items-center justify-between gap-2"><span>Model / Tipe</span><i class="fa-solid ${getIconCls('model_tipe')} text-[9px]"></i></div>
                    </th>
                    ${weeks.map(w => `
                        <th onclick="toggleUaWeeklySort('${w.key}')" class="py-2.5 px-3 text-center font-normal cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap bg-gray-50 border-b border-gray-100">
                            <div class="flex items-center justify-center gap-1"><span>${w.label}</span><i class="fa-solid ${getIconCls(w.key)} text-[8px]"></i></div>
                            <div class="text-[8px] text-gray-400 mt-0.5">${w.shortRange}</div>
                        </th>
                    `).join('')}
                </tr>
            `;

    let rows = komisioningState.filter(unit => {
        if (categoryFilter !== 'all' && getUnitCategoryGroup(unit.no_unit, unit.model_tipe) !== categoryFilter) {
            return false;
        }
        if (!query) return true;
        return `${unit.no_unit} ${unit.model_tipe}`.toLowerCase().includes(query);
    });

    if (uaWeeklySortState.column && uaWeeklySortState.direction !== 'none') {
        const col = uaWeeklySortState.column;
        const dir = uaWeeklySortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'unit') return String(a.no_unit || '').localeCompare(String(b.no_unit || ''), 'id') * dir;
            if (col === 'model_tipe') return String(a.model_tipe || '').localeCompare(String(b.model_tipe || ''), 'id') * dir;
            const vA = weeklyMap[`${normalizeUnitKey(a.no_unit)}::${col}`]?.total ?? -1;
            const vB = weeklyMap[`${normalizeUnitKey(b.no_unit)}::${col}`]?.total ?? -1;
            return (vA - vB) * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${weeks.length + 2}" class="py-10 text-center text-xs text-gray-400">Tidak ada data UA Weekly yang cocok.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((unit, idx) => {
        const rowBg = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
        const uKey = normalizeUnitKey(unit.no_unit);
        return `
                    <tr class="group ${rowBg} hover:bg-teal-50 transition-colors">
                        <td class="py-3 px-3 font-mono text-gray-800 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 w-[120px] min-w-[120px] max-w-[120px] border-b border-r border-gray-100 transition-colors">
                            ${escapeHtml(unit.no_unit)}
                        </td>
                        <td class="py-3 px-3 text-gray-600 whitespace-nowrap sm:sticky sm:left-[120px] z-10 ${rowBg} group-hover:bg-teal-50 w-[190px] min-w-[190px] max-w-[190px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] transition-colors truncate">
                            ${escapeHtml(unit.model_tipe || '-')}
                        </td>
                        ${weeks.map(w => {
            const agg = weeklyMap[`${uKey}::${w.key}`];
            if (!agg) return `<td class="py-3 px-3 text-center text-gray-300 border-b border-gray-100 whitespace-nowrap">-</td>`;
            return `
                                <td class="py-3 px-3 text-center border-b border-gray-100 whitespace-nowrap">
                                    <span class="font-mono font-semibold ${agg.total > 0 ? 'text-teal-700' : 'text-amber-600'}">${agg.total.toFixed(2)} Jam</span>
                                    <div class="text-[8px] text-gray-400 mt-0.5">${agg.count} shift</div>
                                </td>
                            `;
        }).join('')}
                    </tr>
                `;
    }).join('');
}

function getHmUaUploadMode() {
    return document.getElementById('hmua-upload-mode')?.value || 'hm';
}

function populateHmUaUploadWeekOptions() {
    const monthVal = parseInt(document.getElementById('hmua-upload-month')?.value || '10', 10);
    const yearVal = parseInt(document.getElementById('hmua-upload-year')?.value || '2026', 10);
    const weekSel = document.getElementById('hmua-upload-week');
    if (!weekSel) return;

    const weeks = getWeeksInYearSunSat(yearVal).filter(w => w.months.includes(monthVal));
    const currWeek = getCurrentCalendarWeekInfo();
    const prevVal = weekSel.value;

    weekSel.innerHTML = weeks.map(w => `<option value="${w.key}">${w.label} (${w.shortRange})</option>`).join('');
    if (weeks.some(w => w.key === prevVal)) {
        weekSel.value = prevVal;
    } else if (weeks.some(w => w.key === currWeek.key)) {
        weekSel.value = currWeek.key;
    }
    renderHmUaUploadPreview();
}

function toggleHmUaUploadTargetFields() {
    const mode = getHmUaUploadMode();
    const isWeekly = mode === 'ua-weekly';
    const isMtd = mode === 'ua-mtd';
    const periodRow = document.getElementById('hmua-upload-period-row');
    if (periodRow) {
        periodRow.classList.toggle('hidden', !(isWeekly || isMtd));
        periodRow.classList.toggle('grid', isWeekly || isMtd);
        periodRow.classList.toggle('grid-cols-3', isWeekly);
        periodRow.classList.toggle('grid-cols-2', isMtd);
    }
    const weekWrap = document.getElementById('hmua-upload-week-wrap');
    if (weekWrap) weekWrap.classList.toggle('hidden', !isWeekly);
    ['hmua-upload-month-wrap', 'hmua-upload-year-wrap'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !(isWeekly || isMtd));
    });

    const titleEl = document.getElementById('hmua-upload-preview-title');
    const modalTitleEl = document.getElementById('modal-hmua-upload-title');
    const btnTextEl = document.getElementById('btn-apply-hmua-upload-text');
    const modeLabel = getHmUaModeLabel(mode);
    if (modalTitleEl) modalTitleEl.textContent = `Upload ${modeLabel}`;
    if (titleEl) titleEl.textContent = `Pratinjau Data ${modeLabel}`;
    if (btnTextEl) btnTextEl.textContent = `Update Data ${modeLabel}`;
    renderHmUaUploadPreview();
}

/**
 * Mengunduh Template Excel kosong sesuai pilihan upload (HM Daily / UA Unit / UA Weekly / UA MTD).
 */
function downloadSampleRawHmUaExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const mode = getHmUaUploadMode();
    let headers;
    let cols;
    let sheetName;
    let fileName;

    if (mode === 'hm') {
        headers = [['Tanggal', 'Shift', 'NRP', 'Operator', 'Unit', 'HM Awal SS6']];
        cols = [{ wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }];
        sheetName = 'Template HM Daily';
        fileName = 'Template_Upload_HM_Daily_PANTAU_SE.xlsx';
    } else if (mode === 'ua-weekly') {
        headers = [['Unit', 'HM Diff', 'Jumlah Shift']];
        cols = [{ wch: 14 }, { wch: 14 }, { wch: 14 }];
        sheetName = 'Template UA Weekly';
        fileName = 'Template_Upload_UA_Weekly_PANTAU_SE.xlsx';
    } else if (mode === 'ua-mtd') {
        headers = [['Unit', 'Total HM MTD', 'Hari Operasi', 'Jumlah Shift']];
        cols = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
        sheetName = 'Template UA MTD';
        fileName = 'Template_Upload_UA_MTD_PANTAU_SE.xlsx';
    } else {
        headers = [['Tanggal', 'Shift', 'NRP', 'Unit', 'HM Start', 'HM Stop', 'HM Diff']];
        cols = [{ wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        sheetName = 'Template UA Unit';
        fileName = 'Template_Upload_UA_Unit_PANTAU_SE.xlsx';
    }

    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    showToast(`Template kosong ${sheetName} berhasil diunduh.`, 'success');
}

/**
 * Membaca file Excel/CSV mentah HM Unit / UA Unit / UA Weekly dan menyaring unit terdaftar di Data Komisioning Unit.
 */
function handleHmUaRawFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const mode = getHmUaUploadMode();
    const fileNameEl = document.getElementById('hmua-raw-filename');
    if (fileNameEl) fileNameEl.textContent = file.name;

    const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const cleaned = String(val).trim().replace(/,/g, '.');
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
    };

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            const matchedList = [];
            let ignoredCount = 0;
            const todayIso = getTodayISO();

            jsonRows.forEach(row => {
                const rawUnit = String(findRowValueByAliases(row, ['Unit', 'No Unit', 'Kode Unit', 'No Lambung']) || '').trim();
                const unitObj = komisioningState.find(u => normalizeUnitKey(u.no_unit) === normalizeUnitKey(rawUnit));

                if (unitObj) {
                    if (mode === 'ua-weekly' || mode === 'ua-mtd') {
                        const hmStart = parseNum(findRowValueByAliases(row, ['HM Start', 'HM Awal', 'Start']));
                        const hmStop = parseNum(findRowValueByAliases(row, ['HM Stop', 'HM Akhir', 'Stop']));
                        let hmDiff = parseNum(findRowValueByAliases(row, ['Total HM MTD', 'HM MTD', 'HM Diff', 'Total HM Diff', 'Total Jam', 'Diff', 'UA']));
                        if (hmDiff === null && hmStart !== null && hmStop !== null) {
                            hmDiff = Number((hmStop - hmStart).toFixed(2));
                        } else if (hmDiff !== null) {
                            hmDiff = Number(hmDiff.toFixed(2));
                        }
                        const shiftCountRaw = parseNum(findRowValueByAliases(row, ['Jumlah Shift', 'Total Shift', 'Shift']));
                        const shiftCount = shiftCountRaw !== null && shiftCountRaw > 0 ? Math.round(shiftCountRaw) : 1;
                        const daysOpsRaw = parseNum(findRowValueByAliases(row, ['Hari Operasi', 'Jumlah Hari', 'Hari']));
                        const daysOps = daysOpsRaw !== null && daysOpsRaw > 0 ? Math.round(daysOpsRaw) : shiftCount;

                        matchedList.push({
                            mode,
                            unit: unitObj.no_unit,
                            model_tipe: unitObj.model_tipe || '-',
                            hm_diff: hmDiff ?? 0,
                            days_ops: daysOps,
                            shift_count: shiftCount
                        });
                    } else {
                        const dateIso = normalizeExcelDate(findRowValueByAliases(row, ['Tanggal', 'Date', 'Tgl'])) || todayIso;
                        const rawShift = String(findRowValueByAliases(row, ['Shift', 'Code']) || 'D').trim().toUpperCase();
                        const rosterRule = resolveRosterCodeRule(rawShift);
                        const shift = (rosterRule?.artiSistem === 'SHIFT_2' || rawShift.startsWith('N') || rawShift === 'S2' || rawShift === '2') ? 'N' : 'D';
                        const nrp = String(findRowValueByAliases(row, ['NRP', 'NIK']) || '-').trim();
                        const operator = String(findRowValueByAliases(row, ['Operator', 'Nama Operator', 'Nama', 'Name']) || '').trim();
                        const hmStart = parseNum(findRowValueByAliases(row, ['HM Awal SS6', 'HM Start', 'HM Awal', 'Start']));
                        const hmStop = parseNum(findRowValueByAliases(row, ['HM Stop', 'HM Akhir', 'Stop']));
                        let hmDiff = parseNum(findRowValueByAliases(row, ['HM Diff', 'Diff', 'UA']));

                        if (hmDiff === null && hmStart !== null && hmStop !== null) {
                            hmDiff = Number((hmStop - hmStart).toFixed(2));
                        } else if (hmDiff !== null) {
                            hmDiff = Number(hmDiff.toFixed(2));
                        }

                        matchedList.push({
                            mode,
                            unit: unitObj.no_unit,
                            dateIso,
                            shift,
                            nrp: nrp || '-',
                            operator,
                            hm_start: hmStart !== null ? Number(hmStart.toFixed(2)) : null,
                            hm_stop: hmStop !== null ? Number(hmStop.toFixed(2)) : null,
                            hm_diff: hmDiff
                        });
                    }
                } else {
                    ignoredCount++;
                }
            });

            pendingHmUaUpload = matchedList;

            const statsWrap = document.getElementById('hmua-upload-stats');
            if (statsWrap) { statsWrap.classList.remove('hidden'); statsWrap.classList.add('grid'); }
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
            setTxt('hmua-stat-total', jsonRows.length);
            setTxt('hmua-stat-matched', pendingHmUaUpload.length);
            setTxt('hmua-stat-ignored', ignoredCount);

            renderHmUaUploadPreview();

            if (pendingHmUaUpload.length > 0) {
                showToast(`${pendingHmUaUpload.length} baris unit cocok dari ${jsonRows.length} baris mentah.`, 'info');
            } else {
                showToast('Tidak ada Unit pada file yang cocok dengan Data Komisioning Unit.', 'error');
            }
        } catch (err) {
            console.error('Gagal membaca file mentah HM & UA:', err);
            showToast('Format file HM & UA tidak dapat dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderHmUaUploadPreview() {
    const thead = document.getElementById('hmua-upload-preview-thead');
    const tbody = document.getElementById('hmua-upload-preview-tbody');
    const applyBtn = document.getElementById('btn-apply-hmua-upload');
    const mode = getHmUaUploadMode();
    delete genericTableSortState['table-hmua-upload-preview'];

    if (applyBtn) applyBtn.disabled = pendingHmUaUpload.length === 0;
    if (!tbody) return;

    const buildSortTh = (label, colIdx, type) => `
                <th onclick="toggleGenericTableSort('table-hmua-upload-preview', ${colIdx}, '${type}')" class="py-3 px-4 font-normal cursor-pointer select-none hover:bg-gray-100/80 whitespace-nowrap">
                    <div class="flex items-center justify-between gap-2"><span>${label}</span><i data-gen-sort-icon="table-hmua-upload-preview:${colIdx}" class="fa-solid fa-sort text-gray-300 text-[9px]"></i></div>
                </th>
            `;

    if (thead) {
        if (mode === 'hm') {
            thead.innerHTML = `<tr class="bg-gray-50/80 border-b border-gray-100 text-[10px] font-normal text-gray-600">${buildSortTh('Tanggal', 0, 'date')}${buildSortTh('Shift', 1, 'text')}${buildSortTh('NRP', 2, 'text')}${buildSortTh('Operator', 3, 'text')}${buildSortTh('Unit', 4, 'text')}${buildSortTh('HM Awal SS6', 5, 'number')}</tr>`;
        } else if (mode === 'ua-weekly') {
            thead.innerHTML = `<tr class="bg-gray-50/80 border-b border-gray-100 text-[10px] font-normal text-gray-600">${buildSortTh('Week Target', 0, 'text')}${buildSortTh('Unit', 1, 'text')}${buildSortTh('Model / Tipe', 2, 'text')}${buildSortTh('Total HM Diff (Jam)', 3, 'number')}${buildSortTh('Jumlah Shift', 4, 'number')}</tr>`;
        } else if (mode === 'ua-mtd') {
            thead.innerHTML = `<tr class="bg-gray-50/80 border-b border-gray-100 text-[10px] font-normal text-gray-600">${buildSortTh('Bulan Target', 0, 'text')}${buildSortTh('Unit', 1, 'text')}${buildSortTh('Model / Tipe', 2, 'text')}${buildSortTh('Total HM MTD (Jam)', 3, 'number')}${buildSortTh('Hari / Shift', 4, 'number')}</tr>`;
        } else {
            thead.innerHTML = `<tr class="bg-gray-50/80 border-b border-gray-100 text-[10px] font-normal text-gray-600">${buildSortTh('Tanggal', 0, 'date')}${buildSortTh('Shift', 1, 'text')}${buildSortTh('NRP', 2, 'text')}${buildSortTh('Unit', 3, 'text')}${buildSortTh('HM Start', 4, 'number')}${buildSortTh('HM Stop', 5, 'number')}${buildSortTh('HM Diff', 6, 'number')}</tr>`;
        }
    }

    const colSpan = mode === 'hm' ? 6 : ((mode === 'ua-weekly' || mode === 'ua-mtd') ? 5 : 7);
    if (pendingHmUaUpload.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="py-10 text-center text-xs text-gray-400">Belum ada file mentah yang diunggah. Pilih file Excel/CSV untuk menyaring unit yang terdaftar di Data Komisioning Unit.</td></tr>`;
        return;
    }

    if (mode === 'hm') {
        tbody.innerHTML = pendingHmUaUpload.map(item => `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${formatDateID(item.dateIso)}</td>
                        <td class="py-3 px-4 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full ${item.shift === 'N' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}">${item.shift === 'N' ? 'Shift 2' : 'Shift 1'}</span>
                        </td>
                        <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(item.nrp)}</td>
                        <td class="py-3 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(resolveHmOperatorName(item.nrp, item.operator))}</td>
                        <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(item.unit)}</td>
                        <td class="py-3 px-4 font-mono text-gray-800 font-semibold whitespace-nowrap">${item.hm_start !== null ? item.hm_start.toFixed(2) : '-'}</td>
                    </tr>
                `).join('');
    } else if (mode === 'ua-weekly' || mode === 'ua-mtd') {
        const monthVal = parseInt(document.getElementById('hmua-upload-month')?.value ?? '10', 10);
        const yearVal = parseInt(document.getElementById('hmua-upload-year')?.value || '2026', 10);
        const weekKey = document.getElementById('hmua-upload-week')?.value || '';
        const wkObj = getWeeksInYearSunSat(yearVal).find(w => w.key === weekKey);
        const targetLabel = mode === 'ua-mtd'
            ? `${MONTH_NAMES_ID[monthVal] || ''} ${yearVal}`
            : (wkObj ? wkObj.fullLabel : weekKey);

        tbody.innerHTML = pendingHmUaUpload.map(item => `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(targetLabel)}</td>
                        <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(item.unit)}</td>
                        <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(item.model_tipe || '-')}</td>
                        <td class="py-3 px-4 font-mono font-semibold text-teal-700 whitespace-nowrap">${Number(item.hm_diff || 0).toFixed(2)} Jam</td>
                        <td class="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">${mode === 'ua-mtd' ? `${Number(item.days_ops || 1)} hr / ${Number(item.shift_count || 1)} shift` : `${Number(item.shift_count || 1)} shift`}</td>
                    </tr>
                `).join('');
    } else {
        tbody.innerHTML = pendingHmUaUpload.map(item => `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${formatDateID(item.dateIso)}</td>
                        <td class="py-3 px-4 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full ${item.shift === 'N' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}">${item.shift === 'N' ? 'Shift 2' : 'Shift 1'}</span>
                        </td>
                        <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(item.nrp)}</td>
                        <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(item.unit)}</td>
                        <td class="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">${item.hm_start !== null ? item.hm_start.toFixed(2) : '-'}</td>
                        <td class="py-3 px-4 font-mono text-gray-700 whitespace-nowrap">${item.hm_stop !== null ? item.hm_stop.toFixed(2) : '-'}</td>
                        <td class="py-3 px-4 font-mono font-semibold text-teal-700 whitespace-nowrap">${item.hm_diff !== null ? item.hm_diff.toFixed(2) : '-'}</td>
                    </tr>
                `).join('');
    }
}

function resetHmUaUploadState() {
    pendingHmUaUpload = [];
    const fileInput = document.getElementById('hmua-raw-file');
    const fileNameEl = document.getElementById('hmua-raw-filename');
    const statsWrap = document.getElementById('hmua-upload-stats');
    if (fileInput) fileInput.value = '';
    if (fileNameEl) fileNameEl.textContent = `Pilih File ${getHmUaModeLabel(getHmUaUploadMode())} (.xlsx, .xls, .csv)`;
    if (statsWrap) { statsWrap.classList.add('hidden'); statsWrap.classList.remove('grid'); }
    renderHmUaUploadPreview();
}

function formatUploadResultToast(label, { added = 0, updated = 0, skipped = 0 }, saveMode = 'overwrite') {
    const parts = [];
    if (added > 0) parts.push(`${added} baru ditambahkan`);
    if (updated > 0) parts.push(`${updated} data lama ditimpa/diperbarui`);
    if (skipped > 0) parts.push(`${skipped} data lama dipertahankan`);
    if (parts.length === 0) return `Tidak ada perubahan pada ${label}.`;
    const modeLabel = saveMode === 'append' ? 'Mode Tambah Baru' : 'Mode Timpa/Update';
    return `${label} (${modeLabel}): ${parts.join(', ')}.`;
}

function applyPendingHmUaUpload() {
    if (!pendingHmUaUpload.length) return;
    const mode = getHmUaUploadMode();
    const saveMode = document.getElementById('hmua-upload-save-mode')?.value || 'overwrite';
    let added = 0;
    let updated = 0;
    let skipped = 0;

    if (mode === 'ua-weekly') {
        const weekKey = document.getElementById('hmua-upload-week')?.value || getCurrentCalendarWeekInfo().key;
        const monthVal = document.getElementById('hmua-upload-month')?.value ?? '10';
        const yearVal = document.getElementById('hmua-upload-year')?.value ?? '2026';
        const yearNum = parseInt(yearVal, 10);
        const wkObj = getWeeksInYearSunSat(yearNum).find(w => w.key === weekKey);

        pendingHmUaUpload.forEach(item => {
            const uKey = normalizeUnitKey(item.unit);
            const aggKey = `${uKey}::${weekKey}`;
            const hasDailyInWeek = wkObj && Object.values(hmUaRecordsState).some(rec => {
                if (normalizeUnitKey(rec.unit) !== uKey || !rec.date || rec.hm_diff === null || rec.hm_diff === undefined) return false;
                const d = new Date(rec.date + 'T00:00:00');
                return !isNaN(d.getTime()) && d >= wkObj.startDate && d <= wkObj.endDate;
            });
            const hasExisting = Boolean(uaWeeklyUploadState[aggKey]) || hasDailyInWeek;

            if (saveMode === 'append' && hasExisting) {
                skipped++;
                return;
            }
            if (hasExisting) updated++;
            else added++;

            uaWeeklyUploadState[aggKey] = {
                total: Number(item.hm_diff || 0),
                count: Number(item.shift_count || 1)
            };
        });

        const wkMonthEl = document.getElementById('ua-weekly-month');
        const wkYearEl = document.getElementById('ua-weekly-year');
        if (wkMonthEl) wkMonthEl.value = monthVal;
        if (wkYearEl) wkYearEl.value = yearVal;

        resetHmUaUploadState();
        closeHmUaUploadModal();
        renderUaWeeklyTable();
        switchHmUaSubView('ua-weekly');
        showToast(formatUploadResultToast('UA Weekly', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
        return;
    }

    if (mode === 'ua-mtd') {
        const monthVal = document.getElementById('hmua-upload-month')?.value ?? '10';
        const yearVal = document.getElementById('hmua-upload-year')?.value ?? '2026';
        const ymKey = `${yearVal}-${monthVal}`;

        pendingHmUaUpload.forEach(item => {
            const uKey = normalizeUnitKey(item.unit);
            const aggKey = `${uKey}::${ymKey}`;
            const hasExisting = Boolean(uaMtdUploadState[aggKey]);
            if (saveMode === 'append' && hasExisting) { skipped++; return; }
            if (hasExisting) updated++; else added++;
            uaMtdUploadState[aggKey] = {
                total: Number(item.hm_diff || 0),
                days: Number(item.days_ops || item.shift_count || 1),
                shifts: Number(item.shift_count || 1)
            };
        });

        const mtdMonthEl = document.getElementById('ua-mtd-month');
        const mtdYearEl = document.getElementById('ua-mtd-year');
        if (mtdMonthEl) mtdMonthEl.value = monthVal;
        if (mtdYearEl) mtdYearEl.value = yearVal;

        resetHmUaUploadState();
        closeHmUaUploadModal();
        renderUaMtdTable();
        switchHmUaSubView('ua-mtd');
        showToast(formatUploadResultToast('UA MTD', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
        return;
    }

    let latestDate = '';
    pendingHmUaUpload.forEach(item => {
        const key = `${normalizeUnitKey(item.unit)}::${item.dateIso}::${item.shift}`;
        const existing = hmUaRecordsState[key];
        const hasExisting = mode === 'hm'
            ? Boolean(existing && existing.hm_start !== null && existing.hm_start !== undefined)
            : Boolean(existing && existing.hm_diff !== null && existing.hm_diff !== undefined);

        if (saveMode === 'append' && hasExisting) {
            skipped++;
            return;
        }
        if (hasExisting) updated++;
        else added++;

        if (mode === 'hm') {
            hmUaRecordsState[key] = {
                unit: item.unit,
                date: item.dateIso,
                shift: item.shift,
                nrp: item.nrp !== '-' ? item.nrp : (existing?.nrp || '-'),
                operator: item.operator || existing?.operator || '',
                hm_start: item.hm_start,
                hm_stop: existing?.hm_stop ?? item.hm_stop ?? null,
                hm_diff: existing?.hm_diff ?? item.hm_diff ?? null,
                hm_aktual: existing?.hm_aktual ?? null
            };
        } else {
            hmUaRecordsState[key] = {
                unit: item.unit,
                date: item.dateIso,
                shift: item.shift,
                nrp: item.nrp !== '-' ? item.nrp : (existing?.nrp || '-'),
                operator: item.operator || existing?.operator || '',
                hm_start: item.hm_start !== null ? item.hm_start : (existing?.hm_start ?? null),
                hm_stop: item.hm_stop,
                hm_diff: item.hm_diff,
                hm_aktual: existing?.hm_aktual ?? null
            };
        }
        if (!latestDate || item.dateIso > latestDate) latestDate = item.dateIso;
    });

    if (latestDate) {
        const dateInput = document.getElementById('hmua-filter-date');
        if (dateInput) dateInput.value = latestDate;
    }

    resetHmUaUploadState();
    closeHmUaUploadModal();
    renderHmUaTables();
    switchHmUaSubView(mode === 'ua' ? 'ua' : 'hm');
    showToast(formatUploadResultToast(mode === 'ua' ? 'UA Unit' : 'HM Daily', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
}

/* ----- RENTAL BIB (13 KOLOM, TAMBAH DATA, KLIK NO UNIT UNTUK EDIT/HAPUS) ----- */
function formatRupiah(amount) {
    const num = Number(amount || 0);
    if (isNaN(num)) return 'Rp 0';
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function toggleRentalSort(column) {
    if (rentalSortState.column !== column) rentalSortState = { column, direction: 'desc' };
    else if (rentalSortState.direction === 'desc') rentalSortState.direction = 'asc';
    else rentalSortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-rental-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-rental-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (rentalSortState.column === col && rentalSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (rentalSortState.column === col && rentalSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderRentalBibTable();
}

function renderRentalBibTable() {
    const tbody = document.getElementById('rental-bib-tbody');
    const badge = document.getElementById('rental-count-badge');
    if (!tbody) return;

    const query = (document.getElementById('rental-search')?.value || '').trim().toLowerCase();
    const monthVal = document.getElementById('rental-filter-month')?.value ?? 'all';
    const yearVal = document.getElementById('rental-filter-year')?.value ?? 'all';

    let rows = rentalBibState.filter(item => {
        const d = new Date(item.tanggal + 'T00:00:00');
        if (monthVal !== 'all' && d.getMonth() !== parseInt(monthVal, 10)) return false;
        if (yearVal !== 'all' && d.getFullYear() !== parseInt(yearVal, 10)) return false;
        if (query) {
            const hay = `${item.tanggal} ${formatDateID(item.tanggal)} ${item.no_unit} ${item.shift} ${item.job} ${item.operator} ${item.pic_dept}`.toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    if (badge) badge.textContent = `Total Record: ${rows.length}`;

    if (rentalSortState.column && rentalSortState.direction !== 'none') {
        const col = rentalSortState.column;
        const dir = rentalSortState.direction === 'asc' ? 1 : -1;
        const numericCols = ['hm_awal', 'hm_akhir', 'total_hm', 'hm_charge', 'rental_rate', 'total'];
        rows = [...rows].sort((a, b) => {
            if (numericCols.includes(col)) return ((Number(a[col]) || 0) - (Number(b[col]) || 0)) * dir;
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="py-10 text-center text-xs text-gray-400">Tidak ada data Rental BIB untuk periode/pencarian ini. Klik <strong>+ Tambah Rental</strong> untuk menambah data baru.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
        const shiftBadge = r.shift === 'Shift 2'
            ? '<span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Shift 2</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">Shift 1</span>';
        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-3 text-center font-mono text-gray-500 whitespace-nowrap">${idx + 1}</td>
                        <td class="py-3 px-3 text-gray-600 whitespace-nowrap">${formatDateID(r.tanggal)}</td>
                        <td class="py-3 px-3 whitespace-nowrap">
                            <button
                                type="button"
                                onclick="openRentalDetailModal(${Number(r.id)})"
                                title="Klik No Unit untuk edit atau hapus data rental"
                                class="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
                            >${escapeHtml(r.no_unit)}</button>
                        </td>
                        <td class="py-3 px-3 whitespace-nowrap">${shiftBadge}</td>
                        <td class="py-3 px-3 font-mono text-gray-700 whitespace-nowrap">${Number(r.hm_awal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-3 px-3 font-mono text-gray-700 whitespace-nowrap">${Number(r.hm_akhir).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td class="py-3 px-3 font-mono font-semibold text-gray-800 whitespace-nowrap">${Number(r.total_hm).toFixed(2)}</td>
                        <td class="py-3 px-3 font-mono font-semibold text-teal-700 whitespace-nowrap">${Number(r.hm_charge).toFixed(2)}</td>
                        <td class="py-3 px-3 font-mono text-gray-700 whitespace-nowrap">${formatRupiah(r.rental_rate)}</td>
                        <td class="py-3 px-3 font-mono font-bold text-gray-900 whitespace-nowrap">${formatRupiah(r.total)}</td>
                        <td class="py-3 px-3 text-gray-700 min-w-[180px]">${escapeHtml(r.job || '-')}</td>
                        <td class="py-3 px-3 text-gray-700 whitespace-nowrap">${escapeHtml(r.operator || '-')}</td>
                        <td class="py-3 px-3 text-gray-600 whitespace-nowrap">${escapeHtml(r.pic_dept || '-')}</td>
                    </tr>
                `;
    }).join('');
}

function populateRentalModalDatalists() {
    const unitList = document.getElementById('rental-unit-options');
    if (unitList) {
        unitList.innerHTML = komisioningState
            .map(u => `<option value="${escapeHtml(u.no_unit)}">${escapeHtml(u.model_tipe)} • ${formatRupiah(u.rental_rate || 0)}/jam</option>`)
            .join('');
    }
    const opList = document.getElementById('rental-operator-options');
    if (opList) {
        opList.innerHTML = manpowerState
            .map(m => `<option value="${escapeHtml(m.nama)}">${escapeHtml(m.jabatan)}</option>`)
            .join('');
    }
}

function onRentalUnitInputChange() {
    const unitVal = (document.getElementById('rental-no-unit')?.value || '').trim();
    const rateEl = document.getElementById('rental-rate');
    const hintEl = document.getElementById('rental-master-rate-hint');
    if (!unitVal) {
        if (hintEl) hintEl.classList.add('hidden');
        return;
    }
    const unitObj = komisioningState.find(u => normalizeUnitKey(u.no_unit) === normalizeUnitKey(unitVal));
    if (unitObj && Number(unitObj.rental_rate) > 0) {
        if (rateEl) rateEl.value = String(unitObj.rental_rate);
        if (hintEl) {
            hintEl.textContent = `Tarif otomatis dari Master Data (${unitObj.no_unit}): ${formatRupiah(unitObj.rental_rate)}/jam`;
            hintEl.classList.remove('hidden');
        }
        recalcRentalModalFields(false);
    } else if (hintEl) {
        hintEl.classList.add('hidden');
    }
}

function recalcRentalModalFields(syncChargeFromHm = false) {
    const hmAwal = parseFloat(document.getElementById('rental-hm-awal')?.value || '');
    const hmAkhir = parseFloat(document.getElementById('rental-hm-akhir')?.value || '');
    const totalHmEl = document.getElementById('rental-total-hm');
    const chargeEl = document.getElementById('rental-hm-charge');
    const rateEl = document.getElementById('rental-rate');
    const totalBiayaEl = document.getElementById('rental-total-biaya');

    let totalHm = 0;
    if (!isNaN(hmAwal) && !isNaN(hmAkhir)) {
        totalHm = Number(Math.max(0, hmAkhir - hmAwal).toFixed(2));
    }
    if (totalHmEl) totalHmEl.value = totalHm.toFixed(2);

    if (syncChargeFromHm && chargeEl && !chargeEl.dataset.manualEdited) {
        chargeEl.value = totalHm > 0 ? totalHm.toFixed(2) : '';
    }

    const hmCharge = parseFloat(chargeEl?.value || '');
    const rate = parseFloat(rateEl?.value || '');
    const totalBiaya = (!isNaN(hmCharge) && !isNaN(rate)) ? Math.round(hmCharge * rate) : 0;
    if (totalBiayaEl) totalBiayaEl.value = formatRupiah(totalBiaya);
}

function openRentalModal() {
    const form = document.getElementById('form-rental-bib');
    if (form) form.reset();
    populateRentalModalDatalists();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('rental-edit-id', '');
    setVal('rental-tanggal', getTodayISO());
    setVal('rental-shift', 'Shift 1');
    setVal('rental-total-hm', '0.00');
    setVal('rental-total-biaya', 'Rp 0');

    const chargeEl = document.getElementById('rental-hm-charge');
    if (chargeEl) delete chargeEl.dataset.manualEdited;
    document.getElementById('rental-master-rate-hint')?.classList.add('hidden');

    const titleEl = document.getElementById('modal-rental-title');
    const subEl = document.getElementById('modal-rental-subtitle');
    const submitTxt = document.getElementById('btn-submit-rental-text');
    const delBtn = document.getElementById('btn-delete-rental');

    if (titleEl) titleEl.textContent = 'Tambah Data Rental BIB';
    if (subEl) subEl.textContent = 'Catat utilisasi sewa unit lifting area BIB';
    if (submitTxt) submitTxt.textContent = 'Simpan Data';
    if (delBtn) { delBtn.classList.add('hidden'); delBtn.classList.remove('inline-flex'); }

    const modal = document.getElementById('modal-rental-bib');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function openRentalDetailModal(id) {
    const rec = rentalBibState.find(item => Number(item.id) === Number(id));
    if (!rec) return;
    populateRentalModalDatalists();

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };
    setVal('rental-edit-id', String(rec.id));
    setVal('rental-tanggal', rec.tanggal);
    setVal('rental-no-unit', rec.no_unit);
    setVal('rental-shift', rec.shift || 'Shift 1');
    setVal('rental-hm-awal', Number(rec.hm_awal).toFixed(2));
    setVal('rental-hm-akhir', Number(rec.hm_akhir).toFixed(2));
    setVal('rental-hm-charge', Number(rec.hm_charge).toFixed(2));
    setVal('rental-rate', String(rec.rental_rate ?? 0));
    setVal('rental-job', rec.job);
    setVal('rental-operator', rec.operator);
    setVal('rental-pic-dept', rec.pic_dept);

    const chargeEl = document.getElementById('rental-hm-charge');
    if (chargeEl) chargeEl.dataset.manualEdited = '1';

    recalcRentalModalFields(false);

    const titleEl = document.getElementById('modal-rental-title');
    const subEl = document.getElementById('modal-rental-subtitle');
    const submitTxt = document.getElementById('btn-submit-rental-text');
    const delBtn = document.getElementById('btn-delete-rental');

    if (titleEl) titleEl.textContent = `Detail & Edit Rental BIB — ${rec.no_unit}`;
    if (subEl) subEl.textContent = `${formatDateID(rec.tanggal)} • ${rec.shift} • ${rec.pic_dept}`;
    if (submitTxt) submitTxt.textContent = 'Simpan Perubahan';
    if (delBtn) { delBtn.classList.remove('hidden'); delBtn.classList.add('inline-flex'); }

    const modal = document.getElementById('modal-rental-bib');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeRentalModal() {
    const modal = document.getElementById('modal-rental-bib');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function handleRentalSubmit(event) {
    event.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const editId = getVal('rental-edit-id');
    const tanggal = getVal('rental-tanggal');
    const noUnit = getVal('rental-no-unit').toUpperCase();
    const shift = getVal('rental-shift') || 'Shift 1';
    const hmAwal = parseFloat(getVal('rental-hm-awal'));
    const hmAkhir = parseFloat(getVal('rental-hm-akhir'));
    const hmCharge = parseFloat(getVal('rental-hm-charge'));
    const rentalRate = parseFloat(getVal('rental-rate'));
    const job = getVal('rental-job');
    const operator = getVal('rental-operator');
    const picDept = getVal('rental-pic-dept');

    if (!tanggal || !noUnit || isNaN(hmAwal) || isNaN(hmAkhir) || isNaN(hmCharge) || isNaN(rentalRate) || !job || !operator || !picDept) {
        showToast('Seluruh kolom wajib diisi dengan benar.', 'error');
        return;
    }
    if (hmAkhir < hmAwal) {
        showToast('HM Akhir tidak boleh lebih kecil dari HM Awal.', 'error');
        return;
    }

    const totalHm = Number((hmAkhir - hmAwal).toFixed(2));
    const total = Math.round(hmCharge * rentalRate);
    const payload = {
        tanggal,
        no_unit: noUnit,
        shift,
        hm_awal: Number(hmAwal.toFixed(2)),
        hm_akhir: Number(hmAkhir.toFixed(2)),
        total_hm: totalHm,
        hm_charge: Number(hmCharge.toFixed(2)),
        rental_rate: Math.round(rentalRate),
        total,
        job,
        operator,
        pic_dept: picDept
    };

    if (editId) {
        const idx = rentalBibState.findIndex(item => Number(item.id) === Number(editId));
        if (idx !== -1) rentalBibState[idx] = { ...rentalBibState[idx], ...payload };
        closeRentalModal();
        const d = new Date(tanggal + 'T00:00:00');
        const mEl = document.getElementById('rental-filter-month');
        const yEl = document.getElementById('rental-filter-year');
        if (mEl && mEl.value !== 'all') mEl.value = String(d.getMonth());
        if (yEl && yEl.value !== 'all') yEl.value = String(d.getFullYear());
        renderRentalBibTable();
        showToast(`Data rental ${noUnit} berhasil diperbarui.`, 'success');
    } else {
        const nextId = rentalBibState.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0) + 1;
        rentalBibState.push({ id: nextId, ...payload });
        closeRentalModal();
        const d = new Date(tanggal + 'T00:00:00');
        const mEl = document.getElementById('rental-filter-month');
        const yEl = document.getElementById('rental-filter-year');
        if (mEl && mEl.value !== 'all') mEl.value = String(d.getMonth());
        if (yEl && yEl.value !== 'all') yEl.value = String(d.getFullYear());
        renderRentalBibTable();
        showToast(`Data rental ${noUnit} berhasil ditambahkan.`, 'success');
    }
}

function deleteRentalFromModal() {
    const editId = document.getElementById('rental-edit-id')?.value;
    const rec = rentalBibState.find(item => Number(item.id) === Number(editId));
    if (!rec) return;

    openConfirmDeleteModal({
        title: 'Konfirmasi Hapus Data Rental BIB',
        message: `Apakah Anda yakin ingin menghapus data rental unit <strong>${escapeHtml(rec.no_unit)}</strong> tanggal <strong>${formatDateID(rec.tanggal)}</strong> (${escapeHtml(rec.job)})?`,
        confirmText: 'Ya, Hapus Data',
        onConfirm: () => {
            rentalBibState = rentalBibState.filter(item => Number(item.id) !== Number(editId));
            closeRentalModal();
            renderRentalBibTable();
            showToast(`Data rental ${rec.no_unit} telah dihapus.`, 'info');
        }
    });
}

/* ----- TIME FRAME BIG CRANE (TAMBAH SCHEDULE, TGL 1-30/31, STATUS & PLANNING/ACTUAL KLIK-EDIT, HAPUS VIA NO UNIT) ----- */
const CRANE_CODE_STYLE = {
    P: { label: 'P', title: 'Planning', cls: 'bg-yellow-300 text-gray-900 font-bold' },
    R: { label: 'R', title: 'Reschedule', cls: 'bg-amber-700 text-white font-bold' },
    A: { label: 'A', title: 'Action', cls: 'bg-emerald-600 text-white font-bold' },
    C: { label: 'C', title: 'Cancel', cls: 'bg-red-600 text-white font-bold' }
};

const CRANE_ROW_STATUS_ORDER = ['Schedule', 'Open', 'Planning', 'Progress', 'Done'];
const CRANE_ROW_STATUS_STYLE = {
    Schedule: 'bg-sky-100 text-sky-700 border border-sky-200',
    Open: 'bg-amber-100 text-amber-700 border border-amber-200',
    Planning: 'bg-yellow-100 text-amber-800 border border-yellow-200',
    Progress: 'bg-indigo-100 text-indigo-700 border border-indigo-200',
    Done: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
};

function cycleCraneRowStatus(scheduleId) {
    const sched = bigCraneTimeframeState.find(item => Number(item.id) === Number(scheduleId));
    if (!sched) return;

    const current = CRANE_ROW_STATUS_ORDER.includes(sched.status) ? sched.status : 'Schedule';
    const nextIdx = (CRANE_ROW_STATUS_ORDER.indexOf(current) + 1) % CRANE_ROW_STATUS_ORDER.length;
    sched.status = CRANE_ROW_STATUS_ORDER[nextIdx];
    renderBigCraneTimeframeTable();
}

function toggleCraneSort(column) {
    if (craneSortState.column !== column) {
        craneSortState = { column, direction: 'desc' };
    } else if (craneSortState.direction === 'desc') {
        craneSortState.direction = 'asc';
    } else {
        craneSortState = { column: null, direction: 'none' };
    }
    renderBigCraneTimeframeTable();
}

/**
 * Mengubah kode P / R / A / C pada sel tanggal secara langsung saat diklik.
 * Baris Planning berurutan: kosong -> P -> R -> C -> A -> kosong.
 * Baris Aktual berurutan: kosong -> A -> R -> C -> P -> kosong.
 */
function cycleCraneCellCode(scheduleId, rowType, dayNum) {
    const sched = bigCraneTimeframeState.find(item => Number(item.id) === Number(scheduleId));
    if (!sched) return;

    const bucket = rowType === 'aktual' ? (sched.aktual = sched.aktual || {}) : (sched.planning = sched.planning || {});
    const order = rowType === 'aktual' ? ['', 'A', 'R', 'C', 'P'] : ['', 'P', 'R', 'C', 'A'];
    const current = bucket[dayNum] || '';
    const nextCode = order[(order.indexOf(current) + 1) % order.length];

    if (nextCode) {
        bucket[dayNum] = nextCode;
    } else {
        delete bucket[dayNum];
    }
    renderBigCraneTimeframeTable();
}

function renderBigCraneTimeframeTable() {
    const thead = document.getElementById('crane-timeframe-thead');
    const tbody = document.getElementById('crane-timeframe-tbody');
    if (!thead || !tbody) return;

    const query = (document.getElementById('crane-search')?.value || '').trim().toLowerCase();
    const monthIdx = parseInt(document.getElementById('crane-filter-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('crane-filter-year')?.value ?? '2026', 10);
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    const getIconCls = (col) => {
        if (craneSortState.column === col && craneSortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (craneSortState.column === col && craneSortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };

    let dayHeaders = '';
    for (let d = 1; d <= daysInMonth; d++) {
        dayHeaders += `
                    <th onclick="toggleCraneSort('d${d}')" class="py-2.5 px-1.5 text-center font-normal cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/60 last:border-r-0 min-w-[34px]">
                        <div class="flex items-center justify-center gap-0.5"><span>${d}</span><i class="fa-solid ${getIconCls('d' + d)} text-[7px]"></i></div>
                    </th>
                `;
    }

    thead.innerHTML = `
                <tr class="bg-gray-50 text-[10px] font-normal text-gray-600">
                    <th onclick="toggleCraneSort('no_unit')" class="py-2.5 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap sticky left-0 bg-gray-50 z-20 w-[86px] min-w-[86px] max-w-[86px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                        <div class="flex items-center justify-between gap-1.5"><span>No Unit</span><i class="fa-solid ${getIconCls('no_unit')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleCraneSort('user')" class="py-2.5 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/60 min-w-[130px]">
                        <div class="flex items-center justify-between gap-2"><span>User</span><i class="fa-solid ${getIconCls('user')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleCraneSort('pekerjaan')" class="py-2.5 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/60 min-w-[175px]">
                        <div class="flex items-center justify-between gap-2"><span>Pekerjaan</span><i class="fa-solid ${getIconCls('pekerjaan')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleCraneSort('lokasi')" class="py-2.5 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/60 min-w-[130px]">
                        <div class="flex items-center justify-between gap-2"><span>Lokasi</span><i class="fa-solid ${getIconCls('lokasi')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleCraneSort('status')" class="py-2.5 px-2.5 text-center font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/80 min-w-[92px]">
                        <div class="flex items-center justify-center gap-1.5"><span>Status</span><i class="fa-solid ${getIconCls('status')} text-[9px]"></i></div>
                    </th>
                    <th title="Planning / Actual" class="py-2.5 px-2.5 text-center font-normal whitespace-nowrap bg-gray-50 border-b border-r border-gray-200/80 min-w-[76px]">
                        <span>P/A</span>
                    </th>
                    ${dayHeaders}
                </tr>
            `;

    let rows = bigCraneTimeframeState.filter(item => {
        if (Number(item.month) !== monthIdx || Number(item.year) !== year) return false;
        if (query) {
            const hay = `${item.no_unit} ${item.user} ${item.pekerjaan} ${item.lokasi} ${item.status || ''}`.toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    if (craneSortState.column && craneSortState.direction !== 'none') {
        const col = craneSortState.column;
        const dir = craneSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (/^d\d+$/.test(col)) {
                const dayNum = parseInt(col.slice(1), 10);
                const vA = (a.aktual?.[dayNum] || a.planning?.[dayNum] || '');
                const vB = (b.aktual?.[dayNum] || b.planning?.[dayNum] || '');
                return vA.localeCompare(vB, 'id') * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${daysInMonth + 6}" class="py-10 text-center text-xs text-gray-400">Belum ada schedule Big Crane untuk ${MONTH_NAMES_ID[monthIdx]} ${year}. Klik <strong>+ Tambah Schedule</strong> untuk membuat jadwal baru.</td></tr>`;
        return;
    }

    const renderDayButton = (schedId, rowType, dayNum, code) => {
        const st = CRANE_CODE_STYLE[code];
        const btnCls = st
            ? `w-7 h-6 rounded ${st.cls} text-[9px] flex items-center justify-center mx-auto shadow-xs hover:opacity-85 transition-opacity cursor-pointer`
            : 'w-7 h-6 rounded text-gray-300 hover:bg-teal-50 hover:text-teal-600 text-[9px] flex items-center justify-center mx-auto transition-colors cursor-pointer';
        const tooltip = st
            ? `${rowType === 'planning' ? 'Planning' : 'Aktual'} Tgl ${dayNum}: ${st.title} (Klik untuk ubah)`
            : `${rowType === 'planning' ? 'Planning' : 'Aktual'} Tgl ${dayNum}: Kosong (Klik untuk isi kode)`;
        return `
                    <td class="py-1 px-0.5 text-center border-b ${rowType === 'aktual' ? 'border-gray-200/90' : 'border-gray-200/50'} border-r border-gray-200/55 last:border-r-0 whitespace-nowrap">
                        <button type="button" onclick="cycleCraneCellCode(${Number(schedId)}, '${rowType}', ${dayNum})" title="${tooltip}" class="${btnCls}">
                            ${st ? st.label : '·'}
                        </button>
                    </td>
                `;
    };

    tbody.innerHTML = rows.map((item, idx) => {
        const unitCode = String(item.no_unit || '').trim().toUpperCase();
        const bgBase = unitCode === 'GR501'
            ? 'bg-gray-50'
            : (unitCode === 'MC7001' ? 'bg-white' : (idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'));
        let planCells = '';
        let actCells = '';
        for (let d = 1; d <= daysInMonth; d++) {
            planCells += renderDayButton(item.id, 'planning', d, item.planning?.[d] || '');
            actCells += renderDayButton(item.id, 'aktual', d, item.aktual?.[d] || '');
        }

        const rowStatus = CRANE_ROW_STATUS_ORDER.includes(item.status) ? item.status : 'Schedule';
        const statusBadgeCls = CRANE_ROW_STATUS_STYLE[rowStatus] || CRANE_ROW_STATUS_STYLE.Schedule;

        return `
                    <tr class="${bgBase} transition-colors">
                        <td rowspan="2" class="py-2.5 px-3 align-middle whitespace-nowrap sticky left-0 z-10 ${bgBase} w-[86px] min-w-[86px] max-w-[86px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)]">
                            <button
                                type="button"
                                onclick="openCraneScheduleDetailModal(${Number(item.id)})"
                                title="Klik No Unit untuk edit detail schedule atau hapus baris"
                                class="font-mono font-semibold text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
                            >${escapeHtml(item.no_unit)}</button>
                        </td>
                        <td rowspan="2" class="py-2.5 px-3 align-middle text-gray-800 border-b border-r border-gray-200/60 whitespace-nowrap">${escapeHtml(item.user || '-')}</td>
                        <td rowspan="2" class="py-2.5 px-3 align-middle text-gray-700 border-b border-r border-gray-200/60 min-w-[175px]">${escapeHtml(item.pekerjaan || '-')}</td>
                        <td rowspan="2" class="py-2.5 px-3 align-middle text-gray-600 border-b border-r border-gray-200/60 whitespace-nowrap">${escapeHtml(item.lokasi || '-')}</td>
                        <td rowspan="2" class="py-2 px-2.5 text-center align-middle border-b border-r border-gray-200/80 whitespace-nowrap">
                            <button
                                type="button"
                                onclick="cycleCraneRowStatus(${Number(item.id)})"
                                title="Klik untuk ubah status (Schedule → Open → Planning → Progress → Done)"
                                class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[9px] font-semibold cursor-pointer hover:ring-2 hover:ring-teal-300 transition-all ${statusBadgeCls}"
                            >${escapeHtml(rowStatus)}</button>
                        </td>
                        <td class="py-1.5 px-2.5 text-center border-b border-gray-200/50 border-r border-gray-200/80 whitespace-nowrap">
                            <span class="inline-block px-2 py-0.5 rounded bg-yellow-100 text-amber-800 text-[9px] font-semibold">Planning</span>
                        </td>
                        ${planCells}
                    </tr>
                    <tr class="${bgBase} transition-colors">
                        <td class="py-1.5 px-2.5 text-center border-b border-gray-200/90 border-r border-gray-200/80 whitespace-nowrap">
                            <span class="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-semibold">Actual</span>
                        </td>
                        ${actCells}
                    </tr>
                `;
    }).join('');
}

function openCraneScheduleModal() {
    const form = document.getElementById('form-crane-schedule');
    if (form) form.reset();

    const curMonth = document.getElementById('crane-filter-month')?.value ?? String(new Date().getMonth());
    const curYear = document.getElementById('crane-filter-year')?.value ?? String(new Date().getFullYear());
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    setVal('crane-edit-id', '');
    setVal('crane-no-unit', 'MC7001');
    setVal('crane-status', 'Schedule');
    setVal('crane-sched-month', curMonth);
    setVal('crane-sched-year', curYear);

    const titleEl = document.getElementById('modal-crane-title');
    const subEl = document.getElementById('modal-crane-subtitle');
    const submitTxt = document.getElementById('btn-submit-crane-text');
    const delBtn = document.getElementById('btn-delete-crane-schedule');
    const rangeWrap = document.getElementById('crane-plan-range-wrap');

    if (titleEl) titleEl.textContent = 'Tambah Schedule Big Crane';
    if (subEl) subEl.textContent = 'Buat jadwal planning unit MC7001 / GR501';
    if (submitTxt) submitTxt.textContent = 'Simpan Schedule';
    if (delBtn) { delBtn.classList.add('hidden'); delBtn.classList.remove('inline-flex'); }
    if (rangeWrap) rangeWrap.classList.remove('hidden');

    const modal = document.getElementById('modal-crane-schedule');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function openCraneScheduleDetailModal(id) {
    const sched = bigCraneTimeframeState.find(item => Number(item.id) === Number(id));
    if (!sched) return;

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ''; };
    setVal('crane-edit-id', String(sched.id));
    setVal('crane-no-unit', sched.no_unit);
    setVal('crane-user-req', sched.user);
    setVal('crane-pekerjaan', sched.pekerjaan);
    setVal('crane-lokasi', sched.lokasi);
    setVal('crane-status', CRANE_ROW_STATUS_ORDER.includes(sched.status) ? sched.status : 'Schedule');
    setVal('crane-sched-month', String(sched.month));
    setVal('crane-sched-year', String(sched.year));
    setVal('crane-plan-start', '');
    setVal('crane-plan-end', '');

    const titleEl = document.getElementById('modal-crane-title');
    const subEl = document.getElementById('modal-crane-subtitle');
    const submitTxt = document.getElementById('btn-submit-crane-text');
    const delBtn = document.getElementById('btn-delete-crane-schedule');
    const rangeWrap = document.getElementById('crane-plan-range-wrap');

    if (titleEl) titleEl.textContent = `Detail & Edit Schedule — ${sched.no_unit}`;
    if (subEl) subEl.textContent = `${sched.user} • ${MONTH_NAMES_ID[sched.month]} ${sched.year}`;
    if (submitTxt) submitTxt.textContent = 'Simpan Perubahan';
    if (delBtn) { delBtn.classList.remove('hidden'); delBtn.classList.add('inline-flex'); }
    if (rangeWrap) rangeWrap.classList.add('hidden');

    const modal = document.getElementById('modal-crane-schedule');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeCraneScheduleModal() {
    const modal = document.getElementById('modal-crane-schedule');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function handleCraneScheduleSubmit(event) {
    event.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const editId = getVal('crane-edit-id');
    const noUnit = getVal('crane-no-unit');
    const userReq = getVal('crane-user-req');
    const pekerjaan = getVal('crane-pekerjaan');
    const lokasi = getVal('crane-lokasi');
    const status = CRANE_ROW_STATUS_ORDER.includes(getVal('crane-status')) ? getVal('crane-status') : 'Schedule';
    const month = parseInt(getVal('crane-sched-month') || '10', 10);
    const year = parseInt(getVal('crane-sched-year') || '2026', 10);

    if (!noUnit || !userReq || !pekerjaan || !lokasi) {
        showToast('No Unit, User, Pekerjaan, dan Lokasi wajib diisi.', 'error');
        return;
    }

    if (editId) {
        const idx = bigCraneTimeframeState.findIndex(item => Number(item.id) === Number(editId));
        if (idx !== -1) {
            bigCraneTimeframeState[idx] = {
                ...bigCraneTimeframeState[idx],
                no_unit: noUnit,
                user: userReq,
                pekerjaan,
                lokasi,
                status,
                month,
                year
            };
        }
        closeCraneScheduleModal();
        const mFilter = document.getElementById('crane-filter-month');
        const yFilter = document.getElementById('crane-filter-year');
        if (mFilter) mFilter.value = String(month);
        if (yFilter) yFilter.value = String(year);
        renderBigCraneTimeframeTable();
        showToast(`Schedule ${noUnit} berhasil diperbarui.`, 'success');
    } else {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = parseInt(getVal('crane-plan-start'), 10);
        const endDay = parseInt(getVal('crane-plan-end'), 10);
        const planning = {};

        if (!isNaN(startDay) && startDay >= 1 && startDay <= daysInMonth) {
            const finalEnd = (!isNaN(endDay) && endDay >= startDay) ? Math.min(endDay, daysInMonth) : startDay;
            for (let d = startDay; d <= finalEnd; d++) {
                planning[d] = 'P';
            }
        }

        const nextId = bigCraneTimeframeState.reduce((m, item) => Math.max(m, Number(item.id) || 0), 0) + 1;
        bigCraneTimeframeState.push({
            id: nextId,
            no_unit: noUnit,
            user: userReq,
            pekerjaan,
            lokasi,
            status,
            month,
            year,
            planning,
            aktual: {}
        });

        closeCraneScheduleModal();
        const mFilter = document.getElementById('crane-filter-month');
        const yFilter = document.getElementById('crane-filter-year');
        if (mFilter) mFilter.value = String(month);
        if (yFilter) yFilter.value = String(year);
        renderBigCraneTimeframeTable();
        showToast(`Schedule ${noUnit} ditambahkan. Klik sel tanggal untuk mengisi Planning / Aktual.`, 'success');
    }
}

function deleteCraneScheduleFromModal() {
    const editId = document.getElementById('crane-edit-id')?.value;
    const sched = bigCraneTimeframeState.find(item => Number(item.id) === Number(editId));
    if (!sched) return;

    openConfirmDeleteModal({
        title: 'Konfirmasi Hapus Schedule Big Crane',
        message: `Apakah Anda yakin ingin menghapus schedule unit <strong>${escapeHtml(sched.no_unit)}</strong> — ${escapeHtml(sched.pekerjaan)} (${escapeHtml(sched.user)})?`,
        confirmText: 'Ya, Hapus Schedule',
        onConfirm: () => {
            bigCraneTimeframeState = bigCraneTimeframeState.filter(item => Number(item.id) !== Number(editId));
            closeCraneScheduleModal();
            renderBigCraneTimeframeTable();
            showToast(`Schedule unit ${sched.no_unit} telah dihapus.`, 'info');
        }
    });
}

/* ----- DATA KOMISIONING UNIT (SEARCH, TAMBAH, KLIK NO LAMBUNG DETAIL/EDIT/HAPUS) ----- */
function toggleKomisioningSort(column) {
    if (komisioningSortState.column !== column) {
        komisioningSortState = { column, direction: 'desc' };
    } else if (komisioningSortState.direction === 'desc') {
        komisioningSortState.direction = 'asc';
    } else {
        komisioningSortState = { column: null, direction: 'none' };
    }
    updateKomisioningSortIndicators();
    renderKomisioningTable();
}

function updateKomisioningSortIndicators() {
    document.querySelectorAll('[data-kom-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-kom-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (komisioningSortState.column === col && komisioningSortState.direction === 'desc') {
            icon.classList.add('fa-sort-down', 'text-teal-600');
        } else if (komisioningSortState.column === col && komisioningSortState.direction === 'asc') {
            icon.classList.add('fa-sort-up', 'text-teal-600');
        } else {
            icon.classList.add('fa-sort', 'text-gray-300');
        }
    });
}

function renderKomisioningTable() {
    const tbody = document.getElementById('komisioning-table-body');
    if (!tbody) return;

    const query = (document.getElementById('komisioning-search')?.value || '').trim().toLowerCase();
    let rows = komisioningState.filter(u =>
        !query || `${u.no_unit} ${u.model_tipe}`.toLowerCase().includes(query)
    );

    if (komisioningSortState.column && komisioningSortState.direction !== 'none') {
        const col = komisioningSortState.column;
        const dir = komisioningSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col.startsWith('KOMISIONING_')) {
                const dA = a[col] ? getDiffDaysFromToday(a[col]) : 999999;
                const dB = b[col] ? getDiffDaysFromToday(b[col]) : 999999;
                return (dA - dB) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-10 text-center text-xs text-gray-400">Data komisioning unit tidak ditemukan.</td></tr>';
    } else {
        tbody.innerHTML = rows.map(unit => `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 whitespace-nowrap">
                            <button
                                type="button"
                                onclick="openKomisioningDetailModal(${Number(unit.id)})"
                                title="Klik No Lambung Unit untuk lihat detail, edit exp komisioning, atau hapus unit"
                                class="font-mono text-teal-600 hover:text-teal-800 hover:underline cursor-pointer"
                            >${escapeHtml(unit.no_unit)}</button>
                        </td>
                        <td class="py-3 px-4 text-gray-700 whitespace-nowrap">${escapeHtml(unit.model_tipe)}</td>
                        ${renderDocCellHtml('KOMISIONING_BIB', unit.KOMISIONING_BIB, Boolean(unit.KOMISIONING_BIB))}
                        ${renderDocCellHtml('KOMISIONING_TIA', unit.KOMISIONING_TIA, Boolean(unit.KOMISIONING_TIA))}
                        ${renderDocCellHtml('KOMISIONING_TMA', unit.KOMISIONING_TMA, Boolean(unit.KOMISIONING_TMA))}
                    </tr>
                `).join('');
    }

    // Sinkronisasi realtime ke Dokumen Analisis serta HM Unit & UA Unit
    renderDokumenAnalisis();
    renderHmUaTables();
}

function openKomisioningModal() {
    const form = document.getElementById('form-komisioning');
    if (form) form.reset();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('kom-edit-id', '');

    const titleEl = document.getElementById('modal-komisioning-title');
    const subEl = document.getElementById('modal-komisioning-subtitle');
    const submitTxt = document.getElementById('btn-submit-komisioning-text');
    const delBtn = document.getElementById('btn-delete-komisioning');

    if (titleEl) titleEl.textContent = 'Tambah Unit Komisioning';
    if (subEl) subEl.textContent = 'Otomatis tersinkronisasi ke menu HM Unit & UA Unit';
    if (submitTxt) submitTxt.textContent = 'Simpan Unit';
    if (delBtn) { delBtn.classList.add('hidden'); delBtn.classList.remove('inline-flex'); }

    const modal = document.getElementById('modal-komisioning');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function openKomisioningDetailModal(id) {
    const unit = komisioningState.find(u => Number(u.id) === Number(id));
    if (!unit) return;

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
    setVal('kom-edit-id', String(unit.id));
    setVal('kom-no-unit', unit.no_unit);
    setVal('kom-model-tipe', unit.model_tipe);
    setVal('kom-exp-bib', unit.KOMISIONING_BIB);
    setVal('kom-exp-tia', unit.KOMISIONING_TIA);
    setVal('kom-exp-tma', unit.KOMISIONING_TMA);

    const titleEl = document.getElementById('modal-komisioning-title');
    const subEl = document.getElementById('modal-komisioning-subtitle');
    const submitTxt = document.getElementById('btn-submit-komisioning-text');
    const delBtn = document.getElementById('btn-delete-komisioning');

    if (titleEl) titleEl.textContent = `Detail & Edit Unit — ${unit.no_unit}`;
    if (subEl) subEl.textContent = `${unit.model_tipe} • Perubahan otomatis tersinkron ke HM & UA`;
    if (submitTxt) submitTxt.textContent = 'Simpan Perubahan';
    if (delBtn) { delBtn.classList.remove('hidden'); delBtn.classList.add('inline-flex'); }

    const modal = document.getElementById('modal-komisioning');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeKomisioningModal() {
    const modal = document.getElementById('modal-komisioning');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function handleKomisioningSubmit(event) {
    event.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const editId = getVal('kom-edit-id');
    const noUnit = getVal('kom-no-unit').toUpperCase();
    const modelTipe = getVal('kom-model-tipe');

    if (!noUnit || !modelTipe) {
        showToast('No Lambung Unit dan Model / Tipe wajib diisi.', 'error');
        return;
    }

    const payload = {
        no_unit: noUnit,
        model_tipe: modelTipe,
        KOMISIONING_BIB: getVal('kom-exp-bib'),
        KOMISIONING_TIA: getVal('kom-exp-tia'),
        KOMISIONING_TMA: getVal('kom-exp-tma')
    };

    if (editId) {
        const idx = komisioningState.findIndex(u => Number(u.id) === Number(editId));
        if (idx !== -1) {
            komisioningState[idx] = { ...komisioningState[idx], ...payload };
        }
        closeKomisioningModal();
        syncAllMasterConnections(false);
        showToast(`Data komisioning unit ${noUnit} berhasil diperbarui.`, 'success');
    } else {
        const isDup = komisioningState.some(u => normalizeUnitKey(u.no_unit) === normalizeUnitKey(noUnit));
        if (isDup) {
            showToast(`Unit ${noUnit} sudah terdaftar di Data Komisioning Unit.`, 'error');
            return;
        }
        const nextId = komisioningState.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0) + 1;
        komisioningState.push({
            id: nextId,
            kategori_unit: getUnitCategoryGroup(noUnit, modelTipe),
            hm_rate: 10.0,
            rental_rate: 0,
            ...payload
        });
        closeKomisioningModal();
        syncAllMasterConnections(false);
        showToast(`Unit ${noUnit} ditambahkan & otomatis tampil di HM Unit, UA Unit, dan Master Data.`, 'success');
    }
}

function deleteKomisioningFromModal() {
    const editId = document.getElementById('kom-edit-id')?.value;
    const unit = komisioningState.find(u => Number(u.id) === Number(editId));
    if (!unit) return;

    openConfirmDeleteModal({
        title: 'Konfirmasi Hapus Unit Komisioning',
        message: `Apakah Anda yakin ingin menghapus unit <strong>${escapeHtml(unit.no_unit)}</strong> (${escapeHtml(unit.model_tipe)})? Unit ini juga akan otomatis terhapus dari daftar <strong>HM Unit</strong>, <strong>UA Unit</strong>, dan <strong>Master Data</strong>.`,
        confirmText: 'Ya, Hapus Unit',
        onConfirm: () => {
            komisioningState = komisioningState.filter(u => Number(u.id) !== Number(editId));
            closeKomisioningModal();
            syncAllMasterConnections(false);
            showToast(`Unit ${unit.no_unit} dihapus dari Komisioning, HM Unit, UA Unit & Master Data.`, 'info');
        }
    });
}
