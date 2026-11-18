import "./env";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { saveLocalEnv } from "./local-env";

const filename = process.argv[2];
if (!filename)
  throw new Error(
    'Gunakan npm run drive:configure -- "path/client_secret.json"',
  );
const callback =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ||
  "http://localhost:3847/oauth2callback";
const parsed = z
  .object({
    web: z.object({
      client_id: z.string().min(1),
      client_secret: z.string().min(1),
      redirect_uris: z.array(z.string()),
    }),
  })
  .safeParse(JSON.parse(await readFile(filename, "utf8")));
if (!parsed.success)
  throw new Error(
    "File harus berupa JSON OAuth client bertipe Web application dari Google Cloud.",
  );
if (!parsed.data.web.redirect_uris.includes(callback))
  throw new Error(
    "Redirect URI client tidak cocok dengan callback lokal proyek.",
  );
await saveLocalEnv({
  GOOGLE_CLIENT_ID: parsed.data.web.client_id,
  GOOGLE_CLIENT_SECRET: parsed.data.web.client_secret,
  GOOGLE_OAUTH_REDIRECT_URI: callback,
});
console.log(
  "Client ID dan Client Secret disimpan di .env.local tanpa dicetak. Lanjutkan drive:auth -- --save-env.",
);
