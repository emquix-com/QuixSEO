import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// An isolated host, never the developer's test-site or an externally supplied URL.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(repo, "test-results/production");
await mkdir(output, { recursive: true });
const scratch = await realpath(tmpdir());
const root = await mkdtemp(join(scratch, "quixseo-production-"));
const checks = [];
let server;
let browser;
let failure;
const logs = [];
const port = await new Promise((resolvePort, reject) => {
  const socket = createServer();
  socket.on("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const allocated = socket.address().port;
    socket.close(() => resolvePort(allocated));
  });
});
const base = `http://127.0.0.1:${port}`;
const astro = join(root, "node_modules/astro/bin/astro.mjs");
function launch(command, args, log, env = {}) {
  const stream = createWriteStream(join(output, log));
  logs.push(stream);
  const child = spawn(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  child.once("error", () => {});
  return child;
}
async function run(command, args, log, env) {
  const child = launch(command, args, log, env);
  try {
    await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("close", (code, signal) =>
        code === 0
          ? done()
          : reject(new Error(`${log} failed: exit ${code}, signal ${signal}`)),
      );
    });
  } catch (error) {
    console.error(await readFile(join(output, log), "utf8"));
    throw error;
  }
}
async function stop() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const child = server;
  const exited = new Promise((done) => child.once("exit", done));
  child.kill("SIGTERM");
  const force = setTimeout(() => child.kill("SIGKILL"), 10000);
  await exited;
  clearTimeout(force);
  server = undefined;
}
async function ready() {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, "Server exited before readiness");
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(2000) })).ok) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("Isolated host did not become ready within 90 seconds");
}
try {
  const pkg = JSON.parse(await readFile(join(repo, "package.json"), "utf8"));
  const archive = join(repo, "dist", `quixseo-${pkg.version}.tar.gz`);
  const bytes = await readFile(archive);
  await writeFile(
    join(output, "artifact.json"),
    JSON.stringify({
      version: pkg.version,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      node: process.version,
      platform: process.platform,
    }),
  );
  await mkdir(join(root, "plugins/quixseo"), { recursive: true });
  await run(
    "tar",
    ["-xzf", archive, "-C", join(root, "plugins/quixseo")],
    "extract.log",
  );
  // A separate locked install avoids shared Vite/Astro instances. Plugin code
  // comes exclusively from the archive, never the source descriptor.
  await copyFile(join(repo, "package.json"), join(root, "package.json"));
  await copyFile(
    join(repo, "package-lock.json"),
    join(root, "package-lock.json"),
  );
  assert(
    process.env.npm_execpath,
    "Run this harness using npm run test:production",
  );
  await run(
    process.execPath,
    [process.env.npm_execpath, "ci", "--no-audit", "--no-fund"],
    "install.log",
  );
  await mkdir(join(root, "src/pages/posts"), { recursive: true });
  await copyFile(
    join(repo, "test-site/src/live.config.ts"),
    join(root, "src/live.config.ts"),
  );
  await copyFile(
    join(repo, "test-site/src/pages/index.astro"),
    join(root, "src/pages/index.astro"),
  );
  const article = await readFile(
    join(repo, "test-site/src/pages/posts/[slug].astro"),
    "utf8",
  );
  await writeFile(
    join(root, "src/pages/posts/[slug].astro"),
    article.replace("siteUrl:Astro.url.origin", "siteUrl:Astro.site.origin"),
  );
  await copyFile(
    join(repo, "examples/llms.txt.ts"),
    join(root, "src/pages/llms.txt.ts"),
  );
  await writeFile(
    join(root, "astro.config.mjs"),
    `
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {defineConfig} from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import emdash,{local} from 'emdash/astro';
import {sqlite} from 'emdash/db';
const manifest=JSON.parse(readFileSync(new URL('./plugins/quixseo/manifest.json',import.meta.url),'utf8'));
const plugin={...manifest,adminPages:manifest.admin?.pages,editorPanels:manifest.admin?.editorPanels,editorActions:manifest.admin?.editorActions,format:'standard',entrypoint:fileURLToPath(new URL('./plugins/quixseo/backend.js',import.meta.url))};
export default defineConfig({site:${JSON.stringify(base)},output:'server',adapter:node({mode:'standalone'}),session:{cookie:'quixseo-ci'},devToolbar:{enabled:false},server:{host:'127.0.0.1',port:${port}},integrations:[react(),emdash({fonts:false,database:sqlite({url:'file:'+fileURLToPath(new URL('./data.db',import.meta.url))}),storage:local({directory:fileURLToPath(new URL('./uploads',import.meta.url)),baseUrl:'/_emdash/api/media/file'}),sandboxRunner:'@emdash-cms/sandbox-workerd/sandbox',sandboxed:[plugin]})]});
`,
  );
  server = launch(
    process.execPath,
    [astro, "dev", "--ignore-lock"],
    "bootstrap.log",
    { NODE_ENV: "development" },
  );
  await ready();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const context = await browser.newContext();
  context.setDefaultTimeout(30000);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  // Initialize the disposable database and obtain a fixture session in DEV only.
  // Production tests reuse it; they never add or invoke a production auth bypass.
  await page.goto(
    `${base}/_emdash/api/setup/dev-bypass?content=0&redirect=/_emdash/admin`,
  );
  await page.waitForURL("**/admin");
  // A fresh account opens core's welcome modal in every new browser context
  // until it is dismissed. Complete the native UI before exporting the session.
  const dismissed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/_emdash/api/auth/me") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Get Started", exact: true }).click();
  assert((await dismissed).ok(), "Native welcome dismissal failed");
  await page
    .getByRole("button", { name: "Get Started", exact: true })
    .waitFor({ state: "hidden" });
  async function api(path, method = "GET", data) {
    const response = await context.request.fetch(
      `${base}/_emdash/api/${path}`,
      {
        method,
        data,
        headers: { Origin: base, "X-EmDash-Request": "1" },
      },
    );
    const body = await response.json();
    assert(
      response.ok() && body.success,
      JSON.stringify({ path, status: response.status(), body }),
    );
    return body.data;
  }
  assert.equal((await api("auth/me")).isFirstLogin, false);
  await api("schema/collections/posts", "PUT", {
    hasSeo: true,
    routable: true,
  });
  const fixture = (
    await api("content/posts", "POST", {
      slug: "qa-production-fixture",
      seo: {
        title: "QA production native title",
        description: "QA production native description",
      },
      data: {
        title: "QA production fixture",
        excerpt: "QA production excerpt",
        content: [],
      },
    })
  ).item;
  await api(`content/posts/${fixture.id}/publish`, "POST", {});
  const authState = join(root, "fixture-session.json");
  await context.storageState({ path: authState });
  await stop();
  await run(process.execPath, [astro, "build"], "build.log", {
    NODE_ENV: "production",
  });
  server = launch(
    process.execPath,
    [join(root, "dist/server/entry.mjs")],
    "server.log",
    { NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) },
  );
  await ready();
  for (const path of ["setup/dev-bypass", "auth/dev-bypass"]) {
    assert.equal((await fetch(`${base}/_emdash/api/${path}`)).status, 403);
  }
  assert.equal((await fetch(`${base}/_emdash/api/auth/me`)).status, 401);
  checks.push(
    "Production disables both dev bypasses and denies anonymous admin access",
  );
  assert.equal((await api("auth/me")).role, 50);
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/settings`);
  await page
    .getByLabel("Public site summary (optional)", { exact: true })
    .waitFor({ timeout: 30000 });
  await page.screenshot({
    path: join(output, "production-settings.png"),
    fullPage: true,
  });
  checks.push(
    "Packaged plugin loads in the production sandbox and serves authenticated admin UI",
  );
  const env = {
    NODE_ENV: "production",
    QUIXSEO_TEST_URL: base,
    QUIXSEO_AUTH_STATE: authState,
  };
  await run(
    process.execPath,
    [join(repo, "tests/browser/regressions.mjs")],
    "regressions.log",
    { ...env, QUIXSEO_QA_DIR: join(output, "regressions") },
  );
  checks.push(
    "Editor, bulk, conflict, rollback, public output and automatic audit journey passes in production",
  );
  await run(
    process.execPath,
    [join(repo, "tests/browser/llms.mjs")],
    "llms.log",
    { ...env, QUIXSEO_QA_DIR: join(output, "llms") },
  );
  checks.push("llms.txt browser journey passes in production");
  await stop();
  server = launch(
    process.execPath,
    [join(root, "dist/server/entry.mjs")],
    "restart.log",
    { NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(port) },
  );
  await ready();
  await page.goto(`${base}/_emdash/admin/plugins/quixseo/dashboard`);
  await page
    .getByText("Completed", { exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(
    (await api(`content/posts/${fixture.id}`)).item.status,
    "published",
  );
  await page.screenshot({
    path: join(output, "restart-audit.png"),
    fullPage: true,
  });
  checks.push(
    "Published content and completed audit survive a production restart",
  );
} catch (error) {
  failure = error;
} finally {
  await browser?.close();
  await stop();
  await Promise.all(logs.map((log) => new Promise((done) => log.end(done))));
  await writeFile(
    join(output, "results.json"),
    JSON.stringify(
      {
        date: new Date().toISOString(),
        checks,
        error: failure?.stack,
        authMethod:
          "Native development fixture session reused in production; production login/bootstrap itself is not certified",
      },
      null,
      2,
    ),
  );
  // Delete only this process's unique temporary host, including its private
  // session file. Never upload a database, session state or the whole temp root.
  assert.equal(await realpath(root), root);
  assert(
    dirname(root) === (await realpath(scratch)) &&
      root.split(/[\\/]/u).at(-1).startsWith("quixseo-production-"),
  );
  await rm(root, { recursive: true, force: true });
}
if (failure) throw failure;
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
