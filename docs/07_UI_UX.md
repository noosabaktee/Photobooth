# 07 — Visual direction, screens, interactions

Kamera live dan jepretan juga landscape: permintaan kamera ideal 1920 x 1080 (16:9), viewport dan area foto video mengikuti rasio slot foto pada template aktif. Stream perangkat yang berbeda dipotong cover di tengah tanpa stretching, sama dengan preview; kolase PNG memakai crop slot portrait. Deploy ulang dan refresh tab booth untuk menerapkan perubahan capture.

Video MP4 sesi baru memakai **landscape 1440 × 1080 (4:3)**, area foto mengikuti rasio slot template aktif (bukan rasio ultrawide tetap), tema sesuai frame dan QR folder di footer bawah tanpa menutupi pose; bagian atas hanya menampilkan foto landscape. Kolase PNG tetap portrait mengikuti slot template. Durasi video tetap enam detik/30 fps, urutan 1-2-3-1-2-3; preview/download identik dengan file Drive. File sesi lama di Drive tidak diubah.

## Alur aktif event - 24 November 2026

Peserta membuka `/` atau `/booth` dan langsung masuk layar ambil foto tanpa landing, galeri pilihan frame atau navbar atas. Booth mengambil template aktif dan durasi scan dari `GET /api/settings`, memuat snapshot overlay, lalu menunggu peserta menekan **Buka kamera** pada kunjungan pertama. Kamera hanya otomatis terbuka pada reload lanjutan setelah hasil sesi selesai (timer QR atau Foto lagi). Refresh biasa kembali menunggu Buka kamera. Izin kamera browser tetap diperlukan; Buka kamera tersedia sebagai retry jika perangkat/izin gagal. Peserta menekan **Mulai countdown**. Setelah foto terakhir, PNG + MP4 disimpan otomatis dan QR tampil. Sesudah timer admin habis (default 15 detik), media dibersihkan dan **halaman dimuat ulang**, kamera terbuka untuk peserta berikutnya. Browser tidak dapat mendeteksi apakah QR telah dipindai; pergantian peserta mengikuti timer atau tombol Foto lagi.

Admin tetap menyimpan banyak template dan memilih **Template aktif booth** pada Pengaturan antrean booth, lalu **Simpan pengaturan**. Hanya template published boleh dipilih. `activeFrameId` disimpan bersama durasi dalam JSON privat Drive; tanpa database. Konfigurasi lama/null memakai template published pertama sebagai fallback eksplisit. Template aktif yang di-unpublish/arsip tidak diganti diam-diam: booth meminta operator memilih pengganti. Perubahan berlaku pada halaman/sesi berikutnya, tidak mengganti snapshot sesi yang sedang berlangsung. URL `?frame=...` dari peserta tidak memilih template.

Spesifikasi alur di bagian ini menggantikan ketentuan landing/pilih frame/reset ke galeri pada bagian lama di bawah. Preview/loading/error/final, QR PNG/MP4, privasi memori, dan auth admin tetap mengikuti ketentuan lain.

Preview selama encode/upload, ketika upload gagal, serta hasil demo memakai desain cetak lengkap dengan penanda AREA QR non-scannable. Panel hijau lama pada seed diganti sebelum preview ditampilkan. Komposisi mentah untuk request/retry disimpan terpisah dalam memori; hasil Drive menggantikan preview dengan PNG final ber-QR setelah penyimpanan berhasil. Tidak ada request tambahan hanya untuk preview.

Preview pilih frame, kartu admin dan preview builder kini menampilkan proporsi/desain hasil lengkap, termasuk penanda non-scannable AREA QR. Tidak ada link/QR palsu sebelum folder sesi tersedia. PNG hasil, video MP4 dan QR layar memakai URL folder yang sama; MP4 mengikuti tema frame dan QR tampil sepanjang enam detik. Preview/download MP4 menggunakan byte final yang sama dengan Drive. Tema custom tanpa identitas seed memakai kartu video mint sebagai default.

Seluruh bagian bawah hasil cetak mengikuti tema badan frame: Vintage hitam dengan perforasi film, Gingham kotak-kotak pink dan Mint mint. Tidak ada panel hijau bersama atau kartu QR terpisah. Artwork diteruskan di belakang QR; modul putih pada Vintage dan hitam pada tema terang. Margin kosong QR tetap empat modul, dengan pola pastel berkontras rendah pada Gingham. Uji scan HP/printer sebelum acara. Renderer juga mengganti panel hijau pada hasil sesi baru yang memakai overlay seed lama; PNG hasil lama di Drive tidak diubah. Jalankan `npm run drive:seed` sekali setelah deploy untuk upgrade aset/thumbnail seed pada galeri Drive ke artwork versi baru.

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

UI step header dengan indikator `1 Pilih frame | 2 Ambil foto | 3 Simpan otomatis | 4 Scan QR`.

**Frame step:** grid cards portrait/strip thumbnail 3 columns desktop, 2 mobile. Preview overlay on dummy photos, badge jumlah foto, kategori, button Select.

**Capture step:** large live camera 4:3 atau portrait preview; countdown angka sederhana; shot progress; primary Shutter; secondary Switch camera, Stop, Mirror. Auto capture sesuai template slots. Perfoto thumbnail strip progress.

**Mulai langsung:** Buka kamera aktif setelah frame siap, tanpa checkbox konfirmasi. Browser tetap meminta izin kamera. Informasi pemrosesan sementara, upload otomatis, folder publik dan persistensi Drive tersedia melalui Privasi di footer.

**Upload step:** langsung sesudah foto terakhir tanpa review/pilihan nuansa. Semua foto natural. Spinner/status nyata, jangan tampilkan QR sebelum PNG + MP4 lengkap dan sharing terverifikasi. Jika gagal, simpan media lokal dan beri retry/download; timer tidak berjalan.

**Result step:** preview PNG identik dengan file Drive, QR 192–256px kontras, instruksi scan dan penghitung waktu. Area QR cetak menyatu dengan warna/sisi footer frame: tema badan frame diteruskan tanpa menutup/menggeser foto. Area tenang QR tetap polos kontras. Sesudah QR dimuat, timer default 15 detik → bersihkan sesi → pilih frame. Admin mengatur 5–300 detik untuk sesi baru. Link/PNG/MP4 dan Foto lagi tersedia; state tetap hilang saat refresh. File Drive tidak dihapus oleh reset.

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
- `Siap? Foto 1 dari 3 dalam 3…2…1!`
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

## 8. Pengalaman self-service Hoya-Hoya Days

- Halaman publik tetap satu layar `100dvh`, dengan kartu frame yang dapat diketuk langsung dan satu tindakan utama pada tiap tahap. Petunjuk menjelaskan izin kamera, berpose, retake, simpan dan scan QR dalam bahasa Indonesia.
- Hero memakai strip ilustrasi yang melayang pelan, ornamen berputar, dan sorotan lembut pada tombol mulai. Kartu frame merespons hover/fokus; perpindahan tahap memakai transisi singkat.
- Countdown hanya menampilkan angka 3–2–1 berukuran responsif 40–64px, tanpa lingkaran, teks pose atau tint yang menutupi kamera. Setelah angka hilang, tunggu 500 ms sebelum dijepret; jeda juga berlaku pada retake dan reduced motion. Posisi jepretan tetap di toolbar/thumbnail. Thumbnail yang selesai memiliki tanda centang. Animasi tidak mengubah pixel hasil PNG/MP4.
- Setelah hasil selesai, konfeti dekoratif muncul sekali. Tombol **Foto lagi** membuka konfirmasi **Sudah menyimpan hasilmu?**; **Kembali ke hasil** mempertahankan sesi hingga timer habis, **Ya, mulai sesi baru** mempercepat reset. Timer tetap berjalan saat dialog terbuka atau tab tersembunyi, berdasarkan deadline waktu absolut. File Drive tetap tersimpan.
- Footer menyediakan **Cara pakai** dalam dialog dengan tiga langkah serta kontrol animasi. Dialog bisa ditutup dengan Escape dan mengembalikan fokus ke pemicu. Kontrol animasi disimpan di memori halaman saja; `prefers-reduced-motion` selalu dihormati, termasuk perubahan pengaturan ketika halaman terbuka.
- Animasi non-esensial bisa dimatikan tanpa menghambat kamera, editing, download atau QR. Tidak ada suara otomatis, kedipan flash atau dependensi animasi tambahan. Dialog bantuan/privasi dapat menggulir di layar pendek; halaman utama tetap tidak bergulir.
