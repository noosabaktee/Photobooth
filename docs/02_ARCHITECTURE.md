# 02 — Technical Architecture (no database)

## Alur aktif event - 24 November 2026

Peserta membuka `/` atau `/booth` dan langsung masuk layar ambil foto tanpa landing, galeri pilihan frame atau navbar atas. Booth mengambil template aktif dan durasi scan dari `GET /api/settings`, memuat snapshot overlay, lalu menunggu peserta menekan **Buka kamera** pada kunjungan pertama. Kamera hanya otomatis terbuka pada reload lanjutan setelah hasil sesi selesai (timer QR atau Foto lagi). Refresh biasa kembali menunggu Buka kamera. Izin kamera browser tetap diperlukan; Buka kamera tersedia sebagai retry jika perangkat/izin gagal. Peserta menekan **Mulai countdown**. Setelah foto terakhir, PNG + MP4 disimpan otomatis dan QR tampil. Sesudah timer admin habis (default 15 detik), media dibersihkan dan **halaman dimuat ulang**, kamera terbuka untuk peserta berikutnya. Browser tidak dapat mendeteksi apakah QR telah dipindai; pergantian peserta mengikuti timer atau tombol Foto lagi.

Admin tetap menyimpan banyak template dan memilih **Template aktif booth** pada Pengaturan antrean booth, lalu **Simpan pengaturan**. Hanya template published boleh dipilih. `activeFrameId` disimpan bersama durasi dalam JSON privat Drive; tanpa database. Konfigurasi lama/null memakai template published pertama sebagai fallback eksplisit. Template aktif yang di-unpublish/arsip tidak diganti diam-diam: booth meminta operator memilih pengganti. Perubahan berlaku pada halaman/sesi berikutnya, tidak mengganti snapshot sesi yang sedang berlangsung. URL `?frame=...` dari peserta tidak memilih template.

Spesifikasi alur di bagian ini menggantikan ketentuan landing/pilih frame/reset ke galeri pada bagian lama di bawah. Preview/loading/error/final, QR PNG/MP4, privasi memori, dan auth admin tetap mengikuti ketentuan lain.

Preview galeri/admin/builder memakai `renderFramePreview` dan renderer cetak bersama, dengan placeholder AREA QR. Builder unsaved POST ke `/api/admin/preview` yang dilindungi admin. Setelah folder riil dibuat, server menambahkan QR ke MP4 (`stampVideo`) dan PNG sebelum upload/sharing. Respons berisi `photoDataUrl` + `videoDataUrl` dengan byte final yang identik dengan Drive, disimpan hanya di memori browser. Tidak ada sesi media server baru atau URL download sementara.

## 1. Komponen

Revisi antrean 23 November 2026: Buka kamera langsung aktif tanpa checkbox; informasi privasi tersedia di footer dan izin kamera browser tetap berlaku. Browser otomatis membuat/mengirim kolase natural + MP4 sesudah capture. Snapshot `printLayout` membatasi area perubahan di bawah semua slot. Untuk tiga seed, enum `starterStyle` meneruskan background/border badan frame dan mengganti panel hijau lama; artwork yang sama dipakai saat membangun aset seed. Untuk template custom tanpa style, server mencari pita datar di bawah slot dan melanjutkan warna/sisinya untuk QR dan memindahkan ujung bawah asli ke bawahnya; tanpa pita yang sesuai, area QR melanjutkan tepi bawah. Foto tidak ditutup/digeser. Byte PNG final yang diunggah dikembalikan sebagai `photoDataUrl` agar preview/download identik. Timer default 15 detik baru berjalan setelah QR dimuat, kemudian membersihkan sesi browser. Admin mengatur 5–300 detik melalui JSON privat `frames/kiosk-settings.json`; API publik hanya mengekspos durasi. Tidak ada database/history baru. Mock tidak menyimpan media atau membuat QR Drive palsu.

```mermaid
flowchart TD
  U[Guest browser /booth] -->|GET frame gallery| API[Next.js Route Handlers]
  U -->|getUserMedia client-side| CAM[Browser camera]
  CAM --> R[Canvas compositor in browser]
  R -->|edited JPEG poses + processing consent| V[FFmpeg temporary video processing]
  V -->|MP4 returned to browser memory| U
  R -->|final PNG + MP4 + Drive consent| API
  A[Admin browser] -->|signed session, CRUD frame| API
  API -->|OAuth refresh token server only| G[Google Drive API]
  G --> FR[frames folder: PNG + thumbnail + per-frame JSON]
  G --> PH[photos private / session folder: PNG + MP4]
  API -->|real public viewUrl after share| U
  U --> QR[QR generated in browser state]
  QR --> PHONE[Phone opens shared session folder]
```

**Important:** The diagram shows persisted templates and photos in Google Drive, not in a local database. The QR is an in-memory representation of a URL, NOT a permanent record.

## 2. Responsibility split

| Frontend                                | Server                                   | Google Drive                      |
| --------------------------------------- | ---------------------------------------- | --------------------------------- |
| Camera + countdown + photos in memory   | Auth admin & cookies                     | Frame overlay assets & thumbnails |
| Frame preview + photo strip composition | Validate request/schema/MIME/size        | One JSON config per frame         |
| Upload otomatis + timer reset           | Files list/read/upload/update/delete     | PNG cetak + MP4 per sesi          |
| QR generation from returned URL         | Permissions share/read verification      | Ownership, capacity & ACL         |
| User notices & error UX                 | Sanitized errors + best-effort throttles | View/download URL                 |

## 3. Drive file conventions

**Drive root** created on behalf of OAuth operator. `drive.file` scope works for files created/opened by the application. `frames/` contains `<frameId>.json`, `<frameId>-v1-overlay.png`, `<frameId>-v1-thumb.webp` etc. `photos/` stays private and contains session folders `Hoya-Hoya-<YYYY-MM-DD>-<uuid>/`, each with `kolase.png` and `boomerang.mp4`. Only the session folder is shared. Frame metadata JSON references immutable asset versions; no global manifest or database.

### Public gallery read

1. Backend lists JSON configs in `frames/` (by controlled folder ID and `name` suffix .json / MIME).
2. Reads & validates JSONs. Cache for e.g. 30 seconds, and invalidate on publish if supported.
3. Returns only published metadata with **internal same-origin** asset URLs (server proxy). Do not expose file tokens.
4. App reads overlay/thumbnail through restricted proxy endpoint using published config. Avoid generic `?fileId=` proxy.
5. For admin, include drafts only after valid login.

**Scaling limit:** one JSON per frame makes several Drive API reads. Acceptable for small collections and MVP. For 100s/1000s of frames, use Drive appProperties indexing, object storage/CDN or persistent indexing service. Never introduce a DB secretly.

### Public photo write

1. Render full PNG locally. PNG download does not send any photo to the server.
2. After the final camera capture, render natural portrait poses in the browser, send them to `/api/boomerang`, and receive a six-second MP4 back into browser memory. Bounded temporary files are deleted in `finally`; two jobs per process, timeouts, no shell commands, no database.
3. Automatically send PNG + MP4 and the bounded layout snapshot to `/api/photos`; verify both media streams and layout dimensions before any Drive mutation. Guest starts through Buka kamera and countdown without a confirmation checkbox; privacy remains available in the footer.
4. Create a private session folder under private `photos/`, integrate the folder QR into the PNG footer, upload the two files, then set `anyone:reader` on **that session folder only**. Verify inherited public access on both children.
5. Return the actual Drive folder `webViewLink` only after all steps succeed. Roll back the session best-effort on partial failure; never return a QR for incomplete results.
6. Client validates the exact Drive folder ID and generates QR. Original captures are not stored in Drive. Browser photos/MP4/QR disappear on refresh; uploaded Drive files remain. Request loss can still create a duplicate folder on manual retry.

### Per-file public link risks

The Google Drive result remains retrievable if link was copied or scanned; closing the photobooth tab does not revoke access. User photos are not guaranteed private because links can be forwarded. Keep the privacy notice available and document operator deletion/retention.

## 4. Admin frame lifecycle

```
NEW → DRAFT → PUBLISHED → UNPUBLISHED → PUBLISHED
                   └── (soft archive / delete)
```

Use immutable `overlayFileId` on each edit. On update create v2 asset, update JSON only after new asset passes upload and validation. When a guest selects a published frame, fetch and retain the selected overlay as a Blob in client memory for the whole capture/edit/export flow; do not fetch again just before export. Existing user sessions should therefore finish even if the admin unpublishes or updates the frame while the session is active. Retain previous overlay assets for a safe transition period as well. Do not immediately purge older overlays; keep N versions or delayed/manual cleanup. Use `updatedAt` and a `revision` integer for basic optimistic concurrency on admin writes: reject outdated edit with 409. This does not ensure perfect CAS across serverless with Drive; document concurrent admin limitation and prefer single admin for MVP.

## 5. Runtime & modules suggested

```
src/
  app/
    page.tsx
    booth/page.tsx
    admin/login/page.tsx
    admin/page.tsx
    admin/frames/new/page.tsx
    admin/frames/[id]/edit/page.tsx
    api/frames/route.ts
    api/frames/[id]/route.ts
    api/frames/[id]/asset/[kind]/route.ts
    api/photos/route.ts
    api/admin/login/route.ts
    api/admin/logout/route.ts
    api/admin/frames/route.ts
    api/admin/frames/[id]/route.ts
  components/{landing,booth,camera,frame-builder,shared}/
  lib/
    auth/{cookie,password,csrf}.ts
    drive/{client,folders,frames,photos}.ts
    storage/{interface,google-drive,mock}.ts
    schemas/{frame,api}.ts
    compositor/{geometry,render}.ts
    uploads/{validation}.ts
    qr/{urls}.ts
  hooks/{useCamera,useBoothSession}.ts
  tests/
  scripts/{generate-admin-hash,google-auth,drive-bootstrap}.ts
```

Exact folders can differ if code stays organized.

## 6. Cache, consistency and rate limits

- Public frame listing 30-second (configurable) TTL, stale assets use versioned file IDs.
- Never cache admin responses or auth as publicly shareable content.
- Cache private frame proxy in CDN only for `published` assets with immutable versioned URL; do not allow unpublish leak assumptions: cached thumbnails may persist until TTL.
- Rate limits: local in-memory throttles are only best-effort; serverless multi-instance needs provider WAF/rate limit/CDN or a distributed tool (out of scope without DB). Optionally integrate Turnstile, no hidden state store.
- For concurrent uploads & Drive quota 429/5xx, bounded exponential backoff; log request outcomes minus secrets.

## 7. Dependencies on external environment

- OAuth 2.0 client ID/secret & refresh token owned by operator.
- Folders created/registered by app bootstrap within Drive account.
- Enough Drive storage. `anyone-with-link` must be allowed by Google account / Workspace policies.
- Upload payload limits of selected deployment platform; don't assume every serverless provider can accept 12 MB requests. Document safe max per provider. Consider compression or direct signed upload via appropriate storage in future.

## 8. What not to implement

No guest user DB, no gallery of previously captured user photos, no admin-managed events DB, no `localStorage` to persist QR. Do not leak unauthorized draft assets through generic backend proxy. Do not use service account with personal My Drive as default (quota/ownership constraints).
