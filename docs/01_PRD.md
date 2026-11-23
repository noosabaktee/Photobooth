# 01 — Product Requirements Document (PRD)

**Revisi aktif Hoya-Hoya Days / Kalbe Morinaga Indonesia:** tiga foto kamera, kiosk responsive tanpa scroll, kolase PNG dan video MP4 enam detik. QR membuka folder hasil sesi dengan kedua file, bukan satu file PNG. [13_BOOMERANG.md](13_BOOMERANG.md) dan [API contract](04_API_CONTRACT.md) terbaru menggantikan bagian spesifikasi awal yang menyebut satu foto final saja.

**Antrean event 23 November 2026:** Buka kamera langsung aktif tanpa checkbox; informasi proses/penyimpanan publik tersedia di footer dan izin kamera browser tetap berlaku. Foto natural tanpa panel review/nuansa, simpan otomatis sesudah foto terakhir. Area QR cetak melanjutkan desain footer frame, tanpa menutup/menggeser foto. Setelah QR tampil, durasi default 15 detik → bersihkan browser → pilih frame. Admin mengatur durasi 5–300 detik melalui JSON privat di Drive; file hasil Drive tetap ada. Ini menggantikan ketentuan retake/edit/upload manual pada uraian MVP awal di bawah. Kegagalan upload menjaga media dan tidak menjalankan timer reset.

## 1. Overview

**Nama sementara:** PHOTOBOOTH / SnapStrip (brand bisa diganti).  
**Produk:** Website photobooth digital responsive untuk personal, teman, pasangan, pesta, dan event kecil.  
**Value proposition:** Ambil foto berurutan via browser, pilih frame yang dikurasi admin, hasilkan foto strip estetik, simpan otomatis di Google Drive, QR untuk membuka file dari HP. Tanpa akun pengguna dan tanpa database.

## 2. Persona

| Aktor    | Tujuan                               | Hak                                                                                                     |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Guest    | Foto cepat dan mengambil hasil di HP | Melihat frame aktif, capture, retake, filter, export, upload foto final, scan QR                        |
| Admin    | Mengelola koleksi frame sesuai acara | Login, upload overlay, atur slot, preview, simpan draft, publish, unpublish, mengganti, menghapus frame |
| Operator | Menjaga storage & kredensial         | Mengelola Google Cloud/OAuth, folder Drive, kapasitas dan retensi                                       |

## 3. User journey — Guest

1. Buka homepage, CTA `Start Photobooth`.
2. Klik langsung gambar/kartu template dari gallery active; filter tema (All, Pastel, Vintage, Party, Event) bila ada.
3. Klik `Buka kamera`, lalu izinkan akses kamera. Semua foto berasal dari kamera; jika gagal, perbaiki izin/sambungan lalu coba lagi.
4. Countdown 3-2-1, ambil N foto sesuai slot (`count = slots.length`); jeda singkat yang masuk akal antar foto; progress terlihat. Boleh abort / restart.
5. Review: ganti foto 1 tertentu atau ambil ulang semua; filter bawaan; frame locked.
6. Preview hasil mengikuti layout frame dengan akurat; pilih download lokal atau consent + `Save to Google Drive`.
7. Setelah upload **berhasil & link view publik valid**, tampil QR dan `Copy link`, `Open in Drive`, `Download locally`. Tidak ada akun/riwayat.
8. Tutup/reload halaman: local photos, QR & URL sesi tidak dipersist. Foto final di Drive tetap ada.

## 4. User journey — Admin

1. Buka `/admin/login`, login operator menggunakan kata sandi aman.
2. Lihat cards status frame: Published/Draft, jumlah slot, thumbnail, updated date.
3. Upload PNG transparan baru atau mengganti frame lama; tentukan nama, kategori, tag, ukuran asli.
4. Kelola 1–6 kotak slot pada preview: tambah, drag, resize, urutan capture, aturan crop/roundness.
5. Sistem memvalidasi: koordinat 0..1, ukuran >0, order unik, slot tidak overlap kecuali diizinkan secara eksplisit, setidaknya satu slot transparan.
6. `Save Draft`, `Preview` dengan contoh foto dummy, `Publish` (aktif user tanpa redeploy, setelah TTL).
7. `Unpublish` atau `Delete` dengan peringatan dampak pengguna; frame snapshots yang dipakai user di sesi berlangsung tetap harus aman.

## 5. Fitur P0 (harus ada)

| ID    | Fitur               | Acceptance                                                                             |
| ----- | ------------------- | -------------------------------------------------------------------------------------- |
| P0-01 | Landing & gallery   | Estetik dan responsive; hanya published ditampilkan dalam Drive mode                   |
| P0-02 | Browser camera      | Meminta consent dengan CTA; menangani permission denied dan insecure context           |
| P0-03 | Capture sequenced   | Pengambilan sesuai jumlah slot, countdown default 3s, progress                         |
| P0-04 | Review/retake       | Retake individual & all tanpa kehilangan hasil lain                                    |
| P0-05 | Composite renderer  | Ratio benar, crop cover, overlay, hasil PNG >= 1200 px width (bila template mendukung) |
| P0-06 | Final upload        | Satu gambar final, Google Drive photo folder, batas MIME & size                        |
| P0-07 | QR ephemeral        | URL Drive nyata, QR hanya setelah sharing sukses, hilang saat refresh                  |
| P0-08 | Admin auth          | Signed HttpOnly session cookie, server protected routes, logout                        |
| P0-09 | Frame CRUD          | Add/edit/unpublish/delete, PNG overlay+preview+JSON ke Drive                           |
| P0-10 | Drag-resize builder | Admin dapat mengatur slot custom tanpa edit JSON manual                                |
| P0-11 | Permission/privacy  | Syarat upload publik via link disebut jelas; error ditampilkan                         |
| P0-12 | Mock/dev mode       | Menjalankan UI/tests tanpa credential Google dengan label demo                         |

## 6. Fitur P1 (bila P0 selesai)

- Filter foto lebih banyak (sepia, soft glow, grain yang tidak merusak kualitas).
- Warna frame variants yang telah diset admin.
- Admin duplicate template, reorder, bulk upload.
- Event mode: pengelompokan frame/foto ke folder per event dengan slug.
- Print CSS atau format 2x6 in/4x6 in export, selama ratio cocok.
- Sound option dan shutter animation yang bisa dimatikan.

## 7. Out of scope MVP

- Registrasi user, profil, galeri riwayat guest, dashboard analytics user.
- Database apa pun, pemrosesan AI/face recognition, moderasi otomatis gambar.
- Payment, paket premium, integrasi printer fisik, sosial network.
- Otomatis hapus foto pada close/reload. Tidak mungkin diasumsikan hanya dengan hilangnya QR.
- Jaminan link Drive rahasia/sekali pakai saat memakai anyone-with-link.

## 8. Non-functional requirements

- Desktop dan mobile. Navigasi keyboard, ARIA countdown announcements, kontras baik.
- HTTP secure production dan localhost dev untuk kamera.
- Tidak mengirim raw captures ke backend; simpan hanya dalam state memori sampai final upload.
- Admin API fail-closed; link share hanya per-file final output.
- Tampilkan skeleton/progress upload, retry/backoff yang dibatasi, tidak memalsukan loading.
- Rendering smooth pada device standar; batasi ukuran asset frame.
- Sensible logging (fileId boleh sebagian, tidak memuat foto ataupun refresh token).

## 9. Success criteria

- Guest dapat mencapai QR dalam alur tanpa daftar akun.
- Pilihan frame berbeda menghasilkan jumlah capture & layout yang benar.
- Admin bisa publish template sendiri dan user melihatnya tanpa redeploy.
- Link hasil bisa diakses di perangkat lain dalam jendela incognito.
- Semua langkah berkode berjalan di mock mode; integrasi riil punya instruksi pengujian manual.
