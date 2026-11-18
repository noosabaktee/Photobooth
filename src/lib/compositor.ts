import type { PublicFrame, Slot } from "./schema";
import {
  BOOMERANG_WIDTH,
  BOOMERANG_HEIGHT,
  BOOMERANG_IMAGE_BYTES,
} from "./boomerang";
import { eventIdentity } from "./event";
export type Filter = "natural" | "bw" | "warm" | "cool";
export type Photo = { url: string; mirror: boolean };
export function filterPixel(r: number, g: number, b: number, filter: Filter) {
  if (filter === "bw") {
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [l, l, l];
  }
  if (filter === "warm")
    return [Math.min(255, r * 1.08 + 8), Math.min(255, g * 1.02 + 3), b * 0.88];
  if (filter === "cool")
    return [r * 0.9, Math.min(255, g * 1.02 + 3), Math.min(255, b * 1.1 + 6)];
  return [r, g, b];
}
export function cover(
  iw: number,
  ih: number,
  sw: number,
  sh: number,
  position = { x: 0.5, y: 0.5 },
) {
  const scale = Math.max(sw / iw, sh / ih);
  const width = sw / scale,
    height = sh / scale;
  return {
    sx: (iw - width) * position.x,
    sy: (ih - height) * position.y,
    sw: width,
    sh: height,
  };
}
export function mirroredX(x: number, width: number, mirror: boolean) {
  return mirror ? width - x : x;
}
export function replacePhoto(photos: Photo[], index: number, photo: Photo) {
  return photos.map((p, i) => (i === index ? photo : p));
}
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    image.src = url;
  });
}
export function dummyPhoto(index: number) {
  const colors = [
    "#b6d9cb",
    "#d6c2d8",
    "#f0c6b7",
    "#becbdd",
    "#e2d4a9",
    "#b9d5cc",
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${colors[index % 6]}"/><circle cx="640" cy="130" r="110" fill="#fff8e6"/><path d="M0 680Q190 360 420 640T800 500V800H0" fill="#446c62" opacity=".45"/><path d="M150 390Q150 200 315 210Q470 200 470 390V530H150" fill="#36564f"/><circle cx="310" cy="370" r="118" fill="#f6d4b0"/><circle cx="270" cy="355" r="9" fill="#344b44"/><circle cx="350" cy="355" r="9" fill="#344b44"/><path d="M270 405Q310 440 350 405" stroke="#914d5d" stroke-width="10" fill="none"/><path d="M130 800V650Q130 490 310 490Q500 490 500 650V800" fill="#fff4dc"/><path d="M540 380l20 45 47 5-35 32 10 47-42-23-41 23 9-47-35-32 48-5z" fill="#fff4dc"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
async function preparePhoto(photo: Photo, filter: Filter) {
  const image = await loadImage(photo.url);
  if (filter === "natural")
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, source.width, source.height),
    data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = filterPixel(data[i], data[i + 1], data[i + 2], filter);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  ctx.putImageData(pixels, 0, 0);
  return { source, width: source.width, height: source.height };
}

/** Edited poses for an original vertical video card; camera originals stay in the browser. */
export async function exportBoomerangFrames(
  frame: PublicFrame,
  photos: Photo[],
  filter: Filter,
) {
  if (
    photos.length !== frame.slots.length ||
    photos.length < 1 ||
    photos.length > 6
  )
    throw new Error("Lengkapi semua foto sebelum membuat video.");
  await document.fonts.ready;
  const output: Blob[] = [];
  for (const slot of [...frame.slots].sort((a, b) => a.order - b.order)) {
    const photo = photos[slot.order],
      image = await preparePhoto(photo, filter);
    const canvas = document.createElement("canvas");
    canvas.width = BOOMERANG_WIDTH;
    canvas.height = BOOMERANG_HEIGHT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#edf5ec";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#124d36";
    ctx.fillRect(0, 0, canvas.width, 228);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 64px sans-serif";
    ctx.fillText(eventIdentity.name, 540, 110);
    ctx.font = "28px sans-serif";
    ctx.fillText(eventIdentity.company, 540, 169);
    // Keep a generous portrait photo area; never stretch the camera image.
    drawSlot(
      ctx,
      {
        ...slot,
        x: 36 / 1080,
        y: 270 / 1920,
        width: 1008 / 1080,
        height: 1344 / 1920,
        borderRadius: 0.025,
      },
      image.source,
      image.width,
      image.height,
      photo.mirror,
      canvas.width,
      canvas.height,
    );
    ctx.fillStyle = "#124d36";
    ctx.font = "700 42px sans-serif";
    ctx.fillText(eventIdentity.tagline, 540, 1735);
    ctx.font = "26px sans-serif";
    ctx.fillText("HOYA-HOYA MEMORIES · KMI", 540, 1810);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Foto video tidak dapat dibuat.")),
        "image/jpeg",
        0.92,
      ),
    );
    if (blob.size > BOOMERANG_IMAGE_BYTES)
      throw new Error(
        "Foto video terlalu besar. Gunakan resolusi kamera lebih kecil.",
      );
    output.push(blob);
  }
  return output;
}
export async function drawComposition(
  canvas: HTMLCanvasElement,
  frame: Pick<PublicFrame, "dimensions" | "slots">,
  overlayUrl: string,
  photos: Photo[],
  filter: Filter = "natural",
  previewWidth?: number,
) {
  const overlay = await loadImage(overlayUrl);
  const images = await Promise.all(photos.map((p) => preparePhoto(p, filter)));
  const scale = previewWidth ? previewWidth / frame.dimensions.width : 1;
  canvas.width = Math.round(frame.dimensions.width * scale);
  canvas.height = Math.round(frame.dimensions.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Browser tidak mendukung canvas.");
  context.fillStyle = "#fff9f0";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const slot of [...frame.slots].sort((a, b) => a.order - b.order)) {
    const photo = photos[slot.order],
      image = images[slot.order];
    if (!photo || !image) continue;
    drawSlot(
      context,
      slot,
      image.source,
      image.width,
      image.height,
      photo.mirror,
      canvas.width,
      canvas.height,
    );
  }
  context.drawImage(overlay, 0, 0, canvas.width, canvas.height);
}
function drawSlot(
  context: CanvasRenderingContext2D,
  slot: Slot,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  mirror: boolean,
  width: number,
  height: number,
) {
  const x = slot.x * width,
    y = slot.y * height,
    w = slot.width * width,
    h = slot.height * height;
  context.save();
  context.beginPath();
  context.roundRect(
    x,
    y,
    w,
    h,
    Math.min((slot.borderRadius || 0) * width, w / 2, h / 2),
  );
  context.clip();
  context.translate(x + mirroredX(0, w, mirror), y);
  if (mirror) context.scale(-1, 1);
  const crop = cover(imageWidth, imageHeight, w, h, slot.cropPosition);
  context.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, w, h);
  context.restore();
}
export async function exportComposition(
  frame: PublicFrame,
  overlayUrl: string,
  photos: Photo[],
  filter: Filter,
) {
  const canvas = document.createElement("canvas");
  await drawComposition(canvas, frame, overlayUrl, photos, filter);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG tidak dapat dibuat.")),
      "image/png",
    ),
  );
}
