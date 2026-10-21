import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import quixseo from "../dist/index.mjs";

export default defineConfig({
  site: "http://localhost:4321",
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [
    react(),
    emdash({
      fonts: false,
      database: sqlite({ url: new URL("./data.db", import.meta.url).href }),
      storage: local({ directory: fileURLToPath(new URL("./uploads", import.meta.url)), baseUrl: "/_emdash/api/media/file" }),
      sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",
      sandboxed: [{ ...quixseo, entrypoint: fileURLToPath(new URL("../dist/plugin.mjs", import.meta.url)) }],
    }),
  ],
  server: { host: "127.0.0.1", port: 4321 },
  devToolbar: { enabled: false },
});
