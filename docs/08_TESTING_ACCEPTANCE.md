# 08 — Test plan and acceptance checklist

Preview pilih frame, kartu admin dan preview builder kini menampilkan proporsi/desain hasil lengkap, termasuk penanda non-scannable AREA QR. Tidak ada link/QR palsu sebelum folder sesi tersedia. PNG hasil, video MP4 dan QR layar memakai URL folder yang sama; MP4 mengikuti tema frame dan QR tampil sepanjang enam detik. Preview/download MP4 menggunakan byte final yang sama dengan Drive. Tema custom tanpa identitas seed memakai kartu video mint sebagai default.

Pengujian video meliputi MP4 H.264 1080 × 1920/30 fps/enam detik tanpa audio, urutan pose `1 → 2 → 3 → 1 → 2 → 3` (satu detik per foto) dari pixel seluruh 180 frame decode, validasi stream rusak/berlebih, cleanup temp, consent pemrosesan, preview/download dan upload PNG + MP4. QR terbaru menunjuk folder sesi yang terverifikasi; kegagalan upload kedua atau ACL anak membatalkan seluruh hasil. Lihat [13_BOOMERANG.md](13_BOOMERANG.md).

Regresi preview proses: Chromium menyuntikkan overlay signature hijau lama pada ketiga seed, menahan respons upload lalu membandingkan ukuran dan pixel latar dengan renderer cetak server. Seluruh area bawah foto diperiksa bebas panel hijau dan tidak mengandung QR palsu. Gagal upload/retry/demo mempertahankan preview; retry mengirim komposisi mentah identik, bukan PNG yang sudah ditambah footer.

## 1. Required test scripts

- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit` strict.
- `npm test` — Vitest unit/integration.
- `npm run test:e2e` — Playwright E2E (if installed).
- `npm run build` — Next.js production build.
- `npm run dev` — local smoke.

## 2. Automated unit tests

| ID    | Scenario                                        | Expected                |
| ----- | ----------------------------------------------- | ----------------------- |
| UT-01 | valid 4-slot config                             | accepted                |
| UT-02 | x+width>1                                       | rejects                 |
| UT-03 | duplicated order / id                           | rejects                 |
| UT-04 | slot overlapping                                | rejects/warn per policy |
| UT-05 | 7 slots                                         | rejects                 |
| UT-06 | unsupported overlay mime                        | rejects                 |
| UT-07 | aspect `cover` portrait → wide slot             | correct crop math       |
| UT-08 | selfie mirror on/off                            | correct orientation     |
| UT-09 | capture N=3 then retake index 1                 | other slots unchanged   |
| UT-10 | QR validation accepts real drive.google.com URL | accepted                |
| UT-11 | QR validation rejects javascript:/evil host     | rejects                 |
| UT-12 | session signature expired/tampered              | rejects                 |
| UT-13 | edit frame revision mismatch                    | returns 409             |
| UT-14 | type/magic bytes mismatch                       | returns 415/400         |
| UT-15 | max upload size exceeded                        | returns 413             |

## 3. Integration tests (mock adapter)

| ID    | Scenario                           | Expected                                          |
| ----- | ---------------------------------- | ------------------------------------------------- |
| IT-01 | create frame as admin              | persists to mock adapter and lists as draft       |
| IT-02 | draft frame on public endpoint     | not shown                                         |
| IT-03 | publish valid frame                | public list contains it                           |
| IT-04 | unpublish                          | removed from public list                          |
| IT-05 | unauthenticated PATCH/DELETE       | 401                                               |
| IT-06 | forged origin with valid session   | 403                                               |
| IT-07 | upload final image mock            | returns explicit `mode:mock`, no fake Google link |
| IT-08 | Drive permission create fails      | result is failure, no QR                          |
| IT-09 | Drive list fails                   | user-friendly retry response                      |
| IT-10 | overlay URL for arbitrary file ID  | rejected                                          |
| IT-11 | overlay edit preserves old version | existing render URL valid                         |
| IT-12 | admin logout                       | mutating route denied                             |

## 4. End-to-end UI scenarios

**E2E-01 Guest:** landing → frame tiga slot → Buka kamera langsung aktif tanpa checkbox → synthetic camera → 3 captures → kolase natural + MP4 → satu upload otomatis → hasil mock tanpa QR palsu. Unduh PNG/MP4, cek warna natural/mirror, durasi MP4 enam detik dan refresh menghapus sesi. Panel nuansa/review/retake tidak tampil.

**E2E-02 Admin:** login → ubah durasi scan 15 ke 25 → refresh membuktikan persistensi → kembalikan ke 15 → tambah PNG tiga slot → preview/draft/publish → edit/unpublish/archive/logout. Tes route melindungi settings read/write, origin, batas dan konflik revisi.

**E2E-03 Negative:** camera denied → panduan izin dan retry kamera, tanpa picker foto galeri; invalid overlay → publish blocked; upload fail → no QR + preserved local export; refresh result → no persisted session/QR.

**E2E-04 Self-service:** bantuan **Cara pakai** dapat dibuka via keyboard dan ditutup Escape dengan fokus kembali; kontrol animasi mematikan efek, lalu perubahan preferensi reduced motion perangkat langsung dihormati. Countdown hanya menampilkan angka dan tetap memberi jeda 500 ms sebelum capture. Konfirmasi **Foto lagi** yang dibatalkan menjaga URL hasil; konfirmasi sesi baru membersihkan preview/QR. Sembilan viewport 320×568 hingga 1920×1080 memeriksa halaman dan kontrol tetap muat tanpa scroll; fixture QR memakai respons test-only tanpa upload Drive riil.

**E2E-05 QR cetak/timer:** unduh PNG final fixture dan decode QR menjadi URL folder yang sama; QR layar memulai timer 15 detik, setelah habis galeri tampil dan Buka kamera pada sesi baru langsung aktif tanpa checkbox. Pengukuran jeda memakai kamera sintetis dengan timer nyata. Upload gagal + simulasi 16 detik tidak boleh reset; retry memakai cache MP4. Unit test ketiga seed memeriksa tema badan frame sampai ke area QR, tidak ada panel hijau, pixel foto tidak berubah, serta QR dapat didecode. Uji memakai overlay seed baru dan simulasi overlay hijau lama. E2E Vintage mengunduh PNG, memeriksa pixel background hitam dan decode folder QR. Fallback frame tanpa footer mempertahankan semua pixel asli dan mengikuti warna tepi. Snapshot layout salah/rusak ditolak. Byte PNG Drive/preview identik. Tambahkan smoke cetak fisik operator dan scan HP sebelum event; otomatis tidak mengklaim hasil printer nyata.

## 5. Manual real Google Drive smoke

After operator has configured OAuth:

- [ ] OAuth refresh flow authorized; no token in browser/network response.
- [ ] `drive:bootstrap` creates folders without duplication.
- [ ] Admin publish frame → JSON+PNG+thumbnail actual files exist in Drive.
- [ ] Frame preview uses private asset proxy, not anyone sharing of entire frames folder.
- [ ] Folder sesi berisi tepat kolase PNG yang cocok preview dan boomerang MP4; tidak ada foto mentah.
- [ ] Hanya folder sesi mendapat `anyone:reader`; kedua file mewarisi akses. Root/frames/photos induk tetap privat.
- [ ] Link/QR opens on a different device without login (incognito).
- [ ] Copy link / open link / download local controls work.
- [ ] Closing/reloading page loses QR but file still exists in Drive.
- [ ] Capacity/permission error yields clear recoverable UI and no bogus QR.

## 6. UX checks

- [ ] Desktop Chrome + Firefox, mobile viewport, actual iOS Safari and Android Chrome when available.
- [ ] No camera access without action; permission denial handled.
- [ ] Focus ring, keyboard navigation and accessible labels.
- [ ] No console errors, unhandled promise rejections or leaking secrets.
- [ ] Mobile layout not horizontally clipped, buttons reachable.
- [ ] Filter/edit preview equals export; photo slot order consistent.
- [ ] Admin editing slot drag and numeric controls usable.
- [ ] After user photo render, CameraStream tracks stopped when no longer needed.

## 7. Reporting expectations

Codex must create `docs/IMPLEMENTATION_STATUS.md` as implementation proceeds and include:

```markdown
## Implemented

- ...

## Tests executed

- npm run lint — PASS/FAIL and reason
- npm run typecheck — ...
- npm test — ...
- npm run build — ...

## Manual tests pending

- Google Drive real credentials not provided; incognito link check pending

## Known limitations

- ...
```

Never claim `live Drive smoke passed` without actual configuration and observed output.
