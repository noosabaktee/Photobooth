import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** Persist setup output locally without placing credentials in terminal logs. */
export async function saveLocalEnv(
  values: Record<string, string>,
  target = path.resolve(".env.local"),
) {
  for (const [key, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n\0]/.test(value))
      throw new Error("Invalid environment entry.");
  }
  let content = "";
  try {
    content = await readFile(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  for (const [key, value] of Object.entries(values)) {
    // dotenv does not unescape JSON-style quotes; choose a literal delimiter.
    const quote = ["'", '"', "`"].find(
      (candidate) => !value.includes(candidate),
    );
    if (!quote) throw new Error("Environment value has unsupported quoting.");
    // Next.js expands $VARIABLE even inside quotes. Preserve literal dollars.
    const escaped = value.replace(/\$/g, () => "\\$");
    const entry = `${key}=${quote}${escaped}${quote}`;
    const match = new RegExp(`^${key}=.*$`, "m");
    content = match.test(content)
      ? content.replace(match, () => entry)
      : `${content.trimEnd()}\n${entry}\n`;
  }
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally {
    await rm(temp, { force: true });
  }
}
