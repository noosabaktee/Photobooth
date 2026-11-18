# 03 — Frame template schema & renderer specification

## 1. Core idea

Admin brings an original **transparent PNG overlay** containing decorative borders and transparent photo holes. Photos are drawn in designated areas behind the overlay. Each frame can have 1–6 slots (vertical stack or grid). A JSON config contains slot positions; no database needed.

Example JSON is in `../examples/frame-template.example.json`. The JSON should be validated via Zod with explicit schema version.

## 2. Canonical data model (v1)

```ts
type FrameTemplate = {
  schemaVersion: 1;
  id: string; // uuid; immutable
  name: string; // max 80 chars
  slug: string; // for display / lookup
  category: "pastel" | "vintage" | "birthday" | "event" | "minimal" | "other";
  tags: string[]; // sanitized, max 10
  status: "draft" | "published" | "archived";
  dimensions: { width: number; height: number }; // integer, e.g. 1200 x 3600
  revision: number; // increment on edits
  overlay: {
    fileId: string; // Google Drive file ID
    mimeType: "image/png";
    version: number;
  };
  thumbnail: { fileId: string; mimeType: "image/webp" } | null;
  slots: Array<{
    id: string;
    order: number; // unique 0..N-1
    x: number;
    y: number; // normalized [0,1)
    width: number;
    height: number; // normalized (0,1]
    borderRadius?: number; // normalized optional (e.g. 0.015)
    cropPosition?: { x: number; y: number }; // default {x:0.5,y:0.5}
  }>;
  createdAt: string; // ISO timestamp
  updatedAt: string;
};
```

**Exposed public fields:** `id`, `name`, `category`, `tags`, `dimensions`, `slots`, `overlayUrl` (same-origin proxy), `thumbnailUrl`, `revision`, display-only. No admin-only draft fields or OAuth tokens. `fileId` internally may stay server-only.

## 3. Validation rules

- Max 1–6 slots, slot IDs distinct; order continuous from 0 to N-1.
- `x>=0`, `y>=0`, `width>0`, `height>0`, `x+width<=1`, `y+height<=1` with epsilon `1e-6` for float rounding.
- No overlap among slots by default (tiny <1px overlaps allowed as tolerance). Permit explicit overlap only as documented future feature.
- Dimensions aspect ratio not extreme: max width/height design boundaries and output max pixel count (e.g. <= 30 MP). Default 1200×3600, optional 1800×5400.
- PNG overlay must have alpha channel, file size under configured limit (e.g. 8 MB), valid dimensions equal template dimensions. Reject if no real transparency inside slot areas, or warn and block publish if photo would be invisible.
- `slug` normalized, no path segments or code; names/tags safely escaped in React.
- New frame initial status always `draft`; publish requires complete valid overlay + thumbnail + slots.

## 4. Rendering algorithm

```
1. Create offscreen canvas at frame.dimensions (e.g. 1200×3600).
2. For each slot ordered by capture order:
   a. Convert normalized bbox into pixel coords.
   b. Clip to slot rect / rounded rect.
   c. Calculate cover scaling: scale=max(slotW/imgW,slotH/imgH).
   d. Calculate crop from cropPosition (0..1), center by default.
   e. Apply mirror decision + per-photo filter, then draw image.
3. Draw overlay PNG over ALL photos (full canvas size).
4. Export PNG Blob. Preview must use SAME geometry functions with scaled output.
```

**Tricky details:** front camera mirrored PREVIEW vs final file is user choice; avoid double-mirroring. Use Canvas API transformations in correct order. For overlays, get same-origin blob via approved asset URL to prevent tainted canvas. Never stretch portrait images into frame; crop cover only.

## 5. Example normalized 4-slot vertical strip

For 1200×3600, slots can be:

| Order |    x |     y | width | height |
| ----- | ---: | ----: | ----: | -----: |
| 0     | 0.09 |  0.07 |  0.82 |  0.195 |
| 1     | 0.09 | 0.285 |  0.82 |  0.195 |
| 2     | 0.09 |  0.50 |  0.82 |  0.195 |
| 3     | 0.09 | 0.715 |  0.82 |  0.195 |

Remaining space is used for header/footer decoration. User photographs fill 4 areas, not the whole strip.

## 6. Admin builder UX

- Image upload zone with file type + size instructions.
- Auto-read naturalWidth/naturalHeight from uploaded PNG.
- Overlay preview at sensible fixed aspect width; slots drawn as semi-transparent editable rectangles.
- Drag slot (pointer events), resize 8 handles or corners, keyboard nudge with arrows. Snapping to grid (optional) with toggle.
- Sidebar: editable name, category, tags, add/remove slot, reorder, exact position/size numeric controls, crop position, border radius.
- Validate overlap/out of bounds live; show explicit human-friendly errors.
- `Preview composition` uses generated placeholder portraits/gradients, not real reference people.
- Admin can save draft even if incomplete; cannot publish invalid template.
- Edit existing frame safely: revision, optimistic conflict prompt, asset versioning; old overlay preserved for existing user sessions.

## 7. Template versioning & open sessions

When frame changes from v1 to v2: `v1-overlay.png` remains in Drive. The guest client already selecting v1 can finish. Public gallery shows v2 after cache refresh. Do not delete `v1-overlay.png` immediately. A later cleanup tool can remove old versions after an appropriate retention period.
