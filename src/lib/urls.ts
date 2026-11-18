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

export function driveFolderUrl(
  value: unknown,
  folderId?: string,
): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/drive\/folders\/([A-Za-z0-9_-]+)$/);
    return url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      match &&
      (!folderId || match[1] === folderId)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
