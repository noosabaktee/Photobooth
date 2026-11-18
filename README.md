# Snapstrip — Digital Photobooth

Next.js App Router + React + TypeScript strict + Tailwind. Guest tanpa akun, foto di memori browser, frame dinamis dari Google Drive, satu PNG final dan QR langsung ke viewer Drive setelah public ACL terverifikasi. **Tidak memakai database.**

## Jalankan lokal

Memerlukan Node.js 24 LTS dan npm. Pada PowerShell yang memblokir `npm.ps1`, gunakan `npm.cmd` untuk setiap perintah npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Di PowerShell gunakan `Copy-Item .env.example .env.local`. Buka http://localhost:3000. Default `STORAGE_MODE=mock`: tiga frame dalam `examples/starter-frames/` (Pink Gingham, Vintage Film dan Mint Party), masing-masing **3 foto**. Banner DEMO terlihat di booth; upload demo **tidak menyimpan foto dan tidak menghasilkan QR/link Drive**. Perubahan frame demo disimpan di memori server, hilang setelah restart. Tidak ada password admin bawaan.

## Admin

```sh
npm run admin:hash
```

Masukkan password minimal 12 karakter (input disembunyikan). Simpan output `ADMIN_PASSWORD_HASH` dan `ADMIN_SESSION_SECRET` di `.env.local` atau secret manager, lalu restart server. Jangan commit output. Buka `/admin/login`.

Builder mendukung PNG transparan, deteksi dimensi, 1–6 slot, drag/resize sudut, nudge dengan panah (Shift untuk langkah besar), reorder, koordinat normalized, radius, dan crop alignment. Preview memakai ilustrasi orisinal. Save draft mengembalikan frame ke draft; Save & publish memeriksa layout dan alpha setiap slot. Delete mengarsipkan frame; aset lama dan foto hasil pengguna tetap disimpan.

## Guest dan privasi

Halaman publik memakai mode kiosk satu layar (`100dvh`) tanpa scroll. Beranda, Cara main dan Koleksi dibuka melalui navigasi; koleksi memakai pagination (3 frame desktop/landscape, 2 pada HP portrait). Di review, gunakan panel **Edit foto** atau **Simpan & bagikan**. Preview menyesuaikan tinggi layar dan download lokal selalu tersedia. Keterangan privasi lengkap dapat dibuka dari footer; tombol **Take another** memulai pengguna berikutnya dengan state foto baru.

`/` → `/booth`: pilih frame → buka kamera → countdown 3 detik per slot → review/retake individual atau semua → filter/mirror → PNG lokal atau consent dan upload. Klik gambar/kartu frame untuk memilih. Semua foto diambil melalui kamera; tidak ada upload galeri. Jika izin ditolak, aktifkan izin kamera melalui pengaturan browser lalu coba lagi. Kamera berhenti setelah capture, saat tab tersembunyi, atau saat komponen dilepas.

PNG memakai resolusi frame, crop cover dan overlay terakhir: Pink 1200 × 2826, Vintage 1000 × 2486, Mint 1200 × 2700. Ketiganya memiliki tepat tiga lubang foto. Preview/export menggunakan renderer yang sama. Filter dihitung di pixel sumber agar konsisten pada browser tanpa Canvas filter.

Varian tiga foto dibangun ulang secara deterministik dengan `npm run frames:build`. PNG sumber dan `original-layouts.json` dipertahankan; manifest aktif `starter-frames.json` memakai aset `*-3.png` dan preview baru. Builder admin tetap mendukung layout custom 1–6 slot.

Refresh/close menghapus foto, link, dan QR dari state aplikasi. Foto yang sudah masuk Drive **tetap ada** sampai operator menghapusnya. Link bisa dibuka siapa pun yang memilikinya. Tidak ada localStorage/IndexedDB, guest history atau analytics cookie. Admin menggunakan signed HttpOnly cookie.

## Aktifkan Google Drive

1. Ikuti [setup OAuth](docs/05_GOOGLE_DRIVE_SETUP.md). Buat OAuth **Web client**, aktifkan Drive API, tambahkan redirect persis `http://localhost:3847/oauth2callback`.
2. Isi client ID/secret dan redirect URI di env. Jalankan `npm run drive:auth`, buka URL consent dengan akun operator. Callback memeriksa state; refresh token hanya dicetak di terminal lokal. Simpan `GOOGLE_REFRESH_TOKEN` di env.
3. Jalankan `npm run drive:bootstrap`. Script membuat/menemukan folder berlabel aplikasi, menolak folder publik/domain, lalu mencetak tiga folder IDs untuk env. Folder tetap private.
4. Isi folder IDs, ubah `STORAGE_MODE=google-drive`, pastikan `NEXT_PUBLIC_APP_URL` sama persis dengan origin aplikasi (termasuk port), restart.
5. Opsional `npm run drive:seed` mengimpor tiga varian tiga foto, membuat thumbnail WebP dan JSON per-frame, lalu publish. Seed yang sudah ada dikenali berdasarkan tag. Seed lama 4/6 foto diarsipkan setelah pengganti tiga foto berhasil dipublish; aset lamanya tetap disimpan. Frame custom admin tidak diubah.
6. Tes upload disposable dan scan QR di HP/incognito sesuai [live smoke](docs/05_GOOGLE_DRIVE_SETUP.md#e-live-smoke-test-wajib-sebelum-event).

Scope hanya `drive.file`; folder dibuat aplikasi. OAuth External Testing dapat memiliki refresh token berumur tujuh hari; atur publishing status sesuai kebijakan Google. Build/test tidak menjalankan upload Drive riil.

## Environment

Daftar lengkap: [.env.example](.env.example). Admin membutuhkan hash Argon2id dan session secret minimal 32 byte. Drive membutuhkan client ID/secret, refresh token dan frames/photos folder IDs. Root folder ID adalah catatan operator. `NEXT_PUBLIC_APP_URL` hanya origin publik, bukan secret. Session default 8 jam, konfigurasi dibatasi 1–24 jam.

Batas keras foto final 12 MiB, overlay 8 MiB dan 30 MP. Env `MAX_FINAL_PHOTO_BYTES`, `MAX_FRAME_OVERLAY_BYTES`, `MAX_FRAME_PIXEL_COUNT` dapat menurunkan batas. Stream aktual dibatasi sebelum parsing multipart. Foto capture diresize ke maks. 1920 px untuk mengendalikan memori.

## Verifikasi

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E menjalankan server terisolasi port 3100 dengan credential test-only sementara di environment. Memakai ilustrasi dan kamera sintetis, tidak menyentuh Drive/foto pribadi. Hasil aktual: [IMPLEMENTATION_STATUS](docs/IMPLEMENTATION_STATUS.md).

ESLint 9 dipertahankan karena peer range `eslint-plugin-react` yang dipakai Next belum mendukung ESLint 10. Override transitif minimatch memakai versi perbaikan 11.0.8; validasi lint/test tetap dijalankan. Lockfile mengunci instalasi reproducible.

## Struktur

- `src/app`: halaman dan Route Handlers sesuai [kontrak API](docs/04_API_CONTRACT.md).
- `src/components`: landing/gallery, booth, dashboard, builder, tombol shadcn berbasis Radix.
- `src/lib`: Zod schema, auth/CSRF, bounded uploads, renderer, validasi URL, storage adapters/repository.
- `scripts`: hash admin, OAuth state-checked, bootstrap, import seed.
- `tests`, `e2e`: unit/integrasi dan Playwright.
- `examples/starter-frames`: aset demo asli; `references` hanya inspirasi visual.

## Deployment dan batas desain

Gunakan Node server dengan HTTPS reverse proxy: `npm run build` lalu `npm start`. Proxy harus menerima multipart minimal 13 MiB; server membutuhkan memori untuk decode 30 MP dan runtime cukup untuk Drive. Periksa batas host; jangan menganggap serverless menerima 12 MiB. Atur origin/secrets di host; trusted proxy harus mengganti X-Forwarded-For. Tambahkan WAF/rate limiting sebelum event publik. Throttle lokal bukan proteksi terdistribusi.

Listing dan proxy aset memakai `no-store`, sehingga publish/unpublish berlaku pada request berikutnya. Tidak ada TTL cache pada MVP. JSON per frame menggunakan `expectedRevision`, tetapi Drive bukan atomic CAS lintas instance; operasikan dengan satu admin. Overlay lama disimpan sampai cleanup manual (maks. 100 entri versi metadata). Guest menyimpan blob sehingga tetap dapat selesai setelah unpublish.

Upload Drive preallocates file ID untuk retry 429/5xx dalam request yang sama. Client membatasi satu upload aktif. Retry setelah respons jaringan hilang/restart masih bisa membuat duplikat karena tidak ada persistent idempotency store. ACL `anyone:reader` diperiksa sebelum URL dikembalikan; ini **bukan** tes HTTP incognito. Sharing gagal → tidak ada QR → cleanup best-effort dan download lokal tersedia. Logout menghapus cookie; token yang dicuri tetap berlaku sampai expiry. Rotasi secret mencabut semua sesi.

Lihat [keamanan](docs/06_SECURITY_PRIVACY.md), [deployment](docs/09_DEPLOYMENT.md), dan [operasional](docs/10_OPERATIONS_GUIDE.md). Kamera perangkat fisik dan QR Drive incognito perlu dites operator sebelum event.
