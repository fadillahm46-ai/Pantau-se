/* =====================================================================
 * 3. FETCH DATA MANPOWER, SORTIR 3-KLIK, & RENDER TABEL MANPOWER
 * ===================================================================== */
/**
 * Memuat data Manpower dari Supabase lalu menyinkronkan seluruh tabel terkait.
 */
async function fetchManpowerData(showFeedback = false) {
    if (typeof syncAllFromSupabase === 'function' && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        return syncAllFromSupabase(showFeedback);
    }

    const syncIcon = document.getElementById('sync-icon');
    if (syncIcon && showFeedback) {
        syncIcon.classList.add('fa-spin');
    }

    try {
        const hasSupabaseCfg =
            APP_CONFIG.SUPABASE_URL &&
            !APP_CONFIG.SUPABASE_URL.includes('your-project-id') &&
            APP_CONFIG.SUPABASE_ANON_KEY &&
            !APP_CONFIG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

        if (hasSupabaseCfg) {
            const res = await fetch(`${APP_CONFIG.SUPABASE_URL}/rest/v1/manpower?select=*&order=id.asc`, {
                headers: {
                    apikey: APP_CONFIG.SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${APP_CONFIG.SUPABASE_ANON_KEY}`
                }
            });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows)) {
                    manpowerState = rows;
                }
            }
        }

        if (!Array.isArray(manpowerState)) manpowerState = [];
        renderManpowerTable();

        if (showFeedback) {
            showToast(hasSupabaseCfg ? 'Data manpower & performa berhasil disinkronisasi.' : 'Konfigurasi Supabase belum diisi — menampilkan data sesi saat ini.', 'info');
        }
    } catch (err) {
        console.error('Gagal mengambil data manpower:', err);
        if (!Array.isArray(manpowerState)) manpowerState = [];
        renderManpowerTable();
        if (showFeedback) {
            showToast('Gagal mengambil data dari Supabase.', 'error');
        }
    } finally {
        if (syncIcon) {
            setTimeout(() => syncIcon.classList.remove('fa-spin'), 400);
        }
    }
}

function renderDocCellHtml(docKey, dateStr, isRequired = true) {
    if (!isRequired) {
        return '<td class="py-3 px-3 text-gray-300 text-center whitespace-nowrap">-</td>';
    }
    if (!dateStr) {
        return '<td class="py-3 px-3 text-amber-500 text-[9px] whitespace-nowrap">Belum diisi</td>';
    }
    const ev = evaluateDocumentStatus(docKey, dateStr);
    return `
                <td class="py-3 px-3 whitespace-nowrap">
                    <p class="font-mono ${ev.dateColor}">${formatDateID(dateStr)}</p>
                    <p class="text-[8.5px] mt-0.5 ${ev.subColor}">${escapeHtml(ev.subText)}</p>
                </td>
            `;
}

function toggleManpowerSort(column) {
    if (manpowerSortState.column !== column) {
        manpowerSortState = { column, direction: 'desc' };
    } else if (manpowerSortState.direction === 'desc') {
        manpowerSortState.direction = 'asc';
    } else {
        manpowerSortState = { column: null, direction: 'none' };
    }
    updateManpowerSortIndicators();
    renderManpowerTable();
}

function updateManpowerSortIndicators() {
    document.querySelectorAll('[data-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (manpowerSortState.column === col && manpowerSortState.direction === 'desc') {
            icon.classList.add('fa-sort-down', 'text-teal-600');
        } else if (manpowerSortState.column === col && manpowerSortState.direction === 'asc') {
            icon.classList.add('fa-sort-up', 'text-teal-600');
        } else {
            icon.classList.add('fa-sort', 'text-gray-300');
        }
    });
}

function renderManpowerTable() {
    const tbody = document.getElementById('manpower-table-body');
    if (!tbody) return;

    const query = (document.getElementById('manpower-search')?.value || '').trim().toLowerCase();
    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili} ${mp.kontak} ${mp.email}`.toLowerCase().includes(query);
    });

    if (manpowerSortState.column && manpowerSortState.direction !== 'none') {
        const col = manpowerSortState.column;
        const dir = manpowerSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (ALL_DOC_KEYS.includes(col)) {
                const allowA = getAllowedDocsForRole(a.jabatan).includes(col);
                const allowB = getAllowedDocsForRole(b.jabatan).includes(col);
                const dateA = col === 'MCU' ? getEffectiveMcuDate(a) : a.docs?.[col];
                const dateB = col === 'MCU' ? getEffectiveMcuDate(b) : b.docs?.[col];
                const dA = allowA && dateA ? (getDiffDaysFromToday(dateA) ?? 999999) : 999999;
                const dB = allowB && dateB ? (getDiffDaysFromToday(dateB) ?? 999999) : 999999;
                return (dA - dB) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="py-10 text-center text-xs text-gray-400">Data manpower tidak ditemukan.</td></tr>';
    } else {
        tbody.innerHTML = rows.map(mp => {
            const allowedDocs = getAllowedDocsForRole(mp.jabatan);
            const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
            return `
                        <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                            <td class="py-3 px-3 whitespace-nowrap">
                                <button type="button" onclick="openManpowerDetailModal(${Number(mp.id)})" class="text-left group focus:outline-none">
                                    <p class="text-gray-800 group-hover:text-teal-600 group-hover:underline font-medium">${escapeHtml(mp.nama)}${outBadge}</p>
                                    <p class="font-mono text-[9px] text-teal-600 mt-0.5">${escapeHtml(mp.nrp)}</p>
                                </button>
                            </td>
                            <td class="py-3 px-3 whitespace-nowrap">
                                <p class="text-gray-700">${escapeHtml(mp.jabatan || '-')}</p>
                                <p class="text-[9px] text-gray-400 mt-0.5">${escapeHtml(mp.perusahaan || '-')}${mp.domisili ? ` (${escapeHtml(mp.domisili)})` : ''}</p>
                            </td>
                            <td class="py-3 px-3 whitespace-nowrap">
                                <p class="font-mono text-gray-700">${escapeHtml(mp.kontak || '-')}</p>
                                <p class="text-[9px] text-gray-400 mt-0.5">${escapeHtml(mp.email || '-')}</p>
                            </td>
                            ${ALL_DOC_KEYS.map(docKey => renderDocCellHtml(docKey, docKey === 'MCU' ? getEffectiveMcuDate(mp) : mp.docs?.[docKey], allowedDocs.includes(docKey))).join('')}
                        </tr>
                    `;
        }).join('');
    }

    renderDokumenAnalisis();
    renderPerformaManpower();
    renderInputKpiPengawasTable();
    renderDashboardKpiPengawas();
}

function renderDokumenAnalisis() {
    const listEl = document.getElementById('dokumen-warning-list');
    const sidebarBadge = document.getElementById('sidebar-warning-badge');
    const overviewCount = document.getElementById('overview-warning-count');
    const warnings = [];

    manpowerState.forEach(mp => {
        const allowed = getAllowedDocsForRole(mp.jabatan);
        allowed.forEach(docKey => {
            const dateStr = docKey === 'MCU' ? getEffectiveMcuDate(mp) : mp.docs?.[docKey];
            if (!dateStr) return;
            const ev = evaluateDocumentStatus(docKey, dateStr);
            if (ev.level === 'mati' || ev.level === 'kritis' || ev.level === 'warning') {
                warnings.push({
                    source: 'Manpower',
                    id: mp.id,
                    title: mp.nama,
                    subtitle: `${mp.nrp} • ${mp.jabatan}`,
                    docLabel: DOC_RULES[docKey]?.label || docKey,
                    dateStr,
                    ev
                });
            }
        });
    });

    komisioningState.forEach(unit => {
        ['KOMISIONING_BIB', 'KOMISIONING_TIA', 'KOMISIONING_TMA'].forEach(docKey => {
            const dateStr = unit[docKey];
            if (!dateStr) return;
            const ev = evaluateDocumentStatus(docKey, dateStr);
            if (ev.level === 'mati' || ev.level === 'kritis' || ev.level === 'warning') {
                warnings.push({
                    source: 'Unit',
                    id: unit.id,
                    title: unit.no_unit,
                    subtitle: unit.model_tipe,
                    docLabel: DOC_RULES[docKey]?.label || docKey,
                    dateStr,
                    ev
                });
            }
        });
    });

    warnings.sort((a, b) => (a.ev.diffDays ?? 999) - (b.ev.diffDays ?? 999));

    if (sidebarBadge) sidebarBadge.textContent = String(warnings.length);
    if (overviewCount) overviewCount.textContent = String(warnings.length);

    if (!listEl) return;

    if (warnings.length === 0) {
        listEl.innerHTML = `
                    <div class="p-6 text-center rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <i class="fa-solid fa-circle-check text-2xl text-emerald-500 mb-2"></i>
                        <p class="text-xs font-bold text-emerald-800">Semua Dokumen Dalam Kondisi Aman</p>
                        <p class="text-[10px] text-emerald-600 mt-0.5">Tidak ada dokumen manpower maupun komisioning unit yang mendekati atau melewati batas masa berlaku.</p>
                    </div>
                `;
        return;
    }

    listEl.innerHTML = warnings.map(w => {
        const badgeCls = w.ev.level === 'mati'
            ? 'bg-gray-900 text-white'
            : (w.ev.level === 'kritis' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');
        const borderCls = w.ev.level === 'mati'
            ? 'border-gray-300 bg-gray-50/70'
            : (w.ev.level === 'kritis' ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30');
        const actionFn = w.source === 'Manpower'
            ? `openManpowerDetailModal(${Number(w.id)})`
            : `openKomisioningDetailModal(${Number(w.id)})`;

        return `
                    <div class="p-3 rounded-xl border ${borderCls} flex flex-wrap items-center justify-between gap-2.5">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase ${w.source === 'Manpower' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'}">${w.source}</span>
                                <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(w.title)}</p>
                                <span class="text-[10px] text-gray-500 truncate">${escapeHtml(w.subtitle)}</span>
                            </div>
                            <p class="text-[10px] text-gray-600 mt-1">
                                Dokumen: <strong>${escapeHtml(w.docLabel)}</strong> • Berlaku s/d <strong>${formatDateID(w.dateStr)}</strong>
                            </p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <span class="px-2.5 py-1 rounded-full text-[9px] font-bold ${badgeCls}">${escapeHtml(w.ev.subText)}</span>
                            <button type="button" onclick="${actionFn}" class="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:border-teal-400 text-[10px] font-semibold text-gray-700 hover:text-teal-600 transition-colors">
                                Perbarui
                            </button>
                        </div>
                    </div>
                `;
    }).join('');
}

/* =====================================================================
 * 4A. PERFORMA MANPOWER (ATR WEEKLY/MONTHLY/UPLOAD & ABSENSI HARIAN/MONTHLY)
 * ===================================================================== */
const MONTH_NAMES_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTH_SHORT_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Menghitung seluruh minggu kalender (Minggu–Sabtu) dari Januari hingga Desember pada tahun tertentu.
 * Week 1 dimulai dari 1 Jan hingga Sabtu pertama, Week berikutnya berjalan tiap Minggu–Sabtu.
 */
function getWeeksInYearSunSat(year) {
    const weeks = [];
    const jan1 = new Date(year, 0, 1);
    const dec31 = new Date(year, 11, 31);
    const firstSatOffset = 6 - jan1.getDay();

    let weekNum = 1;
    let start = new Date(year, 0, 1);
    let end = new Date(year, 0, 1 + firstSatOffset);
    if (end > dec31) end = new Date(dec31);

    const fmtShort = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTH_SHORT_ID[d.getMonth()]}`;

    while (start <= dec31) {
        const monthsCovered = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            if (!monthsCovered.includes(cursor.getMonth())) {
                monthsCovered.push(cursor.getMonth());
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        weeks.push({
            weekNum,
            year,
            key: `${year}-W${weekNum}`,
            label: `Week ${weekNum}`,
            shortRange: `${fmtShort(start)}–${fmtShort(end)}`,
            fullLabel: `Week ${weekNum} (${fmtShort(start)}–${fmtShort(end)} ${year})`,
            startDate: new Date(start),
            endDate: new Date(end),
            months: monthsCovered
        });

        weekNum++;
        start = new Date(end);
        start.setDate(start.getDate() + 1);
        end = new Date(start);
        end.setDate(end.getDate() + 6);
        if (end > dec31) end = new Date(dec31);
    }
    return weeks;
}

function getCurrentCalendarWeekInfo() {
    const today = new Date(getTodayISO() + 'T00:00:00');
    const weeks = getWeeksInYearSunSat(today.getFullYear());
    const found = weeks.find(w => today >= w.startDate && today <= w.endDate) || weeks[weeks.length - 1];
    return found;
}

function getAvailableCalendarWeeks(year = null) {
    const targetYear = year || new Date(getTodayISO() + 'T00:00:00').getFullYear();
    const allWeeks = getWeeksInYearSunSat(targetYear);
    const curr = getCurrentCalendarWeekInfo();
    if (targetYear === curr.year) {
        return allWeeks.filter(w => w.weekNum <= curr.weekNum);
    }
    return allWeeks;
}

function getAtrColorClass(atrVal) {
    if (atrVal === null || atrVal === undefined || isNaN(atrVal)) return 'text-gray-400';
    if (Number(atrVal) >= 100) return 'text-emerald-600';
    if (Number(atrVal) >= 98.5) return 'text-amber-500';
    return 'text-red-600';
}

/**
 * Mengisi riwayat awal Absensi & ATR (Weekly / Monthly) sekali saja agar tabel dapat langsung dieksplorasi.
 */
function seedInitialPerformaHistory() {
    performaHistorySeeded = true;
}

let activeAtrSubView = 'monitoring';

function resolveActiveAtrUploadMode() {
    if (activeAtrSubView === 'monthly') return 'monthly';
    if (activeAtrSubView === 'weekly') return 'weekly';
    if (activeAtrSubView === 'monitoring') {
        return document.getElementById('atr-monitoring-mode')?.value === 'monthly' ? 'monthly' : 'weekly';
    }
    return 'weekly';
}

function syncAtrUploadButtonLabel() {
    const btn = document.getElementById('btn-atr-open-upload');
    const lbl = document.getElementById('btn-atr-open-upload-label');
    if (btn) btn.classList.toggle('hidden', activeAtrSubView === 'punishment');
    if (lbl) {
        const mode = resolveActiveAtrUploadMode();
        lbl.textContent = mode === 'monthly' ? 'Upload ATR Monthly' : 'Upload ATR Weekly';
    }
    const dlLbl = document.getElementById('btn-atr-download-label');
    if (dlLbl) {
        if (activeAtrSubView === 'weekly') dlLbl.textContent = 'Download ATR Weekly';
        else if (activeAtrSubView === 'monthly') dlLbl.textContent = 'Download ATR Monthly';
        else if (activeAtrSubView === 'punishment') dlLbl.textContent = 'Download Punishment';
        else dlLbl.textContent = 'Download ATR';
    }
}

function switchAtrSubView(view) {
    if (view === 'upload') {
        openAtrUploadModal();
        return;
    }
    const views = ['monitoring', 'weekly', 'monthly', 'punishment'];
    activeAtrSubView = views.includes(view) ? view : 'monitoring';
    const activeBtn = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all inline-flex items-center gap-1.5';
    const inactiveBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all inline-flex items-center gap-1.5';

    views.forEach(v => {
        const panel = document.getElementById(`atr-view-${v}`);
        const btn = document.getElementById(`btn-atr-view-${v}`);
        if (panel) {
            if (v === activeAtrSubView) { panel.classList.remove('hidden'); panel.classList.add('flex'); }
            else { panel.classList.add('hidden'); panel.classList.remove('flex'); }
        }
        if (btn) btn.className = v === activeAtrSubView ? activeBtn : inactiveBtn;
    });

    syncAtrUploadButtonLabel();

    if (activeAtrSubView === 'monitoring') renderPerformaManpower();
    if (activeAtrSubView === 'weekly') renderAtrWeeklyTable();
    if (activeAtrSubView === 'monthly') renderAtrMonthlyTable();
    if (activeAtrSubView === 'punishment' && typeof renderPunishmentHistoryTable === 'function') renderPunishmentHistoryTable();
}

function openAtrUploadModal() {
    const mode = resolveActiveAtrUploadMode();
    const modeEl = document.getElementById('atr-upload-mode');
    if (modeEl) modeEl.value = mode;

    // Sinkronkan bulan & tahun dari filter tab ATR yang sedang dibuka
    const uploadMonth = document.getElementById('atr-upload-month');
    const uploadYear = document.getElementById('atr-upload-year');
    if (activeAtrSubView === 'weekly') {
        const mVal = document.getElementById('atr-weekly-month')?.value;
        const yVal = document.getElementById('atr-weekly-year')?.value;
        if (uploadMonth && mVal && mVal !== 'all') uploadMonth.value = mVal;
        if (uploadYear && yVal) uploadYear.value = yVal;
    } else if (activeAtrSubView === 'monthly') {
        const yVal = document.getElementById('atr-monthly-year')?.value;
        if (uploadYear && yVal) uploadYear.value = yVal;
    } else if (activeAtrSubView === 'monitoring') {
        const mVal = document.getElementById('atr-monitoring-month')?.value;
        const yVal = document.getElementById('atr-monitoring-year')?.value;
        if (uploadMonth && mVal) uploadMonth.value = mVal;
        if (uploadYear && yVal) uploadYear.value = yVal;
    }

    resetAtrUploadState();
    populateAtrUploadWeekOptions();
    toggleAtrUploadTargetFields();
    const modal = document.getElementById('modal-atr-upload');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAtrUploadModal() {
    const modal = document.getElementById('modal-atr-upload');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function switchAbsensiSubView(view) {
    if (view === 'upload') {
        openAbsensiUploadModal();
        return;
    }
    const views = ['monitoring', 'monthly'];
    const activeBtn = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all inline-flex items-center gap-1.5';
    const inactiveBtn = 'px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all inline-flex items-center gap-1.5';

    views.forEach(v => {
        const panel = document.getElementById(`absensi-view-${v}`);
        const btn = document.getElementById(`btn-absensi-view-${v}`);
        if (panel) {
            if (v === view) { panel.classList.remove('hidden'); panel.classList.add('flex'); }
            else { panel.classList.add('hidden'); panel.classList.remove('flex'); }
        }
        if (btn) btn.className = v === view ? activeBtn : inactiveBtn;
    });

    if (view === 'monitoring') renderPerformaManpower();
    if (view === 'monthly') renderAbsensiMonthlyTable();
}

function openAbsensiUploadModal() {
    resetAbsensiUploadState();
    const modal = document.getElementById('modal-absensi-upload');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAbsensiUploadModal() {
    const modal = document.getElementById('modal-absensi-upload');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function toggleAtrSort(column) {
    if (atrSortState.column !== column) atrSortState = { column, direction: 'desc' };
    else if (atrSortState.direction === 'desc') atrSortState = { column, direction: 'asc' };
    else atrSortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-atr-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-atr-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (atrSortState.column === col && atrSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (atrSortState.column === col && atrSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderPerformaManpower();
}

function toggleAbsensiSort(column) {
    if (absensiSortState.column !== column) absensiSortState = { column, direction: 'desc' };
    else if (absensiSortState.direction === 'desc') absensiSortState = { column, direction: 'asc' };
    else absensiSortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-absensi-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-absensi-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (absensiSortState.column === col && absensiSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (absensiSortState.column === col && absensiSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderPerformaManpower();
}

function populateAtrMonitoringPeriodOptions() {
    const weekSel = document.getElementById('atr-monitoring-week');
    const yearVal = parseInt(document.getElementById('atr-monitoring-year')?.value || String(new Date().getFullYear()), 10);
    if (weekSel) {
        const weeks = getAvailableCalendarWeeks(yearVal).slice().reverse();
        const currWeek = getCurrentCalendarWeekInfo();
        const prev = weekSel.value;
        weekSel.innerHTML = weeks.map(w => `<option value="${w.key}">${w.label} (${w.shortRange})${w.key === currWeek.key ? ' • MTD' : ''}</option>`).join('');
        if (prev && weeks.some(w => w.key === prev)) weekSel.value = prev;
        else if (weeks.some(w => w.key === currWeek.key)) weekSel.value = currWeek.key;
    }
    const glList = document.getElementById('bapak-asuh-gl-list');
    if (glList) {
        glList.innerHTML = getGroupLeaderManpowerList()
            .map(gl => `<option value="${escapeHtml(gl.nama)}">`)
            .join('');
    }
}

function onAtrMonitoringModeChange() {
    const mode = document.getElementById('atr-monitoring-mode')?.value || 'weekly';
    const weekSel = document.getElementById('atr-monitoring-week');
    const monthSel = document.getElementById('atr-monitoring-month');
    const yearSel = document.getElementById('atr-monitoring-year');
    if (mode === 'monthly') {
        if (weekSel) weekSel.classList.add('hidden');
        if (monthSel) monthSel.classList.remove('hidden');
        if (yearSel) yearSel.classList.remove('hidden');
    } else {
        if (weekSel) weekSel.classList.remove('hidden');
        if (monthSel) monthSel.classList.add('hidden');
        if (yearSel) yearSel.classList.add('hidden');
    }
    syncAtrUploadButtonLabel();
    renderPerformaManpower();
}

function renderBapakAsuhDisplayHtml(mpId, val) {
    const clean = String(val || '').trim();
    const label = clean ? escapeHtml(clean) : '-';
    const cls = clean
        ? 'text-gray-800 hover:text-teal-700 hover:underline'
        : 'text-gray-400 hover:text-teal-600';
    return `
                <button
                    type="button"
                    onclick="startEditBapakAsuhCell(${Number(mpId)})"
                    title="${clean ? 'Klik untuk edit Bapak Asuh' : 'Klik untuk isi Bapak Asuh secara manual'}"
                    class="inline-flex items-center min-w-[44px] py-0.5 rounded px-1.5 -mx-1.5 hover:bg-teal-50 transition-colors cursor-pointer ${cls}"
                >${label}</button>
            `;
}

function startEditBapakAsuhCell(mpId) {
    const cellEl = document.getElementById(`atr-bapak-asuh-cell-${Number(mpId)}`);
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!cellEl || !mp) return;

    const prevVal = String(mp.bapak_asuh || '').trim();
    cellEl.innerHTML = `
                <input
                    id="atr-bapak-asuh-input-${Number(mpId)}"
                    type="text"
                    list="bapak-asuh-gl-list"
                    data-prev-val="${escapeHtml(prevVal)}"
                    value="${escapeHtml(prevVal)}"
                    placeholder="Nama Bapak Asuh..."
                    onkeydown="handleBapakAsuhKeydown(event, ${Number(mpId)})"
                    onblur="commitBapakAsuhEdit(${Number(mpId)})"
                    class="w-36 px-2 py-0.5 rounded-lg border border-teal-400 bg-white text-[10px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
            `;
    const inputEl = document.getElementById(`atr-bapak-asuh-input-${Number(mpId)}`);
    if (inputEl) {
        inputEl.focus();
        inputEl.select();
    }
}

function handleBapakAsuhKeydown(event, mpId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target?.blur();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        const inputEl = document.getElementById(`atr-bapak-asuh-input-${Number(mpId)}`);
        const prevVal = inputEl ? (inputEl.getAttribute('data-prev-val') || '') : '';
        if (inputEl) inputEl.dataset.cancelled = '1';
        const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
        if (mp) mp.bapak_asuh = prevVal;
        const cellEl = document.getElementById(`atr-bapak-asuh-cell-${Number(mpId)}`);
        if (cellEl) cellEl.innerHTML = renderBapakAsuhDisplayHtml(mpId, prevVal);
    }
}

function commitBapakAsuhEdit(mpId) {
    const inputEl = document.getElementById(`atr-bapak-asuh-input-${Number(mpId)}`);
    if (!inputEl || inputEl.dataset.cancelled === '1') return;
    const nextVal = String(inputEl.value || '').trim();
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (mp) mp.bapak_asuh = nextVal;
    const cellEl = document.getElementById(`atr-bapak-asuh-cell-${Number(mpId)}`);
    if (cellEl) cellEl.innerHTML = renderBapakAsuhDisplayHtml(mpId, nextVal);
}

/**
 * Merender Monitoring ATR (Weekly / Monthly dari atrWeeklyState & atrMonthlyState) dan Monitoring Absensi Harian.
 */
function renderPerformaManpower() {
    seedInitialPerformaHistory();
    const weekSel = document.getElementById('atr-monitoring-week');
    if (weekSel && weekSel.options.length === 0) populateAtrMonitoringPeriodOptions();
    const currWeek = getCurrentCalendarWeekInfo();

    // --- 1. RENDER MONITORING ATR ---
    const atrTbody = document.getElementById('performa-atr-tbody');
    const atrCountEl = document.getElementById('atr-sync-count');
    const atrQuery = (document.getElementById('atr-monitoring-search')?.value || '').trim().toLowerCase();
    const atrRoleFilter = document.getElementById('atr-role-filter')?.value || 'all';
    const atrMode = document.getElementById('atr-monitoring-mode')?.value || 'weekly';
    const selectedWeekKey = weekSel?.value || currWeek.key;
    const selectedMonthIdx = parseInt(document.getElementById('atr-monitoring-month')?.value ?? String(new Date().getMonth()), 10);
    const selectedYear = parseInt(document.getElementById('atr-monitoring-year')?.value ?? String(new Date().getFullYear()), 10);
    const weekMeta = getWeeksInYearSunSat(selectedYear).find(w => w.key === selectedWeekKey) || currWeek;
    const periodLabelDefault = atrMode === 'monthly'
        ? `${MONTH_NAMES_ID[selectedMonthIdx]} ${selectedYear}`
        : weekMeta.fullLabel;

    if (typeof seedInitialPunishmentHistory === 'function') seedInitialPunishmentHistory();

    let atrRows = manpowerState.map(mp => {
        const rec = atrMode === 'monthly'
            ? atrMonthlyState[`${mp.id}::${selectedYear}-${selectedMonthIdx}`]
            : atrWeeklyState[`${mp.id}::${selectedWeekKey}`];
        const hasAtr = rec && rec.atr !== null && rec.atr !== undefined && !isNaN(Number(rec.atr));
        const atrVal = hasAtr ? Number(rec.atr) : null;
        let monthPunishInfo = null;
        if (atrMode === 'monthly' && typeof evaluateEmployeeAtrPunishmentTimeline === 'function') {
            monthPunishInfo = evaluateEmployeeAtrPunishmentTimeline(mp.id, selectedYear).months[selectedMonthIdx] || null;
        }
        let rek = hasAtr ? (atrVal >= 98.5 ? 'Layak Skill Up' : 'Pembinaan ATR') : '-';
        if (monthPunishInfo) {
            if (monthPunishInfo.status === 'PENDING') rek = `Belum ${monthPunishInfo.requiredCode}`;
            else if (monthPunishInfo.status === 'GIVEN' && monthPunishInfo.givenAtrRecord) rek = `${monthPunishInfo.givenAtrRecord.tingkat} Diberikan`;
            else if (monthPunishInfo.status === 'PEMUTIHAN') rek = `Pemutihan ${monthPunishInfo.expiredCode}`;
        }
        const periodeText = (rec && rec.periode) ? rec.periode : periodLabelDefault;
        return {
            mp,
            nrp: mp.nrp,
            nama: mp.nama,
            jabatan: mp.jabatan || '-',
            perusahaan: mp.perusahaan || '-',
            atr: atrVal,
            nc: rec?.nc || 0,
            s: rec?.s || 0,
            i: rec?.i || 0,
            a: rec?.a || 0,
            periode: periodeText,
            rekomendasi: rek,
            monthPunishInfo,
            bapak_asuh: String(mp.bapak_asuh || '').trim()
        };
    }).filter(r => {
        if (atrRoleFilter !== 'all' && r.jabatan !== atrRoleFilter) return false;
        if (atrQuery) {
            const hay = `${r.nrp} ${r.nama} ${r.jabatan} ${r.perusahaan} ${r.periode} ${r.rekomendasi} ${r.bapak_asuh}`.toLowerCase();
            if (!hay.includes(atrQuery)) return false;
        }
        return true;
    });

    if (atrCountEl) atrCountEl.textContent = `Total Manpower: ${atrRows.length}`;

    if (atrSortState.column && atrSortState.direction !== 'none') {
        const col = atrSortState.column;
        const dir = atrSortState.direction === 'asc' ? 1 : -1;
        atrRows.sort((a, b) => {
            if (col === 'atr') return ((a.atr ?? -1) - (b.atr ?? -1)) * dir;
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (atrTbody) {
        if (atrRows.length === 0) {
            atrTbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-xs text-gray-400">Tidak ada data ATR yang cocok.</td></tr>';
        } else {
            atrTbody.innerHTML = atrRows.map(r => {
                const outBadge = isPersonOutOfRoster(r.mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
                const atrOnClick = atrMode === 'monthly' && typeof openAtrMonthlyCellDetail === 'function'
                    ? `openAtrMonthlyCellDetail(${Number(r.mp.id)}, ${selectedYear}, ${selectedMonthIdx})`
                    : `openAtrDetailModal(${Number(r.mp.id)}, '${escapeJsString(r.periode)}', ${r.atr}, ${r.nc}, ${r.s}, ${r.i}, ${r.a})`;
                const pendingIconHtml = (r.monthPunishInfo && r.monthPunishInfo.status === 'PENDING')
                    ? `<i class="fa-solid fa-circle-exclamation text-red-600 ml-1" title="Belum diberi ${escapeHtml(r.monthPunishInfo.requiredCode)}"></i>`
                    : '';
                const atrHtml = r.atr !== null
                    ? `<button
                                    type="button"
                                    onclick="${atrOnClick}"
                                    class="font-mono font-semibold ${getAtrColorClass(r.atr)} hover:underline cursor-pointer inline-flex items-center"
                                    title="Klik untuk melihat detail alasan (NC / S / I / A)"
                                >${r.atr.toFixed(1)}%${pendingIconHtml}</button>`
                    : '<span class="font-mono text-gray-400">-</span>';
                let rekBadgeHtml = '<span class="text-gray-400">-</span>';
                if (r.monthPunishInfo && r.monthPunishInfo.status === 'PENDING') {
                    rekBadgeHtml = `<button type="button" onclick="openAtrMonthlyCellDetail(${Number(r.mp.id)}, ${selectedYear}, ${selectedMonthIdx})" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold hover:bg-red-200 transition-colors cursor-pointer"><i class="fa-solid fa-circle-exclamation text-[9px]"></i><span>${escapeHtml(r.rekomendasi)}</span></button>`;
                } else if (r.monthPunishInfo && r.monthPunishInfo.status === 'GIVEN') {
                    rekBadgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold"><i class="fa-solid fa-circle-check text-[9px]"></i><span>${escapeHtml(r.rekomendasi)}</span></span>`;
                } else if (r.atr !== null) {
                    rekBadgeHtml = `<span class="px-2.5 py-0.5 rounded-full ${r.atr >= 98.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(r.rekomendasi)}</span>`;
                }
                return `
                            <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                                <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(r.nrp)}</td>
                                <td class="py-3 px-4 text-gray-800 whitespace-nowrap">${escapeHtml(r.nama)}${outBadge}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.jabatan)}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.perusahaan)}</td>
                                <td class="py-3 px-4 whitespace-nowrap">${atrHtml}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.periode)}</td>
                                <td class="py-3 px-4 whitespace-nowrap">${rekBadgeHtml}</td>
                                <td id="atr-bapak-asuh-cell-${Number(r.mp.id)}" class="py-3 px-4 whitespace-nowrap">${renderBapakAsuhDisplayHtml(r.mp.id, r.bapak_asuh)}</td>
                            </tr>
                        `;
            }).join('');
        }
    }

    // --- 2. RENDER MONITORING ABSENSI HARIAN ---
    const dateInput = document.getElementById('absensi-monitoring-date');
    if (dateInput && !dateInput.value) {
        dateInput.value = getTodayISO();
    }
    const activeDateIso = dateInput?.value || getTodayISO();
    const activeDateText = formatDateID(activeDateIso);
    const dateLabelEl = document.getElementById('absensi-today-date');
    if (dateLabelEl) dateLabelEl.textContent = activeDateText;

    const absQuery = (document.getElementById('absensi-monitoring-search')?.value || '').trim().toLowerCase();
    const shiftFilter = document.getElementById('absensi-shift-filter')?.value || 'all';

    let absRows = manpowerState.map(mp => {
        const rec = absensiRecordsState[`${mp.id}::${activeDateIso}`] || {
            mpId: mp.id,
            date: activeDateIso,
            code: '-',
            shift: '-',
            cekin: '',
            status: '-',
            note: ''
        };
        return {
            mp,
            nrp: mp.nrp,
            nama: mp.nama,
            jabatan: mp.jabatan || '-',
            perusahaan: mp.perusahaan || '-',
            tanggal: activeDateIso,
            tanggalText: activeDateText,
            shift: rec.shift || '-',
            cekin: rec.cekin || '-',
            absensi_status: rec.status || '-',
            note: rec.note || ''
        };
    }).filter(r => {
        if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
        if (absQuery) {
            const hay = `${r.nrp} ${r.nama} ${r.jabatan} ${r.perusahaan} ${r.cekin} ${r.absensi_status} ${r.note}`.toLowerCase();
            if (!hay.includes(absQuery)) return false;
        }
        return true;
    });

    const totalMpEl = document.getElementById('absensi-count-total');
    if (totalMpEl) totalMpEl.textContent = `Total MP: ${absRows.length}`;

    if (absensiSortState.column && absensiSortState.direction !== 'none') {
        const col = absensiSortState.column;
        const dir = absensiSortState.direction === 'asc' ? 1 : -1;
        absRows.sort((a, b) => String(a[col] || '').toLowerCase().localeCompare(String(b[col] || '').toLowerCase(), 'id') * dir);
    }

    const absTbody = document.getElementById('performa-absensi-tbody');
    if (absTbody) {
        if (absRows.length === 0) {
            absTbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Tidak ada data absensi yang cocok.</td></tr>';
        } else {
            absTbody.innerHTML = absRows.map(r => {
                const outBadge = isPersonOutOfRoster(r.mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
                const stBadgeCls = getAbsensiStatusBadgeClass(r.absensi_status);
                const cekinColor = r.absensi_status === 'Sesuai'
                    ? 'text-emerald-600'
                    : (r.absensi_status === 'Telat Absensi' ? 'text-red-600' : 'text-gray-500');
                const shiftHint = r.shift === 'S1' ? ' (S1)' : (r.shift === 'S2' ? ' (S2)' : '');

                return `
                            <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                                <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(r.nrp)}</td>
                                <td class="py-3 px-4 text-gray-800 whitespace-nowrap">${escapeHtml(r.nama)}${outBadge}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.jabatan)}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.perusahaan)}</td>
                                <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(r.tanggalText)}</td>
                                <td class="py-3 px-4 font-mono ${cekinColor} whitespace-nowrap">${escapeHtml(r.cekin)}${shiftHint}</td>
                                <td class="py-3 px-4 whitespace-nowrap">
                                    <button
                                        type="button"
                                        onclick="openEditAbsensiModal(${Number(r.mp.id)}, '${activeDateIso}')"
                                        title="Klik status untuk validasi / edit"
                                        class="px-2.5 py-0.5 rounded-full ${stBadgeCls} hover:ring-2 hover:ring-teal-300 transition-all cursor-pointer"
                                    >${escapeHtml(r.absensi_status)}</button>
                                    ${r.note ? `<p class="text-[8.5px] text-gray-400 mt-0.5">${escapeHtml(r.note)}</p>` : ''}
                                </td>
                            </tr>
                        `;
            }).join('');
        }
    }

    // Sinkronkan sub-tab weekly & monthly bila sedang terbuka
    renderAtrWeeklyTable();
    renderAtrMonthlyTable();
    renderAbsensiMonthlyTable();
}

function getAbsensiStatusBadgeClass(status) {
    switch (status) {
        case 'Sesuai': return 'bg-emerald-100 text-emerald-700';
        case 'Telat Absensi': return 'bg-red-100 text-red-700';
        case 'NC': return 'bg-red-100 text-red-700';
        case 'Sakit': return 'bg-amber-100 text-amber-700';
        case 'Izin': return 'bg-amber-100 text-amber-700';
        case 'Cuti': return 'bg-blue-100 text-blue-700';
        case 'Induksi': return 'bg-orange-100 text-orange-700';
        case 'MCU': return 'bg-purple-100 text-purple-700';
        case 'Training': return 'bg-yellow-100 text-yellow-800';
        case 'OFF': return 'bg-red-100 text-red-700';
        case 'Alpha': return 'bg-red-100 text-red-700';
        default: return 'bg-gray-100 text-gray-500';
    }
}

/* ----- ATR WEEKLY (WEEK TAHUNAN MINGGU–SABTU DARI JANUARI) ----- */
function toggleAtrWeeklySort(column) {
    if (atrWeeklySortState.column !== column) atrWeeklySortState = { column, direction: 'desc' };
    else if (atrWeeklySortState.direction === 'desc') atrWeeklySortState.direction = 'asc';
    else atrWeeklySortState = { column: null, direction: 'none' };
    renderAtrWeeklyTable();
}

function renderAtrWeeklyTable() {
    seedInitialPerformaHistory();
    const thead = document.getElementById('atr-weekly-thead');
    const tbody = document.getElementById('atr-weekly-tbody');
    if (!thead || !tbody) return;

    const query = (document.getElementById('atr-weekly-search')?.value || '').trim().toLowerCase();
    const monthFilter = document.getElementById('atr-weekly-month')?.value ?? '10';
    const year = parseInt(document.getElementById('atr-weekly-year')?.value || '2026', 10);

    const allWeeks = getWeeksInYearSunSat(year);
    const weeks = monthFilter === 'all'
        ? allWeeks
        : allWeeks.filter(w => w.months.includes(parseInt(monthFilter, 10)));

    const getIconCls = (col) => {
        if (atrWeeklySortState.column === col && atrWeeklySortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (atrWeeklySortState.column === col && atrWeeklySortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };

    thead.innerHTML = `
                <tr class="bg-gray-50 text-[10px] font-normal text-gray-600">
                    <th onclick="toggleAtrWeeklySort('nama')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap sticky left-0 bg-gray-50 z-20 w-[136px] min-w-[136px] max-w-[136px] border-b border-r border-gray-200/70">
                        <div class="flex items-center justify-between gap-2"><span>Nama / NRP</span><i class="fa-solid ${getIconCls('nama')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleAtrWeeklySort('jabatan')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap sm:sticky sm:left-[136px] bg-gray-50 z-20 w-[148px] min-w-[148px] max-w-[148px] border-b border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div class="flex items-center justify-between gap-2"><span>Jabatan / Perusahaan</span><i class="fa-solid ${getIconCls('jabatan')} text-[9px]"></i></div>
                    </th>
                    ${weeks.map(w => `
                        <th onclick="toggleAtrWeeklySort('${w.key}')" class="py-2.5 px-3 text-center font-normal cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap bg-gray-50 border-b border-gray-100">
                            <div class="flex items-center justify-center gap-1"><span>${w.label}</span><i class="fa-solid ${getIconCls(w.key)} text-[8px]"></i></div>
                            <div class="text-[8px] text-gray-400 mt-0.5">${w.shortRange}</div>
                        </th>
                    `).join('')}
                </tr>
            `;

    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    });

    if (atrWeeklySortState.column && atrWeeklySortState.direction !== 'none') {
        const col = atrWeeklySortState.column;
        const dir = atrWeeklySortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'nama') return a.nama.localeCompare(b.nama, 'id') * dir;
            if (col === 'jabatan') return `${a.jabatan} ${a.perusahaan}`.localeCompare(`${b.jabatan} ${b.perusahaan}`, 'id') * dir;
            const vA = atrWeeklyState[`${a.id}::${col}`]?.atr ?? -1;
            const vB = atrWeeklyState[`${b.id}::${col}`]?.atr ?? -1;
            return (vA - vB) * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${weeks.length + 2}" class="py-10 text-center text-xs text-gray-400">Tidak ada data ATR Weekly yang cocok.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map((mp, idx) => {
        const rowBg = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
        const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
        return `
                    <tr class="group ${rowBg} hover:bg-teal-50 transition-colors">
                        <td class="py-3 px-3 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 w-[136px] min-w-[136px] max-w-[136px] border-b border-r border-gray-100 transition-colors">
                            <p class="text-gray-800 truncate">${escapeHtml(mp.nama)}${outBadge}</p>
                            <p class="font-mono text-[9px] text-teal-600 mt-0.5 truncate">${escapeHtml(mp.nrp)}</p>
                        </td>
                        <td class="py-3 px-3 whitespace-nowrap sm:sticky sm:left-[136px] z-10 ${rowBg} group-hover:bg-teal-50 w-[148px] min-w-[148px] max-w-[148px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] transition-colors">
                            <p class="text-gray-700 truncate">${escapeHtml(mp.jabatan || '-')}</p>
                            <p class="text-[9px] text-gray-400 mt-0.5 truncate">${escapeHtml(mp.perusahaan || '-')}${mp.domisili ? ` (${escapeHtml(mp.domisili)})` : ''}</p>
                        </td>
                        ${weeks.map(w => {
            const rec = atrWeeklyState[`${mp.id}::${w.key}`];
            if (!rec) return `<td class="py-3 px-3 text-center text-gray-300 border-b border-gray-100">-</td>`;
            const cls = getAtrColorClass(rec.atr);
            return `
                                <td class="py-3 px-3 text-center border-b border-gray-100 whitespace-nowrap">
                                    <button
                                        type="button"
                                        onclick="openAtrDetailModal(${Number(mp.id)}, '${escapeJsString(w.fullLabel)}', ${rec.atr}, ${rec.nc || 0}, ${rec.s || 0}, ${rec.i || 0}, ${rec.a || 0})"
                                        class="font-mono font-semibold ${cls} hover:underline cursor-pointer"
                                    >${Number(rec.atr).toFixed(1)}%</button>
                                </td>
                            `;
        }).join('')}
                    </tr>
                `;
    }).join('');
}

/* ----- ATR MONTHLY (JANUARI–DESEMBER + RATA-RATA 1 TAHUN) ----- */
function toggleAtrMonthlySort(column) {
    if (atrMonthlySortState.column !== column) atrMonthlySortState = { column, direction: 'desc' };
    else if (atrMonthlySortState.direction === 'desc') atrMonthlySortState.direction = 'asc';
    else atrMonthlySortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-atr-monthly-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-atr-monthly-sort-icon');
        icon.className = 'fa-solid text-[8px] transition-colors';
        if (atrMonthlySortState.column === col && atrMonthlySortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (atrMonthlySortState.column === col && atrMonthlySortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderAtrMonthlyTable();
}

function renderAtrMonthlyTable() {
    seedInitialPerformaHistory();
    if (typeof seedInitialPunishmentHistory === 'function') seedInitialPunishmentHistory();
    const tbody = document.getElementById('atr-monthly-tbody');
    const year = parseInt(document.getElementById('atr-monthly-year')?.value || '2026', 10);
    if (typeof updateAtrPunishmentBadges === 'function') updateAtrPunishmentBadges(year);
    if (!tbody) return;

    const query = (document.getElementById('atr-monthly-search')?.value || '').trim().toLowerCase();
    const punishFilter = document.getElementById('atr-monthly-punishment-filter')?.value || 'all';

    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    }).map(mp => {
        let sum = 0;
        let count = 0;
        const months = [];
        for (let m = 0; m < 12; m++) {
            const rec = atrMonthlyState[`${mp.id}::${year}-${m}`] || null;
            months.push(rec);
            if (rec && !isNaN(rec.atr)) {
                sum += Number(rec.atr);
                count++;
            }
        }
        const avg = count > 0 ? Number((sum / count).toFixed(1)) : null;
        const timeline = typeof evaluateEmployeeAtrPunishmentTimeline === 'function'
            ? evaluateEmployeeAtrPunishmentTimeline(mp.id, year)
            : { months: new Array(12).fill(null), pendingCount: 0, currentActiveLevel: 0, currentActiveCode: '', currentGreenStreak: 0, currentExpiryNeeded: 0 };
        return { mp, months, avg, timeline };
    }).filter(r => {
        if (punishFilter === 'pending') return r.timeline.pendingCount > 0;
        if (punishFilter === 'active') return r.timeline.currentActiveLevel > 0;
        if (punishFilter === 'safe') return r.timeline.currentActiveLevel === 0 && r.timeline.pendingCount === 0;
        return true;
    });

    if (atrMonthlySortState.column && atrMonthlySortState.direction !== 'none') {
        const col = atrMonthlySortState.column;
        const dir = atrMonthlySortState.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (col === 'nama') return a.mp.nama.localeCompare(b.mp.nama, 'id') * dir;
            if (col === 'jabatan') return `${a.mp.jabatan} ${a.mp.perusahaan}`.localeCompare(`${b.mp.jabatan} ${b.mp.perusahaan}`, 'id') * dir;
            if (col === 'avg') return ((a.avg ?? -1) - (b.avg ?? -1)) * dir;
            if (col === 'pembinaan') {
                const scoreA = a.timeline.currentActiveLevel * 100 + a.timeline.pendingCount;
                const scoreB = b.timeline.currentActiveLevel * 100 + b.timeline.pendingCount;
                return (scoreA - scoreB) * dir;
            }
            if (/^m\d+$/.test(col)) {
                const mIdx = parseInt(col.slice(1), 10);
                return ((a.months[mIdx]?.atr ?? -1) - (b.months[mIdx]?.atr ?? -1)) * dir;
            }
            return 0;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="16" class="py-10 text-center text-xs text-gray-400">Tidak ada data ATR Monthly yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
        const rowBg = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
        const outBadge = isPersonOutOfRoster(r.mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
        const avgCls = getAtrColorClass(r.avg);
        const tl = r.timeline;

        // Ringkasan status pembinaan aktif karyawan di akhir kolom
        let statusHtml = '<span class="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold">Aman</span>';
        if (tl.currentActiveLevel > 0 || tl.pendingCount > 0) {
            const activeMeta = typeof getPunishmentMetaByLevel === 'function' ? getPunishmentMetaByLevel(tl.currentActiveLevel) : null;
            const activePill = tl.currentActiveCode
                ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${activeMeta?.badgeCls || 'bg-amber-100 text-amber-800'}">${escapeHtml(tl.currentActiveCode)}</span>`
                : '';
            const pendingPill = tl.pendingCount > 0
                ? `<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-100 border border-red-200 text-red-700 text-[8.5px] font-bold"><i class="fa-solid fa-circle-exclamation text-[8px]"></i>${tl.pendingCount} belum</span>`
                : '';
            const streakHint = (tl.currentActiveLevel > 0 && tl.currentGreenStreak > 0 && tl.currentExpiryNeeded > 0)
                ? `<span class="text-[8px] font-mono text-sky-600 font-semibold">Hijau ${tl.currentGreenStreak}/${tl.currentExpiryNeeded}</span>`
                : '';
            statusHtml = `<div class="flex flex-col items-center gap-0.5">${activePill}${pendingPill}${streakHint}</div>`;
        }

        return `
                    <tr class="group ${rowBg} hover:bg-teal-50 transition-colors">
                        <td class="py-2.5 px-3 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 w-[136px] min-w-[136px] max-w-[136px] border-b border-r border-gray-100 transition-colors">
                            <p class="text-gray-800 truncate">${escapeHtml(r.mp.nama)}${outBadge}</p>
                            <p class="font-mono text-[9px] text-teal-600 mt-0.5 truncate">${escapeHtml(r.mp.nrp)}</p>
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap sm:sticky sm:left-[136px] z-10 ${rowBg} group-hover:bg-teal-50 w-[148px] min-w-[148px] max-w-[148px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] transition-colors">
                            <p class="text-gray-700 truncate">${escapeHtml(r.mp.jabatan || '-')}</p>
                            <p class="text-[9px] text-gray-400 mt-0.5 truncate">${escapeHtml(r.mp.perusahaan || '-')}${r.mp.domisili ? ` (${escapeHtml(r.mp.domisili)})` : ''}</p>
                        </td>
                        ${r.months.map((rec, mIdx) => {
            const mInfo = tl.months[mIdx];
            if (!rec) {
                // Jika tidak ada angka ATR namun ada riwayat punishment di bulan ini
                if (mInfo && (mInfo.givenAtrRecord || mInfo.nonAtrEscalatingRecord)) {
                    const tagRec = mInfo.givenAtrRecord || mInfo.nonAtrEscalatingRecord;
                    const tagText = mInfo.givenAtrRecord ? tagRec.tingkat : `${tagRec.tingkat} Non-ATR`;
                    return `<td class="py-2 px-1.5 text-center border-b border-gray-100 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[8.5px] font-bold">${escapeHtml(tagText)}</span></td>`;
                }
                return `<td class="py-2.5 px-2 text-center text-gray-300 border-b border-gray-100">-</td>`;
            }
            const cls = getAtrColorClass(rec.atr);
            const clickFn = typeof openAtrMonthlyCellDetail === 'function'
                ? `openAtrMonthlyCellDetail(${Number(r.mp.id)}, ${year}, ${mIdx})`
                : `openAtrDetailModal(${Number(r.mp.id)}, '${escapeJsString(`${MONTH_NAMES_ID[mIdx]} ${year}`)}', ${rec.atr}, ${rec.nc || 0}, ${rec.s || 0}, ${rec.i || 0}, ${rec.a || 0})`;

            let badgeHtml = '';
            let cellTitle = 'Klik untuk detail NC/S/I/A & pembinaan';
            if (mInfo) {
                cellTitle = mInfo.reasonNote || cellTitle;
                if (mInfo.status === 'PENDING') {
                    const meta = typeof getPunishmentMetaByLevel === 'function' ? getPunishmentMetaByLevel(mInfo.requiredLevel) : null;
                    badgeHtml = `
                                        <span data-atr-punish-state="pending" data-atr-punish-level="${escapeHtml(mInfo.requiredCode)}"
                                            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border text-[8px] font-extrabold leading-tight ${meta?.pillPending || 'bg-red-100 text-red-700 border-red-300'}">
                                            <i class="fa-solid fa-circle-exclamation text-[7.5px]"></i>
                                            <span>${escapeHtml(mInfo.requiredCode)}</span>
                                        </span>
                                    `;
                } else if (mInfo.status === 'GIVEN' && mInfo.givenAtrRecord) {
                    badgeHtml = `
                                        <span data-atr-punish-state="given" data-atr-punish-level="${escapeHtml(mInfo.givenAtrRecord.tingkat)}"
                                            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-bold leading-tight">
                                            <i class="fa-solid fa-circle-check text-[7.5px]"></i>
                                            <span>${escapeHtml(mInfo.givenAtrRecord.tingkat)}</span>
                                        </span>
                                    `;
                } else if (mInfo.status === 'NON_ATR_ESCALATED' && mInfo.nonAtrEscalatingRecord) {
                    badgeHtml = `
                                        <span data-atr-punish-state="non-atr" data-atr-punish-level="${escapeHtml(mInfo.nonAtrEscalatingRecord.tingkat)}"
                                            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 text-[8px] font-bold leading-tight">
                                            <span>${escapeHtml(mInfo.nonAtrEscalatingRecord.tingkat)} Non-ATR</span>
                                        </span>
                                    `;
                } else if (mInfo.status === 'PEMUTIHAN') {
                    badgeHtml = `
                                        <span data-atr-punish-state="pemutihan"
                                            class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full border bg-teal-50 text-teal-700 border-teal-200 text-[7.5px] font-bold leading-tight">
                                            <i class="fa-solid fa-check text-[7px]"></i>
                                            <span>Putih</span>
                                        </span>
                                    `;
                }
            }

            return `
                                <td class="py-2 px-1.5 text-center border-b border-gray-100 whitespace-nowrap align-middle">
                                    <button
                                        type="button"
                                        onclick="${clickFn}"
                                        title="${escapeHtml(cellTitle)}"
                                        class="inline-flex flex-col items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-lg hover:bg-gray-100/80 transition-colors cursor-pointer"
                                    >
                                        <span class="font-mono font-semibold ${cls} leading-tight">${Number(rec.atr).toFixed(1)}%</span>
                                        ${badgeHtml}
                                    </button>
                                </td>
                            `;
        }).join('')}
                        <td class="py-2.5 px-3 text-center border-b border-gray-100 bg-teal-50/40 whitespace-nowrap">
                            <span class="font-mono font-bold ${avgCls}">${r.avg !== null ? `${r.avg.toFixed(1)}%` : '-'}</span>
                        </td>
                        <td class="py-2 px-2.5 text-center border-b border-gray-100 whitespace-nowrap">
                            ${statusHtml}
                        </td>
                    </tr>
                `;
    }).join('');
}

function openAtrDetailModal(mpId, periodLabel, atr, nc, s, i, a) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    const subEl = document.getElementById('atr-detail-subtitle');
    const perEl = document.getElementById('atr-detail-period');
    const pctEl = document.getElementById('atr-detail-percent');
    const ncEl = document.getElementById('atr-detail-nc');
    const sEl = document.getElementById('atr-detail-s');
    const iEl = document.getElementById('atr-detail-i');
    const aEl = document.getElementById('atr-detail-a');
    const sumEl = document.getElementById('atr-detail-summary-box');

    if (subEl) subEl.textContent = mp ? `${mp.nama} (${mp.nrp}) • ${mp.jabatan}` : `NRP #${mpId}`;
    if (perEl) perEl.textContent = periodLabel || '-';
    const numAtr = Number(atr ?? 0);
    if (pctEl) {
        pctEl.textContent = `${numAtr.toFixed(1)}%`;
        pctEl.className = `text-lg font-extrabold font-mono mt-0.5 ${getAtrColorClass(numAtr)}`;
    }
    if (ncEl) ncEl.textContent = String(nc || 0);
    if (sEl) sEl.textContent = String(s || 0);
    if (iEl) iEl.textContent = String(i || 0);
    if (aEl) aEl.textContent = String(a || 0);

    const totalIssues = (Number(nc) || 0) + (Number(s) || 0) + (Number(i) || 0) + (Number(a) || 0);
    if (sumEl) {
        sumEl.textContent = numAtr >= 100 && totalIssues === 0
            ? 'Kehadiran sempurna 100% pada periode ini tanpa NC, Sakit, Izin, maupun Alpha.'
            : `Tercatat ${totalIssues} kejadian pengurang ATR (NC: ${nc || 0}, Sakit: ${s || 0}, Izin: ${i || 0}, Alpha: ${a || 0}).`;
    }

    const punishPanel = document.getElementById('atr-detail-punishment-section');
    if (punishPanel) {
        punishPanel.classList.add('hidden');
        punishPanel.innerHTML = '';
    }

    const modal = document.getElementById('modal-atr-detail');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeAtrDetailModal() {
    const modal = document.getElementById('modal-atr-detail');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function toggleAtrUploadTargetFields() {
    const mode = document.getElementById('atr-upload-mode')?.value || 'weekly';
    const isWeekly = mode === 'weekly';
    const weekWrap = document.getElementById('atr-upload-week-wrap');
    if (weekWrap) weekWrap.classList.toggle('hidden', !isWeekly);
    const periodRow = document.getElementById('atr-upload-period-row');
    if (periodRow) {
        periodRow.classList.toggle('grid-cols-3', isWeekly);
        periodRow.classList.toggle('grid-cols-2', !isWeekly);
    }
    const label = isWeekly ? 'ATR Weekly' : 'ATR Monthly';
    const titleEl = document.getElementById('modal-atr-upload-title');
    const btnTextEl = document.getElementById('btn-apply-atr-upload-text');
    if (titleEl) titleEl.textContent = `Upload ${label}`;
    if (btnTextEl) btnTextEl.textContent = `Update ${label}`;
    renderAtrUploadPreview();
}

function populateAtrUploadWeekOptions() {
    const monthIdx = parseInt(document.getElementById('atr-upload-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('atr-upload-year')?.value || '2026', 10);
    const weekSel = document.getElementById('atr-upload-week');
    if (!weekSel) return;

    const weeks = getWeeksInYearSunSat(year).filter(w => w.months.includes(monthIdx));
    weekSel.innerHTML = weeks.map(w => `<option value="${w.key}">${w.fullLabel}</option>`).join('');
    if (weeks.length) weekSel.value = weeks[weeks.length - 1].key;
    toggleAtrUploadTargetFields();
}

function downloadSampleRawAtrExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const headers = [['NRP', 'Nama', 'Jabatan', 'ATR (%)', 'NC', 'S', 'I', 'A']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template ATR');
    XLSX.writeFile(wb, 'Template_Upload_ATR_PANTAU_SE.xlsx');
    showToast('Template kosong ATR (judul kolom saja) berhasil diunduh.', 'success');
}

function downloadActiveAtrExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    if (activeAtrSubView === 'weekly') {
        downloadAtrWeeklyExcel();
    } else if (activeAtrSubView === 'monthly') {
        downloadAtrMonthlyExcel();
    } else if (activeAtrSubView === 'punishment') {
        downloadAtrPunishmentExcel();
    } else {
        downloadAtrMonitoringExcel();
    }
}

function downloadAtrMonitoringExcel() {
    seedInitialPerformaHistory();
    if (typeof seedInitialPunishmentHistory === 'function') seedInitialPunishmentHistory();

    const weekSel = document.getElementById('atr-monitoring-week');
    if (weekSel && weekSel.options.length === 0) populateAtrMonitoringPeriodOptions();
    const currWeek = getCurrentCalendarWeekInfo();

    const atrQuery = (document.getElementById('atr-monitoring-search')?.value || '').trim().toLowerCase();
    const atrRoleFilter = document.getElementById('atr-role-filter')?.value || 'all';
    const atrMode = document.getElementById('atr-monitoring-mode')?.value || 'weekly';
    const selectedWeekKey = weekSel?.value || currWeek.key;
    const selectedMonthIdx = parseInt(document.getElementById('atr-monitoring-month')?.value ?? String(new Date().getMonth()), 10);
    const selectedYear = parseInt(document.getElementById('atr-monitoring-year')?.value ?? String(new Date().getFullYear()), 10);
    const weekMeta = getWeeksInYearSunSat(selectedYear).find(w => w.key === selectedWeekKey) || currWeek;
    const periodLabelDefault = atrMode === 'monthly'
        ? `${MONTH_NAMES_ID[selectedMonthIdx]} ${selectedYear}`
        : weekMeta.fullLabel;

    let atrRows = manpowerState.map(mp => {
        const rec = atrMode === 'monthly'
            ? atrMonthlyState[`${mp.id}::${selectedYear}-${selectedMonthIdx}`]
            : atrWeeklyState[`${mp.id}::${selectedWeekKey}`];
        const hasAtr = rec && rec.atr !== null && rec.atr !== undefined && !isNaN(Number(rec.atr));
        const atrVal = hasAtr ? Number(rec.atr) : null;
        let monthPunishInfo = null;
        if (atrMode === 'monthly' && typeof evaluateEmployeeAtrPunishmentTimeline === 'function') {
            monthPunishInfo = evaluateEmployeeAtrPunishmentTimeline(mp.id, selectedYear).months[selectedMonthIdx] || null;
        }
        let rek = hasAtr ? (atrVal >= 98.5 ? 'Layak Skill Up' : 'Pembinaan ATR') : '-';
        if (monthPunishInfo) {
            if (monthPunishInfo.status === 'PENDING') rek = `Belum ${monthPunishInfo.requiredCode}`;
            else if (monthPunishInfo.status === 'GIVEN' && monthPunishInfo.givenAtrRecord) rek = `${monthPunishInfo.givenAtrRecord.tingkat} Diberikan`;
            else if (monthPunishInfo.status === 'PEMUTIHAN') rek = `Pemutihan ${monthPunishInfo.expiredCode}`;
        }
        const periodeText = (rec && rec.periode) ? rec.periode : periodLabelDefault;
        return {
            mp,
            nrp: mp.nrp || '',
            nama: mp.nama || '',
            status: isPersonOutOfRoster(mp) ? 'Out' : 'Aktif',
            jabatan: mp.jabatan || '-',
            perusahaan: mp.perusahaan || '-',
            atr: atrVal,
            nc: rec?.nc || 0,
            s: rec?.s || 0,
            i: rec?.i || 0,
            a: rec?.a || 0,
            periode: periodeText,
            rekomendasi: rek,
            bapak_asuh: String(mp.bapak_asuh || '').trim() || '-'
        };
    }).filter(r => {
        if (atrRoleFilter !== 'all' && r.jabatan !== atrRoleFilter) return false;
        if (atrQuery) {
            const hay = `${r.nrp} ${r.nama} ${r.jabatan} ${r.perusahaan} ${r.periode} ${r.rekomendasi} ${r.bapak_asuh}`.toLowerCase();
            if (!hay.includes(atrQuery)) return false;
        }
        return true;
    });

    if (atrSortState.column && atrSortState.direction !== 'none') {
        const col = atrSortState.column;
        const dir = atrSortState.direction === 'asc' ? 1 : -1;
        atrRows.sort((a, b) => {
            if (col === 'atr') return ((a.atr ?? -1) - (b.atr ?? -1)) * dir;
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (!atrRows.length) {
        showToast('Tidak ada data Monitoring ATR untuk diunduh.', 'info');
        return;
    }

    const headers = [
        'No', 'NRP', 'Nama', 'Status', 'Jabatan', 'Perusahaan',
        'ATR (%)', 'NC', 'S', 'I', 'A', 'Periode', 'Rekomendasi Grade', 'Bapak Asuh'
    ];
    const aoa = [
        headers,
        ...atrRows.map((r, idx) => [
            idx + 1,
            r.nrp,
            r.nama,
            r.status,
            r.jabatan,
            r.perusahaan,
            r.atr !== null ? Number(r.atr.toFixed(1)) : '-',
            r.nc,
            r.s,
            r.i,
            r.a,
            r.periode,
            r.rekomendasi,
            r.bapak_asuh
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 5 }, { wch: 13 }, { wch: 24 }, { wch: 8 }, { wch: 22 }, { wch: 12 },
        { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 24 }, { wch: 20 }, { wch: 20 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monitoring ATR');
    const periodSlug = (atrMode === 'monthly' ? `${MONTH_NAMES_ID[selectedMonthIdx]}_${selectedYear}` : selectedWeekKey)
        .replace(/[^a-zA-Z0-9_-]+/g, '_');
    XLSX.writeFile(wb, `Data_ATR_Monitoring_${periodSlug}.xlsx`);
    showToast(`Berhasil mengunduh Monitoring ATR (${atrRows.length} personil • ${periodLabelDefault}).`, 'success');
}

function downloadAtrWeeklyExcel() {
    seedInitialPerformaHistory();
    const query = (document.getElementById('atr-weekly-search')?.value || '').trim().toLowerCase();
    const monthFilter = document.getElementById('atr-weekly-month')?.value ?? '10';
    const year = parseInt(document.getElementById('atr-weekly-year')?.value || '2026', 10);

    const allWeeks = getWeeksInYearSunSat(year);
    const weeks = monthFilter === 'all'
        ? allWeeks
        : allWeeks.filter(w => w.months.includes(parseInt(monthFilter, 10)));

    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    });

    if (atrWeeklySortState.column && atrWeeklySortState.direction !== 'none') {
        const col = atrWeeklySortState.column;
        const dir = atrWeeklySortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'nama') return a.nama.localeCompare(b.nama, 'id') * dir;
            if (col === 'jabatan') return `${a.jabatan} ${a.perusahaan}`.localeCompare(`${b.jabatan} ${b.perusahaan}`, 'id') * dir;
            const vA = atrWeeklyState[`${a.id}::${col}`]?.atr ?? -1;
            const vB = atrWeeklyState[`${b.id}::${col}`]?.atr ?? -1;
            return (vA - vB) * dir;
        });
    }

    if (!rows.length) {
        showToast('Tidak ada data ATR Weekly untuk diunduh.', 'info');
        return;
    }

    const headers = [
        'No', 'NRP', 'Nama', 'Jabatan', 'Perusahaan', 'Domisili',
        ...weeks.map(w => `${w.label} (${w.shortRange})`)
    ];
    const aoa = [
        headers,
        ...rows.map((mp, idx) => [
            idx + 1,
            mp.nrp || '',
            mp.nama || '',
            mp.jabatan || '-',
            mp.perusahaan || '-',
            mp.domisili || '-',
            ...weeks.map(w => {
                const rec = atrWeeklyState[`${mp.id}::${w.key}`];
                return rec && rec.atr !== null && rec.atr !== undefined && !isNaN(Number(rec.atr))
                    ? Number(Number(rec.atr).toFixed(1))
                    : '-';
            })
        ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 5 }, { wch: 13 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
        ...weeks.map(() => ({ wch: 14 }))
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `ATR Weekly ${year}`);
    const scopeLabel = monthFilter === 'all' ? `Full_${year}` : `${MONTH_NAMES_ID[parseInt(monthFilter, 10)]}_${year}`;
    XLSX.writeFile(wb, `Data_ATR_Weekly_${scopeLabel}.xlsx`);
    showToast(`Berhasil mengunduh Data ATR Weekly (${rows.length} personil • ${weeks.length} week).`, 'success');
}

function downloadAtrMonthlyExcel() {
    seedInitialPerformaHistory();
    if (typeof seedInitialPunishmentHistory === 'function') seedInitialPunishmentHistory();

    const year = parseInt(document.getElementById('atr-monthly-year')?.value || '2026', 10);
    const query = (document.getElementById('atr-monthly-search')?.value || '').trim().toLowerCase();
    const punishFilter = document.getElementById('atr-monthly-punishment-filter')?.value || 'all';

    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    }).map(mp => {
        let sum = 0;
        let count = 0;
        const months = [];
        for (let m = 0; m < 12; m++) {
            const rec = atrMonthlyState[`${mp.id}::${year}-${m}`] || null;
            months.push(rec);
            if (rec && !isNaN(rec.atr)) {
                sum += Number(rec.atr);
                count++;
            }
        }
        const avg = count > 0 ? Number((sum / count).toFixed(1)) : null;
        const timeline = typeof evaluateEmployeeAtrPunishmentTimeline === 'function'
            ? evaluateEmployeeAtrPunishmentTimeline(mp.id, year)
            : { months: new Array(12).fill(null), pendingCount: 0, currentActiveLevel: 0, currentActiveCode: '' };
        return { mp, months, avg, timeline };
    }).filter(r => {
        if (punishFilter === 'pending') return r.timeline.pendingCount > 0;
        if (punishFilter === 'active') return r.timeline.currentActiveLevel > 0;
        if (punishFilter === 'safe') return r.timeline.currentActiveLevel === 0 && r.timeline.pendingCount === 0;
        return true;
    });

    if (atrMonthlySortState.column && atrMonthlySortState.direction !== 'none') {
        const col = atrMonthlySortState.column;
        const dir = atrMonthlySortState.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (col === 'nama') return a.mp.nama.localeCompare(b.mp.nama, 'id') * dir;
            if (col === 'jabatan') return `${a.mp.jabatan} ${a.mp.perusahaan}`.localeCompare(`${b.mp.jabatan} ${b.mp.perusahaan}`, 'id') * dir;
            if (col === 'avg') return ((a.avg ?? -1) - (b.avg ?? -1)) * dir;
            if (col === 'pembinaan') {
                const scoreA = a.timeline.currentActiveLevel * 100 + a.timeline.pendingCount;
                const scoreB = b.timeline.currentActiveLevel * 100 + b.timeline.pendingCount;
                return (scoreA - scoreB) * dir;
            }
            if (/^m\d+$/.test(col)) {
                const mIdx = parseInt(col.slice(1), 10);
                return ((a.months[mIdx]?.atr ?? -1) - (b.months[mIdx]?.atr ?? -1)) * dir;
            }
            return 0;
        });
    }

    if (!rows.length) {
        showToast('Tidak ada data ATR Monthly untuk diunduh.', 'info');
        return;
    }

    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const headers = [
        'No', 'NRP', 'Nama', 'Jabatan', 'Perusahaan', 'Domisili',
        ...monthShort.map(m => `${m} (%)`),
        'Rata-rata 1 Thn (%)', 'Status Pembinaan', 'Belum Punishment'
    ];
    const aoa = [
        headers,
        ...rows.map((r, idx) => {
            const tl = r.timeline;
            const statusPembinaan = tl.currentActiveCode
                ? tl.currentActiveCode
                : (tl.pendingCount > 0 ? 'Perlu Pembinaan' : 'Aman');
            return [
                idx + 1,
                r.mp.nrp || '',
                r.mp.nama || '',
                r.mp.jabatan || '-',
                r.mp.perusahaan || '-',
                r.mp.domisili || '-',
                ...r.months.map(rec => (rec && !isNaN(rec.atr) ? Number(Number(rec.atr).toFixed(1)) : '-')),
                r.avg !== null ? r.avg : '-',
                statusPembinaan,
                tl.pendingCount || 0
            ];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 5 }, { wch: 13 }, { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
        ...monthShort.map(() => ({ wch: 9 })),
        { wch: 17 }, { wch: 16 }, { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `ATR Monthly ${year}`);
    XLSX.writeFile(wb, `Data_ATR_Monthly_${year}.xlsx`);
    showToast(`Berhasil mengunduh Data ATR Monthly ${year} (${rows.length} personil).`, 'success');
}

function downloadAtrPunishmentExcel() {
    if (typeof seedInitialPunishmentHistory === 'function') seedInitialPunishmentHistory();
    const query = (document.getElementById('punishment-history-search')?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById('punishment-filter-category')?.value || 'all';
    const lvlFilter = document.getElementById('punishment-filter-level')?.value || 'all';
    const yearFilter = document.getElementById('punishment-filter-year')?.value || 'all';

    const list = (typeof punishmentHistoryState !== 'undefined' ? punishmentHistoryState : [])
        .filter(item => {
            const normCat = typeof normalizePunishmentCategory === 'function' ? normalizePunishmentCategory(item.kategori) : String(item.kategori || '').toUpperCase();
            const normLvl = typeof normalizePunishmentLevel === 'function' ? normalizePunishmentLevel(item.tingkat) : String(item.tingkat || '').toUpperCase();
            if (catFilter !== 'all' && normCat !== catFilter) return false;
            if (lvlFilter !== 'all' && normLvl !== lvlFilter) return false;
            if (yearFilter !== 'all' && String(item.year) !== String(yearFilter)) return false;
            if (query) {
                const mp = manpowerState.find(m => Number(m.id) === Number(item.mpId));
                const hay = `${item.nrp} ${item.nama} ${mp?.jabatan || ''} ${item.tingkat} ${item.kategori} ${item.noSurat || ''} ${item.keterangan || ''}`.toLowerCase();
                if (!hay.includes(query)) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const ymDiff = (Number(b.year) * 12 + Number(b.monthIdx)) - (Number(a.year) * 12 + Number(a.monthIdx));
            if (ymDiff !== 0) return ymDiff;
            return String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
        });

    if (!list.length) {
        showToast('Tidak ada data Riwayat Punishment untuk diunduh.', 'info');
        return;
    }

    const headers = [
        'No', 'NRP', 'Nama', 'Jabatan', 'Periode', 'Tanggal',
        'Kategori', 'Tingkat', 'No Surat', 'Keterangan', 'Eviden Foto'
    ];
    const aoa = [
        headers,
        ...list.map((item, idx) => {
            const mp = manpowerState.find(m => Number(m.id) === Number(item.mpId));
            const periodeLabel = typeof formatPunishmentPeriodLabel === 'function'
                ? formatPunishmentPeriodLabel(item.year, item.monthIdx)
                : `${MONTH_NAMES_ID[item.monthIdx] || ''} ${item.year || ''}`.trim();
            const normCat = typeof normalizePunishmentCategory === 'function' ? normalizePunishmentCategory(item.kategori) : item.kategori;
            return [
                idx + 1,
                item.nrp || mp?.nrp || '-',
                item.nama || mp?.nama || '-',
                mp?.jabatan || '-',
                periodeLabel,
                item.tanggal || '-',
                normCat === 'NON_ATR' ? 'Non-ATR' : 'ATR',
                item.tingkat || '-',
                item.noSurat || '-',
                item.keterangan || '-',
                item.evidenPhoto ? (item.evidenPhotoName || 'Ada Eviden') : 'Belum Ada'
            ];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 5 }, { wch: 13 }, { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 13 },
        { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 36 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Punishment');
    XLSX.writeFile(wb, `Data_Punishment_ATR_${getTodayISO()}.xlsx`);
    showToast(`Berhasil mengunduh Riwayat Punishment (${list.length} data).`, 'success');
}

function handleAtrRawFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const fileNameEl = document.getElementById('atr-raw-filename');
    if (fileNameEl) fileNameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

            const matched = [];
            let ignoredCount = 0;

            jsonRows.forEach(row => {
                const rawNrp = String(findRowValueByAliases(row, ['NRP', 'NIK']) || '').trim();
                const rawName = String(findRowValueByAliases(row, ['Nama', 'Name', 'Nama Lengkap']) || '').trim();
                const rawAtr = findRowValueByAliases(row, ['ATR (%)', 'ATR', 'Persentase ATR', 'Persentase']);
                const numAtr = parseFloat(String(rawAtr).replace('%', '').replace(',', '.'));
                const nc = parseInt(findRowValueByAliases(row, ['NC', 'No Cekin']) || '0', 10) || 0;
                const s = parseInt(findRowValueByAliases(row, ['S', 'Sakit']) || '0', 10) || 0;
                const i = parseInt(findRowValueByAliases(row, ['I', 'Izin']) || '0', 10) || 0;
                const a = parseInt(findRowValueByAliases(row, ['A', 'Alpha']) || '0', 10) || 0;

                const mp = manpowerState.find(m =>
                    (rawNrp && String(m.nrp).trim().toLowerCase() === rawNrp.toLowerCase()) ||
                    (rawName && String(m.nama).trim().toLowerCase() === rawName.toLowerCase())
                );

                if (mp && !isNaN(numAtr)) {
                    matched.push({
                        mpId: mp.id,
                        nrp: mp.nrp,
                        nama: mp.nama,
                        jabatan: mp.jabatan,
                        atr: Number(numAtr.toFixed(1)),
                        nc, s, i, a
                    });
                } else {
                    ignoredCount++;
                }
            });

            pendingAtrUpload = matched;

            const statsWrap = document.getElementById('atr-upload-stats');
            if (statsWrap) { statsWrap.classList.remove('hidden'); statsWrap.classList.add('grid'); }
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
            setTxt('atr-stat-total', jsonRows.length);
            setTxt('atr-stat-matched', pendingAtrUpload.length);
            setTxt('atr-stat-ignored', ignoredCount);

            renderAtrUploadPreview();
            if (pendingAtrUpload.length > 0) {
                showToast(`${pendingAtrUpload.length} data karyawan terdaftar disaring dari ${jsonRows.length} baris mentah.`, 'info');
            } else {
                showToast('Tidak ada NRP/Nama pada file yang cocok dengan Data Manpower.', 'error');
            }
        } catch (err) {
            console.error('Gagal membaca file mentah ATR:', err);
            showToast('Format file ATR tidak dapat dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderAtrUploadPreview() {
    const tbody = document.getElementById('atr-upload-preview-tbody');
    const applyBtn = document.getElementById('btn-apply-atr-upload');
    delete genericTableSortState['table-atr-upload-preview'];
    if (applyBtn) applyBtn.disabled = pendingAtrUpload.length === 0;
    if (!tbody) return;

    if (!pendingAtrUpload.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="py-10 text-center text-xs text-gray-400">Belum ada file mentah ATR yang diunggah. Pilih jenis upload &amp; file Excel/CSV untuk menyaring data karyawan terdaftar.</td></tr>';
        return;
    }

    const mode = document.getElementById('atr-upload-mode')?.value || 'weekly';
    const monthIdx = parseInt(document.getElementById('atr-upload-month')?.value ?? '10', 10);
    const year = document.getElementById('atr-upload-year')?.value || '2026';
    const weekSel = document.getElementById('atr-upload-week');
    const targetText = mode === 'weekly'
        ? (weekSel?.selectedOptions?.[0]?.textContent || weekSel?.value || 'Weekly')
        : `Monthly ${MONTH_NAMES_ID[monthIdx] || ''} ${year}`;

    tbody.innerHTML = pendingAtrUpload.map(item => `
                <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                    <td class="py-3 px-3 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(item.nrp)}</td>
                    <td class="py-3 px-3 text-gray-800 whitespace-nowrap">${escapeHtml(item.nama)}</td>
                    <td class="py-3 px-3 text-gray-600 whitespace-nowrap">${escapeHtml(item.jabatan)}</td>
                    <td class="py-3 px-3 font-mono font-semibold ${getAtrColorClass(item.atr)} whitespace-nowrap">${item.atr.toFixed(1)}%</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700">${item.nc}</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700">${item.s}</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700">${item.i}</td>
                    <td class="py-3 px-2 text-center font-mono text-gray-700">${item.a}</td>
                    <td class="py-3 px-3 text-teal-700 font-medium whitespace-nowrap">${escapeHtml(targetText)}</td>
                </tr>
            `).join('');
}

function resetAtrUploadState() {
    pendingAtrUpload = [];
    const fileInput = document.getElementById('atr-raw-file');
    const fileNameEl = document.getElementById('atr-raw-filename');
    const statsWrap = document.getElementById('atr-upload-stats');
    const atrMode = document.getElementById('atr-upload-mode')?.value || 'weekly';
    if (fileInput) fileInput.value = '';
    if (fileNameEl) fileNameEl.textContent = `Pilih File ${atrMode === 'monthly' ? 'ATR Monthly' : 'ATR Weekly'} (.xlsx, .xls, .csv)`;
    if (statsWrap) { statsWrap.classList.add('hidden'); statsWrap.classList.remove('grid'); }
    renderAtrUploadPreview();
}

function applyPendingAtrUpload() {
    if (!pendingAtrUpload.length) return;
    seedInitialPerformaHistory();
    const mode = document.getElementById('atr-upload-mode')?.value || 'weekly';
    const saveMode = document.getElementById('atr-upload-save-mode')?.value || 'overwrite';
    const monthIdx = parseInt(document.getElementById('atr-upload-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('atr-upload-year')?.value || '2026', 10);
    const weekKey = document.getElementById('atr-upload-week')?.value || '';
    const weekMeta = getWeeksInYearSunSat(year).find(w => w.key === weekKey);

    let added = 0;
    let updated = 0;
    let skipped = 0;

    pendingAtrUpload.forEach(item => {
        if (mode === 'weekly' && weekKey) {
            const key = `${item.mpId}::${weekKey}`;
            const hasExisting = Boolean(atrWeeklyState[key]);
            if (saveMode === 'append' && hasExisting) { skipped++; return; }
            if (hasExisting) updated++; else added++;
            atrWeeklyState[key] = {
                atr: item.atr,
                nc: item.nc,
                s: item.s,
                i: item.i,
                a: item.a,
                periode: weekMeta?.fullLabel || weekKey
            };
        } else {
            const key = `${item.mpId}::${year}-${monthIdx}`;
            const hasExisting = Boolean(atrMonthlyState[key]);
            if (saveMode === 'append' && hasExisting) { skipped++; return; }
            if (hasExisting) updated++; else added++;
            atrMonthlyState[key] = {
                atr: item.atr,
                nc: item.nc,
                s: item.s,
                i: item.i,
                a: item.a
            };
        }

        const mp = manpowerState.find(m => Number(m.id) === Number(item.mpId));
        if (mp) mp.atr = item.atr;
    });

    resetAtrUploadState();
    closeAtrUploadModal();
    renderPerformaManpower();
    switchAtrSubView(mode === 'weekly' ? 'weekly' : 'monthly');
    showToast(formatUploadResultToast(mode === 'weekly' ? 'ATR Weekly' : 'ATR Monthly', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
}

function toggleAbsensiMonthlySort(column) {
    if (absensiMonthlySortState.column !== column) absensiMonthlySortState = { column, direction: 'desc' };
    else if (absensiMonthlySortState.direction === 'desc') absensiMonthlySortState.direction = 'asc';
    else absensiMonthlySortState = { column: null, direction: 'none' };
    renderAbsensiMonthlyTable();
}

function renderAbsensiMonthlyTable() {
    seedInitialPerformaHistory();
    const thead = document.getElementById('absensi-monthly-thead');
    const tbody = document.getElementById('absensi-monthly-tbody');
    if (!thead || !tbody) return;

    const query = (document.getElementById('absensi-monthly-search')?.value || '').trim().toLowerCase();
    const monthIdx = parseInt(document.getElementById('absensi-monthly-month')?.value ?? '10', 10);
    const year = parseInt(document.getElementById('absensi-monthly-year')?.value || '2026', 10);
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getIconCls = (col) => {
        if (absensiMonthlySortState.column === col && absensiMonthlySortState.direction === 'desc') return 'fa-sort-down text-teal-600';
        if (absensiMonthlySortState.column === col && absensiMonthlySortState.direction === 'asc') return 'fa-sort-up text-teal-600';
        return 'fa-sort text-gray-300';
    };

    thead.innerHTML = `
                <tr class="bg-gray-50 text-[10px] font-normal text-gray-600">
                    <th onclick="toggleAbsensiMonthlySort('nama')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap sticky left-0 bg-gray-50 z-20 w-[136px] min-w-[136px] max-w-[136px] border-b border-r border-gray-200/70">
                        <div class="flex items-center justify-between gap-2"><span>Nama / NRP</span><i class="fa-solid ${getIconCls('nama')} text-[9px]"></i></div>
                    </th>
                    <th onclick="toggleAbsensiMonthlySort('jabatan')" class="py-3 px-3 font-normal cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap sm:sticky sm:left-[136px] bg-gray-50 z-20 w-[148px] min-w-[148px] max-w-[148px] border-b border-r border-gray-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                        <div class="flex items-center justify-between gap-2"><span>Jabatan / Perusahaan</span><i class="fa-solid ${getIconCls('jabatan')} text-[9px]"></i></div>
                    </th>
                    ${days.map(d => `<th class="py-2.5 px-2 text-center font-normal whitespace-nowrap bg-gray-50 border-b border-gray-100 min-w-[54px]">${d}</th>`).join('')}
                </tr>
            `;

    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili}`.toLowerCase().includes(query);
    });

    if (absensiMonthlySortState.column && absensiMonthlySortState.direction !== 'none') {
        const col = absensiMonthlySortState.column;
        const dir = absensiMonthlySortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (col === 'nama') return a.nama.localeCompare(b.nama, 'id') * dir;
            if (col === 'jabatan') return `${a.jabatan} ${a.perusahaan}`.localeCompare(`${b.jabatan} ${b.perusahaan}`, 'id') * dir;
            return 0;
        });
    }

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="${days.length + 2}" class="py-10 text-center text-xs text-gray-400">Tidak ada data absensi bulanan yang cocok.</td></tr>`;
        return;
    }

    const ymPrefix = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    tbody.innerHTML = rows.map((mp, idx) => {
        const rowBg = idx % 2 === 1 ? 'bg-gray-50' : 'bg-white';
        const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';

        return `
                    <tr class="group ${rowBg} hover:bg-teal-50 transition-colors">
                        <td class="py-2.5 px-3 whitespace-nowrap sticky left-0 z-10 ${rowBg} group-hover:bg-teal-50 w-[136px] min-w-[136px] max-w-[136px] border-b border-r border-gray-100 transition-colors">
                            <p class="text-gray-800 truncate">${escapeHtml(mp.nama)}${outBadge}</p>
                            <p class="font-mono text-[9px] text-teal-600 mt-0.5 truncate">${escapeHtml(mp.nrp)}</p>
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap sm:sticky sm:left-[136px] z-10 ${rowBg} group-hover:bg-teal-50 w-[148px] min-w-[148px] max-w-[148px] border-b border-r border-gray-200/80 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.06)] transition-colors">
                            <p class="text-gray-700 truncate">${escapeHtml(mp.jabatan || '-')}</p>
                            <p class="text-[9px] text-gray-400 mt-0.5 truncate">${escapeHtml(mp.perusahaan || '-')}</p>
                        </td>
                        ${days.map(d => {
            const dateIso = `${ymPrefix}-${String(d).padStart(2, '0')}`;
            const rec = absensiRecordsState[`${mp.id}::${dateIso}`];
            if (!rec) {
                return `<td class="py-2 px-1.5 text-center border-b border-gray-100"><button type="button" onclick="openEditAbsensiModal(${Number(mp.id)}, '${dateIso}')" class="text-gray-300 hover:text-teal-600 font-mono text-[9px] cursor-pointer">-</button></td>`;
            }
            const isOk = rec.status === 'Sesuai';
            const isRed = ['Telat Absensi', 'NC', 'Sakit', 'Izin', 'Alpha'].includes(rec.status);
            const cls = isOk ? 'text-emerald-600 font-semibold' : (isRed ? 'text-red-600 font-semibold' : 'text-gray-400');
            const label = rec.cekin ? rec.cekin.slice(0, 5) : (rec.status === 'OFF' || rec.status === '-' ? '-' : rec.status);
            return `<td class="py-2 px-1.5 text-center border-b border-gray-100 whitespace-nowrap"><button type="button" onclick="openEditAbsensiModal(${Number(mp.id)}, '${dateIso}')" title="${escapeHtml(rec.status)}" class="font-mono text-[9px] ${cls} hover:underline cursor-pointer">${escapeHtml(label)}</button></td>`;
        }).join('')}
                    </tr>
                `;
    }).join('');
}

function parseExcelTimeToHHMMSS(rawVal) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '';

    if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        const hh = String(rawVal.getHours()).padStart(2, '0');
        const mm = String(rawVal.getMinutes()).padStart(2, '0');
        const ss = String(rawVal.getSeconds()).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    if (typeof rawVal === 'number' && !isNaN(rawVal)) {
        if (rawVal <= 0) return '';
        const frac = rawVal >= 1 ? (rawVal % 1) : rawVal;
        if (rawVal >= 1 && frac < 1e-6) return '';
        let totalSec = Math.round(frac * 86400);
        if (totalSec >= 86400) totalSec = totalSec % 86400;
        const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
    }

    const str = String(rawVal).trim();
    if (!str || /^[-–—]+$/.test(str) || /^(null|undefined|n\/a|na|none|0)$/i.test(str)) return '';

    // Tangkap format jam (dengan/tanpa tanggal di depan & opsional AM/PM): 05:45:12, 5:45, 05.45.12, 2026-11-28 05:45:12
    const timeMatch = str.match(/(?:^|[\sT])(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?(?:\s|$)/i);
    if (timeMatch) {
        let hh = parseInt(timeMatch[1], 10);
        const mm = parseInt(timeMatch[2], 10);
        const ss = timeMatch[3] !== undefined ? parseInt(timeMatch[3], 10) : 0;
        const mer = (timeMatch[4] || '').toUpperCase();
        if (mer === 'PM' && hh < 12) hh += 12;
        if (mer === 'AM' && hh === 12) hh = 0;
        if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59 && ss >= 0 && ss <= 59) {
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
        }
    }

    // Fallback bila angka disimpan sebagai string desimal Excel (mis. "0.2451388")
    if (/^0?\.\d+$/.test(str)) {
        return parseExcelTimeToHHMMSS(parseFloat(str));
    }

    return '';
}

function normalizeAbsensiExcelDate(rawVal) {
    if (rawVal === null || rawVal === undefined || rawVal === '') return '';
    if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        return `${rawVal.getFullYear()}-${String(rawVal.getMonth() + 1).padStart(2, '0')}-${String(rawVal.getDate()).padStart(2, '0')}`;
    }
    if (typeof rawVal === 'number' && !isNaN(rawVal) && rawVal > 20000) {
        const utcDays = Math.floor(rawVal - 25569);
        const d = new Date(utcDays * 86400 * 1000);
        if (!isNaN(d.getTime())) {
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        }
    }

    const str = String(rawVal).trim();
    if (!str || /^[-–—]+$/.test(str)) return '';

    // 1. YYYY-MM-DD atau YYYY/MM/DD (opsional diikuti jam)
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[\sT].*)?$/);
    if (ymd) {
        return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    }

    // 2. DD/MM/YYYY, DD-MM-YYYY, atau MM/DD/YYYY (auto-deteksi jika angka tengah > 12)
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[\sT].*)?$/);
    if (dmy) {
        let p1 = parseInt(dmy[1], 10);
        let p2 = parseInt(dmy[2], 10);
        let yr = parseInt(dmy[3], 10);
        if (yr < 100) yr += 2000;
        let dd = p1;
        let mm = p2;
        if (p2 > 12 && p1 <= 12) {
            mm = p1;
            dd = p2;
        }
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
            return `${yr}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        }
    }

    // 3. DD MMM YYYY (ID / EN, mis. "28 Nov 2026" atau "28-Nov-26")
    const monMap = {
        jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
        jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12
    };
    const dMonY = str.match(/^(\d{1,2})[\s\-\/]([A-Za-z]{3,9})[\s\-\/](\d{2,4})/);
    if (dMonY) {
        const dd = parseInt(dMonY[1], 10);
        const mm = monMap[dMonY[2].slice(0, 3).toLowerCase()];
        let yr = parseInt(dMonY[3], 10);
        if (yr < 100) yr += 2000;
        if (mm && dd >= 1 && dd <= 31) {
            return `${yr}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
        }
    }

    if (typeof normalizeExcelDate === 'function') {
        return normalizeExcelDate(rawVal);
    }
    return '';
}

function evaluateAbsensiRule(codeStr, cekinStr) {
    const code = String(codeStr || '').trim().toUpperCase();
    const cleanCekin = parseExcelTimeToHHMMSS(cekinStr);

    // Aturan acuan shift dari kolom Code:
    // - Awalan D -> Shift 1 (S1, batas cekin <= 06:15)
    // - Awalan N -> Shift 2 (S2, batas cekin <= 18:15)
    // - Selain itu -> dikasih strip (-)
    let shift = '-';
    if (code.startsWith('D')) {
        shift = 'S1';
    } else if (code.startsWith('N')) {
        shift = 'S2';
    } else {
        return { shift: '-', cekin: '', status: '-' };
    }

    if (!cleanCekin) {
        return { shift, cekin: '', status: 'NC' };
    }
    const parts = cleanCekin.split(':').map(x => parseInt(x, 10));
    const totalMinutes = (parts[0] || 0) * 60 + (parts[1] || 0);
    const limitMinutes = shift === 'S1' ? (6 * 60 + 15) : (18 * 60 + 15);
    return {
        shift,
        cekin: cleanCekin,
        status: totalMinutes > limitMinutes ? 'Telat Absensi' : 'Sesuai'
    };
}

function downloadSampleRawAbsensiExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const headers = [[
        'NRP', 'Name', 'Position', 'Date', 'In', 'Out', 'Job',
        'Dept', 'Company', 'Code', 'Device', 'Owner', 'Device Count', 'Device ID'
    ]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    ws['!cols'] = [
        { wch: 12 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 },
        { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 13 }, { wch: 14 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Absensi');
    XLSX.writeFile(wb, 'Template_Upload_Absensi_PANTAU_SE.xlsx');
    showToast('Template kosong Absensi (14 kolom standar) berhasil diunduh.', 'success');
}

function handleAbsensiRawFileUpload(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const fileNameEl = document.getElementById('absensi-raw-filename');
    if (fileNameEl) fileNameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: false });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: true });

            if (!Array.isArray(matrix) || matrix.length < 2) {
                pendingAbsensiUpload = [];
                renderAbsensiUploadPreview();
                showToast('File Absensi kosong atau tidak memiliki baris data.', 'error');
                return;
            }

            const normHeader = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
            const findColIdx = (hdrs, aliases) => {
                for (const alias of aliases) {
                    const idx = hdrs.findIndex(h => h === alias);
                    if (idx !== -1) return idx;
                }
                return -1;
            };

            // Cari baris header (cek 10 baris pertama) yang memuat NRP dan minimal Date / In / Code
            let headerRowIdx = 0;
            let nrpIdx = -1;
            let dateIdx = -1;
            let inIdx = -1;
            let codeIdx = -1;

            const maxScan = Math.min(matrix.length, 10);
            for (let r = 0; r < maxScan; r++) {
                const hdrs = (matrix[r] || []).map(normHeader);
                const cNrp = findColIdx(hdrs, ['nrp', 'nik', 'no nrp', 'id karyawan']);
                const cDate = findColIdx(hdrs, ['date', 'tanggal', 'tgl', 'work date', 'att date']);
                const cIn = findColIdx(hdrs, ['in', 'cekin', 'check in', 'checkin', 'jam masuk', 'time in', 'clock in']);
                const cCode = findColIdx(hdrs, ['code', 'kode', 'shift', 'shift code', 'roster code']);
                if (cNrp !== -1 && (cDate !== -1 || cIn !== -1 || cCode !== -1)) {
                    headerRowIdx = r;
                    nrpIdx = cNrp;
                    dateIdx = cDate;
                    inIdx = cIn;
                    codeIdx = cCode;
                    break;
                }
            }

            if (nrpIdx === -1) {
                pendingAbsensiUpload = [];
                renderAbsensiUploadPreview();
                showToast('Kolom "NRP" tidak ditemukan. Pastikan header sesuai format (NRP, Date, In, Code).', 'error');
                return;
            }

            // Indeks cepat manpower berdasarkan NRP
            const normalizeNrp = (val) => String(val ?? '').trim().replace(/\.0+$/, '').toLowerCase();
            const stripLeadingZeros = (s) => (/^\d+$/.test(s) ? s.replace(/^0+/, '') : s);
            const mpByNrp = new Map();
            const mpByNumericNrp = new Map();
            (manpowerState || []).forEach(m => {
                const key = normalizeNrp(m.nrp);
                if (!key) return;
                mpByNrp.set(key, m);
                const stripped = stripLeadingZeros(key);
                if (stripped && !mpByNumericNrp.has(stripped)) mpByNumericNrp.set(stripped, m);
            });

            const todayIso = getTodayISO();
            const matchedByKey = new Map();
            let totalDataRows = 0;
            let ignoredCount = 0;

            for (let r = headerRowIdx + 1; r < matrix.length; r++) {
                const cols = matrix[r];
                if (!Array.isArray(cols) || cols.every(v => String(v ?? '').trim() === '')) continue;
                totalDataRows++;

                const rawNrp = normalizeNrp(cols[nrpIdx]);
                const rawDate = dateIdx !== -1 ? cols[dateIdx] : '';
                const rawIn = inIdx !== -1 ? cols[inIdx] : '';
                const rawCode = codeIdx !== -1 ? String(cols[codeIdx] ?? '').trim().toUpperCase() : '';

                const mp = rawNrp
                    ? (mpByNrp.get(rawNrp) || mpByNumericNrp.get(stripLeadingZeros(rawNrp)) || null)
                    : null;

                if (!mp) {
                    ignoredCount++;
                    continue;
                }

                const dateIso = normalizeAbsensiExcelDate(rawDate) || todayIso;
                const cekinRaw = parseExcelTimeToHHMMSS(rawIn);
                const ev = evaluateAbsensiRule(rawCode, cekinRaw);

                const itemKey = `${mp.id}::${dateIso}`;
                const nextItem = {
                    mpId: mp.id,
                    nrp: mp.nrp,
                    nama: mp.nama,
                    dateIso,
                    code: (ev.shift === 'S1' || ev.shift === 'S2') ? (rawCode || '-') : '-',
                    shift: ev.shift,
                    cekin: ev.cekin,
                    status: ev.status
                };

                // Jika 1 NRP + tanggal muncul >1 baris dalam file, prioritaskan shift valid (S1/S2) & cekin paling awal
                const prev = matchedByKey.get(itemKey);
                if (!prev) {
                    matchedByKey.set(itemKey, nextItem);
                } else {
                    const prevHasShift = prev.shift === 'S1' || prev.shift === 'S2';
                    const nextHasShift = nextItem.shift === 'S1' || nextItem.shift === 'S2';
                    if (!prevHasShift && nextHasShift) {
                        matchedByKey.set(itemKey, nextItem);
                    } else if (prevHasShift && nextHasShift) {
                        if (!prev.cekin && nextItem.cekin) {
                            matchedByKey.set(itemKey, nextItem);
                        } else if (prev.cekin && nextItem.cekin && nextItem.cekin < prev.cekin) {
                            matchedByKey.set(itemKey, nextItem);
                        }
                    }
                }
            }

            pendingAbsensiUpload = Array.from(matchedByKey.values());

            const statsWrap = document.getElementById('absensi-upload-stats');
            if (statsWrap) { statsWrap.classList.remove('hidden'); statsWrap.classList.add('grid'); }
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
            setTxt('absensi-stat-total', totalDataRows);
            setTxt('absensi-stat-matched', pendingAbsensiUpload.length);
            setTxt('absensi-stat-ignored', ignoredCount);

            renderAbsensiUploadPreview();

            if (pendingAbsensiUpload.length > 0) {
                showToast(`${pendingAbsensiUpload.length} data absensi cocok dari ${totalDataRows} baris file.`, 'info');
            } else {
                showToast('Tidak ada NRP pada file yang cocok dengan Data Manpower.', 'error');
            }
        } catch (err) {
            console.error('Gagal membaca file mentah Absensi:', err);
            showToast('Format file Absensi tidak dapat dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderAbsensiUploadPreview() {
    const tbody = document.getElementById('absensi-upload-preview-tbody');
    const applyBtn = document.getElementById('btn-apply-absensi-upload');
    delete genericTableSortState['table-absensi-upload-preview'];

    if (applyBtn) applyBtn.disabled = pendingAbsensiUpload.length === 0;
    if (!tbody) return;

    if (pendingAbsensiUpload.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-10 text-center text-xs text-gray-400">Belum ada file mentah Absensi yang diunggah. Pilih file Excel/CSV untuk menyaring data karyawan terdaftar.</td></tr>';
        return;
    }

    tbody.innerHTML = pendingAbsensiUpload.map(item => `
                <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                    <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(item.nrp)}</td>
                    <td class="py-3 px-4 text-gray-800 whitespace-nowrap">${escapeHtml(item.nama)}</td>
                    <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${formatDateID(item.dateIso)}</td>
                    <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${item.shift === 'S1' ? `${escapeHtml(item.code)} (Shift 1)` : (item.shift === 'S2' ? `${escapeHtml(item.code)} (Shift 2)` : '-')}</td>
                    <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${escapeHtml(item.cekin || '-')}</td>
                    <td class="py-3 px-4 whitespace-nowrap"><span class="px-2.5 py-0.5 rounded-full ${getAbsensiStatusBadgeClass(item.status)}">${escapeHtml(item.status)}</span></td>
                </tr>
            `).join('');
}

function resetAbsensiUploadState() {
    pendingAbsensiUpload = [];
    const fileInput = document.getElementById('absensi-raw-file');
    const fileNameEl = document.getElementById('absensi-raw-filename');
    const statsWrap = document.getElementById('absensi-upload-stats');
    if (fileInput) fileInput.value = '';
    if (fileNameEl) fileNameEl.textContent = 'Pilih File Absensi (.xlsx, .xls, .csv)';
    if (statsWrap) { statsWrap.classList.add('hidden'); statsWrap.classList.remove('grid'); }
    renderAbsensiUploadPreview();
}

async function applyPendingAbsensiUpload() {
    if (!pendingAbsensiUpload.length) return;
    const applyBtn = document.getElementById('btn-apply-absensi-upload');
    if (applyBtn) applyBtn.disabled = true;

    const saveMode = document.getElementById('absensi-upload-save-mode')?.value || 'overwrite';
    let latestDate = '';
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const rowsToSync = [];

    pendingAbsensiUpload.forEach(item => {
        const key = `${item.mpId}::${item.dateIso}`;
        const existing = absensiRecordsState[key];
        const hasExisting = Boolean(existing && existing.status && existing.status !== '-');

        if (saveMode === 'append' && hasExisting) {
            skipped++;
            return;
        }
        if (hasExisting) updated++;
        else added++;

        const rec = {
            mpId: item.mpId,
            nrp: item.nrp,
            date: item.dateIso,
            code: item.code,
            shift: item.shift,
            cekin: item.cekin,
            status: item.status,
            note: existing?.note || ''
        };
        absensiRecordsState[key] = rec;
        rowsToSync.push({ recordKey: key, ...rec });
        if (!latestDate || item.dateIso > latestDate) latestDate = item.dateIso;
    });

    if (latestDate) {
        const dateInput = document.getElementById('absensi-monitoring-date');
        if (dateInput) dateInput.value = latestDate;
    }

    if (rowsToSync.length > 0 && typeof pushAbsensiRecordsToSupabase === 'function') {
        await pushAbsensiRecordsToSupabase(rowsToSync).catch(() => {});
    }

    resetAbsensiUploadState();
    closeAbsensiUploadModal();
    renderPerformaManpower();
    switchAbsensiSubView('monitoring');
    showToast(formatUploadResultToast('Data Absensi', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
}

/* ----- MODAL VALIDASI / EDIT ABSENSI ----- */
function openEditAbsensiModal(mpId, dateIso) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;

    const rec = absensiRecordsState[`${mpId}::${dateIso}`] || { shift: 'S1', cekin: '', status: 'NC', note: '' };
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('edit-absensi-mp-id', String(mpId));
    setVal('edit-absensi-date', dateIso);
    setVal('edit-absensi-shift', rec.shift || '-');
    setVal('edit-absensi-cekin', rec.cekin || '');
    setVal('edit-absensi-status', rec.status || 'NC');
    setVal('edit-absensi-note', rec.note || '');

    const subEl = document.getElementById('edit-absensi-subtitle');
    if (subEl) subEl.textContent = `${mp.nama} (${mp.nrp}) • ${formatDateID(dateIso)}`;

    const modal = document.getElementById('modal-edit-absensi');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeEditAbsensiModal() {
    const modal = document.getElementById('modal-edit-absensi');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function handleEditAbsensiSubmit(event) {
    event.preventDefault();
    const mpId = document.getElementById('edit-absensi-mp-id')?.value;
    const dateIso = document.getElementById('edit-absensi-date')?.value;
    const shift = document.getElementById('edit-absensi-shift')?.value || '-';
    const cekin = (document.getElementById('edit-absensi-cekin')?.value || '').trim();
    const status = document.getElementById('edit-absensi-status')?.value || '-';
    const note = (document.getElementById('edit-absensi-note')?.value || '').trim();

    if (!mpId || !dateIso) return;
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    const key = `${mpId}::${dateIso}`;
    const rec = {
        mpId: Number(mpId),
        nrp: mp?.nrp || '',
        date: dateIso,
        code: shift === 'S1' ? 'DWS' : (shift === 'S2' ? 'NWS' : '-'),
        shift,
        cekin: (shift === 'S1' || shift === 'S2') ? (parseExcelTimeToHHMMSS(cekin) || cekin) : '',
        status,
        note
    };
    absensiRecordsState[key] = rec;

    if (typeof pushAbsensiRecordsToSupabase === 'function') {
        pushAbsensiRecordsToSupabase([{ recordKey: key, ...rec }]).catch(() => {});
    }

    closeEditAbsensiModal();
    renderPerformaManpower();
    showToast(`Status absensi tanggal ${formatDateID(dateIso)} berhasil diperbarui.`, 'success');
}

/* =====================================================================
 * 4B. INPUT KPI PENGAWAS & DASHBOARD KPI PENGAWAS (GL OTOMATIS & WEEK KALENDER)
 * ===================================================================== */
function getGroupLeaderManpowerList() {
    return manpowerState.filter(mp => {
        const role = String(mp.jabatan || '').trim().toLowerCase();
        return role === 'group leader' || role.includes('group leader');
    });
}

function getOrInitKpiRecord(mp, weekObj) {
    const key = `${mp.id}::${weekObj.key}`;
    if (!kpiPengawasStore[key]) {
        const currWeek = getCurrentCalendarWeekInfo();
        const isPastClosed = weekObj.weekNum < currWeek.weekNum;
        kpiPengawasStore[key] = {
            sap: null,
            closing_rate: null,
            sqi: null,
            atr_individu: null,
            atr_anak_asuh: null,
            status: isPastClosed ? 'Closed' : 'MTD Daily',
            updatedAt: '-'
        };
    }
    return kpiPengawasStore[key];
}

function populateKpiWeekFilters() {
    const weeks = getAvailableCalendarWeeks().slice().reverse(); // Minggu terbaru di atas
    const currWeek = getCurrentCalendarWeekInfo();
    ['input-kpi-week-filter', 'dash-kpi-week-filter', 'filter-kpi-se-week'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = weeks.map(w => `<option value="${w.key}">${w.label} (${w.shortRange})${w.key === currWeek.key ? ' • MTD' : ''}</option>`).join('');
        if (prev && weeks.some(w => w.key === prev)) sel.value = prev;
        else sel.value = currWeek.key;
    });
}

function toggleInputKpiSort(column) {
    if (inputKpiSortState.column !== column) inputKpiSortState = { column, direction: 'desc' };
    else if (inputKpiSortState.direction === 'desc') inputKpiSortState.direction = 'asc';
    else inputKpiSortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-input-kpi-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-input-kpi-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (inputKpiSortState.column === col && inputKpiSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (inputKpiSortState.column === col && inputKpiSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderInputKpiPengawasTable();
}

function toggleDashKpiSort(column) {
    if (dashKpiSortState.column !== column) dashKpiSortState = { column, direction: 'desc' };
    else if (dashKpiSortState.direction === 'desc') dashKpiSortState.direction = 'asc';
    else dashKpiSortState = { column: null, direction: 'none' };

    document.querySelectorAll('[data-dash-kpi-sort-icon]').forEach(icon => {
        const col = icon.getAttribute('data-dash-kpi-sort-icon');
        icon.className = 'fa-solid text-[9px] transition-colors';
        if (dashKpiSortState.column === col && dashKpiSortState.direction === 'desc') icon.classList.add('fa-sort-down', 'text-teal-600');
        else if (dashKpiSortState.column === col && dashKpiSortState.direction === 'asc') icon.classList.add('fa-sort-up', 'text-teal-600');
        else icon.classList.add('fa-sort', 'text-gray-300');
    });
    renderDashboardKpiPengawas();
}

function updateKpiField(mpId, weekKey, field, rawValue) {
    const weeks = getAvailableCalendarWeeks();
    const weekObj = weeks.find(w => w.key === weekKey) || getCurrentCalendarWeekInfo();
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;

    const rec = getOrInitKpiRecord(mp, weekObj);
    if (rec.status === 'Closed') return;

    const trimmed = String(rawValue ?? '').trim().replace(/,/g, '.');
    if (trimmed === '') {
        rec[field] = null;
    } else {
        let num = parseFloat(trimmed);
        if (isNaN(num)) {
            rec[field] = null;
        } else {
            if (field === 'sqi') num = Math.max(0, Math.min(5, num));
            else num = Math.max(0, Math.min(100, num));
            rec[field] = Number(num.toFixed(1));
        }
    }
    rec.updatedAt = formatDateID(getTodayISO());
    renderDashboardKpiPengawas();
}

function renderKpiCellDisplayHtml(mpId, weekKey, field, val, isClosed, cellUid) {
    const hasVal = val !== null && val !== undefined && !isNaN(Number(val));
    const label = hasVal ? Number(val).toFixed(1) : '-';
    if (isClosed) {
        return `<span class="font-mono ${hasVal ? 'text-gray-500' : 'text-gray-400'}">${label}</span>`;
    }
    const cls = hasVal
        ? 'font-mono text-gray-800 hover:text-teal-700 hover:underline'
        : 'font-mono text-gray-400 hover:text-teal-600';
    return `
                <button
                    type="button"
                    onclick="startEditKpiCell(${Number(mpId)}, '${escapeJsString(weekKey)}', '${escapeJsString(field)}', '${cellUid}')"
                    title="${hasVal ? 'Klik angka untuk edit' : 'Klik untuk isi angka secara manual'}"
                    class="inline-flex items-center min-w-[36px] py-0.5 rounded px-1.5 -mx-1.5 hover:bg-teal-50 transition-colors cursor-pointer ${cls}"
                >${label}</button>
            `;
}

function startEditKpiCell(mpId, weekKey, field, cellUid) {
    const cellEl = document.getElementById(`kpi-cell-${cellUid}`);
    if (!cellEl) return;

    const weeks = getAvailableCalendarWeeks();
    const weekObj = weeks.find(w => w.key === weekKey) || getCurrentCalendarWeekInfo();
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;
    const rec = getOrInitKpiRecord(mp, weekObj);
    if (rec.status === 'Closed') return;

    const curVal = rec[field];
    const prevAttr = (curVal !== null && curVal !== undefined && !isNaN(Number(curVal)))
        ? Number(curVal).toFixed(1)
        : '';
    const maxVal = field === 'sqi' ? '5' : '100';

    cellEl.innerHTML = `
                <input
                    id="kpi-input-${cellUid}"
                    type="number"
                    step="0.1"
                    min="0"
                    max="${maxVal}"
                    data-prev-val="${prevAttr}"
                    value="${prevAttr}"
                    placeholder="0.0"
                    oninput="updateKpiField(${Number(mpId)}, '${escapeJsString(weekKey)}', '${escapeJsString(field)}', this.value)"
                    onkeydown="handleKpiCellKeydown(event, ${Number(mpId)}, '${escapeJsString(weekKey)}', '${escapeJsString(field)}', '${cellUid}')"
                    onblur="commitKpiCellEdit(${Number(mpId)}, '${escapeJsString(weekKey)}', '${escapeJsString(field)}', '${cellUid}')"
                    class="w-20 px-2 py-0.5 rounded-lg border border-teal-400 bg-white font-mono text-[10px] text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
            `;
    const inputEl = document.getElementById(`kpi-input-${cellUid}`);
    if (inputEl) {
        inputEl.focus();
        inputEl.select();
    }
}

function restoreKpiCellDisplay(mpId, weekKey, field, cellUid) {
    const weeks = getAvailableCalendarWeeks();
    const weekObj = weeks.find(w => w.key === weekKey) || getCurrentCalendarWeekInfo();
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    const rec = mp ? getOrInitKpiRecord(mp, weekObj) : null;
    const cellEl = document.getElementById(`kpi-cell-${cellUid}`);
    if (cellEl && rec) {
        cellEl.innerHTML = renderKpiCellDisplayHtml(mpId, weekKey, field, rec[field], rec.status === 'Closed', cellUid);
    }
}

function handleKpiCellKeydown(event, mpId, weekKey, field, cellUid) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target?.blur();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        const inputEl = document.getElementById(`kpi-input-${cellUid}`);
        const prevVal = inputEl ? inputEl.getAttribute('data-prev-val') : '';
        if (inputEl) inputEl.dataset.cancelled = '1';
        updateKpiField(mpId, weekKey, field, prevVal);
        restoreKpiCellDisplay(mpId, weekKey, field, cellUid);
    }
}

function commitKpiCellEdit(mpId, weekKey, field, cellUid) {
    const inputEl = document.getElementById(`kpi-input-${cellUid}`);
    if (!inputEl || inputEl.dataset.cancelled === '1') return;
    updateKpiField(mpId, weekKey, field, inputEl.value);
    restoreKpiCellDisplay(mpId, weekKey, field, cellUid);
}

function toggleCloseKpiWeek(mpId, weekKey) {
    const weeks = getAvailableCalendarWeeks();
    const weekObj = weeks.find(w => w.key === weekKey) || getCurrentCalendarWeekInfo();
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;

    const rec = getOrInitKpiRecord(mp, weekObj);
    rec.status = rec.status === 'Closed' ? 'MTD Daily' : 'Closed';
    rec.updatedAt = formatDateID(getTodayISO());

    renderInputKpiPengawasTable();
    renderDashboardKpiPengawas();
    showToast(`${mp.nama} (${weekObj.label}) diubah ke status ${rec.status}.`, rec.status === 'Closed' ? 'success' : 'info');
}

function renderInputKpiPengawasTable() {
    const tbody = document.getElementById('input-kpi-pengawas-tbody');
    const weekSel = document.getElementById('input-kpi-week-filter');
    if (!tbody) return;
    if (weekSel && weekSel.options.length === 0) populateKpiWeekFilters();

    const selectedWeekKey = weekSel?.value || getCurrentCalendarWeekInfo().key;
    const weekObj = getAvailableCalendarWeeks().find(w => w.key === selectedWeekKey) || getCurrentCalendarWeekInfo();
    const query = (document.getElementById('input-kpi-search')?.value || '').trim().toLowerCase();

    let rows = getGroupLeaderManpowerList().map(mp => ({
        mp,
        rec: getOrInitKpiRecord(mp, weekObj)
    })).filter(({ mp }) => {
        if (!query) return true;
        return `${mp.nama} ${mp.nrp} ${mp.perusahaan}`.toLowerCase().includes(query);
    });

    if (inputKpiSortState.column && inputKpiSortState.direction !== 'none') {
        const col = inputKpiSortState.column;
        const dir = inputKpiSortState.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (col === 'nama') return a.mp.nama.localeCompare(b.mp.nama, 'id') * dir;
            if (col === 'week') return 0;
            if (col === 'status') return a.rec.status.localeCompare(b.rec.status, 'id') * dir;
            return ((a.rec[col] ?? -1) - (b.rec[col] ?? -1)) * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-xs text-gray-400">Belum ada personil berjabatan Group Leader di Data Manpower.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(({ mp, rec }) => {
        const isClosed = rec.status === 'Closed';
        const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
        const statusBadge = isClosed
            ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Closed</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">MTD Daily</span>';
        const toggleBtn = isClosed
            ? `<button type="button" onclick="toggleCloseKpiWeek(${Number(mp.id)}, '${weekObj.key}')" class="px-2 py-0.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 text-[9px] font-semibold">Buka</button>`
            : `<button type="button" onclick="toggleCloseKpiWeek(${Number(mp.id)}, '${weekObj.key}')" class="px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-500 text-teal-700 hover:text-white border border-teal-200 text-[9px] font-semibold transition-colors">Closing</button>`;

        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-3 whitespace-nowrap">
                            <p class="text-gray-800 font-medium">${escapeHtml(mp.nama)}${outBadge}</p>
                            <p class="text-[9px] text-gray-400 mt-0.5">${escapeHtml(mp.nrp)} • ${escapeHtml(mp.jabatan)} • ${escapeHtml(mp.perusahaan)}</p>
                        </td>
                        <td class="py-3 px-3 whitespace-nowrap">
                            <p class="text-gray-800 font-semibold">${weekObj.label}</p>
                            <p class="text-[8.5px] text-gray-400 mt-0.5">${weekObj.shortRange}</p>
                        </td>
                        <td id="kpi-cell-${Number(mp.id)}-sap" class="py-3 px-3 whitespace-nowrap">${renderKpiCellDisplayHtml(mp.id, weekObj.key, 'sap', rec.sap, isClosed, `${Number(mp.id)}-sap`)}</td>
                        <td id="kpi-cell-${Number(mp.id)}-closing_rate" class="py-3 px-3 whitespace-nowrap">${renderKpiCellDisplayHtml(mp.id, weekObj.key, 'closing_rate', rec.closing_rate, isClosed, `${Number(mp.id)}-closing_rate`)}</td>
                        <td id="kpi-cell-${Number(mp.id)}-sqi" class="py-3 px-3 whitespace-nowrap">${renderKpiCellDisplayHtml(mp.id, weekObj.key, 'sqi', rec.sqi, isClosed, `${Number(mp.id)}-sqi`)}</td>
                        <td id="kpi-cell-${Number(mp.id)}-atr_individu" class="py-3 px-3 whitespace-nowrap">${renderKpiCellDisplayHtml(mp.id, weekObj.key, 'atr_individu', rec.atr_individu, isClosed, `${Number(mp.id)}-atr_individu`)}</td>
                        <td id="kpi-cell-${Number(mp.id)}-atr_anak_asuh" class="py-3 px-3 whitespace-nowrap">${renderKpiCellDisplayHtml(mp.id, weekObj.key, 'atr_anak_asuh', rec.atr_anak_asuh, isClosed, `${Number(mp.id)}-atr_anak_asuh`)}</td>
                        <td class="py-3 px-3 whitespace-nowrap">
                            <div class="flex items-center gap-1.5">${statusBadge}${toggleBtn}</div>
                            <p class="text-[8px] text-gray-400 mt-1">Update: ${escapeHtml(rec.updatedAt)}</p>
                        </td>
                    </tr>
                `;
    }).join('');
}

function renderDashboardKpiPengawas() {
    const tbody = document.getElementById('dashboard-kpi-pengawas-tbody');
    const weekSel = document.getElementById('dash-kpi-week-filter');
    if (weekSel && weekSel.options.length === 0) populateKpiWeekFilters();

    const selectedWeekKey = weekSel?.value || getCurrentCalendarWeekInfo().key;
    const weekObj = getAvailableCalendarWeeks().find(w => w.key === selectedWeekKey) || getCurrentCalendarWeekInfo();

    const periodPill = document.getElementById('dash-kpi-period-pill');
    if (periodPill) periodPill.textContent = `${weekObj.fullLabel} • Sinkron GL Manpower`;

    let rows = getGroupLeaderManpowerList().map(mp => ({
        mp,
        rec: getOrInitKpiRecord(mp, weekObj)
    }));

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (rows.length > 0) {
        const avgFormatted = (fn, suffix) => {
            const vals = rows.map(fn).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
            if (vals.length === 0) return '-';
            const mean = vals.reduce((acc, v) => acc + Number(v), 0) / vals.length;
            return `${mean.toFixed(1)}${suffix}`;
        };
        setTxt('kpi-pengawas-avg-sap', avgFormatted(r => r.rec.sap, '%'));
        setTxt('kpi-pengawas-avg-closing', avgFormatted(r => r.rec.closing_rate, '%'));
        setTxt('kpi-pengawas-avg-sqi', avgFormatted(r => r.rec.sqi, '/5'));
        setTxt('kpi-pengawas-avg-atr-ind', avgFormatted(r => r.rec.atr_individu, '%'));
        setTxt('kpi-pengawas-avg-atr-anak', avgFormatted(r => r.rec.atr_anak_asuh, '%'));
    } else {
        setTxt('kpi-pengawas-avg-sap', '0%');
        setTxt('kpi-pengawas-avg-closing', '0%');
        setTxt('kpi-pengawas-avg-sqi', '0/5');
        setTxt('kpi-pengawas-avg-atr-ind', '0%');
        setTxt('kpi-pengawas-avg-atr-anak', '0%');
    }

    if (!tbody) return;

    if (dashKpiSortState.column && dashKpiSortState.direction !== 'none') {
        const col = dashKpiSortState.column;
        const dir = dashKpiSortState.direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            if (col === 'nrp') return a.mp.nrp.localeCompare(b.mp.nrp, 'id') * dir;
            if (col === 'nama') return a.mp.nama.localeCompare(b.mp.nama, 'id') * dir;
            if (col === 'jabatan') return a.mp.jabatan.localeCompare(b.mp.jabatan, 'id') * dir;
            if (col === 'week') return a.rec.status.localeCompare(b.rec.status, 'id') * dir;
            return ((a.rec[col] ?? -1) - (b.rec[col] ?? -1)) * dir;
        });
    }

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-10 text-center text-xs text-gray-400">Belum ada personil berjabatan Group Leader di Data Manpower.</td></tr>';
        return;
    }

    const fmtVal = (v, suffix) => (v !== null && v !== undefined && !isNaN(Number(v))) ? `${Number(v).toFixed(1)}${suffix}` : '-';

    tbody.innerHTML = rows.map(({ mp, rec }) => {
        const outBadge = isPersonOutOfRoster(mp) ? ' <span class="text-red-600 font-semibold">(out)</span>' : '';
        const stBadge = rec.status === 'Closed'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700';

        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(mp.nrp)}</td>
                        <td class="py-3 px-4 text-gray-800 whitespace-nowrap">${escapeHtml(mp.nama)}${outBadge}</td>
                        <td class="py-3 px-4 text-gray-600 whitespace-nowrap">${escapeHtml(mp.jabatan)} • ${escapeHtml(mp.perusahaan)}</td>
                        <td class="py-3 px-4 whitespace-nowrap">
                            <span class="text-gray-800 font-medium">${weekObj.label}</span>
                            <span class="ml-1.5 px-2 py-0.5 rounded-full text-[8.5px] ${stBadge}">${escapeHtml(rec.status)}</span>
                        </td>
                        <td class="py-3 px-4 font-mono whitespace-nowrap">
                            <p class="text-gray-800">SAP: ${fmtVal(rec.sap, '%')}</p>
                            <p class="text-gray-500 text-[9px] mt-0.5">Closing: ${fmtVal(rec.closing_rate, '%')}</p>
                        </td>
                        <td class="py-3 px-4 font-mono text-gray-800 whitespace-nowrap">${fmtVal(rec.sqi, ' / 5.0')}</td>
                        <td class="py-3 px-4 font-mono whitespace-nowrap">
                            <p class="text-emerald-600">Ind: ${fmtVal(rec.atr_individu, '%')}</p>
                            <p class="text-teal-600 text-[9px] mt-0.5">Anak Asuh: ${fmtVal(rec.atr_anak_asuh, '%')}</p>
                        </td>
                    </tr>
                `;
    }).join('');
}

/* =====================================================================
 * 6. MODAL MANPOWER (TAMBAH, DETAIL/EDIT, HAPUS, & IMPORT EXCEL)
 * ===================================================================== */
function switchManpowerModalMode(mode) {
    const formEl = document.getElementById('form-manpower');
    const excelEl = document.getElementById('manpower-excel-panel');
    const btnManual = document.getElementById('btn-mode-manual');
    const btnExcel = document.getElementById('btn-mode-excel');
    const activeCls = 'py-1.5 px-3 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all flex items-center justify-center gap-1.5';
    const inactiveCls = 'py-1.5 px-3 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all flex items-center justify-center gap-1.5';

    if (mode === 'excel') {
        if (formEl) { formEl.classList.add('hidden'); formEl.classList.remove('flex'); }
        if (excelEl) { excelEl.classList.remove('hidden'); excelEl.classList.add('flex'); }
        if (btnManual) btnManual.className = inactiveCls;
        if (btnExcel) btnExcel.className = activeCls;
    } else {
        if (formEl) { formEl.classList.remove('hidden'); formEl.classList.add('flex'); }
        if (excelEl) { excelEl.classList.add('hidden'); excelEl.classList.remove('flex'); }
        if (btnManual) btnManual.className = activeCls;
        if (btnExcel) btnExcel.className = inactiveCls;
    }
}

function openManpowerModal() {
    const form = document.getElementById('form-manpower');
    if (form) form.reset();

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('mp-edit-id', '');
    setVal('mp-password', '');
    const pwdInput = document.getElementById('mp-password');
    const pwdIcon = document.getElementById('mp-password-toggle-icon');
    if (pwdInput) pwdInput.type = 'password';
    if (pwdIcon) pwdIcon.className = 'fa-regular fa-eye text-xs';
    pendingExcelManpower = [];

    const fileEl = document.getElementById('mp-excel-file');
    const fnameEl = document.getElementById('mp-excel-filename');
    const sumEl = document.getElementById('mp-excel-summary');
    const impBtn = document.getElementById('btn-import-excel');
    if (fileEl) fileEl.value = '';
    if (fnameEl) fnameEl.textContent = 'Pilih file Excel (.xlsx / .xls)';
    if (sumEl) { sumEl.textContent = ''; sumEl.classList.add('hidden'); }
    if (impBtn) impBtn.disabled = true;

    const headerDefault = document.getElementById('mp-header-default');
    const headerProfile = document.getElementById('mp-header-profile');
    const detailTabSwitcher = document.getElementById('mp-detail-tab-switcher');
    const detailPanel = document.getElementById('manpower-detail-panel');
    const switcher = document.getElementById('mp-mode-switcher');
    const delBtn = document.getElementById('btn-delete-manpower');
    const titleEl = document.getElementById('modal-manpower-title');
    const subEl = document.getElementById('modal-manpower-subtitle');
    const submitTxt = document.getElementById('btn-submit-manpower-text');

    if (headerDefault) { headerDefault.classList.remove('hidden'); headerDefault.classList.add('flex'); }
    if (headerProfile) { headerProfile.classList.add('hidden'); headerProfile.classList.remove('flex'); }
    if (detailTabSwitcher) { detailTabSwitcher.classList.add('hidden'); detailTabSwitcher.classList.remove('flex'); }
    if (detailPanel) { detailPanel.classList.add('hidden'); detailPanel.classList.remove('flex'); }
    if (switcher) switcher.classList.remove('hidden');
    if (delBtn) { delBtn.classList.add('hidden'); delBtn.classList.remove('inline-flex'); }
    if (titleEl) titleEl.textContent = 'Tambah Data Manpower';
    if (subEl) subEl.textContent = 'Isi manual atau import massal dari Excel';
    if (submitTxt) submitTxt.textContent = 'Simpan';

    switchManpowerModalMode('manual');
    updateDocumentFieldsByRole();

    const modal = document.getElementById('modal-manpower');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function toggleMpPasswordInputVisibility() {
    const inp = document.getElementById('mp-password');
    const icon = document.getElementById('mp-password-toggle-icon');
    if (!inp) return;
    const isHidden = inp.type === 'password';
    inp.type = isHidden ? 'text' : 'password';
    if (icon) icon.className = isHidden ? 'fa-regular fa-eye-slash text-xs text-teal-600' : 'fa-regular fa-eye text-xs';
}

let activeManpowerDetailId = null;
let activeManpowerDetailDocKey = null;

function formatManpowerDetailStatus(docKey, dateStr) {
    if (!dateStr) return null;
    const ev = evaluateDocumentStatus(docKey, dateStr);
    const diff = ev ? ev.diffDays : null;
    if (diff === null || diff === undefined) {
        return { text: 'AKTIF', cls: 'text-emerald-600' };
    }
    if (diff < 0 || ev.level === 'mati') {
        return { text: `EXPIRED (LEWAT ${Math.abs(diff)} HR)`, cls: 'text-red-600' };
    }
    if (diff === 0) {
        return { text: 'EXPIRED HARI INI', cls: 'text-red-600' };
    }
    if (ev.level === 'kritis') {
        return { text: `KRITIS (SISA ${diff} HR)`, cls: 'text-red-600' };
    }
    if (ev.level === 'warning') {
        return { text: `SEGERA HABIS (SISA ${diff} HR)`, cls: 'text-amber-600' };
    }
    return { text: `AKTIF (SISA ${diff} HR)`, cls: 'text-emerald-600' };
}

function formatWaHref(kontak) {
    const digits = String(kontak || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `https://wa.me/62${digits.slice(1)}`;
    if (digits.startsWith('62')) return `https://wa.me/${digits}`;
    return `https://wa.me/${digits}`;
}

function buildMpDetailDocRowHtml(mp, label, docKey, dateStr, showStatus = true) {
    const hasDate = Boolean(String(dateStr || '').trim());
    const mediaObj = mp.media_links && mp.media_links[docKey] ? mp.media_links[docKey] : null;
    const hasPhoto = Boolean(mediaObj && (mediaObj.viewUrl || mediaObj.driveUrl || mediaObj._localPreviewUrl));

    if (!hasDate) {
        return `
            <div class="py-2.5 flex items-center justify-between gap-3">
                <span class="text-[12.5px] font-medium text-slate-600">${escapeHtml(label)}</span>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[12px] italic text-slate-400">Belum Ada</span>
                    ${hasPhoto ? `
                        <button type="button" onclick="openManpowerDocPreview(${Number(mp.id)}, '${escapeHtml(docKey)}', '${escapeHtml(label)}')"
                            title="Lihat foto ${escapeHtml(label)}"
                            class="w-8 h-8 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200/90 text-teal-700 inline-flex items-center justify-center transition-colors">
                            <i class="fa-regular fa-eye text-[12px]"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    if (!showStatus) {
        return `
            <div class="py-2.5 flex items-center justify-between gap-3">
                <span class="text-[12.5px] font-medium text-slate-600">${escapeHtml(label)}</span>
                <span class="text-[13px] font-bold text-slate-800">${escapeHtml(formatDateID(dateStr))}</span>
            </div>
        `;
    }

    const st = formatManpowerDetailStatus(docKey, dateStr);
    return `
        <div class="py-2.5 flex items-center justify-between gap-3">
            <span class="text-[12.5px] font-medium text-slate-600">${escapeHtml(label)}</span>
            <div class="flex items-center gap-2.5 shrink-0">
                <div class="text-right leading-tight">
                    <p class="text-[13px] font-bold text-slate-900">${escapeHtml(formatDateID(dateStr))}</p>
                    ${st ? `<p class="text-[9.5px] font-extrabold tracking-wide uppercase mt-0.5 ${st.cls}">${escapeHtml(st.text)}</p>` : ''}
                </div>
                <button type="button" onclick="openManpowerDocPreview(${Number(mp.id)}, '${escapeHtml(docKey)}', '${escapeHtml(label)}')"
                    title="${hasPhoto ? 'Lihat foto dokumen' : 'Lihat detail / unggah foto dokumen'}"
                    class="w-8 h-8 rounded-lg ${hasPhoto ? 'bg-teal-100 border-teal-300 text-teal-800' : 'bg-teal-50 hover:bg-teal-100 border-teal-200/90 text-teal-700'} border inline-flex items-center justify-center transition-colors shrink-0">
                    <i class="fa-regular fa-eye text-[12.5px]"></i>
                </button>
            </div>
        </div>
    `;
}

function renderManpowerDetailPanel(mp) {
    const panel = document.getElementById('manpower-detail-panel');
    if (!panel || !mp) return;

    // Update Dark Profile Header
    const nameEl = document.getElementById('mp-profile-name');
    const nrpEl = document.getElementById('mp-profile-nrp');
    const roleMetaEl = document.getElementById('mp-profile-role-meta');
    const waWrap = document.getElementById('mp-profile-wa-wrap');

    if (nameEl) nameEl.textContent = mp.nama || '-';
    if (nrpEl) nrpEl.textContent = `NRP: ${mp.nrp || '-'}`;
    const metaParts = [mp.jabatan || '-', mp.perusahaan || '-', mp.domisili || ''].filter(Boolean);
    if (roleMetaEl) roleMetaEl.textContent = metaParts.join(' • ');
    if (waWrap) {
        const waHref = formatWaHref(mp.kontak);
        waWrap.innerHTML = mp.kontak
            ? `<a href="${escapeHtml(waHref || '#')}" ${waHref ? 'target="_blank" rel="noopener noreferrer"' : ''}
                   class="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-200 hover:text-white transition-colors">
                   <i class="fa-brands fa-whatsapp text-[13px]"></i>
                   <span class="font-mono">${escapeHtml(mp.kontak)}</span>
               </a>`
            : `<span class="text-[10.5px] text-teal-100/65 italic">Kontak belum diisi</span>`;
    }

    const reqDocs = typeof getRequiredDocsForRole === 'function' ? getRequiredDocsForRole(mp.jabatan) : ALL_DOC_KEYS;
    const docs = mp.docs || {};

    // 1. MINE PERMIT & LISENSI
    const permitRows = [
        buildMpDetailDocRowHtml(mp, 'Mine Permit BIB', 'PERMIT_BIB', docs.PERMIT_BIB, true),
        buildMpDetailDocRowHtml(mp, 'Mine Permit TIA', 'PERMIT_TIA', docs.PERMIT_TIA, true)
    ];
    if (reqDocs.includes('SIMPOL') || docs.SIMPOL) {
        permitRows.push(buildMpDetailDocRowHtml(mp, 'SIMPOL', 'SIMPOL', docs.SIMPOL, true));
    }
    if (reqDocs.includes('SIO') || docs.SIO) {
        permitRows.push(buildMpDetailDocRowHtml(mp, 'SIO', 'SIO', docs.SIO, true));
    }

    // 2. KESEHATAN (MCU — Masa berlaku 9 bulan dari Awal MCU)
    const effectiveMcu = typeof getEffectiveMcuDate === 'function' ? getEffectiveMcuDate(mp) : (mp.mcu_ulang || docs.MCU || '');
    const mcuRows = [
        buildMpDetailDocRowHtml(mp, 'Awal MCU', 'MCU_AWAL', mp.mcu_awal, false),
        buildMpDetailDocRowHtml(mp, 'MCU Ulang (9 Bln)', 'MCU', effectiveMcu, true)
    ];

    // 3. K3 & KESELAMATAN
    const k3Rows = [
        buildMpDetailDocRowHtml(mp, 'Danger Tag / LOTOTO', 'LOTOTO', docs.LOTOTO, true)
    ];
    if (reqDocs.includes('KETINGGIAN') || docs.KETINGGIAN) {
        k3Rows.push(buildMpDetailDocRowHtml(mp, 'Sertifikat Ketinggian', 'KETINGGIAN', docs.KETINGGIAN, true));
    }

    // Panel pratinjau/upload dokumen aktif bila ikon mata diklik
    let previewCardHtml = '';
    if (activeManpowerDetailDocKey) {
        const docKey = activeManpowerDetailDocKey;
        const docMetaMap = {
            PERMIT_BIB: 'Mine Permit BIB',
            PERMIT_TIA: 'Mine Permit TIA',
            SIMPOL: 'SIMPOL',
            SIO: 'SIO',
            MCU: 'MCU Ulang (9 Bln)',
            LOTOTO: 'Danger Tag / LOTOTO',
            KETINGGIAN: 'Sertifikat Ketinggian'
        };
        const docLabel = docMetaMap[docKey] || docKey;
        const docDate = docKey === 'MCU' ? effectiveMcu : (docs[docKey] || '');
        const st = formatManpowerDetailStatus(docKey, docDate);
        const mediaObj = mp.media_links && mp.media_links[docKey] ? mp.media_links[docKey] : null;
        const imgSrc = mediaObj?.viewUrl || mediaObj?.driveUrl || mediaObj?._localPreviewUrl || '';
        const driveUrl = mediaObj?.driveUrl || '';

        previewCardHtml = `
            <div id="mp-doc-preview-box" class="bg-white rounded-2xl border border-teal-200 shadow-sm p-3.5 space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">${escapeHtml(docLabel)}</p>
                        <p class="text-[11px] text-gray-500 mt-0.5">
                            ${docDate ? `Exp: <strong class="text-gray-800">${escapeHtml(formatDateID(docDate))}</strong>${st ? ` · <span class="font-bold ${st.cls}">${escapeHtml(st.text)}</span>` : ''}` : 'Tanggal belum diisi'}
                        </p>
                    </div>
                    <button type="button" onclick="closeManpowerDocPreview()" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
                ${imgSrc ? `
                    <div class="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                        <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(docLabel)}" class="w-full max-h-52 object-contain bg-white">
                    </div>
                ` : `
                    <div class="py-5 px-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
                        <i class="fa-regular fa-image text-xl text-gray-300 mb-1"></i>
                        <p class="text-[11px] text-gray-400">Foto dokumen ${escapeHtml(docLabel)} belum diunggah.</p>
                    </div>
                `}
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <label class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold cursor-pointer transition-colors">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <span>${imgSrc ? 'Ganti Foto Dokumen' : 'Upload Foto Dokumen'}</span>
                        <input type="file" accept="image/*" class="hidden" onchange="handleManpowerDocPhotoUpload(event, ${Number(mp.id)}, '${escapeHtml(docKey)}')">
                    </label>
                    ${driveUrl ? `
                        <a href="${escapeHtml(driveUrl)}" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline">
                            <i class="fa-brands fa-google-drive"></i>
                            <span>Buka di Drive</span>
                        </a>
                    ` : ''}
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        ${previewCardHtml}

        <!-- Kartu 1: MINE PERMIT & LISENSI -->
        <div class="bg-white rounded-2xl border border-[#E5DFD5] shadow-xs px-4 py-3.5">
            <div class="flex items-center gap-2 mb-1.5">
                <i class="fa-solid fa-id-card text-teal-600 text-[13px]"></i>
                <h4 class="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">MINE PERMIT &amp; LISENSI</h4>
            </div>
            <div class="divide-y divide-gray-100">
                ${permitRows.join('')}
            </div>
        </div>

        <!-- Kartu 2: KESEHATAN (MCU) -->
        <div class="bg-white rounded-2xl border border-[#E5DFD5] shadow-xs px-4 py-3.5">
            <div class="flex items-center gap-2 mb-1.5">
                <i class="fa-solid fa-notes-medical text-emerald-600 text-[13px]"></i>
                <h4 class="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">KESEHATAN (MCU)</h4>
            </div>
            <div class="divide-y divide-gray-100">
                ${mcuRows.join('')}
            </div>
        </div>

        <!-- Kartu 3: K3 & KESELAMATAN -->
        <div class="bg-white rounded-2xl border border-[#E5DFD5] shadow-xs px-4 py-3.5">
            <div class="flex items-center gap-2 mb-1.5">
                <i class="fa-solid fa-helmet-safety text-amber-500 text-[13px]"></i>
                <h4 class="text-[10.5px] font-extrabold uppercase tracking-wider text-gray-400">K3 &amp; KESELAMATAN</h4>
            </div>
            <div class="divide-y divide-gray-100">
                ${k3Rows.join('')}
            </div>
        </div>
    `;
}

function openManpowerDocPreview(mpId, docKey) {
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!mp) return;
    activeManpowerDetailDocKey = activeManpowerDetailDocKey === docKey ? null : docKey;
    renderManpowerDetailPanel(mp);
    const panel = document.getElementById('manpower-detail-panel');
    if (panel) panel.scrollTop = 0;
}

function closeManpowerDocPreview() {
    activeManpowerDetailDocKey = null;
    const mp = manpowerState.find(m => Number(m.id) === Number(activeManpowerDetailId));
    if (mp) renderManpowerDetailPanel(mp);
}

async function handleManpowerDocPhotoUpload(event, mpId, docKey) {
    const file = event.target?.files?.[0];
    const mp = manpowerState.find(m => Number(m.id) === Number(mpId));
    if (!file || !mp) return;
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '')) {
        showToast('Harap pilih file foto/gambar (JPG, PNG, WEBP).', 'error');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const dataUrl = String(ev.target?.result || '');
        if (!dataUrl) return;
        if (!mp.media_links || typeof mp.media_links !== 'object') mp.media_links = {};

        const prevEntry = mp.media_links[docKey] || {};
        const cleanUrl = (u) => (typeof sanitizeSafeMediaUrl === 'function' ? sanitizeSafeMediaUrl(u) : (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''));

        if (typeof isGasConfigured !== 'function' || !isGasConfigured() || typeof uploadMediaToGas !== 'function') {
            mp.media_links[docKey] = {
                _localPreviewUrl: dataUrl,
                fileName: file.name
            };
            activeManpowerDetailDocKey = docKey;
            renderManpowerDetailPanel(mp);
            showToast('GAS Drive belum aktif — foto hanya tampil lokal sementara & TIDAK dikirim ke Supabase.', 'error');
            return;
        }

        try {
            showToast(`Mengunggah foto ${docKey} ke Google Drive...`, 'info');
            const gasRes = await uploadMediaToGas({
                dataUrl,
                fileName: `${docKey}_${mp.nrp}_${file.name}`,
                module: 'MANPOWER_DOCS',
                refId: `${mp.nrp}_${docKey}`,
                nrp: mp.nrp,
                label: `${docKey} - ${mp.nama}`,
                oldFileId: prevEntry.fileId || ''
            });
            const safeView = cleanUrl(gasRes?.viewUrl || gasRes?.driveUrl || '');
            const safeDrive = cleanUrl(gasRes?.driveUrl || '');
            if (!gasRes || !gasRes.ok || (!safeView && !safeDrive)) {
                throw new Error(gasRes?.error || 'Link Google Drive tidak diterima dari GAS.');
            }

            // Simpan HANYA link Google Drive & kode Spreadsheet (ZERO base64/foto di Supabase)
            mp.media_links[docKey] = {
                mediaCode: String(gasRes.mediaCode || ''),
                fileId: String(gasRes.fileId || ''),
                viewUrl: safeView || safeDrive,
                driveUrl: safeDrive || safeView,
                fileName: String(gasRes.fileName || file.name)
            };

            if (typeof patchManpowerMediaLinksToSupabase === 'function') {
                await patchManpowerMediaLinksToSupabase(mp.nrp, mp.media_links);
            } else if (typeof pushManpowerRowsToSupabase === 'function') {
                await pushManpowerRowsToSupabase([mp]);
            }

            activeManpowerDetailDocKey = docKey;
            renderManpowerDetailPanel(mp);
            showToast(`Foto ${docKey} tersimpan di Google Drive${gasRes.mediaCode ? ` (${gasRes.mediaCode})` : ''} & link tersinkron.`, 'success');
        } catch (err) {
            console.warn('Upload foto dokumen manpower ke GAS Drive gagal:', err);
            // Preview sementara di perangkat lokal; _localPreviewUrl otomatis dibuang sebelum kirim ke Supabase
            mp.media_links[docKey] = {
                ...prevEntry,
                _localPreviewUrl: dataUrl,
                fileName: file.name
            };
            activeManpowerDetailDocKey = docKey;
            renderManpowerDetailPanel(mp);
            showToast('Upload ke Google Drive gagal — foto hanya tampil sementara di perangkat ini & TIDAK dikirim ke Supabase.', 'error');
        }
    };
    reader.readAsDataURL(file);
}

function switchManpowerDetailTab(tab) {
    const detailPanel = document.getElementById('manpower-detail-panel');
    const formEl = document.getElementById('form-manpower');
    const excelEl = document.getElementById('manpower-excel-panel');
    const btnDetail = document.getElementById('btn-mp-tab-detail');
    const btnEdit = document.getElementById('btn-mp-tab-edit');

    const activeCls = 'py-1.5 px-3 rounded-lg text-xs font-bold bg-white text-teal-700 shadow-sm transition-all flex items-center justify-center gap-1.5 focus:outline-none';
    const inactiveCls = 'py-1.5 px-3 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900 transition-all flex items-center justify-center gap-1.5 focus:outline-none';

    if (excelEl) { excelEl.classList.add('hidden'); excelEl.classList.remove('flex'); }

    if (tab === 'edit') {
        if (detailPanel) { detailPanel.classList.add('hidden'); detailPanel.classList.remove('flex'); }
        if (formEl) { formEl.classList.remove('hidden'); formEl.classList.add('flex'); }
        if (btnDetail) btnDetail.className = inactiveCls;
        if (btnEdit) btnEdit.className = activeCls;
    } else {
        if (formEl) { formEl.classList.add('hidden'); formEl.classList.remove('flex'); }
        if (detailPanel) { detailPanel.classList.remove('hidden'); detailPanel.classList.add('flex'); }
        if (btnDetail) btnDetail.className = activeCls;
        if (btnEdit) btnEdit.className = inactiveCls;
        const mp = manpowerState.find(m => Number(m.id) === Number(activeManpowerDetailId));
        if (mp) renderManpowerDetailPanel(mp);
    }
}

function openManpowerDetailModal(id, initialTab = 'detail') {
    const mp = manpowerState.find(m => Number(m.id) === Number(id));
    if (!mp) return;

    activeManpowerDetailId = Number(mp.id);
    activeManpowerDetailDocKey = null;

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
    setVal('mp-edit-id', String(mp.id));
    setVal('mp-nrp', mp.nrp);
    setVal('mp-nama', mp.nama);
    setVal('mp-jabatan', mp.jabatan);
    setVal('mp-perusahaan', mp.perusahaan || 'PPA');
    setVal('mp-domisili', mp.domisili || 'Mess');
    setVal('mp-kontak', mp.kontak);
    setVal('mp-email', mp.email);
    setVal('mp-password', (mp.password || '').trim() || mp.nrp || '');
    const pwdInput = document.getElementById('mp-password');
    const pwdIcon = document.getElementById('mp-password-toggle-icon');
    if (pwdInput) pwdInput.type = 'password';
    if (pwdIcon) pwdIcon.className = 'fa-regular fa-eye text-xs';
    setVal('mp-exp-permit-bib', mp.docs?.PERMIT_BIB);
    setVal('mp-exp-permit-tia', mp.docs?.PERMIT_TIA);
    setVal('mp-mcu-awal', mp.mcu_awal);
    setVal('mp-mcu-ulang', typeof getEffectiveMcuDate === 'function' ? getEffectiveMcuDate(mp) : (mp.mcu_ulang || mp.docs?.MCU));
    setVal('mp-exp-lototo', mp.docs?.LOTOTO);
    setVal('mp-exp-simpol', mp.docs?.SIMPOL);
    setVal('mp-exp-sio', mp.docs?.SIO);
    setVal('mp-exp-ketinggian', mp.docs?.KETINGGIAN);

    const headerDefault = document.getElementById('mp-header-default');
    const headerProfile = document.getElementById('mp-header-profile');
    const detailTabSwitcher = document.getElementById('mp-detail-tab-switcher');
    const switcher = document.getElementById('mp-mode-switcher');
    const delBtn = document.getElementById('btn-delete-manpower');
    const submitTxt = document.getElementById('btn-submit-manpower-text');

    if (headerDefault) { headerDefault.classList.add('hidden'); headerDefault.classList.remove('flex'); }
    if (headerProfile) { headerProfile.classList.remove('hidden'); headerProfile.classList.add('flex'); }
    if (detailTabSwitcher) { detailTabSwitcher.classList.remove('hidden'); detailTabSwitcher.classList.add('flex'); }
    if (switcher) switcher.classList.add('hidden');
    if (delBtn) { delBtn.classList.remove('hidden'); delBtn.classList.add('inline-flex'); }
    if (submitTxt) submitTxt.textContent = 'Simpan Perubahan';

    updateDocumentFieldsByRole();
    renderManpowerDetailPanel(mp);
    switchManpowerDetailTab(initialTab === 'edit' ? 'edit' : 'detail');

    const modal = document.getElementById('modal-manpower');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}

function closeManpowerModal() {
    const modal = document.getElementById('modal-manpower');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function autoFillMcuUlangFromAwal() {
    const awalEl = document.getElementById('mp-mcu-awal');
    const ulangEl = document.getElementById('mp-mcu-ulang');
    if (!awalEl || !ulangEl) return;
    const awalVal = String(awalEl.value || '').trim();
    if (!awalVal) return;
    if (typeof calculateMcuExpiryFromAwal === 'function') {
        ulangEl.value = calculateMcuExpiryFromAwal(awalVal, 9);
    }
}

function handleManpowerSubmit(event) {
    event.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const editId = getVal('mp-edit-id');
    const nrp = getVal('mp-nrp');
    const nama = getVal('mp-nama');
    const jabatan = getVal('mp-jabatan');

    if (!nrp || !nama || !jabatan) {
        showToast('NRP, Nama Lengkap, dan Jabatan wajib diisi.', 'error');
        return;
    }

    const mcuAwal = getVal('mp-mcu-awal');
    const mcuUlangVal = getVal('mp-mcu-ulang') || (mcuAwal && typeof calculateMcuExpiryFromAwal === 'function' ? calculateMcuExpiryFromAwal(mcuAwal, 9) : '');

    const payload = {
        nrp,
        nama,
        jabatan,
        perusahaan: getVal('mp-perusahaan') || 'PPA',
        domisili: getVal('mp-domisili') || 'Mess',
        kontak: getVal('mp-kontak'),
        email: getVal('mp-email'),
        password: getVal('mp-password') || nrp,
        mcu_awal: mcuAwal,
        mcu_ulang: mcuUlangVal,
        docs: {
            PERMIT_BIB: getVal('mp-exp-permit-bib'),
            PERMIT_TIA: getVal('mp-exp-permit-tia'),
            MCU: mcuUlangVal,
            LOTOTO: getVal('mp-exp-lototo'),
            SIMPOL: getVal('mp-exp-simpol'),
            SIO: getVal('mp-exp-sio'),
            KETINGGIAN: getVal('mp-exp-ketinggian')
        }
    };

    if (editId) {
        const idx = manpowerState.findIndex(m => Number(m.id) === Number(editId));
        if (idx !== -1) {
            manpowerState[idx] = { ...manpowerState[idx], ...payload };
            if (typeof pushManpowerRowsToSupabase === 'function') pushManpowerRowsToSupabase([manpowerState[idx]]);
        }
        closeManpowerModal();
        if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
        else renderManpowerTable();
        showToast(`Data manpower ${nama} (${nrp}) berhasil diperbarui.`, 'success');
    } else {
        const nextId = manpowerState.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
        const created = { id: nextId, atr: 100.0, ...payload };
        manpowerState.push(created);
        if (typeof pushManpowerRowsToSupabase === 'function') pushManpowerRowsToSupabase([created]);
        closeManpowerModal();
        if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
        else renderManpowerTable();
        showToast(`Manpower ${nama} berhasil ditambahkan & tersinkron ke Performa.`, 'success');
    }
}

function deleteManpowerFromModal() {
    const editId = document.getElementById('mp-edit-id')?.value;
    const mp = manpowerState.find(m => Number(m.id) === Number(editId));
    if (!mp) return;

    openConfirmDeleteModal({
        title: 'Konfirmasi Hapus Data Manpower',
        message: `Apakah Anda yakin ingin menghapus <strong>${escapeHtml(mp.nama)}</strong> (NRP: ${escapeHtml(mp.nrp)})? Data juga akan otomatis terhapus dari menu <strong>Performa Manpower</strong>.`,
        confirmText: 'Ya, Hapus Data',
        onConfirm: () => {
            manpowerState = manpowerState.filter(m => Number(m.id) !== Number(editId));
            closeManpowerModal();
            if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
            else renderManpowerTable();
            showToast(`Data ${mp.nama} (${mp.nrp}) telah dihapus.`, 'info');
        }
    });
}

/**
 * Mengunduh Template Excel Manpower KOSONG (hanya judul kolom yang diperlukan).
 */
function downloadManpowerExcelTemplate() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }
    const headers = [[
        'NRP', 'Nama Lengkap', 'Jabatan / Role', 'Perusahaan', 'Domisili',
        'Password', 'Kontak', 'Email', 'Permit BIB', 'Permit TIA', 'Awal MCU',
        'MCU Ulang', 'LOTOTO', 'SIMPOL', 'SIO', 'Sert. Ketinggian'
    ]];
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    worksheet['!cols'] = headers[0].map(() => ({ wch: 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Manpower');
    XLSX.writeFile(workbook, 'Template_Data_Manpower_PANTAU_SE.xlsx');
    showToast('Template kosong Data Manpower (judul kolom saja) berhasil diunduh.', 'success');
}

function downloadManpowerExcel() {
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const query = (document.getElementById('manpower-search')?.value || '').trim().toLowerCase();
    let rows = manpowerState.filter(mp => {
        if (!query) return true;
        return `${mp.nrp} ${mp.nama} ${mp.jabatan} ${mp.perusahaan} ${mp.domisili} ${mp.kontak} ${mp.email}`.toLowerCase().includes(query);
    });

    if (manpowerSortState.column && manpowerSortState.direction !== 'none') {
        const col = manpowerSortState.column;
        const dir = manpowerSortState.direction === 'asc' ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            if (ALL_DOC_KEYS.includes(col)) {
                const allowA = getAllowedDocsForRole(a.jabatan).includes(col);
                const allowB = getAllowedDocsForRole(b.jabatan).includes(col);
                const dateA = col === 'MCU' ? getEffectiveMcuDate(a) : a.docs?.[col];
                const dateB = col === 'MCU' ? getEffectiveMcuDate(b) : b.docs?.[col];
                const dA = allowA && dateA ? (getDiffDaysFromToday(dateA) ?? 999999) : 999999;
                const dB = allowB && dateB ? (getDiffDaysFromToday(dateB) ?? 999999) : 999999;
                return (dA - dB) * dir;
            }
            return String(a[col] || '').toLowerCase().localeCompare(String(b[col] || ''), 'id') * dir;
        });
    }

    if (!rows.length) {
        showToast('Tidak ada Data Manpower untuk diunduh.', 'info');
        return;
    }

    const headers = [
        'No', 'NRP', 'Nama Lengkap', 'Status', 'Jabatan / Role', 'Perusahaan', 'Domisili',
        'Bapak Asuh', 'Kontak', 'Email', 'Permit BIB', 'Permit TIA', 'Awal MCU',
        'MCU Ulang', 'LOTOTO', 'SIMPOL', 'SIO', 'Sert. Ketinggian'
    ];
    const aoa = [
        headers,
        ...rows.map((mp, idx) => {
            const allowedDocs = getAllowedDocsForRole(mp.jabatan);
            const docVal = (key) => {
                const val = mp.docs?.[key] || '';
                if (val) return val;
                return allowedDocs.includes(key) ? '' : '-';
            };
            const mcuUlangVal = (typeof getEffectiveMcuDate === 'function' ? getEffectiveMcuDate(mp) : '') || docVal('MCU');
            return [
                idx + 1,
                mp.nrp || '',
                mp.nama || '',
                isPersonOutOfRoster(mp) ? 'Out' : 'Aktif',
                mp.jabatan || '',
                mp.perusahaan || '',
                mp.domisili || '',
                String(mp.bapak_asuh || '').trim() || '-',
                mp.kontak || '',
                mp.email || '',
                docVal('PERMIT_BIB'),
                docVal('PERMIT_TIA'),
                mp.mcu_awal || '',
                mcuUlangVal,
                docVal('LOTOTO'),
                docVal('SIMPOL'),
                docVal('SIO'),
                docVal('KETINGGIAN')
            ];
        })
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 5 }, { wch: 13 }, { wch: 24 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
        { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 13 }, { wch: 13 }, { wch: 13 },
        { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data Manpower');
    XLSX.writeFile(wb, `Data_Manpower_PANTAU_SE_${getTodayISO()}.xlsx`);
    showToast(`Berhasil mengunduh Data Manpower (${rows.length} personil) ke Excel.`, 'success');
}

function handleManpowerExcelFileChange(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (typeof XLSX === 'undefined') {
        showToast('Library Excel (SheetJS) belum termuat.', 'error');
        return;
    }

    const nameEl = document.getElementById('mp-excel-filename');
    const sumEl = document.getElementById('mp-excel-summary');
    const importBtn = document.getElementById('btn-import-excel');
    if (nameEl) nameEl.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

            pendingExcelManpower = rows.map(row => {
                const nrp = String(findRowValueByAliases(row, ['NRP', 'NIK']) || '').trim();
                const nama = String(findRowValueByAliases(row, ['Nama Lengkap', 'Nama', 'Name']) || '').trim();
                const jabatan = String(findRowValueByAliases(row, ['Jabatan / Role', 'Jabatan', 'Role', 'Position']) || '').trim();
                if (!nrp || !nama) return null;
                const mcuAwal = normalizeExcelDate(findRowValueByAliases(row, ['Awal MCU', 'MCU Awal']));
                const rawMcuUlang = normalizeExcelDate(findRowValueByAliases(row, ['MCU Ulang']));
                const rawExpMcu = normalizeExcelDate(findRowValueByAliases(row, ['Exp MCU', 'MCU']));
                const explicitMcu = rawMcuUlang || rawExpMcu;
                const legacy12 = (mcuAwal && typeof calculateMcuExpiryFromAwal === 'function') ? calculateMcuExpiryFromAwal(mcuAwal, 12) : '';
                const auto9 = (mcuAwal && typeof calculateMcuExpiryFromAwal === 'function') ? calculateMcuExpiryFromAwal(mcuAwal, 9) : '';
                const effectiveMcu = (!explicitMcu || (legacy12 && explicitMcu === legacy12)) ? (auto9 || explicitMcu) : explicitMcu;
                return {
                    nrp,
                    nama,
                    jabatan: jabatan || 'Oilman',
                    perusahaan: String(findRowValueByAliases(row, ['Perusahaan', 'Comp', 'Company']) || 'PPA').trim(),
                    domisili: String(findRowValueByAliases(row, ['Domisili']) || 'Mess').trim(),
                    password: String(findRowValueByAliases(row, ['Password', 'Kata Sandi', 'Sandi', 'Pass']) || '').trim() || nrp,
                    kontak: String(findRowValueByAliases(row, ['Kontak', 'No HP', 'HP']) || '').trim(),
                    email: String(findRowValueByAliases(row, ['Email']) || '').trim(),
                    mcu_awal: mcuAwal,
                    mcu_ulang: effectiveMcu,
                    docs: {
                        PERMIT_BIB: normalizeExcelDate(findRowValueByAliases(row, ['Permit BIB'])),
                        PERMIT_TIA: normalizeExcelDate(findRowValueByAliases(row, ['Permit TIA'])),
                        MCU: effectiveMcu,
                        LOTOTO: normalizeExcelDate(findRowValueByAliases(row, ['LOTOTO'])),
                        SIMPOL: normalizeExcelDate(findRowValueByAliases(row, ['SIMPOL'])),
                        SIO: normalizeExcelDate(findRowValueByAliases(row, ['SIO'])),
                        KETINGGIAN: normalizeExcelDate(findRowValueByAliases(row, ['Sert. Ketinggian', 'Sertifikat Ketinggian', 'Ketinggian']))
                    }
                };
            }).filter(Boolean);

            if (sumEl) {
                sumEl.textContent = `${pendingExcelManpower.length} baris valid siap diimport`;
                sumEl.classList.remove('hidden');
            }
            if (importBtn) importBtn.disabled = pendingExcelManpower.length === 0;
        } catch (err) {
            console.error('Gagal membaca Excel Manpower:', err);
            showToast('File Excel Manpower gagal dibaca.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function handleManpowerExcelImport() {
    if (!pendingExcelManpower.length) return;
    const saveMode = document.getElementById('mp-excel-save-mode')?.value || 'overwrite';
    let added = 0;
    let updated = 0;
    let skipped = 0;

    pendingExcelManpower.forEach(item => {
        const existingIdx = manpowerState.findIndex(m => String(m.nrp).trim().toLowerCase() === item.nrp.toLowerCase());
        if (existingIdx !== -1) {
            if (saveMode === 'append') {
                skipped++;
                return;
            }
            manpowerState[existingIdx] = { ...manpowerState[existingIdx], ...item };
            updated++;
        } else {
            const nextId = manpowerState.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
            manpowerState.push({ id: nextId, atr: 100.0, ...item });
            added++;
        }
    });

    const importedNrps = new Set(pendingExcelManpower.map(i => String(i.nrp || '').trim().toLowerCase()));
    pendingExcelManpower = [];
    if (typeof pushManpowerRowsToSupabase === 'function') {
        const affected = manpowerState.filter(m => importedNrps.has(String(m.nrp || '').trim().toLowerCase()));
        if (affected.length) pushManpowerRowsToSupabase(affected);
    }
    closeManpowerModal();
    if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
    else renderManpowerTable();
    showToast(formatUploadResultToast('Data Manpower', { added, updated, skipped }, saveMode), (added + updated) > 0 ? 'success' : 'info');
}
