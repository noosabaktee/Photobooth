# 08 — Test plan and acceptance checklist

## 1. Required test scripts

- `npm run lint` — ESLint.
- `npm run typecheck` — `tsc --noEmit` strict.
- `npm test` — Vitest unit/integration.
- `npm run test:e2e` — Playwright E2E (if installed).
- `npm run build` — Next.js production build.
- `npm run dev` — local smoke.

## 2. Automated unit tests

| ID    | Scenario                                        | Expected                |
| ----- | ----------------------------------------------- | ----------------------- |
| UT-01 | valid 4-slot config                             | accepted                |
| UT-02 | x+width>1                                       | rejects                 |
| UT-03 | duplicated order / id                           | rejects                 |
| UT-04 | slot overlapping                                | rejects/warn per policy |
| UT-05 | 7 slots                                         | rejects                 |
| UT-06 | unsupported overlay mime                        | rejects                 |
| UT-07 | aspect `cover` portrait → wide slot             | correct crop math       |
| UT-08 | selfie mirror on/off                            | correct orientation     |
| UT-09 | capture N=3 then retake index 1                 | other slots unchanged   |
| UT-10 | QR validation accepts real drive.google.com URL | accepted                |
| UT-11 | QR validation rejects javascript:/evil host     | rejects                 |
| UT-12 | session signature expired/tampered              | rejects                 |
| UT-13 | edit frame revision mismatch                    | returns 409             |
| UT-14 | type/magic bytes mismatch                       | returns 415/400         |
| UT-15 | max upload size exceeded                        | returns 413             |

## 3. Integration tests (mock adapter)

| ID    | Scenario                           | Expected                                          |
| ----- | ---------------------------------- | ------------------------------------------------- |
| IT-01 | create frame as admin              | persists to mock adapter and lists as draft       |
| IT-02 | draft frame on public endpoint     | not shown                                         |
| IT-03 | publish valid frame                | public list contains it                           |
| IT-04 | unpublish                          | removed from public list                          |
| IT-05 | unauthenticated PATCH/DELETE       | 401                                               |
| IT-06 | forged origin with valid session   | 403                                               |
| IT-07 | upload final image mock            | returns explicit `mode:mock`, no fake Google link |
| IT-08 | Drive permission create fails      | result is failure, no QR                          |
| IT-09 | Drive list fails                   | user-friendly retry response                      |
| IT-10 | overlay URL for arbitrary file ID  | rejected                                          |
| IT-11 | overlay edit preserves old version | existing render URL valid                         |
| IT-12 | admin logout                       | mutating route denied                             |

## 4. End-to-end UI scenarios

**E2E-01 Guest:** landing → frame gallery → klik gambar frame tiga slot → synthetic camera → 3 captures → retake photo 3 → preview composite → local PNG export → mock upload demo result. In real Drive mode, validated response shows QR link.

**E2E-02 Admin:** login → add frame → upload PNG valid 1200x3600 → add/position 4 slots → preview → save draft → publish → see frame public → unpublish → public frame absent.

**E2E-03 Negative:** camera denied → panduan izin dan retry kamera, tanpa picker foto galeri; invalid overlay → publish blocked; upload fail → no QR + preserved local export; refresh result → no persisted session/QR.

## 5. Manual real Google Drive smoke

After operator has configured OAuth:

- [ ] OAuth refresh flow authorized; no token in browser/network response.
- [ ] `drive:bootstrap` creates folders without duplication.
- [ ] Admin publish frame → JSON+PNG+thumbnail actual files exist in Drive.
- [ ] Frame preview uses private asset proxy, not anyone sharing of entire frames folder.
- [ ] Guest final image is exactly one file and matches preview.
- [ ] File share permission explicitly `anyone:reader` for final photo only.
- [ ] Link/QR opens on a different device without login (incognito).
- [ ] Copy link / open link / download local controls work.
- [ ] Closing/reloading page loses QR but file still exists in Drive.
- [ ] Capacity/permission error yields clear recoverable UI and no bogus QR.

## 6. UX checks

- [ ] Desktop Chrome + Firefox, mobile viewport, actual iOS Safari and Android Chrome when available.
- [ ] No camera access without action; permission denial handled.
- [ ] Focus ring, keyboard navigation and accessible labels.
- [ ] No console errors, unhandled promise rejections or leaking secrets.
- [ ] Mobile layout not horizontally clipped, buttons reachable.
- [ ] Filter/edit preview equals export; photo slot order consistent.
- [ ] Admin editing slot drag and numeric controls usable.
- [ ] After user photo render, CameraStream tracks stopped when no longer needed.

## 7. Reporting expectations

Codex must create `docs/IMPLEMENTATION_STATUS.md` as implementation proceeds and include:

```markdown
## Implemented

- ...

## Tests executed

- npm run lint — PASS/FAIL and reason
- npm run typecheck — ...
- npm test — ...
- npm run build — ...

## Manual tests pending

- Google Drive real credentials not provided; incognito link check pending

## Known limitations

- ...
```

Never claim `live Drive smoke passed` without actual configuration and observed output.
