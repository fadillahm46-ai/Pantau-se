# PANTAU SE — Support Equipment Hub

Aplikasi web **PANTAU SE** (Pusat Administrasi & Navigasi Terpadu Support Equipment) untuk monitoring operasional Support Equipment secara terintegrasi: **Dashboard KPI SE**, **Data Manpower & Legalitas**, **Performa Manpower (ATR, Absensi, Punishment & Eviden Foto)**, **Utilitas & Operasi Unit (Komisioning, HM & UA, Rental BIB, Big Crane)**, **Operasional SE (Lubetruck/Watertruck & Lifting)**, **Roster SE**, **Pusat Informasi**, dan **Master Data**.

---

## Arsitektur Penyimpanan Hybrid (3 Lapis)

Aplikasi ini dirancang menggunakan arsitektur penyimpanan hybrid agar cepat, hemat kuota, dan mudah diaudit:

| Lapisan | Teknologi | Fungsi |
| :--- | :--- | :--- |
| **Database Data** | **Supabase (PostgreSQL)** | Menyimpan seluruh data operasional, master data, manpower (termasuk password akun & MCU 9 bulan), roster & PIC roster, ATR, punishment, HM/UA, rental, big crane, operasional LT/WT & Lifting, serta pusat informasi (**24 tabel, seluruh RLS dinonaktifkan**). |
| **Storage Media / Foto** | **Google Drive via Google Apps Script (`code.gs`)** | Menyimpan file media (foto eviden punishment, dokumen komisioning/manpower) secara rapi ke folder `PANTAU_SE_MEDIA/<MODUL>/YYYY-MM`. |
| **Registry Kode Link** | **Google Spreadsheet** (+ indeks `media_registry` Supabase) | Setiap media yang diunggah lewat `code.gs` otomatis diberi kode unik `PSE-YYYYMMDD-XXXXXX` dan dicatat link Drive / View / Thumbnail-nya ke sheet `MEDIA_LINKS`. |

---

## Struktur File Proyek

```text
PANTAU SE/
├── index.html                   # Halaman utama SPA + tempat konfigurasi API Supabase & GAS
├── supabase_schema.sql          # Skema 24 tabel PostgreSQL Supabase (semua RLS disabled)
├── code.gs                      # Google Apps Script Web App (Upload Drive + Log Spreadsheet)
├── manifest.json                # Web App Manifest (PWA installable)
├── sw.js                        # Service Worker (PWA caching + bypass API Supabase & GAS)
├── server.js                    # Server HTTP Node.js ringan (tanpa dependency npm)
├── README.md                    # Panduan instalasi & konfigurasi ini
├── icons/
│   └── icon.svg                 # Ikon vektor aplikasi PANTAU SE (PWA & Favicon)
└── js/
    ├── app-core.js              # Konfigurasi APP_CONFIG, state global & utilitas inti
    ├── app-manpower-performa.js # Modul Data Manpower, Performa & KPI Pengawas
    ├── app-atr-punishment.js    # Modul ATR, Absensi, Punishment & Upload Eviden Foto
    ├── app-roster-info-master.js# Modul Roster, Pusat Informasi & Master Data
    ├── app-roster-views.js      # Tampilan Roster All, Personal & Daily
    ├── app-operasional-se.js    # Modul Operasional SE (LT/WT 23 kolom & Lifting 28 kolom) + Pagination
    ├── app-table-bulk-select.js # Checkbox Select & Quick Delete di seluruh tabel
    ├── app-cloud-sync.js        # Bridge sinkronisasi REST Supabase & upload/lookup media GAS
    ├── app-access-nav.js        # Kontrol 4 role akses, navigasi HP, drawer sub-menu, Searching & Profil
    └── app-auth.js              # Sistem Login permanen 1x login (localStorage + IndexedDB)
```

---

## Sistem Login Permanen (Sekali Login)

- **Cukup Sekali Login**: Sesi login disimpan permanen tanpa batas kedaluwarsa menggunakan penyimpanan ganda (`localStorage` + `IndexedDB` + `navigator.storage.persist()`). Pengguna hanya perlu login ulang jika aplikasi dihapus, seluruh data browser/aplikasi dibersihkan, atau menekan tombol **Keluar Akun** di bagian bawah sidebar.
- **Akun yang Didukung**:
  - **Admin SE (Default)**: User Name `admin`, Password `admin123` *(bisa disesuaikan via `ADMIN_PASSWORD` di `window.PANTAU_SE_CONFIG`)*.
  - **Seluruh Karyawan / Group Leader**: Gunakan **NRP** (atau Nama Lengkap) dan **Password** yang dikelola di menu **Master Data → Nama Manpower** *(password awal karyawan baru adalah NRP masing-masing; jika Supabase aktif, autentikasi otomatis mengecek data terbaru di tabel `public.manpower`)*.
- **4 Level Hak Akses & Navigasi Responsif (Desktop & HP)**:
  - **Admin**: Full akses ke seluruh menu termasuk **Master Data** dan **Atur PIC Roster**.
  - **GL & Section**: Akses operasional lengkap **tanpa Master Data**; edit Roster mengikuti PIC masing-masing (atau Password PIC).
  - **Manpower** *(semua jabatan selain Admin, GL, & Section)*: Hanya menampilkan menu **Beranda**, **KPI SE**, dan **Roster** (ditambah menu **Profil** khusus pada tampilan HP).
  - **Tampilan HP**: Bottom navigation khusus Admin/GL/Section (*Beranda, KPI, Manpower, Searching, Profil*) dan Manpower (*Beranda, KPI SE, Roster, Profil*), tombol **Sidebar Sub-Menu di pojok kanan atas** saat menu memiliki sub-menu, halaman **Searching** (cari menu/sub-menu & karyawan lintas modul), serta menu sisa ber-dropdown panah bawah di halaman **Profil** (menu **Profil** khusus mode HP karena semua menu sudah tampil di sidebar desktop).
- **Hak Akses & PIC per Roster**:
  - Setiap kategori roster di **Roster ALL** memiliki **PIC (Group Leader)** yang ditampilkan di bar atas tabel (`PIC : Nama GL`) dan disimpan pada tabel Supabase `public.roster_pic`.
  - **Admin SE** memiliki **Full Akses** untuk mengatur PIC tiap roster (*Atur PIC*) dan mengedit seluruh roster.
  - **GL (PIC)** yang login dengan NRP sesuai PIC roster dapat langsung mengedit roster tanggung jawabnya.
  - **Pengguna lain** (termasuk GL dari kategori lain) tidak dapat mengubah roster secara langsung dan wajib memasukkan **Password PIC** untuk mendapatkan izin edit sementara.
- **Fitur Pendukung Data & Ekspor**:
  - **Ringkasan Shift Harian**: Baris total personil **SHIFT 1** (putih) & **SHIFT 2** (hijau) per tanggal di bagian bawah tabel **Roster ALL**.
  - **Download Excel (`.xlsx`)**: Tersedia langsung pada menu **Roster ALL**, **Data ATR** (*Monitoring, Weekly, Monthly, & Punishment*), dan **Data Manpower**.
  - **Masa Berlaku MCU 9 Bulan**: Kolom **MCU Ulang** sekaligus berfungsi sebagai **Exp MCU** dengan masa berlaku otomatis **9 bulan** dari tanggal **Awal MCU**.

---

## Panduan Setup & Deployment

### 1. Setup Database di Supabase (`supabase_schema.sql`)

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor** → klik **New query**.
3. Salin seluruh isi file `supabase_schema.sql`, tempel ke editor, lalu klik **Run**.
4. Skrip akan membuat **24 tabel**, index, trigger `updated_at`, seed awal Master Data, migrasi aman masa berlaku MCU 9 bulan, serta menonaktifkan Row Level Security (`DISABLE ROW LEVEL SECURITY`) dan membuka `GRANT ALL` pada seluruh tabel.
5. Buka menu **Project Settings → API**, lalu catat:
   - **Project URL** (`https://xxxxxxxx.supabase.co`)
   - **anon / public API Key** (`eyJhbGciOi...`)

> **Daftar 24 Tabel Sinkron Web:**
> `master_jabatan`, `master_perusahaan`, `master_kode_roster`, `master_kode_spi`, `manpower`, `komisioning_unit`, `roster_bulanan`, `roster_pic`, `roster_daily_log`, `absensi_harian`, `atr_weekly`, `atr_monthly`, `atr_punishment_history`, `kpi_pengawas`, `hm_ua_daily`, `ua_weekly_upload`, `ua_mtd_upload`, `rental_bib`, `big_crane_timeframe`, `operasional_lt_wt`, `operasional_lifting`, `pusat_informasi`, `pusat_informasi_komentar`, `media_registry`.

---

### 2. Setup Media Storage di Google Apps Script (`code.gs`)

1. Buka [script.google.com](https://script.google.com/) → klik **New Project** (beri nama mis. `PANTAU SE Media Server`).
2. Hapus kode default di `Code.gs`, lalu salin seluruh isi file `code.gs` dari folder ini.
3. **Inisialisasi Otomatis Folder Drive & Spreadsheet**:
   - Di toolbar Apps Script, pilih fungsi **`setupPantauSeStorage`** lalu klik **Run**.
   - Berikan izin akses Google Drive & Google Spreadsheet saat diminta.
   - Cek **Execution Log**: skrip otomatis membuat folder `PANTAU_SE_MEDIA` di Google Drive dan Spreadsheet `PANTAU_SE_MEDIA_REGISTRY` (sheet `MEDIA_LINKS`) sekaligus menyimpan ID keduanya di `PropertiesService`.
   - *(Opsional)* Jika ingin memakai Folder Drive atau Spreadsheet yang sudah ada, isi langsung `DRIVE_ROOT_FOLDER_ID` dan `SPREADSHEET_ID` pada objek `GAS_CONFIG` di bagian atas `code.gs`.
4. **Deploy sebagai Web App**:
   - Klik **Deploy → New deployment**.
   - Pilih tipe **Web app**.
   - **Execute as**: `Me` (akun Anda).
   - **Who has access**: `Anyone` (agar aplikasi web dapat mengunggah foto tanpa blokir login).
   - Klik **Deploy**, lalu salin **Web app URL** (`https://script.google.com/macros/s/.../exec`).

---

### 3. Memasang API Supabase & Link GAS di `index.html`

Buka file `index.html` dan cari blok `window.PANTAU_SE_CONFIG` di bagian bawah file (tepat sebelum `<script src="js/app-core.js"></script>`):

```html
<script>
    window.PANTAU_SE_CONFIG = {
        SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOi...paste_anon_key_anda...',
        GAS_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
        GAS_API_TOKEN: '' // Opsional: isi sama persis dengan GAS_CONFIG.API_TOKEN di code.gs
    };
</script>
```

Simpan file `index.html`, lalu muat ulang aplikasi di browser.

> **Tips Verifikasi Koneksi:** Buka DevTools Console (`F12`) lalu jalankan:
> ```js
> await testCloudConnections()
> ```
> Untuk mem-backup seluruh data lokal/awal ke Supabase sekaligus:
> ```js
> await pushCurrentStateToSupabase(true)
> ```

---

### 4. Menjalankan Server Lokal / LAN (`server.js`)

Pastikan [Node.js](https://nodejs.org/) (v18+ disarankan) sudah terpasang. Tidak perlu `npm install` karena `server.js` memakai modul bawaan Node.js.

```bash
# Jalankan di port default 3000
node server.js

# Atau gunakan port kustom (PowerShell)
$env:PORT=8080; node server.js
```

Setelah aktif, buka browser di:
- **Lokal**: `http://localhost:3000`
- **Jaringan LAN** (HP/Tablet dalam Wi-Fi yang sama): `http://<IP-KOMPUTER>:3000`
- **Health Check**: `http://localhost:3000/api/health`

> `server.js` otomatis memblokir akses browser HTTP ke file sensitif (`server.js`, `code.gs`, `supabase_schema.sql`, `.env`) dan mengirim header `Service-Worker-Allowed: /` untuk PWA.

---

### 5. Instalasi sebagai PWA (Progressive Web App)

Saat aplikasi dibuka melalui `http://localhost:3000` atau domain **HTTPS**:
1. `sw.js` otomatis terdaftar sebagai Service Worker (aman dilewati saat dibuka langsung via `file://`).
2. Klik ikon **Install App** di address bar Chrome/Edge (atau **Add to Home Screen** di HP Android/iOS).
3. Request ke Supabase dan Google Apps Script otomatis di-**bypass** dari cache Service Worker agar data selalu real-time.

---

## Catatan Troubleshooting

- **Upload Foto GAS gagal CORS**: Pastikan deploy GAS menggunakan *Who has access: Anyone*. Frontend sudah memakai `Content-Type: text/plain;charset=utf-8` agar tidak memicu CORS preflight `OPTIONS`.
- **Update kode tidak langsung muncul di browser**: Service Worker menggunakan strategi *Network-First* untuk file HTML/JS lokal. Jika masih tertahan cache lama, tekan `Ctrl + Shift + R` atau naikkan `CACHE_VERSION` di `sw.js`.
- **Supabase mengembalikan data kosong / 401**: Pastikan `SUPABASE_ANON_KEY` adalah *anon public key* yang benar dan jalankan ulang bagian `DISABLE ROW LEVEL SECURITY` serta `GRANT ALL` di `supabase_schema.sql`.
