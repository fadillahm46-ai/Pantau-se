/* =====================================================================
 * PANTAU SE — CLOUD SYNC BRIDGE (HEMAT EGRESS + REALTIME + ZERO PHOTO LEAK)
 * Arsitektur Penyimpanan Hybrid:
 *   1. Supabase (PostgreSQL REST API + Native Realtime WebSocket)
 *      -> Seluruh data teks/tabel dengan:
 *         - Hard Guard Anti-Foto/Base64 (ZERO data:image / blob / base64 ke Supabase)
 *         - Prefer: return=minimal pada write/upsert/patch (hemat egress 50-90%)
 *         - Local Snapshot Cache + Delta Sync (updated_at > watermark)
 *         - Lazy Per-Section & Role-Scoped Loading (hemat Log Query & Egress)
 *         - Dual-Channel Realtime WebSocket (Broadcast + Postgres Changes)
 *           dengan prioritas utama Beranda (pusat_informasi & komentar)
 *   2. Google Apps Script (code.gs) -> Upload foto/media ke Google Drive
 *   3. Google Spreadsheet           -> Pencatatan otomatis kode link media (PSE-...)
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
 * 0. HARD GUARD ANTI-BOCOR FOTO / BASE64 KE SUPABASE
 *    Semua foto WAJIB masuk Google Drive via GAS & link dicatat Spreadsheet.
 *    Supabase HANYA boleh menerima teks URL https://... atau kode PSE-...
 * ===================================================================== */

const PANTAU_FORBIDDEN_MEDIA_KEYS = new Set([
    'dataUrl', 'data_url', 'base64Data', 'base64_data',
    '_localPreviewUrl', '_localEvidenPreview', 'localPreviewUrl', 'rawFile'
]);

function isForbiddenInlineMediaString(val) {
    if (typeof val !== 'string') return false;
    const s = val.trim();
    if (!s) return false;
    if (/^data:(?:image|audio|video|application\/octet-stream|application\/pdf)/i.test(s)) return true;
    if (/^data:[^;]{0,60};base64,/i.test(s)) return true;
    if (/^blob:/i.test(s)) return true;
    // Blokir string base64 mentah berukuran besar (>= 4 KB tanpa spasi)
    if (s.length >= 4000 && /^[A-Za-z0-9+/=\r\n]+$/.test(s.slice(0, 512))) return true;
    return false;
}

function sanitizeSafeMediaUrl(url) {
    const s = String(url || '').trim();
    if (!s) return '';
    if (isForbiddenInlineMediaString(s)) {
        console.warn('[PANTAU SE GUARD] Memblokir URL foto inline/base64 agar tidak masuk ke Supabase.');
        return '';
    }
    if (/^https?:\/\//i.test(s)) return s;
    return '';
}

function sanitizeMediaLinksMap(rawMap) {
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return {};
    const clean = {};
    Object.keys(rawMap).forEach((docKey) => {
        const entry = rawMap[docKey];
        if (!entry || typeof entry !== 'object') return;
        const viewUrl = sanitizeSafeMediaUrl(entry.viewUrl || entry.view_url || '');
        const driveUrl = sanitizeSafeMediaUrl(entry.driveUrl || entry.drive_url || '');
        const mediaCode = String(entry.mediaCode || entry.media_code || '').trim();
        const fileId = String(entry.fileId || entry.file_id || '').trim();
        const fileName = String(entry.fileName || entry.file_name || '').trim();
        if (!viewUrl && !driveUrl && !mediaCode && !fileId) return;
        clean[docKey] = {
            mediaCode,
            fileId,
            viewUrl: viewUrl || driveUrl,
            driveUrl: driveUrl || viewUrl,
            fileName
        };
    });
    return clean;
}

function sanitizeSupabasePayloadNoPhotos(value, contextLabel = 'payload', depth = 0) {
    if (depth > 8 || value === null || value === undefined) return value;
    if (typeof value === 'string') {
        if (isForbiddenInlineMediaString(value)) {
            console.warn(`[PANTAU SE GUARD] Data foto/base64 diblokir sebelum dikirim ke Supabase (${contextLabel}).`);
            return '';
        }
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item, idx) => sanitizeSupabasePayloadNoPhotos(item, `${contextLabel}[${idx}]`, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach((k) => {
            if (PANTAU_FORBIDDEN_MEDIA_KEYS.has(k)) return;
            if (k === 'media_links') {
                out[k] = sanitizeMediaLinksMap(value[k]);
                return;
            }
            if (k === 'eviden_photo_url' || k === 'media_url' || k === 'view_url' || k === 'drive_url' || k === 'thumbnail_url') {
                const v = String(value[k] || '').trim();
                out[k] = v === '-' ? '-' : sanitizeSafeMediaUrl(v);
                return;
            }
            out[k] = sanitizeSupabasePayloadNoPhotos(value[k], `${contextLabel}.${k}`, depth + 1);
        });
        return out;
    }
    return value;
}

/* =====================================================================
 * 1. HELPER REST API SUPABASE (MODE HEMAT EGRESS: return=minimal DEFAULT)
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

/**
 * Default: Prefer `return=minimal` agar Supabase tidak mengirim balik payload penuh (hemat egress 50-90%).
 * Isi `{ returnData: true }` HANYA bila pemanggil membutuhkan `id` baru dari database.
 */
async function supabaseUpsert(table, rows, onConflict = '', options = {}) {
    if (!isSupabaseConfigured()) return null;
    const rawList = Array.isArray(rows) ? rows : [rows];
    if (rawList.length === 0) return [];
    const safePayload = sanitizeSupabasePayloadNoPhotos(rawList, table);
    const returnData = Boolean(options && options.returnData);
    const cfg = getPantauSeConfig();
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const prefer = onConflict
        ? `resolution=merge-duplicates,return=${returnData ? 'representation' : 'minimal'}`
        : `return=${returnData ? 'representation' : 'minimal'}`;
    const bodyStr = JSON.stringify(safePayload);
    const fetchOpts = {
        method: 'POST',
        headers: buildSupabaseHeaders({ Prefer: prefer }),
        body: bodyStr
    };
    if (options && options.keepalive && bodyStr.length < 60000) {
        fetchOpts.keepalive = true;
    }
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}${qs}`, fetchOpts);
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Supabase UPSERT ${table} gagal (${res.status}): ${errText}`);
    }
    if (!returnData || res.status === 204) return true;
    return res.json().catch(() => true);
}

async function supabasePatch(table, filterQuery, patchObj, options = {}) {
    if (!isSupabaseConfigured() || !filterQuery || !patchObj || typeof patchObj !== 'object') return null;
    const safePatch = sanitizeSupabasePayloadNoPhotos(patchObj, table);
    const returnData = Boolean(options && options.returnData);
    const cfg = getPantauSeConfig();
    const bodyStr = JSON.stringify(safePatch);
    const fetchOpts = {
        method: 'PATCH',
        headers: buildSupabaseHeaders({
            Prefer: returnData ? 'return=representation' : 'return=minimal'
        }),
        body: bodyStr
    };
    if (options && options.keepalive && bodyStr.length < 60000) {
        fetchOpts.keepalive = true;
    }
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${filterQuery}`, fetchOpts);
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Supabase PATCH ${table} gagal (${res.status}): ${errText}`);
    }
    if (!returnData || res.status === 204) return true;
    return res.json().catch(() => true);
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

    // Validasi ketat link hasil Google Drive (ZERO base64/foto dikirim ke Supabase)
    const safeDriveUrl = sanitizeSafeMediaUrl(json.driveUrl || '');
    const safeViewUrl = sanitizeSafeMediaUrl(json.viewUrl || '') || safeDriveUrl;
    const safeThumbUrl = sanitizeSafeMediaUrl(json.thumbnailUrl || '');
    json.driveUrl = safeDriveUrl;
    json.viewUrl = safeViewUrl;
    json.thumbnailUrl = safeThumbUrl;

    // Hanya indeks kode & link teks ringan (return=minimal, tanpa bytes foto)
    if (isSupabaseConfigured() && json.mediaCode && json.fileId && safeViewUrl) {
        supabaseUpsert('media_registry', {
            media_code: String(json.mediaCode),
            module: String(json.module || payload.module),
            ref_id: payload.refId,
            nrp: payload.nrp,
            label: payload.label,
            file_name: String(json.fileName || payload.fileName),
            mime_type: String(json.mimeType || payload.mimeType),
            size_bytes: Number(json.sizeBytes) || 0,
            drive_file_id: String(json.fileId),
            drive_url: safeDriveUrl || safeViewUrl,
            view_url: safeViewUrl,
            thumbnail_url: safeThumbUrl,
            spreadsheet_row: Number(json.sheetRow) || null,
            uploaded_by: payload.uploadedBy,
            status: 'ACTIVE'
        }, 'media_code', { returnData: false }).catch((err) => console.warn('Info media_registry:', err));
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
        supabasePatch('media_registry', `media_code=eq.${encodeURIComponent(mediaCode)}`, {
            status: 'DELETED'
        }).catch(() => {});
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
 * 3. ROW MAPPERS (REST & REALTIME) + PUSH HELPERS HEMAT EGRESS
 * ===================================================================== */

function parseMaybeJson(val, fallback) {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return parsed !== null && parsed !== undefined ? parsed : fallback;
        } catch (_) {
            return fallback;
        }
    }
    return fallback;
}

function mapSupabaseToManpower(r) {
    const docs = parseMaybeJson(r.docs, {});
    const mediaLinks = sanitizeMediaLinksMap(parseMaybeJson(r.media_links, {}));
    return {
        id: Number(r.id), nrp: String(r.nrp || ''), nama: String(r.nama || ''),
        jabatan: String(r.jabatan || ''), perusahaan: String(r.perusahaan || 'PPA'),
        domisili: String(r.domisili || 'Mess'), kontak: String(r.kontak || ''),
        email: String(r.email || ''), password: String(r.password || r.nrp || ''),
        bapak_asuh: String(r.bapak_asuh || ''),
        mcu_awal: r.mcu_awal || '', mcu_ulang: r.mcu_ulang || '',
        atr: Number(r.atr ?? 100),
        docs: (docs && typeof docs === 'object' && !Array.isArray(docs)) ? docs : {},
        media_links: mediaLinks
    };
}

function mapSupabaseToKomisioning(r) {
    return {
        id: Number(r.id), no_unit: String(r.no_unit || ''), model_tipe: String(r.model_tipe || ''),
        kategori_unit: String(r.kategori_unit || 'lifting'),
        hm_rate: Number(r.hm_rate ?? 10), rental_rate: Number(r.rental_rate ?? 0),
        KOMISIONING_BIB: r.komisioning_bib || '',
        KOMISIONING_TIA: r.komisioning_tia || '',
        KOMISIONING_TMA: r.komisioning_tma || '',
        media_links: sanitizeMediaLinksMap(parseMaybeJson(r.media_links, {}))
    };
}

function mapSupabaseToRoster(r) {
    const sched = parseMaybeJson(r.schedule_by_month, {});
    const units = parseMaybeJson(r.unit_by_month, {});
    return {
        id: Number(r.id), nrp: String(r.nrp || ''), nama: String(r.nama || ''),
        jabatan: String(r.jabatan || ''), unit: String(r.unit || '-'),
        offDay: String(r.off_day || '-'),
        scheduleByMonth: (sched && typeof sched === 'object') ? sched : {},
        unitByMonth: (units && typeof units === 'object') ? units : {}
    };
}

function mapSupabaseToPunishment(r) {
    return {
        id: Number(r.id), mpId: Number(r.mp_id), nrp: String(r.nrp || ''), nama: String(r.nama || ''),
        year: Number(r.year), monthIdx: Number(r.month_idx),
        tanggal: String(r.tanggal || ''), kategori: String(r.kategori || 'ATR'),
        tingkat: String(r.tingkat || 'CC'), noSurat: String(r.no_surat || ''),
        keterangan: String(r.keterangan || ''),
        evidenMediaCode: String(r.eviden_media_code || ''),
        evidenPhoto: sanitizeSafeMediaUrl(r.eviden_photo_url || ''),
        evidenDriveFileId: String(r.eviden_drive_file_id || ''),
        evidenPhotoName: String(r.eviden_photo_name || '')
    };
}

function mapSupabaseToInformasi(r, existingComments = []) {
    const audiens = parseMaybeJson(r.audiens, []);
    const links = parseMaybeJson(r.links, []);
    const likes = parseMaybeJson(r.likes, []);
    const reactions = parseMaybeJson(r.reactions, {});
    return {
        id: Number(r.id),
        kategori: String(r.kategori || 'OPERASIONAL'),
        judul: String(r.judul || ''),
        deskripsi: String(r.deskripsi || ''),
        audiensAll: Boolean(r.audiens_all),
        audiens: Array.isArray(audiens) ? audiens : [],
        links: Array.isArray(links) ? links : [],
        chatEnabled: r.chat_enabled !== undefined ? Boolean(r.chat_enabled) : true,
        chatCooldownValue: Number(r.chat_cooldown_value ?? 0),
        chatCooldownUnit: String(r.chat_cooldown_unit || 'minutes'),
        createdBy: String(r.created_by || 'Admin SE'),
        createdAtLabel: String(r.created_at_label || ''),
        editedBy: String(r.edited_by || ''),
        likes: Array.isArray(likes) ? likes : [],
        reactions: (reactions && typeof reactions === 'object' && !Array.isArray(reactions)) ? reactions : {},
        shares: Number(r.shares ?? 0) || 0,
        comments: Array.isArray(existingComments) ? existingComments : []
    };
}

function mapSupabaseToInformasiComment(c) {
    return {
        id: Number(c.id),
        informasiId: Number(c.informasi_id),
        authorKey: String(c.author_key || ''),
        authorName: String(c.author_name || ''),
        authorRole: String(c.author_role || ''),
        authorType: String(c.author_type || 'karyawan'),
        text: String(c.text || ''),
        timeLabel: String(c.time_label || ''),
        mediaCode: String(c.media_code || ''),
        mediaUrl: sanitizeSafeMediaUrl(c.media_url || '')
    };
}

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
        eviden_photo_url: sanitizeSafeMediaUrl(rec.evidenPhoto || ''),
        eviden_drive_file_id: String(rec.evidenDriveFileId || ''),
        eviden_photo_name: String(rec.evidenPhotoName || '')
    };
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
        media_links: sanitizeMediaLinksMap(m.media_links || {})
    };
}

async function pushRosterPicToSupabase(entries = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const list = Array.isArray(entries)
            ? entries
            : (typeof getRosterPicSupabasePayload === 'function' ? getRosterPicSupabasePayload() : []);
        if (!list.length) return [];
        const res = await supabaseUpsert('roster_pic', list, 'submenu_key', { returnData: false });
        list.forEach((row) => emitPantauRealtimeBroadcast('roster_pic', 'UPSERT', row));
        schedulePersistLocalCache();
        return res;
    } catch (err) {
        console.warn('Gagal menyinkronkan roster_pic ke Supabase:', err);
        return null;
    }
}

async function pushRosterRowsToSupabase(rows = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const src = Array.isArray(rows) ? rows : (rows ? [rows] : (typeof rosterState !== 'undefined' ? rosterState : []));
        const payload = src.map(mapRosterRowToSupabase).filter(x => x.nrp && x.nrp !== '-');
        if (!payload.length) return [];
        // Chunk per 100 baris agar payload hemat & tidak timeout
        for (let i = 0; i < payload.length; i += 100) {
            await supabaseUpsert('roster_bulanan', payload.slice(i, i + 100), 'nrp', { returnData: false });
        }
        if (payload.length <= 20) {
            payload.forEach((row) => emitPantauRealtimeBroadcast('roster_bulanan', 'UPSERT', row));
        } else {
            emitPantauRealtimeBroadcast('roster_bulanan', 'REFRESH', { count: payload.length });
        }
        schedulePersistLocalCache();
        return true;
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
        // 1 batch DELETE query menggunakan PostgREST `in.(...)` (hemat Log Query!)
        const inExpr = cleanNrps.map(n => `"${n.replace(/"/g, '')}"`).join(',');
        await supabaseDelete('roster_bulanan', `nrp=in.(${encodeURIComponent(inExpr)})`);
        cleanNrps.forEach((nrp) => emitPantauRealtimeBroadcast('roster_bulanan', 'DELETE', { nrp }));
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menghapus baris roster_bulanan di Supabase:', err);
        return null;
    }
}

async function pushManpowerRowsToSupabase(rows = null) {
    if (!isSupabaseConfigured()) return null;
    try {
        const src = Array.isArray(rows) ? rows : (rows ? [rows] : (typeof manpowerState !== 'undefined' ? manpowerState : []));
        const payload = src.map(mapManpowerRowToSupabase).filter(x => x.nrp);
        if (!payload.length) return [];
        for (let i = 0; i < payload.length; i += 100) {
            await supabaseUpsert('manpower', payload.slice(i, i + 100), 'nrp', { returnData: false });
        }
        if (payload.length <= 15) {
            payload.forEach((row) => emitPantauRealtimeBroadcast('manpower', 'UPSERT', row));
        } else {
            emitPantauRealtimeBroadcast('manpower', 'REFRESH', { count: payload.length });
        }
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menyinkronkan manpower ke Supabase:', err);
        return null;
    }
}

async function patchManpowerMediaLinksToSupabase(nrp, mediaLinks) {
    if (!isSupabaseConfigured() || !nrp) return null;
    try {
        const cleanLinks = sanitizeMediaLinksMap(mediaLinks || {});
        await supabasePatch('manpower', `nrp=eq.${encodeURIComponent(String(nrp).trim())}`, {
            media_links: cleanLinks
        });
        emitPantauRealtimeBroadcast('manpower', 'PATCH_MEDIA', { nrp: String(nrp).trim(), media_links: cleanLinks });
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menyinkronkan link dokumen manpower ke Supabase:', err);
        return null;
    }
}

async function pushPunishmentRecordToSupabase(rec) {
    if (!isSupabaseConfigured() || !rec) return null;
    try {
        const row = mapPunishmentToSupabaseRow(rec);
        const existingDbId = (Number(rec.id) > 0 && Number(rec.id) < 1e12) ? Number(rec.id) : 0;
        let savedRow = null;
        if (existingDbId) {
            await supabasePatch('atr_punishment_history', `id=eq.${existingDbId}`, row);
            savedRow = { ...row, id: existingDbId };
        } else {
            const res = await supabaseUpsert('atr_punishment_history', row, '', { returnData: true });
            savedRow = (Array.isArray(res) && res[0]) ? res[0] : null;
        }
        if (savedRow) {
            markLocalRecentWrite('atr_punishment_history', savedRow.id);
            emitPantauRealtimeBroadcast('atr_punishment_history', existingDbId ? 'UPDATE' : 'INSERT', savedRow);
            schedulePersistLocalCache();
        }
        return savedRow;
    } catch (err) {
        console.warn('Gagal menyinkronkan punishment ke Supabase:', err);
        return null;
    }
}

async function deletePunishmentRecordFromSupabase(recordId) {
    if (!isSupabaseConfigured() || !recordId) return null;
    const numId = Number(recordId);
    if (!numId || numId >= 1e12) return null;
    try {
        await supabaseDelete('atr_punishment_history', `id=eq.${numId}`);
        markLocalRecentWrite('atr_punishment_history', numId);
        emitPantauRealtimeBroadcast('atr_punishment_history', 'DELETE', { id: numId });
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menghapus punishment di Supabase:', err);
        return null;
    }
}

async function pushAbsensiRecordsToSupabase(entries = null) {
    if (!isSupabaseConfigured()) return null;
    const sourceList = Array.isArray(entries)
        ? entries
        : Object.entries(typeof absensiRecordsState !== 'undefined' ? absensiRecordsState : {}).map(([k, v]) => ({ recordKey: k, ...v }));
    const payload = sourceList
        .map((rec) => {
            const mpNum = Number(rec.mpId ?? rec.mp_id);
            const dateStr = String(rec.date || rec.tanggal || '').trim();
            const rKey = String(rec.recordKey || rec.record_key || (mpNum && dateStr ? `${mpNum}::${dateStr}` : '')).trim();
            if (!rKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
            return {
                record_key: rKey,
                mp_id: (mpNum > 0 && mpNum < 1e12) ? mpNum : null,
                nrp: String(rec.nrp || '').trim(),
                tanggal: dateStr,
                code: String(rec.code || '-'),
                shift: String(rec.shift || '-'),
                cekin: String(rec.cekin || ''),
                status: String(rec.status || '-'),
                note: String(rec.note || '')
            };
        })
        .filter(Boolean);
    if (!payload.length) return [];

    try {
        for (let i = 0; i < payload.length; i += 100) {
            const batch = payload.slice(i, i + 100);
            await supabaseUpsert('absensi_harian', batch, 'record_key', {
                returnData: false,
                keepalive: payload.length <= 20
            });
        }
        if (payload.length <= 15) {
            payload.forEach((row) => emitPantauRealtimeBroadcast('absensi_harian', 'UPSERT', row));
        } else {
            emitPantauRealtimeBroadcast('absensi_harian', 'REFRESH', { count: payload.length });
        }
        return true;
    } catch (err) {
        console.warn('Gagal menyinkronkan data absensi ke Supabase:', err);
        return null;
    }
}

async function deleteAbsensiRecordsFromSupabase(recordKeys = []) {
    if (!isSupabaseConfigured()) return null;
    const cleanKeys = (Array.isArray(recordKeys) ? recordKeys : [recordKeys])
        .map(k => String(k || '').trim())
        .filter(Boolean);
    if (!cleanKeys.length) return true;
    try {
        for (let i = 0; i < cleanKeys.length; i += 50) {
            const chunk = cleanKeys.slice(i, i + 50);
            const inExpr = chunk.map(k => `"${k.replace(/"/g, '\\"')}"`).join(',');
            await supabaseDelete('absensi_harian', `record_key=in.(${encodeURIComponent(inExpr)})`);
        }
        if (cleanKeys.length <= 15) {
            cleanKeys.forEach((k) => emitPantauRealtimeBroadcast('absensi_harian', 'DELETE', { record_key: k }));
        } else {
            emitPantauRealtimeBroadcast('absensi_harian', 'REFRESH', { count: cleanKeys.length });
        }
        return true;
    } catch (err) {
        console.warn('Gagal menghapus data absensi di Supabase:', err);
        return null;
    }
}

/* =====================================================================
 * 3B. PRIORITAS UTAMA: PUSH & REALTIME BERANDA (PUSAT INFORMASI & CHAT)
 * ===================================================================== */

let _pantauInfoSocialColsSupported = true;
const _pantauInfoSocialDebounceTimers = {};
const _pantauLocalRecentWrites = new Map(); // key -> timestamp

function markLocalRecentWrite(table, id) {
    if (!table || id === undefined || id === null) return;
    _pantauLocalRecentWrites.set(`${table}:${id}`, Date.now());
    // Bersihkan entri > 30 detik
    if (_pantauLocalRecentWrites.size > 150) {
        const now = Date.now();
        _pantauLocalRecentWrites.forEach((ts, k) => {
            if (now - ts > 30000) _pantauLocalRecentWrites.delete(k);
        });
    }
}

function isLocalRecentWrite(table, id, windowMs = 15000) {
    const ts = _pantauLocalRecentWrites.get(`${table}:${id}`);
    return Boolean(ts && (Date.now() - ts) < windowMs);
}

function buildInformasiSupabaseRow(item, includeSocial = true) {
    const row = {
        kategori: String(item.kategori || 'OPERASIONAL'),
        judul: String(item.judul || ''),
        deskripsi: String(item.deskripsi || ''),
        audiens_all: Boolean(item.audiensAll),
        audiens: Array.isArray(item.audiens) ? item.audiens : [],
        links: Array.isArray(item.links) ? item.links : [],
        chat_enabled: Boolean(item.chatEnabled),
        chat_cooldown_value: Number(item.chatCooldownValue ?? 0),
        chat_cooldown_unit: String(item.chatCooldownUnit || 'minutes'),
        created_by: String(item.createdBy || 'Admin SE'),
        created_at_label: String(item.createdAtLabel || ''),
        edited_by: String(item.editedBy || '')
    };
    if (includeSocial && _pantauInfoSocialColsSupported) {
        row.likes = Array.isArray(item.likes) ? item.likes : [];
        row.reactions = (item.reactions && typeof item.reactions === 'object') ? item.reactions : {};
        row.shares = Number(item.shares ?? 0) || 0;
    }
    return row;
}

async function pushInformasiPostToSupabase(item, isNew = false, options = {}) {
    if (!item) return null;
    const tempId = Number(item.id);
    const shouldInsert = Boolean(isNew || !tempId || tempId >= 1e12);
    const throwOnError = Boolean(options && options.throwOnError);

    if (!isSupabaseConfigured()) {
        item._pendingSync = true;
        item._pendingAction = shouldInsert ? 'insert' : 'update';
        persistBerandaCacheNow();
        return null;
    }

    const tryWrite = async (withSocial) => {
        const row = buildInformasiSupabaseRow(item, withSocial);
        if (shouldInsert) {
            const res = await supabaseUpsert('pusat_informasi', row, '', { returnData: true, keepalive: true });
            return (Array.isArray(res) && res[0]) ? res[0] : null;
        }
        await supabasePatch('pusat_informasi', `id=eq.${tempId}`, row, { keepalive: true });
        return { ...row, id: tempId, updated_at: new Date().toISOString() };
    };

    try {
        let saved = null;
        try {
            saved = await tryWrite(true);
        } catch (err) {
            if (String(err?.message || '').includes('PGRST204') || String(err?.message || '').includes('column')) {
                _pantauInfoSocialColsSupported = false;
                saved = await tryWrite(false);
            } else {
                throw err;
            }
        }
        if (saved && saved.id) {
            const realId = Number(saved.id);
            item.id = realId;
            delete item._pendingSync;
            delete item._pendingAction;
            delete item._syncError;

            // Sinkronkan state & hapus duplikat bila event Realtime sudah lebih dulu memasukkan realId
            if (typeof informasiState !== 'undefined' && Array.isArray(informasiState)) {
                const seenReal = [];
                informasiState = informasiState.filter((it) => {
                    if (Number(it.id) !== realId) return true;
                    if (seenReal.length === 0) {
                        seenReal.push(it);
                        return true;
                    }
                    if (Array.isArray(it.comments) && it.comments.length) {
                        const dst = seenReal[0];
                        if (!Array.isArray(dst.comments)) dst.comments = [];
                        it.comments.forEach((c) => {
                            if (!dst.comments.some(x => Number(x.id) === Number(c.id))) dst.comments.push(c);
                        });
                    }
                    return false;
                });
            }
            if (typeof expandedInfoCommentIds !== 'undefined' && tempId && tempId !== realId && expandedInfoCommentIds.has(tempId)) {
                expandedInfoCommentIds.delete(tempId);
                expandedInfoCommentIds.add(realId);
            }
            if (typeof activeInfoChatId !== 'undefined' && tempId && Number(activeInfoChatId) === tempId) {
                activeInfoChatId = realId;
            }

            markLocalRecentWrite('pusat_informasi', realId);
            // Simpan cache lokal Beranda SECARA SINKRON terlebih dahulu agar watermark tidak pernah lebih maju dari cache
            persistBerandaCacheNow();
            updateTableWatermark('pusat_informasi', saved.updated_at || saved.created_at || new Date().toISOString());
            emitPantauRealtimeBroadcast('pusat_informasi', shouldInsert ? 'INSERT' : 'UPDATE', saved);
            schedulePersistLocalCache();
        }
        return saved;
    } catch (err) {
        item._pendingSync = true;
        item._pendingAction = shouldInsert ? 'insert' : 'update';
        item._syncError = String(err?.message || 'Gagal terhubung ke server');
        persistBerandaCacheNow();
        console.error('Gagal menyinkronkan informasi Beranda ke Supabase:', err);
        if (throwOnError) throw err;
        return null;
    }
}

async function deleteInformasiPostFromSupabase(infoId) {
    persistBerandaCacheNow();
    if (!isSupabaseConfigured() || !infoId) return null;
    const numId = Number(infoId);
    if (!numId || numId >= 1e12) return true;
    try {
        await supabaseDelete('pusat_informasi', `id=eq.${numId}`);
        markLocalRecentWrite('pusat_informasi', numId);
        emitPantauRealtimeBroadcast('pusat_informasi', 'DELETE', { id: numId });
        persistBerandaCacheNow();
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menghapus informasi Beranda di Supabase:', err);
        return null;
    }
}

async function pushInformasiCommentToSupabase(infoId, commentObj) {
    if (!infoId || !commentObj) return null;
    persistBerandaCacheNow();
    if (!isSupabaseConfigured()) {
        commentObj._pendingSync = true;
        persistBerandaCacheNow();
        return null;
    }
    const numInfoId = Number(infoId);
    if (!numInfoId || numInfoId >= 1e12) {
        commentObj._pendingSync = true;
        persistBerandaCacheNow();
        return null;
    }
    try {
        const row = {
            informasi_id: numInfoId,
            author_key: String(commentObj.authorKey || ''),
            author_name: String(commentObj.authorName || ''),
            author_role: String(commentObj.authorRole || ''),
            author_type: String(commentObj.authorType || 'karyawan'),
            text: String(commentObj.text || ''),
            time_label: String(commentObj.timeLabel || ''),
            media_code: String(commentObj.mediaCode || ''),
            media_url: sanitizeSafeMediaUrl(commentObj.mediaUrl || '')
        };
        const res = await supabaseUpsert('pusat_informasi_komentar', row, '', { returnData: true, keepalive: true });
        const saved = (Array.isArray(res) && res[0]) ? res[0] : null;
        if (saved && saved.id) {
            commentObj.id = Number(saved.id);
            delete commentObj._pendingSync;
            markLocalRecentWrite('pusat_informasi_komentar', saved.id);
            persistBerandaCacheNow();
            updateTableWatermark('pusat_informasi_komentar', saved.id);
            emitPantauRealtimeBroadcast('pusat_informasi_komentar', 'INSERT', saved);
            schedulePersistLocalCache();
        }
        return saved;
    } catch (err) {
        commentObj._pendingSync = true;
        persistBerandaCacheNow();
        console.warn('Gagal menyinkronkan komentar Beranda ke Supabase:', err);
        return null;
    }
}

async function flushPendingInformasiToSupabase() {
    if (!isSupabaseConfigured() || typeof informasiState === 'undefined' || !Array.isArray(informasiState)) return 0;
    let flushed = 0;

    // 1. Kirim ulang postingan Beranda yang masih pending / punya tempId
    const pendingPosts = informasiState.filter(it => it && (it._pendingSync || Number(it.id) >= 1e12));
    for (const post of pendingPosts) {
        const isInsert = post._pendingAction === 'insert' || Number(post.id) >= 1e12;
        const saved = await pushInformasiPostToSupabase(post, isInsert);
        if (saved && saved.id) flushed++;
    }

    // 2. Kirim ulang komentar yang masih pending pada postingan yang sudah punya ID valid
    for (const post of informasiState) {
        if (!post || Number(post.id) >= 1e12 || !Array.isArray(post.comments)) continue;
        const pendingComments = post.comments.filter(c => c && (c._pendingSync || Number(c.id) >= 1e12));
        for (const c of pendingComments) {
            const savedC = await pushInformasiCommentToSupabase(post.id, c);
            if (savedC && savedC.id) flushed++;
        }
    }

    if (flushed > 0) {
        persistBerandaCacheNow();
    }
    return flushed;
}

async function deleteInformasiCommentFromSupabase(infoId, commentId) {
    persistBerandaCacheNow();
    if (!isSupabaseConfigured() || !commentId) return null;
    const numCommentId = Number(commentId);
    if (!numCommentId || numCommentId >= 1e12) return true;
    try {
        await supabaseDelete('pusat_informasi_komentar', `id=eq.${numCommentId}`);
        markLocalRecentWrite('pusat_informasi_komentar', numCommentId);
        emitPantauRealtimeBroadcast('pusat_informasi_komentar', 'DELETE', { id: numCommentId, informasi_id: Number(infoId) });
        persistBerandaCacheNow();
        schedulePersistLocalCache();
        return true;
    } catch (err) {
        console.warn('Gagal menghapus komentar Beranda di Supabase:', err);
        return null;
    }
}

/**
 * Debounced 700ms per infoId agar klik like/emoji beruntun hanya mengirim 1 PATCH kecil (`return=minimal`).
 */
function schedulePatchInformasiSocial(item) {
    if (!item || !item.id || Number(item.id) >= 1e12) return;
    const idKey = String(item.id);
    if (_pantauInfoSocialDebounceTimers[idKey]) {
        clearTimeout(_pantauInfoSocialDebounceTimers[idKey]);
    }
    _pantauInfoSocialDebounceTimers[idKey] = setTimeout(async () => {
        delete _pantauInfoSocialDebounceTimers[idKey];
        const latest = (typeof informasiState !== 'undefined' && Array.isArray(informasiState))
            ? informasiState.find(i => Number(i.id) === Number(item.id))
            : item;
        if (!latest) return;
        const socialPayload = {
            id: Number(latest.id),
            likes: Array.isArray(latest.likes) ? latest.likes : [],
            reactions: (latest.reactions && typeof latest.reactions === 'object') ? latest.reactions : {},
            shares: Number(latest.shares ?? 0) || 0
        };
        // Broadcast realtime tetap berjalan seketika ke perangkat lain
        markLocalRecentWrite('pusat_informasi', latest.id);
        emitPantauRealtimeBroadcast('pusat_informasi', 'PATCH_SOCIAL', socialPayload);
        schedulePersistLocalCache();

        if (!isSupabaseConfigured() || !_pantauInfoSocialColsSupported) return;
        try {
            await supabasePatch('pusat_informasi', `id=eq.${Number(latest.id)}`, {
                likes: socialPayload.likes,
                reactions: socialPayload.reactions,
                shares: socialPayload.shares
            });
        } catch (err) {
            if (String(err?.message || '').includes('PGRST204') || String(err?.message || '').includes('column')) {
                _pantauInfoSocialColsSupported = false;
            }
        }
    }, 700);
}

/* =====================================================================
 * 4. CACHE SNAPSHOT LOKAL + WATERMARK DELTA SYNC + LAZY SECTION SYNC
 * ===================================================================== */

const PANTAU_CLOUD_CACHE_KEY = 'pantau_se_cloud_cache_v2';
const PANTAU_BERANDA_CACHE_KEY = 'pantau_se_beranda_cache_v1';
const PANTAU_WATERMARK_KEY = 'pantau_se_sync_watermarks_v2';
const PANTAU_MASTER_TTL_MS = 15 * 60 * 1000; // Master data jarang berubah: cache 15 menit
const PANTAU_REFRESH_COOLDOWN_MS = 5000;

let _pantauWatermarks = {};
let _pantauCacheSaveTimer = null;
let _pantauSyncedGroups = new Set();
let _pantauInFlightGroups = new Map();
let _pantauLastManualSyncAt = 0;
let _pantauBootstrapped = false;

function loadSyncWatermarks() {
    try {
        const raw = localStorage.getItem(PANTAU_WATERMARK_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        _pantauWatermarks = (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) {
        _pantauWatermarks = {};
    }
    return _pantauWatermarks;
}

function saveSyncWatermarks() {
    try {
        localStorage.setItem(PANTAU_WATERMARK_KEY, JSON.stringify(_pantauWatermarks));
    } catch (_) { /* ignore quota */ }
}

function updateTableWatermark(table, val) {
    if (!table || val === undefined || val === null || val === '') return;
    if (table === 'pusat_informasi_komentar') {
        const num = Number(val);
        if (!Number.isNaN(num) && num > (Number(_pantauWatermarks[table]) || 0)) {
            _pantauWatermarks[table] = num;
            saveSyncWatermarks();
        }
        return;
    }
    const str = String(val);
    if (!_pantauWatermarks[table] || str > String(_pantauWatermarks[table])) {
        _pantauWatermarks[table] = str;
        saveSyncWatermarks();
    }
}

function advanceWatermarkFromRows(table, rows) {
    if (!Array.isArray(rows) || !rows.length) return;
    if (table === 'pusat_informasi_komentar') {
        let maxId = Number(_pantauWatermarks[table]) || 0;
        rows.forEach((r) => {
            const id = Number(r.id) || 0;
            if (id > maxId) maxId = id;
        });
        if (maxId > 0) _pantauWatermarks[table] = maxId;
        saveSyncWatermarks();
        return;
    }
    let maxTs = String(_pantauWatermarks[table] || '');
    rows.forEach((r) => {
        const ts = String(r.updated_at || r.created_at || '');
        if (ts && ts > maxTs) maxTs = ts;
    });
    if (maxTs) {
        _pantauWatermarks[table] = maxTs;
        saveSyncWatermarks();
    }
}

function stripTransientFromArray(arr, type) {
    if (!Array.isArray(arr)) return [];
    if (type === 'manpower') {
        return arr.map((m) => ({
            ...m,
            media_links: sanitizeMediaLinksMap(m.media_links || {})
        }));
    }
    if (type === 'punishment') {
        return arr.map((p) => {
            const copy = { ...p };
            delete copy._localEvidenPreview;
            copy.evidenPhoto = sanitizeSafeMediaUrl(copy.evidenPhoto || '');
            return copy;
        });
    }
    return arr;
}

function persistBerandaCacheNow() {
    try {
        if (typeof informasiState === 'undefined' || !Array.isArray(informasiState)) return;
        const payload = {
            savedAt: Date.now(),
            informasiState: informasiState.slice(0, 120)
        };
        localStorage.setItem(PANTAU_BERANDA_CACHE_KEY, JSON.stringify(payload));
    } catch (_) {
        /* abaikan bila storage penuh/privat */
    }
}

function readBerandaCacheFromStorage() {
    try {
        const raw = localStorage.getItem(PANTAU_BERANDA_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.informasiState)) return parsed.informasiState;
    } catch (_) { /* ignore */ }
    return null;
}

function persistLocalCacheNow() {
    persistBerandaCacheNow();
    try {
        const snapshot = {
            savedAt: Date.now(),
            masterSavedAt: _pantauWatermarks._masterSavedAt || 0,
            masterJabatanState: typeof masterJabatanState !== 'undefined' ? masterJabatanState : [],
            masterPerusahaanState: typeof masterPerusahaanState !== 'undefined' ? masterPerusahaanState : [],
            masterKodeRosterState: typeof masterKodeRosterState !== 'undefined' ? masterKodeRosterState : [],
            masterKodeSpiState: typeof masterKodeSpiState !== 'undefined' ? masterKodeSpiState : [],
            manpowerState: typeof manpowerState !== 'undefined' ? stripTransientFromArray(manpowerState, 'manpower') : [],
            rosterState: typeof rosterState !== 'undefined' ? rosterState : [],
            informasiState: typeof informasiState !== 'undefined' ? informasiState.slice(0, 120) : []
        };
        const serialized = JSON.stringify(snapshot);
        // Batasi cache snapshot <= 2.5 MB agar aman dari quota localStorage
        if (serialized.length < 2600000) {
            localStorage.setItem(PANTAU_CLOUD_CACHE_KEY, serialized);
        }
    } catch (_) {
        /* abaikan bila quota penuh */
    }
}

function schedulePersistLocalCache() {
    persistBerandaCacheNow();
    if (_pantauCacheSaveTimer) clearTimeout(_pantauCacheSaveTimer);
    _pantauCacheSaveTimer = setTimeout(() => {
        _pantauCacheSaveTimer = null;
        persistLocalCacheNow();
    }, 1500);
}

function hydrateStateFromLocalCache() {
    loadSyncWatermarks();
    let hydratedAny = false;

    // 1. Prioritas #1: Muat cache khusus Beranda (ringan & terpisah dari snapshot besar)
    const cachedBeranda = readBerandaCacheFromStorage();
    if (Array.isArray(cachedBeranda) && cachedBeranda.length) {
        informasiState = cachedBeranda;
        hydratedAny = true;
    }

    try {
        const raw = localStorage.getItem(PANTAU_CLOUD_CACHE_KEY);
        if (raw) {
            const snap = JSON.parse(raw);
            if (snap && typeof snap === 'object') {
                if (Array.isArray(snap.masterJabatanState) && snap.masterJabatanState.length) {
                    masterJabatanState = snap.masterJabatanState;
                    hydratedAny = true;
                }
                if (Array.isArray(snap.masterPerusahaanState) && snap.masterPerusahaanState.length) {
                    masterPerusahaanState = snap.masterPerusahaanState;
                    hydratedAny = true;
                }
                if (Array.isArray(snap.masterKodeRosterState) && snap.masterKodeRosterState.length) {
                    masterKodeRosterState = snap.masterKodeRosterState;
                    hydratedAny = true;
                }
                if (Array.isArray(snap.masterKodeSpiState) && snap.masterKodeSpiState.length) {
                    masterKodeSpiState = snap.masterKodeSpiState;
                    hydratedAny = true;
                }
                if (Array.isArray(snap.manpowerState) && snap.manpowerState.length) {
                    manpowerState = snap.manpowerState;
                    hydratedAny = true;
                }
                if (Array.isArray(snap.rosterState) && snap.rosterState.length) {
                    rosterState = snap.rosterState;
                    hydratedAny = true;
                }
                if ((!Array.isArray(informasiState) || !informasiState.length) && Array.isArray(snap.informasiState) && snap.informasiState.length) {
                    informasiState = snap.informasiState;
                    hydratedAny = true;
                }
            }
        }
    } catch (_) {
        /* abaikan bila cache snapshot corrupt */
    }

    if (hydratedAny) {
        if (typeof syncMasterDropdownOptions === 'function') syncMasterDropdownOptions();
        refreshViewsForGroup('beranda');
        refreshViewsForGroup('core');
    }
    return hydratedAny;
}

/* =====================================================================
 * 4B. PROYEKSI KOLOM EKPLISIT & MERGE DELTA PER TABEL
 * ===================================================================== */

const TABLE_SELECT_QUERIES = {
    // Master (TTL 15 menit)
    master_jabatan: 'select=id,nama,updated_at&order=id.asc',
    master_perusahaan: 'select=id,kode,keterangan,updated_at&order=id.asc',
    master_kode_roster: 'select=id,kode,arti_sistem,keterangan,updated_at&order=id.asc',
    master_kode_spi: 'select=id,tahun,bulan,kode_pengawas,kode_operator,keterangan,updated_at&order=tahun.asc,bulan.asc',
    // Priority #1: Beranda
    pusat_informasi: 'select=id,kategori,judul,deskripsi,audiens_all,audiens,links,chat_enabled,chat_cooldown_value,chat_cooldown_unit,created_by,created_at_label,edited_by,likes,reactions,shares,updated_at&order=id.desc&limit=120',
    pusat_informasi_fallback: 'select=id,kategori,judul,deskripsi,audiens_all,audiens,links,chat_enabled,chat_cooldown_value,chat_cooldown_unit,created_by,created_at_label,edited_by,updated_at&order=id.desc&limit=120',
    pusat_informasi_komentar: 'select=id,informasi_id,author_key,author_name,author_role,author_type,text,time_label,media_code,media_url&order=id.asc&limit=500',
    // Core (Semua role)
    manpower: 'select=id,nrp,nama,jabatan,perusahaan,domisili,kontak,email,password,bapak_asuh,mcu_awal,mcu_ulang,atr,docs,media_links,updated_at&order=id.asc',
    roster_bulanan: 'select=id,nrp,nama,jabatan,unit,off_day,schedule_by_month,unit_by_month,updated_at&order=id.asc',
    roster_pic: 'select=id,submenu_key,pic_nrp,pic_nama,updated_by,updated_at&order=id.asc',
    // Lazy Group: Performa
    absensi_harian: 'select=record_key,mp_id,tanggal,code,shift,cekin,status,note,updated_at&order=tanggal.desc&limit=2000',
    atr_weekly: 'select=record_key,atr,nc,s,i,a,periode,updated_at&limit=1500',
    atr_monthly: 'select=record_key,atr,nc,s,i,a,updated_at&limit=1500',
    atr_punishment_history: 'select=id,mp_id,nrp,nama,year,month_idx,tanggal,kategori,tingkat,no_surat,keterangan,eviden_media_code,eviden_photo_url,eviden_drive_file_id,eviden_photo_name,updated_at&order=id.desc&limit=500',
    kpi_pengawas: 'select=record_key,sap,closing_rate,sqi,atr_individu,atr_anak_asuh,status,updated_at_label,updated_at&limit=800',
    // Lazy Group: Utilitas
    komisioning_unit: 'select=id,no_unit,model_tipe,kategori_unit,hm_rate,rental_rate,komisioning_bib,komisioning_tia,komisioning_tma,media_links,updated_at&order=id.asc',
    hm_ua_daily: 'select=record_key,unit,tanggal,shift,nrp,hm_start,hm_stop,hm_diff,hm_aktual,updated_at&order=tanggal.desc&limit=1500',
    ua_weekly_upload: 'select=record_key,total,shift_count,updated_at&limit=800',
    ua_mtd_upload: 'select=record_key,total,days,shifts,updated_at&limit=800',
    rental_bib: 'select=id,tanggal,no_unit,shift,hm_awal,hm_akhir,total_hm,hm_charge,rental_rate,total,job,operator,pic_dept,updated_at&order=tanggal.desc,id.desc&limit=500',
    big_crane_timeframe: 'select=id,no_unit,user_dept,pekerjaan,lokasi,status,month_idx,year,planning,aktual,updated_at&order=id.asc&limit=400',
    // Lazy Group: Operasional
    operasional_lt_wt: 'select=id,no_id,timestamp_raw,jenis_job,plan,waktu,shift,type_unit,no_unit,cluster,lokasi,hm_start,hm_end,tgl_action,start_time,end_time,durasi,status,temuan_kendala,armada,opt,mp_1,mp_2,source_sheet,updated_at&order=id.desc&limit=500',
    operasional_lifting: 'select=id,no_wo,timestamp_raw,kategori,nrp_pemohon,nama_pemohon,perusahaan,departemen,section,no_wa,tgl_pelaksanaan,jam_pelaksanaan,shift,durasi_request,lokasi_asal,lokasi_tujuan,deskripsi,status,gl,unit,operator,rigger_1,rigger_2,jam_start_aktual,jam_end_aktual,durasi_aktual,final_inspeksi,kendala_lapangan,updated_at&order=id.desc&limit=500'
};

function getActiveRoleTypeForSync() {
    try {
        if (typeof getPantauAuthSession === 'function') {
            const sess = getPantauAuthSession();
            if (sess?.type) return String(sess.type).toLowerCase();
        }
        if (typeof getActiveUserProfile === 'function') {
            const prof = getActiveUserProfile();
            if (prof?.type) return String(prof.type).toLowerCase();
        }
    } catch (_) { /* ignore */ }
    return 'karyawan';
}

function isRoleAllowedForSyncGroup(group) {
    const role = getActiveRoleTypeForSync();
    if (group === 'beranda' || group === 'core' || group === 'operasional') return true;
    // Manpower (karyawan) hanya memakai Beranda, KPI SE (operasional), dan Roster (core)
    if (role === 'karyawan') return false;
    return true;
}

function buildDeltaQuery(table, baseQuery, useDelta) {
    if (!useDelta) return baseQuery;
    const wm = _pantauWatermarks[table];
    if (!wm) return baseQuery;
    if (table === 'pusat_informasi_komentar') {
        return `${baseQuery}&id=gt.${encodeURIComponent(String(wm))}`;
    }
    return `${baseQuery}&updated_at=gt.${encodeURIComponent(String(wm))}`;
}

function mergeArrayByKey(targetArr, incomingItems, keyFn, prependNew = false) {
    const map = new Map();
    const result = Array.isArray(targetArr) ? [...targetArr] : [];
    result.forEach((item, idx) => map.set(String(keyFn(item)), idx));
    incomingItems.forEach((item) => {
        const k = String(keyFn(item));
        if (map.has(k)) {
            result[map.get(k)] = item;
        } else if (prependNew) {
            result.unshift(item);
            // Re-index map
            map.clear();
            result.forEach((it, idx) => map.set(String(keyFn(it)), idx));
        } else {
            map.set(k, result.length);
            result.push(item);
        }
    });
    return result;
}

function applyFetchedTableRows(table, rows, isDelta = false) {
    if (!Array.isArray(rows)) return false;
    advanceWatermarkFromRows(table, rows);
    if (isDelta && rows.length === 0) return false;

    switch (table) {
        case 'master_jabatan':
            if (rows.length || !isDelta) {
                const mapped = rows.map(r => ({ id: r.id, nama: r.nama }));
                masterJabatanState = isDelta ? mergeArrayByKey(masterJabatanState, mapped, x => x.id) : mapped;
            }
            return true;
        case 'master_perusahaan':
            if (rows.length || !isDelta) {
                const mapped = rows.map(r => ({ id: r.id, kode: r.kode, keterangan: r.keterangan || '' }));
                masterPerusahaanState = isDelta ? mergeArrayByKey(masterPerusahaanState, mapped, x => x.id) : mapped;
            }
            return true;
        case 'master_kode_roster':
            if (rows.length || !isDelta) {
                const mapped = rows.map(r => ({ id: r.id, kode: r.kode, artiSistem: r.arti_sistem || 'SHIFT_1', keterangan: r.keterangan || '' }));
                masterKodeRosterState = isDelta ? mergeArrayByKey(masterKodeRosterState, mapped, x => x.id) : mapped;
            }
            return true;
        case 'master_kode_spi':
            if (rows.length || !isDelta) {
                const mapped = rows.map(r => ({
                    id: r.id, tahun: r.tahun, bulan: r.bulan,
                    kodePengawas: r.kode_pengawas || '', kodeOperator: r.kode_operator || '',
                    keterangan: r.keterangan || ''
                }));
                masterKodeSpiState = isDelta ? mergeArrayByKey(masterKodeSpiState, mapped, x => x.id) : mapped;
            }
            return true;
        case 'manpower':
            if (rows.length || !isDelta) {
                const mapped = rows.map(mapSupabaseToManpower);
                manpowerState = isDelta ? mergeArrayByKey(manpowerState, mapped, x => String(x.nrp || x.id)) : mapped;
            }
            return true;
        case 'komisioning_unit':
            if (rows.length || !isDelta) {
                const mapped = rows.map(mapSupabaseToKomisioning);
                komisioningState = isDelta ? mergeArrayByKey(komisioningState, mapped, x => String(x.no_unit || x.id)) : mapped;
            }
            return true;
        case 'roster_bulanan':
            if (rows.length || !isDelta) {
                const mapped = rows.map(mapSupabaseToRoster);
                rosterState = isDelta ? mergeArrayByKey(rosterState, mapped, x => String(x.nrp || x.id)) : mapped;
            }
            return true;
        case 'roster_pic':
            if (rows.length && typeof hydrateRosterPicFromSupabase === 'function') {
                hydrateRosterPicFromSupabase(rows);
            }
            return rows.length > 0;
        case 'absensi_harian':
            rows.forEach((r) => {
                if (!r.record_key) return;
                absensiRecordsState[r.record_key] = {
                    mpId: r.mp_id, date: r.tanggal, code: r.code || '-',
                    shift: r.shift || '-', cekin: r.cekin || '', status: r.status || '-', note: r.note || ''
                };
            });
            return rows.length > 0;
        case 'atr_weekly':
            rows.forEach((r) => {
                if (!r.record_key) return;
                atrWeeklyState[r.record_key] = {
                    atr: Number(r.atr ?? 100), nc: Number(r.nc ?? 0),
                    s: Number(r.s ?? 0), i: Number(r.i ?? 0), a: Number(r.a ?? 0),
                    periode: r.periode || ''
                };
            });
            return rows.length > 0;
        case 'atr_monthly':
            rows.forEach((r) => {
                if (!r.record_key) return;
                atrMonthlyState[r.record_key] = {
                    atr: Number(r.atr ?? 100), nc: Number(r.nc ?? 0),
                    s: Number(r.s ?? 0), i: Number(r.i ?? 0), a: Number(r.a ?? 0)
                };
            });
            return rows.length > 0;
        case 'atr_punishment_history':
            if (rows.length || !isDelta) {
                const mapped = rows.map(mapSupabaseToPunishment);
                punishmentHistoryState = isDelta ? mergeArrayByKey(punishmentHistoryState, mapped, x => x.id, true) : mapped;
                if (typeof punishmentHistorySeeded !== 'undefined') punishmentHistorySeeded = true;
            }
            return true;
        case 'kpi_pengawas':
            rows.forEach((r) => {
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
            return rows.length > 0;
        case 'hm_ua_daily':
            rows.forEach((r) => {
                if (!r.record_key) return;
                hmUaRecordsState[r.record_key] = {
                    unit: r.unit, date: r.tanggal, shift: r.shift, nrp: r.nrp || '',
                    hm_start: r.hm_start !== null ? Number(r.hm_start) : null,
                    hm_stop: r.hm_stop !== null ? Number(r.hm_stop) : null,
                    hm_diff: r.hm_diff !== null ? Number(r.hm_diff) : null,
                    hm_aktual: r.hm_aktual !== null ? Number(r.hm_aktual) : null
                };
            });
            return rows.length > 0;
        case 'ua_weekly_upload':
            rows.forEach((r) => {
                if (!r.record_key) return;
                uaWeeklyUploadState[r.record_key] = {
                    total: Number(r.total ?? 0),
                    count: Number(r.shift_count ?? 0)
                };
            });
            return rows.length > 0;
        case 'ua_mtd_upload':
            rows.forEach((r) => {
                if (!r.record_key) return;
                uaMtdUploadState[r.record_key] = {
                    total: Number(r.total ?? 0),
                    days: Number(r.days ?? 0),
                    shifts: Number(r.shifts ?? 0)
                };
            });
            return rows.length > 0;
        case 'rental_bib':
            if (rows.length || !isDelta) {
                const mapped = rows.map((r) => ({
                    id: r.id, tanggal: r.tanggal, no_unit: r.no_unit, shift: r.shift || 'Shift 1',
                    hm_awal: Number(r.hm_awal ?? 0), hm_akhir: Number(r.hm_akhir ?? 0),
                    total_hm: Number(r.total_hm ?? 0), hm_charge: Number(r.hm_charge ?? 0),
                    rental_rate: Number(r.rental_rate ?? 0), total: Number(r.total ?? 0),
                    job: r.job || '', operator: r.operator || '', pic_dept: r.pic_dept || ''
                }));
                rentalBibState = isDelta ? mergeArrayByKey(rentalBibState, mapped, x => x.id, true) : mapped;
            }
            return true;
        case 'big_crane_timeframe':
            if (rows.length || !isDelta) {
                const mapped = rows.map((r) => ({
                    id: r.id, no_unit: r.no_unit, user: r.user_dept || '',
                    pekerjaan: r.pekerjaan || '', lokasi: r.lokasi || '',
                    status: r.status || 'Schedule', month: Number(r.month_idx), year: Number(r.year),
                    planning: parseMaybeJson(r.planning, {}),
                    aktual: parseMaybeJson(r.aktual, {})
                }));
                bigCraneTimeframeState = isDelta ? mergeArrayByKey(bigCraneTimeframeState, mapped, x => x.id) : mapped;
            }
            return true;
        case 'operasional_lt_wt':
            if (typeof opsLtWtState !== 'undefined' && (rows.length || !isDelta)) {
                const mapped = rows.map((r, idx) => ({
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
                opsLtWtState = isDelta ? mergeArrayByKey(opsLtWtState, mapped, x => x.id, true) : mapped;
            }
            return true;
        case 'operasional_lifting':
            if (typeof opsLiftingState !== 'undefined' && (rows.length || !isDelta)) {
                const mapped = rows.map((r, idx) => ({
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
                opsLiftingState = isDelta ? mergeArrayByKey(opsLiftingState, mapped, x => x.id, true) : mapped;
            }
            return true;
        default:
            return false;
    }
}

function safeCallView(fnName) {
    try {
        if (typeof window[fnName] === 'function') window[fnName]();
    } catch (_) { /* lewati view yang belum siap */ }
}

function refreshViewsForGroup(group) {
    if (group === 'beranda') {
        safeCallView('renderInformasiSection');
        safeCallView('syncInformasiUnreadBadges');
    } else if (group === 'core') {
        safeCallView('syncMasterDropdownOptions');
        safeCallView('renderManpowerTable');
        safeCallView('renderMasterDataAll');
        safeCallView('renderRosterTable');
        safeCallView('renderRosterLegend');
    } else if (group === 'performa') {
        safeCallView('renderPerformaManpower');
        safeCallView('renderAtrMonthlyTable');
        safeCallView('renderPunishmentHistoryTable');
        safeCallView('renderDashboardKpiPengawas');
    } else if (group === 'utilitas') {
        safeCallView('renderKomisioningTable');
        safeCallView('renderHmUaView');
        safeCallView('renderRentalBibTable');
        safeCallView('renderBigCraneTimeframeTable');
        safeCallView('renderBigCraneTable');
        safeCallView('renderMasterDataAll');
    } else if (group === 'operasional') {
        safeCallView('renderOpsLtWtTable');
        safeCallView('renderOpsLiftingTable');
        safeCallView('updateDashboardKpiSeCharts');
        safeCallView('renderDashboardKpiSe');
    }
}

function safeRefreshAllPantauViews() {
    ['beranda', 'core', 'performa', 'utilitas', 'operasional'].forEach(refreshViewsForGroup);
}

/**
 * PRIORITAS #1: Sync Beranda (`pusat_informasi` + `pusat_informasi_komentar`) secara super cepat.
 */
async function syncBerandaFromSupabase({ deltaOnly = true, silent = true } = {}) {
    if (!isSupabaseConfigured()) return { ok: false, changed: false };
    const inflightKey = `beranda:${deltaOnly ? 'delta' : 'full'}`;
    if (_pantauInFlightGroups.has(inflightKey)) return _pantauInFlightGroups.get(inflightKey);

    const run = (async () => {
        loadSyncWatermarks();
        // Flush antrean lokal terlebih dahulu agar informasi yang baru dibuat/offline langsung tersimpan ke Supabase
        await flushPendingInformasiToSupabase().catch(() => {});

        const hasLocalInfo = Array.isArray(informasiState) && informasiState.some(it => it && Number(it.id) < 1e12);
        const useDeltaInfo = Boolean(deltaOnly && hasLocalInfo && _pantauWatermarks.pusat_informasi);
        const useDeltaComment = Boolean(deltaOnly && hasLocalInfo && _pantauWatermarks.pusat_informasi_komentar);

        const fetchPosts = async () => {
            const base = _pantauInfoSocialColsSupported
                ? TABLE_SELECT_QUERIES.pusat_informasi
                : TABLE_SELECT_QUERIES.pusat_informasi_fallback;
            try {
                return await supabaseSelect('pusat_informasi', buildDeltaQuery('pusat_informasi', base, useDeltaInfo));
            } catch (err) {
                if (String(err?.message || '').includes('column') || String(err?.message || '').includes('42703')) {
                    _pantauInfoSocialColsSupported = false;
                    return await supabaseSelect(
                        'pusat_informasi',
                        buildDeltaQuery('pusat_informasi', TABLE_SELECT_QUERIES.pusat_informasi_fallback, useDeltaInfo)
                    );
                }
                throw err;
            }
        };

        const [postRes, commentRes] = await Promise.allSettled([
            fetchPosts(),
            supabaseSelect(
                'pusat_informasi_komentar',
                buildDeltaQuery('pusat_informasi_komentar', TABLE_SELECT_QUERIES.pusat_informasi_komentar, useDeltaComment)
            )
        ]);

        const posts = (postRes.status === 'fulfilled' && Array.isArray(postRes.value)) ? postRes.value : null;
        const comments = (commentRes.status === 'fulfilled' && Array.isArray(commentRes.value)) ? commentRes.value : null;

        let changed = false;

        if (posts) {
            advanceWatermarkFromRows('pusat_informasi', posts);
            if (!useDeltaInfo) {
                const existingCommentsById = {};
                const pendingLocalPosts = [];
                (informasiState || []).forEach((it) => {
                    if (!it) return;
                    existingCommentsById[it.id] = it.comments || [];
                    if (it._pendingSync || Number(it.id) >= 1e12) {
                        pendingLocalPosts.push(it);
                    }
                });
                const newCommentsByInfo = {};
                (comments || []).forEach((c) => {
                    const mapped = mapSupabaseToInformasiComment(c);
                    if (!newCommentsByInfo[mapped.informasiId]) newCommentsByInfo[mapped.informasiId] = [];
                    newCommentsByInfo[mapped.informasiId].push(mapped);
                });
                const remoteMapped = posts.map((r) => mapSupabaseToInformasi(
                    r,
                    comments ? (newCommentsByInfo[r.id] || []) : (existingCommentsById[r.id] || [])
                ));
                // Pertahankan postingan lokal yang masih pending (belum masuk ke Supabase karena offline/error)
                const stillPending = pendingLocalPosts.filter((lp) => {
                    return !remoteMapped.some((rm) =>
                        Number(rm.id) === Number(lp.id) ||
                        (rm.judul === lp.judul && rm.createdBy === lp.createdBy && rm.createdAtLabel === lp.createdAtLabel)
                    );
                });
                informasiState = [...stillPending, ...remoteMapped];
                changed = true;
            } else if (posts.length > 0) {
                posts.forEach((r) => {
                    const idx = informasiState.findIndex(i => Number(i.id) === Number(r.id));
                    if (idx >= 0) {
                        informasiState[idx] = mapSupabaseToInformasi(r, informasiState[idx].comments || []);
                    } else {
                        const optIdx = informasiState.findIndex(i => Number(i.id) >= 1e12 && i.judul === String(r.judul || '') && i.createdBy === String(r.created_by || ''));
                        if (optIdx >= 0) {
                            informasiState[optIdx] = mapSupabaseToInformasi(r, informasiState[optIdx].comments || []);
                        } else {
                            informasiState.unshift(mapSupabaseToInformasi(r, []));
                        }
                    }
                });
                informasiState.sort((a, b) => Number(b.id) - Number(a.id));
                changed = true;
            }
        }

        if (comments) {
            advanceWatermarkFromRows('pusat_informasi_komentar', comments);
            if (useDeltaComment && comments.length > 0) {
                comments.forEach((c) => {
                    const mapped = mapSupabaseToInformasiComment(c);
                    const target = informasiState.find(i => Number(i.id) === Number(mapped.informasiId));
                    if (!target) return;
                    if (!Array.isArray(target.comments)) target.comments = [];
                    if (!target.comments.some(x => Number(x.id) === Number(mapped.id))) {
                        target.comments.push(mapped);
                        changed = true;
                    }
                });
            }
        }

        _pantauSyncedGroups.add('beranda');
        if (changed) {
            persistBerandaCacheNow();
            refreshViewsForGroup('beranda');
            schedulePersistLocalCache();
        } else {
            safeCallView('syncInformasiUnreadBadges');
        }
        return { ok: true, changed };
    })();

    _pantauInFlightGroups.set(inflightKey, run);
    try {
        return await run;
    } finally {
        _pantauInFlightGroups.delete(inflightKey);
    }
}

async function syncTableGroupFromSupabase(group, { deltaOnly = true } = {}) {
    if (!isSupabaseConfigured()) return { ok: false, updated: 0 };
    if (!isRoleAllowedForSyncGroup(group)) return { ok: true, updated: 0, skipped: true };
    if (group === 'beranda') return syncBerandaFromSupabase({ deltaOnly });

    const inflightKey = `${group}:${deltaOnly ? 'delta' : 'full'}`;
    if (_pantauInFlightGroups.has(inflightKey)) return _pantauInFlightGroups.get(inflightKey);

    const run = (async () => {
        loadSyncWatermarks();
        const now = Date.now();
        let tables = [];

        if (group === 'core') {
            const masterFresh = deltaOnly &&
                _pantauWatermarks._masterSavedAt &&
                (now - Number(_pantauWatermarks._masterSavedAt) < PANTAU_MASTER_TTL_MS) &&
                Array.isArray(masterJabatanState) && masterJabatanState.length > 0;
            if (!masterFresh) {
                tables.push('master_jabatan', 'master_perusahaan', 'master_kode_roster', 'master_kode_spi');
            }
            tables.push('manpower', 'roster_bulanan', 'roster_pic');
        } else if (group === 'performa') {
            tables = ['absensi_harian', 'atr_weekly', 'atr_monthly', 'atr_punishment_history', 'kpi_pengawas'];
        } else if (group === 'utilitas') {
            tables = ['komisioning_unit', 'hm_ua_daily', 'ua_weekly_upload', 'ua_mtd_upload', 'rental_bib', 'big_crane_timeframe'];
        } else if (group === 'operasional') {
            tables = ['operasional_lt_wt', 'operasional_lifting'];
        }

        const hasLocalDataForTable = (tbl) => {
            if (tbl === 'manpower') return Array.isArray(manpowerState) && manpowerState.length > 0;
            if (tbl === 'roster_bulanan') return Array.isArray(rosterState) && rosterState.length > 0;
            if (tbl === 'komisioning_unit') return Array.isArray(komisioningState) && komisioningState.length > 0;
            if (tbl === 'atr_punishment_history') return Array.isArray(punishmentHistoryState) && punishmentHistoryState.length > 0;
            if (tbl === 'rental_bib') return Array.isArray(rentalBibState) && rentalBibState.length > 0;
            if (tbl === 'big_crane_timeframe') return Array.isArray(bigCraneTimeframeState) && bigCraneTimeframeState.length > 0;
            if (tbl === 'operasional_lt_wt') return typeof opsLtWtState !== 'undefined' && opsLtWtState.length > 0;
            if (tbl === 'operasional_lifting') return typeof opsLiftingState !== 'undefined' && opsLiftingState.length > 0;
            return _pantauSyncedGroups.has(group);
        };

        const jobs = tables.map((tbl) => {
            const isMaster = tbl.startsWith('master_');
            const useDelta = Boolean(deltaOnly && !isMaster && hasLocalDataForTable(tbl) && _pantauWatermarks[tbl]);
            const qs = buildDeltaQuery(tbl, TABLE_SELECT_QUERIES[tbl] || 'select=*', useDelta);
            return supabaseSelect(tbl, qs).then((rows) => ({ tbl, rows, useDelta }));
        });

        const settled = await Promise.allSettled(jobs);
        let updated = 0;
        let masterSynced = false;

        settled.forEach((st) => {
            if (st.status !== 'fulfilled') return;
            const { tbl, rows, useDelta } = st.value;
            if (applyFetchedTableRows(tbl, rows, useDelta)) updated++;
            if (tbl.startsWith('master_') && Array.isArray(rows)) masterSynced = true;
        });

        if (masterSynced) {
            _pantauWatermarks._masterSavedAt = Date.now();
            saveSyncWatermarks();
        }
        _pantauSyncedGroups.add(group);
        if (updated > 0 || !deltaOnly) {
            refreshViewsForGroup(group);
            if (group === 'core') schedulePersistLocalCache();
        }
        return { ok: true, updated };
    })();

    _pantauInFlightGroups.set(inflightKey, run);
    try {
        return await run;
    } finally {
        _pantauInFlightGroups.delete(inflightKey);
    }
}

function getGroupsNeededForSection(section, subSection = '') {
    const sec = String(section || '').toLowerCase();
    const sub = String(subSection || '').toLowerCase();
    if (sec === 'informasi') return ['beranda'];
    if (sec === 'performa') return ['performa'];
    if (sec === 'utilitas') return ['utilitas'];
    if (sec === 'operasional') return ['operasional'];
    if (sec === 'master') return sub === 'unit' ? ['utilitas'] : [];
    if (sec === 'dashboard') {
        if (sub === 'kpi-pengawas') return ['performa'];
        if (sub === 'big-crane') return ['utilitas'];
        return ['operasional'];
    }
    if (sec === 'searching') return ['performa', 'utilitas', 'operasional'];
    return [];
}

/**
 * Dipanggil otomatis dari `navigateTo()` di `app-core.js`:
 * memuat grup data modul HANYA saat user membuka menu tersebut (Lazy Loading).
 */
async function ensureSectionSyncedFromSupabase(section, subSection = '') {
    if (!isSupabaseConfigured()) return;
    const groups = getGroupsNeededForSection(section, subSection);
    for (const grp of groups) {
        if (!isRoleAllowedForSyncGroup(grp)) continue;
        if (grp === 'beranda') {
            // Bila Realtime WS sedang putus, lakukan delta ringan saat masuk Beranda
            if (!_pantauRtConnected) {
                syncBerandaFromSupabase({ deltaOnly: true }).catch(() => {});
            }
            continue;
        }
        if (!_pantauSyncedGroups.has(grp)) {
            syncTableGroupFromSupabase(grp, { deltaOnly: false }).catch(() => {});
        }
    }
}

/**
 * Startup Hemat Egress:
 *   1. Hydrate instan dari cache lokal (0 ms)
 *   2. Sambungkan 1 WebSocket Realtime (prioritas Beranda)
 *   3. Sync Beranda (prioritas #1) -> Core (delta) -> Section aktif saat ini saja
 */
async function syncCoreFromSupabase({ forceFull = false } = {}) {
    if (!isSupabaseConfigured()) return { ok: false, source: 'local' };
    try {
        // Prioritas #1: Beranda penuh (sangat ringan, <=120 baris teks) agar tidak pernah tertinggal saat refresh
        await syncBerandaFromSupabase({ deltaOnly: false });
        // Prioritas #2: Core (Master TTL + Manpower + Roster)
        await syncTableGroupFromSupabase('core', { deltaOnly: !forceFull });
        // Prioritas #3: Modul yang sedang terbuka sekarang (jika lazy group)
        if (typeof currentSection !== 'undefined') {
            await ensureSectionSyncedFromSupabase(currentSection, typeof currentSubSection !== 'undefined' ? currentSubSection : '');
        }
        return { ok: true, source: 'supabase' };
    } catch (err) {
        console.warn('Sync core Supabase terkendala:', err);
        return { ok: false, error: err.message };
    }
}

async function bootstrapPantauCloudSync() {
    if (!isSupabaseConfigured()) return;
    if (!_pantauBootstrapped) {
        _pantauBootstrapped = true;
        hydrateStateFromLocalCache();
    }
    initPantauSupabaseRealtime();
    await syncCoreFromSupabase({ forceFull: false });
}

/**
 * Backward-compatible entry point (tombol Refresh header & pemanggil lama).
 * - showFeedback=false: sync hemat (Beranda + Core + section aktif, delta).
 * - showFeedback=true : tombol Refresh manual (cooldown 5 detik, delta sync grup aktif + reconnect Realtime).
 */
async function syncAllFromSupabase(showFeedback = false, options = {}) {
    const syncIcon = document.getElementById('sync-icon');

    if (!isSupabaseConfigured()) {
        if (syncIcon) setTimeout(() => syncIcon.classList.remove('fa-spin'), 300);
        if (showFeedback && typeof showToast === 'function') {
            showToast('Kredensial Supabase belum diisi di index.html — menggunakan data lokal.', 'info');
        }
        return { ok: false, source: 'local' };
    }

    const now = Date.now();
    const forceFull = Boolean(options && options.forceFull);
    if (showFeedback && !forceFull && (now - _pantauLastManualSyncAt) < PANTAU_REFRESH_COOLDOWN_MS) {
        const waitSec = Math.ceil((PANTAU_REFRESH_COOLDOWN_MS - (now - _pantauLastManualSyncAt)) / 1000);
        if (typeof showToast === 'function') {
            showToast(`Data sudah paling mutakhir (Realtime aktif). Tunggu ${waitSec} dtk untuk refresh ulang.`, 'info');
        }
        return { ok: true, throttled: true };
    }
    if (showFeedback) _pantauLastManualSyncAt = now;

    if (syncIcon && showFeedback) syncIcon.classList.add('fa-spin');

    try {
        // Pastikan WebSocket Realtime tersambung
        if (!_pantauRtConnected) initPantauSupabaseRealtime();

        if (!showFeedback && !forceFull) {
            return await syncCoreFromSupabase({ forceFull: false });
        }

        // Refresh manual: sinkron Beranda (full check agar penghapusan tersinkron) + Core delta + grup aktif
        const groupsToSync = new Set(['beranda', 'core']);
        if (typeof currentSection !== 'undefined') {
            getGroupsNeededForSection(currentSection, typeof currentSubSection !== 'undefined' ? currentSubSection : '')
                .forEach(g => groupsToSync.add(g));
        }
        // Tambahkan grup yang memang sudah pernah dibuka user di sesi ini
        _pantauSyncedGroups.forEach(g => groupsToSync.add(g));

        let syncedCount = 0;
        await syncBerandaFromSupabase({ deltaOnly: false });
        syncedCount++;

        const otherGroups = Array.from(groupsToSync).filter(g => g !== 'beranda' && isRoleAllowedForSyncGroup(g));
        const resList = await Promise.allSettled(
            otherGroups.map(g => syncTableGroupFromSupabase(g, { deltaOnly: !forceFull }))
        );
        resList.forEach((r) => {
            if (r.status === 'fulfilled' && r.value?.ok && !r.value?.skipped) syncedCount++;
        });

        if (showFeedback && typeof showToast === 'function') {
            showToast(`Sinkronisasi hemat berhasil (${syncedCount} modul · Realtime ${_pantauRtConnected ? 'ON' : 'Reconnecting'}).`, 'success');
        }
        return { ok: true, source: 'supabase', syncedTables: syncedCount };
    } catch (err) {
        console.error('Sinkronisasi Supabase gagal:', err);
        if (showFeedback && typeof showToast === 'function') {
            showToast('Gagal sinkronisasi ke Supabase — menggunakan data lokal.', 'error');
        }
        return { ok: false, source: 'local', error: err.message };
    } finally {
        if (syncIcon) setTimeout(() => syncIcon.classList.remove('fa-spin'), 400);
    }
}

/* =====================================================================
 * 5. NATIVE SUPABASE REALTIME WEBSOCKET (DUAL-CHANNEL: BROADCAST + PG WAL)
 *    - 1 Koneksi WebSocket ringan (tanpa library eksternal, tanpa polling REST)
 *    - Prioritas utama: Beranda (pusat_informasi & pusat_informasi_komentar)
 *    - Hemat baterai & koneksi: pause otomatis bila tab hidden > 90 detik,
 *      langsung reconnect + delta catch-up Beranda saat tab dibuka kembali.
 * ===================================================================== */

const PANTAU_RT_BROADCAST_TOPIC = 'realtime:pantau-se-broadcast';
const PANTAU_RT_DB_TOPIC = 'realtime:pantau-se-db';
const PANTAU_RT_HEARTBEAT_MS = 25000;
const PANTAU_RT_HIDDEN_PAUSE_MS = 90000;

let _pantauRtSocket = null;
let _pantauRtConnected = false;
let _pantauRtBroadcastJoined = false;
let _pantauRtPgEnabled = true;
let _pantauRtRefSeq = 1;
let _pantauRtHeartbeatTimer = null;
let _pantauRtReconnectTimer = null;
let _pantauRtReconnectAttempt = 0;
let _pantauRtHiddenTimer = null;
let _pantauRtStoppedManually = false;
let _pantauRtLifecycleBound = false;
const _pantauRtClientId = `pse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function nextRtRef() {
    _pantauRtRefSeq += 1;
    return String(_pantauRtRefSeq);
}

function getRealtimeWatchTables() {
    const role = getActiveRoleTypeForSync();
    // Prioritas #1 untuk SEMUA role (termasuk Manpower): Beranda + Roster + Manpower
    const base = ['pusat_informasi', 'pusat_informasi_komentar', 'roster_bulanan', 'roster_pic', 'manpower'];
    if (role !== 'karyawan') {
        base.push('komisioning_unit', 'atr_punishment_history', 'operasional_lt_wt', 'operasional_lifting', 'rental_bib', 'big_crane_timeframe');
    }
    return base;
}

function buildRealtimeWsUrl() {
    const cfg = getPantauSeConfig();
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) return '';
    const wsBase = cfg.SUPABASE_URL.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    return `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.SUPABASE_ANON_KEY)}&vsn=1.0.0`;
}

function sendRtFrame(obj) {
    if (!_pantauRtSocket || _pantauRtSocket.readyState !== WebSocket.OPEN) return false;
    try {
        _pantauRtSocket.send(JSON.stringify(obj));
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Kirim event perubahan ringan via Supabase Broadcast (<100ms ke semua user online, 0 REST query).
 */
function emitPantauRealtimeBroadcast(table, op, data) {
    if (!_pantauRtBroadcastJoined || !_pantauRtSocket || _pantauRtSocket.readyState !== WebSocket.OPEN) return false;
    const safeData = sanitizeSupabasePayloadNoPhotos(data, `rt:${table}`);
    return sendRtFrame({
        topic: PANTAU_RT_BROADCAST_TOPIC,
        event: 'broadcast',
        payload: {
            type: 'broadcast',
            event: 'pantau_change',
            payload: {
                senderId: _pantauRtClientId,
                table: String(table || ''),
                op: String(op || 'UPDATE').toUpperCase(),
                data: safeData,
                ts: Date.now()
            }
        },
        ref: nextRtRef()
    });
}

function renderInformasiPreservingComposer() {
    let activeInputId = '';
    let activeInputVal = '';
    let selStart = null;
    let selEnd = null;
    const activeEl = document.activeElement;
    if (activeEl && activeEl.id && activeEl.id.startsWith('info-comment-input-')) {
        activeInputId = activeEl.id;
        activeInputVal = activeEl.value;
        selStart = activeEl.selectionStart;
        selEnd = activeEl.selectionEnd;
    }
    safeCallView('renderInformasiSection');
    safeCallView('syncInformasiUnreadBadges');
    if (activeInputId) {
        const nextEl = document.getElementById(activeInputId);
        if (nextEl) {
            nextEl.value = activeInputVal;
            nextEl.focus();
            try {
                if (selStart !== null && selEnd !== null) nextEl.setSelectionRange(selStart, selEnd);
            } catch (_) { /* ignore */ }
        }
    }
}

function applyRealtimeTableEvent(table, op, record, oldRecord = null) {
    const cleanOp = String(op || '').toUpperCase();

    // 1. PRIORITAS UTAMA: BERANDA — POSTINGAN INFORMASI
    if (table === 'pusat_informasi') {
        if (cleanOp === 'DELETE') {
            const delId = Number(record?.id || oldRecord?.id);
            if (!delId) return;
            const beforeLen = informasiState.length;
            informasiState = informasiState.filter(i => Number(i.id) !== delId);
            if (typeof activeInfoChatId !== 'undefined' && Number(activeInfoChatId) === delId) {
                activeInfoChatId = null;
            }
            if (informasiState.length !== beforeLen) {
                renderInformasiPreservingComposer();
                schedulePersistLocalCache();
            }
            return;
        }
        if (cleanOp === 'PATCH_SOCIAL' && record?.id) {
            const target = informasiState.find(i => Number(i.id) === Number(record.id));
            if (!target) return;
            if (Array.isArray(record.likes)) target.likes = record.likes;
            if (record.reactions && typeof record.reactions === 'object') target.reactions = record.reactions;
            if (record.shares !== undefined) target.shares = Number(record.shares) || 0;
            renderInformasiPreservingComposer();
            schedulePersistLocalCache();
            return;
        }
        if (!record || !record.id) return;
        const numId = Number(record.id);
        updateTableWatermark('pusat_informasi', record.updated_at || record.created_at || new Date().toISOString());

        const existingIdx = informasiState.findIndex(i => Number(i.id) === numId);
        if (existingIdx >= 0) {
            informasiState[existingIdx] = mapSupabaseToInformasi(record, informasiState[existingIdx].comments || []);
            renderInformasiPreservingComposer();
            schedulePersistLocalCache();
            return;
        }

        // Cek apakah ada post optimistic sementara (id >= 1e12) milik author ini dengan judul sama
        const optIdx = informasiState.findIndex(i => Number(i.id) >= 1e12 && i.judul === String(record.judul || '') && i.createdBy === String(record.created_by || ''));
        if (optIdx >= 0) {
            informasiState[optIdx] = mapSupabaseToInformasi(record, informasiState[optIdx].comments || []);
        } else {
            const mapped = mapSupabaseToInformasi(record, []);
            informasiState.unshift(mapped);
            informasiState.sort((a, b) => Number(b.id) - Number(a.id));

            // Notifikasi real-time cepat untuk audiens bila bukan dibuat oleh tab ini sendiri
            if (!isLocalRecentWrite('pusat_informasi', numId)) {
                try {
                    const prof = typeof getActiveUserProfile === 'function' ? getActiveUserProfile() : null;
                    const visible = !prof || typeof isInfoVisibleToProfile !== 'function' || isInfoVisibleToProfile(mapped, prof);
                    if (visible && typeof showToast === 'function') {
                        const shortTitle = mapped.judul.length > 52 ? `${mapped.judul.slice(0, 52)}...` : mapped.judul;
                        showToast(`Info baru [${mapped.kategori}]: ${shortTitle}`, 'info');
                    }
                } catch (_) { /* ignore */ }
            }
        }
        renderInformasiPreservingComposer();
        schedulePersistLocalCache();
        return;
    }

    // 2. PRIORITAS UTAMA: BERANDA — KOMENTAR / CHAT OBROLAN
    if (table === 'pusat_informasi_komentar') {
        if (cleanOp === 'DELETE') {
            const delId = Number(record?.id || oldRecord?.id);
            const infoId = Number(record?.informasi_id || oldRecord?.informasi_id);
            if (!delId) return;
            const target = infoId
                ? informasiState.find(i => Number(i.id) === infoId)
                : informasiState.find(i => Array.isArray(i.comments) && i.comments.some(c => Number(c.id) === delId));
            if (target && Array.isArray(target.comments)) {
                target.comments = target.comments.filter(c => Number(c.id) !== delId);
                renderInformasiPreservingComposer();
                schedulePersistLocalCache();
            }
            return;
        }
        if (!record || !record.id) return;
        const mapped = mapSupabaseToInformasiComment(record);
        updateTableWatermark('pusat_informasi_komentar', mapped.id);
        const target = informasiState.find(i => Number(i.id) === Number(mapped.informasiId));
        if (!target) {
            // Post belum ada di lokal -> tarik delta Beranda 1x
            syncBerandaFromSupabase({ deltaOnly: true }).catch(() => {});
            return;
        }
        if (!Array.isArray(target.comments)) target.comments = [];
        const dupIdx = target.comments.findIndex(c => Number(c.id) === Number(mapped.id));
        if (dupIdx >= 0) {
            target.comments[dupIdx] = mapped;
        } else {
            // Cocokkan dengan pesan optimistic sementara (id >= 1e12)
            const optIdx = target.comments.findIndex(c => Number(c.id) >= 1e12 && c.authorKey === mapped.authorKey && c.text === mapped.text);
            if (optIdx >= 0) target.comments[optIdx] = mapped;
            else target.comments.push(mapped);
        }
        renderInformasiPreservingComposer();
        schedulePersistLocalCache();
        return;
    }

    // 3. ROSTER BULANAN & ROSTER PIC
    if (table === 'roster_bulanan') {
        if (cleanOp === 'REFRESH') {
            syncTableGroupFromSupabase('core', { deltaOnly: true }).catch(() => {});
            return;
        }
        if (cleanOp === 'DELETE') {
            const nrp = String(record?.nrp || oldRecord?.nrp || '').trim();
            if (nrp) {
                rosterState = rosterState.filter(r => String(r.nrp || '').trim() !== nrp);
                safeCallView('renderRosterTable');
                schedulePersistLocalCache();
            }
            return;
        }
        if (record && record.nrp) {
            const mapped = mapSupabaseToRoster(record);
            rosterState = mergeArrayByKey(rosterState, [mapped], x => String(x.nrp || x.id));
            updateTableWatermark('roster_bulanan', record.updated_at || new Date().toISOString());
            safeCallView('renderRosterTable');
            schedulePersistLocalCache();
        }
        return;
    }

    if (table === 'roster_pic' && record && record.submenu_key) {
        if (typeof hydrateRosterPicFromSupabase === 'function') {
            hydrateRosterPicFromSupabase([record]);
            safeCallView('renderRosterLegend');
            safeCallView('renderRosterTable');
        }
        return;
    }

    // 4. MANPOWER
    if (table === 'manpower') {
        if (cleanOp === 'REFRESH') {
            syncTableGroupFromSupabase('core', { deltaOnly: true }).catch(() => {});
            return;
        }
        if (cleanOp === 'PATCH_MEDIA' && record?.nrp) {
            const mp = manpowerState.find(m => String(m.nrp || '').trim() === String(record.nrp).trim());
            if (mp) {
                mp.media_links = sanitizeMediaLinksMap(record.media_links || {});
                safeCallView('renderManpowerTable');
                schedulePersistLocalCache();
            }
            return;
        }
        if (cleanOp === 'DELETE') {
            const nrp = String(record?.nrp || oldRecord?.nrp || '').trim();
            const delId = Number(record?.id || oldRecord?.id);
            manpowerState = manpowerState.filter(m => (nrp ? String(m.nrp) !== nrp : Number(m.id) !== delId));
            refreshViewsForGroup('core');
            schedulePersistLocalCache();
            return;
        }
        if (record && record.nrp) {
            const mapped = mapSupabaseToManpower(record);
            manpowerState = mergeArrayByKey(manpowerState, [mapped], x => String(x.nrp || x.id));
            updateTableWatermark('manpower', record.updated_at || new Date().toISOString());
            refreshViewsForGroup('core');
            schedulePersistLocalCache();
        }
        return;
    }

    // 5. MODUL LAZY (hanya patch bila modul sudah pernah dibuka/dimuat)
    if (table === 'absensi_harian' && _pantauSyncedGroups.has('performa')) {
        if (cleanOp === 'REFRESH') {
            syncTableGroupFromSupabase('performa', { deltaOnly: true }).catch(() => {});
            return;
        }
        if (cleanOp === 'DELETE') {
            const delKey = String(record?.record_key || oldRecord?.record_key || '').trim();
            if (delKey && typeof absensiRecordsState !== 'undefined' && absensiRecordsState[delKey]) {
                delete absensiRecordsState[delKey];
                refreshViewsForGroup('performa');
            }
            return;
        }
        if (record && record.record_key) {
            applyFetchedTableRows('absensi_harian', [record], true);
            refreshViewsForGroup('performa');
        }
        return;
    }

    if (table === 'atr_punishment_history' && _pantauSyncedGroups.has('performa')) {
        if (cleanOp === 'DELETE') {
            const delId = Number(record?.id || oldRecord?.id);
            if (delId) {
                punishmentHistoryState = punishmentHistoryState.filter(p => Number(p.id) !== delId);
                refreshViewsForGroup('performa');
            }
            return;
        }
        if (record && record.id) {
            const mapped = mapSupabaseToPunishment(record);
            punishmentHistoryState = mergeArrayByKey(punishmentHistoryState, [mapped], x => x.id, true);
            refreshViewsForGroup('performa');
        }
        return;
    }

    if (table === 'komisioning_unit' && _pantauSyncedGroups.has('utilitas') && record?.no_unit) {
        if (cleanOp === 'DELETE') {
            komisioningState = komisioningState.filter(u => String(u.no_unit) !== String(record.no_unit));
        } else {
            komisioningState = mergeArrayByKey(komisioningState, [mapSupabaseToKomisioning(record)], x => String(x.no_unit));
        }
        refreshViewsForGroup('utilitas');
        return;
    }

    if ((table === 'operasional_lt_wt' || table === 'operasional_lifting') && _pantauSyncedGroups.has('operasional')) {
        if (cleanOp === 'DELETE') {
            const prefix = table === 'operasional_lt_wt' ? 'sb-lt-' : 'sb-lf-';
            const delId = `${prefix}${record?.id || oldRecord?.id}`;
            if (table === 'operasional_lt_wt' && typeof opsLtWtState !== 'undefined') {
                opsLtWtState = opsLtWtState.filter(r => r.id !== delId);
            } else if (table === 'operasional_lifting' && typeof opsLiftingState !== 'undefined') {
                opsLiftingState = opsLiftingState.filter(r => r.id !== delId);
            }
            refreshViewsForGroup('operasional');
        } else if (record && record.id) {
            applyFetchedTableRows(table, [record], true);
            refreshViewsForGroup('operasional');
        }
        return;
    }

    if ((table === 'rental_bib' || table === 'big_crane_timeframe') && _pantauSyncedGroups.has('utilitas') && record) {
        if (cleanOp === 'DELETE') {
            const delId = Number(record?.id || oldRecord?.id);
            if (table === 'rental_bib') rentalBibState = rentalBibState.filter(x => Number(x.id) !== delId);
            else bigCraneTimeframeState = bigCraneTimeframeState.filter(x => Number(x.id) !== delId);
        } else {
            applyFetchedTableRows(table, [record], true);
        }
        refreshViewsForGroup('utilitas');
    }
}

function handleRealtimeMessage(rawData) {
    let msg;
    try {
        msg = JSON.parse(rawData);
    } catch (_) {
        return;
    }
    if (!msg || typeof msg !== 'object') return;

    // 1. Konfirmasi join channel
    if (msg.event === 'phx_reply') {
        if (msg.topic === PANTAU_RT_BROADCAST_TOPIC && msg.payload?.status === 'ok') {
            _pantauRtBroadcastJoined = true;
        }
        return;
    }

    // 2. Pesan sistem dari Postgres Changes (jika publikasi SQL belum diaktifkan)
    if (msg.event === 'system' && msg.topic === PANTAU_RT_DB_TOPIC) {
        if (msg.payload?.status === 'error') {
            _pantauRtPgEnabled = false;
            console.info('[PANTAU SE Realtime] Postgres WAL publication belum aktif — menggunakan saluran Broadcast Realtime aktif.');
        }
        return;
    }

    // 3. Saluran Broadcast Realtime (instan <100ms antar perangkat tanpa butuh SQL publication)
    if (msg.event === 'broadcast' && msg.topic === PANTAU_RT_BROADCAST_TOPIC) {
        const inner = msg.payload?.payload || msg.payload;
        if (!inner || inner.senderId === _pantauRtClientId) return;
        applyRealtimeTableEvent(inner.table, inner.op, inner.data, null);
        return;
    }

    // 4. Saluran Postgres Changes (WAL langsung dari database Supabase)
    if (msg.event === 'postgres_changes') {
        const data = msg.payload?.data || msg.payload || {};
        const table = data.table || '';
        const op = String(data.type || data.eventType || '').toUpperCase();
        const record = data.record || data.new || null;
        const oldRecord = data.old_record || data.old || null;
        if (table && op) {
            applyRealtimeTableEvent(table, op, record, oldRecord);
        }
    }
}

function bindRealtimeLifecycleListeners() {
    if (_pantauRtLifecycleBound || typeof document === 'undefined' || typeof window === 'undefined') return;
    _pantauRtLifecycleBound = true;

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Pause WebSocket bila tab tidak dibuka > 90 detik (hemat kuota koneksi & baterai HP)
            if (_pantauRtHiddenTimer) clearTimeout(_pantauRtHiddenTimer);
            _pantauRtHiddenTimer = setTimeout(() => {
                if (document.hidden && _pantauRtSocket) {
                    closeRealtimeSocketOnly();
                }
            }, PANTAU_RT_HIDDEN_PAUSE_MS);
        } else {
            if (_pantauRtHiddenTimer) {
                clearTimeout(_pantauRtHiddenTimer);
                _pantauRtHiddenTimer = null;
            }
            if (!_pantauRtStoppedManually && isSupabaseConfigured()) {
                if (!_pantauRtConnected) initPantauSupabaseRealtime();
                // 1 delta ringan Beranda saat user kembali ke aplikasi agar tidak ketinggalan info apa pun
                syncBerandaFromSupabase({ deltaOnly: true }).catch(() => {});
            }
        }
    });

    window.addEventListener('online', () => {
        if (!_pantauRtStoppedManually && isSupabaseConfigured()) {
            initPantauSupabaseRealtime();
            syncBerandaFromSupabase({ deltaOnly: true }).catch(() => {});
        }
    });

    window.addEventListener('pagehide', () => {
        persistBerandaCacheNow();
        if (_pantauCacheSaveTimer) {
            clearTimeout(_pantauCacheSaveTimer);
            _pantauCacheSaveTimer = null;
            persistLocalCacheNow();
        }
        closeRealtimeSocketOnly();
    });

    window.addEventListener('beforeunload', () => {
        persistBerandaCacheNow();
        if (_pantauCacheSaveTimer) {
            clearTimeout(_pantauCacheSaveTimer);
            _pantauCacheSaveTimer = null;
            persistLocalCacheNow();
        }
        closeRealtimeSocketOnly();
    });
}

function closeRealtimeSocketOnly() {
    if (_pantauRtHeartbeatTimer) {
        clearInterval(_pantauRtHeartbeatTimer);
        _pantauRtHeartbeatTimer = null;
    }
    if (_pantauRtReconnectTimer) {
        clearTimeout(_pantauRtReconnectTimer);
        _pantauRtReconnectTimer = null;
    }
    _pantauRtConnected = false;
    _pantauRtBroadcastJoined = false;
    if (_pantauRtSocket) {
        try {
            _pantauRtSocket.onclose = null;
            _pantauRtSocket.onerror = null;
            _pantauRtSocket.onmessage = null;
            _pantauRtSocket.close(1000, 'paused');
        } catch (_) { /* ignore */ }
        _pantauRtSocket = null;
    }
}

function stopPantauSupabaseRealtime() {
    _pantauRtStoppedManually = true;
    if (_pantauRtHiddenTimer) {
        clearTimeout(_pantauRtHiddenTimer);
        _pantauRtHiddenTimer = null;
    }
    closeRealtimeSocketOnly();
}

function initPantauSupabaseRealtime() {
    if (!isSupabaseConfigured() || typeof WebSocket === 'undefined') return;
    bindRealtimeLifecycleListeners();
    _pantauRtStoppedManually = false;

    if (_pantauRtSocket && (_pantauRtSocket.readyState === WebSocket.OPEN || _pantauRtSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const wsUrl = buildRealtimeWsUrl();
    if (!wsUrl) return;

    closeRealtimeSocketOnly();

    try {
        const ws = new WebSocket(wsUrl);
        _pantauRtSocket = ws;

        ws.onopen = () => {
            _pantauRtConnected = true;
            _pantauRtReconnectAttempt = 0;
            const cfg = getPantauSeConfig();

            // Topic 1: Broadcast Realtime (selalu aktif instan <100ms)
            sendRtFrame({
                topic: PANTAU_RT_BROADCAST_TOPIC,
                event: 'phx_join',
                payload: {
                    config: {
                        broadcast: { ack: false, self: false },
                        presence: { key: '' }
                    },
                    access_token: cfg.SUPABASE_ANON_KEY
                },
                ref: nextRtRef()
            });

            // Topic 2: Postgres Changes WAL (otomatis aktif begitu SQL publication dijalankan)
            if (_pantauRtPgEnabled) {
                const watchTables = getRealtimeWatchTables();
                sendRtFrame({
                    topic: PANTAU_RT_DB_TOPIC,
                    event: 'phx_join',
                    payload: {
                        config: {
                            broadcast: { ack: false, self: false },
                            presence: { key: '' },
                            postgres_changes: watchTables.map(tbl => ({
                                event: '*',
                                schema: 'public',
                                table: tbl
                            }))
                        },
                        access_token: cfg.SUPABASE_ANON_KEY
                    },
                    ref: nextRtRef()
                });
            }

            // Heartbeat ringan setiap 25 detik selama tab aktif
            if (_pantauRtHeartbeatTimer) clearInterval(_pantauRtHeartbeatTimer);
            _pantauRtHeartbeatTimer = setInterval(() => {
                if (_pantauRtSocket && _pantauRtSocket.readyState === WebSocket.OPEN) {
                    sendRtFrame({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRtRef() });
                }
            }, PANTAU_RT_HEARTBEAT_MS);
        };

        ws.onmessage = (evt) => {
            if (typeof evt.data === 'string') handleRealtimeMessage(evt.data);
        };

        ws.onerror = () => {
            /* onclose akan menangani reconnect dengan exponential backoff */
        };

        ws.onclose = () => {
            _pantauRtConnected = false;
            _pantauRtBroadcastJoined = false;
            if (_pantauRtHeartbeatTimer) {
                clearInterval(_pantauRtHeartbeatTimer);
                _pantauRtHeartbeatTimer = null;
            }
            if (_pantauRtStoppedManually || (typeof document !== 'undefined' && document.hidden)) return;
            // Exponential backoff: 2s, 4s, 8s, 15s, max 30s
            const delay = Math.min(30000, 2000 * Math.pow(2, _pantauRtReconnectAttempt));
            _pantauRtReconnectAttempt = Math.min(_pantauRtReconnectAttempt + 1, 5);
            if (_pantauRtReconnectTimer) clearTimeout(_pantauRtReconnectTimer);
            _pantauRtReconnectTimer = setTimeout(() => {
                if (!_pantauRtStoppedManually && (typeof document === 'undefined' || !document.hidden)) {
                    initPantauSupabaseRealtime();
                }
            }, delay);
        };
    } catch (err) {
        console.warn('Gagal membuka WebSocket Realtime Supabase:', err);
    }
}

/* =====================================================================
 * 6. UTILITY BACKUP PENUH LOKAL -> SUPABASE (OPSIONAL VIA CONSOLE)
 * ===================================================================== */

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
            komisioning_tma: u.KOMISIONING_TMA || null,
            media_links: sanitizeMediaLinksMap(u.media_links || {})
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
