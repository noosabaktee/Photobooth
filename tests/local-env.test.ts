import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { saveLocalEnv } from "../scripts/local-env";

it("persists setup secrets atomically, preserving comments and literal password hashes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "photobooth-env-"));
  const target = path.join(directory, ".env.local");
  try {
    await writeFile(
      target,
      "# private setup\nSTORAGE_MODE=mock\nGOOGLE_REFRESH_TOKEN=\nADMIN_PASSWORD_HASH=$argon2id$unchanged\n",
    );
    const secret = 'test-only-$token#value"suffix';
    await saveLocalEnv(
      {
        GOOGLE_REFRESH_TOKEN: secret,
        GOOGLE_DRIVE_PHOTOS_FOLDER_ID: "test-folder",
      },
      target,
    );
    const output = await readFile(target, "utf8");
    expect(output).toContain("# private setup");
    expect(dotenv.parse(output)).toMatchObject({
      STORAGE_MODE: "mock",
      ADMIN_PASSWORD_HASH: "$argon2id$unchanged",
      GOOGLE_REFRESH_TOKEN: secret,
      GOOGLE_DRIVE_PHOTOS_FOLDER_ID: "test-folder",
    });
    await expect(
      saveLocalEnv({ GOOGLE_REFRESH_TOKEN: "bad\nSTORAGE_MODE=evil" }, target),
    ).rejects.toThrow("Invalid environment entry");
    expect(await readFile(target, "utf8")).toBe(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
