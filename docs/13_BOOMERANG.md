# Video MP4 dan folder hasil sesi

Revisi fitur ini menggantikan spesifikasi awal yang menyimpan satu PNG dengan QR per-file. Tidak ada database atau riwayat pengguna yang ditambahkan.

## Hasil dan alur

- Kolase PNG tetap mengikuti frame pilihan pada resolusi asli dan renderer preview yang sama.
- Video MP4 menampilkan satu pose bergantian pada kartu event vertikal orisinal. Tiga foto memakai urutan `1 → 2 → 3 → 1 → 2 → 3`, satu detik per foto, total enam detik. Video berjalan maju dan mengulang tanpa efek boomerang. Tidak ada interpolasi gerak; hasil berupa pergantian foto, bukan rekaman kamera bergerak.
- Output video: 1080 × 1920 (9:16), H.264 high, yuv420p, 30 fps, tanpa audio, faststart. Bingkai video memakai nama event/perusahaan dan area foto cover 3:4; overlay strip PNG tidak diregangkan menjadi video.
- Filter, mirror dan posisi crop tiap pose konsisten dengan pengaturan review. Retake/filter/mirror membatalkan cache MP4; perlu membuat video baru setelah perubahan. Layout custom 1–6 slot tetap didukung.
- Preview MP4 memakai kontrol play/pause dan loop; tidak autoplay. Download PNG tidak memerlukan server. Preview/download MP4 memerlukan encoder server dan memproses pose edit sementara; ini dijelaskan di UI sebelum tombol video.
- Persetujuan Drive mencakup PNG dan MP4 dalam folder publik per sesi. Tombol simpan membuat video bila belum tersedia, lalu mengunggah kedua hasil bersama. Error mempertahankan salinan lokal dan tidak menghasilkan QR palsu.

```text
PHOTOBOOTH_ROOT/                  private
  frames/                        private, unchanged
  photos/                        private
    Hoya-Hoya-YYYY-MM-DD-uuid/    anyone-with-link reader
      kolase.png
      boomerang.mp4
```

Server menunggu dua file lengkap sebelum membagikan folder sesi, lalu memeriksa ACL folder dan akses yang diwarisi kedua file. QR berasal dari `webViewLink` folder yang benar-benar dikembalikan Drive dengan ID yang sama. Workspace yang melarang folder publik menghasilkan error tanpa QR. Folder utama tidak dibagikan. Jangan menambahkan file sensitif lain ke folder sesi karena folder tersebut publik bagi pemilik link.

## Pemrosesan dan batas

`POST /api/boomerang` menerima 1–6 JPEG edit 1080 × 1920, masing-masing maksimal 2 MiB, serta `processingConsent=true`. Sharp memvalidasi dan menulis ulang JPEG tanpa metadata. FFmpeg membaca urutan dari nama file internal dalam direktori temp acak, tidak memakai shell atau URL input. Output dikembalikan sebagai MP4 `no-store` dan disimpan hanya sebagai Blob browser.

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

Playwright memakai kamera sintetis untuk preview/download MP4, upload PNG + MP4, mode demo, retake/filter dan refresh. Fixture QR hanya dipakai dalam tes layout dan tidak membuktikan sharing Drive riil.

Smoke produksi oleh operator: simpan satu sesi disposable, pastikan folder berisi PNG + MP4 saja, buka QR di perangkat/incognito tanpa akun Google, putar/download MP4, periksa root/frames/photos tetap privat, lalu hapus folder uji bila tidak diperlukan. Google Drive dapat memerlukan waktu memproses preview MP4 setelah upload; file MP4 tetap dapat di-download dari folder.

Referensi: [FFmpeg](https://ffmpeg.org/ffmpeg.html), [folder Drive](https://developers.google.com/workspace/drive/api/guides/folder), [inheritance permission Drive](https://developers.google.com/workspace/drive/api/guides/manage-sharing).
