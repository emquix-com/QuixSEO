// Optional site-level route. Copy to your Astro site's src/pages/llms.txt.ts.
// The registry sandbox cannot mount root paths. No network or privileged API.
import type { APIRoute } from "astro";

export const prerender = false;
export const GET: APIRoute = ({ rewrite, url }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/u, "");
  return rewrite(new URL(`${base}/_emdash/api/plugins/quixseo/llms-txt${url.search}`, url));
};
export const HEAD = GET;
