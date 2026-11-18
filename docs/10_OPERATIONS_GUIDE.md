# 10 — End-user & admin manual

## A. Pengguna: mengambil foto

1. Buka alamat website lalu klik **Start Photobooth**.
2. Klik langsung gambar/kartu frame dari koleksi. Jumlah foto otomatis mengikuti jumlah kotak di frame tersebut.
3. Klik **Buka kamera** dan izinkan akses. Semua foto diambil melalui kamera. Jika tidak tersedia, periksa izin browser, sambungan kamera, dan HTTPS lalu coba lagi.
4. Ikuti countdown; ambil foto beberapa kali sesuai slot. Lihat jumlah foto di indikator.
5. Di preview, pilih foto tertentu untuk **Retake**, atau ulang semua. Tambahkan filter bila perlu.
6. **Download PNG lokal** menyimpan kolase tanpa mengirim foto ke server. **Preview video** / **Download MP4** memproses foto edit sementara di server, lalu membersihkannya. Filter/mirror/retake membatalkan video lama agar hasil baru sesuai edit.
7. Pilih **Simpan & bagikan**, berikan consent, lalu **Simpan ke Drive & buat QR**. Setelah dua hasil tersimpan, QR membuka folder sesi Drive berisi kolase PNG dan video MP4. Keduanya bisa dibuka siapa pun yang memiliki link; video dapat ditambahkan ke sosmed setelah download.
8. Salin link jika scan sulit. **Jangan tutup halaman sebelum mengambil QR**, karena QR tidak tersimpan di website. Jika tertutup, file Drive **tidak hilang** tetapi user tidak mempunyai halaman riwayat untuk mencarinya.

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

- Tekan `Copy link`, kirim ke perangkat yang dituju.
- Pastikan kamera bisa membaca QR (cukup terang, QR high contrast).
- Jika Google Drive meminta login, operator harus memeriksa permission `anyone:reader` pada file hasil.
- Jika tab sudah ditutup, tidak ada recovery otomatis di aplikasi; operator mungkin bisa menemukan file dalam Drive berdasarkan jam event.

### Jika kuota habis

User tetap dapat download hasil lokal sebelum tab ditutup. Operator perlu hapus file lama atau tambah storage. Browser tak bisa meng-upload file saat Drive menolak kapasitas; jangan membuat QR palsu.

### Data retention

Tentukan masa simpan foto sesuai kebijakan acara. Jadwalkan penghapusan manual foto yang lebih tua dari masa retensi. Menghapus foto Drive membuat QR lama tidak bisa digunakan lagi. Menghapus QR di browser **tidak** menghapus Drive file.

## D. Opsional SOP pre-event 5 menit

- Tes HTTPS, izin kamera, countdown dan retake di perangkat acara/HP.
- Tes satu frame published, screenshot preview dan file download cocok.
- Tes upload real & QR pada HP tanpa akun.
- Pastikan storage Drive dan hosting tidak mendekati batas.
- Siapkan operator yang bisa menyelesaikan isu permissions, cache, dan upload.
