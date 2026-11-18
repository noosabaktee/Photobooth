# 11 — Decisions, constraints, roadmap

## Keputusan final yang berasal dari kebutuhan user

| Pertanyaan                       | Keputusan                                                             |
| -------------------------------- | --------------------------------------------------------------------- |
| Backend?                         | Ya: Next.js Route Handlers untuk Drive & admin auth                   |
| Database?                        | **Tidak ada** untuk MVP                                               |
| Simpan hasil foto?               | Satu PNG final per sesi ke Google Drive via server-side API           |
| Barcode?                         | **QR Code** yang mengarah langsung ke link file final di Google Drive |
| QR saat close?                   | Hilang dari frontend state; tidak ada history; file Drive tetap ada   |
| Bisa admin tambah frame?         | Ya via dashboard, upload PNG overlay + JSON slot layout ke Drive      |
| User bisa bikin frame sendiri?   | Tidak, hanya memilih yang published admin                             |
| Perlu redeploy untuk frame baru? | Tidak; Drive listing publik refresh/cache TTL                         |
| Perlu login guest?               | Tidak                                                                 |
| Login admin?                     | Ya, password hash env + signed session cookie tanpa DB                |

## Keputusan desain yang bisa ditinjau nanti

1. **OAuth user vs service account** — OAuth user untuk My Drive operator karena service account punya batasan ownership/quota pada My Drive. Shared Drive Workspace adalah alternatif untuk skala/operasional lain.
2. **QR langsung Drive** — sesuai keinginan user, tidak memerlukan endpoint retrieval/DB; kekurangan: halaman download bukan branding website, link dapat diteruskan, Google UI tergantung platform dan permission.
3. **Metadata frame JSON per item** — lebih aman dibanding satu JSON global yang sering ditimpa; kekurangan: lebih banyak Drive API read, conflict admin belum atomic.
4. **Asset overlay private via proxy** — template belum published tidak bocor, public output tidak memerlukan copy image frame publicly shared. Caching harus mempertimbangkan status.
5. **Photo in browser memory** — refresh membuang hasil. Tidak ada raw image saved server by default; bisa rentan kehilangan kalau upload gagal lalu tab ditutup.
6. **Mock mode eksplisit** — developer dapat test fitur end-to-end tanpa credential; mock tidak dianggap nyata.

## Risiko utama dan mitigasi

| Risiko                                | Konsekuensi                     | Mitigasi                                                            |
| ------------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| Quota storage Drive                   | Upload gagal                    | Monitor storage, retensi manual, local download                     |
| OAuth refresh token expired           | Semua Drive operasi gagal       | Consent & publishing status benar, monitoring                       |
| Traffic / bot abuse                   | Quota & biaya                   | WAF/Turnstile, body limits, throttling best effort                  |
| Public link disebarkan                | Kebocoran privasi               | Consent & clear disclosure; jangan klaim private link               |
| Concurrent admin update               | Frame JSON tertimpa             | Single-admin MVP, expectedRevision, versioned asset                 |
| Host request size                     | 413 / deployment error          | Test host max; compress file atau pindah ke Node host lain          |
| Google Drive external sharing blocked | QR tidak bisa dibuka umum       | Periksa policy; fail cleanly, local download fallback               |
| No DB for recovery                    | QR tak dapat dipulihkan via app | Tekankan scan/copy sebelum tutup, operator cari di Drive bila perlu |

## Roadmap setelah MVP

**P1:** Event collections, preset export print, filter tambahan, frame variants, duplicate template, bulk upload.

**P2:** Event dashboard dengan analytics dan cleanup retention otomatis (mungkin perlu durable job scheduler/DB; perlu keputusan eksplisit sebelum arsitektur berubah), branded link share page, optional admin QR recovery by time.

**P3:** Printer integration, custom domain links with expiring access, cloud object storage/CDN bila trafik besar. Jika butuh recovery, per-file deletion, strict access expiry, atau analytics, database/durable KV store mungkin akhirnya bermanfaat. Jangan menambahkan tanpa kebutuhan baru.
