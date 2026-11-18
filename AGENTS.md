# AGENTS.md — Instruksi tetap untuk Codex

Sumber kebenaran utama: `CODEX_PROMPT.md` dan seluruh `docs/`.

1. Bangun aplikasi berjalan, bukan sekadar wireframe, pseudo-code atau penjelasan.
2. Next.js App Router + TypeScript strict + Tailwind CSS. Gunakan paket terpelihara yang kompatibel dengan versi stabil pada saat eksekusi. Jalankan format/lint/typecheck/test/build, dan perbaiki error.
3. **Tanpa database** untuk semua fitur. Dilarang menambah ORM, Redis, session store eksternal, Firebase / Supabase database atau database terselubung tanpa approval. JSON frame disimpan sebagai file di Google Drive.
4. Integrasi Drive riil hanya berjalan saat kredensial sah. Sediakan `STORAGE_MODE=mock` untuk development & tests; labeli jelas sebagai demo, jangan membuat QR Google Drive palsu.
5. Admin auth tidak boleh client-only. Semua route mutasi frame dan detail draft dilindungi cookie sesi server-side signed, password hash, origin/CSRF checks, validasi input dan batas ukuran.
6. Browser guest tanpa login, tanpa persistent photo history, dan tidak perlu cookie analitik. Hasil final dipublikasikan via link Drive yang benar-benar dapat dibuka tanpa login setelah izin disetel dengan sukses. Jika Drive menolak sharing publik, tampilkan error transparan; jangan tampilkan QR yang tidak berfungsi.
7. QR hilang jika tab ditutup atau refresh; data foto yang telah ter-upload **tidak otomatis terhapus dari Drive**. Sediakan penjelasan privasi pada halaman user.
8. Foto akhir harus cocok dengan preview: crop `cover`, orientasi selfie konsisten, overlay frame ditumpuk setelah foto, tidak ada slot tertutup, PNG high-resolution.
9. Hormati aksesibilitas keyboard, error kamera, mobile responsiveness, reduced-motion, loading state dan kegagalan jaringan.
10. Gunakan folder `references/` hanya untuk inspirasi visual; jangan menyisipkan foto orang nyata dari referensi ke landing page/app final.
11. Semua credential hanya dari environment. Tidak commit `.env.local`, OAuth token, user photo, secret, atau keluaran hasil kamera.
12. Prioritaskan fungsi MANDATORY P0 sebelum fitur opsional. Jika ada kendala eksternal (credential belum ada), pastikan build tetap lulus, mock tests bisa dijalankan, dan dokumentasikan langkah operator.
13. Tulis perubahan nyata ke `docs/IMPLEMENTATION_STATUS.md` selama pengerjaan: fase, file, hasil tes, kendala. File ini adalah output kerja Codex, bukan pengganti implementasi.
14. Jangan berhenti di planning dan jangan meminta konfirmasi untuk keputusan implementasi kecil: ikuti default yang ditentukan di dokumen. Sebutkan asumsi di hasil akhir.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
