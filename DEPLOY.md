# Deployment KMI Photobooth

## Alur booth terbaru (24 November 2026)

Setelah deploy, login `/admin`, publish template yang diinginkan, lalu di **Pengaturan antrean booth** pilih **Template aktif booth**, atur durasi QR, dan klik **Simpan pengaturan**. Daftar admin tetap menyimpan banyak template. Pilihan disimpan di `frames/kiosk-settings.json` privat Drive (mock: memori); file lama tetap kompatibel. Jika belum dipilih/null, template published pertama digunakan. Jika template yang dipilih di-unpublish/arsip, pilih penggantinya di admin.

Buka `/` atau `/booth`: langsung layar ambil foto tanpa pemilihan frame/nav atas; pada awal penggunaan peserta menekan **Buka kamera**. Beri izin kamera sekali sesuai kebijakan browser; setelah kamera siap peserta cukup **Mulai countdown**. Setelah QR tampil selama durasi admin, halaman reload dan kamera otomatis dibuka untuk peserta berikutnya. Reload mengambil pilihan template terbaru dan menghapus foto/QR memori, tidak menghapus file Drive. Tidak mendeteksi scan HP; reset mengikuti timer atau tombol Foto lagi. Izin browser/perangkat yang menolak auto-camera tetap memerlukan tombol Buka kamera sebagai retry.

Smoke sebelum event: pilih template A di admin, buka booth dan pastikan nama template A/kamera siap; simpan B saat satu sesi berjalan (sesi A tetap utuh), tunggu QR/timer, pastikan halaman reload, hasil lama hilang dan kamera sesi berikutnya memakai B. Cek HP/desktop tanpa scroll, fallback izin kamera, error jaringan, dan QR PNG/MP4 membuka folder yang sama. Tidak perlu credential/env baru atau seed ulang. Ketentuan ini menggantikan langkah lama pilih frame/reset ke galeri di bawah.

Panduan menjalankan Hoya-Hoya Days Photobooth pada Ubuntu/Debian menggunakan Node.js, systemd, dan Nginx. Semua perintah di bawah dijalankan pada **server Linux**, bukan PowerShell Windows.

## 1. Konfigurasi tujuan

| Pengaturan      | Nilai                                       |
| --------------- | ------------------------------------------- |
| User Linux      | `iot_gateway`                               |
| Folder proyek   | `/home/iot_gateway/Photobooth`              |
| Domain          | `booth.todays.id`                           |
| Port aplikasi   | `3005`                                      |
| Host aplikasi   | `0.0.0.0`                                   |
| Site Nginx      | `/etc/nginx/sites-available/kmi-photobooth` |
| Service systemd | `kmi-photobooth.service`                    |

Asumsi: Nginx dan aplikasi berada pada server yang sama. Nginx meneruskan `https://booth.todays.id` ke `http://127.0.0.1:3005`. systemd menjaga proses Next.js tetap berjalan dan otomatis memulainya setelah reboot.

`0.0.0.0` berarti menerima koneksi dari seluruh interface jaringan; alamat tersebut bukan URL untuk dibuka. Jika IP server memang `10.175.40.39`, backend bisa dijangkau di `http://10.175.40.39:3005` bila firewall mengizinkan. IP PC Windows sebelumnya tidak otomatis menjadi IP server Linux.

## 2. Siapkan server dan Node.js

Login melalui SSH sebagai `iot_gateway`. Akun ini harus memiliki akses `sudo` serta izin baca/tulis folder proyek.

```bash
sudo apt update
sudo apt install -y nginx curl ca-certificates build-essential certbot python3-certbot-nginx ffmpeg
node -v
npm -v
```

Gunakan Node.js 24 LTS untuk mengikuti lingkungan panduan ini. Jika Node belum tersedia, pasang melalui nvm sebagai user `iot_gateway`, tanpa `sudo`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24
```

Jika nvm sudah terpasang, cukup jalankan tiga perintah `nvm` terakhir. Referensi: [nvm](https://github.com/nvm-sh/nvm), [Node.js](https://nodejs.org/en/download).

## 3. Siapkan kode dan environment

Tempatkan kode proyek beserta `package.json`, `package-lock.json`, `src/`, `public/`, `examples/`, dan konfigurasi aplikasi di folder berikut. Jangan menyalin `node_modules` atau `.next` dari Windows; dependency native dan build dibuat ulang di Linux.

```bash
cd /home/iot_gateway/Photobooth
```

Jika `.env.local` belum tersedia:

```bash
cp -n .env.example .env.local
```

Edit secara privat:

```bash
nano .env.local
```

Pastikan dua nilai ini sesuai:

```dotenv
STORAGE_MODE=google-drive
NEXT_PUBLIC_APP_URL=https://booth.todays.id
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

Isi `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, dan seluruh credential/folder Google Drive dari konfigurasi operator yang sah. Nilai credential asli tidak dicantumkan dalam panduan ini. Jangan commit `.env.local`, membagikan isinya, atau menaruh secret dalam variabel `NEXT_PUBLIC_*`.

- Hash Argon2id di file `.env*` harus menggunakan `\$` untuk setiap tanda `$`. Script `admin:hash` menangani escaping tersebut otomatis.
- Jangan jalankan `source .env.local`. Next.js memuat file ini dari folder proyek.
- Untuk membuat password admin baru, jalankan `npm run admin:hash` setelah dependency terpasang. Minimal enam karakter; script menyimpan konfigurasi langsung. Login menggunakan password asli, bukan hash. Lewati jika mempertahankan password yang sudah ada.
- Untuk konfigurasi Drive baru, ikuti [setup Google Drive](docs/05_GOOGLE_DRIVE_SETUP.md). Tidak perlu bootstrap ulang folder yang sudah tersedia. Pengecualian upgrade artwork seed lama dijelaskan pada smoke test di bawah.
- Callback `http://localhost:3847/oauth2callback` adalah callback script setup OAuth, bukan port website. Tidak perlu diubah hanya karena aplikasi memakai port 3005. Untuk OAuth di server headless, ikuti panduan setup; `localhost` pada browser operator tidak otomatis mengarah ke server remote.
- Jika credential pernah dibagikan, rotasi secret dan lakukan otorisasi ulang sebelum penggunaan publik.

Batasi akses file:

```bash
chmod 600 .env.local
```

File harus dimiliki user `iot_gateway` agar service dapat membacanya.

## 4. Install dependency, periksa, dan build

Jalankan sebagai `iot_gateway`, tanpa `sudo`:

```bash
cd /home/iot_gateway/Photobooth
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Lanjutkan jika semua pemeriksaan berhasil. `NEXT_PUBLIC_APP_URL` harus sesuai domain yang dibuka pengguna **sebelum build**. Setelah mengubah URL tersebut, build ulang agar pemeriksaan origin tidak menolak login/upload.

## 5. Buat service systemd

Pastikan tidak ada aplikasi lain atau proses `npm start` manual yang menggunakan port 3005:

```bash
sudo ss -ltnp 'sport = :3005'
```

Jalankan blok berikut dalam shell yang sama dengan Node.js aktif. Variabel `PHOTOBOOTH_NODE` mengambil lokasi binary Node yang sebenarnya, termasuk jika memakai nvm:

```bash
PHOTOBOOTH_NODE="$(command -v node)"
test -n "$PHOTOBOOTH_NODE" || { echo "Node.js belum tersedia"; exit 1; }

sudo tee /etc/systemd/system/kmi-photobooth.service > /dev/null <<EOF
[Unit]
Description=KMI Hoya-Hoya Days Photobooth
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=iot_gateway
WorkingDirectory=/home/iot_gateway/Photobooth
Environment=NODE_ENV=production
ExecStart=${PHOTOBOOTH_NODE} /home/iot_gateway/Photobooth/node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port 3005
Restart=always
RestartSec=5
TimeoutStopSec=30
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
```

Service tidak memakai `EnvironmentFile=.env.local`: biarkan Next.js memproses escaping environment dengan loader-nya sendiri.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kmi-photobooth
sudo systemctl status kmi-photobooth --no-pager
curl -I http://127.0.0.1:3005
```

Status service harus `active (running)` dan endpoint lokal harus mengembalikan respons HTTP. Terminal SSH boleh ditutup. Server tetap harus menyala dan tidak sleep. Referensi: [systemd.service](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html).

## 6. Buat site Nginx `kmi-photobooth`

```bash
sudo nano /etc/nginx/sites-available/kmi-photobooth
```

Isi:

```nginx
server {
    listen 80;
    server_name booth.todays.id;

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

Tidak perlu `root` ke folder proyek atau PHP-FPM. Header `Origin` diteruskan apa adanya. Konfigurasi IP di atas mengasumsikan Nginx menerima koneksi pengguna langsung; bila ada load balancer/CDN tambahan, atur trusted real-IP secara terbatas bersama pengelola jaringan. Referensi: [Nginx proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

Aktifkan site:

```bash
sudo ln -s /etc/nginx/sites-available/kmi-photobooth /etc/nginx/sites-enabled/kmi-photobooth
sudo nginx -t
```

Jika symlink sudah ada dan mengarah ke file yang benar, lewati `ln`. Pastikan tidak ada site lain dengan `server_name booth.todays.id`. Setelah tes konfigurasi berhasil:

```bash
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

Jika Nginx berada pada mesin lain, ubah `proxy_pass` ke IP **server Linux tempat Next.js berjalan**, pastikan jaringan LAN/VPN dapat menjangkaunya, dan batasi akses port 3005 ke proxy tersebut.

## 7. DNS, firewall, dan HTTPS

1. Arahkan DNS `booth.todays.id` ke server/proxy penerima trafik. Untuk akses internet, gunakan IP publik, bukan IP privat `10.x.x.x`. Jika ada record IPv6, pastikan rutenya juga benar.
2. Jika di belakang router, teruskan port TCP 80 dan 443 ke Nginx.
3. Jika UFW aktif, izinkan HTTP/HTTPS:

   ```bash
   sudo ufw allow 'Nginx Full'
   ```

Port 3005 tidak perlu dibuka ke internet ketika Nginx berada pada mesin yang sama. Binding `0.0.0.0` tetap dapat dibatasi melalui firewall.

Setelah domain menjangkau Nginx, terbitkan sertifikat:

```bash
sudo certbot --nginx -d booth.todays.id --redirect
sudo certbot renew --dry-run
sudo nginx -t
```

Perintah tersebut menambahkan HTTPS dan redirect HTTP ke HTTPS. Pastikan renewal otomatis Certbot aktif sesuai paket OS. HTTP validation memerlukan port 80 yang dapat dijangkau dari internet; domain yang hanya tersedia di intranet memerlukan validasi DNS atau sertifikat perusahaan yang dipercaya perangkat pengguna. Referensi: [Certbot Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap).

## 8. Verifikasi sebelum event

Buka melalui domain yang sama dengan `NEXT_PUBLIC_APP_URL`:

```text
https://booth.todays.id
https://booth.todays.id/admin/login
```

- Login admin dan periksa koleksi frame.
- Di admin, atur **Durasi scan QR (detik)** (default 15, rentang 5–300), simpan lalu refresh admin untuk memastikan nilai bertahan. Mode Drive menyimpan `frames/kiosk-settings.json` privat.
- Klik Buka kamera langsung tanpa checkbox, izinkan kamera browser, ambil tiga foto, lalu pastikan upload otomatis menghasilkan PNG + MP4 tanpa panel nuansa/review. Informasi privasi tetap tersedia di footer.
- Pindai QR dari HP tanpa login Google, unduh PNG dan pastikan seluruh bagian bawah mengikuti badan frame: Vintage hitam dengan perforasi, Gingham kotak pink, Mint mint; tidak ada panel hijau bersama. Tiga foto tetap utuh dan QR cetak dapat dipindai. Jangan crop QR; sesuaikan kertas dengan tinggi PNG baru. Aplikasi tidak mencetak otomatis.
- Untuk galeri Drive yang masih memakai seed dengan panel hijau lama, jalankan `npm run drive:seed` satu kali setelah kode terbaru dipasang. Seed bertag yang belum memiliki `artwork:continuous-v2` di-upgrade dengan ID/revision/aset versi lama dipertahankan. Script menulis aset frame riil, tidak menyentuh foto hasil sesi. Renderer hasil baru juga memperbaiki footer overlay lama berdasarkan identitas preset. Refresh galeri setelah upgrade.
- Setelah durasi scan habis, layar wajib kembali ke pilih frame; sesi berikutnya langsung dapat membuka kamera tanpa checkbox. File hasil di Drive tetap dapat dibuka. Error upload tidak boleh memulai reset; periksa retry/download fallback.
- Pastikan QR pada PNG dan frame MP4 membuka folder sesi yang sama, berisi tepat `kolase.png` dan `boomerang.mp4`. Putar/unduh video: tema sesuai frame, QR tetap ada sepanjang enam detik dan tidak menutup pose. Preview galeri/admin harus serupa hasil lengkap dengan penanda AREA QR sebelum sesi. Folder utama dan frame tetap privat.
- Respons hasil mengandung PNG + MP4 final base64 dan dapat sekitar 38 MiB; jangan cache atau log body respons di aplikasi/proxy. Batas request upload tetap 32 MiB di proxy; sesuaikan timeout untuk validasi, stamping video dan Drive.
- Refresh halaman: foto/QR lokal hilang, file yang telah diunggah tetap ada di Drive.
- Pastikan service aktif setelah restart server pada waktu pengujian yang disepakati.

HTTP melalui IP hanya untuk memeriksa konektivitas halaman. Penggunaan kamera memerlukan secure context dan cookie admin produksi memakai `Secure`, sehingga operasional dilakukan melalui HTTPS. Referensi: [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting).

## 9. Operasional dan pembaruan

```bash
# Status aplikasi
sudo systemctl status kmi-photobooth --no-pager

# Log terbaru
sudo journalctl -u kmi-photobooth -n 100 --no-pager

# Pantau log langsung (Ctrl+C hanya keluar dari pemantauan)
sudo journalctl -u kmi-photobooth -f

# Restart / stop / start
sudo systemctl restart kmi-photobooth
sudo systemctl stop kmi-photobooth
sudo systemctl start kmi-photobooth
```

Untuk memperbarui kode/dependency/environment, jadwalkan jeda layanan. Siapkan cadangan kode dan build sebelumnya untuk pemulihan bila build baru gagal; simpan credential secara privat. Jangan menimpa build ketika service sedang melayani pengguna.

```bash
cd /home/iot_gateway/Photobooth
sudo systemctl stop kmi-photobooth
# Terapkan kode rilis yang dituju di sini.
npm ci
npm run lint
npm run typecheck
npm test
npm run build
# Jalankan hanya setelah seluruh perintah di atas berhasil:
sudo systemctl start kmi-photobooth
sudo systemctl status kmi-photobooth --no-pager
```

Jika build gagal, perbaiki atau pulihkan rilis sebelumnya sebelum menjalankan service. Jika lokasi binary Node berubah setelah upgrade nvm, perbarui `ExecStart`, jalankan `sudo systemctl daemon-reload`, lalu restart service.

## 10. Troubleshooting

| Gejala                         | Pemeriksaan                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Nginx `502 Bad Gateway`        | Periksa service/log dan `curl -I http://127.0.0.1:3005`.                                                                              |
| `EADDRINUSE`                   | Periksa pemilik port 3005; hentikan proses lama yang memang milik aplikasi ini.                                                       |
| systemd `203/EXEC`             | Periksa path Node di `ExecStart` dan izin eksekusi user `iot_gateway`.                                                                |
| Error origin saat login/upload | Cocokkan domain HTTPS dengan `NEXT_PUBLIC_APP_URL`, build ulang, dan restart.                                                         |
| Password belum dikonfigurasi   | Periksa keberadaan hash, escaping `\$`, secret minimal 32 byte, izin `.env.local`, lalu restart. Jangan cetak nilainya ke log.        |
| Kamera tidak tersedia          | Gunakan HTTPS yang dipercaya browser dan periksa izin kamera perangkat.                                                               |
| Upload `413`                   | Pastikan batas proxy tambahan dan Nginx cukup; batas aplikasi tetap berlaku.                                                          |
| Certbot gagal                  | Periksa DNS, port 80, NAT/firewall, dan site lain dengan domain sama.                                                                 |
| Google `invalid_grant`         | Periksa status token/consent dan lakukan OAuth ulang; status External/Testing dapat menyebabkan token kedaluwarsa setelah tujuh hari. |
| QR meminta login Google        | Periksa permission publik pada file final; jangan mempublikasikan seluruh folder frame atau metadata.                                 |

Panduan ini mencatat konfigurasi yang perlu diterapkan operator. Pembuatan dokumen tidak berarti service, DNS, firewall, atau sertifikat pada server sudah dikonfigurasi.
