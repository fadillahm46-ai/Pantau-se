/* =====================================================================
 * PANTAU SE — CLOUD SYNC BRIDGE (SUPABASE + GOOGLE APPS SCRIPT MEDIA)
 * Arsitektur Penyimpanan Hybrid:
 *   1. Supabase (PostgreSQL REST API) -> Seluruh data tabel (24 tabel, RLS disabled)
 *   2. Google Apps Script (code.gs)   -> Upload media/foto ke Google Drive
 *   3. Google Spreadsheet             -> Pencatatan otomatis kode link media (PSE-...)
 * ===================================================================== */

function getPantauSeConfig() {
    const winCfg = (typeof window !== 'undefined' && window.PANTAU_SE_CONFIG) ? window.PANTAU_SE_CONFIG : {};
    const appCfg = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG) ? APP_CONFIG : {};
    return {
        SUPABASE_URL: String(winCfg.SUPABASE_URL || appCfg.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
        SUPABASE_ANON_KEY: String(winCfg.SUPABASE_ANON_KEY || appCfg.SUPABASE_ANON_KEY || '').trim(),
        GAS_UPLOAD_URL: String(winCfg.GAS_UPLOAD_URL || appCfg.GAS_UPLOAD_URL || '').trim(),
        GAS_API_TOKEN: String(winCfg.GAS_API_TOKEN || appCfg.GAS_API_TOKEN || '').trim()
    };
}

function isSupabaseConfigured() {
    const cfg = getPantauSeConfig();
    return Boolean(
        cfg.SUPABASE_URL &&
        /^https?:\/\//i.test(cfg.SUPABASE_URL) &&
        !cfg.SUPABASE_URL.includes('your-project-id') &&
        cfg.SUPABASE_ANON_KEY &&
        !cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') &&
        cfg.SUPABASE_ANON_KEY.length >= 20
    );
}

function isGasConfigured() {
    const cfg = getPantauSeConfig();
    return Boolean(
        cfg.GAS_UPLOAD_URL &&
        /^https?:\/\//i.test(cfg.GAS_UPLOAD_URL) &&
        !cfg.GAS_UPLOAD_URL.includes('YOUR_DEPLOYED_GAS_ID')
    );
}

/* =====================================================================
 * 1. HELPER REST API SUPABASE
 * ===================================================================== */

function buildSupabaseHeaders(extra = {}) {
    const cfg = getPantauSeConfig();
    return {
        apikey: cfg.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...extra
    };
}

async function supabaseSelect(table, query = 'select=*') {
    if (!isSupabaseConfigured()) return null;
    const cfg = getPantauSeConfig();
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${query}`, {
        method: 'GET',
        headers: buildSupabaseHeaders()
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Supabase SELECT ${table} gagal (${res.status}): ${errText}`);
    }
    return res.json();
}

async function supabaseUpsert(table, rows, onConflict = '') {
    if (!isSupabaseConfigured()) return null;
    const payload = Array.isArray(rows) ? rows : [rows];
    if (payload.length === 0) return [];
    const cfg = getPantauSeConfig();
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}${qs}`, {
        method: 'POST',
        headers: buildSupabaseHeaders({
            Prefer: 'resolution=merge-duplicates,return=representation'
        }),
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Supabase UPSERT ${table} gagal (${res.status}): ${errText}`);
    }
    return res.json();
}

async function supabaseDelete(table, filterQuery) {
    if (!isSupabaseConfigured() || !filterQuery) return null;
    const cfg = getPantauSeConfig();
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${filterQuery}`, {
        method: 'DELETE',
        headers: buildSupabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Supabase DELETE ${table} gagal (${res.status}): ${errText}`);
    }
    return true;
}

/* =====================================================================
 * 2. UPLOAD, LOOKUP, & DELETE MEDIA KE GOOGLE DRIVE + SPREADSHEET (GAS)
 * ===================================================================== */

/**
 * Mengunggah foto/dokumen ke Google Drive melalui GAS (code.gs)
 * dan otomatis mencatat kode link (PSE-YYYYMMDD-XXXXXX) ke Spreadsheet
 * serta ke tabel Supabase `media_registry` bila Supabase aktif.
 *
 * Catatan teknis: menggunakan Content-Type `text/plain;charset=utf-8`
 * agar tidak memicu CORS preflight OPTIONS yang tidak didukung GAS Web App.
 */
async function uploadMediaToGas(options = {}) {
    if (!isGasConfigured()) {
        throw new Error('URL Google Apps Script (GAS_UPLOAD_URL) belum dikonfigurasi di index.html.');
    }
    const cfg = getPantauSeConfig();
    const activeProfile = (typeof USER_ACCESS_PROFILES !== 'undefined' && typeof activeUserProfileKey !== 'undefined')
        ? USER_ACCESS_PROFILES[activeUserProfileKey]
        : null;

    const payload = {
        action: 'upload',
        token: cfg.GAS_API_TOKEN || '',
        module: String(options.module || 'GENERAL').toUpperCase(),
        refId: String(options.refId || ''),
        nrp: String(options.nrp || ''),
        label: String(options.label || ''),
        fileName: String(options.fileName || `media_${Date.now()}.jpg`),
        mimeType: String(options.mimeType || ''),
        dataUrl: String(options.dataUrl || ''),
        base64Data: String(options.base64Data || ''),
        uploadedBy: String(options.uploadedBy || activeProfile?.nama || 'Admin SE'),
        oldFileId: String(options.oldFileId || '')
    };

    const res = await fetch(cfg.GAS_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({ ok: false, error: `Respons GAS tidak valid (HTTP ${res.status})` }));
    if (!res.ok || !json || !json.ok) {
        throw new Error(json?.error || `Gagal upload media ke Google Drive (HTTP ${res.status})`);
    }

    // Sinkronkan indeks media_code ke tabel Supabase media_registry (non-blocking bila gagal)
    if (isSupabaseConfigured() && json.mediaCode && json.fileId) {
        supabaseUpsert('media_registry', {
            media_code: json.mediaCode,
            module: json.module || payload.module,
            ref_id: payload.refId,
            nrp: payload.nrp,
            label: payload.label,
            file_name: json.fileName || payload.fileName,
            mime_type: json.mimeType || payload.mimeType,
            size_bytes: Number(json.sizeBytes) || 0,
            drive_file_id: json.fileId,
            drive_url: json.driveUrl || '',
            view_url: json.viewUrl || '',
            thumbnail_url: json.thumbnailUrl || '',
            spreadsheet_row: Number(json.sheetRow) || null,
            uploaded_by: payload.uploadedBy,
            status: 'ACTIVE'
        }, 'media_code').catch((err) => console.warn('Gagal mencatat media_registry di Supabase:', err));
    }

    return json;
}

async function lookupMediaFromGas(mediaCode) {
    if (!isGasConfigured()) {
        throw new Error('GAS_UPLOAD_URL belum dikonfigurasi.');
    }
    const cfg = getPantauSeConfig();
    const qs = new URLSearchParams({ action: 'lookup', code: String(mediaCode || '').trim() });
    if (cfg.GAS_API_TOKEN) qs.set('token', cfg.GAS_API_TOKEN);

    const res = await fetch(`${cfg.GAS_UPLOAD_URL}?${qs.toString()}`, { method: 'GET' });
    const json = await res.json().catch(() => ({ ok: false, error: 'Respons GAS tidak valid.' }));
    if (!res.ok || !json.ok) {
        throw new Error(json?.error || 'Kode media tidak ditemukan di Spreadsheet GAS.');
    }
    return json;
}

async function deleteMediaFromGas({ fileId = '', mediaCode = '' } = {}) {
    if (!isGasConfigured()) return null;
    const cfg = getPantauSeConfig();
    const res = await fetch(cfg.GAS_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'delete',
            token: cfg.GAS_API_TOKEN || '',
            fileId: String(fileId || ''),
            mediaCode: String(mediaCode || '')
        })
    });
    const json = await res.json().catch(() => ({ ok: false }));
    if (json?.ok && mediaCode && isSupabaseConfigured()) {
        supabaseUpsert('media_registry', {
            media_code: mediaCode,
            drive_file_id: fileId || '-',
            drive_url: '-',
            view_url: '-',
            status: 'DELETED'
        }, 'media_code').catch(() => {});
    }
    return json;
}

async function testCloudConnections() {
    const result = {
        supabase: { configured: isSupabaseConfigured(), ok: false, message: 'Belum dikonfigurasi' },
        gas: { configured: isGasConfigured(), ok: false, message: 'Belum dikonfigurasi' }
    };

    if (result.supabase.configured) {
        try {
            await supabaseSelect('master_jabatan', 'select=id&limit=1');
            result.supabase.ok = true;
            result.supabase.message = 'Terhubung ke Supabase';
        } catch (err) {
            result.supabase.message = err.message || 'Gagal terhubung ke Supabase';
        }
    }

    if (result.gas.configured) {
        try {
            const cfg = getPantauSeConfig();
            const qs = new URLSearchParams({ action: 'ping' });
            if (cfg.GAS_API_TOKEN) qs.set('token', cfg.GAS_API_TOKEN);
            const res = await fetch(`${cfg.GAS_UPLOAD_URL}?${qs.toString()}`);
            const json = await res.json();
            result.gas.ok = Boolean(json && json.ok);
            result.gas.message = result.gas.ok ? 'Terhubung ke GAS Drive & Spreadsheet' : (json?.error || 'GAS gagal merespons');
        } catch (err) {
            result.gas.message = err.message || 'Gagal terhubung ke GAS';
        }
    }

    return result;
}

/* =====================================================================
 * 3. SINKRONISASI PENUH SUPABASE <-> STATE WEB PANTAU SE
 * ===================================================================== */

function mapPunishmentToSupabaseRow(rec) {
    return {
        mp_id: Number(rec.mpId) || null,
        nrp: String(rec.nrp || ''),
        nama: String(rec.nama || ''),
        year: Number(rec.year) || new Date().getFullYear(),
        month_idx: Number(rec.monthIdx) || 0,
        tanggal: rec.tanggal || new Date().toISOString().slice(0, 10),
        kategori: String(rec.kategori || 'ATR'),
        tingkat: String(rec.tingkat || 'CC'),
        no_surat: String(rec.noSurat || ''),
        keterangan: String(rec.keterangan || ''),
        eviden_media_code: String(rec.evidenMediaCode || ''),
        eviden_photo_url: String(rec.evidenPhoto || ''),
        eviden_drive_file_id: String(rec.evidenDriveFileId || ''),
        eviden_photo_name: String(rec.evidenPhotoName || '')
    };
}

async function pushRosterPicToSupabase(entries = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const list = Array.isArray(entries)
            ? entries
            : (typeof getRosterPicSupabasePayload === 'function' ? getRosterPicSupabasePayload() : []);
        if (!list.length) return [];
        return await supabaseUpsert('roster_pic', list, 'submenu_key');
    } catch (err) {
        console.warn('Gagal menyinkronkan roster_pic ke Supabase:', err);
        return null;
    }
}

function mapRosterRowToSupabase(r) {
    return {
        nrp: String(r.nrp || '').trim(),
        nama: String(r.nama || '').trim(),
        jabatan: r.jabatan || '',
        unit: r.unit || '-',
        off_day: r.offDay || '-',
        schedule_by_month: r.scheduleByMonth || {},
        unit_by_month: r.unitByMonth || {}
    };
}

async function pushRosterRowsToSupabase(rows = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const src = Array.isArray(rows) ? rows : (rows ? [rows] : (typeof rosterState !== 'undefined' ? rosterState : []));
        const payload = src.map(mapRosterRowToSupabase).filter(x => x.nrp && x.nrp !== '-');
        if (!payload.length) return [];
        return await supabaseUpsert('roster_bulanan', payload, 'nrp');
    } catch (err) {
        console.warn('Gagal menyinkronkan roster_bulanan ke Supabase:', err);
        return null;
    }
}

async function deleteRosterRowsFromSupabase(nrpList = []) {
    if (!isSupabaseConfigured() || !Array.isArray(nrpList) || !nrpList.length) return null;
    try {
        const cleanNrps = nrpList.map(n => String(n || '').trim()).filter(n => n && n !== '-');
        if (!cleanNrps.length) return null;
        for (let i = 0; i < cleanNrps.length; i++) {
            await supabaseDelete('roster_bulanan', `nrp=eq.${encodeURIComponent(cleanNrps[i])}`);
        }
        return true;
    } catch (err) {
        console.warn('Gagal menghapus baris roster_bulanan di Supabase:', err);
        return null;
    }
}

function mapManpowerRowToSupabase(m) {
    const effectiveMcu = (typeof getEffectiveMcuDate === 'function')
        ? getEffectiveMcuDate(m)
        : (m.mcu_ulang || m.docs?.MCU || '');
    const docsCopy = { ...(m.docs || {}) };
    if (effectiveMcu) docsCopy.MCU = effectiveMcu;
    return {
        nrp: String(m.nrp || '').trim(),
        nama: String(m.nama || '').trim(),
        jabatan: m.jabatan || '',
        perusahaan: m.perusahaan || 'PPA',
        domisili: m.domisili || 'Mess',
        kontak: m.kontak || '',
        email: m.email || '',
        password: m.password || m.nrp || '',
        bapak_asuh: m.bapak_asuh || '',
        mcu_awal: m.mcu_awal || null,
        mcu_ulang: effectiveMcu || null,
        atr: Number(m.atr ?? 100),
        docs: docsCopy,
        media_links: m.media_links || {}
    };
}

async function pushManpowerRowsToSupabase(rows = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const src = Array.isArray(rows) ? rows : (rows ? [rows] : (typeof manpowerState !== 'undefined' ? manpowerState : []));
        const payload = src.map(mapManpowerRowToSupabase).filter(x => x.nrp);
        if (!payload.length) return [];
        return await supabaseUpsert('manpower', payload, 'nrp');
    } catch (err) {
        console.warn('Gagal menyinkronkan manpower ke Supabase:', err);
        return null;
    }
}

async function pushPunishmentRecordToSupabase(rec) {
    if (!isSupabaseConfigured() || !rec) return null;
    try {
        return await supabaseUpsert('atr_punishment_history', mapPunishmentToSupabaseRow(rec));
    } catch (err) {
        console.warn('Gagal menyinkronkan punishment ke Supabase:', err);
        return null;
    }
}

function safeRefreshAllPantauViews() {
    const fns = [
        'renderManpowerTable',
        'renderKomisioningTable',
        'renderMasterDataAll',
        'renderRosterTable',
        'renderPerformaManpower',
        'renderAtrMonthlyTable',
        'renderPunishmentHistoryTable',
        'renderHmUaView',
        'renderRentalBibTable',
        'renderBigCraneTable',
        'renderOpsLtWtTable',
        'renderOpsLiftingTable',
        'renderInformasiSection',
        'renderDashboardKpiPengawas'
    ];
    fns.forEach((fnName) => {
        try {
            if (typeof window[fnName] === 'function') {
                window[fnName]();
            }
        } catch (_) {
            /* lewati view yang belum aktif */
        }
    });
}

async function syncAllFromSupabase(showFeedback = false) {
    const syncIcon = document.getElementById('sync-icon');
    if (syncIcon && showFeedback) {
        syncIcon.classList.add('fa-spin');
    }

    if (!isSupabaseConfigured()) {
        if (syncIcon) setTimeout(() => syncIcon.classList.remove('fa-spin'), 300);
        if (showFeedback && typeof showToast === 'function') {
            showToast('Kredensial Supabase belum diisi di index.html — menggunakan data lokal.', 'info');
        }
        return { ok: false, source: 'local' };
    }

    try {
        const queries = [
            ['master_jabatan', 'select=*&order=id.asc'],
            ['master_perusahaan', 'select=*&order=id.asc'],
            ['master_kode_roster', 'select=*&order=id.asc'],
            ['master_kode_spi', 'select=*&order=tahun.asc,bulan.asc'],
            ['manpower', 'select=*&order=id.asc'],
            ['komisioning_unit', 'select=*&order=id.asc'],
            ['roster_bulanan', 'select=*&order=id.asc'],
            ['roster_pic', 'select=*&order=id.asc'],
            ['absensi_harian', 'select=*'],
            ['atr_weekly', 'select=*'],
            ['atr_monthly', 'select=*'],
            ['atr_punishment_history', 'select=*&order=id.desc'],
            ['kpi_pengawas', 'select=*'],
            ['hm_ua_daily', 'select=*'],
            ['ua_weekly_upload', 'select=*'],
            ['ua_mtd_upload', 'select=*'],
            ['rental_bib', 'select=*&order=tanggal.desc,id.desc'],
            ['big_crane_timeframe', 'select=*&order=id.asc'],
            ['operasional_lt_wt', 'select=*&order=id.desc'],
            ['operasional_lifting', 'select=*&order=id.desc'],
            ['pusat_informasi', 'select=*&order=id.desc'],
            ['pusat_informasi_komentar', 'select=*&order=id.asc']
        ];

        const settled = await Promise.allSettled(
            queries.map(([tbl, qs]) => supabaseSelect(tbl, qs))
        );

        const dataByTable = {};
        queries.forEach(([tbl], idx) => {
            const st = settled[idx];
            dataByTable[tbl] = (st.status === 'fulfilled' && Array.isArray(st.value)) ? st.value : null;
        });

        let syncedTables = 0;

        if (dataByTable.master_jabatan?.length) {
            masterJabatanState = dataByTable.master_jabatan.map((r) => ({ id: r.id, nama: r.nama }));
            syncedTables++;
        }
        if (dataByTable.master_perusahaan?.length) {
            masterPerusahaanState = dataByTable.master_perusahaan.map((r) => ({
                id: r.id, kode: r.kode, keterangan: r.keterangan || ''
            }));
            syncedTables++;
        }
        if (dataByTable.master_kode_roster?.length) {
            masterKodeRosterState = dataByTable.master_kode_roster.map((r) => ({
                id: r.id, kode: r.kode, artiSistem: r.arti_sistem || 'SHIFT_1', keterangan: r.keterangan || ''
            }));
            syncedTables++;
        }
        if (dataByTable.master_kode_spi?.length) {
            masterKodeSpiState = dataByTable.master_kode_spi.map((r) => ({
                id: r.id, tahun: r.tahun, bulan: r.bulan,
                kodePengawas: r.kode_pengawas || '', kodeOperator: r.kode_operator || '',
                keterangan: r.keterangan || ''
            }));
            syncedTables++;
        }
        if (dataByTable.manpower?.length) {
            manpowerState = dataByTable.manpower.map((r) => ({
                id: r.id, nrp: r.nrp, nama: r.nama, jabatan: r.jabatan || '',
                perusahaan: r.perusahaan || 'PPA', domisili: r.domisili || 'Mess',
                kontak: r.kontak || '', email: r.email || '',
                password: r.password || r.nrp || '',
                bapak_asuh: r.bapak_asuh || '',
                mcu_awal: r.mcu_awal || '', mcu_ulang: r.mcu_ulang || '',
                atr: Number(r.atr ?? 100),
                docs: (r.docs && typeof r.docs === 'object') ? r.docs : {},
                media_links: (r.media_links && typeof r.media_links === 'object') ? r.media_links : {}
            }));
            syncedTables++;
        }
        if (dataByTable.komisioning_unit?.length) {
            komisioningState = dataByTable.komisioning_unit.map((r) => ({
                id: r.id, no_unit: r.no_unit, model_tipe: r.model_tipe || '',
                kategori_unit: r.kategori_unit || 'lifting',
                hm_rate: Number(r.hm_rate ?? 10), rental_rate: Number(r.rental_rate ?? 0),
                KOMISIONING_BIB: r.komisioning_bib || '',
                KOMISIONING_TIA: r.komisioning_tia || '',
                KOMISIONING_TMA: r.komisioning_tma || '',
                media_links: (r.media_links && typeof r.media_links === 'object') ? r.media_links : {}
            }));
            syncedTables++;
        }
        if (dataByTable.roster_bulanan?.length) {
            rosterState = dataByTable.roster_bulanan.map((r) => ({
                id: r.id, nrp: r.nrp, nama: r.nama, jabatan: r.jabatan || '',
                unit: r.unit || '-', offDay: r.off_day || '-',
                scheduleByMonth: (r.schedule_by_month && typeof r.schedule_by_month === 'object') ? r.schedule_by_month : {},
                unitByMonth: (r.unit_by_month && typeof r.unit_by_month === 'object') ? r.unit_by_month : {}
            }));
            syncedTables++;
        }
        if (dataByTable.roster_pic?.length) {
            if (typeof hydrateRosterPicFromSupabase === 'function') {
                hydrateRosterPicFromSupabase(dataByTable.roster_pic);
            }
            syncedTables++;
        }
        if (dataByTable.absensi_harian?.length) {
            dataByTable.absensi_harian.forEach((r) => {
                if (!r.record_key) return;
                absensiRecordsState[r.record_key] = {
                    mpId: r.mp_id, date: r.tanggal, code: r.code || '-',
                    shift: r.shift || '-', cekin: r.cekin || '', status: r.status || '-', note: r.note || ''
                };
            });
            syncedTables++;
        }
        if (dataByTable.atr_weekly?.length) {
            dataByTable.atr_weekly.forEach((r) => {
                if (!r.record_key) return;
                atrWeeklyState[r.record_key] = {
                    atr: Number(r.atr ?? 100), nc: Number(r.nc ?? 0),
                    s: Number(r.s ?? 0), i: Number(r.i ?? 0), a: Number(r.a ?? 0),
                    periode: r.periode || ''
                };
            });
            syncedTables++;
        }
        if (dataByTable.atr_monthly?.length) {
            dataByTable.atr_monthly.forEach((r) => {
                if (!r.record_key) return;
                atrMonthlyState[r.record_key] = {
                    atr: Number(r.atr ?? 100), nc: Number(r.nc ?? 0),
                    s: Number(r.s ?? 0), i: Number(r.i ?? 0), a: Number(r.a ?? 0)
                };
            });
            syncedTables++;
        }
        if (dataByTable.atr_punishment_history?.length) {
            punishmentHistoryState = dataByTable.atr_punishment_history.map((r) => ({
                id: r.id, mpId: r.mp_id, nrp: r.nrp || '', nama: r.nama || '',
                year: Number(r.year), monthIdx: Number(r.month_idx),
                tanggal: r.tanggal || '', kategori: r.kategori || 'ATR', tingkat: r.tingkat || 'CC',
                noSurat: r.no_surat || '', keterangan: r.keterangan || '',
                evidenMediaCode: r.eviden_media_code || '',
                evidenPhoto: r.eviden_photo_url || '',
                evidenDriveFileId: r.eviden_drive_file_id || '',
                evidenPhotoName: r.eviden_photo_name || ''
            }));
            if (typeof punishmentHistorySeeded !== 'undefined') punishmentHistorySeeded = true;
            syncedTables++;
        }
        if (dataByTable.kpi_pengawas?.length) {
            dataByTable.kpi_pengawas.forEach((r) => {
                if (!r.record_key) return;
                kpiPengawasStore[r.record_key] = {
                    sap: r.sap !== null ? Number(r.sap) : null,
                    closing_rate: r.closing_rate !== null ? Number(r.closing_rate) : null,
                    sqi: r.sqi !== null ? Number(r.sqi) : null,
                    atr_individu: r.atr_individu !== null ? Number(r.atr_individu) : null,
                    atr_anak_asuh: r.atr_anak_asuh !== null ? Number(r.atr_anak_asuh) : null,
                    status: r.status || 'MTD Daily',
                    updatedAt: r.updated_at_label || ''
                };
            });
            syncedTables++;
        }
        if (dataByTable.hm_ua_daily?.length) {
            dataByTable.hm_ua_daily.forEach((r) => {
                if (!r.record_key) return;
                hmUaRecordsState[r.record_key] = {
                    unit: r.unit, date: r.tanggal, shift: r.shift, nrp: r.nrp || '',
                    hm_start: r.hm_start !== null ? Number(r.hm_start) : null,
                    hm_stop: r.hm_stop !== null ? Number(r.hm_stop) : null,
                    hm_diff: r.hm_diff !== null ? Number(r.hm_diff) : null,
                    hm_aktual: r.hm_aktual !== null ? Number(r.hm_aktual) : null
                };
            });
            syncedTables++;
        }
        if (dataByTable.ua_weekly_upload?.length) {
            dataByTable.ua_weekly_upload.forEach((r) => {
                if (!r.record_key) return;
                uaWeeklyUploadState[r.record_key] = {
                    total: Number(r.total ?? 0),
                    count: Number(r.shift_count ?? 0)
                };
            });
            syncedTables++;
        }
        if (dataByTable.ua_mtd_upload?.length) {
            dataByTable.ua_mtd_upload.forEach((r) => {
                if (!r.record_key) return;
                uaMtdUploadState[r.record_key] = {
                    total: Number(r.total ?? 0),
                    days: Number(r.days ?? 0),
                    shifts: Number(r.shifts ?? 0)
                };
            });
            syncedTables++;
        }
        if (dataByTable.rental_bib?.length) {
            rentalBibState = dataByTable.rental_bib.map((r) => ({
                id: r.id, tanggal: r.tanggal, no_unit: r.no_unit, shift: r.shift || 'Shift 1',
                hm_awal: Number(r.hm_awal ?? 0), hm_akhir: Number(r.hm_akhir ?? 0),
                total_hm: Number(r.total_hm ?? 0), hm_charge: Number(r.hm_charge ?? 0),
                rental_rate: Number(r.rental_rate ?? 0), total: Number(r.total ?? 0),
                job: r.job || '', operator: r.operator || '', pic_dept: r.pic_dept || ''
            }));
            syncedTables++;
        }
        if (dataByTable.big_crane_timeframe?.length) {
            bigCraneTimeframeState = dataByTable.big_crane_timeframe.map((r) => ({
                id: r.id, no_unit: r.no_unit, user: r.user_dept || '',
                pekerjaan: r.pekerjaan || '', lokasi: r.lokasi || '',
                status: r.status || 'Schedule', month: Number(r.month_idx), year: Number(r.year),
                planning: (r.planning && typeof r.planning === 'object') ? r.planning : {},
                aktual: (r.aktual && typeof r.aktual === 'object') ? r.aktual : {}
            }));
            syncedTables++;
        }
        if (dataByTable.operasional_lt_wt?.length && typeof opsLtWtState !== 'undefined') {
            opsLtWtState = dataByTable.operasional_lt_wt.map((r, idx) => ({
                id: `sb-lt-${r.id}`, no: String(idx + 1), noId: r.no_id || '',
                timestamp: r.timestamp_raw || '', jenisJob: r.jenis_job || '',
                plan: r.plan || '', waktu: r.waktu || '', shift: r.shift || '',
                typeUnit: r.type_unit || '', noUnit: r.no_unit || '',
                cluster: r.cluster || '', lokasi: r.lokasi || '',
                hmStart: r.hm_start || '', hmEnd: r.hm_end || '',
                tglAction: r.tgl_action || '', start: r.start_time || '',
                end: r.end_time || '', durasi: r.durasi || '', status: r.status || '',
                temuanKendala: r.temuan_kendala || '', armada: r.armada || '',
                opt: r.opt || '', mp1: r.mp_1 || '', mp2: r.mp_2 || '',
                sourceSheet: r.source_sheet || ''
            }));
            syncedTables++;
        }
        if (dataByTable.operasional_lifting?.length && typeof opsLiftingState !== 'undefined') {
            opsLiftingState = dataByTable.operasional_lifting.map((r, idx) => ({
                id: `sb-lf-${r.id}`, no: String(idx + 1), noWo: r.no_wo || '',
                timestamp: r.timestamp_raw || '', kategori: r.kategori || '',
                nrpPemohon: r.nrp_pemohon || '', namaPemohon: r.nama_pemohon || '',
                perusahaan: r.perusahaan || '', departemen: r.departemen || '',
                section: r.section || '', noWa: r.no_wa || '',
                tglPelaksanaan: r.tgl_pelaksanaan || '', jamPelaksanaan: r.jam_pelaksanaan || '',
                shift: r.shift || '', durasiRequest: r.durasi_request || '',
                lokasiAsal: r.lokasi_asal || '', lokasiTujuan: r.lokasi_tujuan || '',
                deskripsi: r.deskripsi || '', status: r.status || '',
                gl: r.gl || '', unit: r.unit || '', operator: r.operator || '',
                rigger1: r.rigger_1 || '', rigger2: r.rigger_2 || '',
                jamStartAktual: r.jam_start_aktual || '', jamEndAktual: r.jam_end_aktual || '',
                durasiAktual: r.durasi_aktual || '', finalInspeksi: r.final_inspeksi || '',
                kendalaLapangan: r.kendala_lapangan || ''
            }));
            syncedTables++;
        }
        if (dataByTable.pusat_informasi?.length) {
            const commentsByInfo = {};
            (dataByTable.pusat_informasi_komentar || []).forEach((c) => {
                if (!commentsByInfo[c.informasi_id]) commentsByInfo[c.informasi_id] = [];
                commentsByInfo[c.informasi_id].push({
                    id: c.id, authorKey: c.author_key || '', authorName: c.author_name || '',
                    authorRole: c.author_role || '', authorType: c.author_type || 'karyawan',
                    text: c.text || '', timeLabel: c.time_label || '',
                    mediaCode: c.media_code || '', mediaUrl: c.media_url || ''
                });
            });
            informasiState = dataByTable.pusat_informasi.map((r) => ({
                id: r.id, kategori: r.kategori || 'OPERASIONAL', judul: r.judul || '',
                deskripsi: r.deskripsi || '', audiensAll: Boolean(r.audiens_all),
                audiens: Array.isArray(r.audiens) ? r.audiens : [],
                links: Array.isArray(r.links) ? r.links : [],
                chatEnabled: Boolean(r.chat_enabled),
                chatCooldownValue: Number(r.chat_cooldown_value ?? 5),
                chatCooldownUnit: r.chat_cooldown_unit || 'minutes',
                createdBy: r.created_by || 'Admin SE', createdAtLabel: r.created_at_label || '',
                editedBy: r.edited_by || '',
                comments: commentsByInfo[r.id] || []
            }));
            syncedTables++;
        }

        if (!Array.isArray(manpowerState)) manpowerState = [];

        safeRefreshAllPantauViews();

        if (showFeedback && typeof showToast === 'function') {
            showToast(
                syncedTables > 0
                    ? `Sinkronisasi Supabase berhasil (${syncedTables} modul diperbarui).`
                    : 'Terhubung ke Supabase — database siap digunakan.',
                'success'
            );
        }
        return { ok: true, source: 'supabase', syncedTables };
    } catch (err) {
        console.error('Sinkronisasi Supabase gagal:', err);
        if (showFeedback && typeof showToast === 'function') {
            showToast('Gagal sinkronisasi ke Supabase — menggunakan data lokal.', 'error');
        }
        return { ok: false, source: 'local', error: err.message };
    } finally {
        if (syncIcon) {
            setTimeout(() => syncIcon.classList.remove('fa-spin'), 400);
        }
    }
}

/**
 * Utility opsional untuk push/backup seluruh data lokal saat ini ke Supabase.
 * Dapat dipanggil dari Console browser: `await pushCurrentStateToSupabase(true)`
 */
async function pushCurrentStateToSupabase(showFeedback = true) {
    if (!isSupabaseConfigured()) {
        if (showFeedback && typeof showToast === 'function') {
            showToast('Isi SUPABASE_URL & SUPABASE_ANON_KEY di index.html terlebih dahulu.', 'error');
        }
        return { ok: false };
    }

    try {
        await supabaseUpsert('master_jabatan', masterJabatanState.map((j) => ({ nama: j.nama })), 'nama');
        await supabaseUpsert('master_perusahaan', masterPerusahaanState.map((p) => ({ kode: p.kode, keterangan: p.keterangan || '' })), 'kode');
        await supabaseUpsert('master_kode_roster', masterKodeRosterState.map((k) => ({ kode: k.kode, arti_sistem: k.artiSistem || 'SHIFT_1', keterangan: k.keterangan || '' })), 'kode');
        await supabaseUpsert('master_kode_spi', masterKodeSpiState.map((s) => ({ tahun: s.tahun, bulan: s.bulan, kode_pengawas: s.kodePengawas, kode_operator: s.kodeOperator, keterangan: s.keterangan || '' })), 'tahun,bulan');

        await supabaseUpsert('manpower', manpowerState.map(mapManpowerRowToSupabase), 'nrp');

        await supabaseUpsert('komisioning_unit', komisioningState.map((u) => ({
            no_unit: u.no_unit, model_tipe: u.model_tipe || '', kategori_unit: u.kategori_unit || 'lifting',
            hm_rate: Number(u.hm_rate ?? 10), rental_rate: Number(u.rental_rate ?? 0),
            komisioning_bib: u.KOMISIONING_BIB || null,
            komisioning_tia: u.KOMISIONING_TIA || null,
            komisioning_tma: u.KOMISIONING_TMA || null
        })), 'no_unit');

        await supabaseUpsert('roster_bulanan', rosterState.map(mapRosterRowToSupabase).filter(x => x.nrp && x.nrp !== '-'), 'nrp');

        await pushRosterPicToSupabase();

        if (typeof opsLtWtState !== 'undefined' && opsLtWtState.length) {
            await supabaseUpsert('operasional_lt_wt', opsLtWtState.map((r, i) => ({
                dedup_key: `${r.noId || i}|${r.tglAction || ''}|${r.noUnit || ''}|${r.jenisJob || ''}`,
                no_id: r.noId || '', timestamp_raw: r.timestamp || '', jenis_job: r.jenisJob || '',
                plan: r.plan || '', waktu: r.waktu || '', shift: r.shift || '',
                type_unit: r.typeUnit || '', no_unit: r.noUnit || '', cluster: r.cluster || '',
                lokasi: r.lokasi || '', hm_start: r.hmStart || '', hm_end: r.hmEnd || '',
                tgl_action: r.tglAction || '', start_time: r.start || '', end_time: r.end || '',
                durasi: r.durasi || '', status: r.status || '', temuan_kendala: r.temuanKendala || '',
                armada: r.armada || '', opt: r.opt || '', mp_1: r.mp1 || '', mp_2: r.mp2 || '',
                source_sheet: r.sourceSheet || ''
            })), 'dedup_key');
        }

        if (typeof opsLiftingState !== 'undefined' && opsLiftingState.length) {
            await supabaseUpsert('operasional_lifting', opsLiftingState.map((r, i) => ({
                dedup_key: `${r.noWo || i}|${r.tglPelaksanaan || ''}|${r.unit || ''}`,
                no_wo: r.noWo || '', timestamp_raw: r.timestamp || '', kategori: r.kategori || '',
                nrp_pemohon: r.nrpPemohon || '', nama_pemohon: r.namaPemohon || '',
                perusahaan: r.perusahaan || '', departemen: r.departemen || '', section: r.section || '',
                no_wa: r.noWa || '', tgl_pelaksanaan: r.tglPelaksanaan || '', jam_pelaksanaan: r.jamPelaksanaan || '',
                shift: r.shift || '', durasi_request: r.durasiRequest || '',
                lokasi_asal: r.lokasiAsal || '', lokasi_tujuan: r.lokasiTujuan || '',
                deskripsi: r.deskripsi || '', status: r.status || '', gl: r.gl || '',
                unit: r.unit || '', operator: r.operator || '', rigger_1: r.rigger1 || '', rigger_2: r.rigger2 || '',
                jam_start_aktual: r.jamStartAktual || '', jam_end_aktual: r.jamEndAktual || '',
                durasi_aktual: r.durasiAktual || '', final_inspeksi: r.finalInspeksi || '',
                kendala_lapangan: r.kendalaLapangan || ''
            })), 'dedup_key');
        }

        if (showFeedback && typeof showToast === 'function') {
            showToast('Seluruh data aplikasi berhasil di-backup ke Supabase.', 'success');
        }
        return { ok: true };
    } catch (err) {
        console.error('Push ke Supabase gagal:', err);
        if (showFeedback && typeof showToast === 'function') {
            showToast(`Gagal push ke Supabase: ${err.message}`, 'error');
        }
        return { ok: false, error: err.message };
    }
}
