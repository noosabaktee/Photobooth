// Shared limits keep browser rendering, encoder and upload validation in sync.
export const BOOMERANG_WIDTH = 1440;
export const BOOMERANG_HEIGHT = 1080;
export const BOOMERANG_FPS = 30;
export const BOOMERANG_SECONDS = 6;
export const BOOMERANG_IMAGE_BYTES = 2 * 1024 * 1024;
export const BOOMERANG_VIDEO_BYTES = 16 * 1024 * 1024;
export function slideshowOrder(count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 6)
    throw new Error("Video memerlukan 1–6 foto.");
  // One photo per second, always forward; three photos play twice in six seconds.
  return Array.from(
    { length: BOOMERANG_SECONDS },
    (_, second) => second % count,
  );
}
