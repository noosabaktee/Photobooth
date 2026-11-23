// Deterministic application asset build: original PNGs are retained as source atlases.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import original from "../examples/starter-frames/original-layouts.json" with { type: "json" };
import { draftSchema, type Slot } from "../src/lib/schema";
import { validateAlpha, validateImage } from "../src/lib/uploads";
import { eventIdentity } from "../src/lib/event";
import {
  starterBackdrop,
  starterPalette,
  type StarterStyle,
} from "../src/lib/starter-artwork";
const root = path.join(process.cwd(), "examples/starter-frames");
type Seed = (typeof original.frames)[number];
type ThreeShotSeed = Omit<Seed, "slots"> & {
  slots: Slot[];
  replacesSeedId: string;
};
const frames: ThreeShotSeed[] = [];
for (const source of original.frames) {
  const input = await readFile(path.join(root, source.overlayPath));
  const width = source.dimensions.width;
  let height: number, slots: Slot[], overlay: Buffer;
  if (source.slots.length === 4) {
    const oldHeight = source.dimensions.height;
    const pitch = Math.round(
      (source.slots[3].y - source.slots[2].y) * oldHeight,
    );
    const gap =
      (source.slots[3].y - source.slots[2].y - source.slots[2].height) *
      oldHeight;
    const seam = Math.round(
      (source.slots[2].y + source.slots[2].height) * oldHeight + gap / 2,
    );
    height = oldHeight - pitch;
    const top = await sharp(input)
      .extract({ left: 0, top: 0, width, height: seam })
      .png()
      .toBuffer();
    const footer = await sharp(input)
      .extract({
        left: 0,
        top: seam + pitch,
        width,
        height: oldHeight - seam - pitch,
      })
      .png()
      .toBuffer();
    overlay = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: top, left: 0, top: 0 },
        { input: footer, left: 0, top: seam },
      ])
      .png()
      .toBuffer();
    slots = source.slots.slice(0, 3).map((slot, order) => ({
      ...slot,
      order,
      y: (slot.y * oldHeight) / height,
      height: (slot.height * oldHeight) / height,
    }));
  } else {
    height = 2700;
    const sample = await sharp(input)
      .extract({ left: 600, top: 220, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer();
    const color = `rgb(${sample[0]},${sample[1]},${sample[2]})`;
    slots = [340, 1020, 1700].map((y, order) => ({
      id: `slot-${order + 1}`,
      order,
      x: 90 / width,
      y: y / height,
      width: 1020 / width,
      height: 600 / height,
      borderRadius: 20 / width,
      cropPosition: { x: 0.5, y: 0.5 },
    }));
    const rects = slots
      .map(
        (s) =>
          `<rect x="${s.x * width}" y="${s.y * height}" width="${s.width * width}" height="${s.height * height}" rx="20"/>`,
      )
      .join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><mask id="holes"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects}</g></mask></defs><g mask="url(#holes)"><rect width="100%" height="100%" fill="${color}"/><rect x="32" y="32" width="1136" height="2636" rx="36" fill="none" stroke="#9ac5b8" stroke-width="7"/></g><g fill="none" stroke="#a4ccc0" stroke-width="5">${rects}</g></svg>`;
    const header = await sharp(input)
      .extract({ left: 0, top: 0, width, height: 250 })
      .png()
      .toBuffer();
    const footer = await sharp(input)
      .extract({ left: 0, top: 1740, width, height: 360 })
      .png()
      .toBuffer();
    const caption = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="250"><rect x="300" y="150" width="600" height="65" fill="${color}"/><text x="600" y="196" text-anchor="middle" font-family="sans-serif" font-size="31" fill="#58847b">three little moments</text></svg>`,
    );
    overlay = await sharp(Buffer.from(svg))
      .composite([
        { input: header, left: 0, top: 0 },
        { input: caption, left: 0, top: 0 },
        { input: footer, left: 0, top: height - 360 },
      ])
      .png()
      .toBuffer();
  }
  // Event signature stays wholly below the photo slots, leaving every photo unobstructed.
  const footerTop =
    Math.ceil(Math.max(...slots.map((s) => s.y + s.height)) * height) + 20;
  const footerHeight = height - footerTop;
  const headerHeight = Math.floor(Math.min(...slots.map((s) => s.y)) * height);
  const vintage = source.category === "vintage";
  const headerFill = vintage
    ? "#32352f"
    : source.category === "pastel"
      ? "#f9e0e8"
      : "#dff4e9";
  const headerInk = vintage
    ? "#f8e9c8"
    : source.category === "pastel"
      ? "#9a4964"
      : "#287569";
  const style: StarterStyle = vintage
    ? "film"
    : source.category === "pastel"
      ? "gingham"
      : "mint";
  const footerBackground = await sharp(
    Buffer.from(starterBackdrop(style, width, height)),
  )
    .extract({ left: 0, top: footerTop, width, height: footerHeight })
    .png()
    .toBuffer();
  const eventHeader = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x="${width * 0.17}" y="${headerHeight * 0.17}" width="${width * 0.66}" height="${headerHeight * 0.67}" rx="12" fill="${headerFill}"/><text x="${width / 2}" y="${headerHeight * 0.53}" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.min(width * 0.06, headerHeight * 0.29)}" fill="${headerInk}">HOYA-HOYA DAYS</text><text x="${width / 2}" y="${headerHeight * 0.73}" text-anchor="middle" font-family="sans-serif" font-size="${headerHeight * 0.1}" fill="${headerInk}">KMI PHOTOBOOTH</text></svg>`,
  );
  const eventSignature = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g text-anchor="middle" font-family="sans-serif" fill="${starterPalette[style].ink}"><text x="${width / 2}" y="${footerTop + footerHeight * 0.4}" font-size="${Math.min(width * 0.06, footerHeight * 0.27)}" font-weight="bold">${eventIdentity.name}</text><text x="${width / 2}" y="${footerTop + footerHeight * 0.62}" font-size="${Math.min(width * 0.027, footerHeight * 0.15)}">${eventIdentity.company}</text><text x="${width / 2}" y="${footerTop + footerHeight * 0.8}" font-size="${Math.min(width * 0.023, footerHeight * 0.13)}">${eventIdentity.tagline}</text></g></svg>`,
  );
  overlay = await sharp(overlay)
    .composite([
      { input: eventHeader, left: 0, top: 0 },
      { input: footerBackground, left: 0, top: footerTop },
      { input: eventSignature, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  const basename = source.overlayPath.replace(/-(4|6)\.png$/, "-3");
  const seed: ThreeShotSeed = {
    ...source,
    id: source.id.replace(/-(4|6)$/, "-3"),
    name: source.name.replace(" Six", ""),
    dimensions: { width, height },
    overlayPath: `${basename}.png`,
    thumbnailPath: `${basename}-preview.jpg`,
    slots,
    replacesSeedId: source.id,
  };
  draftSchema.parse(seed);
  await validateImage(overlay, "image/png", true);
  await validateAlpha(overlay, slots);
  await writeFile(path.join(root, seed.overlayPath), overlay);
  const colors = ["#d8d7f2", "#f6dbe3", "#d9eee7"];
  const portraits = slots
    .map((s, i) => {
      const x = s.x * width,
        y = s.y * height,
        w = s.width * width,
        h = s.height * height,
        r = (s.borderRadius || 0) * width;
      return `<defs><clipPath id="p${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs><g clip-path="url(#p${i})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[i]}"/><g fill="#506f68" opacity=".65"><circle cx="${x + w / 2}" cy="${y + h * 0.37}" r="${Math.min(w, h) * 0.17}"/><ellipse cx="${x + w / 2}" cy="${y + h * 0.85}" rx="${w * 0.27}" ry="${h * 0.31}"/></g><text x="${x + w / 2}" y="${y + h * 0.95}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(w * 0.045)}" fill="#35564e">PHOTO ${i + 1}</text></g>`;
    })
    .join("");
  const preview = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff9f0"/>${portraits}</svg>`,
    ),
  )
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(preview)
    .resize({ width: 360 })
    .jpeg({ quality: 90 })
    .toFile(path.join(root, seed.thumbnailPath));
  frames.push(seed);
  console.log(`${seed.name}: 3 photos, ${width}×${height}, alpha validated`);
}
await writeFile(
  path.join(root, "starter-frames.json"),
  JSON.stringify(
    {
      purpose:
        "Active three-photo demo variants, derived deterministically from preserved original assets. NOT Google Drive FrameTemplate JSON.",
      frames,
    },
    null,
    2,
  ) + "\n",
);
