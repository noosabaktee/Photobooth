export type Folder = "frames" | "photos";
export type StoredFile = { id: string; name: string; mimeType: string };
export interface Backend {
  list(folder: Folder): Promise<StoredFile[]>;
  read(id: string): Promise<Buffer>;
  create(
    folder: Folder,
    name: string,
    mimeType: string,
    bytes: Buffer,
  ): Promise<string>;
  update(id: string, bytes: Buffer): Promise<void>;
  remove(id: string): Promise<void>;
  createFolder(folder: Folder, name: string): Promise<string>;
  createInFolder(
    parentId: string,
    name: string,
    mimeType: string,
    bytes: Buffer,
  ): Promise<string>;
  assertPublic(id: string): Promise<void>;
  share(
    id: string,
    kind?: "file" | "folder",
  ): Promise<{ viewUrl: string; downloadUrl: string | null }>;
}
