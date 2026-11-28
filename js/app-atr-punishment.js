/* =====================================================================
 * 4C. SISTEM PEMBINAAN ATR BERTAHAP & UPLOAD RIWAYAT PUNISHMENT
 * Mengacu pada Surat Pernyataan Komitmen Program Pembinaan ATR Bertahap:
 * 1. ATR merah (< 98.5%) -> CC (Coaching & Counseling)
 * 2. Bertingkat: CC -> ST -> SP1 -> SP2 -> SP3 -> PHK
 * 3. Pemutihan CC & ST: 3 bulan berturut-turut ATR hijau (>= 98.5%)
 * 4. Pemutihan SP1, SP2, SP3: 6 bulan berturut-turut ATR hijau (>= 98.5%)
 * 5. Non-ATR tingkat CC tidak memengaruhi ATR, dan sebaliknya
 * 6. Non-ATR tingkat ST atau lebih tinggi saling memengaruhi & menaikkan tingkat
 * ===================================================================== */

const ATR_GREEN_THRESHOLD = 98.5;

const PUNISHMENT_LEVEL_LIST = [
    { level: 1, code: 'CC', label: 'Coaching & Counseling (CC)', expireMonths: 3, pillPending: 'bg-amber-100 text-amber-900 border-amber-300', pillGiven: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeCls: 'bg-amber-100 text-amber-800 border border-amber-200' },
    { level: 2, code: 'ST', label: 'Surat Teguran (ST)', expireMonths: 3, pillPending: 'bg-orange-100 text-orange-900 border-orange-300', pillGiven: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeCls: 'bg-orange-100 text-orange-800 border border-orange-200' },
    { level: 3, code: 'SP1', label: 'Surat Peringatan 1 (SP1)', expireMonths: 6, pillPending: 'bg-red-100 text-red-800 border-red-300', pillGiven: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeCls: 'bg-red-100 text-red-700 border border-red-200' },
    { level: 4, code: 'SP2', label: 'Surat Peringatan 2 (SP2)', expireMonths: 6, pillPending: 'bg-red-200 text-red-900 border-red-400', pillGiven: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeCls: 'bg-red-200 text-red-900 border border-red-300' },
    { level: 5, code: 'SP3', label: 'Surat Peringatan 3 (SP3)', expireMonths: 6, pillPending: 'bg-rose-600 text-white border-rose-700', pillGiven: 'bg-emerald-50 text-emerald-700 border-emerald-200', badgeCls: 'bg-rose-600 text-white border border-rose-700' },
    { level: 6, code: 'PHK', label: 'PHK', expireMonths: 0, pillPending: 'bg-gray-900 text-white border-gray-900', pillGiven: 'bg-gray-800 text-white border-gray-900', badgeCls: 'bg-gray-900 text-white border border-gray-900' }
];

function getPunishmentMetaByLevel(levelNum) {
    return PUNISHMENT_LEVEL_LIST.find(x => x.level === Number(levelNum)) || null;
}

function getPunishmentMetaByCode(code) {
    const norm = normalizePunishmentLevel(code);
    return PUNISHMENT_LEVEL_LIST.find(x => x.code === norm) || null;
}

function normalizePunishmentLevel(raw) {
    const s = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!s) return '';
    if (s === 'CC' || s.startsWith('COACHING') || s === 'COUNSELING') return 'CC';
    if (s === 'ST' || s === 'SURATTEGURAN' || s === 'TEGURAN') return 'ST';
    if (s === 'SP1' || s === 'SURATPERINGATAN1' || s === 'SPI1') return 'SP1';
    if (s === 'SP2' || s === 'SURATPERINGATAN2' || s === 'SPI2') return 'SP2';
    if (s === 'SP3' || s === 'SURATPERINGATAN3' || s === 'SPI3') return 'SP3';
    if (s === 'PHK' || s.includes('PEMUTUSAN')) return 'PHK';
    return '';
}

function normalizePunishmentCategory(raw) {
    const s = String(raw || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
    if (!s || s === 'ATR' || s === 'ABSENSI' || s === 'ATTENDANCE') return 'ATR';
    if (s.includes('NONATR') || s === 'NON' || s.includes('SAFETY') || s.includes('OPERASIONAL') || s.includes('DISIPLIN') || s.includes('LAIN')) {
        return 'NON_ATR';
    }
    return 'ATR';
}

function parsePunishmentPeriod(rawPeriod, rawDate) {
    const str = String(rawPeriod || '').trim();
    // Format YYYY-MM atau YYYY/MM
    const ymMatch = str.match(/^(\d{4})[-/](\d{1,2})$/);
    if (ymMatch) {
        const y = parseInt(ymMatch[1], 10);
        const m = parseInt(ymMatch[2], 10) - 1;
        if (m >= 0 && m <= 11) return { year: y, monthIdx: m };
    }
    // Format MM-YYYY atau MM/YYYY
    const myMatch = str.match(/^(\d{1,2})[-/](\d{4})$/);
    if (myMatch) {
        const m = parseInt(myMatch[1], 10) - 1;
        const y = parseInt(myMatch[2], 10);
        if (m >= 0 && m <= 11) return { year: y, monthIdx: m };
    }
    // Format Nama Bulan + Tahun (mis. "Januari 2026", "Nov 2026", "Okt-2026")
    if (str) {
        const monthAliases = [
            ['jan', 'januari', 'january'],
            ['feb', 'februari', 'february'],
            ['mar', 'maret', 'march'],
            ['apr', 'april'],
            ['mei', 'may'],
            ['jun', 'juni', 'june'],
            ['jul', 'juli', 'july'],
            ['agu', 'ags', 'agustus', 'aug', 'august'],
            ['sep', 'sept', 'september'],
            ['okt', 'oktober', 'oct', 'october'],
            ['nov', 'november'],
            ['des', 'desember', 'dec', 'december']
        ];
        const low = str.toLowerCase();
        const yFound = low.match(/(20\d{2})/);
        let mFound = -1;
        for (let idx = 0; idx < monthAliases.length; idx++) {
            if (monthAliases[idx].some(alias => new RegExp(`\\b${alias}`, 'i').test(low))) {
                mFound = idx;
                break;
            }
        }
        if (mFound >= 0) {
            const fallbackYear = parseInt(document.getElementById('atr-monthly-year')?.value || '2026', 10);
            return { year: yFound ? parseInt(yFound[1], 10) : fallbackYear, monthIdx: mFound };
        }
    }
    // Fallback dari tanggal terbit (YYYY-MM-DD / serial Excel)
    const dateIso = normalizeExcelDate(rawDate || rawPeriod);
    if (dateIso) {
        const d = new Date(dateIso + 'T00:00:00');
        if (!isNaN(d.getTime())) {
            return { year: d.getFullYear(), monthIdx: d.getMonth() };
        }
    }
    return null;
}

function formatPunishmentPeriodLabel(year, monthIdx) {
    return `${MONTH_SHORT_ID[monthIdx] || '-'} ${year}`;
}

function seedInitialPunishmentHistory() {
    punishmentHistorySeeded = true;
}

/**
 * Mengevaluasi lini masa Pembinaan ATR Bertahap untuk satu karyawan hingga akhir targetYear.
 * Menggabungkan data ATR Monthly (atrMonthlyState) dengan Riwayat Punishment (punishmentHistoryState),
 * termasuk lintas tahun (misal riwayat punishment akhir tahun lalu berlanjut ke Januari tahun ini).
 */
function evaluateEmployeeAtrPunishmentTimeline(mpId, targetYear) {
    const yTarget = Number(targetYear);
    const mpRecords = punishmentHistoryState.filter(p => Number(p.mpId) === Number(mpId));

    // Tentukan titik bulan paling awal dari data ATR maupun Riwayat Punishment karyawan ini
    let minYm = yTarget * 12;
    const prefix = `${mpId}::`;
    Object.keys(atrMonthlyState).forEach(k => {
        if (!k.startsWith(prefix)) return;
        const rest = k.slice(prefix.length);
        const m = rest.match(/^(\d{4})-(\d{1,2})$/);
        if (!m) return;
        const ym = parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
        if (ym < minYm) minYm = ym;
    });
    mpRecords.forEach(p => {
        const ym = Number(p.year) * 12 + Number(p.monthIdx);
        if (!isNaN(ym) && ym < minYm) minYm = ym;
    });

    const maxYm = yTarget * 12 + 11;

    // Kelompokkan riwayat punishment per (year * 12 + monthIdx)
    const histByYm = {};
    mpRecords.forEach(p => {
        const ym = Number(p.year) * 12 + Number(p.monthIdx);
        if (!histByYm[ym]) histByYm[ym] = [];
        histByYm[ym].push(p);
    });

    let activeLevel = 0; // 0=NONE, 1=CC, 2=ST, 3=SP1, 4=SP2, 5=SP3, 6=PHK
    let activeSource = null; // 'ATR' | 'NON_ATR' | null
    let greenStreak = 0;

    const targetMonths = new Array(12).fill(null);
    let pendingCount = 0;

    for (let ym = minYm; ym <= maxYm; ym++) {
        const y = Math.floor(ym / 12);
        const mIdx = ym % 12;

        const atrRec = atrMonthlyState[`${mpId}::${y}-${mIdx}`] || null;
        const hasAtr = Boolean(atrRec && atrRec.atr !== null && atrRec.atr !== undefined && !isNaN(Number(atrRec.atr)));
        const atrVal = hasAtr ? Number(atrRec.atr) : null;
        const isRed = hasAtr && atrVal < ATR_GREEN_THRESHOLD;
        const isGreen = hasAtr && atrVal >= ATR_GREEN_THRESHOLD;

        const monthHist = histByYm[ym] || [];
        const atrHist = monthHist.filter(p => normalizePunishmentCategory(p.kategori) === 'ATR');
        const nonAtrHist = monthHist.filter(p => normalizePunishmentCategory(p.kategori) === 'NON_ATR');

        const highestRec = (list) => {
            let best = null;
            let bestLvl = 0;
            list.forEach(rec => {
                const meta = getPunishmentMetaByCode(rec.tingkat);
                if (meta && meta.level >= bestLvl) {
                    bestLvl = meta.level;
                    best = { ...rec, level: meta.level, tingkat: meta.code };
                }
            });
            return best;
        };

        const givenAtrRec = highestRec(atrHist);
        const highestNonAtrRec = highestRec(nonAtrHist);
        // Rule 5 & 6: Non-ATR hanya memengaruhi ATR jika tingkat >= ST (level >= 2)
        const nonAtrEscalatingRec = (highestNonAtrRec && highestNonAtrRec.level >= 2) ? highestNonAtrRec : null;

        const levelBefore = activeLevel;
        const streakBefore = greenStreak;

        let status = 'EMPTY';
        let requiredLevel = 0;
        let requiredCode = '';
        let expiredLevel = 0;
        let reasonNote = '';

        if (isRed) {
            // Jika di bulan yang sama juga ada Non-ATR ST+, sinkronkan tingkat dasarnya lebih dulu
            let baseLevel = activeLevel;
            if (nonAtrEscalatingRec && nonAtrEscalatingRec.level > baseLevel) {
                baseLevel = nonAtrEscalatingRec.level;
            }
            requiredLevel = Math.min(6, baseLevel + 1);
            requiredCode = getPunishmentMetaByLevel(requiredLevel)?.code || 'CC';

            if (givenAtrRec) {
                status = 'GIVEN';
                activeLevel = Math.max(requiredLevel, givenAtrRec.level);
                activeSource = 'ATR';
                reasonNote = `Pembinaan ${givenAtrRec.tingkat} sudah tercatat pada ${formatDateID(givenAtrRec.tanggal)}`;
            } else {
                status = 'PENDING';
                activeLevel = requiredLevel;
                activeSource = 'ATR';
                reasonNote = `ATR merah (< 98,5%): wajib pembinaan ${requiredCode} dan belum tercatat di Riwayat Punishment`;
            }
            greenStreak = 0;
        } else if (isGreen) {
            if (nonAtrEscalatingRec) {
                // Rule 6: Non-ATR ST atau lebih tinggi memengaruhi jalur pembinaan ATR (lihat Contoh 5 B2)
                activeLevel = Math.max(activeLevel, nonAtrEscalatingRec.level);
                activeSource = 'NON_ATR';
                greenStreak = 0;
                status = 'NON_ATR_ESCALATED';
                reasonNote = `Punishment Non-ATR ${nonAtrEscalatingRec.tingkat} aktif & memengaruhi eskalasi ATR berikutnya`;
            } else if (givenAtrRec) {
                // Riwayat ATR manual yang dimasukkan pada bulan hijau
                activeLevel = Math.max(activeLevel, givenAtrRec.level);
                activeSource = 'ATR';
                greenStreak = 0;
                status = 'GIVEN';
                reasonNote = `Riwayat punishment ATR ${givenAtrRec.tingkat} tercatat pada bulan ini`;
            } else if (activeLevel > 0) {
                greenStreak += 1;
                const activeMeta = getPunishmentMetaByLevel(activeLevel);
                const needed = activeMeta?.expireMonths || 0;
                if (needed > 0 && greenStreak >= needed) {
                    expiredLevel = activeLevel;
                    const expCode = activeMeta.code;
                    activeLevel = 0;
                    activeSource = null;
                    greenStreak = 0;
                    status = 'PEMUTIHAN';
                    reasonNote = `Pemutihan ${expCode} selesai (${needed} bulan berturut-turut ATR hijau ≥ 98,5%)`;
                } else {
                    status = 'GREEN_STREAK';
                    reasonNote = needed > 0
                        ? `ATR hijau (${greenStreak}/${needed} bulan menuju pemutihan ${activeMeta.code})`
                        : `Status aktif: ${activeMeta?.code || '-'}`;
                }
            } else {
                status = 'AMAN';
                reasonNote = 'ATR hijau (≥ 98,5%) tanpa tanggungan pembinaan aktif';
            }
        } else {
            // Tidak ada data ATR di bulan ini, namun bisa terdapat riwayat punishment (mis. akhir tahun sebelumnya)
            if (givenAtrRec) {
                activeLevel = Math.max(activeLevel, givenAtrRec.level);
                activeSource = 'ATR';
                greenStreak = 0;
                status = 'GIVEN';
                reasonNote = `Riwayat punishment ATR ${givenAtrRec.tingkat} tercatat`;
            } else if (nonAtrEscalatingRec) {
                activeLevel = Math.max(activeLevel, nonAtrEscalatingRec.level);
                activeSource = 'NON_ATR';
                greenStreak = 0;
                status = 'NON_ATR_ESCALATED';
                reasonNote = `Riwayat punishment Non-ATR ${nonAtrEscalatingRec.tingkat} tercatat`;
            }
        }

        const expiryNeededAfter = activeLevel > 0 ? (getPunishmentMetaByLevel(activeLevel)?.expireMonths || 0) : 0;

        if (y === yTarget) {
            if (status === 'PENDING') pendingCount++;
            targetMonths[mIdx] = {
                year: y,
                monthIdx: mIdx,
                atrRec,
                hasAtr,
                atr: atrVal,
                isRed,
                isGreen,
                status,
                requiredLevel,
                requiredCode,
                givenAtrRecord: givenAtrRec,
                nonAtrRecords: nonAtrHist,
                nonAtrEscalatingRecord: nonAtrEscalatingRec,
                levelBefore,
                streakBefore,
                activeLevelAfter: activeLevel,
                activeCodeAfter: getPunishmentMetaByLevel(activeLevel)?.code || '',
                greenStreakAfter: greenStreak,
                expiryNeededAfter,
                expiredLevel,
                expiredCode: getPunishmentMetaByLevel(expiredLevel)?.code || '',
                reasonNote
            };
        }
    }

    // Ambil status aktif terakhir sampai bulan terakhir yang memiliki data/riwayat di targetYear
    let lastRelevant = null;
    for (let m = 11; m >= 0; m--) {
        const item = targetMonths[m];
        if (item && (item.hasAtr || item.givenAtrRecord || item.nonAtrEscalatingRecord)) {
            lastRelevant = item;
            break;
        }
    }

    const finalActiveLevel = lastRelevant ? lastRelevant.activeLevelAfter : activeLevel;
    const finalActiveCode = getPunishmentMetaByLevel(finalActiveLevel)?.code || '';
    const finalGreenStreak = lastRelevant ? lastRelevant.greenStreakAfter : greenStreak;
    const finalExpiryNeeded = finalActiveLevel > 0 ? (getPunishmentMetaByLevel(finalActiveLevel)?.expireMonths || 0) : 0;

    return {
        mpId,
        year: yTarget,
        months: targetMonths,
        pendingCount,
        currentActiveLevel: finalActiveLevel,
        currentActiveCode: finalActiveCode,
        currentGreenStreak: finalGreenStreak,
        currentExpiryNeeded: finalExpiryNeeded
    };
}

function getTotalPendingAtrPunishments(year) {
    seedInitialPunishmentHistory();
    let total = 0;
    manpowerState.forEach(mp => {
        total += evaluateEmployeeAtrPunishmentTimeline(mp.id, year).pendingCount;
    });
    return total;
}

function updateAtrPunishmentBadges(year = null) {
    const targetYear = Number(year || document.getElementById('atr-monthly-year')?.value || new Date().getFullYear());
    const totalPending = getTotalPendingAtrPunishments(targetYear);

    const tabBadge = document.getElementById('atr-punishment-tab-badge');
    if (tabBadge) {
        tabBadge.textContent = String(totalPending);
        tabBadge.classList.toggle('hidden', totalPending === 0);
    }

    const monthlyBadge = document.getElementById('atr-monthly-pending-badge');
    if (monthlyBadge) {
        if (totalPending > 0) {
            monthlyBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold';
            monthlyBadge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${totalPending} Belum Diberi Punishment</span>`;
        } else {
            monthlyBadge.className = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold';
            monthlyBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Semua Pembinaan Terpenuhi</span>`;
        }
    }
}

/**
 * Membuka modal Detail ATR untuk sel pada ATR Monthly sekaligus menampilkan
 * status Pembinaan Bertingkat, riwayat pemutihan, dan tombol cepat catat punishment.
 */
function openAtrMonthlyCellDetail(mpId, year, monthIdx) {
    seedInitialPunishmentHistory();
    const rec = atrMonthlyState[`${mpId}::${year}-${monthIdx}`] || { atr: 0, nc: 0, s: 0, i: 0, a: 0 };
    const pLabel = `${MONTH_NAMES_ID[monthIdx]} ${year}`;
    openAtrDetailModal(mpId, pLabel, rec.atr, rec.nc || 0, rec.s || 0, rec.i || 0, rec.a || 0);

    const panel = document.getElementById('atr-detail-punishment-section');
    if (!panel) return;

    const timeline = evaluateEmployeeAtrPunishmentTimeline(mpId, year);
    const mInfo = timeline.months[monthIdx];
    if (!mInfo) {
        panel.classList.add('hidden');
        return;
    }

    let html = '';
    if (mInfo.status === 'PENDING') {
        const meta = getPunishmentMetaByLevel(mInfo.requiredLevel);
        html = `
                    <div class="p-3 rounded-xl bg-red-50 border border-red-200 space-y-2">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-start gap-2">
                                <i class="fa-solid fa-circle-exclamation text-red-600 text-sm mt-0.5 shrink-0"></i>
                                <div>
                                    <p class="text-[11px] font-bold text-red-800">Punishment Belum Diberikan: ${escapeHtml(meta?.label || mInfo.requiredCode)}</p>
                                    <p class="text-[10px] text-red-700 mt-0.5">${escapeHtml(mInfo.reasonNote)}</p>
                                </div>
                            </div>
                        </div>
                        <button type="button" onclick="openPunishmentFromAtrDetail(${Number(mpId)}, ${Number(year)}, ${Number(monthIdx)}, '${escapeJsString(mInfo.requiredCode)}')"
                            class="w-full px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors">
                            <i class="fa-solid fa-camera"></i>
                            <span>Upload Eviden &amp; Catat ${escapeHtml(mInfo.requiredCode)}</span>
                        </button>
                    </div>
                `;
    } else if (mInfo.status === 'GIVEN' && mInfo.givenAtrRecord) {
        const g = mInfo.givenAtrRecord;
        const gPhotoSrc = g.evidenPhoto || g._localEvidenPreview || '';
        const photoThumbHtml = gPhotoSrc
            ? `<button type="button" onclick="openPunishmentEvidenPreview(${Number(g.id)})"
                            class="mt-1.5 inline-flex items-center gap-2 p-1.5 rounded-lg bg-white border border-emerald-200 hover:border-teal-400 transition-colors cursor-pointer">
                            <img src="${escapeHtml(gPhotoSrc)}" alt="Eviden" class="w-10 h-10 rounded object-cover border border-gray-200">
                            <span class="text-[10px] font-semibold text-teal-700">Lihat Eviden Foto</span>
                       </button>`
            : `<button type="button" onclick="closeAtrDetailModal(); openPunishmentModal(${Number(g.id)})"
                            class="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 hover:underline">
                            <i class="fa-solid fa-camera"></i><span>Tambah Eviden Foto</span>
                       </button>`;
        html = `
                    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[11px] font-bold text-emerald-800 inline-flex items-center gap-1.5">
                                <i class="fa-solid fa-circle-check text-emerald-600"></i>
                                Punishment Sudah Diberikan (${escapeHtml(g.tingkat)})
                            </span>
                            <button type="button" onclick="closeAtrDetailModal(); openPunishmentModal(${Number(g.id)})"
                                class="text-[10px] font-semibold text-teal-700 hover:underline">Edit</button>
                        </div>
                        <p class="text-[10px] text-emerald-700">Tanggal: <strong>${escapeHtml(formatDateID(g.tanggal))}</strong>${g.noSurat ? ` • No: <span class="font-mono">${escapeHtml(g.noSurat)}</span>` : ''}</p>
                        ${g.keterangan ? `<p class="text-[10px] text-gray-600">${escapeHtml(g.keterangan)}</p>` : ''}
                        ${photoThumbHtml}
                    </div>
                `;
    } else if (mInfo.status === 'NON_ATR_ESCALATED' && mInfo.nonAtrEscalatingRecord) {
        const n = mInfo.nonAtrEscalatingRecord;
        html = `
                    <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1">
                        <p class="text-[11px] font-bold text-indigo-800 inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-link text-indigo-600"></i>
                            Punishment Non-ATR Aktif: ${escapeHtml(n.tingkat)}
                        </p>
                        <p class="text-[10px] text-indigo-700">${escapeHtml(mInfo.reasonNote)}</p>
                        ${n.keterangan ? `<p class="text-[10px] text-gray-600">${escapeHtml(n.keterangan)}</p>` : ''}
                    </div>
                `;
    } else if (mInfo.status === 'PEMUTIHAN') {
        html = `
                    <div class="p-3 rounded-xl bg-teal-50 border border-teal-200">
                        <p class="text-[11px] font-bold text-teal-800 inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-sparkles text-teal-600"></i>
                            Pemutihan ${escapeHtml(mInfo.expiredCode)} Selesai
                        </p>
                        <p class="text-[10px] text-teal-700 mt-0.5">${escapeHtml(mInfo.reasonNote)}</p>
                    </div>
                `;
    } else if (mInfo.status === 'GREEN_STREAK') {
        html = `
                    <div class="p-3 rounded-xl bg-sky-50 border border-sky-200">
                        <p class="text-[11px] font-bold text-sky-800 inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-hourglass-half text-sky-600"></i>
                            Progres Pemutihan ${escapeHtml(mInfo.activeCodeAfter)}
                        </p>
                        <p class="text-[10px] text-sky-700 mt-0.5">${escapeHtml(mInfo.reasonNote)}</p>
                    </div>
                `;
    } else {
        html = `
                    <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                        <p class="text-[11px] font-bold text-emerald-800 inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-shield-check text-emerald-600"></i>
                            Status Aman — Tidak Ada Pembinaan Aktif
                        </p>
                    </div>
                `;
    }

    panel.innerHTML = html;
    panel.classList.remove('hidden');
}

function openPunishmentFromAtrDetail(mpId, year, monthIdx, tingkatCode) {
    closeAtrDetailModal();
    openPunishmentModal(null, {
        mpId,
        year,
        monthIdx,
        kategori: 'ATR',
        tingkat: tingkatCode
    });
}

/* =====================================================================
 * UPLOAD EVIDEN FOTO, FORM LANGSUNG, MODAL EDIT, & LIGHTBOX PREVIEW
 * ===================================================================== */
let punishInlinePhotoData = '';
let punishInlinePhotoName = '';
let punishModalPhotoData = '';
let punishModalPhotoName = '';

function readAndCompressPunishmentPhoto(file, onDone) {
    const reader = new FileReader();
    reader.onload = function (ev) {
        const rawUrl = ev.target?.result || '';
        if (!rawUrl) return;
        try {
            const img = new Image();
            img.onload = function () {
                try {
                    const maxDim = 1280;
                    let w = img.naturalWidth || img.width;
                    let h = img.naturalHeight || img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w >= h) { h = Math.round(h * (maxDim / w)); w = maxDim; }
                        else { w = Math.round(w * (maxDim / h)); h = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/jpeg', 0.82);
                        onDone(compressed || rawUrl);
                        return;
                    }
                } catch (_) { /* fallback raw */ }
                onDone(rawUrl);
            };
            img.onerror = () => onDone(rawUrl);
            img.src = rawUrl;
        } catch (_) {
            onDone(rawUrl);
        }
    };
    reader.readAsDataURL(file);
}

function setPunishmentPhotoPreview(target, dataUrl, fileName = '') {
    const isInline = target === 'inline';
    if (isInline) {
        punishInlinePhotoData = dataUrl || '';
        punishInlinePhotoName = fileName || (dataUrl ? 'eviden-punishment.jpg' : '');
    } else {
        punishModalPhotoData = dataUrl || '';
        punishModalPhotoName = fileName || (dataUrl ? 'eviden-punishment.jpg' : '');
    }

    const emptyEl = document.getElementById(`punish-${target}-photo-empty`);
    const prevWrap = document.getElementById(`punish-${target}-photo-preview-wrap`);
    const prevImg = document.getElementById(`punish-${target}-photo-preview-img`);
    const nameEl = document.getElementById(`punish-${target}-photo-name`);
    const fileEl = document.getElementById(`punish-${target}-photo-file`);

    if (dataUrl) {
        if (emptyEl) emptyEl.classList.add('hidden');
        if (prevWrap) { prevWrap.classList.remove('hidden'); prevWrap.classList.add('flex'); }
        if (prevImg) prevImg.src = dataUrl;
        if (nameEl) nameEl.textContent = fileName || 'eviden-punishment.jpg';
    } else {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (prevWrap) { prevWrap.classList.add('hidden'); prevWrap.classList.remove('flex'); }
        if (prevImg) prevImg.src = '';
        if (nameEl) nameEl.textContent = '';
        if (fileEl) fileEl.value = '';
    }
}

function clearPunishmentPhoto(target) {
    setPunishmentPhotoPreview(target, '', '');
}

function handlePunishmentPhotoFileChange(event, target) {
    const file = event.target?.files?.[0];
    if (!file) return;
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '')) {
        showToast('Harap pilih file foto/gambar (JPG, PNG, WEBP).', 'error');
        event.target.value = '';
        return;
    }
    readAndCompressPunishmentPhoto(file, (dataUrl) => {
        setPunishmentPhotoPreview(target, dataUrl, file.name);
    });
}

function syncPunishModalRecommendation() {
    const editId = Number(document.getElementById('punish-edit-id')?.value) || 0;
    const mpId = Number(document.getElementById('punish-mp-id')?.value);
    const year = parseInt(document.getElementById('punish-year')?.value || '2026', 10);
    const monthIdx = parseInt(document.getElementById('punish-month')?.value ?? '0', 10);
    const kategori = normalizePunishmentCategory(document.getElementById('punish-kategori')?.value);
    const tingkatEl = document.getElementById('punish-tingkat');
    const hintEl = document.getElementById('punish-modal-auto-hint');
    if (!hintEl || !mpId) return;

    const tl = evaluateEmployeeAtrPunishmentTimeline(mpId, year);
    const mInfo = tl.months[monthIdx];

    if (!editId && kategori === 'ATR' && mInfo && mInfo.status === 'PENDING' && mInfo.requiredCode) {
        if (tingkatEl) tingkatEl.value = mInfo.requiredCode;
        hintEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[9px] font-bold shrink-0';
        hintEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>Wajib ${escapeHtml(mInfo.requiredCode)}</span>`;
    } else if (kategori === 'ATR' && mInfo && mInfo.status === 'GIVEN' && mInfo.givenAtrRecord) {
        hintEl.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-bold shrink-0';
        hintEl.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Sudah ${escapeHtml(mInfo.givenAtrRecord.tingkat)}</span>`;
    } else {
        hintEl.className = 'hidden';
        hintEl.innerHTML = '';
    }
}

function upsertPunishmentHistoryRecord(payload) {
    const { editId, mp, year, monthIdx, tanggal, kategori, tingkat, noSurat, keterangan, evidenPhoto, _localEvidenPreview, evidenPhotoName, evidenMediaCode, evidenDriveFileId } = payload;
    if (editId) {
        const idx = punishmentHistoryState.findIndex(p => Number(p.id) === Number(editId));
        if (idx >= 0) {
            punishmentHistoryState[idx] = {
                ...punishmentHistoryState[idx],
                mpId: mp.id, nrp: mp.nrp, nama: mp.nama,
                year, monthIdx, tanggal, kategori, tingkat, noSurat, keterangan,
                evidenPhoto: evidenPhoto || '',
                _localEvidenPreview: _localEvidenPreview || '',
                evidenPhotoName: evidenPhotoName || '',
                evidenMediaCode: evidenMediaCode !== undefined ? evidenMediaCode : (punishmentHistoryState[idx].evidenMediaCode || ''),
                evidenDriveFileId: evidenDriveFileId !== undefined ? evidenDriveFileId : (punishmentHistoryState[idx].evidenDriveFileId || '')
            };
        }
        return 'updated';
    }

    const dupIdx = punishmentHistoryState.findIndex(p =>
        Number(p.mpId) === Number(mp.id) &&
        Number(p.year) === Number(year) &&
        Number(p.monthIdx) === Number(monthIdx) &&
        normalizePunishmentCategory(p.kategori) === kategori
    );
    if (dupIdx >= 0) {
        punishmentHistoryState[dupIdx] = {
            ...punishmentHistoryState[dupIdx],
            tanggal, tingkat, noSurat, keterangan,
            evidenPhoto: evidenPhoto || punishmentHistoryState[dupIdx].evidenPhoto || '',
            _localEvidenPreview: _localEvidenPreview || '',
            evidenPhotoName: evidenPhotoName || punishmentHistoryState[dupIdx].evidenPhotoName || '',
            evidenMediaCode: evidenMediaCode || punishmentHistoryState[dupIdx].evidenMediaCode || '',
            evidenDriveFileId: evidenDriveFileId || punishmentHistoryState[dupIdx].evidenDriveFileId || ''
        };
        return 'updated';
    }

    punishmentHistoryState.push({
        id: Date.now(),
        mpId: mp.id, nrp: mp.nrp, nama: mp.nama,
        year, monthIdx, tanggal, kategori, tingkat, noSurat, keterangan,
        evidenPhoto: evidenPhoto || '',
        _localEvidenPreview: _localEvidenPreview || '',
        evidenPhotoName: evidenPhotoName || '',
        evidenMediaCode: evidenMediaCode || '',
        evidenDriveFileId: evidenDriveFileId || ''
    });
    return 'added';
}

function renderPunishmentHistoryTable() {
    seedInitialPunishmentHistory();
    const tbody = document.getElementById('punishment-history-tbody');
    const countEl = document.getElementById('punishment-history-count');
    const yearSel = document.getElementById('atr-monthly-year');
    updateAtrPunishmentBadges(yearSel?.value);
    if (!tbody) return;

    const query = (document.getElementById('punishment-history-search')?.value || '').trim().toLowerCase();
    const catFilter = document.getElementById('punishment-filter-category')?.value || 'all';
    const lvlFilter = document.getElementById('punishment-filter-level')?.value || 'all';
    const yearFilter = document.getElementById('punishment-filter-year')?.value || 'all';

    const filtered = punishmentHistoryState
        .filter(item => {
            if (catFilter !== 'all' && normalizePunishmentCategory(item.kategori) !== catFilter) return false;
            if (lvlFilter !== 'all' && normalizePunishmentLevel(item.tingkat) !== lvlFilter) return false;
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

    if (countEl) countEl.textContent = `${filtered.length} riwayat`;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="py-10 text-center text-xs text-gray-400">Belum ada riwayat punishment yang cocok.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(item => {
        const mp = manpowerState.find(m => Number(m.id) === Number(item.mpId));
        const meta = getPunishmentMetaByCode(item.tingkat);
        const isNonAtr = normalizePunishmentCategory(item.kategori) === 'NON_ATR';
        const catBadge = isNonAtr
            ? '<span class="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-bold">Non-ATR</span>'
            : '<span class="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[9px] font-bold">ATR</span>';

        const photoSrc = item.evidenPhoto || item._localEvidenPreview || '';
        const evidenHtml = photoSrc
            ? `<button type="button" onclick="openPunishmentEvidenPreview(${Number(item.id)})" title="Klik untuk memperbesar eviden foto"
                            class="inline-flex items-center gap-1.5 group cursor-pointer">
                            <img src="${escapeHtml(photoSrc)}" alt="Eviden" class="w-10 h-10 rounded-lg object-cover border border-gray-200 group-hover:ring-2 group-hover:ring-teal-400 transition-all bg-white">
                            <span class="text-[9.5px] font-semibold text-teal-700 group-hover:underline">Lihat</span>
                       </button>`
            : `<button type="button" onclick="openPunishmentModal(${Number(item.id)})"
                            class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[9.5px] font-semibold transition-colors">
                            <i class="fa-solid fa-camera text-[9px]"></i>
                            <span>Upload Foto</span>
                       </button>`;

        return `
                    <tr class="bg-white even:bg-gray-50/60 hover:bg-teal-50/30 transition-colors">
                        <td class="py-2.5 px-3 font-mono text-gray-600 whitespace-nowrap">${escapeHtml(item.nrp || mp?.nrp || '-')}</td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                            <p class="font-semibold text-gray-800">${escapeHtml(item.nama || mp?.nama || '-')}</p>
                            <p class="text-[9px] text-gray-400">${escapeHtml(mp?.jabatan || '-')}</p>
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                            <p class="font-semibold text-gray-700">${escapeHtml(formatPunishmentPeriodLabel(item.year, item.monthIdx))}</p>
                            <p class="text-[9px] text-gray-400 font-mono">${escapeHtml(formatDateID(item.tanggal))}</p>
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap">${catBadge}</td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                            <span class="px-2.5 py-0.5 rounded-full text-[9.5px] font-bold ${meta?.badgeCls || 'bg-gray-100 text-gray-700'}">${escapeHtml(meta?.code || item.tingkat)}</span>
                        </td>
                        <td class="py-2.5 px-3 max-w-[260px]">
                            ${item.noSurat ? `<p class="font-mono text-[9.5px] text-teal-700 font-semibold truncate">${escapeHtml(item.noSurat)}</p>` : ''}
                            <p class="text-[10px] text-gray-600 line-clamp-2">${escapeHtml(item.keterangan || '-')}</p>
                        </td>
                        <td class="py-2.5 px-3 whitespace-nowrap">${evidenHtml}</td>
                        <td class="py-2.5 px-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1">
                                <button type="button" onclick="openPunishmentModal(${Number(item.id)})" title="Edit Riwayat"
                                    class="px-2 py-1 rounded-lg bg-gray-100 hover:bg-teal-50 text-gray-600 hover:text-teal-700 text-[10px] font-semibold transition-colors">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button type="button" onclick="confirmDeletePunishmentRecord(${Number(item.id)})" title="Hapus Riwayat"
                                    class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-semibold transition-colors">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
    }).join('');
}

function openPunishmentEvidenPreview(recordId) {
    const rec = punishmentHistoryState.find(p => Number(p.id) === Number(recordId));
    const previewSrc = rec ? (rec.evidenPhoto || rec._localEvidenPreview || '') : '';
    if (!rec || !previewSrc) {
        showToast('Eviden foto belum diunggah pada riwayat ini.', 'info');
        return;
    }
    const modal = document.getElementById('modal-punishment-eviden-preview');
    if (!modal) return;
    document.getElementById('eviden-preview-title').textContent = `Eviden ${rec.tingkat} — ${rec.nama}`;
    document.getElementById('eviden-preview-meta').textContent =
        `${formatPunishmentPeriodLabel(rec.year, rec.monthIdx)} • ${formatDateID(rec.tanggal)} • ${normalizePunishmentCategory(rec.kategori) === 'NON_ATR' ? 'Non-ATR' : 'ATR'}${rec.noSurat ? ` • ${rec.noSurat}` : ''}${rec.evidenMediaCode ? ` • Kode: ${rec.evidenMediaCode}` : ''}`;
    document.getElementById('eviden-preview-img').src = previewSrc;
    document.getElementById('eviden-preview-note').textContent = rec.keterangan || '-';
    const dl = document.getElementById('eviden-preview-download');
    if (dl) {
        dl.href = previewSrc;
        dl.download = rec.evidenPhotoName || `Eviden_${rec.tingkat}_${rec.nrp || 'MP'}.jpg`;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePunishmentEvidenPreview() {
    const modal = document.getElementById('modal-punishment-eviden-preview');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function openPunishmentModal(recordId = null, prefill = null) {
    seedInitialPunishmentHistory();
    const modal = document.getElementById('modal-punishment-manual');
    const form = document.getElementById('form-punishment-manual');
    const mpSel = document.getElementById('punish-mp-id');
    if (!modal || !form || !mpSel) return;

    mpSel.innerHTML = manpowerState
        .slice()
        .sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
        .map(mp => `<option value="${Number(mp.id)}">${escapeHtml(mp.nama)} (${escapeHtml(mp.nrp)} — ${escapeHtml(mp.jabatan || '-')})</option>`)
        .join('');

    form.reset();
    const rec = recordId ? punishmentHistoryState.find(p => Number(p.id) === Number(recordId)) : null;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = String(v ?? ''); };
    document.getElementById('modal-punish-title').innerHTML = rec
        ? '<i class="fa-solid fa-gavel text-teal-600"></i><span>Edit Punishment &amp; Eviden Foto</span>'
        : '<i class="fa-solid fa-camera text-teal-600"></i><span>Upload Eviden &amp; Catat Punishment</span>';
    setVal('punish-edit-id', rec ? rec.id : '');

    if (rec) {
        setVal('punish-mp-id', rec.mpId);
        setVal('punish-year', rec.year);
        setVal('punish-month', rec.monthIdx);
        setVal('punish-tanggal', rec.tanggal || getTodayISO());
        setVal('punish-kategori', normalizePunishmentCategory(rec.kategori));
        setVal('punish-tingkat', normalizePunishmentLevel(rec.tingkat) || 'CC');
        setVal('punish-no-surat', rec.noSurat || '');
        setVal('punish-keterangan', rec.keterangan || '');
        setPunishmentPhotoPreview('modal', rec.evidenPhoto || '', rec.evidenPhotoName || '');
    } else {
        const y = prefill?.year ?? Number(document.getElementById('atr-monthly-year')?.value || new Date().getFullYear());
        const m = prefill?.monthIdx ?? new Date().getMonth();
        setVal('punish-mp-id', prefill?.mpId || (manpowerState[0]?.id || ''));
        setVal('punish-year', y);
        setVal('punish-month', m);
        setVal('punish-tanggal', getTodayISO());
        setVal('punish-kategori', prefill?.kategori || 'ATR');
        setVal('punish-tingkat', prefill?.tingkat || 'CC');
        setVal('punish-no-surat', '');
        setVal('punish-keterangan', '');
        setPunishmentPhotoPreview('modal', '', '');
    }

    syncPunishModalRecommendation();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closePunishmentModal() {
    const modal = document.getElementById('modal-punishment-manual');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handlePunishmentFormSubmit(event) {
    event.preventDefault();
    seedInitialPunishmentHistory();

    const editId = Number(document.getElementById('punish-edit-id')?.value) || 0;
    const mpId = Number(document.getElementById('punish-mp-id')?.value);
    const year = parseInt(document.getElementById('punish-year')?.value || '2026', 10);
    const monthIdx = parseInt(document.getElementById('punish-month')?.value ?? '0', 10);
    const tanggal = document.getElementById('punish-tanggal')?.value || getTodayISO();
    const kategori = normalizePunishmentCategory(document.getElementById('punish-kategori')?.value);
    const tingkat = normalizePunishmentLevel(document.getElementById('punish-tingkat')?.value);
    const noSurat = (document.getElementById('punish-no-surat')?.value || '').trim();
    const keterangan = (document.getElementById('punish-keterangan')?.value || '').trim();

    const mp = manpowerState.find(m => Number(m.id) === mpId);
    if (!mp || !tingkat) {
        showToast('Pilih karyawan dan tingkat punishment yang valid.', 'error');
        return;
    }
    if (!keterangan) {
        showToast('Harap isi keterangan punishment.', 'error');
        return;
    }

    const existingRec = editId ? punishmentHistoryState.find(p => Number(p.id) === Number(editId)) : null;
    const cleanSafeUrl = (u) => (typeof sanitizeSafeMediaUrl === 'function'
        ? sanitizeSafeMediaUrl(u)
        : (/^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : ''));

    let rawPhotoData = String(punishModalPhotoData || '').trim();
    let finalPhotoUrl = cleanSafeUrl(rawPhotoData);
    let localOnlyPreview = '';
    let finalPhotoName = punishModalPhotoName;
    let finalMediaCode = existingRec?.evidenMediaCode || '';
    let finalDriveFileId = existingRec?.evidenDriveFileId || '';
    let gasUploadFailed = false;

    // Jika ada foto baru (data:image/...), WAJIB unggah ke Google Drive + catat link di Spreadsheet (ZERO base64 ke Supabase!)
    if (rawPhotoData && /^data:/i.test(rawPhotoData)) {
        if (typeof isGasConfigured === 'function' && isGasConfigured() && typeof uploadMediaToGas === 'function') {
            try {
                showToast('Mengunggah eviden foto ke Google Drive (GAS)...', 'info');
                const gasRes = await uploadMediaToGas({
                    dataUrl: rawPhotoData,
                    fileName: finalPhotoName || `Eviden_${tingkat}_${mp.nrp}_${tanggal}.jpg`,
                    module: 'PUNISHMENT',
                    refId: String(editId || `${mp.nrp}-${year}-${monthIdx}`),
                    nrp: mp.nrp,
                    label: `${tingkat} ${kategori} - ${mp.nama}`,
                    oldFileId: existingRec?.evidenDriveFileId || ''
                });
                const uploadedLink = cleanSafeUrl(gasRes?.viewUrl || gasRes?.driveUrl || '');
                if (gasRes && gasRes.ok && uploadedLink) {
                    finalPhotoUrl = uploadedLink;
                    finalPhotoName = gasRes.fileName || finalPhotoName;
                    finalMediaCode = gasRes.mediaCode || '';
                    finalDriveFileId = gasRes.fileId || '';
                } else {
                    throw new Error(gasRes?.error || 'GAS tidak mengembalikan link Google Drive.');
                }
            } catch (err) {
                console.warn('Upload eviden ke GAS gagal — foto diblokir dari Supabase:', err);
                gasUploadFailed = true;
                finalPhotoUrl = cleanSafeUrl(existingRec?.evidenPhoto || '');
                localOnlyPreview = rawPhotoData;
                showToast('Upload ke Google Drive gagal — data tersimpan tanpa mengirim foto ke Supabase. Silakan upload ulang foto.', 'error');
            }
        } else {
            gasUploadFailed = true;
            finalPhotoUrl = cleanSafeUrl(existingRec?.evidenPhoto || '');
            localOnlyPreview = rawPhotoData;
            showToast('GAS Drive belum aktif — foto TIDAK dikirim ke Supabase (hanya pratinjau lokal sementara).', 'error');
        }
    }

    const mode = upsertPunishmentHistoryRecord({
        editId, mp, year, monthIdx, tanggal, kategori, tingkat, noSurat, keterangan,
        evidenPhoto: finalPhotoUrl,
        _localEvidenPreview: localOnlyPreview,
        evidenPhotoName: finalPhotoName,
        evidenMediaCode: finalMediaCode || undefined,
        evidenDriveFileId: finalDriveFileId || undefined
    });

    if (typeof pushPunishmentRecordToSupabase === 'function' && typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
        const savedRec = punishmentHistoryState.find(p =>
            Number(p.mpId) === Number(mp.id) &&
            Number(p.year) === Number(year) &&
            Number(p.monthIdx) === Number(monthIdx) &&
            normalizePunishmentCategory(p.kategori) === kategori
        );
        if (savedRec) {
            const pushed = await pushPunishmentRecordToSupabase(savedRec);
            if (pushed && pushed.id) savedRec.id = pushed.id;
        }
    }

    closePunishmentModal();
    renderPunishmentHistoryTable();
    renderAtrMonthlyTable();
    renderPerformaManpower();
    if (!gasUploadFailed) {
        showToast(
            mode === 'updated'
                ? `Riwayat punishment ${mp.nama} diperbarui (${tingkat})${finalMediaCode ? ` • Kode Media: ${finalMediaCode}` : ''}.`
                : `Punishment ${tingkat} (${kategori === 'NON_ATR' ? 'Non-ATR' : 'ATR'}) untuk ${mp.nama} berhasil disimpan${finalMediaCode ? ` • Kode Media: ${finalMediaCode}` : ''}.`,
            'success'
        );
    }
}

function confirmDeletePunishmentRecord(recordId) {
    const rec = punishmentHistoryState.find(p => Number(p.id) === Number(recordId));
    if (!rec) return;
    openConfirmDeleteModal({
        title: 'Hapus Riwayat Punishment?',
        message: `Riwayat ${rec.tingkat} (${rec.kategori === 'NON_ATR' ? 'Non-ATR' : 'ATR'}) milik ${rec.nama} periode ${formatPunishmentPeriodLabel(rec.year, rec.monthIdx)} akan dihapus.`,
        confirmText: 'Ya, Hapus',
        onConfirm: () => {
            punishmentHistoryState = punishmentHistoryState.filter(p => Number(p.id) !== Number(recordId));
            if (typeof deletePunishmentRecordFromSupabase === 'function') {
                deletePunishmentRecordFromSupabase(recordId).catch(() => { });
            }
            renderPunishmentHistoryTable();
            renderAtrMonthlyTable();
            renderPerformaManpower();
            showToast('Riwayat punishment dihapus & ATR Monthly dihitung ulang.', 'success');
        }
    });
}
