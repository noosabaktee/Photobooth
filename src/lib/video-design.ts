import { starterPalette, type StarterStyle } from "./starter-artwork";
import { eventIdentity } from "./event";
import { BOOMERANG_WIDTH, BOOMERANG_HEIGHT } from "./boomerang";
import type { PublicFrame, Slot } from "./schema";

export const videoLayout = {
  width: BOOMERANG_WIDTH,
  height: BOOMERANG_HEIGHT,
  photo: { x: 64, y: 48, width: 1312, height: 776 },
  qrRegion: { left: 0, top: 848, width: BOOMERANG_WIDTH, height: 232 },
  qrBox: 192,
  qrX: 1184,
  qrY: 856,
} as const;

type PhotoArea = { x: number; y: number; width: number; height: number };

// Slot coordinates are normalized against the whole portrait template. Convert
// them to pixels before calculating aspect; normalized width/height alone lie.
export function videoPhotoArea(
  frame: Pick<PublicFrame, "dimensions">,
  slot: Pick<Slot, "width" | "height">,
): PhotoArea {
  const bounds = videoLayout.photo;
  const ratio =
    (slot.width * frame.dimensions.width) /
    (slot.height * frame.dimensions.height);
  const width = Math.min(bounds.width, bounds.height * ratio);
  const height = width / ratio;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}

export function videoArtwork(
  style: StarterStyle = "mint",
  withQr = false,
  photo: PhotoArea = videoLayout.photo,
) {
  const { width, height } = videoLayout;
  const { background, ink } = starterPalette[style];
  // Native landscape artwork: small edge details rather than stretching the
  // portrait strip's perforations/borders into oversized side gutters.
  const texture =
    style === "gingham"
      ? `<defs><pattern id="video-gingham" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="${background}"/><path d="M0 0h24v24H0zM24 24h24v24H24z" fill="#f7d2df"/></pattern></defs><rect width="${width}" height="${height}" fill="url(#video-gingham)"/>`
      : "";
  const edges =
    style === "film"
      ? `<g fill="${ink}" opacity=".7">${Array.from({ length: 13 }, (_, i) => `<rect x="22" y="${60 + i * 58}" width="14" height="28" rx="4"/><rect x="1404" y="${60 + i * 58}" width="14" height="28" rx="4"/>`).join("")}</g>`
      : `<rect x="24" y="24" width="1392" height="1032" rx="24" fill="none" stroke="${style === "gingham" ? "#ffffff" : "#9ac5b8"}" stroke-width="2" opacity=".7"/>`;
  const matte = style === "film" ? "#e3d9bc" : "#ffffff";
  const qrCopy = withQr
    ? `<text x="1136" y="918" font-size="22" font-weight="700" letter-spacing="1">SCAN &amp; SIMPAN</text><text x="1136" y="956" font-size="23">Kolase + video</text>`
    : `<text x="1376" y="918" font-size="22" font-weight="700" letter-spacing="2">PHOTOBOOTH</text><text x="1376" y="956" font-size="23">Kolase + video</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${background}"/>${texture}${edges}<rect x="${photo.x - 6}" y="${photo.y - 6}" width="${photo.width + 12}" height="${photo.height + 12}" rx="26" fill="${matte}"/><g fill="${ink}"><text x="64" y="884" font-family="sans-serif" font-size="21" letter-spacing="2">${eventIdentity.company.toUpperCase()}</text><text x="60" y="960" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="700" letter-spacing="-1.5">${eventIdentity.name}</text><text x="64" y="1003" font-family="sans-serif" font-size="25" letter-spacing=".3">${eventIdentity.tagline}</text><g font-family="sans-serif" text-anchor="end">${qrCopy}</g></g></svg>`;
}
