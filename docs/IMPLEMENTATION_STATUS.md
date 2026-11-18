# Implementation status — 18 November 2026

## Revisi tempo video — 1 → 2 → 3 → 1 → 2 → 3

- Mengganti efek maju–mundur cepat menjadi slideshow maju berulang. Tiga foto ditampilkan satu detik per foto, dua putaran, total enam detik. Layout custom 1–6 foto tetap mengikuti urutan capture, satu detik per pose, total enam detik.
- `slideshowOrder` dan encoder concat memakai durasi satu detik serta filter fps/limit 180 frame eksplisit. Regresi decode memeriksa seluruh 180 frame: masing-masing foto tepat 30 frame pada 30 fps, termasuk batas pergantian detik dan putaran kedua.
- Label UI kini "Preview video" / "Video MP4"; download lokal memakai nama `hoya-hoya-days-kmi-video.mp4`. Endpoint internal dan nama file Drive legacy tetap kompatibel. Dokumentasi video dan API diperbarui; alur folder kolase + video tetap sama.
- Verifikasi PASS: format, lint, typecheck, 46 unit/integration tests, production build dan satu E2E guest (preview/download MP4, edit dan upload mock). Seluruh 180 frame hasil decode sesuai urutan dan durasi satu detik per foto. Tidak melakukan upload Drive riil baru untuk perubahan tempo ini.

## Revisi hasil — kolase PNG + boomerang MP4 dalam folder Drive

- Implementasi `src/lib/boomerang.ts`, `video-server.ts`, dan `POST /api/boomerang`: enam detik MP4 H.264/yuv420p 1080 × 1920, 30 fps, tanpa audio, urutan tiga pose `1 → 2 → 3 → 2 → 1`. Mendukung layout custom 1–6 foto. Pose edit memakai filter/mirror/crop dari renderer bersama; video memakai kartu event orisinal, tidak meregangkan overlay strip.
- `src/components/booth.tsx`: preview PNG/MP4, download kedua format, invalidasi video setelah filter/mirror/retake, persetujuan pemrosesan sementara dan Drive, serta QR/link ke folder sesi. Foto/video/QR tetap Blob/state browser tanpa history, hilang saat refresh. PNG lokal tetap bisa diunduh tanpa server.
- `POST /api/photos` dan adapter storage: validasi tepat satu kolase + satu MP4, folder sesi privat baru, upload dua file sebelum share, validasi URL folder dan ACL folder/anak, rollback best-effort untuk kegagalan parsial. Root/frames/photos induk tidak dipublikasikan. Mock memvalidasi video nyata tanpa menyimpan hasil atau membuat link palsu.
- Encoder dibatasi dua pekerjaan per proses, timeout subprocess, JPEG/video byte limits, decode media, tanpa shell/input URL, OS temp privat dengan cleanup `finally`; tidak ada database. Binary FFmpeg/FFprobe bundled tersedia via npm, dengan override path sistem untuk produksi. File temp dapat tertinggal jika OS crash/kill paksa; prosedur operator didokumentasikan.
- Live Drive memakai media sintetis (blok warna dan PNG bertanda uji, tanpa foto pribadi): satu folder sesi berisi tepat `kolase.png` + `boomerang.mp4` berhasil dibuat; ACL ketiga folder induk tetap privat. Browser context baru tanpa login membuka folder dan melihat kedua file; MP4 berhasil diunduh tanpa autentikasi. Screenshot dan metadata hanya di `.qa/` ignored. Folder uji sukses dibiarkan tersedia untuk pemeriksaan operator; sesi uji gagal dibersihkan secara best-effort.
- Live smoke menemukan propagation delay ACL anak setelah folder dibagikan. `assertPublic` kini melakukan polling terbatas atas ACL sebenarnya sebelum mengembalikan QR, tetap gagal jika izin tidak terverifikasi.
- README, API contract, arsitektur, privacy, setup Drive, testing, operations, `.env.example`, `DEPLOY.md`, dan `docs/13_BOOMERANG.md` diperbarui. Nginx membutuhkan batas body 32 MiB dan timeout 180 detik. Deployment di server pengguna belum dijalankan dari sesi ini.
- Verifikasi: 46 unit/integration tests (5 files), 18 E2E Chromium, format/lint/typecheck dan production build PASS. Sembilan viewport kiosk serta fixture QR portrait/landscape tetap muat tanpa scroll setelah perbaikan toolbar dan spacing. E2E memeriksa pixel pose edit (mirror + warm/B&W), invalidasi cache video, MP4 playable dan multipart PNG + MP4. Smoke pada build produksi juga PASS untuk endpoint encode dan upload pasangan mode mock, tanpa link Drive palsu.
- Saat tab tersembunyi, kamera tetap dihentikan tetapi pekerjaan video/upload mempertahankan status busy sampai selesai agar edit tidak berubah di tengah proses. Regresi browser tambahan PASS memeriksa kontrol edit tetap terkunci ketika encode berjalan. Pemeriksaan akhir OS temp menemukan nol direktori `kmi-boomerang-*` tersisa; `.env.local` dan artefak sintetis `.qa/` tetap ignored Git.

## Dokumentasi deployment server Linux

- Menambahkan `DEPLOY.md` di root: Ubuntu/Debian, user `iot_gateway`, proyek `/home/iot_gateway/Photobooth`, Next.js `0.0.0.0:3005`, service systemd dan site Nginx bernama `kmi-photobooth`, domain `booth.todays.id`, DNS/HTTPS, pengujian operator, pembaruan dan troubleshooting.
- Contoh tidak memuat credential asli. Next.js memuat `.env.local` sendiri untuk mempertahankan escaping hash; systemd menggunakan path Node aktual yang ditemukan saat instalasi. Asumsi Nginx satu server dijelaskan beserta variasi proxy terpisah.
- Perubahan hanya dokumentasi; formatter dan pemeriksaan whitespace dijalankan. Tidak mengubah environment/aplikasi dan tidak menjalankan perintah deployment pada server remote. Verifikasi service, DNS, firewall, sertifikat dan smoke event tetap dilakukan operator di server.

## Perbaikan login admin — hash environment dan password enam karakter

- Diagnosis lokal: hash Argon2id dan session secret tersedia, tetapi `$` pada hash di `.env.local` belum di-escape sehingga Next.js melakukan ekspansi variabel dan merusak nilai saat memuat environment. Hash lama diperbaiki tanpa mengganti password operator atau konfigurasi Drive; nilai secret tidak dicetak.
- `scripts/local-env.ts` meng-escape literal `$`; `scripts/env.ts` memakai loader `@next/env` agar perilaku CLI sama dengan server. `scripts/admin-hash.ts` menerima minimal enam karakter, menyimpan hash langsung ke `.env.local`, membuat session secret bila belum valid, dan mempertahankan session secret valid yang sudah ada. Tidak ada kredensial default.
- `src/components/admin.tsx`: petunjuk konfigurasi yang sebelumnya selalu tampil diganti dengan instruksi login biasa. Error autentikasi aktual tetap berasal dari API server. README, template environment dan panduan setup/deployment disesuaikan.
- Regresi menguji password enam karakter melalui CLI → file environment → loader Next.js → verifikasi Argon2id dan API login signed-cookie; password di bawah enam karakter ditolak tanpa mengubah file. Pengujian browser memakai credential fixture terpisah dari akun operator.
- Folder build E2E `.next-e2e` diisolasi dari server dev operator agar tes tidak berebut lock `.next/dev`; folder tersebut diabaikan Git, formatter dan linter. Loader environment E2E dilewati karena seluruh konfigurasi disuplai oleh fixture, sehingga `.env.local` operator tidak bercampur atau mengubah hash test.
- Verifikasi: 35 unit/integration tests PASS; satu E2E Chromium admin PASS (login enam karakter, builder tiga slot, publish/unpublish/archive/logout); format, lint, typecheck dan production build PASS. Smoke konfigurasi pada server lokal mengembalikan `401 INVALID_CREDENTIALS` untuk password uji yang sengaja salah, bukan error konfigurasi. Login dengan password asli tetap perlu dicoba operator; password tersebut tidak diminta atau ditampilkan.
- Catatan dependency audit pada instalasi `@next/env`: npm melaporkan 16 high-severity findings pada dependency tree; audit dependency menyeluruh belum ditangani dalam perbaikan login ini.

## Setup Drive operator — terhubung dan live smoke PASS

- `.env.local` dibuat dari template dengan random admin session secret; file diperiksa ignored Git, secret tidak dicetak. Setelah OAuth/folder valid, mode diubah menjadi `google-drive`.
- Browser Google Cloud dapat dibaca. Identitas OAuth “Hoya-Hoya Days Photobooth” dibuat setelah persetujuan operator untuk Google API Services User Data Policy. Client web dengan callback `http://localhost:3847/oauth2callback` dibuat setelah konfirmasi operator; JSON diunduh lokal, Client ID/Secret diimpor ke `.env.local` tanpa dicetak. Akun operator terdaftar sebagai satu test user.
- Script setup mendukung `drive:configure` untuk JSON client web dan `--save-env` pada auth/bootstrap. Output credential disimpan atomik ke `.env.local`; test memeriksa preservasi konfigurasi dan penolakan newline injection.
- Operator menyelesaikan autentikasi/persetujuan Google sendiri; callback OAuth PASS dan refresh token tersimpan. `drive:bootstrap -- --save-env` membuat tiga folder privat, `drive:seed` mengimpor/publish tiga frame event dengan masing-masing tiga slot. Aplikasi localhost kini memakai penyimpanan Drive riil.
- Live smoke melalui browser aplikasi PASS: synthetic camera → 3 captures → review → consent → satu upload PNG final → QR Drive asli. Browser context baru tanpa akun Google berhasil membuka viewer hasil. Verifikasi API Drive: hanya satu PNG di photos, resolusi 1200×2826, ACL `anyone:reader` hanya pada file final; root/frames/photos tetap privat. Tidak ada raw captures yang diunggah.
- File uji sintetis tetap tersedia di folder photos agar operator bisa memeriksa; screenshot hasil/anonymous viewer dan metadata uji disimpan di `.qa/` (ignored). Tidak memakai foto pribadi atau referensi.
- Script setup: format/lint/typecheck, 34 unit/integration tests (4 files) dan production build PASS. Pengujian E2E mock sebelumnya 18 PASS; live smoke ini menambah bukti Drive riil.
- Batas operasional: OAuth masih External/Testing; token dapat kedaluwarsa dalam tujuh hari. Sebelum acara jangka panjang, lengkapi Branding lalu publishing Production sesuai kebijakan Google dan lakukan OAuth ulang bila diperlukan. Password admin operator masih perlu ditetapkan lewat `admin:hash`; setup Drive tidak mengarang password admin.

## Revisi — Hoya-Hoya Days, Kalbe Morinaga Indonesia

- `src/lib/event.ts`: identitas publik event terpusat. Header/footer, metadata browser, favicon kamera orisinal, landing dan copy booth diperbarui; nama file download `hoya-hoya-days-kmi.png`.
- `src/app/event.css`: palet acara hijau/putih, biru gelap dan aksen merah, judul event besar, tipografi serta ornamen foto. Palet merupakan interpretasi acara, bukan klaim brand guideline resmi; nama perusahaan ditampilkan sebagai teks, tanpa meniru logo. Referensi konteks perusahaan: [Kalbe CSR](https://kalbecsr.id/en/read/78/kalbe-morinaga-indonesias-commitment-to-the-highest-product-safety-and-quality-for-indonesian-children/).
- Builder aset deterministik menambahkan identitas event pada header/footer ketiga PNG dan thumbnail. Letak/dimensi tiga slot serta PNG sumber dipertahankan; ukuran teks menyesuaikan ruang footer Vintage yang pendek. Validasi dimensi/alpha PASS. Overlay/preview tetap identik dengan PNG final.
- Screenshot desktop/HP dan ketiga preview frame diperiksa. Sembilan viewport kiosk tetap satu layar. Semua foto berasal dari kamera; kartu frame tetap dapat diklik langsung.
- README mencatat lokasi konfigurasi identitas dan langkah pembaruan frame Drive yang sudah diimpor; tidak menjalankan mutasi Google Drive riil.
- Verifikasi akhir: format/lint/typecheck, 33 unit/integration, 18 E2E dan production build PASS. Setelah penyempurnaan header/footer frame, 4 tes booth (termasuk metadata, capture/retake, pixel export dan error upload) serta 33 unit/integration dijalankan ulang — PASS.
- Server produksi mock diperbarui di localhost:3000. Smoke desktop 1920×1080 dan HP 390×844 PASS: judul/nama perusahaan benar, landing tanpa scroll, klik gambar frame menuju kamera, tanpa picker galeri, tiga aset frame event dapat dimuat. Screenshot produksi tersimpan di `.qa/hoya-hoya-production-*.png`.

## Revisi — pilih gambar frame dan kamera saja

- `gallery.tsx`: seluruh gambar/kartu menjadi tombol native di booth dan link native di landing, dengan nama aksesibel, fokus keyboard dan disabled selama memuat overlay. Panah hanya dekorasi.
- `booth.tsx`, `kiosk.css`: menghapus picker dan handler upload foto galeri; memperbesar tiga kotak preview jepretan serta merapikan kontrol portrait/landscape. Pesan kegagalan kamera menjelaskan izin/HTTPS dan retry. Upload final ke Drive dan upload overlay admin tetap tersedia.
- Mengganti fixture galeri E2E dengan synthetic camera stream; regresi pixel export, retake, consent, QR test-only dan sembilan viewport tetap diuji. Satu test memakai countdown asli tiga detik.
- README dan panduan operasional/spec terkait diperbarui mengikuti permintaan kamera saja, menggantikan fallback galeri pada spesifikasi awal.
- Verifikasi: lint/typecheck, 33 unit/integration, 18 E2E, format dan build PASS. Sembilan viewport 320×568 hingga 1920×1080 tetap muat tanpa scroll. Screenshot kamera desktop/HP telah diperiksa: preview lebih besar dan kontrol rapi.
- Server produksi localhost diperbarui dalam mode mock. Smoke PASS: klik gambar frame dari landing langsung ke tahap kamera, pilih frame via Enter, tidak ada input foto galeri, preview jepretan lebih besar, halaman tidak scroll.

## Revisi — tiga foto per sesi bawaan

- Ketiga frame aktif kini memakai tepat 3 slot. Jumlah countdown/capture/retake mengikuti manifest tanpa hardcode jumlah foto di kamera.
- `scripts/build-starter-frames.ts`: build deterministik dari atlas PNG asli yang tetap disimpan. Pink/Vintage menghilangkan satu baris utuh beserta lubang keempat, mempertahankan header/footer; Mint memakai tiga slot vertikal dengan header/footer sumber dan panel vektor berkode. Semua output lolos validasi dimensi/alpha.
- Manifest aktif dan thumbnail diperbarui, resolusi Pink 1200×2826, Vintage 1000×2486, Mint 1200×2700; sumber manifest disimpan di `original-layouts.json` untuk rebuild.
- `drive:seed` mendukung penggantian seed lama melalui archive setelah varian baru berhasil dipublish. Tidak menjalankan operasi Drive riil tanpa credential/operator setup.
- Test kamera, gallery, retake, pixel export, admin builder dan kiosk diubah mengikuti tiga foto. Hasil: 33 unit/integration tests dan 18 E2E PASS; lint/typecheck/build PASS. Sembilan viewport kiosk tetap muat tanpa scroll.
- Server produksi localhost diperbarui. Smoke: seluruh tiga frame publik memiliki tiga slot, upload tiga foto langsung mencapai review dengan tiga tombol retake, dan halaman 390×844 tetap tanpa scroll — PASS.

## Revisi — tampilan kiosk tanpa scroll

- Permintaan lanjutan: halaman publik dan seluruh tahap booth muat satu viewport untuk pemakaian bergantian; responsive portrait/landscape.
- `src/app/kiosk.css`, `src/components/landing.tsx`, `src/components/kiosk.tsx`, public pages: shell `100dvh`, panel Beranda/Cara main/Koleksi lewat navigasi, footer ringkas dengan dialog privasi yang dapat dibuka via keyboard.
- `src/components/gallery.tsx`: pagination 3 frame per halaman desktop/landscape, 2 pada HP portrait, filter tema melalui select. Koleksi besar tidak memperpanjang halaman.
- `src/components/booth.tsx`: area kamera/preview mengikuti sisa tinggi layar; review dibagi panel Edit foto dan Simpan & bagikan; consent dan download tetap tersedia. Pesan error dapat dibuka lengkap lewat Detail tanpa menggeser layout.
- Halaman admin mempertahankan layout operasionalnya; aturan kiosk dibatasi ke halaman guest.
- Codebase-memory list/coverage tools tidak tersedia (Transport closed); pemeriksaan source dilakukan langsung pada file terkait. Membaca panduan page/searchParams Next.js lokal sebelum perubahan routing panel.
- QA selesai: 18/18 E2E PASS. Sembilan viewport: 1920×1080, 1366×768, 1024×768, 768×1024, 390×844, 360×640, 320×568, 844×390 dan 667×375. Seluruh tahap diuji melalui actual scroll dimensions, batas area kerja dan bounding box kontrol agar tombol tidak sekadar tersembunyi oleh overflow.
- Panel QR diperiksa pada 320×568, 390×844 dan 667×375 menggunakan response fixture khusus test, tanpa upload/link Drive live. QR minimal 192 px. Frame enam foto, pagination dan resize orientasi juga PASS.
- Regresi admin, kamera/countdown, retake, crop/mirror/filter, pixel preview/export, consent, mock upload, refresh dan kegagalan upload tetap PASS. Unit/integrasi 32/32, format/lint/typecheck/build PASS.
- Indikator development Next.js dinonaktifkan melalui konfigurasi resmi karena menutupi tombol footer pada layar kecil. Server produksi lokal diperbarui setelah build, tetap dalam mode mock.

## Fase 1 — Spesifikasi dan scaffold

- Membaca AGENTS.md, CODEX_PROMPT.md, seluruh docs/01–12, README, manifest seed dan panduan referensi.
- Repository awal hanya build kit; belum memiliki aplikasi atau Git metadata. Tidak ada kredensial Drive.
- Menambahkan scaffold Next.js App Router, TypeScript strict, Tailwind, ESLint, Prettier, Vitest.
- Implementasi diarahkan ke Node server lokal sesuai repository; tidak membuat deployment eksternal.
- Codebase memory belum memiliki index proyek ini; inventaris file dibaca langsung. Tidak ada kode lama untuk ditelusuri.
- PowerShell memblokir npm.ps1; menggunakan npm.cmd tanpa mengubah execution policy.

## Status

- Implementasi P0 selesai; seluruh quality gates otomatis lulus (rincian di bawah).
- Live Drive smoke telah dijalankan pada 18 November 2026 dengan gambar sintetis — PASS; rincian setup dan batas Testing di bagian teratas.

## Fase 2–4 — Implementasi berjalan

- `src/app`, `src/components`: landing orisinal mint/cream, gallery kategori, booth berurutan, countdown 3 detik, pemilihan kamera, fallback galeri, retake per slot/all, mirror, filter, preview/export canvas, local download, consent dan hasil demo/QR Drive.
- `src/lib/schema.ts`, `auth.ts`, `uploads.ts`: schema bersama, signed JWT HttpOnly admin, Argon2id, origin/CSRF, throttle best-effort, streaming body limit dan Sharp MIME/dimensi/alpha validation.
- `src/lib/storage`: adapter mock in-memory memakai ketiga manifest/aset asli; adapter Drive OAuth server-side, JSON per frame, aset immutable, revisi, rollback, ACL check dan cleanup foto gagal sharing.
- `src/app/api`: seluruh rute publik, login/logout/session, CRUD frame, publish/unpublish dan proxy aset terbatas.
- Admin server protected, dashboard, PNG upload, slot drag/resize, keyboard nudge, koordinat numeric, reorder, crop/radius, placeholder preview, save draft dan publish.
- `scripts`: admin hash dengan input disembunyikan, OAuth loopback dengan state, bootstrap folder private idempotent, seed manifest lokal menjadi metadata Drive.
- `npm.cmd run typecheck` — PASS pada implementasi awal; pengecekan ulang setelah test/fix menyusul.
- Dependency install berhasil; audit dan lint sedang diperiksa.

## Fase 5–6 — Integrasi dan QA

- `npm.cmd run lint` dan `npm.cmd run typecheck` — PASS setelah memperbaiki effect fetch dan tipe fixture.
- `npm.cmd test` — PASS, 32 tests di 3 file (schema, geometri/filter/retake, session/origin/throttle, upload/alpha, storage/Drive ACL/resumable retry, Route Handlers, komponen).
- `npm.cmd run build` — PASS Next.js 16.4.6, seluruh rute halaman/API, tanpa konfigurasi Drive.
- Browser E2E: admin create/draft/publish/unpublish/archive/logout PASS; guest gallery/retake/export/mock refresh PASS; fake camera 4 countdown + stop tracks + permission denial PASS; mobile 390 px tanpa clipping PASS.
- Menambahkan pixel test preview/export: crop/mirror/B&W dan dimensi PNG 1200×3600 PASS; memperbaiki titik fixture border yang kebetulan putih untuk memastikan overlay tidak ikut filter. Suite final 5/5 PASS.
- Foto test seluruhnya ilustrasi/warna sintetis; screenshot QA di `.qa/` (ignored). Gambar reference tidak disalin ke produk.
- Drive file >5 MiB menggunakan OAuth resumable session. File ID diprealokasi untuk retry dalam request; metadata write dengan hasil tidak pasti mempertahankan aset agar tidak membuat referensi rusak.
- `npm audit` awal menemukan 7 moderate transitif dev minimatch. Override patched 11.0.8; audit sesudah install: **0 vulnerabilities**. ESLint 9 diperlukan peer range plugin React.
- README telah ditulis ulang untuk aplikasi aktual; env disesuaikan. Dokumentasi awal dirapikan oleh formatter tanpa mengubah spesifikasi.

## Hasil final quality gates

| Perintah                   | Hasil                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| `npm.cmd install`          | PASS; package-lock.json tersedia                                     |
| `npm.cmd run format:check` | PASS                                                                 |
| `npm.cmd run lint`         | PASS, tanpa error/warning ESLint                                     |
| `npm.cmd run typecheck`    | PASS, TypeScript strict                                              |
| `npm.cmd test`             | PASS, 33 tests / 3 files                                             |
| `npm.cmd run test:e2e`     | PASS, 18 tests Chromium (termasuk kiosk responsive)                  |
| `npm.cmd run build`        | PASS, production build tanpa credential                              |
| `npm.cmd audit`            | PASS, 0 vulnerabilities                                              |
| `npm.cmd run admin:hash`   | PASS, stdin test-only; hash/secret output disembunyikan pada laporan |

E2E menguji login server dan redirect admin, PNG upload, empat slot via controls + drag/nudge, preview ilustrasi, draft/publish/unpublish/archive/logout, gallery publik, fallback foto, retake individual mempertahankan slot lain, download PNG, consent, demo tanpa QR, hilangnya state setelah refresh, kamera sintetis empat countdown, track stop, permission denied, dan mobile tanpa horizontal overflow. Pixel test memverifikasi crop/cover, mirror, B&W, overlay berwarna, PNG 1200×3600, kesamaan pixel preview/export dan upload gagal tetap dapat di-download. Overlay refetch diblokir selama guest test untuk membuktikan snapshot blob lokal digunakan hingga export.

## Production smoke lokal

- Menjalankan `npm.cmd start -- --hostname 127.0.0.1` dengan `STORAGE_MODE=mock` pada port 3000.
- HTTP homepage 200, CSP/nosniff headers, listing 3 seed dan seluruh PNG overlay 200, admin page redirect 307 ke login, admin API tanpa sesi 401, mutasi foto tanpa Origin 403 — PASS.
- Browser bundle tidak memiliki accessor secret env atau hash password. Nama variabel ADMIN pada petunjuk setup login adalah teks informasional, bukan nilai secret.
- Server demo dibiarkan berjalan di `http://localhost:3000`; tidak ada kredensial admin default atau koneksi Drive riil.

## Pengujian manual yang masih memerlukan operator

- Kredensial Google tidak diberikan: OAuth consent, refresh token, bootstrap/seed Drive riil, file JSON/PNG/WebP lintas restart, kapasitas akun dan kebijakan sharing belum diuji live.
- Verifikasi ACL via API sudah dikodekan dan diuji dengan test doubles; link viewer/QR pada HP incognito **belum** diklaim berhasil live. Ikuti `docs/05_GOOGLE_DRIVE_SETUP.md` sebelum event.
- Kamera fisik iOS Safari, Android Chrome, Firefox dan event Wi-Fi perlu smoke test perangkat nyata. Browser automated menggunakan Chromium dan kamera sintetis.

## Keputusan dan batas implementasi

- Tidak ada DB, ORM, Redis, session store eksternal, analytics atau persistent guest storage. Adapter mock hanya memori; tidak menyimpan foto final.
- Semua credential berasal dari environment. Hanya `.env.example` berada di repository; tidak membuat `.env.local`, token, atau password default.
- Real Drive menyimpan satu JSON per UUID frame, PNG versioned dan thumbnail WebP private; hanya satu final foto yang diberi anyone-reader. Aset versi lama tetap disimpan (maks. 100 histori per frame), cleanup manual.
- Delete adalah archive aman. Save draft memerlukan PNG awal tetapi boleh tanpa slot; publish membutuhkan 1–6 slot valid dan alpha yang sesuai.
- Listing/proxy no-store dipilih untuk visibilitas publish/unpublish langsung; tidak memakai TTL cache awal dokumen.
- Single operator MVP. `expectedRevision` bukan atomic CAS lintas server. Throttle in-memory bukan rate limit global; trusted proxy/WAF tetap tanggung jawab deployment.
- ID upload diprealokasi dan retry 429/5xx maksimal 3 attempts dalam request yang sama. Retry manual setelah respons hilang/restart bisa membuat duplikat; tidak menjanjikan exact-once.
- Logout menghapus cookie; token salinan yang dicuri berlaku sampai expiry. Rotasi session secret mencabut seluruh sesi.
- Resolusi ekspor mengikuti PNG asli: Pink 1200×3600, Vintage 1000×3200, Mint 1200×2100. Tidak merekayasa ulang aset seed.
- Batas foto 12 MiB, overlay 8 MiB, 30 MP; deployment ditujukan ke Node server HTTPS dengan payload/memory yang memadai. Tidak membuat deployment eksternal.
