import sharp from "sharp";
import type { Draft } from "./schema";
import { dummyPhoto } from "./compositor";
import { printPreview } from "./print-photo";
import { selectedStarterStyle } from "./starter-artwork";

export async function renderFramePreview(frame: Draft, overlay: Buffer) {
  const { width, height } = frame.dimensions;
  const portraits = (
    await Promise.all(
      frame.slots.map(async (s, i) => {
        const x = s.x * width,
          y = s.y * height,
          w = s.width * width,
          h = s.height * height;
        const svg = decodeURIComponent(dummyPhoto(i).split(",")[1]);
        const raster = await sharp(Buffer.from(svg))
          .resize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
            fit: "cover",
          })
          .png()
          .toBuffer();
        const image = `data:image/png;base64,${raster.toString("base64")}`;
        return `<defs><clipPath id="slot-${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${(s.borderRadius || 0) * width}"/></clipPath></defs><image href="${image}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#slot-${i})"/>`;
      }),
    )
  ).join("");
  const composition = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff9f0"/>${portraits}</svg>`,
    ),
  )
    .composite([{ input: overlay, left: 0, top: 0 }])
    .png()
    .toBuffer();
  return printPreview(composition, {
    dimensions: frame.dimensions,
    starterStyle: selectedStarterStyle(frame),
    photoBottom: Math.min(
      height,
      Math.ceil(
        Math.max(0, ...frame.slots.map((s) => s.y + s.height)) * height,
      ),
    ),
  });
}
