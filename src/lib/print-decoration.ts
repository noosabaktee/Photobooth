import { eventIdentity } from "./event";
import { starterPalette, type StarterStyle } from "./starter-artwork";

// Shared SVG decoration keeps browser pending previews and server print output aligned.
export function printMarker(size: number, ink: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect x="12" y="12" width="${size - 24}" height="${size - 24}" rx="12" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="12 10"/><g fill="${ink}" font-family="sans-serif" text-anchor="middle"><text x="${size / 2}" y="${size * 0.48}" font-size="${size * 0.1}" font-weight="bold">AREA QR</text><text x="${size / 2}" y="${size * 0.61}" font-size="${size * 0.05}">Muncul setelah foto</text></g></svg>`;
}

export function printLabel(
  width: number,
  height: number,
  qrBox: number,
  pad: number,
  ink: string,
) {
  const x = qrBox + pad * 2;
  const font = Math.max(9, Math.round(width * 0.026));
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g fill="${ink}" font-family="sans-serif" font-size="${font}"><text x="${x}" y="${height * 0.38}" font-weight="bold">SCAN QR</text><text x="${x}" y="${height * 0.5}">Kolase + video</text><text x="${x}" y="${height * 0.68}" font-size="${font * 0.7}">Simpan kenanganmu</text><text x="${x}" y="${height * 0.77}" font-size="${font * 0.6}">Hoya-Hoya Days</text></g></svg>`;
}

export function printTitle(
  width: number,
  height: number,
  cut: number,
  footerHeight: number,
  style: StarterStyle,
) {
  const titleHeight = height - cut;
  const font = Math.max(10, Math.min(width * 0.06, titleHeight * 0.28));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + footerHeight}"><g text-anchor="middle" font-family="sans-serif" fill="${starterPalette[style].ink}"><text x="${width / 2}" y="${cut + titleHeight * 0.43}" font-weight="bold" font-size="${font}">${eventIdentity.name}</text><text x="${width / 2}" y="${cut + titleHeight * 0.7}" font-size="${font * 0.42}">${eventIdentity.company}</text></g></svg>`;
}
