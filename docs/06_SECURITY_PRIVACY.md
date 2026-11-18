# 06 — Security, privacy, threat model

## 1. Data handling matrix

| Data                              | Diproses di                     | Persisted?                           | Audience                                  |
| --------------------------------- | ------------------------------- | ------------------------------------ | ----------------------------------------- |
| Raw individual captures           | Browser memory                  | Tidak (default)                      | Guest yang mengambil                      |
| Photo strip final sebelum upload  | Browser memory                  | Tidak sampai user mengizinkan upload | Guest                                     |
| Photo strip final setelah upload  | Google Drive `photos/`          | **Ya** sampai dihapus operator       | Siapa pun yang punya link (anyone-reader) |
| Frame PNG, thumbnail, config JSON | Google Drive `frames/`          | Ya                                   | Admin; published asset via proxy ke guest |
| QR                                | Browser memory                  | Tidak                                | Guest saat tab masih aktif                |
| Admin password hash               | Server environment              | Ya di hosting secret                 | Operator/backend                          |
| Admin session cookie              | Browser cookie, signed HttpOnly | Sementara sampai expired             | Admin browser                             |
| OAuth refresh token               | Server environment              | Ya di hosting secret                 | Backend saja                              |

**Ketepatan istilah:** Foto **bukan** hilang dari Drive saat QR/tab ditutup. Link yang telah dibagikan tetap bisa diakses selama izin file publik masih aktif. Jika operator ingin private-only, arsitektur QR langsung Drive harus diubah ke download proxy dengan token dan expiry; itu **bukan scope MVP**.

## 2. Privacy notice UI (copy yang disarankan)

> Dengan memilih "Simpan & Buat QR", kamu mengizinkan hasil foto strip diunggah ke Google Drive pengelola. File dapat dibuka siapa saja yang memiliki tautannya. Foto tidak akan otomatis terhapus saat kamu menutup halaman. Simpan atau pindai QR sebelum keluar; hubungi pengelola acara untuk permintaan penghapusan.

Opsional: operator menambahkan email kontak privacy & kebijakan retensi, tetapi jangan mengisi alamat palsu. Foto dengan anak/remaja perlu consent yang sesuai. Jika event berlangsung publik, tampilkan pemberitahuan yang terlihat dan desain alur yang tidak memaksa upload (user tetap bisa download lokal).

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
- Follow least privilege: only final photo files have `anyone:reader` permission. No public OAuth tokens, no folder wide access if not needed.

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

- Drive upload success + permission fail: try best-effort delete the inaccessible image or leave for operator cleanup with sanitized log; **no QR**.
- Admin upload partial success: rollback new assets best-effort; keep prior JSON and active overlay unchanged.
- Network failure after upload succeeded but response lost: may create duplicate on retry because no database; UI should warn against repeated clicks, keep local copy, use in-flight guard. Log/cleanup tools can dedup by timestamps where possible.
- Drive quota full: no QR, local download offered, actionable error.
- Camera permission denied: explain how to enable camera permissions and allow retry. Guest photo capture uses camera only; no gallery file picker.

## 8. Explicit no-database constraints

Not using a DB means no durable analytics, distributed token revocation, global rate limiter, user recovery/history, exact-once uploads, or multi-admin optimistic atomic commits. These are deliberate trade-offs; do not promise guarantees impossible under this architecture.
