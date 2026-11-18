import "./env";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { saveLocalEnv } from "./local-env";
async function password() {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) {
      rl.close();
      return line;
    }
    throw new Error("Password tidak diberikan melalui stdin.");
  }
  process.stdout.write(
    "Password admin (minimal 6 karakter; input disembunyikan): ",
  );
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise<string>((resolve, reject) => {
    let value = "";
    const handler = (chunk: string) => {
      for (const c of chunk) {
        if (c === "\u0003") {
          finish();
          reject(new Error("Dibatalkan."));
          return;
        }
        if (c === "\r" || c === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    const finish = () => {
      process.stdin.off("data", handler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    process.stdin.on("data", handler);
  });
}
const value = await password();
if (value.length < 6) throw new Error("Gunakan minimal 6 karakter.");
await saveLocalEnv({
  ADMIN_PASSWORD_HASH: await argon2.hash(value, { type: argon2.argon2id }),
  ADMIN_SESSION_SECRET:
    process.env.ADMIN_SESSION_SECRET &&
    Buffer.byteLength(process.env.ADMIN_SESSION_SECRET) >= 32
      ? process.env.ADMIN_SESSION_SECRET
      : randomBytes(48).toString("base64url"),
});
console.log(
  "Password admin tersimpan di .env.local. Restart server lalu login dengan password yang baru dimasukkan. Secret tidak ditampilkan.",
);
