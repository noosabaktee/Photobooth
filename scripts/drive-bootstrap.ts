import "./env";
import { driveClient, retry } from "../src/lib/storage/google-drive";
import { saveLocalEnv } from "./local-env";
const drive = driveClient();
if (!process.env.GOOGLE_REFRESH_TOKEN)
  throw new Error("GOOGLE_REFRESH_TOKEN diperlukan.");
async function folder(name: string, parent?: string) {
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and appProperties has { key='snapstrip' and value='v1' }${parent ? ` and '${parent}' in parents` : ""}`;
  const { data } = await retry(() =>
    drive.files.list({ q, fields: "files(id)", pageSize: 100 }),
  );
  if ((data.files?.length || 0) > 1)
    throw new Error(
      `Folder ${name} ambigu. Periksa folder aplikasi duplikat di Drive.`,
    );
  const id =
    data.files?.[0]?.id ||
    (
      await drive.files.create({
        requestBody: {
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parent ? [parent] : undefined,
          appProperties: { snapstrip: "v1" },
        },
        fields: "id",
      })
    ).data.id;
  if (!id) throw new Error("Drive tidak mengembalikan folder ID.");
  const acl = await drive.permissions.list({
    fileId: id,
    fields: "permissions(type,role)",
  });
  if (
    acl.data.permissions?.some(
      (p) => p.type === "anyone" || p.type === "domain",
    )
  )
    throw new Error(
      `Folder ${name} memiliki izin publik/domain. Jadikan private sebelum melanjutkan.`,
    );
  return id;
}
const root = await folder("PHOTOBOOTH_ROOT"),
  frames = await folder("frames", root),
  photos = await folder("photos", root);
if (process.argv.includes("--save-env")) {
  await saveLocalEnv({
    GOOGLE_DRIVE_ROOT_FOLDER_ID: root,
    GOOGLE_DRIVE_FRAMES_FOLDER_ID: frames,
    GOOGLE_DRIVE_PHOTOS_FOLDER_ID: photos,
  });
  console.log(
    "Folder Drive privat siap. Ketiga folder ID disimpan di .env.local.",
  );
} else
  console.log(
    `GOOGLE_DRIVE_ROOT_FOLDER_ID=${root}\nGOOGLE_DRIVE_FRAMES_FOLDER_ID=${frames}\nGOOGLE_DRIVE_PHOTOS_FOLDER_ID=${photos}\nFolder tetap private. Simpan ID di environment.`,
  );
