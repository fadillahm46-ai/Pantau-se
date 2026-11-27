        /* =====================================================================
         * 11. ROSTER PERSONAL (KALENDER BULANAN + SETTINGAN UNIT PER TANGGAL)
         *     & ROSTER DAILY (3 FORMAT SIAP EDIT & SALIN — SINKRON ROSTER ALL)
         * ===================================================================== */

        const DAYS_FULL_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

        function getRosterUnitForDate(row, ymKey, dayNum) {
            if (!row) return '-';
            const overrideVal = row.unitByMonth?.[ymKey]?.[dayNum];
            if (overrideVal !== undefined && overrideVal !== null && String(overrideVal).trim() !== '') {
                return String(overrideVal).trim();
            }
            return String(row.unit || '-').trim() || '-';
        }

        function hasCustomRosterUnitForDate(row, ymKey, dayNum) {
            if (!row || !row.unitByMonth || !row.unitByMonth[ymKey]) return false;
            const overrideVal = row.unitByMonth[ymKey][dayNum];
            if (overrideVal === undefined || overrideVal === null || String(overrideVal).trim() === '') return false;
            const defaultUnit = String(row.unit || '-').trim() || '-';
            return normalizeUnitKey(overrideVal) !== normalizeUnitKey(defaultUnit);
        }

        function setRosterUnitForDate(row, ymKey, dayNum, unitVal) {
            if (!row) return;
            const clean = String(unitVal || '').trim();
            const defaultUnit = String(row.unit || '-').trim() || '-';
            if (!row.unitByMonth) row.unitByMonth = {};
            if (!row.unitByMonth[ymKey]) row.unitByMonth[ymKey] = {};

            if (!clean || normalizeUnitKey(clean) === normalizeUnitKey(defaultUnit)) {
                delete row.unitByMonth[ymKey][dayNum];
            } else {
                row.unitByMonth[ymKey][dayNum] = clean;
            }
        }

        function findManpowerForRosterRow(row) {
            if (!row) return null;
            const nrpKey = String(row.nrp || '').trim().toLowerCase();
            const nameKey = String(row.nama || '').trim().toLowerCase();
            return manpowerState.find(m =>
                (nrpKey && String(m.nrp || '').trim().toLowerCase() === nrpKey) ||
                (nameKey && String(m.nama || '').trim().toLowerCase() === nameKey)
            ) || null;
        }

        function findManpowerByName(rawName) {
            const clean = String(rawName || '').trim().toLowerCase();
            if (!clean) return null;
            return manpowerState.find(m => String(m.nama || '').trim().toLowerCase() === clean) || null;
        }

        function hasActivePermitTia(mp) {
            if (!mp || !mp.docs || !mp.docs.PERMIT_TIA) return false;
            const st = evaluateDocumentStatus('PERMIT_TIA', mp.docs.PERMIT_TIA);
            return st.level !== 'none' && st.level !== 'mati';
        }

        function formatDailyPhone(rawKontak) {
            const digits = String(rawKontak || '').replace(/[^0-9]/g, '');
            if (!digits) return '';
            return digits.startsWith('0') ? digits.slice(1) : digits;
        }

        function formatDailyPersonLine(nama, mp = null) {
            const cleanName = String(nama || '').trim();
            if (!cleanName) return '';
            const resolvedMp = mp || findManpowerByName(cleanName);
            const hasTia = hasActivePermitTia(resolvedMp);
            const alreadyTia = /\(\s*TIA\s*\)/i.test(cleanName);
            const nameOut = `${cleanName.toUpperCase()}${hasTia && !alreadyTia ? ' (TIA)' : ''}`;
            const phone = formatDailyPhone(resolvedMp?.kontak || '');
            return phone ? `${nameOut}\t${phone}` : nameOut;
        }

        function getRoleShortPrefix(jabatan) {
            const role = String(jabatan || '').trim().toLowerCase();
            if (role.includes('oilman')) return 'OM';
            if (role.includes('washing')) return 'WM';
            if (role.includes('rigger') || role.includes('helper')) return 'RGR';
            if (role.includes('group leader') || role === 'gl' || role.includes('pengawas')) return 'GL';
            if (role.includes('admin')) return 'ADM';
            if (role.includes('driver')) return 'DRV';
            return 'OPT';
        }

        function getPersonInitials(nama) {
            const parts = String(nama || '').trim().split(/\s+/).filter(Boolean);
            if (!parts.length) return 'SE';
            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }

        /* =====================================================================
         * 11A. ROSTER PERSONAL — KALENDER BULANAN PER PERSONIL
         * ===================================================================== */

        function populateRosterPersonalSelect(triggerRender = false) {
            const sel = document.getElementById('roster-personal-person');
            if (!sel) return;
            const query = (document.getElementById('roster-personal-search')?.value || '').trim().toLowerCase();
            const prevVal = sel.value;

            const filtered = rosterState.filter(r => {
                if (!query) return true;
                return `${r.nrp} ${r.nama} ${r.jabatan} ${r.unit}`.toLowerCase().includes(query);
            });

            if (!filtered.length) {
                sel.innerHTML = '<option value="">— Tidak ada personil di Roster —</option>';
                sel.value = '';
            } else {
                sel.innerHTML = filtered.map(r =>
                    `<option value="${Number(r.id)}">${escapeHtml(r.nama)} (${escapeHtml(r.nrp)}) — ${escapeHtml(r.jabatan || '-')}</option>`
                ).join('');
                if (prevVal && filtered.some(r => String(r.id) === String(prevVal))) {
                    sel.value = prevVal;
                } else {
                    sel.value = String(filtered[0].id);
                }
            }

            if (triggerRender) renderRosterPersonalCalendar();
        }

        function changeRosterPersonalMonth(delta) {
            const monthSel = document.getElementById('roster-personal-month');
            const yearSel = document.getElementById('roster-personal-year');
            if (!monthSel || !yearSel) return;

            let m = parseInt(monthSel.value, 10) + delta;
            let y = parseInt(yearSel.value, 10);
            if (m < 0) { m = 11; y -= 1; }
            if (m > 11) { m = 0; y += 1; }

            if (!Array.from(yearSel.options).some(o => Number(o.value) === y)) {
                const opt = document.createElement('option');
                opt.value = String(y);
                opt.textContent = String(y);
                yearSel.appendChild(opt);
            }
            monthSel.value = String(m);
            yearSel.value = String(y);
            renderRosterPersonalCalendar();
        }

        function renderRosterPersonalCalendar() {
            const gridEl = document.getElementById('roster-personal-calendar-grid');
            const profileEl = document.getElementById('roster-personal-profile-strip');
            if (!gridEl || !profileEl) return;

            populateRosterPersonalSelect(false);

            const personSel = document.getElementById('roster-personal-person');
            const rowId = Number(personSel?.value || 0);
            const row = rosterState.find(r => Number(r.id) === rowId) || rosterState[0] || null;
            const monthIdx = parseInt(document.getElementById('roster-personal-month')?.value ?? '10', 10);
            const year = parseInt(document.getElementById('roster-personal-year')?.value || '2026', 10);
            const ymKey = `${year}-${monthIdx}`;
            const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

            if (!row) {
                profileEl.innerHTML = '<p class="text-xs text-gray-400">Belum ada personil terdaftar pada Roster SE. Tambahkan personil di <strong>Roster ALL</strong> terlebih dahulu.</p>';
                gridEl.innerHTML = '<div class="col-span-7 py-12 text-center text-xs text-gray-400">Kalender kosong karena belum ada data personil Roster.</div>';
                return;
            }

            if (personSel && String(personSel.value) !== String(row.id)) {
                personSel.value = String(row.id);
            }

            const mp = findManpowerForRosterRow(row);
            const sched = row.scheduleByMonth?.[ymKey] || {};
            const offRaw = row.offDay || detectOffDayFromSchedule(year, monthIdx, sched, daysInMonth) || '-';
            const offLabel = typeof formatRosterOffDayShort === 'function' ? formatRosterOffDayShort(offRaw) : offRaw;
            const offFullTitle = typeof formatRosterOffDayLabel === 'function' ? formatRosterOffDayLabel(offRaw) : offRaw;

            let countDws = 0, countNws = 0, countOff = 0, countSpecial = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const code = String(sched[d] || '').trim().toUpperCase();
                if (code && code !== '-') {
                    const arti = resolveRosterCodeRule(code)?.artiSistem || '';
                    if (arti === 'SHIFT_1' || code.startsWith('D')) countDws++;
                    else if (arti === 'SHIFT_2' || code.startsWith('N')) countNws++;
                    else if (arti === 'LIBUR' || /^O+FF/.test(code)) countOff++;
                    else countSpecial++;
                }
            }

            const tiaBadge = hasActivePermitTia(mp)
                ? '<span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[9.5px] font-bold">PERMIT TIA</span>'
                : '';

            profileEl.innerHTML = `
                <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-11 h-11 rounded-xl bg-teal-500 text-white font-bold text-[13px] flex items-center justify-center shrink-0 shadow-xs">
                        ${escapeHtml(getPersonInitials(row.nama))}
                    </div>
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <h3 class="text-[15px] font-extrabold uppercase tracking-wide text-gray-900 truncate leading-tight">${escapeHtml(row.nama)}</h3>
                            <span class="font-mono text-[10px] px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 font-semibold">${escapeHtml(row.nrp)}</span>
                            ${tiaBadge}
                        </div>
                        <div class="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 mt-1">
                            <span><i class="fa-solid fa-briefcase mr-1 text-gray-400"></i>${escapeHtml(row.jabatan || '-')}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-truck-monster mr-1 text-teal-600"></i>Unit: <strong class="font-mono text-gray-700">${escapeHtml(row.unit || '-')}</strong></span>
                            <span>•</span>
                            <span title="${escapeHtml(offFullTitle)}"><i class="fa-solid fa-calendar-day mr-1 text-red-500"></i>Hari OFF: <strong class="text-red-700">${escapeHtml(offLabel)}</strong></span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    <div class="px-2.5 py-1 rounded-lg bg-white border border-gray-300 text-center">
                        <p class="text-xs font-extrabold font-mono text-gray-900">${countDws}</p>
                        <p class="text-[8.5px] font-semibold text-gray-600">Siang (D)</p>
                    </div>
                    <div class="px-2.5 py-1 rounded-lg bg-[#006740] border border-[#004A2E] text-center">
                        <p class="text-xs font-extrabold font-mono text-white">${countNws}</p>
                        <p class="text-[8.5px] font-semibold text-white/85">Malam (N)</p>
                    </div>
                    <div class="px-2.5 py-1 rounded-lg bg-[#FF0000] border border-[#CC0000] text-center">
                        <p class="text-xs font-extrabold font-mono text-white">${countOff}</p>
                        <p class="text-[8.5px] font-semibold text-white/90">OFF</p>
                    </div>
                    <div class="px-2.5 py-1 rounded-lg bg-[#00B0F0] border border-[#008EC4] text-center">
                        <p class="text-xs font-extrabold font-mono text-gray-950">${countSpecial}</p>
                        <p class="text-[8.5px] font-semibold text-gray-900">Cuti/Lain</p>
                    </div>
                </div>
            `;

            const firstDow = new Date(year, monthIdx, 1).getDay();
            const todayISO = getTodayISO();
            const cells = [];

            for (let i = 0; i < firstDow; i++) {
                cells.push('<div class="min-h-[112px] rounded-xl bg-gray-50/70 border border-dashed border-gray-200/80"></div>');
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateISO = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isToday = dateISO === todayISO;
                const dow = new Date(year, monthIdx, d).getDay();
                const isWeekend = dow === 0 || dow === 6;

                const code = String(sched[d] || '').trim().toUpperCase();
                const rule = code ? resolveRosterCodeRule(code) : null;
                const arti = rule?.artiSistem || '';
                const isWorkingShift = arti === 'SHIFT_1' || arti === 'SHIFT_2' || (code && (code.startsWith('D') || code.startsWith('N')));
                const isNonWork = Boolean(code) && !isWorkingShift;

                const unitForDay = String(row.unit || '-').trim() || '-';

                let cardBg = 'bg-white border-gray-300';
                let codeBadgeCls = 'bg-gray-100 text-gray-600';
                let dayInkCls = isWeekend ? 'text-red-600' : 'text-gray-900';
                let todayCircleCls = 'bg-[#007262] text-white';
                let todayRingCls = 'ring-2 ring-offset-2 ring-[#007262]';
                let unitPillCls = 'bg-teal-50 border border-teal-200 text-[#005A4D]';
                let unitIconCls = 'text-[#007262]';
                let isColoredCard = false;

                if (arti === 'LIBUR' || /^O+FF/.test(code)) {
                    cardBg = 'bg-[#FF0000] border-[#CC0000]';
                    codeBadgeCls = 'bg-black/25 text-white shadow-xs';
                    dayInkCls = 'text-white';
                    todayCircleCls = 'bg-white text-[#CC0000] ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#FF0000]';
                    unitPillCls = 'bg-white/90 border border-white/60 text-[#990000]';
                    unitIconCls = 'text-[#CC0000]';
                    isColoredCard = true;
                } else if (arti === 'CUTI' || code.startsWith('CCUTI') || code.startsWith('CUTI')) {
                    cardBg = 'bg-[#00B0F0] border-[#008EC4]';
                    codeBadgeCls = 'bg-gray-950/15 text-gray-950 shadow-xs';
                    dayInkCls = 'text-gray-950';
                    todayCircleCls = 'bg-gray-950 text-white ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#008EC4]';
                    unitPillCls = 'bg-white/85 border border-white/60 text-gray-950';
                    unitIconCls = 'text-[#0077A8]';
                    isColoredCard = true;
                } else if (arti === 'INDUKSI' || code.startsWith('INDK') || code.startsWith('INDUKSI')) {
                    cardBg = 'bg-[#FFC000] border-[#D9A300]';
                    codeBadgeCls = 'bg-gray-950/15 text-gray-950 shadow-xs';
                    dayInkCls = 'text-gray-950';
                    todayCircleCls = 'bg-gray-950 text-white ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#D9A300]';
                    unitPillCls = 'bg-white/85 border border-white/60 text-gray-950';
                    unitIconCls = 'text-[#B45309]';
                    isColoredCard = true;
                } else if (arti === 'MCU' || code.startsWith('MCU')) {
                    cardBg = 'bg-[#7030A0] border-[#532178]';
                    codeBadgeCls = 'bg-white/20 text-white shadow-xs';
                    dayInkCls = 'text-white';
                    todayCircleCls = 'bg-white text-[#7030A0] ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#7030A0]';
                    unitPillCls = 'bg-white/90 border border-white/60 text-[#4C1D95]';
                    unitIconCls = 'text-[#7030A0]';
                    isColoredCard = true;
                } else if (arti === 'TRAINING' || code.startsWith('TR')) {
                    cardBg = 'bg-[#FFFF00] border-[#D4C400]';
                    codeBadgeCls = 'bg-gray-950/15 text-gray-950 shadow-xs';
                    dayInkCls = 'text-gray-950';
                    todayCircleCls = 'bg-gray-950 text-white ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#CA8A04]';
                    unitPillCls = 'bg-white/85 border border-white/60 text-gray-950';
                    unitIconCls = 'text-[#A16207]';
                    isColoredCard = true;
                } else if (arti === 'SAKIT' || arti === 'IZIN') {
                    cardBg = 'bg-[#ED7D31] border-[#C6611E]';
                    codeBadgeCls = 'bg-black/20 text-white shadow-xs';
                    dayInkCls = 'text-white';
                    todayCircleCls = 'bg-white text-[#C6611E] ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#ED7D31]';
                    unitPillCls = 'bg-white/90 border border-white/60 text-[#9A3412]';
                    unitIconCls = 'text-[#C6611E]';
                    isColoredCard = true;
                } else if (arti === 'SHIFT_2' || code.startsWith('N')) {
                    cardBg = 'bg-[#006740] border-[#004A2E]';
                    codeBadgeCls = 'bg-white/20 text-white border border-white/25 shadow-xs';
                    dayInkCls = 'text-white';
                    todayCircleCls = 'bg-white text-[#006740] ring-2 ring-white/80';
                    todayRingCls = 'ring-2 ring-offset-2 ring-[#006740]';
                    unitPillCls = 'bg-white/90 border border-white/60 text-[#004A2E]';
                    unitIconCls = 'text-[#006740]';
                    isColoredCard = true;
                } else if (arti === 'SHIFT_1' || code.startsWith('D')) {
                    cardBg = 'bg-white border-gray-300 shadow-xs';
                    codeBadgeCls = 'bg-gray-100 border border-gray-300 text-gray-900';
                }

                const unitLabel = (!unitForDay || unitForDay === '-') ? 'Non-Unit' : unitForDay;
                const unitBadgeHtml = (!isColoredCard && isNonWork)
                    ? `
                        <div class="w-full px-2 py-1 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-gray-400 text-[12.5px] font-mono font-semibold flex items-center gap-1.5" title="Unit: ${escapeHtml(unitLabel)} (Non-Operasi)">
                            <i class="fa-solid fa-truck-monster text-[10px] shrink-0"></i>
                            <span class="truncate">${escapeHtml(unitLabel)}</span>
                        </div>
                    `
                    : `
                        <div class="w-full px-2 py-1 rounded-lg ${unitPillCls} text-[13px] font-mono font-bold flex items-center gap-1.5" title="${isNonWork ? `Unit: ${escapeHtml(unitLabel)} (Non-Operasi)` : `Settingan unit: ${escapeHtml(unitLabel)}`}">
                            <i class="fa-solid fa-truck-monster text-[11px] ${unitIconCls} shrink-0"></i>
                            <span class="truncate">${escapeHtml(unitLabel)}</span>
                        </div>
                    `;

                const dayNumCls = isToday
                    ? `w-8 h-8 rounded-full ${todayCircleCls} text-[15px] font-extrabold flex items-center justify-center shadow-sm`
                    : `text-[17px] ${dayInkCls} font-extrabold leading-none`;

                cells.push(`
                    <div data-cal-day="${d}" data-cal-code="${escapeHtml(code || '')}" class="min-h-[112px] p-2.5 rounded-xl border ${cardBg} ${isToday ? todayRingCls : ''} flex flex-col justify-between text-left select-none">
                        <div class="w-full flex items-center justify-between gap-1">
                            <span class="font-mono ${dayNumCls}">${d}</span>
                            <span class="inline-block px-2.5 py-0.5 rounded-lg font-mono text-[14px] font-extrabold tracking-wide ${codeBadgeCls}">
                                ${escapeHtml(code || '-')}
                            </span>
                        </div>
                        <div class="mt-2.5">
                            ${unitBadgeHtml}
                        </div>
                    </div>
                `);
            }

            const totalCells = firstDow + daysInMonth;
            const trailing = (7 - (totalCells % 7)) % 7;
            for (let i = 0; i < trailing; i++) {
                cells.push('<div class="min-h-[112px] rounded-xl bg-gray-50/70 border border-dashed border-gray-200/80"></div>');
            }

            gridEl.innerHTML = cells.join('');
        }

        /* =====================================================================
         * 11B. ROSTER DAILY — 3 FORMAT (LTWT, LIFTING, DRIVER) SINKRON ROSTER ALL
         *      - Format 1 (LTWT): OPT LT & WT, Oilman, Washingman (1 Unit = 1 OPT + 2 Helper)
         *      - Format 2 (Lifting): OPT Crane/Lifting, Lowboy, Rigger (1 Unit = 1 OPT + 2 Helper)
         *      - Format 3 (Driver): Driver (1 Unit = Hanya OPT)
         *      - Isi format bebas diedit (ubah no lambung unit, area, catatan) & disinkron ulang
         *      - Setiap nama otomatis menampilkan No WA di sebelah nama
         * ===================================================================== */

        const ROSTER_DAILY_FORMAT_META = {
            ltwt: {
                key: 'ltwt',
                label: 'Settingan LT & WT',
                title: 'UPDATE CREW SUPPORT EQUIPMENT LT & WT',
                divider: '---------------------🛠️ LUBE TRUCK & WATER TRUCK 🛠️---------------------',
                hint: 'OPT LT & WT, Oilman, Washingman • 1 Unit: 1 OPT + 2 Helper (OM/WM)',
                hasHelpers: true
            },
            lifting: {
                key: 'lifting',
                label: 'Settingan Lifting',
                title: 'UPDATE CREW SUPPORT EQUIPMENT LIFTING',
                divider: '---------------------🏗️ LIFTING (CRANE, LOWBOY & RIGGER) 🏗️---------------------',
                hint: 'OPT Crane/Lifting, Lowboy, Rigger • 1 Unit: 1 OPT + 2 Helper (RGR)',
                hasHelpers: true
            },
            driver: {
                key: 'driver',
                label: 'Settingan Driver',
                title: 'UPDATE CREW SUPPORT EQUIPMENT DRIVER',
                divider: '---------------------🚚 DRIVER SUPPORT EQUIPMENT 🚚---------------------',
                hint: 'Driver • 1 Unit: Hanya OPT (tanpa helper)',
                hasHelpers: false
            }
        };

        const DEFAULT_LTWT_UNIT_META = {
            'LTSE01': { zone: 'UTARA',  task: 'SCHEDULE + UNSCHEDULE + ALL AREA UTARA + DISP ELANG & GARUDA' },
            'WT2645': { zone: 'TENGAH', task: 'P1 COAL+NONCOAL+ UNSCHEDULE + ALL AREA TENGAH' }
        };

        const DEFAULT_OIL_STORAGE_BAYS = [
            { code: 'W1', area: 'WORKSHOP WHEEL 01 (BAY 1-4)', slots: 2 },
            { code: 'W2', area: 'WORKSHOP WHEEL 02 (BAY 5-8)', slots: 2 },
            { code: 'HL', area: '{WORKSHOP HAULING}',          slots: 2 },
            { code: 'PU', area: '{PITSTOP KGU UTARA}',         slots: 2 },
            { code: 'HU', area: '{PITSTOP HAULING KGU UTARA}', slots: 2 },
            { code: 'PT', area: '{PITSTOP KGU TENGAH}',        slots: 2 },
            { code: 'PR', area: '{PITSTOP TRACK KGU TENGAH}',  slots: 1 },
            { code: 'PS', area: '{PITSTOP KGU SELATAN}',       slots: 1 },
            { code: 'SP', area: '{WS SUPPORT TEMPORARY}',      slots: 1 },
            { code: 'TA', area: '{WS TRACK ASSEMBLING}',       slots: 2 }
        ];

        const DEFAULT_WASHPAD_BAYS = [
            { code: 'HS', area: '{WASHPAD HAULING & SUPPORT}', slots: 4 },
            { code: 'PU', area: '{WASHPAD PITSTOP UTARA}',     slots: 2 },
            { code: 'PT', area: '{WASHPAD PITSTOP TENGAH}',    slots: 2 },
            { code: 'PS', area: '{WASHPAD PITSTOP SELATAN}',   slots: 2 },
            { code: 'WB', area: '{WASHPAD WORKSHOP BARU}',     slots: 3 },
            { code: 'TF', area: '{WASHPAD TRACK-FMC-HAULING}', slots: 2 }
        ];

        const DEFAULT_DAILY_INDUKSI_LINK = 'intip.in/yangtidakinduksi';
        const DEFAULT_DAILY_NOTE = 'APABILA ADA PERMINTAAN DARI GL LAPANGAN & GRUP, LANGSUNG DI ACTION TANPA HARUS MENUNGGU INSTRUKSI.';

        const rosterDailyState = {
            activeFormat: 'ltwt', // 'ltwt' | 'lifting' | 'driver'
            templates: { ltwt: '', lifting: '', driver: '' },
            customized: { ltwt: false, lifting: false, driver: false },
            searchQuery: '',
            searchMatches: [],
            activeMatchIndex: -1
        };

        function getRosterDailyTargetDate() {
            const el = document.getElementById('roster-daily-date');
            let iso = el?.value || getTodayISO();
            if (el && !el.value) el.value = iso;
            const dObj = new Date(iso + 'T00:00:00');
            if (isNaN(dObj.getTime())) {
                const now = new Date();
                return {
                    iso: getTodayISO(),
                    year: now.getFullYear(),
                    monthIdx: now.getMonth(),
                    dayNum: now.getDate(),
                    ymKey: `${now.getFullYear()}-${now.getMonth()}`,
                    formatted: `${DAYS_FULL_ID[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES_ID[now.getMonth()]} ${now.getFullYear()}`
                };
            }
            return {
                iso,
                year: dObj.getFullYear(),
                monthIdx: dObj.getMonth(),
                dayNum: dObj.getDate(),
                ymKey: `${dObj.getFullYear()}-${dObj.getMonth()}`,
                formatted: `${DAYS_FULL_ID[dObj.getDay()]}, ${dObj.getDate()} ${MONTH_NAMES_ID[dObj.getMonth()]} ${dObj.getFullYear()}`
            };
        }

        function classifyRosterRoleForDailyFormat(jabatan, formatKey) {
            const j = String(jabatan || '').trim().toLowerCase();
            if (!j) return null;

            if (formatKey === 'ltwt') {
                if (matchesRosterSubMenu(j, 'operator-lt-wt')) return 'operator';
                if (matchesRosterSubMenu(j, 'oilman')) return 'oilman';
                if (matchesRosterSubMenu(j, 'washingman')) return 'washman';
                return null;
            }

            if (formatKey === 'lifting') {
                if (matchesRosterSubMenu(j, 'rigger-lowboy')) return 'helper';
                if (
                    matchesRosterSubMenu(j, 'operator-crane') ||
                    matchesRosterSubMenu(j, 'operator-telehandler') ||
                    matchesRosterSubMenu(j, 'operator-forklift') ||
                    matchesRosterSubMenu(j, 'operator-exca-dozer') ||
                    (j.includes('lowboy') && !j.includes('helper') && !j.includes('rigger'))
                ) {
                    return 'operator';
                }
                return null;
            }

            if (formatKey === 'driver') {
                if (matchesRosterSubMenu(j, 'driver-truck')) return 'operator';
                return null;
            }

            return null;
        }

        function normalizeHullKey(rawHull) {
            return normalizeUnitKey(String(rawHull || '').replace(/\.+$/, ''));
        }

        function collectRosterDailySnapshotForFormat(formatKey) {
            const dt = getRosterDailyTargetDate();
            const shiftCode = document.getElementById('roster-daily-shift')?.value || 'DWS';
            const targetArti = shiftCode === 'NWS' ? 'SHIFT_2' : 'SHIFT_1';

            const crewByUnit = {}; // { [hullKey]: { operators: [], oilmen: [], washmen: [], helpers: [] } }
            const standbyAuto = [];
            const tidakHadirAuto = [];
            const induksiAuto = [];

            rosterState.forEach(r => {
                const roleSlot = classifyRosterRoleForDailyFormat(r.jabatan, formatKey);
                if (!roleSlot) return;

                const sched = r.scheduleByMonth?.[dt.ymKey] || {};
                const rawCode = String(sched[dt.dayNum] || '').trim().toUpperCase();
                if (!rawCode || rawCode === '-') return;

                const rule = resolveRosterCodeRule(rawCode);
                const arti = rule?.artiSistem || '';
                const mp = findManpowerForRosterRow(r);
                const prefix = getRoleShortPrefix(r.jabatan);
                const personLine = formatDailyPersonLine(r.nama, mp);

                if (arti === 'INDUKSI' || rawCode.startsWith('INDK')) {
                    induksiAuto.push(`${prefix}_${personLine}`);
                    return;
                }

                if (['CUTI', 'MCU', 'TRAINING', 'SAKIT', 'IZIN'].includes(arti)) {
                    const reasonLabel = rule?.kode || rawCode;
                    tidakHadirAuto.push(`${prefix}_${personLine} (${reasonLabel})`);
                    return;
                }

                if (arti !== targetArti) return;

                const unitOnDay = getRosterUnitForDate(r, dt.ymKey, dt.dayNum);
                const cleanUnit = String(unitOnDay || '').trim();

                if (!cleanUnit || cleanUnit === '-') {
                    standbyAuto.push(`${prefix}_${personLine}`);
                    return;
                }

                const uKey = normalizeHullKey(cleanUnit);
                if (!crewByUnit[uKey]) {
                    crewByUnit[uKey] = { operators: [], oilmen: [], washmen: [], helpers: [] };
                }

                const entry = { row: r, mp, line: personLine };
                if (roleSlot === 'operator') {
                    crewByUnit[uKey].operators.push(entry);
                } else if (roleSlot === 'oilman') {
                    crewByUnit[uKey].oilmen.push(entry);
                    crewByUnit[uKey].helpers.push(entry);
                } else if (roleSlot === 'washman') {
                    crewByUnit[uKey].washmen.push(entry);
                    crewByUnit[uKey].helpers.push(entry);
                } else if (roleSlot === 'helper') {
                    crewByUnit[uKey].helpers.push(entry);
                }
            });

            return { dt, shiftCode, crewByUnit, standbyAuto, tidakHadirAuto, induksiAuto };
        }

        function getDefaultUnitsForDailyFormat(formatKey, dt) {
            const seen = new Set();
            const units = [];
            const pushUnit = (noUnit, modelTipe = '') => {
                const cleanNo = String(noUnit || '').trim();
                if (!cleanNo || cleanNo === '-') return;
                const uKey = normalizeHullKey(cleanNo);
                if (!uKey || seen.has(uKey)) return;
                seen.add(uKey);
                units.push({ no_unit: cleanNo, uKey, model_tipe: String(modelTipe || '').trim() });
            };

            if (formatKey === 'ltwt') {
                komisioningState.forEach(u => {
                    if (getUnitCategoryGroup(u.no_unit, u.model_tipe, u.kategori_unit) === 'lt_wt') {
                        pushUnit(u.no_unit, u.model_tipe);
                    }
                });
            } else if (formatKey === 'lifting') {
                komisioningState.forEach(u => {
                    if (getUnitCategoryGroup(u.no_unit, u.model_tipe, u.kategori_unit) === 'lifting') {
                        pushUnit(u.no_unit, u.model_tipe);
                    }
                });
            } else if (formatKey === 'driver') {
                komisioningState.forEach(u => {
                    const txt = `${u.no_unit || ''} ${u.model_tipe || ''}`.toLowerCase();
                    if (/dump\s*truck|lowboy|flatbed|hiab|prime\s*mover|trailer/.test(txt) || /^(dt|lb|ft|tr)[\s\-0-9]/i.test(String(u.no_unit || '').trim())) {
                        pushUnit(u.no_unit, u.model_tipe);
                    }
                });
            }

            // Tambahkan unit apa pun yang sedang dipakai di Roster ALL untuk kategori format ini
            rosterState.forEach(r => {
                if (!classifyRosterRoleForDailyFormat(r.jabatan, formatKey)) return;
                const uDay = dt ? getRosterUnitForDate(r, dt.ymKey, dt.dayNum) : (r.unit || '-');
                if (!uDay || uDay === '-') return;
                const master = komisioningState.find(u => normalizeHullKey(u.no_unit) === normalizeHullKey(uDay));
                pushUnit(master?.no_unit || uDay, master?.model_tipe || '');
            });

            return units;
        }

        function appendKeteranganAndNoteLines(lines, standbyAuto, tidakHadirAuto, induksiAuto) {
            lines.push('--------------------- 📢 KETERANGAN 📢 --------------------');
            lines.push('A.\tSTANDBY');
            const standbyRows = Math.max(2, standbyAuto.length);
            for (let i = 0; i < standbyRows; i++) {
                lines.push(`${i + 1}\t${standbyAuto[i] || ''}`);
            }
            lines.push('');

            lines.push('B.\tTIDAK HADIR');
            const absentRows = Math.max(2, tidakHadirAuto.length);
            for (let i = 0; i < absentRows; i++) {
                lines.push(`${i + 1}\t${tidakHadirAuto[i] || ''}`);
            }
            lines.push('');

            lines.push(`D.\tINDUKSI\t{BAGI YANG INDUKSI WAJIB ISI LINK: ${DEFAULT_DAILY_INDUKSI_LINK}}`);
            const induksiRows = Math.max(2, induksiAuto.length);
            for (let i = 0; i < induksiRows; i++) {
                lines.push(`${i + 1}\t${induksiAuto[i] || ''}`);
            }
            lines.push('');

            lines.push('NOTE:');
            lines.push(DEFAULT_DAILY_NOTE);
        }

        function buildDefaultRosterDailyTemplate(formatKey) {
            const meta = ROSTER_DAILY_FORMAT_META[formatKey] || ROSTER_DAILY_FORMAT_META.ltwt;
            const { dt, shiftCode, crewByUnit, standbyAuto, tidakHadirAuto, induksiAuto } = collectRosterDailySnapshotForFormat(formatKey);
            const spi = getKodeSpiForMonth(dt.year, dt.monthIdx);
            const units = getDefaultUnitsForDailyFormat(formatKey, dt);

            const lines = [];
            lines.push(`🌟${meta.title}🌟`);
            lines.push('');
            lines.push(`🗓️\tDATE:\t${dt.formatted}`);
            lines.push(`⏰\tSHIFT:\t${shiftCode}`);
            lines.push('');
            lines.push('KODE SPI');
            lines.push(`PENGAWAS :\t\t${spi.kodePengawas}`);
            lines.push(`OPERATOR :\t\t${spi.kodeOperator}`);
            lines.push('');
            lines.push(meta.divider);

            if (formatKey === 'ltwt') {
                const zones = [
                    { key: 'UTARA',   header: '🟦 KGU UTARA 🟦' },
                    { key: 'TENGAH',  header: '🟨 KGU TENGAH 🟨' },
                    { key: 'SELATAN', header: '🟧 KGU SELATAN 🟧' }
                ];
                let zoneCount = 0;
                zones.forEach(z => {
                    const zUnits = units.filter(u => {
                        const defZone = DEFAULT_LTWT_UNIT_META[u.uKey]?.zone || 'UTARA';
                        return defZone === z.key;
                    });
                    if (!zUnits.length) return;
                    if (zoneCount > 0) lines.push('-------------------------------------------------------------------------------');
                    lines.push(z.header);
                    zoneCount++;

                    zUnits.forEach(u => {
                        const crew = crewByUnit[u.uKey] || { operators: [], oilmen: [], washmen: [], helpers: [] };
                        const isWt = /^wt/i.test(u.no_unit) || /water/i.test(u.model_tipe || '');
                        const task = DEFAULT_LTWT_UNIT_META[u.uKey]?.task || (isWt ? 'P1 COAL+NONCOAL+ UNSCHEDULE + ALL AREA' : 'SCHEDULE + UNSCHEDULE + ALL AREA');
                        lines.push(`▪️\t${u.no_unit}\t{${task}}`);
                        lines.push(`OPT:\t${crew.operators[0]?.line || ''}`);
                        if (isWt) {
                            lines.push(`WM1:\t${crew.washmen[0]?.line || ''}`);
                            lines.push(`WM2:\t${crew.washmen[1]?.line || ''}`);
                        } else {
                            lines.push(`OM1:\t${crew.oilmen[0]?.line || ''}`);
                            lines.push(`OM2:\t${crew.oilmen[1]?.line || ''}`);
                        }
                        lines.push('');
                    });
                });

                if (zoneCount === 0) {
                    lines.push('🟦 KGU UTARA 🟦');
                    lines.push('▪️\tLT-01\t{SCHEDULE + UNSCHEDULE + ALL AREA UTARA}');
                    lines.push('OPT:\t');
                    lines.push('OM1:\t');
                    lines.push('OM2:\t');
                    lines.push('');
                }

                lines.push('----------------------🛢️ OIL STORAGE 🛢️---------------------');
                lines.push('');
                DEFAULT_OIL_STORAGE_BAYS.forEach(bay => {
                    const bayCrew = crewByUnit[normalizeHullKey(bay.code)]?.oilmen || [];
                    lines.push(`▪️\t${bay.code}\t${bay.area}`);
                    for (let i = 0; i < bay.slots; i++) {
                        lines.push(`OM${i + 1}:\t${bayCrew[i]?.line || ''}`);
                    }
                    lines.push('');
                });

                lines.push('----------------------🛢️ WASHPAD 🛢️---------------------');
                lines.push('');
                DEFAULT_WASHPAD_BAYS.forEach(bay => {
                    const bayCrew = crewByUnit[normalizeHullKey(bay.code)]?.washmen || [];
                    lines.push(`▪️\t${bay.code}\t${bay.area}`);
                    for (let i = 0; i < bay.slots; i++) {
                        lines.push(`WM${i + 1}:\t${bayCrew[i]?.line || ''}`);
                    }
                    lines.push('');
                });
            } else if (formatKey === 'lifting') {
                if (!units.length) {
                    lines.push('▪️\tCR-01\t{LIFTING SUPPORT ALL AREA}');
                    lines.push('OPT:\t');
                    lines.push('RGR1:\t');
                    lines.push('RGR2:\t');
                    lines.push('');
                } else {
                    units.forEach(u => {
                        const crew = crewByUnit[u.uKey] || { operators: [], helpers: [] };
                        const desc = u.model_tipe ? `{${u.model_tipe.toUpperCase()}}` : '{LIFTING SUPPORT}';
                        lines.push(`▪️\t${u.no_unit}\t${desc}`);
                        lines.push(`OPT:\t${crew.operators[0]?.line || ''}`);
                        lines.push(`RGR1:\t${crew.helpers[0]?.line || ''}`);
                        lines.push(`RGR2:\t${crew.helpers[1]?.line || ''}`);
                        lines.push('');
                    });
                }
            } else if (formatKey === 'driver') {
                if (!units.length) {
                    lines.push('▪️\tDT-01\t{SUPPORT HAULING}');
                    lines.push('OPT:\t');
                    lines.push('');
                } else {
                    units.forEach(u => {
                        const crew = crewByUnit[u.uKey] || { operators: [] };
                        const desc = u.model_tipe ? `{${u.model_tipe.toUpperCase()}}` : '{DRIVER SUPPORT}';
                        lines.push(`▪️\t${u.no_unit}\t${desc}`);
                        lines.push(`OPT:\t${crew.operators[0]?.line || ''}`);
                        lines.push('');
                    });
                }
            }

            appendKeteranganAndNoteLines(lines, standbyAuto, tidakHadirAuto, induksiAuto);
            return lines.join('\n');
        }

        /**
         * Menyinkronkan teks format yang sudah diedit user dengan Roster ALL, Data Manpower (No WA),
         * dan Master Kode SPI berdasarkan NO LAMBUNG UNIT yang tertulis pada format.
         */
        function syncTemplateTextWithRoster(templateText, formatKey) {
            const { dt, shiftCode, crewByUnit, standbyAuto, tidakHadirAuto, induksiAuto } = collectRosterDailySnapshotForFormat(formatKey);
            const spi = getKodeSpiForMonth(dt.year, dt.monthIdx);

            const rawLines = String(templateText || '').replace(/\r\n/g, '\n').split('\n');
            const out = [];

            let section = 'units'; // 'units' | 'oil' | 'wash' | 'keterangan' | 'note'
            let currentUnitKey = null;
            let optCounter = 0;
            let helperCounter = 0;

            for (let i = 0; i < rawLines.length; i++) {
                const line = rawLines[i];

                // Update Tanggal, Shift, & Kode SPI
                if (/DATE\s*:/i.test(line)) {
                    out.push(`🗓️\tDATE:\t${dt.formatted}`);
                    continue;
                }
                if (/SHIFT\s*:/i.test(line)) {
                    out.push(`⏰\tSHIFT:\t${shiftCode}`);
                    continue;
                }
                if (/^\s*PENGAWAS\s*:/i.test(line)) {
                    out.push(`PENGAWAS :\t\t${spi.kodePengawas}`);
                    continue;
                }
                if (/^\s*OPERATOR\s*:/i.test(line)) {
                    out.push(`OPERATOR :\t\t${spi.kodeOperator}`);
                    continue;
                }

                // Deteksi perpindahan seksi
                if (/OIL\s+STORAGE/i.test(line) && /---/.test(line)) {
                    section = 'oil';
                    currentUnitKey = null;
                    out.push(line);
                    continue;
                }
                if (/WASHPAD/i.test(line) && /---/.test(line)) {
                    section = 'wash';
                    currentUnitKey = null;
                    out.push(line);
                    continue;
                }
                if (/KETERANGAN/i.test(line) && /---/.test(line)) {
                    section = 'keterangan';
                    currentUnitKey = null;
                    out.push(line);
                    continue;
                }
                if (/^\s*NOTE\s*:/i.test(line)) {
                    section = 'note';
                    currentUnitKey = null;
                    out.push(line);
                    continue;
                }

                // Seksi KETERANGAN: A. STANDBY, B. TIDAK HADIR, D. INDUKSI
                if (section === 'keterangan') {
                    let targetList = null;
                    if (/^\s*A\.\s*STANDBY/i.test(line)) targetList = standbyAuto;
                    else if (/^\s*B\.\s*TIDAK\s+HADIR/i.test(line)) targetList = tidakHadirAuto;
                    else if (/^\s*D\.\s*INDUKSI/i.test(line)) targetList = induksiAuto;

                    if (targetList !== null) {
                        out.push(line);
                        // Lewati baris bernomor lama di bawah sub-seksi ini
                        while (i + 1 < rawLines.length && /^\s*\d+\s*(?:\t.*|\s+.*)?$/.test(rawLines[i + 1])) {
                            i++;
                        }
                        const rowCount = Math.max(2, targetList.length);
                        for (let k = 0; k < rowCount; k++) {
                            out.push(`${k + 1}\t${targetList[k] || ''}`);
                        }
                        continue;
                    }

                    out.push(line);
                    continue;
                }

                if (section === 'note') {
                    out.push(line);
                    continue;
                }

                // Deteksi baris NO LAMBUNG UNIT / BAY (mis. "▪️	LT-SE-01	{...}" atau "▪️	CR-80A	{...}")
                const unitMatch = line.match(/^\s*(?:▪️|▪|•|-\s+)\s*([A-Za-z0-9][A-Za-z0-9._-]*)/);
                if (unitMatch) {
                    currentUnitKey = normalizeHullKey(unitMatch[1]);
                    optCounter = 0;
                    helperCounter = 0;
                    out.push(line);
                    continue;
                }

                // Reset unit saat baris pemisah zona
                if (/^-{5,}/.test(line.trim())) {
                    currentUnitKey = null;
                    out.push(line);
                    continue;
                }

                // Isi baris OPT: berdasarkan NO LAMBUNG UNIT dari Roster ALL
                const optMatch = line.match(/^(\s*OPT\s*:)/i);
                if (optMatch && currentUnitKey && section === 'units') {
                    const crew = crewByUnit[currentUnitKey] || { operators: [] };
                    const entry = crew.operators[optCounter];
                    optCounter++;
                    out.push(`${optMatch[1]}\t${entry?.line || ''}`);
                    continue;
                }

                // Isi baris Helper 1 & Helper 2 (OM1/OM2, WM1/WM2, RGR1/RGR2, HLP1/HLP2)
                const helperMatch = line.match(/^(\s*(OM|WM|RGR|HLP|HELPER)(\d*)\s*:)(.*)$/i);
                if (helperMatch && currentUnitKey) {
                    const prefix = helperMatch[1];
                    const roleTag = helperMatch[2].toUpperCase();
                    const slotNum = parseInt(helperMatch[3], 10);
                    const slotIdx = !isNaN(slotNum) && slotNum >= 1 ? (slotNum - 1) : helperCounter;
                    helperCounter++;

                    const crew = crewByUnit[currentUnitKey] || { oilmen: [], washmen: [], helpers: [] };
                    if (section === 'units') {
                        if (formatKey === 'driver') {
                            out.push(line);
                        } else if (formatKey === 'ltwt') {
                            let entry = null;
                            if (roleTag === 'OM') entry = crew.oilmen[slotIdx] || null;
                            else if (roleTag === 'WM') entry = crew.washmen[slotIdx] || null;
                            else entry = crew.helpers[slotIdx] || null;
                            out.push(`${prefix}\t${entry?.line || ''}`);
                        } else {
                            const entry = crew.helpers[slotIdx] || null;
                            out.push(`${prefix}\t${entry?.line || ''}`);
                        }
                        continue;
                    } else if (section === 'oil' || section === 'wash') {
                        const list = section === 'oil' ? (crew.oilmen || []) : (crew.washmen || []);
                        const entry = list[slotIdx] || null;
                        if (entry) {
                            out.push(`${prefix}\t${entry.line}`);
                        } else {
                            // Pertahankan isian manual user pada Oil Storage / Washpad jika tidak ada di Roster ALL
                            out.push(line);
                        }
                        continue;
                    }
                }

                out.push(line);
            }

            return out.join('\n');
        }

        function updateRosterDailyUiMeta(isManualEdit = false) {
            const fmt = rosterDailyState.activeFormat || 'ltwt';
            const meta = ROSTER_DAILY_FORMAT_META[fmt] || ROSTER_DAILY_FORMAT_META.ltwt;
            const dt = getRosterDailyTargetDate();
            const shiftCode = document.getElementById('roster-daily-shift')?.value || 'DWS';
            const spi = getKodeSpiForMonth(dt.year, dt.monthIdx);

            // Perbarui tab aktif 3 format
            document.querySelectorAll('.roster-daily-format-btn').forEach(btn => {
                const isAct = btn.getAttribute('data-daily-format') === fmt;
                btn.className = isAct
                    ? 'roster-daily-format-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-teal-600 shadow-sm transition-all inline-flex items-center gap-1.5'
                    : 'roster-daily-format-btn px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-800 transition-all inline-flex items-center gap-1.5';
            });

            const hintEl = document.getElementById('roster-daily-format-hint');
            if (hintEl) hintEl.textContent = meta.hint;

            const spiTextEl = document.getElementById('roster-daily-spi-pill-text');
            if (spiTextEl) {
                spiTextEl.textContent = `SPI ${MONTH_SHORT_ID[dt.monthIdx]}: ${spi.kodePengawas} / ${spi.kodeOperator}`;
            }

            const textarea = document.getElementById('roster-daily-preview');
            const metaEl = document.getElementById('roster-daily-preview-meta');
            if (metaEl && textarea) {
                const lineCount = textarea.value.split('\n').length;
                metaEl.textContent = `${meta.label} • ${dt.formatted} • Shift ${shiftCode} • ${lineCount} baris`;
            }

            const badgeEl = document.getElementById('roster-daily-sync-badge');
            if (badgeEl) {
                if (isManualEdit) {
                    badgeEl.className = 'px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold';
                    badgeEl.textContent = 'Diedit Manual';
                } else {
                    badgeEl.className = 'px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold';
                    badgeEl.textContent = 'Sinkron Roster ALL';
                }
            }
        }

        function renderRosterDailyView() {
            const textarea = document.getElementById('roster-daily-preview');
            if (!textarea) return;

            const fmt = rosterDailyState.activeFormat || 'ltwt';
            if (!rosterDailyState.customized[fmt] || !rosterDailyState.templates[fmt]) {
                rosterDailyState.templates[fmt] = buildDefaultRosterDailyTemplate(fmt);
            } else {
                rosterDailyState.templates[fmt] = syncTemplateTextWithRoster(rosterDailyState.templates[fmt], fmt);
            }

            textarea.value = rosterDailyState.templates[fmt];
            updateRosterDailyUiMeta(false);
            refreshRosterDailySearch(false);
        }

        function switchRosterDailyFormat(formatKey) {
            if (!ROSTER_DAILY_FORMAT_META[formatKey]) return;
            const textarea = document.getElementById('roster-daily-preview');
            if (textarea && rosterDailyState.activeFormat) {
                rosterDailyState.templates[rosterDailyState.activeFormat] = textarea.value;
            }
            rosterDailyState.activeFormat = formatKey;
            renderRosterDailyView();
        }

        function onRosterDailyControlChange() {
            const textarea = document.getElementById('roster-daily-preview');
            if (textarea && rosterDailyState.customized[rosterDailyState.activeFormat]) {
                rosterDailyState.templates[rosterDailyState.activeFormat] = textarea.value;
            }
            renderRosterDailyView();
        }

        function onRosterDailyPreviewManualEdit() {
            const textarea = document.getElementById('roster-daily-preview');
            if (!textarea) return;
            const fmt = rosterDailyState.activeFormat || 'ltwt';
            rosterDailyState.templates[fmt] = textarea.value;
            rosterDailyState.customized[fmt] = true;
            updateRosterDailyUiMeta(true);
            refreshRosterDailySearch(false);
        }

        function syncRosterDailyFromRoster(showFeedback = false) {
            const textarea = document.getElementById('roster-daily-preview');
            const fmt = rosterDailyState.activeFormat || 'ltwt';
            if (textarea && textarea.value.trim()) {
                rosterDailyState.templates[fmt] = syncTemplateTextWithRoster(textarea.value, fmt);
            } else {
                rosterDailyState.templates[fmt] = buildDefaultRosterDailyTemplate(fmt);
                rosterDailyState.customized[fmt] = false;
            }
            if (textarea) textarea.value = rosterDailyState.templates[fmt];
            updateRosterDailyUiMeta(false);
            refreshRosterDailySearch(false);
            if (showFeedback) {
                const label = ROSTER_DAILY_FORMAT_META[fmt]?.label || 'Roster Daily';
                showToast(`${label} disinkronkan dari Roster ALL & Master Kode SPI berdasarkan no lambung unit.`, 'success');
            }
        }

        function resetRosterDailyTemplate() {
            const fmt = rosterDailyState.activeFormat || 'ltwt';
            rosterDailyState.customized[fmt] = false;
            rosterDailyState.templates[fmt] = buildDefaultRosterDailyTemplate(fmt);
            const textarea = document.getElementById('roster-daily-preview');
            if (textarea) textarea.value = rosterDailyState.templates[fmt];
            updateRosterDailyUiMeta(false);
            refreshRosterDailySearch(false);
            const label = ROSTER_DAILY_FORMAT_META[fmt]?.label || 'Roster Daily';
            showToast(`Template ${label} dikembalikan ke susunan default dari Master Unit & Roster ALL.`, 'info');
        }

        /* =====================================================================
         * PENCARIAN CEPAT ROSTER DAILY (DALAM TAB AKTIF & LINTAS 3 FORMAT)
         * ===================================================================== */
        function buildRosterDailySearchRegex(query) {
            const clean = String(query || '').trim();
            if (!clean) return null;
            const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = escaped.replace(/[\s-]+/g, '[\\s-]+');
            return new RegExp(pattern, 'gi');
        }

        function getRosterDailyTextForFormat(fmt) {
            if (fmt === rosterDailyState.activeFormat) {
                const ta = document.getElementById('roster-daily-preview');
                if (ta) return ta.value || '';
            }
            if (rosterDailyState.customized[fmt] && rosterDailyState.templates[fmt]) {
                return syncTemplateTextWithRoster(rosterDailyState.templates[fmt], fmt);
            }
            return buildDefaultRosterDailyTemplate(fmt);
        }

        function findRosterDailyMatchesInText(text, query) {
            const regex = buildRosterDailySearchRegex(query);
            if (!regex) return [];

            const normalized = String(text || '').replace(/\r\n/g, '\n');
            const lines = normalized.split('\n');
            const matches = [];
            let charOffset = 0;
            let currentContext = '';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Catat konteks unit / seksi agar hasil pencarian nama langsung menampilkan unitnya
                const unitMatch = line.match(/^\s*(?:▪️|▪|•|-\s+)\s*([A-Za-z0-9][A-Za-z0-9._\-\s]{0,20}?)(?:\t|\s*\{|$)/);
                if (unitMatch) {
                    currentContext = unitMatch[1].trim();
                } else if (/^\s*A\.\s*STANDBY/i.test(line)) {
                    currentContext = 'STANDBY';
                } else if (/^\s*B\.\s*TIDAK\s+HADIR/i.test(line)) {
                    currentContext = 'TIDAK HADIR';
                } else if (/^\s*D\.\s*INDUKSI/i.test(line)) {
                    currentContext = 'INDUKSI';
                } else if (/OIL\s+STORAGE/i.test(line) && /---/.test(line)) {
                    currentContext = 'OIL STORAGE';
                } else if (/WASHPAD/i.test(line) && /---/.test(line)) {
                    currentContext = 'WASHPAD';
                } else if (/^-{5,}/.test(line.trim())) {
                    currentContext = '';
                }

                regex.lastIndex = 0;
                let m;
                while ((m = regex.exec(line)) !== null) {
                    if (!m[0]) break;
                    matches.push({
                        start: charOffset + m.index,
                        end: charOffset + m.index + m[0].length,
                        lineIndex: i,
                        lineNum: i + 1,
                        lineText: line,
                        matchStartInLine: m.index,
                        matchEndInLine: m.index + m[0].length,
                        context: currentContext
                    });
                }

                charOffset += line.length + 1;
            }

            return matches;
        }

        function scrollRosterDailyTextareaToMatch(match, shouldFocus = false) {
            const textarea = document.getElementById('roster-daily-preview');
            if (!textarea || !match) return;

            const style = window.getComputedStyle(textarea);
            const lineHeight = parseFloat(style.lineHeight) || 20;
            const paddingTop = parseFloat(style.paddingTop) || 20;
            const targetTop = Math.max(0, paddingTop + match.lineIndex * lineHeight - textarea.clientHeight * 0.35);

            if (shouldFocus) {
                textarea.focus();
                textarea.setSelectionRange(match.start, match.end);
            }
            textarea.scrollTop = targetTop;
        }

        function highlightRosterDailyLineHtml(lineText, matchStart, matchEnd) {
            const raw = String(lineText || '');
            const before = escapeHtml(raw.slice(0, matchStart));
            const hit = escapeHtml(raw.slice(matchStart, matchEnd));
            const after = escapeHtml(raw.slice(matchEnd));
            return `${before}<mark class="bg-yellow-200 text-gray-900 font-bold rounded px-0.5">${hit}</mark>${after}`;
        }

        function refreshRosterDailySearch(autoScroll = true) {
            const inputEl = document.getElementById('roster-daily-search');
            const clearBtn = document.getElementById('roster-daily-search-clear');
            const controlsEl = document.getElementById('roster-daily-search-controls');
            const countEl = document.getElementById('roster-daily-search-count');
            const resultsEl = document.getElementById('roster-daily-search-results');

            const query = String(inputEl?.value ?? rosterDailyState.searchQuery ?? '').trim();
            rosterDailyState.searchQuery = query;

            if (!query) {
                rosterDailyState.searchMatches = [];
                rosterDailyState.activeMatchIndex = -1;
                if (clearBtn) clearBtn.classList.add('hidden');
                if (controlsEl) {
                    controlsEl.classList.add('hidden');
                    controlsEl.classList.remove('inline-flex');
                }
                if (resultsEl) {
                    resultsEl.classList.add('hidden');
                    resultsEl.innerHTML = '';
                }
                return;
            }

            if (clearBtn) clearBtn.classList.remove('hidden');
            if (controlsEl) {
                controlsEl.classList.remove('hidden');
                controlsEl.classList.add('inline-flex');
            }

            const activeFmt = rosterDailyState.activeFormat || 'ltwt';
            const activeText = getRosterDailyTextForFormat(activeFmt);
            const matches = findRosterDailyMatchesInText(activeText, query);
            rosterDailyState.searchMatches = matches;

            if (!matches.length) {
                rosterDailyState.activeMatchIndex = -1;
            } else if (rosterDailyState.activeMatchIndex < 0 || rosterDailyState.activeMatchIndex >= matches.length) {
                rosterDailyState.activeMatchIndex = 0;
            }

            // Cek kecocokan di 2 tab format lainnya
            const otherFormatHits = Object.keys(ROSTER_DAILY_FORMAT_META)
                .filter(k => k !== activeFmt)
                .map(k => {
                    const hitList = findRosterDailyMatchesInText(getRosterDailyTextForFormat(k), query);
                    return { key: k, label: ROSTER_DAILY_FORMAT_META[k].label, count: hitList.length };
                })
                .filter(x => x.count > 0);

            if (countEl) {
                if (matches.length > 0) {
                    countEl.className = 'px-2 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold font-mono';
                    countEl.textContent = `${rosterDailyState.activeMatchIndex + 1} / ${matches.length}`;
                } else if (otherFormatHits.length > 0) {
                    countEl.className = 'px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold';
                    countEl.textContent = 'Di tab lain';
                } else {
                    countEl.className = 'px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold';
                    countEl.textContent = '0 hasil';
                }
            }

            if (resultsEl) {
                const otherPillsHtml = otherFormatHits.length
                    ? `<div class="px-3.5 py-1.5 bg-amber-50/80 border-b border-amber-100 flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span class="font-semibold text-amber-800">Ditemukan di tab lain:</span>
                            ${otherFormatHits.map(o => `
                                <button type="button" onclick="switchRosterDailyFormatFromSearch('${o.key}')"
                                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white hover:bg-teal-500 text-amber-800 hover:text-white border border-amber-200 hover:border-teal-500 font-semibold transition-colors">
                                    <span>${escapeHtml(o.label)}</span>
                                    <span class="font-mono">(${o.count})</span>
                                </button>
                            `).join('')}
                       </div>`
                    : '';

                let rowsHtml = '';
                if (matches.length > 0) {
                    rowsHtml = `<div class="divide-y divide-gray-100">
                        ${matches.map((m, idx) => {
                            const isAct = idx === rosterDailyState.activeMatchIndex;
                            const ctxBadge = m.context
                                ? `<span class="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold font-mono shrink-0">${escapeHtml(m.context)}</span>`
                                : '';
                            return `
                                <button type="button" onclick="jumpToRosterDailySearchMatch(${idx})"
                                    data-daily-match-idx="${idx}"
                                    class="w-full text-left px-3.5 py-1.5 flex items-center gap-2 hover:bg-teal-50/70 transition-colors ${isAct ? 'bg-teal-50/90' : 'bg-white'}">
                                    <span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-mono font-semibold shrink-0">Brs ${m.lineNum}</span>
                                    ${ctxBadge}
                                    <span class="font-mono text-[11px] text-gray-800 truncate">${highlightRosterDailyLineHtml(m.lineText.trim(), Math.max(0, m.matchStartInLine - (m.lineText.length - m.lineText.trimStart().length)), Math.max(0, m.matchEndInLine - (m.lineText.length - m.lineText.trimStart().length)))}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>`;
                } else if (!otherFormatHits.length) {
                    rowsHtml = `<div class="px-3.5 py-2.5 text-center text-[11px] text-gray-500">
                        Tidak ada hasil untuk "<strong class="text-gray-700">${escapeHtml(query)}</strong>" di seluruh format Roster Daily.
                    </div>`;
                }

                resultsEl.innerHTML = `${otherPillsHtml}${rowsHtml}`;
                resultsEl.classList.remove('hidden');
            }

            if (autoScroll && matches.length > 0 && rosterDailyState.activeMatchIndex >= 0) {
                scrollRosterDailyTextareaToMatch(matches[rosterDailyState.activeMatchIndex], false);
            }
        }

        function onRosterDailySearchInput() {
            rosterDailyState.activeMatchIndex = 0;
            refreshRosterDailySearch(true);
        }

        function navigateRosterDailySearchMatch(delta, focusTextarea = false) {
            const matches = rosterDailyState.searchMatches || [];
            if (!matches.length) return;
            const nextIdx = (rosterDailyState.activeMatchIndex + delta + matches.length) % matches.length;
            rosterDailyState.activeMatchIndex = nextIdx;
            refreshRosterDailySearch(false);
            scrollRosterDailyTextareaToMatch(matches[nextIdx], focusTextarea);
            const activeRow = document.querySelector(`#roster-daily-search-results [data-daily-match-idx="${nextIdx}"]`);
            if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
        }

        function jumpToRosterDailySearchMatch(idx) {
            const matches = rosterDailyState.searchMatches || [];
            if (idx < 0 || idx >= matches.length) return;
            rosterDailyState.activeMatchIndex = idx;
            refreshRosterDailySearch(false);
            scrollRosterDailyTextareaToMatch(matches[idx], true);
        }

        function switchRosterDailyFormatFromSearch(formatKey) {
            if (!ROSTER_DAILY_FORMAT_META[formatKey]) return;
            rosterDailyState.activeMatchIndex = 0;
            switchRosterDailyFormat(formatKey);
            const matches = rosterDailyState.searchMatches || [];
            if (matches.length > 0) {
                scrollRosterDailyTextareaToMatch(matches[0], true);
            }
        }

        function handleRosterDailySearchKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                navigateRosterDailySearchMatch(event.shiftKey ? -1 : 1, false);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                clearRosterDailySearch();
            }
        }

        function clearRosterDailySearch() {
            const inputEl = document.getElementById('roster-daily-search');
            if (inputEl) inputEl.value = '';
            rosterDailyState.searchQuery = '';
            rosterDailyState.searchMatches = [];
            rosterDailyState.activeMatchIndex = -1;
            refreshRosterDailySearch(false);
            if (inputEl) inputEl.focus();
        }

        function openActiveMonthKodeSpiModal() {
            const dt = getRosterDailyTargetDate();
            const spi = getKodeSpiForMonth(dt.year, dt.monthIdx);
            if (spi.found && spi.record) {
                openMasterItemModal('kode-spi', spi.record.id);
            } else {
                openMasterItemModal('kode-spi');
            }
        }

        function copyRosterDailyBroadcast() {
            const textarea = document.getElementById('roster-daily-preview');
            if (!textarea) return;
            const text = textarea.value || '';
            if (!text.trim()) {
                showToast('Teks Roster Daily masih kosong.', 'error');
                return;
            }

            const onSuccess = () => {
                const label = ROSTER_DAILY_FORMAT_META[rosterDailyState.activeFormat]?.label || 'Roster Daily';
                showToast(`Format ${label} berhasil disalin! Siap ditempel ke grup WhatsApp.`, 'success');
                const btn = document.getElementById('btn-copy-roster-daily');
                if (btn) {
                    const prevHtml = btn.innerHTML;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Tersalin!</span>';
                    setTimeout(() => { btn.innerHTML = prevHtml; }, 1800);
                }
            };

            const fallbackCopy = () => {
                try {
                    textarea.focus();
                    textarea.select();
                    textarea.setSelectionRange(0, text.length);
                    document.execCommand('copy');
                    onSuccess();
                } catch (err) {
                    showToast('Gagal menyalin otomatis. Silakan blok teks lalu tekan Ctrl+C.', 'error');
                }
            };

            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(text).then(onSuccess).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        }

        function initRosterSubViews() {
            populateRosterPersonalSelect(false);
            renderRosterPersonalCalendar();
            renderRosterDailyView();
        }
