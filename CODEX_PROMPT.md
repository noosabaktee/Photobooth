# MASTER PROMPT UNTUK CODEX — DIGITAL PHOTOBOOTH

## 0. Peran dan misi

**Revisi event 23 November 2026 (menggantikan alur guest review/edit/upload manual di bawah):** Buka kamera langsung tanpa checkbox konfirmasi → tiga foto dari frame bawaan → kolase natural dan MP4 otomatis disimpan → QR folder tampil → reset browser otomatis sesudah default 15 detik. Informasi privasi tersedia di footer dan izin kamera browser tetap berlaku. Tidak ada panel nuansa atau retake guest pada alur antrean. Admin mengatur durasi scan 5–300 detik melalui JSON privat di Drive, tanpa database. Area QR cetak melanjutkan warna/sisi footer frame, dengan area tenang kontras; tiga foto tidak ditutup atau digeser. PNG yang disimpan dan ditampilkan/diunduh sama persis. Timer dimulai setelah QR terlihat, tidak berjalan pada kegagalan upload, dan tidak menghapus hasil Drive. Lihat README, kontrak API dan operations untuk implementasi terbaru.

Kamu adalah senior full-stack engineer, frontend product designer, security-conscious backend engineer dan QA automation engineer. Implementasikan **aplikasi website Digital Photobooth siap digunakan** dari spesifikasi dalam repository ini. Hasil yang diterima harus **kode runnable** dengan tests, dokumentasi setup aktual, tanpa DB, dengan Google Drive untuk file final & metadata frame admin. Jangan hanya merangkum pekerjaan, membuat mockup statis, atau memberi instruksi manual menggantikan implementasi.

Baca **seluruh** `docs/` dan `AGENTS.md` sebelum coding. Gunakan gambar `references/reference-01-web-photobooth.png`, `reference-02-event-strips.png` dan `reference-03-gingham-birthday.png` sebagai moodboard saja. Dilarang menyalin merek/foto orang dari referensi ke halaman production.

### Prinsip keputusan

- Pilih cara paling sederhana yang aman dan bekerja untuk MVP.
- Backend menggunakan Next.js App Router Route Handlers (Node runtime); kamera, preview, komposisi gambar dilakukan di browser.
- Database **nol**: tidak ada SQL, NoSQL, Redis, ORM, persisten session server, atau auth provider yang bergantung pada DB.
- **Admin-managed frame** harus benar-benar tersimpan di Google Drive (overlay PNG transparan + thumbnail + file konfigurasi JSON per template).
- **Foto user final** harus di-upload ke folder Google Drive terpisah. Link Drive public-read hanya untuk tiap foto final; **frame/config tidak harus public**.
- QR langsung berisi `webViewLink` / view URL Google Drive hasil upload yang telah diuji permission-nya. Bukan QR ke halaman riwayat, bukan link data URL, bukan QR dummy.
- Menutup / refresh halaman menghapus state QR lokal. Foto **tetap** ada di Drive kecuali operator menghapus manual.
- Tidak perlu registrasi atau login untuk user photobooth. Login hanya admin.
- Bikin mode demo/mock yang bisa dikembangkan tanpa credential, tetapi di mode mock **jelas tertulis DEMO** dan tidak berpura-pura menyimpan ke Drive.
- Jangan memasukkan foto mentah user ke Drive, kecuali jika fitur itu ditambahkan secara sadar di luar MVP (default: **tidak**).

## 1. Stack & toolchain

- Next.js App Router, TypeScript strict.
- React, Tailwind CSS, shadcn/ui (komponen pilihan secukupnya), Lucide icons.
- `zod` untuk schema/validasi di server & client.
- `googleapis` dan `google-auth-library` untuk Google Drive OAuth server-side.
- `qrcode` untuk render QR di browser (mis. SVG atau canvas); sanitasi URL sehingga hanya host yang diizinkan.
- `jose` untuk JWT/signed cookie sesi admin (atau HMAC crypto node yang benar) dan `argon2` untuk validasi password hash.
- `sharp` bila diperlukan di server untuk mengecek ukuran/dimensi/alpha overlay, thumbnail, dan format gambar.
- Vitest + Testing Library untuk unit/integration; Playwright untuk E2E inti jika lingkungan mendukung.
- npm sebagai package manager standar; jangan pindah stack tanpa sebab teknis valid.

Konfigurasi versi sesuai rilis stabil dan kompatibilitas aktual; jangan mengunci versi lama tanpa alasan. Pastikan script `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e` (jika Playwright setup) tersedia.

## 2. UX dan rute WAJIB

### Public

- `/` landing page yang premium, cheerful, aesthetic, desktop/mobile; hero dengan dekorasi photo strips ilustratif dan CTA "Start Photobooth". Sertakan frame gallery 3+ contoh original dalam mode demo.
- `/booth` stepper: **Choose frame → Camera capture → Review & edit → Upload → QR/result**. Hindari pindah route yang me-reset hasil capture; gunakan state component/hook atau finite-state machine di client.
- UI state: idle, loading camera, permission denied, camera unavailable, countdown, capture, review, edit, rendering, uploading, upload failed, complete.
- Camera meminta izin setelah klik user; `getUserMedia` secure context; depan/selfie mirror preview; hasil ekspor orientasi konsisten; start/stop tracks saat halaman dihentikan. Default 3 detik countdown; capture sejumlah `slots` frame otomatis berurutan; progress indikator x/y; flash lembut/sound optional muted by default.
- Bisa pilih kamera jika banyak device; fallback file upload kamera/galeri jika browser tidak mendukung atau izin ditolak.
- Review foto: retake per slot & retake all; jangan otomatis kehilangan foto yang belum terganti.
- Editing sederhana: filter preset natural/B&W/warm/cool (aplikasikan konsisten ke preview dan eksport), toggle mirror jika diperlukan, non-destructive state, hasil akhir PNG high resolution. Slot foto dan frame mengikuti format JSON dalam `docs/03_FRAME_FORMAT.md`. Editor user TIDAK dapat upload/publish frame baru.
- Proses upload menampilkan progress/kondisi jelas (jangan bikin progress palsu jika network API tidak menyediakan); implementasikan retry secara aman (hindari duplikat upload berlebihan).
- Saat sukses: QR code besar, tombol "Open on phone", "Copy link", "Download locally" dan "Take another"; CTA scan menggunakan HP. UI ingatkan file yang sudah masuk Drive tetap ada. QR cuma state memori; tidak ada history/localStorage/IndexedDB persistent.
- Tampilkan privacy confirmation sebelum upload: foto akan disimpan ke Google Drive operator dan dapat dilihat oleh siapa saja yang punya link. Jangan upload tanpa action user.

### Admin

- `/admin/login` login satu operator via `ADMIN_PASSWORD_HASH` (Argon2id) dan signed HTTP-only secure sameSite cookie; logout, expiry 8 jam atau konfigurabel.
- `/admin` dashboard daftar frame, thumbnail, label, ukuran, slot, status draft/active, aksi create/edit, publish/unpublish, duplicate optional, delete dengan konfirmasi.
- `/admin/frames/new` dan `/admin/frames/[id]/edit`: upload PNG overlay transparan, deteksi dimensi, tambahkan 1..6 slot, drag/resize slot WYSIWYG dengan koordinat normalized, urutan slot, zoom/crop alignment, optional cornerRadius, preview menggunakan placeholder foto buatan sendiri, panel JSON atau controls yang aman, save draft, publish setelah validasi.
- Saat user memilih frame, **fetch blob overlay yang dipilih ke state memori client** dan gunakan blob tersebut sampai export selesai (jangan fetch ulang overlay saat render). Saat mengganti PNG sebuah frame, jangan memutus pengguna di tengah sesi: gunakan ID/frame version immutable dan snapshot aset di client; jangan langsung hapus versi lama. Publish/update mengubah versi; sesi yang terlanjur memilih frame boleh selesai dengan snapshot lama tanpa overlay 404. Dokumentasikan strategi versi dan gunakan implementasi yang masuk akal.
- `/admin` dilindungi di server. Semua API write/admin metadata dijaga auth dan origin check. Tidak ada credential/admin secret pada `NEXT_PUBLIC_*`.
- CRUD frame memanggil Drive via server. Frame draft tidak muncul pada gallery publik. Frame public boleh di-cache dengan invalidasi atau TTL singkat.

## 3. Google Drive wajib berfungsi tanpa DB

Gunakan **OAuth 2.0 user account** khusus operator dengan offline refresh token untuk akses ke **My Drive**; jangan berasumsi service account biasa bisa menulis ke My Drive personal tanpa masalah quota/ownership. Scope minimal yang masuk akal `https://www.googleapis.com/auth/drive.file` dan **folder dibuat oleh aplikasi/bootstrap**, agar app dapat mengelolanya dalam lingkup scope. Siapkan script / util setup folder. Jika butuh akses lebih luas, jelaskan alasan dan minta konfigurasi operator — jangan diam-diam upgrade ke full Drive scope.

Folder konsep:

```
PHOTOBOOTH_ROOT/               # dibuat oleh app OAuth
  frames/                      # overlay, thumbnail, JSON (private)
    <frame-id>.json
    <frame-id>-v<version>.png
    <frame-id>-v<version>-thumb.webp
  photos/                      # final PNG dari guest
    <date>-<random>.png
```

Catatan: file gambar contoh dalam folder proyek bukan frame produksi. Paket ini **sudah menyertakan 3 overlay PNG transparan original, thumbnail, dan file local seed `examples/starter-frames/starter-frames.json` (4 foto pink, 4 foto vintage, 6 foto mint)**. Gunakan aset tersebut untuk mode demo dan testing tanpa perlu merekayasa file contoh lagi. Perlu diingat format starter-frames.json adalah manifest asset lokal (memakai `overlayPath`), bukan JSON metadata Drive final; jika perlu, sediakan script import/seed yang meng-upload overlay ke Drive dan mengubah path menjadi `fileId` sebelum dipublish. Admin juga bisa upload template desain barunya.

**Pola metadata per-frame**, bukan satu manifest JSON global: list file `<uuid>.json` dalam Drive, fetch/parse terbatasi secara paralel, validasi pakai Zod, hanya tampilkan `status=published` untuk publik. Jangan mengandalkan append/overwrite satu JSON global tanpa concurrency control. Untuk operasi edit, update hanya JSON frame tersebut; edit dan remove harus handle aset lama secara aman. Untuk penghapusan, soft unpublish lebih dulu dan proteksi sesi aktif; penghapusan permanen boleh admin lakukan sesudah konfirmasi dengan warning.

**Upload foto akhir**:

1. Client render satu final PNG, max reasonable 12 MB default; jika terlalu besar, jelaskan dan optimalkan sebelum upload.
2. `POST /api/photos` memvalidasi MIME/signature file PNG atau JPEG, ukuran, dimensi, CSRF/origin bila sesuai, melakukan upstream streaming/buffer secara aman di Node.
3. Drive API upload ke folder `photos`; set `permissions.create({type:'anyone', role:'reader'})` **hanya pada hasil final**.
4. Fetch metadata `webViewLink`, `webContentLink`, `id`, permission; pastikan link dapat diakses publik berdasarkan izin aktual; jangan menjanjikan tes incognito server jika tidak dapat diverifikasi lewat HTTP tanpa auth. Jika set permission gagal, jangan kembalikan link seolah sukses; hapus file upload orphan bila aman, atau log/clean up.
5. Return `viewUrl`, `downloadUrl?`, `fileId`, `filename` ke client. File ID boleh tampil di response; **OAuth refresh token tidak**.
6. QR generated dari **viewUrl nyata**. Karena Drive link bukan aset aplikasi, aplikasi tidak bisa mengontrol durasi berbagi setelah QR hilang.
7. Google Drive outages/quota error -> pesan recoverable, retry w/ bounded exponential backoff untuk 429/5xx, jangan upload mendua tanpa idempotency guard. Karena tanpa persistent idempotency, jelaskan keterbatasannya; implementasikan request in-flight guard client.

**Frame list and assets**: jangan jadikan `frames` folder publik. Implementasikan proxy GET read-only pada server untuk aset frame, validasi ID dari metadata frame + status published (atau sesi admin). Jangan buat general proxy yang menerima arbitrary Drive fileId, yang akan menjadi data leak. Gunakan cache headers wajar, safe MIME, CSP.

**Admin upload/edit**: simpan overlay + preview & JSON; lakukan rollback best-effort jika sebagian upload gagal. Pastikan admin dapat update frame dengan versi aset baru, thumbnail baru, metadata valid. Data tidak boleh hilang saat tab ditutup.

## 4. API dan data contract

Ikuti secara eksplisit `docs/04_API_CONTRACT.md` dan `docs/03_FRAME_FORMAT.md`. Implementasikan schema Zod bersama untuk UI dan server dan tipe TypeScript diturunkan dari schema. Gunakan error object consistent `{error:{code,message}}` tanpa internal stack trace. Batas maksimal upload + MIME sniffing, tanpa SSRF, path traversal, arbitrary remote URL. Semua mutasi auth-protected kecuali upload final foto user.

## 5. Komposisi & kualitas foto (krusial)

- Gambar frame adalah PNG RGBA, mis. 1200x3600, dengan slot transparan yang diisi foto dari belakang. Slot definisi normalized `(x,y,width,height)` dalam range 0..1 dan diturunkan dari ukuran output.
- Untuk setiap slot, draw foto memakai `cover` crop berdasar aspect ratio, clip rounded rect apabila perlu, lalu compositing frame overlay **di atas semua foto**. Jangan blank holes yang tertutup warna opaque; sediakan validasi alpha pada lokasi slot sebelum publish bila memungkinkan.
- Pastikan preview menggunakan algoritma yang sama dengan export agar WYSIWYG, ukuran preview bukan sumber kualitas file. Export minimum target lebar 1200 px atau sesuai frame target; dukung `devicePixelRatio` untuk preview bila sesuai.
- Urutan slot dapat berbeda dari posisi grafis, tetapi memiliki `order` unik dan konsisten dengan urutan capture.
- Pastikan frame assets dapat dicrop/render dari proxy tanpa CORS canvas tainting. Gunakan same-origin image URL dan `crossOrigin` jika diperlukan.
- Tambahkan unit tests geometri slot, aspect fill, mirror, Zod schema, state transition, rendering smoke tests saat dapat dijalankan.

## 6. Security/Privacy wajib

Implementasikan `docs/06_SECURITY_PRIVACY.md` secara masuk akal untuk MVP. Minimal: no secret client, server auth, argon2 hash, JWT cookie, sameSite, secure production, validation, anti-CSRF via origin + cookie strategy, upload limits, per-IP throttle best-effort + rekomendasi WAF/Turnstile. Jangan klaim in-memory limit cukup untuk serverless produksi. Sanitize error/log; jangan simpan foto dalam analytics; privacy notice, published links anyone-with-link, tindakan opt-in upload. Admin frame boleh privat. Google Drive OAuth `Testing` bisa menghasilkan refresh token yang expired dalam 7 hari untuk app External; dokumentasikan pindah ke Production / testing configuration yang sesuai kebijakan Google. Hindari scope restricted tanpa kebutuhan.

## 7. Desain UI

Visual harus terasa **produk photobooth sungguhan**, bukan boilerplate dashboard. Ambil inspirasi dari gambar:

- Referensi 1: green/teal hero background, card kaca lembut, preview tengah, film-strip miring kiri/kanan, CTA kamera jelas, pastel circles.
- Referensi 2: dua kolom strip event dengan area branding dan 3 stacked frames, floral/sticker accents.
- Referensi 3: pink gingham scrapbook, grid portrait + dekorasi birthday playful.

Buat orisinal: palette mint/teal & blush pink + cream, typography modern, responsif; admin polished neutral dashboard. Desain gallery frame harus bisa preview dan filter theme. Buat 3+ original example templates as local starter only; jangan import asset reference photography; boleh CSS generated examples / SVG illustrations sendiri untuk placeholder. Animasi halus tidak menghambat UX.

## 8. Pengujian dan deployment

- **Unit**: template schema valid/invalid, slot overlap/range/order, correct number of captures, link validation, admin auth signature, origin protection, renderer geometry.
- **Integration**: mock storage adapter; CRUD frame, public filtering, upload and fake link, permission failure, quota error.
- **E2E**: camera fake stream or upload file fallback, select template → 4 shots → retake → export → mock upload → QR success; admin login → upload frame → assign 4 slots → publish → frame muncul publik → unpublish hilang; logout blocks API.
- **CI quality**: lint/typecheck/unit/build; run Playwright if browsers are available or provide explicit skip note.
- **Google Drive live smoke**: documented manual procedure using disposable photos/frame; DO NOT run against actual Drive automatically without credentials and explicit operator configuration. Include incognito QR link check and Drive folder verification.
- Provide `.env.example`, `README.md` finalized for actual code, scripts for generating hash (`npm run admin:hash`) and Google OAuth bootstrap setup (`npm run drive:auth`, `npm run drive:bootstrap`), `docs/IMPLEMENTATION_STATUS.md`.
- Node/serverless constraints: use Node runtime for Drive SDK and Sharp, avoid deploy target request size limits, ensure configured platform supports photo upload size. For initial setup document a suitable deployment path and limitations. Do not claim any host has unlimited payload size.

## 9. Tahapan eksekusi (jalan terus, jangan berhenti di plan)

1. **Scaffold** Next.js + TS strict + Tailwind + test dependencies, scripts, folder layout, initial docs.
2. **Public UI** landing, gallery + select frame, camera capture hook, retake, layout renderer, results.
3. **Storage adapter** with mock and real Google Drive, OAuth setup, folders, frame JSON, photo upload/sharing.
4. **Admin auth & management** login, CRUD, drag/resize frame builder, publish/unpublish, preview, validation.
5. **QR & polish** reliable success flow, error states, accessible responsive UI, privacy notice, complete assets.
6. **Tests & fixes** lint, ts check, unit, E2E, production build. Resolve failures.
7. **Docs** update the README, operator setup, known limits, tests run, deployment details and decisions.

Gunakan command tool untuk mengecek repo setelah setiap tahap; catat hasil di implementation status. Bila ada kegagalan satu langkah, cari solusi teknis dan lanjutkan tahap lainnya; jangan cuma meminta user setup credentials di awal. Gunakan mock adapter supaya build & tests tetap lengkap tanpa Drive access.

## 10. Definition of Done — wajib semuanya

- [ ] `npm install` (atau `npm ci` setelah lockfile) berjalan.
- [ ] `npm run dev` membuka halaman landing & `/booth` dengan 3 frame contoh orisinal yang sudah disediakan di `examples/starter-frames/` untuk demo.
- [ ] Kamera bekerja dengan permission flow atau fallback upload file untuk pengujian.
- [ ] User bisa capture sebanyak jumlah slot frame, retake, preview dan PNG export final.
- [ ] Admin dapat login/logout, upload PNG transparan, define slots, save, publish/unpublish, edit, delete.
- [ ] Admin frame tersimpan lintas restart via Google Drive pada real storage mode, tidak ada database.
- [ ] Public gallery hanya frame published; frame baru muncul tanpa redeploy (modulo TTL singkat yang didokumentasikan).
- [ ] Output final di-upload ke Google Drive pada real storage mode dan share link anyone-reader dengan izin benar; error jika sharing gagal.
- [ ] QR tampil dari `webViewLink` nyata; user HP dapat memindai dan membuka link di incognito.
- [ ] Refresh/close menghapus QR state di aplikasi tanpa menghapus file Drive.
- [ ] Credentials hanya di server; admin API terlindungi; input tervalidasi; privasi jelas.
- [ ] Tests, lint, typecheck dan production build lulus; jika external Google unavailable jelaskan manual verification.
- [ ] README dan docs praktis untuk non-developer, daftar env lengkap, setup OAuth dan deployment.

## 11. Hasil akhir yang harus kamu laporkan

Saat selesai, laporkan singkat: fitur implemented, struktur folder, perintah menjalankan, env yang harus user isi sendiri, hasil commands tests, limitasi yang masih ada. Jangan mengklaim Google Drive real upload telah lulus jika belum diuji dengan credential asli. Jangan membagikan credential apa pun.

**Mulai implementasi sekarang.**
