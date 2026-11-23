# 04 — API Contract

Seluruh bagian bawah hasil cetak mengikuti tema badan frame: Vintage hitam dengan perforasi film, Gingham kotak-kotak pink dan Mint mint. Tidak ada panel hijau bersama atau kartu QR terpisah. Artwork diteruskan di belakang QR; modul putih pada Vintage dan hitam pada tema terang. Margin kosong QR tetap empat modul, dengan pola pastel berkontras rendah pada Gingham. Uji scan HP/printer sebelum acara. Renderer juga mengganti panel hijau pada hasil sesi baru yang memakai overlay seed lama; PNG hasil lama di Drive tidak diubah. Jalankan `npm run drive:seed` sekali setelah deploy untuk upgrade aset/thumbnail seed pada galeri Drive ke artwork versi baru.

All endpoints JSON except upload multipart/image binary. Errors follow:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Template memiliki slot di luar area frame"
  }
}
```

Status codes: 200 GET/update, 201 create, 204 delete, 400 bad input, 401 auth required, 403 forbidden origin, 404 unknown resource, 409 concurrent edit, 413 file too large, 415 unsupported type, 429 too many, 503 Drive unavailable/quota. Never include OAuth tokens/internal stack traces in error response.

## Public

### `GET /api/settings`

Mengembalikan hanya `{ "scanSeconds": 15 }`, `Cache-Control: no-store`. Dibaca lagi saat frame dipilih. Default 15 jika JSON konfigurasi belum ada; kegagalan baca/konfigurasi tidak valid menghasilkan error, bukan default diam-diam. Tidak mengekspos file ID atau metadata admin.

### `GET /api/admin/settings` dan `PUT /api/admin/settings`

Keduanya memerlukan signed admin cookie. GET mengembalikan `{ "settings": { "schemaVersion": 1, "revision": 0, "scanSeconds": 15 } }`. PUT memerlukan origin valid, JSON dibatasi 64 KiB, throttle dan body strict `{ "expectedRevision": 0, "scanSeconds": 15 }`; durasi integer 5–300. Mengembalikan settings dengan revision naik satu; revisi basi 409. Tersimpan sebagai `kiosk-settings.json` privat dalam folder frames, mock di memori. Serialisasi write hanya dalam satu proses; tidak menjanjikan CAS lintas instance. Tidak ada endpoint public write.

### `GET /api/frames`

Return only `status=published` frames. Example:

```json
{
  "frames": [
    {
      "id": "demo-pink-01",
      "name": "Pink Mood",
      "category": "pastel",
      "revision": 1,
      "dimensions": { "width": 1200, "height": 3600 },
      "slots": [
        {
          "id": "a",
          "order": 0,
          "x": 0.09,
          "y": 0.07,
          "width": 0.82,
          "height": 0.195
        }
      ],
      "thumbnailUrl": "/api/frames/demo-pink-01/asset/thumbnail?v=1",
      "overlayUrl": "/api/frames/demo-pink-01/asset/overlay?v=1"
    }
  ]
}
```

No Google file credentials or unpublished config. Extra slots omitted from shortened illustrative response.

### `GET /api/frames/:id`

Single published template JSON with public fields; 404 for unpublished/draft.

### `GET /api/frames/:id/asset/:kind?v=<version>`

Kinds `overlay|thumbnail`, only allow known frame association & requested retained version with published frame, or admin auth for draft; return binary with safe MIME, `Content-Disposition:inline`, caching. Never accept arbitrary fileId from query.

### `POST /api/boomerang`

Guest route dengan origin check, throttle 10/menit/IP dan batas dua pekerjaan encoder/validator per proses. Multipart `frames` berulang (1–6 JPEG yang sudah diedit, masing-masing 1080 × 1920 px, maksimal 2 MiB) dan `processingConsent=true`. Body dibatasi 12 MiB + 64 KiB. Menghasilkan binary `video/mp4`, `Cache-Control: no-store`, bukan link Drive. FFmpeg membuat enam detik H.264/yuv420p, 30 fps, tanpa audio, urutan `1 → 2 → 3 → 1 → 2 → 3`, satu detik per foto. File sementara server dibersihkan pada sukses/gagal; tidak ada upload Drive pada endpoint ini. Nama endpoint lama dipertahankan untuk kompatibilitas.

### `POST /api/photos`

Revisi boomerang menggantikan kontrak satu foto: multipart tepat satu `photo` PNG/JPG final (maksimal 12 MiB), tepat satu `video` MP4 (maksimal 16 MiB), dan `consent=true`. Optional `templateId` hanya metadata input, bukan path/Drive ID tujuan. Server memvalidasi signature, ukuran dan decode gambar serta codec/dimensi/durasi/full decode video. Body maksimal 28 MiB + 64 KiB; gunakan batas reverse proxy 32 MiB. Guest route tetap memeriksa origin dan throttle. On real Drive success:

```json
{
  "mode": "google-drive",
  "folderId": "ACTUAL_SESSION_FOLDER_ID",
  "folderName": "Hoya-Hoya-2026-11-18-random-uuid",
  "viewUrl": "https://drive.google.com/drive/folders/ACTUAL_SESSION_FOLDER_ID",
  "photoDataUrl": "data:image/png;base64,FINAL_PRINT_PNG_BASE64",
  "videoDataUrl": "data:video/mp4;base64,FINAL_QR_MP4_BASE64",
  "files": [
    {
      "fileId": "ACTUAL_PNG_ID",
      "filename": "kolase.png",
      "mimeType": "image/png"
    },
    {
      "fileId": "ACTUAL_MP4_ID",
      "filename": "boomerang.mp4",
      "mimeType": "video/mp4"
    }
  ]
}
```

`viewUrl` adalah URL kanonis folder yang ID-nya benar-benar diberikan Drive; `webViewLink` sesudah sharing wajib cocok dengan ID folder tersebut. Sebelum upload, server menyatukan area QR dengan warna/sisi footer frame. Optional multipart `printLayout` adalah tepat satu JSON string maksimal 1024 karakter: `{ "dimensions": { "width": 1200, "height": 2826 }, "photoBottom": 2509, "starterStyle": "gingham" }`. Dimensi harus cocok dengan gambar; batas bawah foto integer 0–height. Optional `starterStyle` hanya enum `gingham | film | mint`; bila ada, seluruh area di bawah slot dibangun ulang sesuai tema badan frame, termasuk mengganti panel hijau pada overlay lama. Snapshot hanya menentukan layout/artwork cetak, bukan path/ID penyimpanan. Jika pita footer tidak cocok atau snapshot absen, QR ditambahkan memakai kelanjutan tepi bawah. Foto tidak ditimpa/digeser; ujung bawah footer yang diperpanjang dipindahkan ke bawah QR. QR selalu memiliki quiet zone kontras. Output selalu PNG `kolase.png`, termasuk input JPEG. Ukuran/dimensi PNG final divalidasi kembali (12 MiB, 30 MP, sisi maksimal 8000 px). `photoDataUrl` berisi **byte PNG yang sama** dengan file Drive agar preview/download/cetak identik; bukan URL Drive palsu. Setelah folder dibuat, server juga memasang QR folder yang sama pada seluruh MP4. `videoDataUrl` mengandung byte MP4 final yang sama dengan file Drive, bukan video sebelum stamping. Payload JSON gabungan maksimal sekitar 38 MiB base64 (PNG 12 MiB + MP4 16 MiB); jangan log/cache body respons.

UI guest tidak lagi mempunyai checkbox konfirmasi. `processingConsent=true` dan `consent=true` tetap dikirim untuk kompatibilitas kontrak saat pengguna membuka kamera dan memulai sesi otomatis. Flag ini bukan catatan persetujuan legal atau bukti checkbox. Informasi pemrosesan, folder publik dan retensi tersedia di Privasi footer; izin perangkat ditangani browser.

Dua file diunggah ke folder sesi privat terlebih dahulu; folder baru dibagikan setelah keduanya lengkap, lalu ACL folder dan kedua anak diverifikasi. Folder utama photos/frames tidak dibagikan. Kegagalan footer/upload/sharing membersihkan folder dan file yang diketahui secara best-effort, tanpa QR atau PNG berisi link gagal. UI memulai sesi melalui Buka kamera dan countdown, tanpa checkbox tambahan.

Mock tetap memvalidasi media nyata dan mengembalikan `{mode:'mock', filename, videoFilename, message}` tanpa folder/link palsu dan tanpa menahan foto/video di adapter mock. Preview/download MP4 tetap berfungsi. Foto/frame/QR tidak mendapat history atau database.

## Admin authentication

### `POST /api/admin/login`

JSON `{password:string}`; validate hash, set HttpOnly signed session cookie; no token in JSON. Generic failure (avoid username enumeration). Origin check + best-effort attempt rate limiting. 200 `{ok:true}`.

### `POST /api/admin/logout`

Invalidate cookie (MaxAge 0), 200 `{ok:true}`. `POST` only, origin check.

### `GET /api/admin/session`

200 `{authenticated:boolean}`; no sensitive session contents.

## Admin frames

All admin calls verify session server-side. Mutating calls require same-site `Origin` validation and Content-Type checks. Use `multipart/form-data` for files and JSON config.

### `GET /api/admin/frames`

Returns all published & draft/archived frames with metadata and edit link.

### `POST /api/admin/frames`

Create new draft, upload overlay optional or separate submit as multipart, generate thumbnail and JSON. Validate metadata & mime signature; initial revision=1. 201 `{frame:{...}}`.

### `GET /api/admin/frames/:id`

Get full admin metadata; includes draft state and asset URLs accessible with auth.

### `PATCH /api/admin/frames/:id`

Patch metadata/slots, optionally new overlay (multipart). Require `expectedRevision`; on mismatch 409. Increment revision after successful save. Keep old overlay version.

### `POST /api/admin/frames/:id/publish`

Requires valid, complete slots & alpha overlay; switches status published; revision++, invalidate frame cache.

### `POST /api/admin/frames/:id/unpublish`

Switches status draft/archived; note existing session overlay assets may remain accessible temporarily, and Drive final photos are unrelated.

### `DELETE /api/admin/frames/:id`

Confirm deletion in frontend; safe archive / soft delete preferred. Do not delete current overlays prematurely, preserving users already in session. Permanent delete can be optional advanced operation.

## Data constraints and idempotency

- Never return photo bytes from Drive through arbitrary URL proxy: user QR should open Drive link directly.
- Admin `expectedRevision` is best-effort concurrency guard, not atomic compare-and-swap under concurrent Drive update.
- Client prevents concurrent duplicate photo uploads. Without durable session DB, exact-once guarantee across network retries/redeploy is not achievable; document possible duplicates and make filenames random.
- CSP and CORS restrictive; sanitize user-provided strings and accepted file data.

## Preview hasil frame

GET asset `thumbnail` versi aktif merender ilustrasi dummy dan footer hasil lengkap menggunakan renderer PNG final. Ukuran footer tetap: QR box 40% lebar + padding tema, tanpa tergantung panjang URL. Placeholder ?AREA QR? tidak memuat QR/link palsu. Proxy mempertahankan pemeriksaan publikasi/admin dan versi; JSON frame/slot tidak diubah.

`POST /api/admin/preview` memakai cookie admin, origin check dan throttle 30/menit. Multipart `metadata` JSON draft (maksimal 60.000 karakter) dan PNG `overlay` wajib; batas body overlay 8 MiB + 64 KiB, signature/alpha/dimensi divalidasi. Output PNG `no-store`, tanpa menyimpan file atau draft. Dipakai untuk preview perubahan yang belum disimpan.
