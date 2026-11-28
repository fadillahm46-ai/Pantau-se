/* =====================================================================
 * MODUL UNIVERSAL TABLE SELECT & QUICK BULK DELETE
 * - Menambahkan kolom checkbox Select (header Select All + per baris)
 *   di paling kiri SEMUA tabel data pada aplikasi PANTAU SE
 * - Otomatis menggeser offset sticky-left (+36px) & mendukung rowspan/colspan
 * - Menampilkan Bulk Action Bar dengan tombol Delete cepat begitu >= 1 baris dipilih
 * - Mendukung Shift+Click range select & Pilih Semua lintas halaman pagination
 * ===================================================================== */

const BULK_COL_WIDTH_PX = 36;
const bulkTableStateMap = new WeakMap();
let bulkSelectInitialized = false;

function getBulkTbodyId(tableEl) {
    return tableEl?.querySelector('tbody')?.id || tableEl?.id || '';
}

function getBulkTableState(tableEl) {
    let st = bulkTableStateMap.get(tableEl);
    if (!st) {
        st = { selected: new Set(), lastClickedKey: null };
        bulkTableStateMap.set(tableEl, st);
    }
    return st;
}

function shiftStickyLeftOffset(cellEl) {
    if (!cellEl || cellEl.dataset.bulkStickyShifted === '1') return;
    const cls = cellEl.className || '';
    if (!/\b(?:sm:)?sticky\b/.test(cls)) return;

    if (/\b(?:sm:)?left-0\b/.test(cls)) {
        cellEl.style.left = `${BULK_COL_WIDTH_PX}px`;
        cellEl.dataset.bulkStickyShifted = '1';
        return;
    }
    const m = cls.match(/\b(?:sm:)?left-\[(\d+)px\]/);
    if (m) {
        const origPx = parseInt(m[1], 10);
        if (!isNaN(origPx)) {
            cellEl.style.left = `${origPx + BULK_COL_WIDTH_PX}px`;
            cellEl.dataset.bulkStickyShifted = '1';
        }
    }
}

function hasAnyStickyLeftCol(tableEl) {
    if (!tableEl) return false;
    return Boolean(tableEl.querySelector('th.sticky, td.sticky, [class*="left-0"], [class*="sm:sticky"]'));
}

function extractBulkRowKey(tbodyId, tr, groupIndex) {
    if (!tr) return '';
    if (tr.dataset.rowId) return String(tr.dataset.rowId);

    const html = tr.innerHTML || '';
    const firstTd = tr.querySelector('td:not([data-bulk-col])');
    const getCellText = (idx) => {
        const cells = Array.from(tr.children).filter(el => el.tagName === 'TD' && !el.hasAttribute('data-bulk-col'));
        return (cells[idx]?.textContent || '').trim();
    };
    const findMpIdByNrpText = (txt) => {
        const m = String(txt || '').match(/\b\d{5,}\b/);
        if (!m || !Array.isArray(manpowerState)) return '';
        const found = manpowerState.find(p => String(p.nrp || '').trim() === m[0]);
        return found ? String(found.id) : '';
    };

    switch (tbodyId) {
        case 'manpower-table-body': {
            const m = html.match(/openManpowerDetailModal\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'komisioning-table-body': {
            const m = html.match(/openKomisioningDetailModal\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'rental-bib-tbody': {
            const m = html.match(/openRentalDetailModal\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'crane-timeframe-tbody': {
            const m = html.match(/openCraneScheduleDetailModal\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'punishment-history-tbody': {
            const m = html.match(/confirmDeletePunishmentRecord\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'roster-table-body': {
            const m = html.match(/roster-nrp-cell-(\d+)/);
            return m ? m[1] : '';
        }
        case 'master-manpower-tbody': {
            const m = html.match(/confirmDeleteMasterManpower\((\d+)\)/) || html.match(/openManpowerDetailModal\((\d+)\)/);
            return m ? m[1] : '';
        }
        case 'master-jabatan-tbody':
        case 'master-perusahaan-tbody':
        case 'master-unit-tbody':
        case 'master-kode-roster-tbody':
        case 'master-kode-spi-tbody': {
            const m = html.match(/confirmDeleteMasterItem\([^,]+,\s*(\d+)\)/) || html.match(/openMasterItemModal\([^,]+,\s*(\d+)\)/);
            return m ? m[1] : '';
        }
        case 'performa-atr-tbody': {
            const m = html.match(/startEditBapakAsuhCell\((\d+)\)/) || html.match(/openAtrDetailModal\((\d+)/);
            return m ? m[1] : findMpIdByNrpText(getCellText(0));
        }
        case 'atr-weekly-tbody':
        case 'atr-monthly-tbody': {
            const m = html.match(/openAtrDetailModal\((\d+)/) || html.match(/openAtrMonthlyCellDetail\((\d+)/);
            return m ? m[1] : findMpIdByNrpText(getCellText(0));
        }
        case 'performa-absensi-tbody':
        case 'absensi-monthly-tbody': {
            const m = html.match(/openEditAbsensiModal\((\d+)/);
            return m ? m[1] : findMpIdByNrpText(getCellText(0));
        }
        case 'input-kpi-pengawas-tbody': {
            const m = html.match(/updateKpiField\((\d+)/);
            return m ? m[1] : findMpIdByNrpText(getCellText(0));
        }
        case 'dashboard-kpi-pengawas-tbody': {
            return findMpIdByNrpText(getCellText(0));
        }
        case 'hm-unit-tbody': {
            const m = html.match(/startEditHmAktualCell\('([^']+)'/);
            if (m) return m[1];
            const unitTxt = getCellText(0);
            return unitTxt ? `unit::${unitTxt}` : '';
        }
        case 'ua-unit-tbody':
        case 'ua-weekly-tbody':
        case 'ua-mtd-tbody': {
            const unitTxt = getCellText(0);
            return unitTxt ? unitTxt : '';
        }
        default:
            return firstTd ? `row-${groupIndex}` : '';
    }
}

function getAllSelectableKeysForTable(tableEl) {
    const tbodyId = getBulkTbodyId(tableEl);
    if (tbodyId === 'ops-ltwt-tbody' && Array.isArray(window.opsLtWtFilteredIds)) {
        return window.opsLtWtFilteredIds;
    }
    if (tbodyId === 'ops-lifting-tbody' && Array.isArray(window.opsLiftingFilteredIds)) {
        return window.opsLiftingFilteredIds;
    }
    const tbody = tableEl?.querySelector('tbody');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('input.bulk-row-cb'))
        .map(cb => cb.dataset.bulkKey)
        .filter(Boolean);
}

function getOrCreateBulkActionBar(tableEl) {
    const scrollWrap = tableEl.closest('.overflow-auto, .overflow-x-auto') || tableEl.parentElement;
    if (!scrollWrap || !scrollWrap.parentElement) return null;

    if (scrollWrap.previousElementSibling && scrollWrap.previousElementSibling.classList.contains('table-bulk-action-bar')) {
        return scrollWrap.previousElementSibling;
    }
    const bar = document.createElement('div');
    bar.className = 'table-bulk-action-bar hidden px-3.5 py-2 bg-red-50/95 border-b border-red-200 flex-wrap items-center justify-between gap-2 text-xs shrink-0';
    scrollWrap.insertAdjacentElement('beforebegin', bar);
    return bar;
}

function getBulkDeleteLabel(tbodyId) {
    const labels = {
        'ops-ltwt-tbody': 'data Lubetruck / Watertruck',
        'ops-lifting-tbody': 'data WO Lifting',
        'manpower-table-body': 'data Manpower',
        'master-manpower-tbody': 'data Manpower',
        'komisioning-table-body': 'data Unit Komisioning',
        'master-unit-tbody': 'data Master Unit',
        'rental-bib-tbody': 'data Rental BIB',
        'crane-timeframe-tbody': 'jadwal Time Frame Big Crane',
        'punishment-history-tbody': 'riwayat Punishment',
        'roster-table-body': 'baris Roster SE',
        'master-jabatan-tbody': 'Master Jabatan',
        'master-perusahaan-tbody': 'Master Perusahaan',
        'master-kode-roster-tbody': 'Master Kode Roster',
        'master-kode-spi-tbody': 'Master Kode SPI',
        'performa-atr-tbody': 'data ATR periode aktif',
        'atr-weekly-tbody': 'data ATR Weekly periode tampil',
        'atr-monthly-tbody': 'data ATR Monthly tahun aktif',
        'performa-absensi-tbody': 'data Absensi tanggal aktif',
        'absensi-monthly-tbody': 'data Absensi bulan aktif',
        'input-kpi-pengawas-tbody': 'data KPI Pengawas week aktif',
        'dashboard-kpi-pengawas-tbody': 'data KPI Pengawas week aktif',
        'hm-unit-tbody': 'data HM Daily tanggal aktif',
        'ua-unit-tbody': 'data UA Unit tanggal aktif',
        'ua-weekly-tbody': 'data UA Weekly periode tampil',
        'ua-mtd-tbody': 'data UA MTD bulan aktif'
    };
    return labels[tbodyId] || 'baris data';
}

function executeBulkDeleteForTable(tableEl, selectedKeys) {
    const tbodyId = getBulkTbodyId(tableEl);
    const keySet = new Set(selectedKeys.map(String));
    const numSet = new Set(selectedKeys.map(k => Number(k)).filter(n => !isNaN(n)));
    let deletedCount = 0;

    switch (tbodyId) {
        case 'ops-ltwt-tbody': {
            const before = opsLtWtState.length;
            opsLtWtState = opsLtWtState.filter(r => !keySet.has(String(r.id)));
            deletedCount = before - opsLtWtState.length;
            persistOpsLtWtState();
            renderOpsLtWtTable();
            break;
        }
        case 'ops-lifting-tbody': {
            const before = opsLiftingState.length;
            opsLiftingState = opsLiftingState.filter(r => !keySet.has(String(r.id)));
            deletedCount = before - opsLiftingState.length;
            persistOpsLiftingState();
            renderOpsLiftingTable();
            break;
        }
        case 'manpower-table-body':
        case 'master-manpower-tbody': {
            const before = manpowerState.length;
            manpowerState = manpowerState.filter(m => !numSet.has(Number(m.id)));
            deletedCount = before - manpowerState.length;
            if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
            else {
                renderManpowerTable();
                renderPerformaManpower();
                renderDokumenAnalisis();
            }
            break;
        }
        case 'komisioning-table-body':
        case 'master-unit-tbody': {
            const before = komisioningState.length;
            komisioningState = komisioningState.filter(u => !numSet.has(Number(u.id)));
            deletedCount = before - komisioningState.length;
            if (typeof syncAllMasterConnections === 'function') syncAllMasterConnections(false);
            else renderKomisioningTable();
            break;
        }
        case 'rental-bib-tbody': {
            const before = rentalBibState.length;
            rentalBibState = rentalBibState.filter(r => !numSet.has(Number(r.id)));
            deletedCount = before - rentalBibState.length;
            renderRentalBibTable();
            break;
        }
        case 'crane-timeframe-tbody': {
            const before = bigCraneTimeframeState.length;
            bigCraneTimeframeState = bigCraneTimeframeState.filter(c => !numSet.has(Number(c.id)));
            deletedCount = before - bigCraneTimeframeState.length;
            renderBigCraneTimeframeTable();
            break;
        }
        case 'punishment-history-tbody': {
            const before = punishmentHistoryState.length;
            punishmentHistoryState = punishmentHistoryState.filter(p => !numSet.has(Number(p.id)));
            deletedCount = before - punishmentHistoryState.length;
            renderPunishmentHistoryTable();
            renderAtrMonthlyTable();
            renderPerformaManpower();
            break;
        }
        case 'roster-table-body': {
            if (typeof verifyRosterBulkDeleteAccess === 'function') {
                const canDel = verifyRosterBulkDeleteAccess(numSet, () => executeBulkDeleteForTable(tableEl, keys));
                if (!canDel) return;
            }
            const removedNrps = rosterState.filter(r => numSet.has(Number(r.id))).map(r => r.nrp);
            const before = rosterState.length;
            rosterState = rosterState.filter(r => !numSet.has(Number(r.id)));
            deletedCount = before - rosterState.length;
            if (removedNrps.length && typeof deleteRosterRowsFromSupabase === 'function') {
                deleteRosterRowsFromSupabase(removedNrps);
            }
            renderRosterTable();
            renderManpowerTable();
            if (typeof renderRosterPersonalCalendar === 'function') renderRosterPersonalCalendar();
            if (typeof renderRosterDailyView === 'function') renderRosterDailyView();
            break;
        }
        case 'master-jabatan-tbody': {
            const before = masterJabatanState.length;
            masterJabatanState = masterJabatanState.filter(j => !numSet.has(Number(j.id)));
            deletedCount = before - masterJabatanState.length;
            syncAllMasterConnections(false);
            break;
        }
        case 'master-perusahaan-tbody': {
            const before = masterPerusahaanState.length;
            masterPerusahaanState = masterPerusahaanState.filter(p => !numSet.has(Number(p.id)));
            deletedCount = before - masterPerusahaanState.length;
            syncAllMasterConnections(false);
            break;
        }
        case 'master-kode-roster-tbody': {
            const before = masterKodeRosterState.length;
            masterKodeRosterState = masterKodeRosterState.filter(k => !numSet.has(Number(k.id)));
            deletedCount = before - masterKodeRosterState.length;
            syncAllMasterConnections(false);
            break;
        }
        case 'master-kode-spi-tbody': {
            const before = masterKodeSpiState.length;
            masterKodeSpiState = masterKodeSpiState.filter(s => !numSet.has(Number(s.id)));
            deletedCount = before - masterKodeSpiState.length;
            syncAllMasterConnections(false);
            break;
        }
        case 'performa-atr-tbody': {
            const mode = document.getElementById('atr-monitoring-mode')?.value || 'weekly';
            if (mode === 'monthly') {
                const mIdx = parseInt(document.getElementById('atr-monitoring-month')?.value ?? String(new Date().getMonth()), 10);
                const yr = parseInt(document.getElementById('atr-monitoring-year')?.value || String(new Date().getFullYear()), 10);
                numSet.forEach(mpId => {
                    const k = `${mpId}::${yr}-${mIdx}`;
                    if (atrMonthlyState[k]) { delete atrMonthlyState[k]; deletedCount++; }
                });
            } else {
                const wkKey = document.getElementById('atr-monitoring-week')?.value || getCurrentCalendarWeekInfo().key;
                numSet.forEach(mpId => {
                    const k = `${mpId}::${wkKey}`;
                    if (atrWeeklyState[k]) { delete atrWeeklyState[k]; deletedCount++; }
                });
            }
            if (deletedCount === 0) deletedCount = numSet.size;
            renderPerformaManpower();
            renderAtrWeeklyTable();
            renderAtrMonthlyTable();
            break;
        }
        case 'atr-weekly-tbody': {
            const yr = parseInt(document.getElementById('atr-weekly-year')?.value || '2026', 10);
            const mFilter = document.getElementById('atr-weekly-month')?.value ?? 'all';
            const allWks = getWeeksInYearSunSat(yr);
            const targetWks = mFilter === 'all' ? allWks : allWks.filter(w => w.months.includes(parseInt(mFilter, 10)));
            numSet.forEach(mpId => {
                targetWks.forEach(w => {
                    const k = `${mpId}::${w.key}`;
                    if (atrWeeklyState[k]) { delete atrWeeklyState[k]; deletedCount++; }
                });
            });
            if (deletedCount === 0) deletedCount = numSet.size;
            renderAtrWeeklyTable();
            renderPerformaManpower();
            break;
        }
        case 'atr-monthly-tbody': {
            const yr = parseInt(document.getElementById('atr-monthly-year')?.value || '2026', 10);
            numSet.forEach(mpId => {
                for (let m = 0; m < 12; m++) {
                    const k = `${mpId}::${yr}-${m}`;
                    if (atrMonthlyState[k]) { delete atrMonthlyState[k]; deletedCount++; }
                }
            });
            if (deletedCount === 0) deletedCount = numSet.size;
            renderAtrMonthlyTable();
            renderPerformaManpower();
            break;
        }
        case 'performa-absensi-tbody': {
            const dateIso = document.getElementById('absensi-monitoring-date')?.value || getTodayISO();
            const deletedKeys = [];
            numSet.forEach(mpId => {
                const k = `${mpId}::${dateIso}`;
                if (absensiRecordsState[k]) {
                    delete absensiRecordsState[k];
                    deletedKeys.push(k);
                    deletedCount++;
                }
            });
            if (deletedKeys.length > 0 && typeof deleteAbsensiRecordsFromSupabase === 'function') {
                deleteAbsensiRecordsFromSupabase(deletedKeys);
            }
            if (deletedCount === 0) deletedCount = numSet.size;
            renderPerformaManpower();
            renderAbsensiMonthlyTable();
            break;
        }
        case 'absensi-monthly-tbody': {
            const mIdx = parseInt(document.getElementById('absensi-monthly-month')?.value ?? String(new Date().getMonth()), 10);
            const yr = parseInt(document.getElementById('absensi-monthly-year')?.value || String(new Date().getFullYear()), 10);
            const ymPrefix = `${yr}-${String(mIdx + 1).padStart(2, '0')}-`;
            const deletedKeys = [];
            Object.keys(absensiRecordsState).forEach(k => {
                const [idPart, dtPart] = k.split('::');
                if (numSet.has(Number(idPart)) && dtPart && dtPart.startsWith(ymPrefix)) {
                    delete absensiRecordsState[k];
                    deletedKeys.push(k);
                    deletedCount++;
                }
            });
            if (deletedKeys.length > 0 && typeof deleteAbsensiRecordsFromSupabase === 'function') {
                deleteAbsensiRecordsFromSupabase(deletedKeys);
            }
            if (deletedCount === 0) deletedCount = numSet.size;
            renderAbsensiMonthlyTable();
            renderPerformaManpower();
            break;
        }
        case 'input-kpi-pengawas-tbody':
        case 'dashboard-kpi-pengawas-tbody': {
            const selId = tbodyId === 'input-kpi-pengawas-tbody' ? 'input-kpi-week-filter' : 'dash-kpi-week-filter';
            const wkKey = document.getElementById(selId)?.value || getCurrentCalendarWeekInfo().key;
            numSet.forEach(mpId => {
                const k = `${mpId}::${wkKey}`;
                kpiPengawasStore[k] = {
                    sap: null, closing_rate: null, sqi: null, atr_individu: null, atr_anak_asuh: null,
                    status: 'MTD Daily', updatedAt: formatDateID(getTodayISO())
                };
                deletedCount++;
            });
            renderInputKpiPengawasTable();
            renderDashboardKpiPengawas();
            break;
        }
        case 'hm-unit-tbody': {
            const activeDate = document.getElementById('hmua-filter-date')?.value || getTodayISO();
            keySet.forEach(k => {
                if (hmUaRecordsState[k]) {
                    delete hmUaRecordsState[k];
                    deletedCount++;
                } else if (k.startsWith('unit::')) {
                    const uKey = normalizeUnitKey(k.slice(6));
                    Object.keys(hmUaRecordsState).forEach(rk => {
                        const rec = hmUaRecordsState[rk];
                        if (rec && normalizeUnitKey(rec.unit) === uKey && rec.date === activeDate) {
                            delete hmUaRecordsState[rk];
                            deletedCount++;
                        }
                    });
                }
            });
            if (deletedCount === 0) deletedCount = keySet.size;
            renderHmUaTables();
            break;
        }
        case 'ua-unit-tbody': {
            const activeDate = document.getElementById('hmua-filter-date')?.value || getTodayISO();
            keySet.forEach(unitStr => {
                const uKey = normalizeUnitKey(unitStr);
                Object.keys(hmUaRecordsState).forEach(rk => {
                    const rec = hmUaRecordsState[rk];
                    if (rec && normalizeUnitKey(rec.unit) === uKey && rec.date === activeDate) {
                        delete hmUaRecordsState[rk];
                        deletedCount++;
                    }
                });
            });
            if (deletedCount === 0) deletedCount = keySet.size;
            renderHmUaTables();
            break;
        }
        case 'ua-weekly-tbody': {
            const yr = parseInt(document.getElementById('ua-weekly-year')?.value || '2026', 10);
            const mFilter = document.getElementById('ua-weekly-month')?.value ?? '10';
            const allWks = getWeeksInYearSunSat(yr);
            const targetWks = mFilter === 'all' ? allWks : allWks.filter(w => w.months.includes(parseInt(mFilter, 10)));
            const wkKeys = new Set(targetWks.map(w => w.key));
            keySet.forEach(unitStr => {
                const uKey = normalizeUnitKey(unitStr);
                wkKeys.forEach(wk => {
                    const aggKey = `${uKey}::${wk}`;
                    if (uaWeeklyUploadState[aggKey]) { delete uaWeeklyUploadState[aggKey]; deletedCount++; }
                });
                Object.keys(hmUaRecordsState).forEach(rk => {
                    const rec = hmUaRecordsState[rk];
                    if (!rec || normalizeUnitKey(rec.unit) !== uKey || !rec.date) return;
                    const dt = new Date(rec.date + 'T00:00:00');
                    if (!isNaN(dt.getTime()) && targetWks.some(w => dt >= w.startDate && dt <= w.endDate)) {
                        delete hmUaRecordsState[rk];
                        deletedCount++;
                    }
                });
            });
            if (deletedCount === 0) deletedCount = keySet.size;
            renderUaWeeklyTable();
            renderHmUaTables();
            break;
        }
        case 'ua-mtd-tbody': {
            const yr = parseInt(document.getElementById('ua-mtd-year')?.value || '2026', 10);
            const mIdx = parseInt(document.getElementById('ua-mtd-month')?.value ?? '10', 10);
            const ymPrefix = `${yr}-${String(mIdx + 1).padStart(2, '0')}-`;
            keySet.forEach(unitStr => {
                const uKey = normalizeUnitKey(unitStr);
                const mtdKey = `${uKey}::${yr}-${mIdx}`;
                if (uaMtdUploadState[mtdKey]) { delete uaMtdUploadState[mtdKey]; deletedCount++; }
                Object.keys(hmUaRecordsState).forEach(rk => {
                    const rec = hmUaRecordsState[rk];
                    if (rec && normalizeUnitKey(rec.unit) === uKey && String(rec.date || '').startsWith(ymPrefix)) {
                        delete hmUaRecordsState[rk];
                        deletedCount++;
                    }
                });
            });
            if (deletedCount === 0) deletedCount = keySet.size;
            renderUaMtdTable();
            renderHmUaTables();
            break;
        }
        default: {
            deletedCount = keySet.size;
            break;
        }
    }

    const st = getBulkTableState(tableEl);
    st.selected.clear();
    st.lastClickedKey = null;
    refreshBulkSelectForTable(tableEl);
    showToast(`${deletedCount.toLocaleString('id-ID')} ${getBulkDeleteLabel(tbodyId)} berhasil dihapus.`, 'success');
}

function updateBulkActionBarUi(tableEl) {
    const bar = getOrCreateBulkActionBar(tableEl);
    if (!bar) return;
    const st = getBulkTableState(tableEl);
    const tbodyId = getBulkTbodyId(tableEl);
    const count = st.selected.size;

    if (count === 0) {
        bar.classList.add('hidden');
        bar.classList.remove('flex');
        bar.innerHTML = '';
        return;
    }

    const allKeys = getAllSelectableKeysForTable(tableEl);
    const canSelectAllFiltered = allKeys.length > count && allKeys.length > TABLE_PAGE_SIZE;
    const selectAllBtnHtml = canSelectAllFiltered
        ? `<button type="button" data-bulk-select-all-filtered="1" class="text-[11px] font-semibold text-teal-700 hover:underline ml-1">Pilih semua ${allKeys.length.toLocaleString('id-ID')} data</button>`
        : '';

    bar.classList.remove('hidden');
    bar.classList.add('flex');
    bar.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 text-red-800">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px]">
                <i class="fa-solid fa-check"></i>
            </span>
            <span class="font-semibold"><strong class="font-mono">${count.toLocaleString('id-ID')}</strong> baris dipilih</span>
            ${selectAllBtnHtml}
        </div>
        <div class="flex items-center gap-2">
            <button type="button" data-bulk-clear="1"
                class="px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-[11px] font-semibold transition-colors">
                Batal
            </button>
            <button type="button" data-bulk-delete="1"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold shadow-sm transition-colors">
                <i class="fa-solid fa-trash-can text-[10px]"></i>
                <span>Delete (${count.toLocaleString('id-ID')})</span>
            </button>
        </div>
    `;

    const selAllBtn = bar.querySelector('[data-bulk-select-all-filtered]');
    if (selAllBtn) {
        selAllBtn.addEventListener('click', () => {
            allKeys.forEach(k => st.selected.add(String(k)));
            syncBulkCheckboxesState(tableEl);
        });
    }

    const clearBtn = bar.querySelector('[data-bulk-clear]');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            st.selected.clear();
            st.lastClickedKey = null;
            syncBulkCheckboxesState(tableEl);
        });
    }

    const delBtn = bar.querySelector('[data-bulk-delete]');
    if (delBtn) {
        delBtn.addEventListener('click', () => {
            const keysToDelete = Array.from(st.selected);
            if (!keysToDelete.length) return;
            const targetLabel = getBulkDeleteLabel(tbodyId);
            if (typeof openConfirmDeleteModal === 'function') {
                openConfirmDeleteModal({
                    title: `Hapus ${keysToDelete.length.toLocaleString('id-ID')} Data Terpilih?`,
                    message: `Anda akan menghapus cepat <strong>${keysToDelete.length.toLocaleString('id-ID')} ${escapeHtml(targetLabel)}</strong> yang dipilih tanpa perlu membuka detail satu per satu.`,
                    confirmText: `Ya, Delete (${keysToDelete.length.toLocaleString('id-ID')})`,
                    onConfirm: () => executeBulkDeleteForTable(tableEl, keysToDelete)
                });
            } else {
                executeBulkDeleteForTable(tableEl, keysToDelete);
            }
        });
    }
}

function getVisibleRowCheckboxes(tableEl) {
    const tbody = tableEl?.querySelector('tbody');
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll('input.bulk-row-cb')).filter(cb => {
        const tr = cb.closest('tr');
        return tr && !tr.classList.contains('hidden');
    });
}

function syncBulkCheckboxesState(tableEl) {
    const st = getBulkTableState(tableEl);
    const tbody = tableEl?.querySelector('tbody');
    if (!tbody) return;

    tbody.querySelectorAll('input.bulk-row-cb').forEach(cb => {
        const key = cb.dataset.bulkKey || '';
        const checked = st.selected.has(key);
        cb.checked = checked;
        const tr = cb.closest('tr');
        if (tr) {
            tr.classList.toggle('!bg-teal-50/70', checked);
            const span = parseInt(cb.closest('td')?.getAttribute('rowspan') || '1', 10);
            let sib = tr.nextElementSibling;
            for (let i = 1; i < span && sib; i++, sib = sib.nextElementSibling) {
                sib.classList.toggle('!bg-teal-50/70', checked);
            }
        }
    });

    const headerCb = tableEl.querySelector('thead input.bulk-select-all-cb');
    if (headerCb) {
        const visibleCbs = getVisibleRowCheckboxes(tableEl);
        const visSelected = visibleCbs.filter(cb => st.selected.has(cb.dataset.bulkKey || '')).length;
        headerCb.checked = visibleCbs.length > 0 && visSelected === visibleCbs.length;
        headerCb.indeterminate = visSelected > 0 && visSelected < visibleCbs.length;
    }

    updateBulkActionBarUi(tableEl);
}

function decorateTableHeaderWithBulkSelect(tableEl) {
    const thead = tableEl?.querySelector('thead');
    if (!thead) return;
    const trs = Array.from(thead.children).filter(el => el.tagName === 'TR');
    if (!trs.length) return;
    const firstTr = trs[0];
    if (firstTr.querySelector('th[data-bulk-col="1"]')) return;

    const isSticky = hasAnyStickyLeftCol(tableEl);
    Array.from(firstTr.children).forEach(th => shiftStickyLeftOffset(th));

    const th = document.createElement('th');
    th.setAttribute('data-bulk-col', '1');
    if (trs.length > 1) th.setAttribute('rowspan', String(trs.length));
    th.className = `py-2.5 px-2 text-center w-[36px] min-w-[36px] max-w-[36px] border-b border-r border-gray-200/80 select-none ${isSticky ? 'sticky left-0 z-30 bg-gray-50' : ''}`;
    th.innerHTML = '<input type="checkbox" class="bulk-select-all-cb w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 align-middle" title="Pilih semua baris pada halaman ini">';
    firstTr.insertBefore(th, firstTr.firstChild);

    const headerCb = th.querySelector('input.bulk-select-all-cb');
    headerCb.addEventListener('click', (e) => e.stopPropagation());
    headerCb.addEventListener('change', () => {
        const st = getBulkTableState(tableEl);
        const visibleCbs = getVisibleRowCheckboxes(tableEl);
        visibleCbs.forEach(cb => {
            const key = cb.dataset.bulkKey;
            if (!key) return;
            if (headerCb.checked) st.selected.add(key);
            else st.selected.delete(key);
        });
        syncBulkCheckboxesState(tableEl);
    });
}

function decorateTableBodyWithBulkSelect(tableEl) {
    const tbody = tableEl?.querySelector('tbody');
    if (!tbody) return;
    const tbodyId = getBulkTbodyId(tableEl);
    const isSticky = hasAnyStickyLeftCol(tableEl);
    const allTrs = Array.from(tbody.children).filter(el => el.tagName === 'TR');
    if (!allTrs.length) {
        syncBulkCheckboxesState(tableEl);
        return;
    }

    // Empty state row: tambahkan colspan + 1 jika belum disesuaikan
    if (allTrs.length === 1) {
        const tds = Array.from(allTrs[0].children).filter(el => el.tagName === 'TD');
        if (tds.length === 1 && Number(tds[0].getAttribute('colspan') || '1') > 1) {
            if (!tds[0].dataset.bulkColspanAdjusted) {
                tds[0].setAttribute('colspan', String(Number(tds[0].getAttribute('colspan')) + 1));
                tds[0].dataset.bulkColspanAdjusted = '1';
            }
            syncBulkCheckboxesState(tableEl);
            return;
        }
    }

    const groups = typeof groupTbodyRowsForPagination === 'function'
        ? groupTbodyRowsForPagination(tbody)
        : allTrs.map(tr => [tr]);

    groups.forEach((chunk, gIdx) => {
        const firstTr = chunk[0];
        if (!firstTr || firstTr.querySelector('td[data-bulk-col="1"]')) return;

        // Geser kolom sticky pada baris pertama (dan baris pasangan jika ada)
        chunk.forEach(trRow => {
            Array.from(trRow.children).forEach(tdEl => shiftStickyLeftOffset(tdEl));
        });

        const rowKey = extractBulkRowKey(tbodyId, firstTr, gIdx);
        const td = document.createElement('td');
        td.setAttribute('data-bulk-col', '1');
        if (chunk.length > 1) td.setAttribute('rowspan', String(chunk.length));

        const isAlt = gIdx % 2 === 1;
        const stickyBg = isSticky ? (isAlt ? 'bg-gray-50' : 'bg-white') : '';
        td.className = `py-2 px-2 text-center align-middle w-[36px] min-w-[36px] max-w-[36px] border-b border-r border-gray-100 select-none ${isSticky ? `sticky left-0 z-10 ${stickyBg} group-hover:bg-teal-50 transition-colors` : ''}`;
        td.innerHTML = `<input type="checkbox" class="bulk-row-cb w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer accent-teal-600 align-middle" data-bulk-key="${escapeHtml(rowKey)}" title="Pilih baris ini">`;
        firstTr.insertBefore(td, firstTr.firstChild);

        const rowCb = td.querySelector('input.bulk-row-cb');
        td.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target !== rowCb) {
                rowCb.checked = !rowCb.checked;
                rowCb.dispatchEvent(new Event('change'));
            }
        });
        rowCb.addEventListener('click', (e) => {
            e.stopPropagation();
            const st = getBulkTableState(tableEl);
            if (e.shiftKey && st.lastClickedKey) {
                const visibleCbs = getVisibleRowCheckboxes(tableEl);
                const idxA = visibleCbs.findIndex(c => c.dataset.bulkKey === st.lastClickedKey);
                const idxB = visibleCbs.findIndex(c => c === rowCb);
                if (idxA >= 0 && idxB >= 0) {
                    const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
                    for (let i = lo; i <= hi; i++) {
                        const k = visibleCbs[i].dataset.bulkKey;
                        if (!k) continue;
                        if (rowCb.checked) st.selected.add(k);
                        else st.selected.delete(k);
                    }
                    st.lastClickedKey = rowKey;
                    syncBulkCheckboxesState(tableEl);
                }
            }
        });
        rowCb.addEventListener('change', () => {
            const st = getBulkTableState(tableEl);
            if (!rowKey) return;
            if (rowCb.checked) st.selected.add(rowKey);
            else st.selected.delete(rowKey);
            st.lastClickedKey = rowKey;
            syncBulkCheckboxesState(tableEl);
        });
    });

    // Bersihkan selected key yang sudah tidak ada di daftar data aktif
    const st = getBulkTableState(tableEl);
    if (st.selected.size > 0) {
        const validSet = new Set(getAllSelectableKeysForTable(tableEl).map(String));
        Array.from(st.selected).forEach(k => {
            if (!validSet.has(String(k))) st.selected.delete(k);
        });
    }

    syncBulkCheckboxesState(tableEl);
}

function decorateTableFooterWithBulkSelect(tableEl) {
    const tfoot = tableEl?.querySelector('tfoot');
    if (!tfoot) return;
    if (!tableEl.querySelector('thead th[data-bulk-col="1"]')) return;

    const isSticky = hasAnyStickyLeftCol(tableEl);
    const trs = Array.from(tfoot.children).filter(el => el.tagName === 'TR');
    trs.forEach(tr => {
        if (tr.dataset.bulkColHandled === '1') return;
        const cells = Array.from(tr.children).filter(el => el.tagName === 'TD' || el.tagName === 'TH');
        if (!cells.length) return;

        const firstCell = cells[0];
        if (firstCell.dataset.bulkMergeCol === '1') {
            const origSpan = Math.max(1, parseInt(firstCell.getAttribute('colspan') || '1', 10) || 1);
            firstCell.setAttribute('colspan', String(origSpan + 1));
            cells.slice(1).forEach(cellEl => shiftStickyLeftOffset(cellEl));
            tr.dataset.bulkColHandled = '1';
            return;
        }

        if (cells.length === 1 && Number(firstCell.getAttribute('colspan') || '1') > 1) {
            firstCell.setAttribute('colspan', String(Number(firstCell.getAttribute('colspan')) + 1));
            tr.dataset.bulkColHandled = '1';
            return;
        }

        if (tr.querySelector('td[data-bulk-col="1"], th[data-bulk-col="1"]')) {
            tr.dataset.bulkColHandled = '1';
            return;
        }

        cells.forEach(cellEl => shiftStickyLeftOffset(cellEl));
        const spacer = document.createElement('td');
        spacer.setAttribute('data-bulk-col', '1');
        spacer.className = `py-2 px-2 w-[36px] min-w-[36px] max-w-[36px] select-none ${isSticky ? 'sticky left-0 z-10' : ''}`;
        tr.insertBefore(spacer, tr.firstChild);
        tr.dataset.bulkColHandled = '1';
    });
}

function refreshBulkSelectForTable(tableEl) {
    if (!tableEl) return;
    decorateTableHeaderWithBulkSelect(tableEl);
    decorateTableBodyWithBulkSelect(tableEl);
    decorateTableFooterWithBulkSelect(tableEl);
}

function initUniversalTableBulkSelect() {
    if (bulkSelectInitialized) return;
    bulkSelectInitialized = true;

    const attachTable = (tableEl) => {
        if (!tableEl || tableEl.dataset.bulkSelectAttached === '1') return;
        const thead = tableEl.querySelector('thead');
        const tbody = tableEl.querySelector('tbody');
        const tfoot = tableEl.querySelector('tfoot');
        if (!thead || !tbody) return;

        tableEl.dataset.bulkSelectAttached = '1';
        let scheduled = false;
        const scheduleRefresh = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                refreshBulkSelectForTable(tableEl);
            });
        };

        const thObs = new MutationObserver(scheduleRefresh);
        thObs.observe(thead, { childList: true });
        const tbObs = new MutationObserver(scheduleRefresh);
        tbObs.observe(tbody, { childList: true });
        if (tfoot) {
            const tfObs = new MutationObserver(scheduleRefresh);
            tfObs.observe(tfoot, { childList: true });
        }

        refreshBulkSelectForTable(tableEl);
    };

    document.querySelectorAll('table').forEach(attachTable);
}
