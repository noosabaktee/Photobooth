# 07 — Visual direction, screens, interactions

## 1. Moodboard dari gambar user

Lihat file di `../references/` (copyright/privasi milik pemilik sumber; hanya inspirasi):

1. `reference-01-web-photobooth.png` — photobooth homepage teal/mint: hero besar, card lembut, preview kamera tengah, film strips vertikal miring, tombol capture prominent, pastel chips.
2. `reference-02-event-strips.png` — desain output event dengan dua strip berdampingan, header logo/dekorasi, tiga frame bersusun per strip, background pink floral, blue curtain.
3. `reference-03-gingham-birthday.png` — hasil foto grid scrapbook birthday: gingham pink, mini sticker, handwritten party notes, ornamen playful.

Paket ini menyediakan contoh frame orisinal siap-demo di `../examples/starter-frames/`: Pink Gingham (3), Vintage Film (3), dan Mint Party (3), dengan PNG area transparan, preview JPG dan manifest JSON. Codex sebaiknya menggunakannya untuk gallery demo dan uji renderer. Jangan gunakan brand, wajah, foto, atau dekorasi persis dari gambar untuk UI production. Art assets harus orisinal / generatif CSS/SVG.

## 2. Style tokens awal

| Token | Warna     | Pemakaian                        |
| ----- | --------- | -------------------------------- |
| Teal  | `#007D72` | CTA primary, dark header accents |
| Mint  | `#DDF6E7` | Page backgrounds / gradients     |
| Cream | `#FFF9F0` | Surfaces                         |
| Blush | `#F8DCE6` | Cards, strip themes              |
| Berry | `#9C4E6B` | Secondary accent                 |
| Ink   | `#1D3435` | Main text                        |

Fonts: gunakan font web yang bebas digunakan dan fallbacks, mis. `DM Sans` / `Plus Jakarta Sans`, display optional `Fraunces` untuk headings. Pastikan font loading tidak menghambat rendering. Gunakan border rounded 16–28px, shadow lembut, whitespace luas; warna kontras agar teks tetap accessible.

## 3. Landing page (`/`)

- Header kecil: logo original photobooth + `How it works`, `Frames`, `Admin` link discreet.
- Hero: heading compelling "Make moments, keep memories" / "Abadikan momenmu!". Deskripsi singkat lalu CTA `Mulai Foto`.
- Decorative strips di sisi hero, memakai dummy portrait illustration/abstract placeholders saja (bukan reference photos), subtle hover parallax.
- Section **How it works** tiga langkah: Pilih frame → Jepret → Scan QR.
- Carousel/gallery **Frame Collections**, kategori filter, seluruh kartu/gambar dapat diklik untuk memilih, dengan fokus keyboard native.
- Info privacy, Google Drive logo optional jika penggunaan brand sesuai pedoman; lebih aman tulis teks saja.
- Footer brand dan credit, tidak wajib legal yang tidak nyata.

## 4. Booth (`/booth`)

UI step header dengan indikator `1 Frame | 2 Capture | 3 Preview | 4 QR`.

**Frame step:** grid cards portrait/strip thumbnail 3 columns desktop, 2 mobile. Preview overlay on dummy photos, badge jumlah foto, kategori, button Select.

**Capture step:** large live camera 4:3 atau portrait preview; countdown circle overlay; shot progress; primary Shutter; secondary Switch camera, Stop, Mirror. Auto capture sesuai template slots. Perfoto thumbnail strip progress.

**Review step:** preview strip di kiri, foto thumbnail/retake control dan filter di kanan (stack pada mobile), CTA Save/Upload, local download available. Preview dan export harus identik secara crop/overlay.

**Upload step:** spinner/progress real, don't prematurely present QR, retry with local file kept.

**Result step:** image strip preview, QR 192–256px high contrast, short instruction "Scan pakai kamera HP", Copy Link, Open in Drive, Download Local, New Session. State nullified on refresh.

## 5. Admin screens

Minimal dashboard profesional, beda tone guest tapi tetap satu brand:

- Topbar `Admin Frames` + logout + storage mode indicator.
- Quick stats (jumlah frame published/draft) dihitung dari Drive listing, bukan data DB.
- Gallery/table with thumbnail, name, slots, status, updated, actions.
- Editor dengan **2 kolom**: canvas kiri (slot drag-and-drop) dan field kanan (template properties, slots list, action save/publish).
- Alert per-file upload, invalid dimensions, nontransparent slot, out of bounds overlap. Save draft while incomplete; publish locked until valid.
- Delete modal warns sessions in-progress and old asset version retention.

## 6. UI microcopy (Bahasa Indonesia)

- `Izinkan akses kamera untuk mulai foto. Jika ditolak, aktifkan izin melalui pengaturan browser lalu coba lagi.`
- `Siap? Foto 1 dari 4 dalam 3…2…1!`
- `Kurang cocok? Ulangi foto nomor 2 saja.`
- `Simpan ke Drive & buat QR` (explicit action, separate from local download).
- `Hasilmu sudah siap! Scan kode ini dengan HP.`
- `Jangan tutup halaman sebelum scan. QR akan hilang kalau halaman ditutup; file yang sudah tersimpan tetap ada di Drive.`
- `Upload gagal. Hasil foto masih ada di perangkat ini selama halaman terbuka. Download lokal atau coba lagi.`

## 7. Accessibility and responsiveness

- Mobile 360px and 390px, desktop >= 1280px, tablet ~768px.
- Buttons >= 44px tap target, meaningful focus rings, labels and error messages linked to inputs.
- Support keyboard editor slot nudge, reduced motion, no flashing without control.
- Loading placeholders prevent layout shift, no hidden CTA offscreen.
- Test permissions on Android Chrome and iOS Safari (device testing manual); feature-detect cameras and provide permission guidance/retry. Semua foto hanya melalui kamera.
