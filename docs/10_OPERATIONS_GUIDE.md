# 10 — End-user & admin manual

Preview pilih frame, kartu admin dan preview builder kini menampilkan proporsi/desain hasil lengkap, termasuk penanda non-scannable AREA QR. Tidak ada link/QR palsu sebelum folder sesi tersedia. PNG hasil, video MP4 dan QR layar memakai URL folder yang sama; MP4 mengikuti tema frame dan QR tampil sepanjang enam detik. Preview/download MP4 menggunakan byte final yang sama dengan Drive. Tema custom tanpa identitas seed memakai kartu video mint sebagai default.

Seluruh bagian bawah hasil cetak mengikuti tema badan frame: Vintage hitam dengan perforasi film, Gingham kotak-kotak pink dan Mint mint. Tidak ada panel hijau bersama atau kartu QR terpisah. Artwork diteruskan di belakang QR; modul putih pada Vintage dan hitam pada tema terang. Margin kosong QR tetap empat modul, dengan pola pastel berkontras rendah pada Gingham. Uji scan HP/printer sebelum acara. Renderer juga mengganti panel hijau pada hasil sesi baru yang memakai overlay seed lama; PNG hasil lama di Drive tidak diubah. Jalankan `npm run drive:seed` sekali setelah deploy untuk upgrade aset/thumbnail seed pada galeri Drive ke artwork versi baru.

## A. Pengguna: mengambil foto

1. Buka alamat website lalu ketuk **Mulai foto bareng**. Tombol **Cara pakai** di footer membuka bantuan tiga langkah kapan saja.
2. Klik langsung gambar/kartu frame dari koleksi. Jumlah foto otomatis mengikuti jumlah kotak di frame tersebut.
3. Langsung klik **Buka kamera** tanpa checkbox konfirmasi dan izinkan akses browser. Semua foto diambil melalui kamera. Informasi proses otomatis, folder publik dan retensi tersedia melalui Privasi di footer. Jika kamera tidak tersedia, periksa izin browser, sambungan kamera, dan HTTPS lalu coba lagi.
4. Klik **Mulai countdown** dan ikuti angka 3–2–1 pada tiap foto, lalu tahan pose setengah detik setelah angka hilang. Tidak ada tulisan tambahan di tengah kamera.
5. Sesudah foto terakhir, kolase natural dan MP4 otomatis diproses/dikirim ke Drive. Tidak ada pilihan nuansa atau review/retake. Tunggu QR; jangan refresh selama proses.
6. Scan QR memakai HP. Folder berisi `kolase.png` dengan QR cetak dan `boomerang.mp4`; dapat dibuka siapa pun yang punya link. Download PNG/MP4 juga tersedia pada layar hasil.
7. Layar otomatis kembali ke pilih frame setelah default **15 detik sejak QR tampil**. Sesi browser dibersihkan, tetapi file Drive tetap ada. Ambil hasil sebelum waktunya habis. **Foto lagi** bisa mempercepat pergantian dengan konfirmasi; membatalkan konfirmasi tidak menghentikan timer.
8. Bila upload gagal, timer tidak berjalan. Gunakan **Coba simpan lagi** atau download lokal. PNG fallback belum memiliki QR karena folder belum sukses dibagikan. Operator bisa membantu jika jaringan bermasalah; retry setelah respons hilang dapat membuat folder tambahan.

Animasi dekoratif dapat dinonaktifkan lewat tombol ikon animasi di footer. Pengaturan reduced motion perangkat selalu diikuti. Countdown tetap tiga detik per jepretan walaupun animasi dimatikan; tiga foto menjadi video enam detik dengan urutan `1–2–3–1–2–3`, satu detik per foto. Sebelum berganti pengguna, pastikan kembali ke layar pilih frame agar hasil sebelumnya tidak tertinggal di layar.

### Mengatur durasi scan dan cetak

Masuk `/admin`, cari **Pengaturan antrean booth**, isi **Durasi scan QR (detik)** antara 5–300, lalu **Simpan durasi**. Default 15 detik. Pengaturan berlaku pada sesi yang memilih frame setelah penyimpanan. Refresh kiosk bila perlu; sesi aktif tetap memakai durasi snapshot. File konfigurasi adalah `kiosk-settings.json` privat di folder frames, bukan database. Mock kembali ke default setelah proses server restart. Jika revisi konflik, tekan **Muat ulang pengaturan** sebelum menyimpan lagi.

Cetak PNG lengkap tanpa crop QR. Area QR menyatu dengan warna/sisi footer frame; seluruh bagian bawah ketiga seed mengikuti badan frame. Foto tidak ditutup/digeser, tinggi output bertambah. Template tanpa footer melanjutkan warna tepi bawah. Gunakan QR fisik minimal sekitar 25 mm, jangan menutup margin kosong QR, dan tes scan pada hasil printer/kertas sebenarnya sebelum acara. Aplikasi menyiapkan file; pemilihan kertas/driver dan perintah cetak tetap di perangkat operator. Menghapus file/folder Drive atau mencabut sharing akan memutus QR cetak lama.

## B. Admin: login dan tambah frame

1. Masuk ke `/admin/login`, masukkan kata sandi operator yang dikonfigurasi.
2. Klik **Add Frame**. Beri nama, kategori, dan deskripsi pendek / tag.
3. Upload PNG transparan resolusi disarankan 1200×3600 untuk photo strip vertikal; sistem memeriksa format, ukuran dan alpha.
4. Di editor, tambahkan 1–6 slot. Gunakan drag/resize atau input angka x/y/width/height. Tentukan order: slot 1 mendapatkan foto pertama, dst.
5. Klik **Preview** dengan foto dummy; jika foto tertutup overlay opaque, desain PNG perlu diperbaiki.
6. **Save Draft** untuk pekerjaan belum selesai; **Publish** jika sudah siap tampil di gallery user.
7. Buka `/booth` untuk memastikan hasilnya bagus. Jika ingin mengganti desain frame, edit dan upload versi baru lalu publish. Frame yang sudah dipakai user di sesi aktif tetap didukung dengan aset versi sebelumnya selama window transisi.
8. Untuk menyembunyikan frame tanpa menghapus file, gunakan **Unpublish**. Delete hanya setelah paham dampak terhadap template versi lama.

## C. Operator: folder Drive & file user

Folder `photos/` tetap privat dan berisi **folder per sesi** bernama `Hoya-Hoya-<tanggal>-<uuid>`, dengan `kolase.png` dan `boomerang.mp4`. Hanya folder sesi yang dibagikan melalui QR. Operator dapat mencari folder berdasarkan tanggal/nama dan menghapus atau mencabut sharing folder untuk kedua hasil. Jangan memasukkan file sensitif lain ke folder sesi publik. Tidak ada dashboard per-user, email, analytics, atau database. Hasil PNG lama tidak dihapus/migrasikan otomatis.

### Jika QR tidak dapat di-scan

- Tekan **Salin link**, kirim ke perangkat yang dituju.
- Pastikan kamera bisa membaca QR (cukup terang, QR high contrast).
- Jika Google Drive meminta login, operator harus memeriksa permission `anyone:reader` pada file hasil.
- Jika tab sudah ditutup, tidak ada recovery otomatis di aplikasi; operator mungkin bisa menemukan file dalam Drive berdasarkan jam event.

### Jika kuota habis

User tetap dapat download hasil lokal sebelum tab ditutup. Operator perlu hapus file lama atau tambah storage. Browser tak bisa meng-upload file saat Drive menolak kapasitas; jangan membuat QR palsu.

### Data retention

Tentukan masa simpan foto sesuai kebijakan acara. Jadwalkan penghapusan manual foto yang lebih tua dari masa retensi. Menghapus foto Drive membuat QR lama tidak bisa digunakan lagi. Menghapus QR di browser **tidak** menghapus Drive file.

## D. Opsional SOP pre-event 5 menit

- Tes HTTPS, Buka kamera tanpa checkbox, izin kamera browser, countdown dan simpan otomatis di perangkat acara/HP.
- Tes satu frame published, screenshot preview dan file download cocok.
- Tes upload real & QR pada HP tanpa akun.
- Pastikan storage Drive dan hosting tidak mendekati batas.
- Siapkan operator yang bisa menyelesaikan isu permissions, cache, dan upload.
