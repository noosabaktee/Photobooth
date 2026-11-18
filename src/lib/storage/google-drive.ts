import { drive_v3 } from "googleapis/build/src/apis/drive/v3.js";
import { OAuth2Client } from "google-auth-library";
import { Readable } from "node:stream";
import { fail } from "../errors";
import { driveViewUrl, driveFolderUrl } from "../urls";
import type { Backend, Folder, StoredFile } from "./backend";

export function oauthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    fail(503, "DRIVE_NOT_CONFIGURED", "OAuth Google belum dikonfigurasi.");
  const auth = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
      "http://localhost:3847/oauth2callback",
  );
  if (process.env.GOOGLE_REFRESH_TOKEN)
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}
export function driveClient() {
  return new drive_v3.Drive({ auth: oauthClient() });
}
export async function retry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const code = Number(
        (error as { code?: unknown; response?: { status?: number } }).response
          ?.status || (error as { code?: unknown }).code,
      );
      if (attempt >= 2 || !(code === 429 || (code >= 500 && code <= 599)))
        throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 100),
      );
    }
  }
}
export class GoogleDriveBackend implements Backend {
  private client: drive_v3.Drive;
  private auth: OAuth2Client | null;
  constructor(client?: drive_v3.Drive, auth?: OAuth2Client) {
    this.auth = auth || (client ? null : oauthClient());
    this.client = client || new drive_v3.Drive({ auth: this.auth! });
  }
  private folder(kind: Folder) {
    const value =
      process.env[
        kind === "frames"
          ? "GOOGLE_DRIVE_FRAMES_FOLDER_ID"
          : "GOOGLE_DRIVE_PHOTOS_FOLDER_ID"
      ];
    if (!value || !/^[\w-]+$/.test(value))
      fail(
        503,
        "DRIVE_NOT_CONFIGURED",
        "Folder Drive belum dikonfigurasi. Jalankan drive:bootstrap.",
      );
    return value;
  }
  async list(folder: Folder) {
    const files: StoredFile[] = [];
    let pageToken: string | undefined;
    do {
      const result = await retry(() =>
        this.client.files.list({
          q: `'${this.folder(folder)}' in parents and trashed = false and mimeType = 'application/json'`,
          fields: "nextPageToken,files(id,name,mimeType)",
          pageSize: 100,
          pageToken,
        }),
      );
      for (const file of result.data.files || [])
        if (file.id && file.name && file.mimeType)
          files.push({ id: file.id, name: file.name, mimeType: file.mimeType });
      pageToken = result.data.nextPageToken || undefined;
      if (files.length > 500)
        fail(
          503,
          "COLLECTION_LIMIT",
          "Koleksi frame melebihi batas 500. Hubungi operator.",
        );
    } while (pageToken);
    return files;
  }
  async read(id: string) {
    const response = await retry(() =>
      this.client.files.get(
        { fileId: id, alt: "media" },
        {
          responseType: "arraybuffer",
          maxContentLength: 9 * 1024 * 1024,
          timeout: 30000,
        },
      ),
    );
    return Buffer.from(response.data as ArrayBuffer);
  }
  async create(folder: Folder, name: string, mimeType: string, bytes: Buffer) {
    return this.createInFolder(this.folder(folder), name, mimeType, bytes);
  }
  async createFolder(folder: Folder, name: string) {
    const id = (
      await retry(() =>
        this.client.files.generateIds({ count: 1, space: "drive" }),
      )
    ).data.ids?.[0];
    if (!id) fail(503, "DRIVE_UNAVAILABLE", "Drive tidak memberi ID folder.");
    const parent = this.folder(folder);
    await retry(async () => {
      try {
        await this.client.files.create(
          {
            requestBody: {
              id,
              name,
              mimeType: "application/vnd.google-apps.folder",
              parents: [parent],
            },
            fields: "id",
          },
          { retry: false, timeout: 30000 },
        );
      } catch (error) {
        if (Number((error as { code?: number }).code) !== 409) throw error;
        const existing = await this.client.files.get({
          fileId: id,
          fields: "id,mimeType,parents,trashed",
        });
        if (
          existing.data.mimeType !== "application/vnd.google-apps.folder" ||
          existing.data.trashed ||
          !existing.data.parents?.includes(parent)
        )
          throw error;
      }
    });
    return id;
  }
  async createInFolder(
    parentId: string,
    name: string,
    mimeType: string,
    bytes: Buffer,
  ) {
    if (!/^[\w-]+$/.test(parentId))
      fail(400, "VALIDATION_ERROR", "Folder tujuan tidak valid.");
    // Preallocate one ID. Retries cannot create a second file, even if the first response is lost.
    const id = (
      await retry(() =>
        this.client.files.generateIds({ count: 1, space: "drive" }),
      )
    ).data.ids?.[0];
    if (!id) fail(503, "DRIVE_UNAVAILABLE", "Drive tidak memberi ID file.");
    await retry(async () => {
      try {
        if (bytes.length > 5 * 1024 * 1024) {
          if (!this.auth)
            fail(
              503,
              "DRIVE_UNAVAILABLE",
              "OAuth client tidak tersedia untuk upload besar.",
            );
          const session = await this.auth.request({
            url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Upload-Content-Type": mimeType,
              "X-Upload-Content-Length": String(bytes.length),
            },
            data: { id, name, parents: [parentId] },
            retry: false,
            timeout: 30000,
          });
          const location = session.headers.get("location");
          if (!location)
            fail(503, "DRIVE_UNAVAILABLE", "Drive tidak memberi sesi upload.");
          const target = new URL(location);
          if (
            target.origin !== "https://www.googleapis.com" ||
            !!target.username ||
            !!target.password ||
            !target.pathname.startsWith("/upload/drive/")
          )
            fail(503, "DRIVE_UNAVAILABLE", "Sesi upload Drive tidak valid.");
          await this.auth.request({
            url: target.href,
            method: "PUT",
            headers: {
              "Content-Type": mimeType,
              "Content-Length": String(bytes.length),
              "Content-Range": `bytes 0-${bytes.length - 1}/${bytes.length}`,
            },
            data: bytes,
            retry: false,
            timeout: 60000,
          });
        } else
          await this.client.files.create(
            {
              requestBody: { id, name, parents: [parentId] },
              media: { mimeType, body: Readable.from(bytes) },
              fields: "id",
            },
            { retry: false, timeout: 60000 },
          );
      } catch (error) {
        if (Number((error as { code?: number }).code) !== 409) throw error;
        const existing = await this.client.files.get({
          fileId: id,
          fields: "id,size",
        });
        if (Number(existing.data.size) !== bytes.length) throw error;
      }
    });
    return id;
  }
  async update(id: string, bytes: Buffer) {
    await retry(() =>
      this.client.files.update(
        {
          fileId: id,
          media: { mimeType: "application/json", body: Readable.from(bytes) },
          fields: "id",
        },
        { retry: false, timeout: 30000 },
      ),
    );
  }
  async remove(id: string) {
    await retry(() =>
      this.client.files.update({
        fileId: id,
        requestBody: { trashed: true },
        fields: "id",
      }),
    );
  }
  async share(id: string, kind: "file" | "folder" = "file") {
    await retry(() =>
      this.client.permissions.create({
        fileId: id,
        requestBody: {
          type: "anyone",
          role: "reader",
          allowFileDiscovery: false,
        },
        fields: "id",
      }),
    );
    await this.assertPublic(id);
    const { data } = await retry(() =>
      this.client.files.get({
        fileId: id,
        fields: "id,mimeType,webViewLink,webContentLink",
      }),
    );
    const viewUrl =
      kind === "folder"
        ? data.mimeType === "application/vnd.google-apps.folder" &&
          driveFolderUrl(data.webViewLink, id)
        : driveViewUrl(data.webViewLink, id);
    if (!viewUrl)
      fail(
        503,
        "INVALID_DRIVE_LINK",
        "Drive tidak mengembalikan link hasil yang valid.",
      );
    let downloadUrl: string | null = null;
    if (kind === "file" && data.webContentLink) {
      const url = new URL(data.webContentLink);
      if (
        url.protocol === "https:" &&
        ["drive.google.com", "drive.usercontent.google.com"].includes(
          url.hostname,
        ) &&
        !url.username &&
        !url.password &&
        !url.port
      )
        downloadUrl = url.href;
    }
    return { viewUrl, downloadUrl };
  }
  async assertPublic(id: string) {
    // New folder permissions may take a moment to appear on existing children.
    // Poll the actual child ACL; never assume inheritance already succeeded.
    for (let attempt = 0; attempt < 6; attempt++) {
      const acl = await retry(() =>
        this.client.permissions.list({
          fileId: id,
          fields: "permissions(type,role)",
          pageSize: 100,
        }),
      );
      if (
        acl.data.permissions?.some(
          (p) => p.type === "anyone" && p.role === "reader",
        )
      )
        return;
      if (attempt < 5)
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    fail(
      503,
      "SHARING_DENIED",
      "Drive belum mengizinkan akses publik. Download lokal atau hubungi operator.",
    );
  }
}
