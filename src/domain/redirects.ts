import { z } from "#validation";
import { httpUrl, text } from "./validation.js";
export function localPath(value: string): string {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s?#\u0000-\u001f]/u.test(value) ||
    /%(?:2f|5c|00|0a|0d)/iu.test(value)
  )
    throw new Error(
      "Use a local path without query, fragment, whitespace or encoded separators",
    );
  if (/[[\]*]/u.test(value))
    throw new Error("Pattern redirects must be managed in EmDash core");
  const path = new URL(value, "https://quixseo.invalid").pathname;
  if (path !== value)
    throw new Error("Use a normalized path without dot segments");
  return path;
}
export const redirectSchema = z
  .strictObject({
    source: text(2048),
    destination: text(2048),
    type: z.union([z.literal(301), z.literal(302)]),
  })
  .check(
    z.superRefine((v, ctx) => {
      try {
        localPath(v.source);
        v.destination.startsWith("/")
          ? localPath(v.destination)
          : httpUrl(v.destination);
        if (v.source === v.destination)
          throw new Error("A redirect cannot target itself");
      } catch (e) {
        ctx.addIssue({
          code: "custom",
          message: e instanceof Error ? e.message : "Invalid redirect",
        });
      }
    }),
  );
export type RedirectRule = z.infer<typeof redirectSchema>;
export function redirectIssues(rules: RedirectRule[]): {
  source: string;
  issue: string;
}[] {
  const issues: {
    source: string;
    issue: string;
  }[] = [];
  const map = new Map<string, string>();
  for (const r of rules) {
    if (map.has(r.source))
      issues.push({
        source: r.source,
        issue: "Duplicate or conflicting source",
      });
    map.set(r.source, r.destination);
  }
  for (const r of rules) {
    const seen = new Set([r.source]);
    let target = r.destination;
    let hops = 0;
    while (map.has(target) && !seen.has(target) && hops <= rules.length) {
      seen.add(target);
      target = map.get(target) ?? "";
      hops++;
    }
    if (seen.has(target))
      issues.push({ source: r.source, issue: "Redirect loop" });
    else if (hops)
      issues.push({
        source: r.source,
        issue: `Redirect chain (${hops + 1} hops)`,
      });
  }
  return issues;
}
