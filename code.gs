/**
 * ============================================================================
 * PANTAU SE — GOOGLE APPS SCRIPT (code.gs)
 * Fungsi:
 *   1. Menerima upload media (foto eviden punishment, dokumen manpower,
 *      komisioning unit, lampiran informasi) dari aplikasi web PANTAU SE.
 *   2. Menyimpan file media ke Google Drive dengan struktur subfolder rapi:
 *      PANTAU_SE_MEDIA / <MODULE> / YYYY-MM / <nama_file>
 *   3. Membuat kode link unik (PSE-YYYYMMDD-XXXXXX) dan mencatat seluruh
 *      metadata + URL Google Drive ke Google Spreadsheet (sheet: MEDIA_LINKS).
 *   4. Menyediakan endpoint lookup, list, ping, dan soft-delete (Trash).
 *
 * CARA DEPLOY:
 *   1. Buka https://script.google.com -> Proyek Baru -> tempel isi file ini.
 *   2. Opsional: isi DRIVE_ROOT_FOLDER_ID & SPREADSHEET_ID di bawah
 *      (jika dikosongkan, jalankan fungsi `setupPantauSeStorage` sekali untuk
 *      membuat folder Drive & Spreadsheet otomatis).
 *   3. Klik Deploy -> New Deployment -> Web App:
 *        - Execute as : Me (Akun Google Anda)
 *        - Who has access : Anyone (Siapa saja)
 *   4. Salin Web App URL (`https://script.google.com/macros/s/.../exec`)
 *      dan tempel ke `window.PANTAU_SE_CONFIG.GAS_UPLOAD_URL` di `index.html`.
 * ============================================================================
 */

const GAS_CONFIG = {
  // Isi ID folder Google Drive utama, atau biarkan kosong agar dibuat otomatis oleh setupPantauSeStorage()
  DRIVE_ROOT_FOLDER_ID: '',
  // Isi ID Google Spreadsheet pencatat kode link, atau biarkan kosong (pakai Active Spreadsheet / buat otomatis)
  SPREADSHEET_ID: '',
  // Nama sheet pencatat kode link media
  SHEET_NAME: 'MEDIA_LINKS',
  // Nama default folder & spreadsheet bila dibuat otomatis
  DEFAULT_FOLDER_NAME: 'PANTAU_SE_MEDIA',
  DEFAULT_SPREADSHEET_NAME: 'PANTAU_SE_MEDIA_LINKS',
  // Opsional token keamanan (samakan dengan GAS_API_TOKEN di index.html; kosong = nonaktif)
  API_TOKEN: '',
  // Batas ukuran file default (15 MB)
  MAX_FILE_BYTES: 15 * 1024 * 1024
};

const SHEET_HEADERS = [
  'Timestamp',
  'Media Code',
  'Module',
  'Ref ID',
  'NRP',
  'Label',
  'File Name',
  'Mime Type',
  'Size (KB)',
  'Drive File ID',
  'Drive URL',
  'Direct View URL',
  'Thumbnail URL',
  'Download URL',
  'Folder Path',
  'Uploaded By',
  'Status'
];

/**
 * Jalankan fungsi ini 1x dari editor Apps Script untuk membuat Folder Drive
 * & Spreadsheet pencatat link otomatis jika belum diisi di GAS_CONFIG.
 */
function setupPantauSeStorage() {
  const rootFolder = getOrCreateRootFolder_();
  const ss = getOrCreateSpreadsheet_(rootFolder);
  const sheet = getOrCreateLinkSheet_(ss);

  Logger.log('=== PANTAU SE STORAGE SIAP ===');
  Logger.log('DRIVE_ROOT_FOLDER_ID : ' + rootFolder.getId());
  Logger.log('DRIVE_ROOT_URL       : ' + rootFolder.getUrl());
  Logger.log('SPREADSHEET_ID       : ' + ss.getId());
  Logger.log('SPREADSHEET_URL      : ' + ss.getUrl());
  Logger.log('SHEET_NAME           : ' + sheet.getName());

  return {
    folderId: rootFolder.getId(),
    folderUrl: rootFolder.getUrl(),
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl(),
    sheetName: sheet.getName()
  };
}

/**
 * Endpoint GET:
 *   - ?action=ping                        -> Cek status layanan GAS
 *   - ?action=lookup&code=PSE-...         -> Ambil URL Drive berdasarkan Media Code dari Spreadsheet
 *   - ?action=list&module=...&nrp=...     -> Daftar media aktif dari Spreadsheet
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    if (!verifyApiToken_(params.token)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized token.' });
    }

    const action = String(params.action || 'ping').toLowerCase();
    if (action === 'ping') {
      const rootFolder = getOrCreateRootFolder_();
      const ss = getOrCreateSpreadsheet_(rootFolder);
      return jsonResponse_({
        ok: true,
        service: 'PANTAU SE Media Gateway (Google Drive + Spreadsheet)',
        timestamp: new Date().toISOString(),
        folderId: rootFolder.getId(),
        spreadsheetId: ss.getId(),
        spreadsheetUrl: ss.getUrl()
      });
    }

    if (action === 'lookup') {
      const code = String(params.code || '').trim().toUpperCase();
      if (!code) return jsonResponse_({ ok: false, error: 'Parameter code wajib diisi.' });
      const found = findMediaByCode_(code);
      if (!found) return jsonResponse_({ ok: false, error: 'Media code tidak ditemukan.' });
      return jsonResponse_({ ok: true, data: found });
    }

    if (action === 'list') {
      const list = listMediaFromSheet_({
        module: params.module || '',
        nrp: params.nrp || '',
        refId: params.refId || '',
        limit: parseInt(params.limit || '100', 10) || 100
      });
      return jsonResponse_({ ok: true, count: list.length, data: list });
    }

    return jsonResponse_({ ok: false, error: 'Action GET tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Endpoint POST:
 *   Body JSON (kirim sebagai text/plain atau application/json):
 *   1) Upload media:
 *      {
 *        action: "upload",
 *        token: "",
 *        module: "PUNISHMENT" | "MANPOWER_DOCS" | "KOMISIONING" | "INFORMASI",
 *        refId: "123",
 *        nrp: "21045101",
 *        label: "Eviden SP1 Nov 2026",
 *        fileName: "eviden.jpg",
 *        mimeType: "image/jpeg",
 *        dataUrl: "data:image/jpeg;base64,...", // atau base64Data: "..."
 *        uploadedBy: "Admin SE",
 *        oldFileId: "" // opsional: hapus file lama saat ganti foto
 *      }
 *   2) Hapus media (soft delete ke Trash Drive + tandai DELETED di Spreadsheet):
 *      { action: "delete", token: "", fileId: "...", mediaCode: "PSE-..." }
 */
function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const payload = JSON.parse(rawBody);

    if (!verifyApiToken_(payload.token)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized token.' });
    }

    const action = String(payload.action || 'upload').toLowerCase();
    if (action === 'upload') {
      return handleUploadMedia_(payload);
    }
    if (action === 'delete') {
      return handleDeleteMedia_(payload);
    }

    return jsonResponse_({ ok: false, error: 'Action POST tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function handleUploadMedia_(payload) {
  let base64Str = String(payload.base64Data || '').trim();
  let mimeType = String(payload.mimeType || '').trim();

  if (!base64Str && payload.dataUrl) {
    const dataUrl = String(payload.dataUrl);
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = mimeType || match[1];
      base64Str = match[2];
    } else {
      base64Str = dataUrl;
    }
  }

  if (!base64Str) {
    return jsonResponse_({ ok: false, error: 'Data media (dataUrl / base64Data) kosong.' });
  }

  mimeType = mimeType || 'image/jpeg';
  const bytes = Utilities.base64Decode(base64Str);
  if (bytes.length > GAS_CONFIG.MAX_FILE_BYTES) {
    return jsonResponse_({ ok: false, error: 'Ukuran file melebihi batas maksimal 15 MB.' });
  }

  const moduleName = sanitizeSlug_(payload.module || 'GENERAL').toUpperCase();
  const refId = String(payload.refId || '').trim();
  const nrp = String(payload.nrp || '').trim();
  const label = String(payload.label || '').trim();
  const uploadedBy = String(payload.uploadedBy || 'Admin SE').trim();

  const mediaCode = generateMediaCode_();
  const ext = inferExtension_(payload.fileName, mimeType);
  const cleanOrig = sanitizeFileName_(payload.fileName || (moduleName.toLowerCase() + '.' + ext));
  const finalFileName = mediaCode + '_' + (nrp ? nrp + '_' : '') + cleanOrig;

  const rootFolder = getOrCreateRootFolder_();
  const now = new Date();
  const ymFolderName = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyy-MM');
  const modFolder = getOrCreateChildFolder_(rootFolder, moduleName);
  const targetFolder = getOrCreateChildFolder_(modFolder, ymFolderName);
  const folderPath = rootFolder.getName() + '/' + moduleName + '/' + ymFolderName;

  const blob = Utilities.newBlob(bytes, mimeType, finalFileName);
  const file = targetFolder.createFile(blob);

  // Set akses agar foto bisa langsung tampil di aplikasi web PANTAU SE
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    Logger.log('Warning setSharing: ' + shareErr);
  }

  // Jika ada oldFileId saat mengganti foto, pindahkan file lama ke Trash
  if (payload.oldFileId) {
    try {
      DriveApp.getFileById(String(payload.oldFileId)).setTrashed(true);
    } catch (_) {}
  }

  const fileId = file.getId();
  const sizeBytes = file.getSize();
  const sizeKb = Number((sizeBytes / 1024).toFixed(1));
  const driveUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
  const viewUrl = 'https://lh3.googleusercontent.com/d/' + fileId + '=w1600';
  const thumbnailUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w600';
  const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

  // Catat kode link & metadata ke Google Spreadsheet
  const ss = getOrCreateSpreadsheet_(rootFolder);
  const sheet = getOrCreateLinkSheet_(ss);
  const tsText = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    tsText,
    mediaCode,
    moduleName,
    refId,
    nrp,
    label,
    finalFileName,
    mimeType,
    sizeKb,
    fileId,
    driveUrl,
    viewUrl,
    thumbnailUrl,
    downloadUrl,
    folderPath,
    uploadedBy,
    'ACTIVE'
  ]);
  const sheetRow = sheet.getLastRow();

  return jsonResponse_({
    ok: true,
    mediaCode: mediaCode,
    module: moduleName,
    refId: refId,
    nrp: nrp,
    fileName: finalFileName,
    mimeType: mimeType,
    sizeBytes: sizeBytes,
    fileId: fileId,
    driveUrl: driveUrl,
    viewUrl: viewUrl,
    thumbnailUrl: thumbnailUrl,
    downloadUrl: downloadUrl,
    folderPath: folderPath,
    spreadsheetId: ss.getId(),
    sheetRow: sheetRow
  });
}

function handleDeleteMedia_(payload) {
  const fileId = String(payload.fileId || '').trim();
  const mediaCode = String(payload.mediaCode || '').trim().toUpperCase();
  if (!fileId && !mediaCode) {
    return jsonResponse_({ ok: false, error: 'fileId atau mediaCode wajib diisi.' });
  }

  const rootFolder = getOrCreateRootFolder_();
  const ss = getOrCreateSpreadsheet_(rootFolder);
  const sheet = getOrCreateLinkSheet_(ss);
  const data = sheet.getDataRange().getValues();

  let targetFileId = fileId;
  let updatedRow = -1;

  for (let r = 1; r < data.length; r++) {
    const rowCode = String(data[r][1] || '').trim().toUpperCase();
    const rowFileId = String(data[r][9] || '').trim();
    if ((mediaCode && rowCode === mediaCode) || (fileId && rowFileId === fileId)) {
      targetFileId = targetFileId || rowFileId;
      sheet.getRange(r + 1, 17).setValue('DELETED');
      updatedRow = r + 1;
      break;
    }
  }

  if (targetFileId) {
    try {
      DriveApp.getFileById(targetFileId).setTrashed(true);
    } catch (err) {
      Logger.log('Warning trash file: ' + err);
    }
  }

  return jsonResponse_({
    ok: true,
    deleted: true,
    fileId: targetFileId,
    mediaCode: mediaCode,
    sheetRow: updatedRow
  });
}

/* ============================================================================
 * HELPER INTERNAL DRIVE, SPREADSHEET & FORMATTER
 * ============================================================================ */

function getOrCreateRootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const configuredId = GAS_CONFIG.DRIVE_ROOT_FOLDER_ID || props.getProperty('PANTAU_SE_FOLDER_ID') || '';
  if (configuredId) {
    try {
      return DriveApp.getFolderById(configuredId);
    } catch (_) {}
  }

  const existing = DriveApp.getFoldersByName(GAS_CONFIG.DEFAULT_FOLDER_NAME);
  let folder = existing.hasNext() ? existing.next() : DriveApp.createFolder(GAS_CONFIG.DEFAULT_FOLDER_NAME);
  props.setProperty('PANTAU_SE_FOLDER_ID', folder.getId());
  return folder;
}

function getOrCreateChildFolder_(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parentFolder.createFolder(name);
}

function getOrCreateSpreadsheet_(rootFolder) {
  const props = PropertiesService.getScriptProperties();
  const configuredId = GAS_CONFIG.SPREADSHEET_ID || props.getProperty('PANTAU_SE_SHEET_ID') || '';
  if (configuredId) {
    try {
      return SpreadsheetApp.openById(configuredId);
    } catch (_) {}
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty('PANTAU_SE_SHEET_ID', active.getId());
      return active;
    }
  } catch (_) {}

  const ss = SpreadsheetApp.create(GAS_CONFIG.DEFAULT_SPREADSHEET_NAME);
  try {
    const ssFile = DriveApp.getFileById(ss.getId());
    ssFile.moveTo(rootFolder);
  } catch (_) {}
  props.setProperty('PANTAU_SE_SHEET_ID', ss.getId());
  return ss;
}

function getOrCreateLinkSheet_(ss) {
  let sheet = ss.getSheetByName(GAS_CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(GAS_CONFIG.SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    sheet.setFrozenRows(1);
    const headerRange = sheet.getRange(1, 1, 1, SHEET_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1B7361');
    headerRange.setFontColor('#FFFFFF');
  }
  return sheet;
}

function findMediaByCode_(code) {
  const rootFolder = getOrCreateRootFolder_();
  const ss = getOrCreateSpreadsheet_(rootFolder);
  const sheet = getOrCreateLinkSheet_(ss);
  const rows = sheet.getDataRange().getValues();
  for (let r = rows.length - 1; r >= 1; r--) {
    if (String(rows[r][1] || '').trim().toUpperCase() === code && String(rows[r][16] || '') !== 'DELETED') {
      return mapSheetRowToMediaObj_(rows[r], r + 1);
    }
  }
  return null;
}

function listMediaFromSheet_(filter) {
  const rootFolder = getOrCreateRootFolder_();
  const ss = getOrCreateSpreadsheet_(rootFolder);
  const sheet = getOrCreateLinkSheet_(ss);
  const rows = sheet.getDataRange().getValues();
  const out = [];
  const modFilter = String(filter.module || '').trim().toUpperCase();
  const nrpFilter = String(filter.nrp || '').trim();
  const refFilter = String(filter.refId || '').trim();
  const limit = Math.min(500, Math.max(1, filter.limit || 100));

  for (let r = rows.length - 1; r >= 1 && out.length < limit; r--) {
    if (String(rows[r][16] || '') === 'DELETED') continue;
    if (modFilter && String(rows[r][2] || '').toUpperCase() !== modFilter) continue;
    if (nrpFilter && String(rows[r][4] || '') !== nrpFilter) continue;
    if (refFilter && String(rows[r][3] || '') !== refFilter) continue;
    out.push(mapSheetRowToMediaObj_(rows[r], r + 1));
  }
  return out;
}

function mapSheetRowToMediaObj_(row, rowNum) {
  return {
    sheetRow: rowNum,
    timestamp: String(row[0] || ''),
    mediaCode: String(row[1] || ''),
    module: String(row[2] || ''),
    refId: String(row[3] || ''),
    nrp: String(row[4] || ''),
    label: String(row[5] || ''),
    fileName: String(row[6] || ''),
    mimeType: String(row[7] || ''),
    sizeKb: Number(row[8] || 0),
    fileId: String(row[9] || ''),
    driveUrl: String(row[10] || ''),
    viewUrl: String(row[11] || ''),
    thumbnailUrl: String(row[12] || ''),
    downloadUrl: String(row[13] || ''),
    folderPath: String(row[14] || ''),
    uploadedBy: String(row[15] || ''),
    status: String(row[16] || 'ACTIVE')
  };
}

function generateMediaCode_() {
  const now = new Date();
  const ymd = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyyMMdd');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return 'PSE-' + ymd + '-' + rand;
}

function sanitizeSlug_(s) {
  return String(s || 'GENERAL').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'GENERAL';
}

function sanitizeFileName_(name) {
  return String(name || 'media.jpg').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 90);
}

function inferExtension_(fileName, mimeType) {
  const fn = String(fileName || '');
  const dot = fn.lastIndexOf('.');
  if (dot > 0 && dot < fn.length - 1) return fn.slice(dot + 1).toLowerCase();
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf'
  };
  return map[mimeType] || 'bin';
}

function verifyApiToken_(incomingToken) {
  if (!GAS_CONFIG.API_TOKEN) return true;
  return String(incomingToken || '').trim() === String(GAS_CONFIG.API_TOKEN).trim();
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
