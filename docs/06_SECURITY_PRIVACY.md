# 06 — Security, privacy, threat model

Revisi boomerang: hasil kini PNG + MP4 dalam satu folder sesi. [13_BOOMERANG.md](13_BOOMERANG.md) dan kontrak API terbaru menggantikan ketentuan awal satu-file. Tidak ada database atau history pengguna. Pose edit diproses di OS temp server privat, dibersihkan pada sukses/gagal. Video lokal tetap Blob di browser sampai refresh.

## 1. Data handling matrix

| Data                              | Diproses di                           | Persisted?                             | Audience                                  |
| --------------------------------- | ------------------------------------- | -------------------------------------- | ----------------------------------------- |
| Raw individual captures           | Browser memory                        | Tidak (default)                        | Guest yang mengambil                      |
| Photo strip final sebelum upload  | Browser memory                        | Sementara sebelum upload otomatis      | Guest                                     |
| Kolase + video setelah upload     | Google Drive `photos/<session>/`      | **Ya** sampai folder dihapus operator  | Siapa pun yang punya link folder          |
| Pose edit untuk encode MP4        | Browser → OS temp server privat       | Sementara sampai proses selesai/gagal  | Proses encoder                            |
| MP4 sebelum simpan Drive          | Browser memory                        | Tidak setelah refresh                  | Guest                                     |
| Frame PNG, thumbnail, config JSON | Google Drive `frames/`                | Ya                                     | Admin; published asset via proxy ke guest |
| QR layar / PNG / MP4              | Browser memory / PNG dan MP4 di Drive | Layar tidak; PNG/MP4 ya sampai dihapus | Guest / siapa pun yang punya link         |
| Admin password hash               | Server environment                    | Ya di hosting secret                   | Operator/backend                          |
| Admin session cookie              | Browser cookie, signed HttpOnly       | Sementara sampai expired               | Admin browser                             |
| OAuth refresh token               | Server environment                    | Ya di hosting secret                   | Backend saja                              |

**Ketepatan istilah:** Foto **bukan** hilang dari Drive saat QR/tab ditutup. Link yang telah dibagikan tetap bisa diakses selama izin file publik masih aktif. Jika operator ingin private-only, arsitektur QR langsung Drive harus diubah ke download proxy dengan token dan expiry; itu **bukan scope MVP**.

## 2. Privacy notice UI (copy yang disarankan)

> Saat kamu membuka kamera dan memulai countdown, foto diproses sementara di server dan kolase PNG + video MP4 otomatis disimpan setelah foto terakhir. Folder Drive dapat dibuka siapa saja yang memiliki tautannya. QR yang sama tercetak pada frame PNG. Hasil browser dihapus otomatis setelah durasi scan (default 15 detik); file Drive tetap ada sampai pengelola menghapus atau mencabut izin. Hubungi pengelola acara untuk penghapusan.

Revisi terbaru sesuai permintaan operator menghapus checkbox konfirmasi dan langsung mengaktifkan Buka kamera. Izin kamera browser tetap wajib; informasi proses otomatis, folder publik dan retensi tersedia melalui Privasi di footer. Memulai sesi adalah tindakan pengguna, tetapi flag API `consent`/`processingConsent` lama bukan rekaman persetujuan legal atau bukti checkbox. Tidak ada log/history persetujuan baru. Download lokal tetap tersedia sesudah proses atau saat upload gagal. Mock tidak mengunggah media ke Drive. Operator dapat menambahkan kontak privasi/retensi yang benar; jangan mengisi kontak palsu.

`photoDataUrl` dan `videoDataUrl` respons berisi byte PNG/MP4 final yang sama dengan Drive, total maksimal sekitar 38 MiB base64; tidak boleh dicatat pada log, analytics atau cache. Stamping QR MP4 memakai folder riil, file temp privat, encoder tanpa shell, batas 16 MiB dan cleanup pada sukses/gagal. Preview frame memakai ilustrasi dummy serta penanda AREA QR non-scannable; endpoint unsaved preview dilindungi auth/origin/ukuran/throttle dan tidak menyimpan draft. Konfigurasi durasi merupakan file JSON privat dalam frames, tidak boleh ikut public proxy aset. API admin settings memiliki auth/origin/throttle/revision check; public GET hanya mengembalikan integer durasi. Reset timer membersihkan Blob URL/state; tidak mencabut izin Drive atau QR cetak. Tidak menjanjikan penghapusan file publik ketika timer habis.

## 3. Admin authentication tanpa DB

- Hanya satu operator credential sebagai env: `ADMIN_PASSWORD_HASH` Argon2id (jangan simpan plaintext).
- `POST /api/admin/login` server side verify password; after success set cookie `HttpOnly; SameSite=Lax/Strict; Secure` production, short expiry mis. 8h, signed using `ADMIN_SESSION_SECRET` >= 32 random bytes.
- JWT payload minimal `{sub:'admin', iat, exp}`, signed alg fixed e.g. HS256 via `jose`. Verify server-side for admin pages and API mutators. No auth bypass through disabled JS/client redirect only.
- Logout clears cookie. Karena tidak ada server session store, logout tidak dapat revoke token yang sudah dicuri sampai expired; rotating secret global bisa force logout all.
- Compare/verify password securely. Login rate-limiting best effort + provider WAF is advisable.
- Mutating endpoints check `Origin` / host allowlist, content type, session cookie, CSRF mitigations. Do not trust header client-supplied role.

## 4. Upload protection

- Validate content size from actual stream/body and restrict before reading full content if platform permits. Use strict limits for final PNG/JPG (e.g. 12 MB), overlays (8 MB), thumbnails (2 MB).
- Confirm MIME _magic bytes_, dimensions/max megapixels via image parser. Do not trust filename/extensions.
- Prevent decompression bombs, invalid images, SVG with scripts, remote URL inputs, path traversal, unsafe file names.
- Random server-generated final filename, not client-supplied path.
- Upload endpoint may be publicly abused: best-effort per-IP throttling alone isn't sufficient in horizontal/serverless hosting. Add Cloudflare WAF / Turnstile (or comparable anti-abuse protection) before real public deployment at scale.
- Photo files are human portraits/personal data; never log payload, base64, signed URLs with tokens, or dump file body in errors.
- Follow least privilege: hanya folder hasil sesi dengan PNG + MP4 yang mendapat `anyone:reader`; kedua file mewarisi izin tersebut. Root, `photos/` induk dan `frames/` tetap privat. Jangan menaruh file tambahan sensitif dalam folder sesi yang sudah dibagikan.

## 5. Google Drive & link semantics

- Folder must be operator-owned through OAuth, not a shared personal account accidentally exposed.
- `webViewLink` for view; `webContentLink` for download if available and authorized. Do not assume QR points to a short-lived signed URL. It remains reusable.
- `anyone with link` cannot prevent forwarding or saving; do not advertise one-time/private QR.
- Google Workspace policies can prohibit public sharing. Do not bypass admin policy; show error and allow download locally.
- Retention manual for MVP: admin/operator periodically delete files from Drive; provide explicit recommended policy once event requirements known.
- Monitor Drive capacity. A 3MB final image * 1,000 sessions ≈ 3GB plus overhead; this is an illustration, not a fixed output size.

## 6. Recommended HTTP protections

CSP restricting scripts/styles/img/connect/media to required origins, `X-Content-Type-Options:nosniff`, reasonable referrer policy, no caching of admin JSON, secure cookies, no CORS wildcard on admin. Use same-origin asset proxy so browser Canvas does not become cross-origin tainted.

## 7. Failure modes and recovery

- Upload salah satu file gagal / izin folder atau anak gagal: trash folder sesi dan seluruh anak yang diketahui secara best-effort, log sanitasi bila cleanup gagal; **no QR**. Folder dibagikan hanya setelah dua file lengkap.
- Admin upload partial success: rollback new assets best-effort; keep prior JSON and active overlay unchanged.
- Network failure after upload succeeded but response lost: may create duplicate on retry because no database; UI should warn against repeated clicks, keep local copy, use in-flight guard. Log/cleanup tools can dedup by timestamps where possible.
- Drive quota full: no QR, local download offered, actionable error.
- Camera permission denied: explain how to enable camera permissions and allow retry. Guest photo capture uses camera only; no gallery file picker.

## 8. Explicit no-database constraints

Not using a DB means no durable analytics, distributed token revocation, global rate limiter, user recovery/history, exact-once uploads, or multi-admin optimistic atomic commits. These are deliberate trade-offs; do not promise guarantees impossible under this architecture.
