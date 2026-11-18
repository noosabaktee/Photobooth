# 12 — Rujukan teknis (dicek 16 November 2026)

Sumber di bawah digunakan untuk memverifikasi feasibility. Ini bukan library dependency lockfile; cek ulang versi API/doc di saat implementasi.

1. [Google Drive API: Choose Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — `drive.file` untuk file yang dibuat/dikelola melalui aplikasi.
2. [Google Drive API: Create and manage files](https://developers.google.com/workspace/drive/api/guides/create-file) — upload file ke Drive, metadata, owner.
3. [Google Drive API: Share files, folders, drives](https://developers.google.com/workspace/drive/api/guides/manage-sharing) — `permissions.create` untuk `type:anyone, role:reader`.
4. [Google Drive API: Download/export](https://developers.google.com/workspace/drive/api/guides/manage-downloads) — `webContentLink`, `files.get alt=media` untuk blob.
5. [Google Drive API: Resolve errors](https://developers.google.com/workspace/drive/api/guides/handle-errors) — service accounts lack personal storage quota; quota errors.
6. [Google Drive API: Shared drives overview](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) — shared drives ownership alternative.
7. [Google Drive API: Usage limits](https://developers.google.com/workspace/drive/api/guides/limits) — Drive quotas; kebijakan dapat berubah.
8. [Google Identity: OAuth 2.0](https://developers.google.com/identity/protocols/oauth2) — refresh token & External Testing expiry.
9. [Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) — request handlers pada App Router.
10. [MDN: MediaDevices.getUserMedia()](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — browser camera, secure contexts & permissions.

**Technical caution:** beberapa halaman Google lama atau contoh lintas versi dapat memiliki kalimat yang tampak bertentangan tentang kepemilikan file oleh service account. Untuk desain My Drive personal, default aman adalah autentikasi sebagai akun pengguna nyata via OAuth offline; bila implementasi menemukan perubahan perilaku, verifikasi dokumen error, storage/quota, dan resource terbaru secara eksplisit.
