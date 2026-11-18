import "./env";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { oauthClient } from "../src/lib/storage/google-drive";
const redirect = new URL(
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    "http://localhost:3847/oauth2callback",
);
if (
  redirect.protocol !== "http:" ||
  !["localhost", "127.0.0.1"].includes(redirect.hostname)
)
  throw new Error(
    "Setup CLI hanya menerima callback HTTP loopback localhost/127.0.0.1.",
  );
const oauth = oauthClient(),
  state = randomBytes(32).toString("hex");
const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
  state,
});
const server = createServer(async (req, res) => {
  const callback = new URL(req.url || "/", redirect.origin);
  if (callback.pathname !== redirect.pathname) {
    res.writeHead(404).end();
    return;
  }
  const received = callback.searchParams.get("state") || "";
  if (
    received.length !== state.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(state))
  ) {
    res.writeHead(403).end("State tidak valid.");
    return;
  }
  try {
    const code = callback.searchParams.get("code");
    if (!code) throw new Error("Consent tidak disetujui.");
    const { tokens } = await oauth.getToken(code);
    if (!tokens.refresh_token)
      throw new Error(
        "Tidak ada refresh token. Revoke grant aplikasi di akun operator dan ulangi consent.",
      );
    console.log(
      `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\nSimpan token ini hanya di .env.local / secret manager. Jangan commit atau bagikan.`,
    );
    res
      .writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      })
      .end(
        "OAuth berhasil. Kembali ke terminal lokal dan simpan refresh token di environment.",
      );
  } catch {
    res
      .writeHead(400)
      .end(
        "OAuth gagal. Periksa consent, redirect URI, dan apakah refresh token diberikan.",
      );
    process.exitCode = 1;
  } finally {
    server.close();
    clearTimeout(timeout);
  }
});
server.listen(Number(redirect.port) || 3847, redirect.hostname, () =>
  console.log(
    `Buka URL ini di browser akun operator:\n${url}\nMenunggu callback di ${redirect.href} (5 menit).`,
  ),
);
const timeout = setTimeout(() => {
  server.close();
  console.error("Callback timeout. Ulangi drive:auth.");
  process.exitCode = 1;
}, 300000);
