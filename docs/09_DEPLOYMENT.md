# 09 — Local development & deployment

## 1. Developer quickstart (once Codex has generated code)

```bash
npm install
cp .env.example .env.local
# set STORAGE_MODE=mock for demo while no Google credentials
npm run dev
```

Open `http://localhost:3000`. For admin, run `npm run admin:hash` to generate Argon2id password hash and add to `.env.local`; generate a strong random `ADMIN_SESSION_SECRET` in local terminal. No default insecure admin password in production.

For tests:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Scripts must be created by Codex in the actual app; this ZIP is prompt/spec kit only.

## 2. Production prerequisites

- Public HTTPS origin (`getUserMedia` generally requires secure context); valid `NEXT_PUBLIC_APP_URL`.
- Node.js runtime supporting `googleapis`, image validation libs and route handlers.
- Upload max body payload supported by deployment platform. Photo can reach several MB; **check actual host restrictions** (some serverless offerings impose small request body caps). If hosting does not support desired image size, use a provider architecture designed for bigger uploads or choose a platform where the Node backend can accept them. Do not bypass security checks by unrestricted file transfer.
- Secure secret storage for OAuth and `ADMIN_*` vars; never expose via `NEXT_PUBLIC_*`.
- WAF/rate limiting and ideally bot protection before sharing public event QR/photo-upload endpoint widely.
- Google Drive account enough storage; workspace sharing policies compatible with anyone-with-link.
- OAuth consent production/testing status configured; refresh token expiry verified.

## 3. Suggested deploy approach

For MVP, a conventional Node server/container is simpler to debug for multi-MB uploads and Google Drive operations. Next.js can also run on platforms like Vercel, but check Route Handler request size / runtime limits for the selected plan before committing. Do not promise universal compatibility with 12MB uploads. Prefer environment-variable secret manager over committed `.env` files.

Run:

```bash
npm run build
npm run start
```

Set HTTPS via hosting provider/reverse proxy, health check, logs. Do not accept production `STORAGE_MODE=mock` silently; if user intentionally enables demo on production, show visible demo banner and never display real-looking Drive QR.

## 4. Operator monitoring (without database)

- Periodically inspect Drive folder storage, number and size of final photos.
- Observe server errors, latency, 401/403/429/5xx from Drive, repeated failed upload, quota alerts.
- Decide manual retention schedule (example: 30/60/90 days) based on event policy. **No automatic deletion** in MVP.
- Back up the frames folder + configs, keep offline copies of original overlay designs.
- Rotate session secret if suspect admin cookie compromise; rotate OAuth credentials if leak detected.
- Test QR with an incognito device before every event.

## 5. Troubleshooting

| Symptom                                    | Fix                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Camera blank on deployed site              | Confirm HTTPS, permission, browser compatibility, Permissions Policy, user gesture |
| Login succeeded but page redirected        | Cookie `Secure` domain/HTTPS setup, session secret consistency across instances    |
| Frame upload but does not show             | Check published flag, config valid, public listing TTL                             |
| QR opens sign-in wall                      | Verify Google public-read permission was applied on final file                     |
| Browser shows CORS tainted canvas          | Use same-origin server asset proxy and avoid remote image data from cross-origin   |
| Drive 403 quota                            | Free storage/upgrade; show local download alternative                              |
| Drive refresh token expires after one week | Check Google OAuth external testing status, reauthorize appropriately              |
| Photo body rejected by host                | Compress / reduce output or select capable hosting configuration                   |

## 6. Security rollout checklist

No secret in JS bundle; no admin endpoints unauthenticated; no wildcard CORS; upload size/dimensions limited; sanitized logs; new frame draft private; QR success depends on ACL permission success; privacy notice visible; error fallback local export works.
