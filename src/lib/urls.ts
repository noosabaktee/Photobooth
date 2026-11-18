export function driveViewUrl(value: unknown, fileId?: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)\/view$/);
    return url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      match &&
      (!fileId || match[1] === fileId)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
