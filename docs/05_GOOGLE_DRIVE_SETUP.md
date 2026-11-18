# 05 — Google Drive / OAuth 2.0 Setup (operator)

Panduan ini untuk mengaktifkan upload **nyata**. Tanpa kredensial, aplikasi harus tetap bisa didemokan dengan `STORAGE_MODE=mock`, tetapi **tidak** meng-upload ke Google Drive.

## A. Siapkan akun dan Cloud project

1. Siapkan **akun Google khusus photobooth** (disarankan, terpisah dari akun pribadi), pastikan ada kapasitas Google Drive.
2. Buka [Google Cloud Console](https://console.cloud.google.com/) → buat project baru mis. `snapstrip-photobooth`.
3. Buka **APIs & Services / Library**, enable **Google Drive API**.
4. Konfigurasi **Google Auth Platform / OAuth consent screen**. Pilih audience yang cocok untuk akun yang dipakai. Set test user saat berada dalam mode testing.
5. Tambahkan scope minimal `https://www.googleapis.com/auth/drive.file`. Scope ini dirancang untuk file yang dibuat/digunakan aplikasi; folder bootstrap harus dibuat melalui aplikasi / dipilih dengan hak yang sesuai. Hindari request scope full Drive tanpa alasan.
6. Buat **OAuth Client ID** tipe **Web application** untuk script proyek ini; masukkan redirect URI lokal secara _persis_: `http://localhost:3847/oauth2callback`.
7. Catat `Client ID` dan `Client secret`. **Jangan commit, share publik, atau taruh dalam `NEXT_PUBLIC_*`.**

## B. Dapatkan refresh token (offline)

1. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` dan `GOOGLE_OAUTH_REDIRECT_URI` pada `.env.local`, atau unduh JSON client web lalu jalankan `npm run drive:configure -- "path/client_secret.json"`.
2. Jalankan `npm run drive:auth -- --save-env` untuk mendapatkan URL consent, kemudian login memakai akun Drive operator. Flag ini menyimpan token langsung ke `.env.local` tanpa mencetaknya; perintah tanpa flag tersedia untuk konfigurasi manual.
3. Script harus meminta `access_type=offline` dan `prompt=consent`, menangani callback dengan state verification, lalu mencetak token **secara aman** (hanya ke terminal lokal, tidak pernah ke client/log server production). Bila tidak ada refresh token baru, dokumentasikan revoke grant lama dan ulangi consent secara aman.
4. Simpan hasil ke `GOOGLE_REFRESH_TOKEN` dalam `.env.local` atau secret manager host. **Jangan pernah upload ke ZIP/repo.**
5. Hati-hati: Google menyatakan aplikasi OAuth audience External dengan publishing status **Testing** dapat menghasilkan refresh token yang kedaluwarsa dalam **7 hari**, kecuali scopes hanya identitas dasar. Agar tahan lama untuk penggunaan nyata, atur status produksi/verification sesuai persyaratan Google. Patuhi kebijakan dan permintaan verifikasi yang berlaku; jangan mengakali pembatasan.

## C. Bootstrap folder Drive

1. Jalankan `npm run drive:bootstrap -- --save-env`, dengan token valid. Ketiga folder ID disimpan langsung ke `.env.local`.
2. Script wajib membuat atau menemukan **folder milik aplikasi**:

   ```text
   PHOTOBOOTH_ROOT/
     frames/
     photos/
   ```

3. Catat output folder IDs ke `.env.local`: `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_DRIVE_FRAMES_FOLDER_ID`, `GOOGLE_DRIVE_PHOTOS_FOLDER_ID`.
4. Folder `frames/` dan konfigurasi JSON sebaiknya **tetap private**. File final `photos/` individual di-share `anyone:reader` setelah upload berhasil. Jangan set keseluruhan `photos/` folder ke public kecuali benar-benar disengaja.
5. `drive:bootstrap` harus idempotent (jangan membuat duplikasi folder tanpa pesan). Dalam scope `drive.file`, script tidak boleh berasumsi dapat mengelola folder yang dibuat manual dan tidak bisa diakses aplikasi.

## D. Isi env dan running

Copy `.env.example` → `.env.local`. Isi minimal:

```dotenv
STORAGE_MODE=google-drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
GOOGLE_DRIVE_FRAMES_FOLDER_ID=...
GOOGLE_DRIVE_PHOTOS_FOLDER_ID=...
ADMIN_PASSWORD_HASH=...
ADMIN_SESSION_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate password hash melalui `npm run admin:hash`, dan session secret via crypto random. Run `npm run dev`, login admin, buat frame, tes publik lalu tes upload user.

## E. Live smoke test WAJIB sebelum event

1. Impor tiga frame event dengan `npm run drive:seed`, atau di admin upload PNG overlay test, buat slot sesuai desain lalu publish.
2. Buka public page di incognito, lihat frame test.
3. Jalankan capture kamera → final PNG.
4. Klik upload consent dan tunggu sukses, simpan hasil test di Drive.
5. Pastikan satu file final ada di folder `photos/`; foto mentah tiap jepretan tidak diunggah.
6. Scan QR dengan HP akun Google yang **berbeda** atau tanpa login / incognito.
7. Pastikan link Drive dapat dibuka & diunduh. Jika Google Workspace memblokir external sharing, perbaiki policy atau gunakan pendekatan lain — jangan buat QR palsu.
8. Refresh halaman photobooth; QR hilang, foto tetap di Drive.
9. Unpublish frame; tidak tampil pada request gallery berikutnya (implementasi saat ini menggunakan `no-store`).
10. Hapus hasil test secara manual dari Drive untuk menghemat storage.

## F. Troubleshooting

| Masalah                               | Kemungkinan                                         | Langkah                                                         |
| ------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------- |
| `invalid_grant`                       | Refresh token expired/revoked/consent Testing       | Periksa status OAuth, ulangi flow offline secara sah            |
| `insufficientPermissions`             | Scope kurang / folder bukan file yang diizinkan app | Pastikan `drive.file`, folder hasil bootstrap, grant yang benar |
| `storageQuotaExceeded`                | Kapasitas akun Drive habis                          | Bersihkan foto lama / tambah storage, jangan terus retry        |
| `403` share permission                | Kebijakan sharing Workspace/akun                    | Pastikan anyone-with-link diizinkan atau revisi produk          |
| `429` / `5xx`                         | Kuota/Drive intermittent                            | Backoff bounded & retry; jangan upload paralel tanpa limit      |
| Frame tak langsung tampil             | TTL cache/public list                               | Tunggu TTL, gunakan invalidation on publish                     |
| Mobile camera tidak terbuka           | HTTP non-secure/permission denied                   | Gunakan HTTPS, periksa izin/sambungan kamera, lalu coba lagi    |
| Browser QR terbuka tetapi butuh login | Izin file bukan `anyone:reader`                     | Pastikan permissions.create sukses pada file foto final         |
| Upload gagal di production host       | Host membatasi request size/runtime                 | Ukur PNG, sesuaikan infra/proxy; lihat `09_DEPLOYMENT.md`       |

## G. Peringatan pemilihan autentikasi

**Default untuk personal Google Drive:** OAuth user account + refresh token. Service account standar tidak memiliki quota My Drive pribadi untuk memiliki file dengan cara yang diasumsikan banyak tutorial lama; untuk lingkungan Workspace yang membutuhkan service account biasanya perlu Shared Drive yang benar / domain-wide delegation. Jangan memilih service account sebagai default otomatis.

## H. Referensi resmi

- [Drive API auth scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Drive API upload/create](https://developers.google.com/workspace/drive/api/guides/create-file)
- [Drive API permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [OAuth refresh tokens](https://developers.google.com/identity/protocols/oauth2)
- [Drive API error handling](https://developers.google.com/workspace/drive/api/guides/handle-errors)
