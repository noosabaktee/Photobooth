import { loadImage } from "./compositor";
import { printGeometry, type PrintLayout } from "./print-layout";
import { printLabel, printMarker, printTitle } from "./print-decoration";
import { starterBackdrop, starterPalette } from "./starter-artwork";

// Memory-only preview. Raw composition stays separate for the final server stamp.
// No extra request, persisted photo or fabricated QR is needed while uploading.
export async function exportPrintPreview(url: string, layout: PrintLayout) {
  const image = await loadImage(url);
  const { width, height } = layout.dimensions;
  const style = layout.starterStyle;
  const { qrBox, pad, footerHeight } = printGeometry(width, style);
  if (
    height + footerHeight > 8000 ||
    width * (height + footerHeight) > 30_000_000
  )
    throw new Error(
      "Frame terlalu besar untuk footer QR. Gunakan frame lebih kecil.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height + footerHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Browser tidak mendukung canvas.");
  const svg = (source: string) =>
    loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`);
  let color: number,
    seam = height;
  if (style) {
    color = parseInt(starterPalette[style].background.slice(1), 16);
    ctx.drawImage(
      await svg(starterBackdrop(style, width, canvas.height)),
      0,
      0,
    );
    const cut = Math.min(height, layout.photoBottom + 20);
    ctx.drawImage(image, 0, 0, width, cut, 0, 0, width, cut);
    ctx.drawImage(
      await svg(printTitle(width, height, cut, footerHeight, style)),
      0,
      0,
    );
  } else {
    // Same flat-band continuation as print-photo for custom uploaded overlays.
    ctx.drawImage(image, 0, 0);
    const top = Math.min(
      Math.max(layout.photoBottom, Math.floor(height * 0.88)),
      height - 1,
    );
    const pixels = ctx.getImageData(0, top, width, height - top).data;
    const at = (x: number, y: number) => {
      const offset = (y * width + x) * 4;
      return (
        (pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2]
      );
    };
    const center = Math.floor(width / 2),
      edge = at(center, height - top - 1);
    let row = height - top - 1,
      widest = 0;
    for (let y = 0; y < height - top; y++) {
      const value = at(center, y);
      if (value === edge) continue;
      let left = center,
        right = center;
      while (left > 0 && at(left - 1, y) === value) left--;
      while (right < width - 1 && at(right + 1, y) === value) right++;
      const span = right - left + 1;
      if (span >= width * 0.7 && span >= widest) {
        widest = span;
        row = y;
      }
    }
    color = at(center, row);
    if (widest) seam = top + row + 1;
    ctx.clearRect(0, seam, width, canvas.height - seam);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, 0, top + row, width, 1, 0, seam, width, footerHeight);
    ctx.imageSmoothingEnabled = true;
    if (seam < height)
      ctx.drawImage(
        image,
        0,
        seam,
        width,
        height - seam,
        0,
        seam + footerHeight,
        width,
        height - seam,
      );
  }
  const luminance = [
    (color >> 16) & 255,
    (color >> 8) & 255,
    color & 255,
  ].reduce((sum, c, i) => {
    const value = c / 255;
    return (
      sum +
      (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
        [0.2126, 0.7152, 0.0722][i]
    );
  }, 0);
  const ink = luminance > 0.45 ? "#17334d" : "#ffffff";
  const markerSize = 49 * Math.max(1, Math.floor(qrBox / 49));
  ctx.drawImage(await svg(printMarker(markerSize, ink)), pad, seam + pad);
  ctx.drawImage(
    await svg(printLabel(width, footerHeight, qrBox, pad, ink)),
    0,
    seam,
  );
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Preview PNG tidak dapat dibuat.")),
      "image/png",
    ),
  );
}
