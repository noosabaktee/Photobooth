import "./env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../examples/starter-frames/starter-frames.json" with { type: "json" };
import { FrameRepository } from "../src/lib/storage/repository";
import { GoogleDriveBackend } from "../src/lib/storage/google-drive";
import { draftSchema } from "../src/lib/schema";
if (
  process.env.STORAGE_MODE !== "google-drive" ||
  !process.env.GOOGLE_REFRESH_TOKEN
)
  throw new Error(
    "Atur STORAGE_MODE=google-drive, token dan folder hasil bootstrap. Script ini menulis frame riil ke Drive.",
  );
const repo = new FrameRepository(new GoogleDriveBackend());
const existing = await repo.list(true);
for (const seed of manifest.frames) {
  const tag = `seed:${seed.id}`;
  let current = existing.find((f) => f.tags.includes(tag));
  if (current) {
    console.log(`Lewati ${seed.name}: sudah diimport.`);
  } else {
    const overlay = await readFile(
      path.join(process.cwd(), "examples/starter-frames", seed.overlayPath),
    );
    const saved = await repo.save(
      draftSchema.parse({ ...seed, tags: [tag] }),
      overlay,
    );
    await repo.status(saved.id, "published", saved.revision);
    current = await repo.get(saved.id, true);
    console.log(
      `Imported ${seed.name}: PNG + thumbnail WebP + JSON privat, published via proxy.`,
    );
  }
  if (current.status !== "published")
    current = await repo.status(current.id, "published", current.revision);
  for (const legacy of existing.filter(
    (f) =>
      f.tags.includes(`seed:${seed.replacesSeedId}`) && f.status !== "archived",
  )) {
    await repo.status(legacy.id, "archived", legacy.revision);
    console.log(
      `Archived previous seed ${legacy.name}; original assets retained.`,
    );
  }
}
