# Video MP4 dan folder hasil sesi

Kamera live dan jepretan juga landscape: permintaan kamera ideal 1920 x 1080 (16:9), viewport dan area foto video mengikuti rasio slot foto pada template aktif. Stream perangkat yang berbeda dipotong cover di tengah tanpa stretching, sama dengan preview; kolase PNG memakai crop slot portrait. Deploy ulang dan refresh tab booth untuk menerapkan perubahan capture.

## Alur aktif event - 24 November 2026

Peserta membuka `/` atau `/booth` dan langsung masuk layar ambil foto tanpa landing, galeri pilihan frame atau navbar atas. Booth mengambil template aktif dan durasi scan dari `GET /api/settings`, memuat snapshot overlay, lalu menunggu peserta menekan **Buka kamera** pada kunjungan pertama. Kamera hanya otomatis terbuka pada reload lanjutan setelah hasil sesi selesai (timer QR atau Foto lagi). Refresh biasa kembali menunggu Buka kamera. Izin kamera browser tetap diperlukan; Buka kamera tersedia sebagai retry jika perangkat/izin gagal. Peserta menekan **Mulai countdown**. Setelah foto terakhir, PNG + MP4 disimpan otomatis dan QR tampil. Sesudah timer admin habis (default 15 detik), media dibersihkan dan **halaman dimuat ulang**, kamera terbuka untuk peserta berikutnya. Browser tidak dapat mendeteksi apakah QR telah dipindai; pergantian peserta mengikuti timer atau tombol Foto lagi.

Admin tetap menyimpan banyak template dan memilih **Template aktif booth** pada Pengaturan antrean booth, lalu **Simpan pengaturan**. Hanya template published boleh dipilih. `activeFrameId` disimpan bersama durasi dalam JSON privat Drive; tanpa database. Konfigurasi lama/null memakai template published pertama sebagai fallback eksplisit. Template aktif yang di-unpublish/arsip tidak diganti diam-diam: booth meminta operator memilih pengganti. Perubahan berlaku pada halaman/sesi berikutnya, tidak mengganti snapshot sesi yang sedang berlangsung. URL `?frame=...` dari peserta tidak memilih template.

Spesifikasi alur di bagian ini menggantikan ketentuan landing/pilih frame/reset ke galeri pada bagian lama di bawah. Preview/loading/error/final, QR PNG/MP4, privasi memori, dan auth admin tetap mengikuti ketentuan lain.

Revisi terbaru: video mengikuti tema pilihan (Vintage hitam, Gingham pink, Mint mint) dan menyediakan footer QR di bawah area pose yang mengikuti rasio slot foto template; bagian atas hanya foto, nama event/perusahaan dan keterangan berada bersama QR di bawah. Server memasang QR folder riil setelah folder dibuat, sebelum MP4 diunggah dan sharing diverifikasi. QR tetap tampil sepanjang enam detik dan sama dengan PNG/layar. `videoDataUrl` mengembalikan MP4 final yang sama persis untuk preview/download; mode mock dan fallback sebelum upload tidak mempunyai QR folder. Respons PNG + MP4 dapat sekitar 38 MiB base64; tidak boleh dicatat atau di-cache. File sementara stamping dibersihkan pada sukses/gagal.

Revisi fitur ini menggantikan spesifikasi awal yang menyimpan satu PNG dengan QR per-file. Tidak ada database atau riwayat pengguna yang ditambahkan.

## Hasil dan alur

- Kolase PNG tetap mengikuti frame pilihan pada resolusi asli dan renderer preview yang sama.
- Video MP4 menampilkan satu pose bergantian pada kartu event landscape orisinal. Tiga foto memakai urutan `1 → 2 → 3 → 1 → 2 → 3`, satu detik per foto, total enam detik. Video berjalan maju dan mengulang tanpa efek boomerang. Tidak ada interpolasi gerak; hasil berupa pergantian foto, bukan rekaman kamera bergerak.
- Output video: 1440 × 1080 (4:3), H.264 high, yuv420p, 30 fps, tanpa audio, faststart. Bingkai video memakai nama event/perusahaan dan area foto cover dengan rasio slot template yang sebenarnya, dihitung dari koordinat slot dan dimensi PNG; overlay strip PNG tidak diregangkan menjadi video. Area foto video dipasang proporsional di tengah batas 1312 x 776; crop kamera/video mengikuti slot cetak, tanpa memaksa rasio 20:9. Artwork landscape dirancang tersendiri dengan detail tema kecil, matte tipis dan footer sejajar: event di kiri, QR di kanan. Browser dan stamping server memakai fungsi artwork yang sama.
- Alur antrean terbaru memakai warna natural; mirror dan crop mengikuti pengambilan kamera/frame. Panel review, retake dan pilihan filter dihilangkan dari guest. Layout custom 1–6 slot tetap didukung.
- Preview MP4 di hasil memakai kontrol play/pause dan loop; tidak autoplay. Buka kamera langsung aktif tanpa checkbox konfirmasi; informasi proses otomatis/folder publik tersedia di Privasi footer, izin kamera tetap melalui browser. Sesudah capture, encoder sementara memproses video otomatis. Area QR cetak menyatu dengan warna/sisi footer frame; tiga foto tetap utuh. Preview/download PNG final memerlukan proses simpan berhasil. PNG dasar tanpa QR tetap bisa diunduh jika gagal.
- Hasil PNG dan MP4 disimpan dalam folder publik per sesi. Sesudah foto terakhir, kedua file langsung diproses dan dikirim. Error mempertahankan salinan lokal serta menyediakan retry tanpa QR palsu; retry memakai MP4 yang sudah berhasil dibuat.
- QR pada PNG dan layar mengarah ke folder yang sama. Default 15 detik setelah QR tampil, browser kembali ke pilih frame dan membersihkan state. Durasi 5–300 detik dapat diatur admin melalui JSON privat; tidak mengubah durasi video enam detik atau menghapus hasil Drive.

```text
PHOTOBOOTH_ROOT/                  private
  frames/                        private, unchanged
  photos/                        private
    Hoya-Hoya-YYYY-MM-DD-uuid/    anyone-with-link reader
      kolase.png
      boomerang.mp4
```

Server membuat folder privat dan QR URL kanonis memakai ID folder dari Drive, menambahkan footer QR tanpa menimpa area kolase, lalu menunggu dua file lengkap sebelum sharing. `webViewLink` dan ACL folder/anak wajib diverifikasi sesuai ID sebelum response dikirim. PNG final yang sama dikembalikan sebagai `photoDataUrl` (JSON base64 maksimal sekitar 16 MiB). Workspace yang melarang folder publik menghasilkan error tanpa QR. Folder utama tidak dibagikan. Jangan menambahkan file sensitif lain ke folder sesi karena folder tersebut publik bagi pemilik link.

## Pemrosesan dan batas

`POST /api/boomerang` menerima 1–6 JPEG edit 1440 × 1080, masing-masing maksimal 2 MiB, serta `processingConsent=true`. Sharp memvalidasi dan menulis ulang JPEG tanpa metadata. FFmpeg membaca urutan dari nama file internal dalam direktori temp acak, tidak memakai shell atau URL input. Output dikembalikan sebagai MP4 `no-store` dan disimpan hanya sebagai Blob browser.

`POST /api/photos` menerima satu kolase PNG/JPEG maksimal 12 MiB, satu MP4 maksimal 16 MiB dan `consent=true`. FFprobe memeriksa codec, dimensi, fps, durasi, satu video stream tanpa audio; FFmpeg mendecode stream untuk mendeteksi kerusakan sebelum Drive upload. Tidak mempercayai MIME/ekstensi saja. Proxy menerima setidaknya 32 MiB; semua batas aplikasi tetap berlaku.

Kedua endpoint memeriksa Origin, throttle 10 request/menit/IP dan tanpa wildcard CORS. Encoder/validator dibatasi dua pekerjaan serentak per proses, dua thread encoder dan timeout 60 detik per subprocess. Batas ini bukan antrean terdistribusi; gunakan WAF/reverse proxy untuk event publik.

File sementara ditulis ke direktori OS temp privat (0700), dibersihkan di `finally` pada sukses/gagal. Proses tidak menyimpan capture asli ke Drive dan tidak menambahkan file media ke repository/log. Crash OS/kill paksa dapat melewati cleanup: operator memeriksa direktori temp `kmi-boomerang-*` yang tertinggal dan membersihkannya saat service berhenti; gunakan volume temp privat/terenkripsi sesuai kebijakan perangkat. Temp bukan history atau recovery pengguna.

Mock menggunakan encoder dan validasi MP4 yang sama, tetapi tidak menyimpan hasil ke adapter atau Drive dan tidak membuat link/QR palsu. Credential Google tidak diperlukan untuk pengujian.

## Setup dan operasional

`npm ci` memasang binary bundled untuk OS/arsitektur yang didukung. Download binary FFmpeg membutuhkan akses jaringan ke sumber distribusi paket. Pada Ubuntu produksi, pasang paket sistem:

```bash
sudo apt install -y ffmpeg
ffmpeg -version
ffprobe -version
```

Isi environment server jika memakai binary sistem:

```dotenv
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

Path adalah konfigurasi operator, bukan input guest. Jika kosong, gunakan binary bundled npm. `libx264` harus tersedia. Host harus mendukung Node runtime, subprocess, writable OS temp dan request setidaknya 32 MiB. Lihat [DEPLOY](../DEPLOY.md) untuk systemd/Nginx. Deploy kode terbaru, `npm ci`, build ulang, lalu restart service.

Drive tetap menggunakan scope `drive.file` dan tiga folder bootstrap yang sudah ada. Tidak perlu membuat root/frames/photos baru atau seed ulang untuk mengaktifkan hasil sesi. Hasil PNG lama tetap tersedia pada URL lamanya; hasil baru memakai QR folder.

Retensi tetap manual. Hapus/revoke sharing folder sesi untuk mengakhiri akses kedua hasil. Refresh browser tidak menghapus hasil Drive. Jika respons upload hilang, retry dapat membuat folder tambahan; tidak ada jaminan exact-once tanpa penyimpanan idempotency persisten. Rollback parsial bersifat best-effort, sehingga operator perlu memeriksa orphan jika Drive gagal saat cleanup.

## Verifikasi

Tes otomatis memeriksa urutan maju berulang dan durasi satu detik setiap foto dari seluruh 180 frame video yang benar-benar didecode, format/dimensi/durasi/fps/audio, penolakan input palsu/rusak/terlalu besar, cleanup, consent/origin, kegagalan file kedua/ACL/link, dan folder dengan tepat dua file melalui adapter test.

Playwright memakai kamera sintetis untuk akses kamera langsung tanpa checkbox, upload otomatis PNG + MP4, preview/download, mode demo, kegagalan/retry, timer default/khusus dan refresh. Fixture QR dipakai untuk tes layout, decode PNG unduhan dan timer; tidak membuktikan sharing Drive riil.

Smoke produksi oleh operator: simpan satu sesi disposable, pastikan folder berisi PNG + MP4 saja, buka QR di perangkat/incognito tanpa akun Google, putar/download MP4, periksa root/frames/photos tetap privat, lalu hapus folder uji bila tidak diperlukan. Google Drive dapat memerlukan waktu memproses preview MP4 setelah upload; file MP4 tetap dapat di-download dari folder.

Referensi: [FFmpeg](https://ffmpeg.org/ffmpeg.html), [folder Drive](https://developers.google.com/workspace/drive/api/guides/folder), [inheritance permission Drive](https://developers.google.com/workspace/drive/api/guides/manage-sharing).
