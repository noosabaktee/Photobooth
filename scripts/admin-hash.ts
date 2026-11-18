import "./env";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
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
    "Password admin (minimal 12 karakter; input disembunyikan): ",
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
if (value.length < 12) throw new Error("Gunakan minimal 12 karakter.");
console.log(
  `ADMIN_PASSWORD_HASH=${await argon2.hash(value, { type: argon2.argon2id })}`,
);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
console.log(
  "Simpan hanya di .env.local / secret manager. Jangan commit output ini.",
);
