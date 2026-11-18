import { it, expect } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { saveLocalEnv } from "../scripts/local-env";

const require = createRequire(import.meta.url);
function loadWithNext(directory: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
  delete env.GOOGLE_REFRESH_TOKEN;
  delete env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID;
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "-e",
        `require(${JSON.stringify(require.resolve("@next/env"))}).loadEnvConfig(process.argv[1], true, {info(){},error(){}}); console.log(JSON.stringify({token:process.env.GOOGLE_REFRESH_TOKEN,folder:process.env.GOOGLE_DRIVE_PHOTOS_FOLDER_ID}));`,
        directory,
      ],
      { env },
    ).toString(),
  );
}

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
    expect(output).toContain("ADMIN_PASSWORD_HASH=$argon2id$unchanged");
    expect(loadWithNext(directory)).toEqual({
      token: secret,
      folder: "test-folder",
    });
    await expect(
      saveLocalEnv({ GOOGLE_REFRESH_TOKEN: "bad\nSTORAGE_MODE=evil" }, target),
    ).rejects.toThrow("Invalid environment entry");
    expect(await readFile(target, "utf8")).toBe(output);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("saves a six-character admin password and verifies it after Next.js loads the file", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "photobooth-admin-"));
  const script = path.resolve("scripts/admin-hash.ts");
  const cli = require.resolve("tsx/cli");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
  delete env.ADMIN_PASSWORD_HASH;
  delete env.ADMIN_SESSION_SECRET;
  try {
    await writeFile(
      path.join(directory, ".env.local"),
      "# preserve Drive configuration\nGOOGLE_CLIENT_ID=test-client\n",
    );
    const output = execFileSync(process.execPath, [cli, script], {
      cwd: directory,
      input: "six123\n",
      env,
    }).toString();
    expect(output).toContain("tersimpan");
    expect(output).not.toContain("$argon2id$");
    const result = execFileSync(
      process.execPath,
      [
        "-e",
        `
      require(${JSON.stringify(require.resolve("@next/env"))}).loadEnvConfig(process.argv[1],true,{info(){},error(){}});
      require(${JSON.stringify(require.resolve("argon2"))}).verify(process.env.ADMIN_PASSWORD_HASH,"six123").then(ok=>console.log(JSON.stringify({ok,secretValid:Buffer.byteLength(process.env.ADMIN_SESSION_SECRET)>=32,client:process.env.GOOGLE_CLIENT_ID})));
    `,
        directory,
      ],
      { env },
    ).toString();
    expect(JSON.parse(result)).toEqual({
      ok: true,
      secretValid: true,
      client: "test-client",
    });
    const saved = await readFile(path.join(directory, ".env.local"), "utf8");
    expect(() =>
      execFileSync(process.execPath, [cli, script], {
        cwd: directory,
        input: "short\n",
        env,
        stdio: ["pipe", "pipe", "pipe"],
      }),
    ).toThrow();
    expect(await readFile(path.join(directory, ".env.local"), "utf8")).toBe(
      saved,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
