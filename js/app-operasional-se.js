/* =====================================================================
 * MODUL OPERASIONAL SE (LUBETRUCK / WATERTRUCK & LIFTING)
 * - Lubetruck / Watertruck: 23 kolom (Multi-Sheet Excel otomatis digabung jadi 1 tabel)
 * - Lifting: 28 kolom (Single-Sheet Excel)
 * - Persistensi lokal (localStorage), filter dinamis, sorting, & export Excel
 * ===================================================================== */

const OPS_LTWT_STORAGE_KEY = 'pantau_se_ops_ltwt_v1';
const OPS_LIFTING_STORAGE_KEY = 'pantau_se_ops_lifting_v1';

const OPS_LTWT_COLUMNS = [
    { key: 'no', label: 'No', aliases: ['no', 'no.', 'nomor'] },
    { key: 'noId', label: 'No ID', aliases: ['no id', 'noid', 'id', 'id job', 'job id'] },
    { key: 'timestamp', label: 'Timestamp', aliases: ['timestamp', 'time stamp', 'waktu input', 'created at'] },
    { key: 'jenisJob', label: 'Jenis Job', aliases: ['jenis job', 'jenisjob', 'job', 'kategori job', 'tipe job', 'pekerjaan'] },
    { key: 'plan', label: 'Plan', aliases: ['plan', 'rencana', 'plan job', 'tgl plan'] },
    { key: 'waktu', label: 'Waktu', aliases: ['waktu', 'jam', 'jam plan', 'time'] },
    { key: 'shift', label: 'Shift', aliases: ['shift', 'shif'] },
    { key: 'typeUnit', label: 'Type Unit', aliases: ['type unit', 'tipe unit', 'type', 'model unit'] },
    { key: 'noUnit', label: 'No Unit', aliases: ['no unit', 'nounit', 'unit', 'kode unit', 'cn', 'code number'] },
    { key: 'cluster', label: 'Cluster', aliases: ['cluster', 'klaster', 'area', 'pit'] },
    { key: 'lokasi', label: 'Lokasi', aliases: ['lokasi', 'location', 'tempat'] },
    { key: 'hmStart', label: 'HM Start', aliases: ['hm start', 'hmstart', 'hm awal'] },
    { key: 'hmEnd', label: 'HM End', aliases: ['hm end', 'hmend', 'hm akhir', 'hm stop'] },
    { key: 'tglAction', label: 'Tgl Action', aliases: ['tgl action', 'tanggal action', 'tgl aksi', 'tanggal', 'date'] },
    { key: 'start', label: 'Start', aliases: ['start', 'jam start', 'mulai', 'start time'] },
    { key: 'end', label: 'End', aliases: ['end', 'jam end', 'selesai', 'finish', 'end time'] },
    { key: 'durasi', label: 'Durasi', aliases: ['durasi', 'duration', 'lama'] },
    { key: 'status', label: 'Status', aliases: ['status', 'status job', 'keterangan status'] },
    { key: 'temuanKendala', label: 'Temuan/Kendala', aliases: ['temuan/kendala', 'temuan / kendala', 'temuan', 'kendala', 'catatan', 'remarks'] },
    { key: 'armada', label: 'Armada', aliases: ['armada', 'unit armada', 'lt/wt', 'unit se'] },
    { key: 'opt', label: 'OPT', aliases: ['opt', 'operator', 'driver'] },
    { key: 'mp1', label: 'MP 1', aliases: ['mp 1', 'mp1', 'manpower 1', 'helper 1', 'oilman 1', 'washingman 1'] },
    { key: 'mp2', label: 'MP 2', aliases: ['mp 2', 'mp2', 'manpower 2', 'helper 2', 'oilman 2', 'washingman 2'] }
];

const OPS_LIFTING_COLUMNS = [
    { key: 'no', label: 'No', aliases: ['no', 'no.', 'nomor'] },
    { key: 'noWo', label: 'No WO', aliases: ['no wo', 'nowo', 'wo', 'no. wo', 'work order', 'no work order'] },
    { key: 'timestamp', label: 'Timestamp', aliases: ['timestamp', 'time stamp', 'waktu input'] },
    { key: 'kategori', label: 'Kategori', aliases: ['kategori', 'category', 'jenis lifting', 'jenis'] },
    { key: 'nrpPemohon', label: 'NRP Pemohon', aliases: ['nrp pemohon', 'nrp', 'nik pemohon'] },
    { key: 'namaPemohon', label: 'Nama Pemohon', aliases: ['nama pemohon', 'pemohon', 'requestor', 'nama requestor'] },
    { key: 'perusahaan', label: 'Perusahaan', aliases: ['perusahaan', 'company', 'mitra'] },
    { key: 'departemen', label: 'Departemen', aliases: ['departemen', 'dept', 'department'] },
    { key: 'section', label: 'Section', aliases: ['section', 'seksi', 'bagian'] },
    { key: 'noWa', label: 'No WA', aliases: ['no wa', 'nowa', 'no. wa', 'whatsapp', 'no hp', 'telepon', 'kontak'] },
    { key: 'tglPelaksanaan', label: 'Tgl Pelaksanaan', aliases: ['tgl pelaksanaan', 'tanggal pelaksanaan', 'tgl', 'tanggal'] },
    { key: 'jamPelaksanaan', label: 'Jam Pelaksanaan', aliases: ['jam pelaksanaan', 'jam', 'waktu pelaksanaan'] },
    { key: 'shift', label: 'Shift', aliases: ['shift', 'shif'] },
    { key: 'durasiRequest', label: 'Durasi Request', aliases: ['durasi request', 'durasi req', 'estimasi durasi', 'plan durasi'] },
    { key: 'lokasiAsal', label: 'Lokasi Asal', aliases: ['lokasi asal', 'asal', 'from', 'pickup'] },
    { key: 'lokasiTujuan', label: 'Lokasi Tujuan', aliases: ['lokasi tujuan', 'tujuan', 'to', 'destination'] },
    { key: 'deskripsi', label: 'Deskripsi', aliases: ['deskripsi', 'deskripsi pekerjaan', 'pekerjaan', 'uraian', 'detail job'] },
    { key: 'status', label: 'Status', aliases: ['status', 'status wo'] },
    { key: 'gl', label: 'GL', aliases: ['gl', 'group leader', 'pengawas'] },
    { key: 'unit', label: 'Unit', aliases: ['unit', 'no unit', 'unit lifting', 'crane', 'armada'] },
    { key: 'operator', label: 'Operator', aliases: ['operator', 'opt'] },
    { key: 'rigger1', label: 'Rigger 1', aliases: ['rigger 1', 'rigger1'] },
    { key: 'rigger2', label: 'Rigger 2', aliases: ['rigger 2', 'rigger2'] },
    { key: 'jamStartAktual', label: 'Jam Start Aktual', aliases: ['jam start aktual', 'start aktual', 'jam start', 'actual start'] },
    { key: 'jamEndAktual', label: 'Jam End Aktual', aliases: ['jam end aktual', 'end aktual', 'jam end', 'actual end'] },
    { key: 'durasiAktual', label: 'Durasi Aktual', aliases: ['durasi aktual', 'actual duration', 'durasi'] },
    { key: 'finalInspeksi', label: 'Final Inspeksi', aliases: ['final inspeksi', 'inspeksi', 'hasil inspeksi', 'qc'] },
    { key: 'kendalaLapangan', label: 'Kendala Lapangan', aliases: ['kendala lapangan', 'kendala', 'temuan', 'catatan', 'remarks'] }
];

const OPS_LTWT_SEED = [];

const OPS_LIFTING_SEED = [];

let opsLtWtState = [];
let opsLiftingState = [];
let pendingOpsLtWtUpload = [];
let pendingOpsLtWtSheets = [];
let pendingOpsLiftingUpload = [];
let opsLtWtSortState = { key: null, dir: 'none' };
let opsLiftingSortState = { key: null, dir: 'none' };
let opsLtWtPage = 1;
let opsLtWtLastSig = '';
let opsLiftingPage = 1;
let opsLiftingLastSig = '';
let opsStateInitialized = false;

function initOperasionalSeState() {
    if (opsStateInitialized) return;
    opsStateInitialized = true;
    try {
        const rawLt = localStorage.getItem(OPS_LTWT_STORAGE_KEY);
        const parsedLt = rawLt ? JSON.parse(rawLt) : null;
        opsLtWtState = Array.isArray(parsedLt)
            ? parsedLt.filter(r => !String(r?.id || '').startsWith('seed-'))
            : [];
        if (Array.isArray(parsedLt) && opsLtWtState.length !== parsedLt.length) {
            localStorage.setItem(OPS_LTWT_STORAGE_KEY, JSON.stringify(opsLtWtState));
        }
    } catch (_) {
        opsLtWtState = [];
    }
    try {
        const rawLift = localStorage.getItem(OPS_LIFTING_STORAGE_KEY);
        const parsedLift = rawLift ? JSON.parse(rawLift) : null;
        opsLiftingState = Array.isArray(parsedLift)
            ? parsedLift.filter(r => !String(r?.id || '').startsWith('seed-'))
            : [];
        if (Array.isArray(parsedLift) && opsLiftingState.length !== parsedLift.length) {
            localStorage.setItem(OPS_LIFTING_STORAGE_KEY, JSON.stringify(opsLiftingState));
        }
    } catch (_) {
        opsLiftingState = [];
    }
    window.opsLtWtState = opsLtWtState;
    window.opsLiftingState = opsLiftingState;
}

function persistOpsLtWtState() {
    window.opsLtWtState = opsLtWtState;
    try { localStorage.setItem(OPS_LTWT_STORAGE_KEY, JSON.stringify(opsLtWtState)); } catch (_) { }
}

function persistOpsLiftingState() {
    window.opsLiftingState = opsLiftingState;
    try { localStorage.setItem(OPS_LIFTING_STORAGE_KEY, JSON.stringify(opsLiftingState)); } catch (_) { }
}

function normalizeOpsHeaderKey(str) {
    return String(str || '')
        .replace(/\r?\n/g, ' ')
        .replace(/[^a-zA-Z0-9/]+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function formatOpsExcelDateCell(raw, includeTime = false) {
    if (raw === null || raw === undefined || raw === '') return '';
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        const y = raw.getFullYear();
        const m = String(raw.getMonth() + 1).padStart(2, '0');
        const d = String(raw.getDate()).padStart(2, '0');
        if (!includeTime) return `${y}-${m}-${d}`;
        const hh = String(raw.getHours()).padStart(2, '0');
        const mm = String(raw.getMinutes()).padStart(2, '0');
        const ss = String(raw.getSeconds()).padStart(2, '0');
        return `${d}/${m}/${y} ${hh}:${mm}:${ss}`;
    }
    if (typeof raw === 'number' && raw > 25000 && raw < 80000) {
        const wholeDays = Math.floor(raw);
        const frac = raw - wholeDays;
        const utcMs = Math.round((wholeDays - 25569) * 86400 * 1000);
        const dt = new Date(utcMs);
        if (!isNaN(dt.getTime())) {
            const y = dt.getUTCFullYear();
            const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dt.getUTCDate()).padStart(2, '0');
            if (!includeTime && frac < 0.0001) return `${y}-${m}-${d}`;
            const totalSec = Math.round(frac * 86400);
            const hh = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
            const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
            const ss = String(totalSec % 60).padStart(2, '0');
            return includeTime ? `${d}/${m}/${y} ${hh}:${mm}:${ss}` : `${y}-${m}-${d}`;
        }
    }
    const s = String(raw).trim();
    if (!includeTime && typeof normalizeExcelDate === 'function') {
        const iso = normalizeExcelDate(s);
        if (iso) return iso;
    }
    return s;
}

function formatOpsExcelTimeCell(raw) {
    if (raw === null || raw === undefined || raw === '') return '';
    if (raw instanceof Date && !isNaN(raw.getTime())) {
        return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`;
    }
    if (typeof raw === 'number' && raw >= 0 && raw < 1) {
        const totalMin = Math.round(raw * 24 * 60);
        const hh = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
        const mm = String(totalMin % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    if (typeof raw === 'number' && raw >= 1 && raw < 10) {
        const totalMin = Math.round(raw * 24 * 60);
        const hh = String(Math.floor(totalMin / 60)).padStart(2, '0');
        const mm = String(totalMin % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }
    return String(raw).trim();
}

function formatOpsTextCell(raw) {
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'number') return Number.isInteger(raw) ? String(raw) : String(Number(raw.toFixed(2)));
    return String(raw).trim();
}

function detectHeaderRowAndMap(aoaRows, columnDefs) {
    const maxScan = Math.min(aoaRows.length, 12);
    let bestRowIdx = -1;
    let bestMap = {};
    let bestScore = 0;

    for (let r = 0; r < maxScan; r++) {
        const row = aoaRows[r];
        if (!Array.isArray(row)) continue;
        const map = {};
        let score = 0;
        row.forEach((cell, cIdx) => {
            const norm = normalizeOpsHeaderKey(cell);
            if (!norm) return;
            for (const col of columnDefs) {
                if (map[col.key] !== undefined) continue;
                const normLabel = normalizeOpsHeaderKey(col.label);
                if (norm === normLabel || col.aliases.includes(norm)) {
                    map[col.key] = cIdx;
                    score++;
                    break;
                }
            }
        });
        if (score > bestScore) {
            bestScore = score;
            bestRowIdx = r;
            bestMap = map;
        }
    }
    return { headerRowIdx: bestRowIdx, colMap: bestMap, score: bestScore };
}

function getOpsStatusBadgeClass(statusStr) {
    const s = String(statusStr || '').trim().toLowerCase();
    if (!s || s === '-') return 'bg-gray-100 text-gray-500';
    if (s.includes('done') || s.includes('selesai') || s.includes('close') || s.includes('complete') || s === 'ok') {
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (s.includes('progress') || s.includes('proses') || s.includes('open') || s.includes('running') || s.includes('schedule')) {
        return 'bg-sky-50 text-sky-700 border border-sky-200';
    }
    if (s.includes('delay') || s.includes('pending') || s.includes('tunda') || s.includes('wait')) {
        return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
    if (s.includes('cancel') || s.includes('batal') || s.includes('fail') || s.includes('reject') || s.includes('breakdown')) {
        return 'bg-red-50 text-red-700 border border-red-200';
    }
    return 'bg-gray-100 text-gray-700 border border-gray-200';
}

function getOpsShiftBadgeClass(shiftStr) {
    const s = String(shiftStr || '').trim().toLowerCase();
    if (s.includes('2') || s.includes('malam') || s === 'n' || s === 'nws' || s === 's2') {
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    }
    if (s.includes('1') || s.includes('siang') || s === 'd' || s === 'dws' || s === 's1') {
        return 'bg-teal-50 text-teal-700 border border-teal-200';
    }
    return 'bg-gray-100 text-gray-600';
}

function syncDynamicFilterSelect(selectId, values, defaultLabel) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const prev = sel.value || 'all';
    const uniq = Array.from(new Set(values.map(v => String(v || '').trim()).filter(v => v && v !== '-'))).sort((a, b) => a.localeCompare(b, 'id'));
    sel.innerHTML = `<option value="all">${defaultLabel}</option>` + uniq.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
    sel.value = uniq.includes(prev) ? prev : 'all';
}

/* =====================================================================
 * A. SUB MENU 1: LUBETRUCK / WATERTRUCK (MULTI-SHEET MERGE)
 * ===================================================================== */

function toggleOpsLtWtSort(key) {
    if (opsLtWtSortState.key !== key) opsLtWtSortState = { key, dir: 'asc' };
    else if (opsLtWtSortState.dir === 'asc') opsLtWtSortState = { key, dir: 'desc' };
    else opsLtWtSortState = { key: null, dir: 'none' };
    renderOpsLtWtTable();
}

function renderOpsTableHeader(theadId, columns, sortFnName, sortAttr, sortState) {
    const thead = document.getElementById(theadId);
    if (!thead) return;
    const ths = columns.map((col, idx) => {
        if (idx === 0) {
            return `<th class="py-2.5 px-2.5 font-normal text-center w-[42px] min-w-[42px] sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-200 whitespace-nowrap">${escapeHtml(col.label)}</th>`;
        }
        const stickyCls = idx === 1 ? 'sm:sticky sm:left-[42px] z-30 bg-gray-50 border-r border-gray-200' : '';
        let iconCls = 'fa-sort text-gray-300';
        if (sortState.key === col.key && sortState.dir === 'asc') iconCls = 'fa-sort-up text-teal-600';
        else if (sortState.key === col.key && sortState.dir === 'desc') iconCls = 'fa-sort-down text-teal-600';
        return `<th onclick="${sortFnName}('${col.key}')" class="py-2.5 px-2.5 font-normal cursor-pointer select-none hover:bg-gray-100 border-b border-gray-200 whitespace-nowrap ${stickyCls}"><div class="flex items-center justify-between gap-1.5"><span>${escapeHtml(col.label)}</span><i ${sortAttr}="${col.key}" class="fa-solid ${iconCls} text-[8.5px] transition-colors"></i></div></th>`;
    }).join('');
    thead.innerHTML = `<tr class="bg-gray-50 border-b border-gray-200 text-[10px] font-normal text-gray-600">${ths}</tr>`;
}

function renderOpsLtWtTable() {
    initOperasionalSeState();
    renderOpsTableHeader('ops-ltwt-thead', OPS_LTWT_COLUMNS, 'toggleOpsLtWtSort', 'data-ops-ltwt-sort', opsLtWtSortState);
    const tbody = document.getElementById('ops-ltwt-tbody');
    const countEl = document.getElementById('ops-ltwt-count');
    if (!tbody) return;

    syncDynamicFilterSelect('ops-ltwt-filter-job', opsLtWtState.map(r => r.jenisJob), 'Semua Jenis Job');
    syncDynamicFilterSelect('ops-ltwt-filter-shift', opsLtWtState.map(r => r.shift), 'Semua Shift');
    syncDynamicFilterSelect('ops-ltwt-filter-status', opsLtWtState.map(r => r.status), 'Semua Status');

    const query = (document.getElementById('ops-ltwt-search')?.value || '').trim().toLowerCase();
    const jobFilter = document.getElementById('ops-ltwt-filter-job')?.value || 'all';
    const shiftFilter = document.getElementById('ops-ltwt-filter-shift')?.value || 'all';
    const statusFilter = document.getElementById('ops-ltwt-filter-status')?.value || 'all';

    let rows = opsLtWtState.filter(r => {
        if (jobFilter !== 'all' && String(r.jenisJob || '').trim() !== jobFilter) return false;
        if (shiftFilter !== 'all' && String(r.shift || '').trim() !== shiftFilter) return false;
        if (statusFilter !== 'all' && String(r.status || '').trim() !== statusFilter) return false;
        if (query) {
            const hay = Object.values(r).join(' ').toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    if (opsLtWtSortState.key && opsLtWtSortState.dir !== 'none') {
        const { key, dir } = opsLtWtSortState;
        const mult = dir === 'asc' ? 1 : -1;
        rows = rows.slice().sort((a, b) => {
            const va = String(a[key] ?? '');
            const vb = String(b[key] ?? '');
            const na = parseFloat(va.replace(',', '.'));
            const nb = parseFloat(vb.replace(',', '.'));
            if (!isNaN(na) && !isNaN(nb) && /^[\d.,\-]+$/.test(va) && /^[\d.,\-]+$/.test(vb)) {
                return (na - nb) * mult;
            }
            return va.localeCompare(vb, 'id', { numeric: true }) * mult;
        });
    }

    document.querySelectorAll('[data-ops-ltwt-sort]').forEach(icon => {
        const col = icon.getAttribute('data-ops-ltwt-sort');
        icon.className = 'fa-solid text-[8.5px] transition-colors';
        if (opsLtWtSortState.key === col && opsLtWtSortState.dir === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else if (opsLtWtSortState.key === col && opsLtWtSortState.dir === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });

    if (countEl) countEl.textContent = `${rows.length.toLocaleString('id-ID')} data`;
    window.opsLtWtFilteredIds = rows.map(r => String(r.id));

    const tableEl = document.getElementById('table-ops-ltwt');
    if (tableEl) tableEl.dataset.manualPagination = 'true';

    if (!rows.length) {
        opsLtWtPage = 1;
        tbody.innerHTML = '<tr><td colspan="23" class="py-12 text-center text-xs text-gray-400">Belum ada data Lubetruck / Watertruck yang cocok. Klik <strong>Upload Excel</strong> untuk menggabungkan data multi-sheet.</td></tr>';
        if (tableEl) renderSharedPaginationBar(tableEl, 0, 1, TABLE_PAGE_SIZE, () => { });
        return;
    }

    const sig = `${query}|${jobFilter}|${shiftFilter}|${statusFilter}|${opsLtWtSortState.key}|${opsLtWtSortState.dir}|${rows.length}`;
    if (sig !== opsLtWtLastSig) {
        opsLtWtPage = 1;
        opsLtWtLastSig = sig;
    }
    const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
    if (opsLtWtPage > totalPages) opsLtWtPage = totalPages;
    if (opsLtWtPage < 1) opsLtWtPage = 1;

    const startIdx = (opsLtWtPage - 1) * TABLE_PAGE_SIZE;
    const pageRows = rows.length > TABLE_PAGE_SIZE ? rows.slice(startIdx, startIdx + TABLE_PAGE_SIZE) : rows;

    tbody.innerHTML = pageRows.map((r, idx) => {
        const globalNo = startIdx + idx + 1;
        const rowBg = idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white';
        const tglFmt = /^\d{4}-\d{2}-\d{2}$/.test(String(r.tglAction || '')) && typeof formatDateID === 'function'
            ? formatDateID(r.tglAction)
            : (r.tglAction || '-');
        return `
            <tr data-row-id="${escapeHtml(r.id)}" class="group ${rowBg} hover:bg-teal-50/40 transition-colors">
                <td class="py-2 px-2.5 text-center font-mono text-gray-500 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 border-b border-r border-gray-100">${globalNo}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-teal-700 whitespace-nowrap sm:sticky sm:left-[42px] z-10 ${rowBg} group-hover:bg-teal-50 border-b border-r border-gray-200/80">${escapeHtml(r.noId || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-500 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.timestamp || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 font-semibold">${escapeHtml(r.jenisJob || '-')}</span></td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.plan || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.waktu || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full text-[9px] font-semibold ${getOpsShiftBadgeClass(r.shift)}">${escapeHtml(r.shift || '-')}</span></td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.typeUnit || '-')}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.noUnit || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.cluster || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.lokasi || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.hmStart || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.hmEnd || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(tglFmt)}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.start || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.end || '-')}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.durasi || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full text-[9px] font-semibold ${getOpsStatusBadgeClass(r.status)}">${escapeHtml(r.status || '-')}</span></td>
                <td class="py-2 px-2.5 text-gray-600 max-w-[220px] truncate border-b border-gray-100" title="${escapeHtml(r.temuanKendala || '-')}">${escapeHtml(r.temuanKendala || '-')}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.armada || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.opt || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.mp1 || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.mp2 || '-')}</td>
            </tr>
        `;
    }).join('');

    if (tableEl) {
        renderSharedPaginationBar(tableEl, rows.length, opsLtWtPage, TABLE_PAGE_SIZE, (nextPage) => {
            opsLtWtPage = nextPage;
            renderOpsLtWtTable();
            scrollTableContainerTop(tableEl);
        });
    }
}

function openOpsLtWtUploadModal() {
    initOperasionalSeState();
    resetOpsLtWtUploadState();
    const modal = document.getElementById('modal-ops-ltwt-upload');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeOpsLtWtUploadModal() {
    const modal = document.getElementById('modal-ops-ltwt-upload');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function resetOpsLtWtUploadState() {
    pendingOpsLtWtUpload = [];
    pendingOpsLtWtSheets = [];
    const input = document.getElementById('ops-ltwt-raw-file');
    const nameEl = document.getElementById('ops-ltwt-raw-filename');
    const statsEl = document.getElementById('ops-ltwt-upload-stats');
    const sheetsEl = document.getElementById('ops-ltwt-upload-sheets');
    const btn = document.getElementById('btn-apply-ops-ltwt-upload');
    if (input) input.value = '';
    if (nameEl) nameEl.textContent = 'Pilih File LT/WT Multi-Sheet (.xlsx, .xls, .csv)';
    if (statsEl) { statsEl.classList.add('hidden'); statsEl.classList.remove('grid'); }
    if (sheetsEl) { sheetsEl.classList.add('hidden'); sheetsEl.innerHTML = ''; }
    if (btn) btn.disabled = true;
}

function parseOpsLtWtWorkbook(workbook) {
    const merged = [];
    const sheetSummary = [];
    let skippedRows = 0;

    (workbook.SheetNames || []).forEach(sheetName => {
        const ws = workbook.Sheets[sheetName];
        if (!ws) return;
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (!aoa || aoa.length < 2) return;

        const { headerRowIdx, colMap, score } = detectHeaderRowAndMap(aoa, OPS_LTWT_COLUMNS);
        if (headerRowIdx < 0 || score < 3) return;

        let sheetCount = 0;
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const getRaw = (k) => (colMap[k] !== undefined ? row[colMap[k]] : '');

            const noId = formatOpsTextCell(getRaw('noId'));
            const noUnit = formatOpsTextCell(getRaw('noUnit'));
            const jenisJobRaw = formatOpsTextCell(getRaw('jenisJob'));
            const armada = formatOpsTextCell(getRaw('armada'));
            const status = formatOpsTextCell(getRaw('status'));
            const tglAction = formatOpsExcelDateCell(getRaw('tglAction'), false);

            // Lewati baris kosong total atau baris subtotal/footer tanpa data utama
            if (!noId && !noUnit && !armada && !jenisJobRaw && !tglAction) {
                continue;
            }
            if (!noId && !noUnit && !armada) {
                skippedRows++;
                continue;
            }

            merged.push({
                id: `ltwt-${Date.now()}-${merged.length}`,
                noId: noId || '-',
                timestamp: formatOpsExcelDateCell(getRaw('timestamp'), true),
                jenisJob: jenisJobRaw || sheetName,
                plan: formatOpsTextCell(getRaw('plan')),
                waktu: formatOpsExcelTimeCell(getRaw('waktu')),
                shift: formatOpsTextCell(getRaw('shift')),
                typeUnit: formatOpsTextCell(getRaw('typeUnit')),
                noUnit,
                cluster: formatOpsTextCell(getRaw('cluster')),
                lokasi: formatOpsTextCell(getRaw('lokasi')),
                hmStart: formatOpsTextCell(getRaw('hmStart')),
                hmEnd: formatOpsTextCell(getRaw('hmEnd')),
                tglAction,
                start: formatOpsExcelTimeCell(getRaw('start')),
                end: formatOpsExcelTimeCell(getRaw('end')),
                durasi: formatOpsExcelTimeCell(getRaw('durasi')),
                status,
                temuanKendala: formatOpsTextCell(getRaw('temuanKendala')),
                armada,
                opt: formatOpsTextCell(getRaw('opt')),
                mp1: formatOpsTextCell(getRaw('mp1')),
                mp2: formatOpsTextCell(getRaw('mp2')),
                sourceSheet: sheetName
            });
            sheetCount++;
        }

        if (sheetCount > 0) {
            sheetSummary.push({ name: sheetName, count: sheetCount });
        }
    });

    return { merged, sheetSummary, skippedRows };
}

function updateOpsLtWtUploadModalSummary(sheetSummary, mergedCount, skippedRows) {
    const statsEl = document.getElementById('ops-ltwt-upload-stats');
    const sheetsEl = document.getElementById('ops-ltwt-upload-sheets');
    const btn = document.getElementById('btn-apply-ops-ltwt-upload');
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };

    if (statsEl) { statsEl.classList.remove('hidden'); statsEl.classList.add('grid'); }
    setTxt('ops-ltwt-stat-sheets', sheetSummary.length);
    setTxt('ops-ltwt-stat-rows', mergedCount);
    setTxt('ops-ltwt-stat-skipped', skippedRows);

    if (sheetsEl) {
        if (sheetSummary.length > 0) {
            sheetsEl.classList.remove('hidden');
            sheetsEl.innerHTML = sheetSummary.map(s =>
                `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[9.5px] font-semibold">${escapeHtml(s.name)} <strong class="font-mono">(${s.count})</strong></span>`
            ).join('');
        } else {
            sheetsEl.classList.add('hidden');
            sheetsEl.innerHTML = '';
        }
    }
    if (btn) btn.disabled = mergedCount === 0;
}

function handleOpsLtWtFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const nameEl = document.getElementById('ops-ltwt-raw-filename');
    if (nameEl) nameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const { merged, sheetSummary, skippedRows } = parseOpsLtWtWorkbook(workbook);

            pendingOpsLtWtUpload = merged;
            pendingOpsLtWtSheets = sheetSummary;
            updateOpsLtWtUploadModalSummary(sheetSummary, merged.length, skippedRows);

            if (merged.length > 0) {
                showToast(`${merged.length} baris dari ${sheetSummary.length} sheet siap digabungkan ke Lubetruck / Watertruck.`, 'info');
            } else {
                showToast('Header kolom Lubetruck / Watertruck tidak ditemukan pada file Excel.', 'error');
            }
        } catch (err) {
            console.error('Gagal membaca file Excel LT/WT:', err);
            showToast('Format file Excel LT/WT tidak dapat dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function getOpsLtWtDedupKey(r) {
    const idClean = String(r.noId || '').trim().toLowerCase();
    if (idClean && idClean !== '-') return `id::${idClean}`;
    return `row::${String(r.timestamp || '').trim().toLowerCase()}|${String(r.jenisJob || '').trim().toLowerCase()}|${String(r.noUnit || '').trim().toLowerCase()}|${String(r.tglAction || '').trim()}|${String(r.start || '').trim()}`;
}

function applyPendingOpsLtWtUpload() {
    initOperasionalSeState();
    if (!pendingOpsLtWtUpload.length) return;
    const saveMode = document.getElementById('ops-ltwt-upload-save-mode')?.value || 'overwrite';

    let added = 0;
    let updated = 0;
    let skipped = 0;

    if (saveMode === 'replace_all') {
        opsLtWtState = pendingOpsLtWtUpload.map((r, i) => ({ ...r, id: `ltwt-${Date.now()}-${i}` }));
        added = opsLtWtState.length;
    } else {
        const indexMap = new Map();
        opsLtWtState.forEach((item, idx) => indexMap.set(getOpsLtWtDedupKey(item), idx));

        pendingOpsLtWtUpload.forEach((item, i) => {
            const key = getOpsLtWtDedupKey(item);
            if (indexMap.has(key)) {
                if (saveMode === 'append') {
                    skipped++;
                } else {
                    const targetIdx = indexMap.get(key);
                    opsLtWtState[targetIdx] = { ...item, id: opsLtWtState[targetIdx].id };
                    updated++;
                }
            } else {
                opsLtWtState.push({ ...item, id: `ltwt-${Date.now()}-${i}` });
                indexMap.set(key, opsLtWtState.length - 1);
                added++;
            }
        });
    }

    const sheetCount = pendingOpsLtWtSheets.length || 1;
    persistOpsLtWtState();
    resetOpsLtWtUploadState();
    closeOpsLtWtUploadModal();
    renderOpsLtWtTable();

    if (saveMode === 'replace_all') {
        showToast(`Data Lubetruck / Watertruck diganti (${added} baris dari ${sheetCount} sheet).`, 'success');
    } else {
        showToast(formatUploadResultToast(`LT/WT (${sheetCount} sheet digabung)`, { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
    }
}

function downloadSampleOpsLtWtExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const headers = OPS_LTWT_COLUMNS.map(c => c.label);
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet([headers]);
    const ws2 = XLSX.utils.aoa_to_sheet([headers]);
    const widths = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
    ws1['!cols'] = widths;
    ws2['!cols'] = widths;
    XLSX.utils.book_append_sheet(wb, ws1, 'Lube Truck');
    XLSX.utils.book_append_sheet(wb, ws2, 'Water Truck');
    XLSX.writeFile(wb, 'Template_Operasional_LT_WT_PANTAU_SE.xlsx');
    showToast('Template Excel Lubetruck / Watertruck (2 sheet) berhasil diunduh.', 'success');
}

function exportOpsLtWtExcel() {
    initOperasionalSeState();
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    if (!opsLtWtState.length) {
        showToast('Belum ada data Lubetruck / Watertruck untuk diekspor.', 'info');
        return;
    }
    const headers = OPS_LTWT_COLUMNS.map(c => c.label);
    const aoa = [headers].concat(
        opsLtWtState.map((r, idx) => OPS_LTWT_COLUMNS.map(c => (c.key === 'no' ? idx + 1 : (r[c.key] ?? ''))))
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operasional LT WT');
    XLSX.writeFile(wb, `Operasional_LT_WT_${getTodayISO()}.xlsx`);
    showToast(`Berhasil mengekspor ${opsLtWtState.length} baris gabungan LT/WT ke Excel.`, 'success');
}

/* =====================================================================
 * B. SUB MENU 2: LIFTING (28 KOLOM, SINGLE SHEET)
 * ===================================================================== */

function toggleOpsLiftingSort(key) {
    if (opsLiftingSortState.key !== key) opsLiftingSortState = { key, dir: 'asc' };
    else if (opsLiftingSortState.dir === 'asc') opsLiftingSortState = { key, dir: 'desc' };
    else opsLiftingSortState = { key: null, dir: 'none' };
    renderOpsLiftingTable();
}

function renderOpsLiftingTable() {
    initOperasionalSeState();
    renderOpsTableHeader('ops-lifting-thead', OPS_LIFTING_COLUMNS, 'toggleOpsLiftingSort', 'data-ops-lifting-sort', opsLiftingSortState);
    const tbody = document.getElementById('ops-lifting-tbody');
    const countEl = document.getElementById('ops-lifting-count');
    if (!tbody) return;

    syncDynamicFilterSelect('ops-lifting-filter-kategori', opsLiftingState.map(r => r.kategori), 'Semua Kategori');
    syncDynamicFilterSelect('ops-lifting-filter-shift', opsLiftingState.map(r => r.shift), 'Semua Shift');
    syncDynamicFilterSelect('ops-lifting-filter-status', opsLiftingState.map(r => r.status), 'Semua Status');

    const query = (document.getElementById('ops-lifting-search')?.value || '').trim().toLowerCase();
    const katFilter = document.getElementById('ops-lifting-filter-kategori')?.value || 'all';
    const shiftFilter = document.getElementById('ops-lifting-filter-shift')?.value || 'all';
    const statusFilter = document.getElementById('ops-lifting-filter-status')?.value || 'all';

    let rows = opsLiftingState.filter(r => {
        if (katFilter !== 'all' && String(r.kategori || '').trim() !== katFilter) return false;
        if (shiftFilter !== 'all' && String(r.shift || '').trim() !== shiftFilter) return false;
        if (statusFilter !== 'all' && String(r.status || '').trim() !== statusFilter) return false;
        if (query) {
            const hay = Object.values(r).join(' ').toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });

    if (opsLiftingSortState.key && opsLiftingSortState.dir !== 'none') {
        const { key, dir } = opsLiftingSortState;
        const mult = dir === 'asc' ? 1 : -1;
        rows = rows.slice().sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'id', { numeric: true }) * mult);
    }

    document.querySelectorAll('[data-ops-lifting-sort]').forEach(icon => {
        const col = icon.getAttribute('data-ops-lifting-sort');
        icon.className = 'fa-solid text-[8.5px] transition-colors';
        if (opsLiftingSortState.key === col && opsLiftingSortState.dir === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else if (opsLiftingSortState.key === col && opsLiftingSortState.dir === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });

    if (countEl) countEl.textContent = `${rows.length.toLocaleString('id-ID')} WO`;
    window.opsLiftingFilteredIds = rows.map(r => String(r.id));

    const tableEl = document.getElementById('table-ops-lifting');
    if (tableEl) tableEl.dataset.manualPagination = 'true';

    if (!rows.length) {
        opsLiftingPage = 1;
        tbody.innerHTML = '<tr><td colspan="28" class="py-12 text-center text-xs text-gray-400">Belum ada data Lifting yang cocok. Klik <strong>Upload Excel</strong> untuk mengunggah data WO Lifting.</td></tr>';
        if (tableEl) renderSharedPaginationBar(tableEl, 0, 1, TABLE_PAGE_SIZE, () => { });
        return;
    }

    const sig = `${query}|${katFilter}|${shiftFilter}|${statusFilter}|${opsLiftingSortState.key}|${opsLiftingSortState.dir}|${rows.length}`;
    if (sig !== opsLiftingLastSig) {
        opsLiftingPage = 1;
        opsLiftingLastSig = sig;
    }
    const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
    if (opsLiftingPage > totalPages) opsLiftingPage = totalPages;
    if (opsLiftingPage < 1) opsLiftingPage = 1;

    const startIdx = (opsLiftingPage - 1) * TABLE_PAGE_SIZE;
    const pageRows = rows.length > TABLE_PAGE_SIZE ? rows.slice(startIdx, startIdx + TABLE_PAGE_SIZE) : rows;

    tbody.innerHTML = pageRows.map((r, idx) => {
        const globalNo = startIdx + idx + 1;
        const rowBg = idx % 2 === 1 ? 'bg-gray-50/70' : 'bg-white';
        const tglFmt = /^\d{4}-\d{2}-\d{2}$/.test(String(r.tglPelaksanaan || '')) && typeof formatDateID === 'function'
            ? formatDateID(r.tglPelaksanaan)
            : (r.tglPelaksanaan || '-');
        return `
            <tr data-row-id="${escapeHtml(r.id)}" class="group ${rowBg} hover:bg-teal-50/40 transition-colors">
                <td class="py-2 px-2.5 text-center font-mono text-gray-500 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 border-b border-r border-gray-100">${globalNo}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-teal-700 whitespace-nowrap sm:sticky sm:left-[42px] z-10 ${rowBg} group-hover:bg-teal-50 border-b border-r border-gray-200/80">${escapeHtml(r.noWo || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-500 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.timestamp || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">${escapeHtml(r.kategori || '-')}</span></td>
                <td class="py-2 px-2.5 font-mono text-gray-600 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.nrpPemohon || '-')}</td>
                <td class="py-2 px-2.5 text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.namaPemohon || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.perusahaan || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.departemen || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.section || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-600 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.noWa || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(tglFmt)}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.jamPelaksanaan || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full text-[9px] font-semibold ${getOpsShiftBadgeClass(r.shift)}">${escapeHtml(r.shift || '-')}</span></td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.durasiRequest || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.lokasiAsal || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.lokasiTujuan || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 max-w-[240px] truncate border-b border-gray-100" title="${escapeHtml(r.deskripsi || '-')}">${escapeHtml(r.deskripsi || '-')}</td>
                <td class="py-2 px-2.5 whitespace-nowrap border-b border-gray-100"><span class="px-2 py-0.5 rounded-full text-[9px] font-semibold ${getOpsStatusBadgeClass(r.status)}">${escapeHtml(r.status || '-')}</span></td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.gl || '-')}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.unit || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.operator || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.rigger1 || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.rigger2 || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.jamStartAktual || '-')}</td>
                <td class="py-2 px-2.5 font-mono text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.jamEndAktual || '-')}</td>
                <td class="py-2 px-2.5 font-mono font-semibold text-gray-800 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.durasiAktual || '-')}</td>
                <td class="py-2 px-2.5 text-gray-700 whitespace-nowrap border-b border-gray-100">${escapeHtml(r.finalInspeksi || '-')}</td>
                <td class="py-2 px-2.5 text-gray-600 max-w-[220px] truncate border-b border-gray-100" title="${escapeHtml(r.kendalaLapangan || '-')}">${escapeHtml(r.kendalaLapangan || '-')}</td>
            </tr>
        `;
    }).join('');

    if (tableEl) {
        renderSharedPaginationBar(tableEl, rows.length, opsLiftingPage, TABLE_PAGE_SIZE, (nextPage) => {
            opsLiftingPage = nextPage;
            renderOpsLiftingTable();
            scrollTableContainerTop(tableEl);
        });
    }
}

function openOpsLiftingUploadModal() {
    initOperasionalSeState();
    resetOpsLiftingUploadState();
    const modal = document.getElementById('modal-ops-lifting-upload');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeOpsLiftingUploadModal() {
    const modal = document.getElementById('modal-ops-lifting-upload');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function resetOpsLiftingUploadState() {
    pendingOpsLiftingUpload = [];
    const input = document.getElementById('ops-lifting-raw-file');
    const nameEl = document.getElementById('ops-lifting-raw-filename');
    const statsEl = document.getElementById('ops-lifting-upload-stats');
    const btn = document.getElementById('btn-apply-ops-lifting-upload');
    if (input) input.value = '';
    if (nameEl) nameEl.textContent = 'Pilih File Lifting (.xlsx, .xls, .csv)';
    if (statsEl) { statsEl.classList.add('hidden'); statsEl.classList.remove('grid'); }
    if (btn) btn.disabled = true;
}

function parseOpsLiftingWorkbook(workbook) {
    const rowsOut = [];
    let skippedRows = 0;
    let totalDataRows = 0;

    for (const sheetName of (workbook.SheetNames || [])) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (!aoa || aoa.length < 2) continue;

        const { headerRowIdx, colMap, score } = detectHeaderRowAndMap(aoa, OPS_LIFTING_COLUMNS);
        if (headerRowIdx < 0 || score < 3) continue;

        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
            const row = aoa[r];
            if (!Array.isArray(row)) continue;
            const getRaw = (k) => (colMap[k] !== undefined ? row[colMap[k]] : '');

            const noWo = formatOpsTextCell(getRaw('noWo'));
            const namaPemohon = formatOpsTextCell(getRaw('namaPemohon'));
            const unit = formatOpsTextCell(getRaw('unit'));
            const deskripsi = formatOpsTextCell(getRaw('deskripsi'));
            const tglPelaksanaan = formatOpsExcelDateCell(getRaw('tglPelaksanaan'), false);

            if (!noWo && !namaPemohon && !unit && !deskripsi && !tglPelaksanaan) {
                continue;
            }
            totalDataRows++;
            if (!noWo && !namaPemohon && !unit) {
                skippedRows++;
                continue;
            }

            rowsOut.push({
                id: `lift-${Date.now()}-${rowsOut.length}`,
                noWo: noWo || '-',
                timestamp: formatOpsExcelDateCell(getRaw('timestamp'), true),
                kategori: formatOpsTextCell(getRaw('kategori')),
                nrpPemohon: formatOpsTextCell(getRaw('nrpPemohon')),
                namaPemohon,
                perusahaan: formatOpsTextCell(getRaw('perusahaan')),
                departemen: formatOpsTextCell(getRaw('departemen')),
                section: formatOpsTextCell(getRaw('section')),
                noWa: formatOpsTextCell(getRaw('noWa')),
                tglPelaksanaan,
                jamPelaksanaan: formatOpsExcelTimeCell(getRaw('jamPelaksanaan')),
                shift: formatOpsTextCell(getRaw('shift')),
                durasiRequest: formatOpsExcelTimeCell(getRaw('durasiRequest')),
                lokasiAsal: formatOpsTextCell(getRaw('lokasiAsal')),
                lokasiTujuan: formatOpsTextCell(getRaw('lokasiTujuan')),
                deskripsi,
                status: formatOpsTextCell(getRaw('status')),
                gl: formatOpsTextCell(getRaw('gl')),
                unit,
                operator: formatOpsTextCell(getRaw('operator')),
                rigger1: formatOpsTextCell(getRaw('rigger1')),
                rigger2: formatOpsTextCell(getRaw('rigger2')),
                jamStartAktual: formatOpsExcelTimeCell(getRaw('jamStartAktual')),
                jamEndAktual: formatOpsExcelTimeCell(getRaw('jamEndAktual')),
                durasiAktual: formatOpsExcelTimeCell(getRaw('durasiAktual')),
                finalInspeksi: formatOpsTextCell(getRaw('finalInspeksi')),
                kendalaLapangan: formatOpsTextCell(getRaw('kendalaLapangan'))
            });
        }
        // Single-sheet: berhenti pada sheet pertama yang cocok
        break;
    }

    return { rowsOut, totalDataRows, skippedRows };
}

function updateOpsLiftingUploadModalSummary(totalDataRows, validCount, skippedRows) {
    const statsEl = document.getElementById('ops-lifting-upload-stats');
    const btn = document.getElementById('btn-apply-ops-lifting-upload');
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };

    if (statsEl) { statsEl.classList.remove('hidden'); statsEl.classList.add('grid'); }
    setTxt('ops-lifting-stat-total', totalDataRows);
    setTxt('ops-lifting-stat-valid', validCount);
    setTxt('ops-lifting-stat-skipped', skippedRows);
    if (btn) btn.disabled = validCount === 0;
}

function handleOpsLiftingFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const nameEl = document.getElementById('ops-lifting-raw-filename');
    if (nameEl) nameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const { rowsOut, totalDataRows, skippedRows } = parseOpsLiftingWorkbook(workbook);

            pendingOpsLiftingUpload = rowsOut;
            updateOpsLiftingUploadModalSummary(totalDataRows, rowsOut.length, skippedRows);

            if (rowsOut.length > 0) {
                showToast(`${rowsOut.length} data WO Lifting siap diterapkan.`, 'info');
            } else {
                showToast('Header kolom Lifting tidak ditemukan pada file Excel.', 'error');
            }
        } catch (err) {
            console.error('Gagal membaca file Excel Lifting:', err);
            showToast('Format file Excel Lifting tidak dapat dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function getOpsLiftingDedupKey(r) {
    const woClean = String(r.noWo || '').trim().toLowerCase();
    if (woClean && woClean !== '-') return `wo::${woClean}`;
    return `row::${String(r.timestamp || '').trim().toLowerCase()}|${String(r.namaPemohon || '').trim().toLowerCase()}|${String(r.tglPelaksanaan || '').trim()}|${String(r.unit || '').trim().toLowerCase()}`;
}

function applyPendingOpsLiftingUpload() {
    initOperasionalSeState();
    if (!pendingOpsLiftingUpload.length) return;
    const saveMode = document.getElementById('ops-lifting-upload-save-mode')?.value || 'overwrite';

    let added = 0;
    let updated = 0;
    let skipped = 0;

    if (saveMode === 'replace_all') {
        opsLiftingState = pendingOpsLiftingUpload.map((r, i) => ({ ...r, id: `lift-${Date.now()}-${i}` }));
        added = opsLiftingState.length;
    } else {
        const indexMap = new Map();
        opsLiftingState.forEach((item, idx) => indexMap.set(getOpsLiftingDedupKey(item), idx));

        pendingOpsLiftingUpload.forEach((item, i) => {
            const key = getOpsLiftingDedupKey(item);
            if (indexMap.has(key)) {
                if (saveMode === 'append') {
                    skipped++;
                } else {
                    const targetIdx = indexMap.get(key);
                    opsLiftingState[targetIdx] = { ...item, id: opsLiftingState[targetIdx].id };
                    updated++;
                }
            } else {
                opsLiftingState.push({ ...item, id: `lift-${Date.now()}-${i}` });
                indexMap.set(key, opsLiftingState.length - 1);
                added++;
            }
        });
    }

    persistOpsLiftingState();
    resetOpsLiftingUploadState();
    closeOpsLiftingUploadModal();
    renderOpsLiftingTable();

    if (saveMode === 'replace_all') {
        showToast(`Data Lifting diganti (${added} WO tersimpan).`, 'success');
    } else {
        showToast(formatUploadResultToast('Data Lifting', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
    }
}

function downloadSampleOpsLiftingExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const headers = OPS_LIFTING_COLUMNS.map(c => c.label);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Lifting');
    XLSX.writeFile(wb, 'Template_Operasional_Lifting_PANTAU_SE.xlsx');
    showToast('Template Excel Lifting (28 kolom) berhasil diunduh.', 'success');
}

function exportOpsLiftingExcel() {
    initOperasionalSeState();
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    if (!opsLiftingState.length) {
        showToast('Belum ada data Lifting untuk diekspor.', 'info');
        return;
    }
    const headers = OPS_LIFTING_COLUMNS.map(c => c.label);
    const aoa = [headers].concat(
        opsLiftingState.map((r, idx) => OPS_LIFTING_COLUMNS.map(c => (c.key === 'no' ? idx + 1 : (r[c.key] ?? ''))))
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Operasional Lifting');
    XLSX.writeFile(wb, `Operasional_Lifting_${getTodayISO()}.xlsx`);
    showToast(`Berhasil mengekspor ${opsLiftingState.length} WO Lifting ke Excel.`, 'success');
}

function renderOperasionalSeSection(subTab = 'lt-wt') {
    initOperasionalSeState();
    if (subTab === 'lifting') renderOpsLiftingTable();
    else renderOpsLtWtTable();
}

/* =====================================================================
 * C. UNIVERSAL TABLE PAGINATION (> 50 BARIS, KECUALI ROSTER SE)
 * - Otomatis aktif pada semua tabel di luar #section-roster bila baris > 50
 * - Tersembunyi otomatis bila baris <= 50
 * - Mendukung baris berpasangan rowspan (mis. Time Frame Big Crane)
 * ===================================================================== */

const TABLE_PAGE_SIZE = 50;
const universalTablePageState = new WeakMap();
let universalPaginationInitialized = false;

function isRosterExcludedTable(tableEl) {
    if (!tableEl) return true;
    return Boolean(tableEl.closest('#section-roster') || tableEl.id === 'table-roster');
}

function scrollTableContainerTop(tableEl) {
    const wrap = tableEl?.closest('.overflow-auto, .overflow-x-auto');
    if (wrap) wrap.scrollTop = 0;
}

function getOrCreatePaginationHost(tableEl) {
    if (!tableEl || isRosterExcludedTable(tableEl)) return null;
    const scrollWrap = tableEl.closest('.overflow-auto, .overflow-x-auto') || tableEl.parentElement;
    if (!scrollWrap || !scrollWrap.parentElement) return null;

    if (scrollWrap.nextElementSibling && scrollWrap.nextElementSibling.classList.contains('table-pagination-bar')) {
        return scrollWrap.nextElementSibling;
    }
    const bar = document.createElement('div');
    bar.className = 'table-pagination-bar hidden px-4 py-2 bg-[#FAF8F4] border-t border-gray-200 flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 shrink-0';
    scrollWrap.insertAdjacentElement('afterend', bar);
    return bar;
}

function buildCompactPageList(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push('...');
    for (let p = start; p <= end; p++) pages.push(p);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
}

function renderSharedPaginationBar(tableEl, totalItems, currentPage, pageSize, onPageChange) {
    const host = getOrCreatePaginationHost(tableEl);
    if (!host) return;

    if (totalItems <= pageSize) {
        host.classList.add('hidden');
        host.classList.remove('flex');
        host.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startNum = (safePage - 1) * pageSize + 1;
    const endNum = Math.min(totalItems, safePage * pageSize);
    const pageList = buildCompactPageList(safePage, totalPages);

    const navBtnBase = 'px-2 py-1 rounded-lg border border-gray-200 bg-white text-[10.5px] font-semibold text-gray-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 disabled:hover:text-gray-700 transition-colors';

    const pageButtonsHtml = pageList.map(p => {
        if (p === '...') {
            return '<span class="px-1 text-gray-400 select-none">…</span>';
        }
        const isAct = p === safePage;
        const cls = isAct
            ? 'min-w-[26px] px-2 py-1 rounded-lg bg-teal-500 text-white text-[10.5px] font-bold shadow-sm'
            : 'min-w-[26px] px-2 py-1 rounded-lg border border-gray-200 bg-white text-[10.5px] font-medium text-gray-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 transition-colors';
        return `<button type="button" data-page-target="${p}" class="${cls}">${p}</button>`;
    }).join('');

    const jumpSelectHtml = totalPages > 5
        ? `<select data-page-jump="1" aria-label="Pilih halaman" class="ml-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10.5px] font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500">${Array.from({ length: totalPages }, (_, i) => `<option value="${i + 1}"${i + 1 === safePage ? ' selected' : ''}>Hal. ${i + 1}/${totalPages}</option>`).join('')}</select>`
        : '';

    host.classList.remove('hidden');
    host.classList.add('flex');
    host.innerHTML = `
        <div class="text-[10.5px] text-gray-600">
            Menampilkan <strong class="text-gray-800 font-mono">${startNum.toLocaleString('id-ID')}–${endNum.toLocaleString('id-ID')}</strong> dari <strong class="text-gray-800 font-mono">${totalItems.toLocaleString('id-ID')}</strong> baris
        </div>
        <div class="flex flex-wrap items-center gap-1">
            <button type="button" data-page-target="1" ${safePage <= 1 ? 'disabled' : ''} title="Halaman Pertama" class="${navBtnBase}"><i class="fa-solid fa-angles-left text-[9px]"></i></button>
            <button type="button" data-page-target="${safePage - 1}" ${safePage <= 1 ? 'disabled' : ''} class="${navBtnBase}">Prev</button>
            ${pageButtonsHtml}
            <button type="button" data-page-target="${safePage + 1}" ${safePage >= totalPages ? 'disabled' : ''} class="${navBtnBase}">Next</button>
            <button type="button" data-page-target="${totalPages}" ${safePage >= totalPages ? 'disabled' : ''} title="Halaman Terakhir" class="${navBtnBase}"><i class="fa-solid fa-angles-right text-[9px]"></i></button>
            ${jumpSelectHtml}
        </div>
    `;

    host.querySelectorAll('button[data-page-target]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.getAttribute('data-page-target'), 10);
            if (!isNaN(target) && target >= 1 && target <= totalPages && target !== safePage) {
                onPageChange(target);
            }
        });
    });

    const jumpSel = host.querySelector('select[data-page-jump]');
    if (jumpSel) {
        jumpSel.addEventListener('change', () => {
            const target = parseInt(jumpSel.value, 10);
            if (!isNaN(target) && target >= 1 && target <= totalPages && target !== safePage) {
                onPageChange(target);
            }
        });
    }
}

function groupTbodyRowsForPagination(tbody) {
    const trs = Array.from(tbody.children).filter(el => el.tagName === 'TR');
    if (trs.length === 1) {
        const onlyCells = trs[0].querySelectorAll('td');
        if (onlyCells.length === 1 && Number(onlyCells[0].getAttribute('colspan') || '1') > 1) {
            return [];
        }
    }
    const groups = [];
    for (let i = 0; i < trs.length;) {
        const tr = trs[i];
        let span = 1;
        const cells = tr.children;
        for (let c = 0; c < cells.length; c++) {
            const rs = parseInt(cells[c].getAttribute('rowspan') || '1', 10);
            if (rs > span) span = rs;
        }
        const chunk = [];
        for (let k = 0; k < span && (i + k) < trs.length; k++) {
            chunk.push(trs[i + k]);
        }
        groups.push(chunk);
        i += span;
    }
    return groups;
}

function applyUniversalPaginationToTbody(tbody, resetIfCountChanged = false) {
    if (!tbody) return;
    const tableEl = tbody.closest('table');
    if (!tableEl || isRosterExcludedTable(tableEl) || tableEl.dataset.manualPagination === 'true') return;

    const groups = groupTbodyRowsForPagination(tbody);
    const totalItems = groups.length;

    let state = universalTablePageState.get(tbody);
    if (!state) {
        state = { page: 1, lastCount: totalItems };
        universalTablePageState.set(tbody, state);
    }
    if (resetIfCountChanged && state.lastCount !== totalItems) {
        state.page = 1;
        state.lastCount = totalItems;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    if (totalItems <= TABLE_PAGE_SIZE) {
        groups.forEach(chunk => chunk.forEach(tr => tr.classList.remove('hidden')));
        renderSharedPaginationBar(tableEl, totalItems, 1, TABLE_PAGE_SIZE, () => { });
        return;
    }

    const startIdx = (state.page - 1) * TABLE_PAGE_SIZE;
    const endIdx = startIdx + TABLE_PAGE_SIZE;
    groups.forEach((chunk, idx) => {
        const show = idx >= startIdx && idx < endIdx;
        chunk.forEach(tr => tr.classList.toggle('hidden', !show));
    });

    renderSharedPaginationBar(tableEl, totalItems, state.page, TABLE_PAGE_SIZE, (nextPage) => {
        state.page = nextPage;
        applyUniversalPaginationToTbody(tbody, false);
        if (typeof syncBulkCheckboxesState === 'function') syncBulkCheckboxesState(tableEl);
        scrollTableContainerTop(tableEl);
    });
    if (typeof syncBulkCheckboxesState === 'function') syncBulkCheckboxesState(tableEl);
}

function initUniversalTablePagination() {
    if (universalPaginationInitialized) return;
    universalPaginationInitialized = true;

    ['table-ops-ltwt', 'table-ops-lifting'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.dataset.manualPagination = 'true';
    });

    const observeTbody = (tbody) => {
        if (!tbody || tbody.dataset.paginationObserved === 'true') return;
        const tableEl = tbody.closest('table');
        if (!tableEl || isRosterExcludedTable(tableEl) || tableEl.dataset.manualPagination === 'true') return;

        tbody.dataset.paginationObserved = 'true';
        const observer = new MutationObserver(() => {
            applyUniversalPaginationToTbody(tbody, true);
        });
        observer.observe(tbody, { childList: true });
        applyUniversalPaginationToTbody(tbody, false);
    };

    document.querySelectorAll('table tbody').forEach(observeTbody);
}
