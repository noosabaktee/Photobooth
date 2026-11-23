import sharp from "sharp";
import QRCode from "qrcode";
import { driveFolderUrl } from "./urls";
import { fail } from "./errors";
import { validateImage } from "./uploads";
import {
  printGeometry,
  printLayoutSchema,
  type PrintLayout,
} from "./print-layout";
import { starterBackdrop, starterPalette } from "./starter-artwork";
import { printLabel, printMarker, printTitle } from "./print-decoration";

// Continue a flat footer band and move its original bottom cap below the QR.
// Search only below the captured slots; custom edge-to-edge layouts append safely.
async function footerBand(
  bytes: Buffer,
  width: number,
  height: number,
  layout?: PrintLayout,
) {
  const start = layout
    ? Math.max(layout.photoBottom, Math.floor(height * 0.88))
    : height - 1;
  const top = Math.min(start, height - 1);
  const pixels = await sharp(bytes)
    .extract({ left: 0, top, width, height: height - top })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const colorAt = (x: number, y: number) =>
    pixels.readUIntBE((y * width + x) * 3, 3);
  const center = Math.floor(width / 2);
  const edgeColor = colorAt(center, height - top - 1);
  let row = height - top - 1,
    widest = 0;
  for (let y = 0; y < height - top; y++) {
    const color = colorAt(center, y);
    if (color === edgeColor) continue;
    let left = center,
      right = center;
    while (left > 0 && colorAt(left - 1, y) === color) left--;
    while (right < width - 1 && colorAt(right + 1, y) === color) right++;
    const span = right - left + 1;
    if (span >= width * 0.7 && span >= widest) {
      widest = span;
      row = y;
    }
  }
  return {
    seam: widest ? top + row + 1 : height,
    row: top + row,
    color: colorAt(center, row),
  };
}

// QR spaces/quiet zone use the exact frame color, without a separate card.
// Light modules on dark frames, dark modules on light frames maximize contrast.
export async function printPhoto(
  bytes: Buffer,
  folderUrl: string,
  layout?: PrintLayout,
) {
  if (!driveFolderUrl(folderUrl))
    fail(400, "INVALID_DRIVE_LINK", "Link folder tidak valid.");
  return renderPrint(bytes, folderUrl, layout);
}

// An explicitly non-scannable marker, never a fabricated Drive destination.
export async function printPreview(bytes: Buffer, layout?: PrintLayout) {
  return renderPrint(bytes, null, layout);
}

async function renderPrint(
  bytes: Buffer,
  folderUrl: string | null,
  layout?: PrintLayout,
) {
  const meta = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
  const width = meta.width!,
    height = meta.height!;
  if (layout) {
    printLayoutSchema.parse(layout);
    if (
      layout.dimensions.width !== width ||
      layout.dimensions.height !== height
    )
      fail(
        400,
        "VALIDATION_ERROR",
        "Dimensi layout cetak tidak cocok dengan kolase.",
      );
  }
  const { qrBox, pad, footerHeight } = printGeometry(
    width,
    layout?.starterStyle,
  );
  const modules = folderUrl
    ? QRCode.create(folderUrl, { errorCorrectionLevel: "M" }).modules.size + 8
    : 49;
  const qrSize = modules * Math.max(1, Math.floor(qrBox / modules));
  if (
    qrSize > qrBox ||
    qrBox + pad * 2 >= width ||
    height + footerHeight > 8000 ||
    width * (height + footerHeight) > 30_000_000
  )
    fail(
      400,
      "PRINT_SIZE_LIMIT",
      "Frame terlalu besar untuk footer QR. Gunakan frame lebih kecil.",
    );
  const style = layout?.starterStyle;
  const band = style
    ? {
        seam: height,
        row: height - 1,
        color: parseInt(starterPalette[style].background.slice(1), 16),
      }
    : await footerBand(bytes, width, height, layout);
  const channels = [
    (band.color >> 16) & 255,
    (band.color >> 8) & 255,
    band.color & 255,
  ];
  const luminance = channels.reduce((sum, c, i) => {
    const v = c / 255;
    return (
      sum +
      (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][i]
    );
  }, 0);
  const background = `#${band.color.toString(16).padStart(6, "0")}`;
  const ink = luminance > 0.45 ? "#17334d" : "#ffffff";
  const qr = folderUrl
    ? await QRCode.toBuffer(folderUrl, {
        type: "png",
        width: qrSize,
        margin: 4,
        errorCorrectionLevel: "M",
        color: {
          dark: luminance > 0.179 ? "#000000" : "#ffffff",
          light: style ? "#00000000" : background,
        },
      })
    : await sharp(Buffer.from(printMarker(qrSize, ink)))
        .png()
        .toBuffer();
  const label = Buffer.from(printLabel(width, footerHeight, qrBox, pad, ink));
  if (style && layout) {
    // Replace the OLD green signature below the slots as well as the new QR area.
    // This also fixes already-imported Drive overlays without overwriting photos.
    const cut = Math.min(height, layout.photoBottom + 20);
    const title = Buffer.from(
      printTitle(width, height, cut, footerHeight, style),
    );
    const output = await sharp(
      Buffer.from(starterBackdrop(style, width, height + footerHeight)),
    )
      .composite([
        {
          input: await sharp(bytes)
            .extract({ left: 0, top: 0, width, height: cut })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
        { input: title, left: 0, top: 0 },
        { input: qr, left: pad, top: height + pad },
        { input: label, left: 0, top: height },
      ])
      .png()
      .toBuffer();
    await validateImage(output, "image/png");
    return output;
  }
  const footer = await sharp(bytes)
    .extract({ left: 0, top: band.row, width, height: 1 })
    .resize(width, footerHeight, { kernel: "nearest", fit: "fill" })
    .composite([
      { input: qr, left: pad, top: pad },
      { input: label, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  const top = await sharp(bytes)
    .extract({ left: 0, top: 0, width, height: band.seam })
    .png()
    .toBuffer();
  const layers = [
    { input: top, left: 0, top: 0 },
    { input: footer, left: 0, top: band.seam },
  ];
  if (band.seam < height)
    layers.push({
      input: await sharp(bytes)
        .extract({ left: 0, top: band.seam, width, height: height - band.seam })
        .png()
        .toBuffer(),
      left: 0,
      top: band.seam + footerHeight,
    });
  const output = await sharp({
    create: { width, height: height + footerHeight, channels: 4, background },
  })
    .composite(layers)
    .png()
    .toBuffer();
  await validateImage(output, "image/png");
  return output;
}
